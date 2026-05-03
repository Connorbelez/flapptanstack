import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { grantDealAccess } from "../deals/mutations";
import { appendAuditJournalEntry } from "../engine/auditJournal";
import { executeTransition } from "../engine/transition";
import type { CommandSource } from "../engine/types";
import { authedAction, convex, requirePermissionAction } from "../fluent";
import { getAccountLenderId } from "../ledger/accountOwnership";
import {
	createGuestInvitationDelivery,
	getLatestGuestInvitationForDeal,
} from "../legalRepresentation/invitations";

type CheckoutSessionDoc = Doc<"checkoutSessions">;
type DealDoc = Doc<"deals">;
type DealPackageStatus = Doc<"dealDocumentPackages">["status"];
type DealAccessRole = Doc<"dealAccess">["role"];
type LockFeeTransferDoc = Doc<"transferRequests">;

type DealHandoffResult =
	| {
			ok: true;
			checkoutSessionId: Id<"checkoutSessions">;
			dealId: Id<"deals">;
			packageId?: Id<"dealDocumentPackages">;
			packageStatus?: DealPackageStatus;
			status: "created" | "already_created";
	  }
	| {
			ok: false;
			code: string;
			message: string;
	  };
type DealHandoffFailure = Extract<DealHandoffResult, { ok: false }>;

const dealHandoffArgsValidator = {
	checkoutSessionId: v.id("checkoutSessions"),
};

const checkoutHandoffSource: CommandSource = {
	actorId: "checkout_handoff",
	actorType: "system",
	channel: "api_webhook",
};

function fail(code: string, message: string): DealHandoffFailure {
	return { ok: false, code, message };
}

function selectedLawyerId(
	selectedLawyer: CheckoutSessionDoc["selectedLawyer"]
): string {
	if (selectedLawyer.type === "platform_lawyer") {
		if (!selectedLawyer.lawyerId) {
			throw new ConvexError("Platform lawyer is missing an auth principal");
		}
		return selectedLawyer.lawyerId;
	}
	return normalizeGuestLawyerEmail(selectedLawyer.email);
}

function normalizeGuestLawyerEmail(email: string): string {
	return email.trim().toLowerCase();
}

function hasCanonicalLawyerRole(
	membership: Pick<Doc<"organizationMemberships">, "roleSlug" | "roleSlugs">
): boolean {
	return (
		membership.roleSlug === "lawyer" ||
		membership.roleSlugs?.includes("lawyer") === true
	);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function metadataValue(
	metadata: LockFeeTransferDoc["metadata"],
	key: string
): unknown {
	return metadata && typeof metadata === "object"
		? (metadata as Record<string, unknown>)[key]
		: undefined;
}

function valuesMatch(left: unknown, right: unknown): boolean {
	return String(left) === String(right);
}

async function ensureCompletedCheckout(
	ctx: Pick<MutationCtx, "db">,
	checkoutSessionId: Id<"checkoutSessions">
): Promise<CheckoutSessionDoc | DealHandoffFailure> {
	const checkoutSession = await ctx.db.get(checkoutSessionId);
	if (!checkoutSession) {
		return fail("checkout_not_found", "Checkout session not found");
	}
	if (checkoutSession.status !== "completed") {
		return fail(
			"checkout_not_completed",
			"Checkout session must be completed before deal handoff"
		);
	}
	if (!checkoutSession.lockFeeTransferRequestId) {
		return fail(
			"missing_lock_fee_transfer",
			"Completed checkout is missing lock-fee transfer linkage"
		);
	}
	if (!checkoutSession.stripeCheckoutSessionId) {
		return fail(
			"missing_stripe_checkout_session",
			"Completed checkout is missing Stripe Checkout Session linkage"
		);
	}
	if (
		checkoutSession.selectedLawyer.type === "platform_lawyer" &&
		!checkoutSession.selectedLawyer.lawyerId
	) {
		return fail(
			"missing_platform_lawyer_auth_id",
			"Platform lawyer checkout selection is missing an auth principal"
		);
	}
	return checkoutSession;
}

async function ensurePlatformLawyerRoleEvidence(
	ctx: Pick<MutationCtx, "db">,
	checkoutSession: CheckoutSessionDoc
): Promise<DealHandoffFailure | null> {
	if (checkoutSession.selectedLawyer.type !== "platform_lawyer") {
		return null;
	}
	const lawyerId = checkoutSession.selectedLawyer.lawyerId;
	if (!lawyerId) {
		return fail(
			"missing_platform_lawyer_auth_id",
			"Platform lawyer checkout selection is missing an auth principal"
		);
	}
	const memberships = await ctx.db
		.query("organizationMemberships")
		.withIndex("byUser", (query) => query.eq("userWorkosId", lawyerId))
		.collect();
	const hasRoleEvidence = memberships.some(
		(membership) =>
			membership.status === "active" && hasCanonicalLawyerRole(membership)
	);
	if (!hasRoleEvidence) {
		return fail(
			"missing_platform_lawyer_role",
			"Platform lawyer checkout selection is missing active WorkOS lawyer role evidence"
		);
	}
	return null;
}

async function ensureValidLockFeeTransfer(
	ctx: Pick<MutationCtx, "db">,
	checkoutSession: CheckoutSessionDoc
): Promise<LockFeeTransferDoc | DealHandoffFailure> {
	if (!checkoutSession.lockFeeTransferRequestId) {
		return fail(
			"missing_lock_fee_transfer",
			"Completed checkout is missing lock-fee transfer linkage"
		);
	}
	const transfer = await ctx.db.get(checkoutSession.lockFeeTransferRequestId);
	if (!transfer) {
		return fail(
			"missing_lock_fee_transfer",
			"Completed checkout lock-fee transfer was not found"
		);
	}
	const expected = {
		amount: checkoutSession.lockFeeAmount,
		currency: checkoutSession.lockFeeCurrency,
		direction: "inbound",
		lenderId: checkoutSession.lenderId,
		mortgageId: checkoutSession.mortgageId,
		providerCode: "stripe",
		status: "confirmed",
		transferType: "locking_fee_collection",
	};
	const valid =
		transfer.amount === expected.amount &&
		transfer.currency === expected.currency &&
		transfer.direction === expected.direction &&
		transfer.lenderId === expected.lenderId &&
		transfer.mortgageId === expected.mortgageId &&
		transfer.providerCode === expected.providerCode &&
		transfer.status === expected.status &&
		transfer.transferType === expected.transferType &&
		valuesMatch(
			metadataValue(transfer.metadata, "checkoutSessionId"),
			checkoutSession._id
		) &&
		valuesMatch(
			metadataValue(transfer.metadata, "stripeCheckoutSessionId"),
			checkoutSession.stripeCheckoutSessionId
		);
	if (!valid) {
		return fail(
			"invalid_lock_fee_transfer",
			"Completed checkout lock-fee transfer does not match the paid checkout"
		);
	}
	if (
		checkoutSession.stripePaymentIntentId &&
		!valuesMatch(
			metadataValue(transfer.metadata, "stripePaymentIntentId"),
			checkoutSession.stripePaymentIntentId
		)
	) {
		return fail(
			"invalid_lock_fee_transfer",
			"Completed checkout lock-fee transfer is linked to a different Stripe payment intent"
		);
	}
	return transfer;
}

async function findExistingDealForCheckout(
	ctx: Pick<MutationCtx, "db">,
	checkoutSession: CheckoutSessionDoc
): Promise<DealDoc | null> {
	if (checkoutSession.dealId) {
		const deal = await ctx.db.get(checkoutSession.dealId);
		if (deal) {
			return deal;
		}
	}
	const checkoutDeal = await ctx.db
		.query("deals")
		.withIndex("by_checkout_session", (query) =>
			query.eq("checkoutSessionId", checkoutSession._id)
		)
		.first();
	if (checkoutDeal) {
		return checkoutDeal;
	}
	return ctx.db
		.query("deals")
		.withIndex("by_reservation", (query) =>
			query.eq("reservationId", checkoutSession.reservationId)
		)
		.first();
}

async function patchExistingDealLinks(
	ctx: Pick<MutationCtx, "db">,
	args: {
		checkoutSession: CheckoutSessionDoc;
		deal: DealDoc;
	}
): Promise<DealHandoffFailure | null> {
	const conflicts = [
		[
			"checkoutSessionId",
			args.deal.checkoutSessionId,
			args.checkoutSession._id,
		],
		[
			"reservationId",
			args.deal.reservationId,
			args.checkoutSession.reservationId,
		],
		["mortgageId", args.deal.mortgageId, args.checkoutSession.mortgageId],
		[
			"lockFeeTransferRequestId",
			args.deal.lockFeeTransferRequestId,
			args.checkoutSession.lockFeeTransferRequestId,
		],
		["lenderId", args.deal.lenderId, args.checkoutSession.lenderId],
		["buyerId", args.deal.buyerId, args.checkoutSession.lenderAuthId],
		[
			"fractionalShare",
			args.deal.fractionalShare,
			args.checkoutSession.requestedFractions,
		],
		[
			"stripeCheckoutSessionId",
			args.deal.stripeCheckoutSessionId,
			args.checkoutSession.stripeCheckoutSessionId,
		],
		[
			"stripePaymentIntentId",
			args.deal.stripePaymentIntentId,
			args.checkoutSession.stripePaymentIntentId,
		],
		[
			"lawyerType",
			args.deal.lawyerType,
			args.checkoutSession.selectedLawyer.type,
		],
		[
			"lawyerId",
			args.deal.lawyerId,
			selectedLawyerId(args.checkoutSession.selectedLawyer),
		],
	] as const;
	for (const [field, current, expected] of conflicts) {
		if (current !== undefined && current !== expected) {
			return fail(
				"deal_link_conflict",
				`Existing deal has a conflicting ${field} linkage`
			);
		}
	}

	const patch: Partial<DealDoc> = {};
	if (!args.deal.checkoutSessionId) {
		patch.checkoutSessionId = args.checkoutSession._id;
	}
	if (!args.deal.reservationId) {
		patch.reservationId = args.checkoutSession.reservationId;
	}
	if (!args.deal.lockFeeTransferRequestId) {
		patch.lockFeeTransferRequestId =
			args.checkoutSession.lockFeeTransferRequestId;
	}
	if (!args.deal.stripeCheckoutSessionId) {
		patch.stripeCheckoutSessionId =
			args.checkoutSession.stripeCheckoutSessionId;
	}
	if (!args.deal.stripePaymentIntentId) {
		patch.stripePaymentIntentId = args.checkoutSession.stripePaymentIntentId;
	}
	if (!args.deal.selectedLawyer) {
		patch.selectedLawyer = args.checkoutSession.selectedLawyer;
	}
	if (!args.deal.lawyerType) {
		patch.lawyerType = args.checkoutSession.selectedLawyer.type;
	}
	if (!args.deal.lawyerId) {
		patch.lawyerId = selectedLawyerId(args.checkoutSession.selectedLawyer);
	}
	if (!args.deal.lenderId) {
		patch.lenderId = args.checkoutSession.lenderId;
	}
	if (Object.keys(patch).length > 0) {
		await ctx.db.patch(args.deal._id, patch);
	}
	return null;
}

async function patchCheckoutAndTransferLinks(
	ctx: Pick<MutationCtx, "db">,
	args: {
		checkoutSession: CheckoutSessionDoc;
		dealId: Id<"deals">;
	}
): Promise<DealHandoffFailure | null> {
	const now = Date.now();
	if (args.checkoutSession.dealId !== args.dealId) {
		await ctx.db.patch(args.checkoutSession._id, {
			dealId: args.dealId,
			updatedAt: now,
		});
	}

	if (args.checkoutSession.lockFeeTransferRequestId) {
		const transfer = await ctx.db.get(
			args.checkoutSession.lockFeeTransferRequestId
		);
		if (transfer?.dealId !== undefined && transfer.dealId !== args.dealId) {
			return fail(
				"transfer_link_conflict",
				"Checkout lock-fee transfer is already linked to a different deal"
			);
		}
		if (transfer && transfer.dealId !== args.dealId) {
			await ctx.db.patch(transfer._id, { dealId: args.dealId });
		}
	}
	return null;
}

interface DealAccessGrant {
	role: DealAccessRole;
	userId: string;
}

function buildDealAccessGrants(
	checkoutSession: CheckoutSessionDoc,
	sellerAuthId?: string
): DealAccessGrant[] {
	return [
		{ role: "lender", userId: checkoutSession.lenderAuthId },
		...(sellerAuthId
			? [{ role: "lender" as const, userId: sellerAuthId }]
			: []),
		{
			role: checkoutSession.selectedLawyer.type,
			userId: selectedLawyerId(checkoutSession.selectedLawyer),
		},
	];
}

async function ensureDealAccessForCheckout(
	ctx: Pick<MutationCtx, "db">,
	args: {
		checkoutSession: CheckoutSessionDoc;
		dealId: Id<"deals">;
		sellerAuthId?: string;
	}
): Promise<
	{ ok: true } | { error: string; grant: DealAccessGrant; ok: false }
> {
	for (const grant of buildDealAccessGrants(
		args.checkoutSession,
		args.sellerAuthId
	)) {
		try {
			await grantDealAccess(ctx.db, {
				userId: grant.userId,
				dealId: args.dealId,
				role: grant.role,
				grantedBy: checkoutHandoffSource.actorId ?? "checkout_handoff",
			});
		} catch (error) {
			return { error: errorMessage(error), grant, ok: false };
		}
	}
	return { ok: true };
}

async function ensureGuestLawyerInvitationForDeal(
	ctx: MutationCtx,
	args: {
		checkoutSession: CheckoutSessionDoc;
		deal: DealDoc;
	}
) {
	if (args.checkoutSession.selectedLawyer.type !== "guest_lawyer") {
		return null;
	}
	const latestInvitation = await getLatestGuestInvitationForDeal(
		ctx,
		args.deal._id
	);
	if (latestInvitation?.status === "pending") {
		return latestInvitation._id;
	}
	const invitation = await createGuestInvitationDelivery(ctx, {
		createdBy: checkoutHandoffSource.actorId ?? "checkout_handoff",
		deal: args.deal,
		now: Date.now(),
		scheduleDelivery: true,
		selectedLawyer: args.checkoutSession.selectedLawyer,
		targetEmail: args.checkoutSession.selectedLawyer.email,
	});
	return invitation.invitationId;
}

async function handleAccessGrantFailure(
	ctx: MutationCtx,
	args: {
		checkoutSession: CheckoutSessionDoc;
		dealId: Id<"deals">;
		failure: { error: string; grant: DealAccessGrant };
	}
): Promise<DealHandoffFailure> {
	await appendHandoffAudit(ctx, {
		checkoutSession: args.checkoutSession,
		dealId: args.dealId,
		eventType: "CHECKOUT_DEAL_ACCESS_FAILED",
		newState: "access_grant_failed",
		outcome: "rejected",
		payload: {
			error: args.failure.error,
			role: args.failure.grant.role,
			userId: args.failure.grant.userId,
		},
		previousState: "initiated",
		reason: args.failure.error,
	});
	return fail(
		"access_grant_failed",
		"Checkout deal was created but access grant failed; replay handoff after correcting the access record"
	);
}

async function appendHandoffAudit(
	ctx: MutationCtx,
	args: {
		checkoutSession: CheckoutSessionDoc;
		dealId: Id<"deals">;
		eventType: string;
		newState: string;
		outcome: "transitioned" | "rejected";
		payload?: Record<string, unknown>;
		previousState: string;
		reason?: string;
	}
) {
	await appendAuditJournalEntry(ctx, {
		actorId: checkoutHandoffSource.actorId ?? "checkout_handoff",
		actorType: checkoutHandoffSource.actorType,
		channel: checkoutHandoffSource.channel,
		entityId: String(args.dealId),
		entityType: "deal",
		eventCategory: "operational",
		eventType: args.eventType,
		idempotencyKey: `${args.eventType}:${String(args.checkoutSession._id)}`,
		linkedRecordIds: {
			checkoutSessionId: String(args.checkoutSession._id),
			dealId: String(args.dealId),
			lenderId: String(args.checkoutSession.lenderId),
			mortgageId: String(args.checkoutSession.mortgageId),
			reservationId: String(args.checkoutSession.reservationId),
			transferRequestId: String(args.checkoutSession.lockFeeTransferRequestId),
		},
		machineVersion: "checkout-handoff",
		newState: args.newState,
		organizationId: undefined,
		outcome: args.outcome,
		payload: args.payload,
		previousState: args.previousState,
		reason: args.reason,
		timestamp: Date.now(),
	});
}

async function appendCheckoutHandoffFailureAudit(
	ctx: MutationCtx,
	args: {
		checkoutSession: CheckoutSessionDoc;
		code: string;
		dealId?: Id<"deals">;
		message: string;
	}
) {
	await appendAuditJournalEntry(ctx, {
		actorId: checkoutHandoffSource.actorId ?? "checkout_handoff",
		actorType: checkoutHandoffSource.actorType,
		channel: checkoutHandoffSource.channel,
		entityId: args.dealId
			? String(args.dealId)
			: String(args.checkoutSession._id),
		entityType: "deal",
		eventCategory: "operational",
		eventType: "CHECKOUT_DEAL_HANDOFF_FAILED",
		idempotencyKey: `CHECKOUT_DEAL_HANDOFF_FAILED:${String(args.checkoutSession._id)}:${args.code}`,
		linkedRecordIds: {
			checkoutSessionId: String(args.checkoutSession._id),
			dealId: args.dealId ? String(args.dealId) : undefined,
			lenderId: String(args.checkoutSession.lenderId),
			mortgageId: String(args.checkoutSession.mortgageId),
			reservationId: String(args.checkoutSession.reservationId),
			transferRequestId: String(args.checkoutSession.lockFeeTransferRequestId),
		},
		machineVersion: "checkout-handoff",
		newState: "handoff_failed",
		organizationId: undefined,
		outcome: "rejected",
		payload: { code: args.code, message: args.message },
		previousState: "completed",
		reason: args.message,
		timestamp: Date.now(),
	});
}

async function createDealForCheckout(
	ctx: MutationCtx,
	checkoutSession: CheckoutSessionDoc
): Promise<Id<"deals"> | DealHandoffResult> {
	const [mortgage, reservation, sellerAccount, buyerAccount] =
		await Promise.all([
			ctx.db.get(checkoutSession.mortgageId),
			ctx.db.get(checkoutSession.reservationId),
			ctx.db.get(checkoutSession.sellerAccountId),
			ctx.db.get(checkoutSession.buyerAccountId),
		]);
	if (!mortgage) {
		return fail("missing_mortgage", "Checkout mortgage not found");
	}
	if (!reservation || reservation.status === "voided") {
		return fail(
			"invalid_reservation",
			"Checkout reservation is missing or no longer valid"
		);
	}
	if (!(sellerAccount && buyerAccount)) {
		return fail(
			"missing_ledger_account",
			"Checkout reservation account linkage is incomplete"
		);
	}
	if (reservation.dealId) {
		return fail(
			"reservation_already_linked",
			"Checkout reservation is already linked to a different deal"
		);
	}

	const sellerLedgerLenderId = getAccountLenderId(sellerAccount);
	if (!sellerLedgerLenderId) {
		return fail(
			"missing_seller_lender",
			"Checkout seller account is missing domain lender ownership"
		);
	}
	if (checkoutSession.lockFeeTransferRequestId) {
		const transfer = await ctx.db.get(checkoutSession.lockFeeTransferRequestId);
		if (transfer?.dealId) {
			return fail(
				"transfer_link_conflict",
				"Checkout lock-fee transfer is already linked to a different deal"
			);
		}
	}
	const platformLawyerFailure = await ensurePlatformLawyerRoleEvidence(
		ctx,
		checkoutSession
	);
	if (platformLawyerFailure) {
		return platformLawyerFailure;
	}

	const now = Date.now();
	const dealId = await ctx.db.insert("deals", {
		orgId: mortgage.orgId,
		status: "initiated",
		machineContext: {
			dealId: "",
			reservationId: String(checkoutSession.reservationId),
		},
		lastTransitionAt: undefined,
		mortgageId: checkoutSession.mortgageId,
		buyerId: checkoutSession.lenderAuthId,
		sellerId: sellerLedgerLenderId,
		fractionalShare: checkoutSession.requestedFractions,
		closingDate: undefined,
		lockingFeeAmount: checkoutSession.lockFeeAmount,
		lawyerId: selectedLawyerId(checkoutSession.selectedLawyer),
		reservationId: checkoutSession.reservationId,
		checkoutSessionId: checkoutSession._id,
		lockFeeTransferRequestId: checkoutSession.lockFeeTransferRequestId,
		stripeCheckoutSessionId: checkoutSession.stripeCheckoutSessionId,
		stripePaymentIntentId: checkoutSession.stripePaymentIntentId,
		selectedLawyer: checkoutSession.selectedLawyer,
		lawyerType: checkoutSession.selectedLawyer.type,
		lenderId: checkoutSession.lenderId,
		createdAt: now,
		createdBy: checkoutSession.lenderAuthId,
	});
	await ctx.db.patch(dealId, {
		machineContext: {
			dealId: String(dealId),
			reservationId: String(checkoutSession.reservationId),
		},
	});
	await ctx.db.patch(reservation._id, { dealId: String(dealId) });
	const linkFailure = await patchCheckoutAndTransferLinks(ctx, {
		checkoutSession,
		dealId,
	});
	if (linkFailure) {
		await appendCheckoutHandoffFailureAudit(ctx, {
			checkoutSession,
			code: linkFailure.code,
			dealId,
			message: linkFailure.message,
		});
		return linkFailure;
	}
	const accessResult = await ensureDealAccessForCheckout(ctx, {
		checkoutSession,
		dealId,
		sellerAuthId: sellerLedgerLenderId,
	});
	if (!accessResult.ok) {
		return handleAccessGrantFailure(ctx, {
			checkoutSession,
			dealId,
			failure: accessResult,
		});
	}
	const createdDeal = await ctx.db.get(dealId);
	if (!createdDeal) {
		return fail("deal_not_found", "Checkout deal disappeared during handoff");
	}
	await ensureGuestLawyerInvitationForDeal(ctx, {
		checkoutSession,
		deal: createdDeal,
	});
	await appendHandoffAudit(ctx, {
		checkoutSession,
		dealId,
		eventType: "CHECKOUT_DEAL_CREATED",
		newState: "initiated",
		outcome: "transitioned",
		payload: {
			checkoutSessionId: String(checkoutSession._id),
			lockFeeTransferRequestId: String(
				checkoutSession.lockFeeTransferRequestId
			),
			reservationId: String(checkoutSession.reservationId),
		},
		previousState: "none",
	});
	await executeTransition(ctx, {
		entityType: "deal",
		entityId: dealId,
		eventType: "DEAL_LOCKED",
		payload: { closingDate: now },
		source: checkoutHandoffSource,
	});
	return dealId;
}

export const createOrReuseDealForPaidCheckout = convex
	.mutation()
	.input(dealHandoffArgsValidator)
	.handler(async (ctx, args): Promise<DealHandoffResult> => {
		const checkoutSession = await ensureCompletedCheckout(
			ctx,
			args.checkoutSessionId
		);
		if ("ok" in checkoutSession) {
			return checkoutSession;
		}

		const lockFeeTransfer = await ensureValidLockFeeTransfer(
			ctx,
			checkoutSession
		);
		if ("ok" in lockFeeTransfer) {
			await appendCheckoutHandoffFailureAudit(ctx, {
				checkoutSession,
				code: lockFeeTransfer.code,
				message: lockFeeTransfer.message,
			});
			return lockFeeTransfer;
		}

		const existingDeal = await findExistingDealForCheckout(
			ctx,
			checkoutSession
		);
		if (existingDeal) {
			const dealLinkFailure = await patchExistingDealLinks(ctx, {
				checkoutSession,
				deal: existingDeal,
			});
			if (dealLinkFailure) {
				await appendCheckoutHandoffFailureAudit(ctx, {
					checkoutSession,
					code: dealLinkFailure.code,
					dealId: existingDeal._id,
					message: dealLinkFailure.message,
				});
				return dealLinkFailure;
			}
			const linkFailure = await patchCheckoutAndTransferLinks(ctx, {
				checkoutSession,
				dealId: existingDeal._id,
			});
			if (linkFailure) {
				await appendCheckoutHandoffFailureAudit(ctx, {
					checkoutSession,
					code: linkFailure.code,
					dealId: existingDeal._id,
					message: linkFailure.message,
				});
				return linkFailure;
			}
			const platformLawyerFailure = await ensurePlatformLawyerRoleEvidence(
				ctx,
				checkoutSession
			);
			if (platformLawyerFailure) {
				await appendCheckoutHandoffFailureAudit(ctx, {
					checkoutSession,
					code: platformLawyerFailure.code,
					dealId: existingDeal._id,
					message: platformLawyerFailure.message,
				});
				return platformLawyerFailure;
			}
			const accessResult = await ensureDealAccessForCheckout(ctx, {
				checkoutSession,
				dealId: existingDeal._id,
				sellerAuthId: existingDeal.sellerId,
			});
			if (!accessResult.ok) {
				return handleAccessGrantFailure(ctx, {
					checkoutSession,
					dealId: existingDeal._id,
					failure: accessResult,
				});
			}
			const currentDeal = (await ctx.db.get(existingDeal._id)) ?? existingDeal;
			await ensureGuestLawyerInvitationForDeal(ctx, {
				checkoutSession,
				deal: currentDeal,
			});
			let currentStatus = existingDeal.status;
			if (existingDeal.status === "initiated") {
				await executeTransition(ctx, {
					entityType: "deal",
					entityId: existingDeal._id,
					eventType: "DEAL_LOCKED",
					payload: { closingDate: Date.now() },
					source: checkoutHandoffSource,
				});
				currentStatus = "lawyerOnboarding.pending";
			}
			await appendHandoffAudit(ctx, {
				checkoutSession,
				dealId: existingDeal._id,
				eventType: "CHECKOUT_DEAL_REPLAYED",
				newState: currentStatus,
				outcome: "transitioned",
				previousState: existingDeal.status,
			});
			return {
				ok: true,
				checkoutSessionId: checkoutSession._id,
				dealId: existingDeal._id,
				status: "already_created",
			};
		}

		const dealId = await createDealForCheckout(ctx, checkoutSession);
		if (typeof dealId !== "string") {
			return dealId;
		}

		return {
			ok: true,
			checkoutSessionId: checkoutSession._id,
			dealId,
			status: "created",
		};
	})
	.internal();

async function ensurePackageForHandoff(
	ctx: Pick<ActionCtx, "runAction" | "runQuery">,
	args: {
		dealId: Id<"deals">;
	}
) {
	const existingPackage = await ctx.runQuery(
		internal.documents.dealPackages.getPackageByDealInternal,
		{ dealId: args.dealId }
	);
	const retry =
		existingPackage?.status === "failed" ||
		existingPackage?.status === "partial_failure";
	const packageResult = await ctx.runAction(
		internal.documents.dealPackages.runCreateDocumentPackageInternal,
		{
			dealId: args.dealId,
			retry,
		}
	);
	return {
		packageId: packageResult.packageId,
		packageStatus: packageResult.status,
	};
}

export const recordHandoffFailure = convex
	.mutation()
	.input({
		checkoutSessionId: v.id("checkoutSessions"),
		code: v.string(),
		dealId: v.optional(v.id("deals")),
		message: v.string(),
	})
	.handler(async (ctx, args) => {
		const checkoutSession = await ctx.db.get(args.checkoutSessionId);
		if (!checkoutSession) {
			return;
		}
		await appendCheckoutHandoffFailureAudit(ctx, {
			checkoutSession,
			code: args.code,
			dealId: args.dealId,
			message: args.message,
		});
	})
	.internal();

async function createDealFromPaidCheckout(
	ctx: Pick<ActionCtx, "runAction" | "runMutation" | "runQuery">,
	args: { checkoutSessionId: Id<"checkoutSessions"> }
): Promise<DealHandoffResult> {
	const dealResult = await ctx.runMutation(
		internal.checkout.dealHandoff.createOrReuseDealForPaidCheckout,
		args
	);
	if (!dealResult.ok) {
		return dealResult;
	}

	try {
		const packageResult = await ensurePackageForHandoff(ctx, {
			dealId: dealResult.dealId,
		});
		if (
			packageResult.packageStatus === "failed" ||
			packageResult.packageStatus === "partial_failure"
		) {
			await ctx.runMutation(
				internal.checkout.dealHandoff.recordHandoffFailure,
				{
					checkoutSessionId: dealResult.checkoutSessionId,
					code: "package_generation_failed",
					dealId: dealResult.dealId,
					message: `Document package generation finished with ${packageResult.packageStatus}`,
				}
			);
		}
		return { ...dealResult, ...packageResult };
	} catch (error) {
		const message = errorMessage(error);
		await ctx.runMutation(internal.checkout.dealHandoff.recordHandoffFailure, {
			checkoutSessionId: dealResult.checkoutSessionId,
			code: "package_generation_failed",
			dealId: dealResult.dealId,
			message,
		});
		return fail("package_generation_failed", message);
	}
}

export const createDealFromPaidCheckoutInternal = convex
	.action()
	.input(dealHandoffArgsValidator)
	.handler(createDealFromPaidCheckout)
	.internal();

export const createDealFromPaidCheckoutForViewer = authedAction
	.use(requirePermissionAction("listing:invest"))
	.input(dealHandoffArgsValidator)
	.handler(async (ctx, args): Promise<DealHandoffResult> => {
		const checkoutSession = await ctx.runQuery(
			internal.checkout.dealHandoff.getCheckoutForHandoffAuth,
			args
		);
		if (!checkoutSession) {
			throw new ConvexError("Checkout session not found");
		}
		if (checkoutSession.lenderAuthId !== ctx.viewer.authId) {
			throw new ConvexError(
				"Forbidden: checkout session is not owned by viewer"
			);
		}
		return createDealFromPaidCheckout(ctx, args);
	})
	.public();

export const getCheckoutForHandoffAuth = convex
	.query()
	.input(dealHandoffArgsValidator)
	.handler(async (ctx, args) => {
		return ctx.db.get(args.checkoutSessionId);
	})
	.internal();
