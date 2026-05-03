import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getLenderByAuthId } from "../auth/actorResolution";
import { convex } from "../fluent";
import { getAccountLenderId } from "../ledger/accountOwnership";
import {
	reserveSharesHandler,
	voidReservationHandler,
} from "../ledger/mutations";
import { assertPlatformLawyerSelectableForCheckout } from "../legalRepresentation/platformLawyers";
import { assertPlatformLawyerAuthSelectableForCheckout } from "../legalRepresentation/profiles";
import { matchesMarketplaceFilters } from "../listings/marketplace";
import {
	clampMarketplaceFiltersToLenderConstraints,
	resolveViewerLenderConstraintForPortal,
} from "../listings/portalVisibility";
import { resolveSellerLotForReservation } from "../marketplace/saleInventory";
import {
	assertCheckoutTransitionAllowed,
	CHECKOUT_ACTIVE_STATUSES,
	isActiveCheckoutStatus,
	isTerminalCheckoutStatus,
} from "./status";
import {
	assertPositiveWholeFractions,
	buildCheckoutIdempotencyKey,
	buildCheckoutReleaseIdempotencyKey,
	CHECKOUT_SESSION_TTL_MS,
	checkoutFailure,
	type StartMarketplaceCheckoutResult,
} from "./types";
import {
	CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
	CHECKOUT_LOCK_FEE_CURRENCY,
	parseSelectedLawyerSnapshot,
	selectedLawyerSnapshotValidator,
} from "./validators";

type CheckoutSessionDoc = Doc<"checkoutSessions">;
type LedgerAccountDoc = Doc<"ledger_accounts">;
type LenderDoc = Doc<"lenders">;
type ListingDoc = Doc<"listings">;
type ProductionListingDoc = ListingDoc & { mortgageId: Id<"mortgages"> };

const checkoutSource = (actor: string) =>
	({
		type: "user" as const,
		actor,
		channel: "marketplace_checkout",
	}) as const;

const today = () => new Date().toISOString().slice(0, 10);

type CheckoutReleaseStatus = "abandoned" | "expired";

const prepareMarketplaceCheckoutArgsValidator = {
	listingId: v.id("listings"),
	portalId: v.id("portals"),
	requestedFractions: v.number(),
	selectedLawyer: selectedLawyerSnapshotValidator,
	viewerAuthId: v.string(),
	viewerIsFairLendAdmin: v.boolean(),
};

const attachProviderSessionArgsValidator = {
	checkoutSessionId: v.id("checkoutSessions"),
	stripeCheckoutSessionId: v.string(),
	stripePaymentIntentId: v.optional(v.string()),
	now: v.optional(v.number()),
};

const markProviderStartFailedArgsValidator = {
	checkoutSessionId: v.id("checkoutSessions"),
	failureReason: v.string(),
	now: v.optional(v.number()),
};

const expireCheckoutSessionArgsValidator = {
	checkoutSessionId: v.id("checkoutSessions"),
	now: v.optional(v.number()),
	reason: v.optional(v.string()),
};

const abandonCheckoutSessionArgsValidator = {
	checkoutSessionId: v.id("checkoutSessions"),
	now: v.optional(v.number()),
	viewerAuthId: v.string(),
	viewerIsFairLendAdmin: v.boolean(),
};

const listExpiredCheckoutSessionsArgsValidator = {
	limit: v.optional(v.number()),
	now: v.optional(v.number()),
};

const recordProviderExpiryAttemptArgsValidator = {
	checkoutSessionId: v.id("checkoutSessions"),
	error: v.optional(v.string()),
	ok: v.boolean(),
	now: v.optional(v.number()),
};

function checkoutSystemSource(reason: string) {
	return {
		type: "system" as const,
		actor: reason,
		channel: "marketplace_checkout",
	};
}

function isProviderCleanupUnfinished(session: CheckoutSessionDoc): boolean {
	return (
		session.stripeCheckoutSessionId !== undefined &&
		(session.status === "expired" || session.status === "abandoned") &&
		session.providerExpiryStatus !== "succeeded" &&
		session.providerExpiryStatus !== "not_required"
	);
}

function isSameActiveCheckout(
	session: CheckoutSessionDoc,
	args: {
		lenderId: Id<"lenders">;
		portalId: Id<"portals">;
		requestedFractions: number;
		now: number;
		selectedLawyer: CheckoutSessionDoc["selectedLawyer"];
	}
): boolean {
	return (
		session.lenderId === args.lenderId &&
		session.portalId === args.portalId &&
		session.requestedFractions === args.requestedFractions &&
		sameSelectedLawyer(session.selectedLawyer, args.selectedLawyer) &&
		session.expiresAt > args.now &&
		isActiveCheckoutStatus(session.status)
	);
}

function sameSelectedLawyer(
	left: CheckoutSessionDoc["selectedLawyer"],
	right: CheckoutSessionDoc["selectedLawyer"]
): boolean {
	return (
		left.type === right.type &&
		left.name === right.name &&
		left.email === right.email &&
		left.firm === right.firm &&
		selectedLawyerLsoPart(left) === selectedLawyerLsoPart(right) &&
		(left.type === "platform_lawyer" ? left.lawyerId : undefined) ===
			(right.type === "platform_lawyer" ? right.lawyerId : undefined)
	);
}

function selectedLawyerLsoPart(
	selectedLawyer: CheckoutSessionDoc["selectedLawyer"]
): string {
	const lso = selectedLawyer.lso;
	if (!lso) {
		return "";
	}
	return JSON.stringify({
		barNumber: lso.barNumber ?? "",
		jurisdiction: lso.jurisdiction ?? "",
		licensingStatus: lso.licensingStatus ?? "",
		lsoLawyerId: lso.lsoLawyerId ?? "",
		restrictionStatus: lso.restrictionStatus ?? "",
		restrictionSummary: lso.restrictionSummary ?? "",
		source: lso.source ?? "",
		sourceFetchedAt: lso.sourceFetchedAt ?? "",
	});
}

function selectedLawyerIdempotencyPart(
	selectedLawyer: CheckoutSessionDoc["selectedLawyer"]
): string {
	return [
		selectedLawyer.type,
		selectedLawyer.type === "platform_lawyer" ? selectedLawyer.lawyerId : "",
		selectedLawyer.email,
		selectedLawyer.name,
		selectedLawyer.firm ?? "",
		selectedLawyerLsoPart(selectedLawyer),
	].join(":");
}

async function assertCheckoutLawyerSelectable(
	ctx: MutationCtx,
	args: {
		now: number;
		selectedLawyer: CheckoutSessionDoc["selectedLawyer"];
	}
): Promise<CheckoutSessionDoc["selectedLawyer"]> {
	if (args.selectedLawyer.type === "guest_lawyer") {
		return args.selectedLawyer;
	}
	const option = await assertPlatformLawyerAuthSelectableForCheckout(ctx, {
		authId: args.selectedLawyer.lawyerId,
		now: args.now,
	});
	return {
		type: "platform_lawyer",
		lawyerId: option.lawyerId,
		name: option.name,
		email: option.email,
		...(option.firm === undefined ? {} : { firm: option.firm }),
		...(option.barNumber || option.jurisdiction
			? {
					lso: {
						...(option.barNumber === undefined
							? {}
							: { barNumber: option.barNumber }),
						...(option.jurisdiction === undefined
							? {}
							: { jurisdiction: option.jurisdiction }),
						source: "platform_profile",
					},
				}
			: {}),
	};
}

async function findActiveCheckoutSession(
	ctx: MutationCtx,
	args: {
		lenderId: Id<"lenders">;
		listingId: Id<"listings">;
		now: number;
		portalId: Id<"portals">;
		requestedFractions: number;
		selectedLawyer: CheckoutSessionDoc["selectedLawyer"];
	}
): Promise<CheckoutSessionDoc | null> {
	for (const status of CHECKOUT_ACTIVE_STATUSES) {
		const sessions = await ctx.db
			.query("checkoutSessions")
			.withIndex("by_listing_status", (q) =>
				q.eq("listingId", args.listingId).eq("status", status)
			)
			.collect();
		const matching = sessions.find((session) =>
			isSameActiveCheckout(session, args)
		);
		if (matching) {
			return matching;
		}
	}
	return null;
}

function releasePrepared(session: CheckoutSessionDoc) {
	return {
		checkoutSessionId: session._id,
		expiresAt: session.expiresAt,
		providerExpiryAttemptedAt: session.providerExpiryAttemptedAt,
		providerExpiryStatus: session.providerExpiryStatus,
		status: session.status,
		stripeCheckoutSessionId: session.stripeCheckoutSessionId,
	};
}

async function releaseCheckoutSession(
	ctx: MutationCtx,
	args: {
		actorAuthId: string;
		checkoutSession: CheckoutSessionDoc;
		now: number;
		reason: string;
		sourceType: "system" | "user";
		status: CheckoutReleaseStatus;
	}
) {
	if (
		isTerminalCheckoutStatus(args.checkoutSession.status) &&
		args.checkoutSession.status !== args.status
	) {
		return releasePrepared(args.checkoutSession);
	}
	if (args.checkoutSession.status !== args.status) {
		assertCheckoutTransitionAllowed(args.checkoutSession.status, args.status);
	}

	const reservation = await ctx.db.get(args.checkoutSession.reservationId);
	if (!reservation) {
		throw new ConvexError({
			code: "CHECKOUT_RESERVATION_NOT_FOUND" as const,
			message: `Checkout ${args.checkoutSession._id} references missing reservation ${args.checkoutSession.reservationId}`,
		});
	}
	if (reservation.status === "pending") {
		await voidReservationHandler(ctx, {
			reservationId: args.checkoutSession.reservationId,
			effectiveDate: today(),
			idempotencyKey: buildCheckoutReleaseIdempotencyKey(
				args.checkoutSession._id,
				args.status
			),
			reason: args.reason,
			source:
				args.sourceType === "system"
					? checkoutSystemSource(args.reason)
					: checkoutSource(args.actorAuthId),
		});
	} else if (reservation.status !== "voided") {
		throw new ConvexError({
			code: "CHECKOUT_RESERVATION_NOT_RELEASABLE" as const,
			message: `Checkout ${args.checkoutSession._id} reservation ${reservation._id} is ${reservation.status}, expected pending or voided`,
		});
	}

	if (args.checkoutSession.status !== args.status) {
		await ctx.db.patch(args.checkoutSession._id, {
			status: args.status,
			failureReason: args.reason,
			resolvedAt: args.now,
			updatedAt: args.now,
			...(args.checkoutSession.stripeCheckoutSessionId
				? {}
				: { providerExpiryStatus: "not_required" as const }),
		});
	}

	const updated = await ctx.db.get(args.checkoutSession._id);
	if (!updated) {
		throw new ConvexError("Checkout session missing after release");
	}
	return releasePrepared(updated);
}

function checkoutPrepared(session: CheckoutSessionDoc) {
	return {
		ok: true as const,
		checkoutSessionId: session._id,
		expiresAt: session.expiresAt,
		idempotencyKey: session.idempotencyKey,
		lenderAuthId: session.lenderAuthId,
		lenderId: session.lenderId,
		listingId: session.listingId,
		mortgageId: session.mortgageId,
		portalId: session.portalId,
		requestedFractions: session.requestedFractions,
		reservationId: session.reservationId,
		selectedLawyer: session.selectedLawyer,
	};
}

function assertListingAvailableForCheckout(
	listing: ListingDoc | null
): ProductionListingDoc | StartMarketplaceCheckoutResult {
	if (!listing || listing.status !== "published") {
		return checkoutFailure("listing_unavailable", "Listing is unavailable");
	}
	if (listing.dataSource !== "mortgage_pipeline" || !listing.mortgageId) {
		return checkoutFailure(
			"demo_listing_not_supported",
			"Demo listings are not supported for hosted checkout"
		);
	}
	return listing as ProductionListingDoc;
}

function isFailureResult(
	value: ListingDoc | StartMarketplaceCheckoutResult
): value is StartMarketplaceCheckoutResult {
	return "ok" in value;
}

function resolveLedgerLenderId(lender: LenderDoc): string {
	return String(lender._id);
}

async function resolveSellerAccount(
	ctx: MutationCtx,
	args: {
		actorAuthId: string;
		effectiveDate: string;
		idempotencyKey: string;
		mortgageId: Id<"mortgages">;
		requestedFractions: number;
	}
): Promise<LedgerAccountDoc | null> {
	return (
		(
			await resolveSellerLotForReservation(ctx, {
				actorAuthId: args.actorAuthId,
				effectiveDate: args.effectiveDate,
				idempotencyKey: args.idempotencyKey,
				mortgageId: args.mortgageId,
				requestedLedgerUnits: args.requestedFractions,
			})
		)?.account ?? null
	);
}

async function validateSelectedLawyerForCheckout(
	ctx: MutationCtx,
	args: {
		now: number;
		selectedLawyer: CheckoutSessionDoc["selectedLawyer"];
	}
): Promise<StartMarketplaceCheckoutResult | null> {
	if (args.selectedLawyer.type !== "platform_lawyer") {
		return null;
	}
	try {
		await assertPlatformLawyerSelectableForCheckout(ctx, {
			lawyerAuthId: args.selectedLawyer.lawyerId,
			now: args.now,
		});
		return null;
	} catch (error) {
		return checkoutFailure(
			"invalid_lawyer",
			error instanceof Error
				? error.message
				: "Selected platform lawyer is unavailable"
		);
	}
}

export const prepareMarketplaceCheckout = convex
	.mutation()
	.input(prepareMarketplaceCheckoutArgsValidator)
	.handler(async (ctx, args) => {
		const now = Date.now();
		let requestedFractions: number;
		let selectedLawyer: CheckoutSessionDoc["selectedLawyer"];
		try {
			requestedFractions = assertPositiveWholeFractions(
				args.requestedFractions
			);
		} catch (error) {
			return checkoutFailure(
				"insufficient_fractions",
				error instanceof Error ? error.message : "Invalid fractions"
			);
		}
		try {
			selectedLawyer = parseSelectedLawyerSnapshot(args.selectedLawyer);
		} catch (error) {
			return checkoutFailure(
				"invalid_lawyer",
				error instanceof Error ? error.message : "Invalid lawyer"
			);
		}
		try {
			selectedLawyer = await assertCheckoutLawyerSelectable(ctx, {
				now,
				selectedLawyer,
			});
		} catch (error) {
			return checkoutFailure(
				"invalid_lawyer",
				error instanceof Error ? error.message : "Invalid lawyer"
			);
		}
		const lawyerValidationFailure = await validateSelectedLawyerForCheckout(
			ctx,
			{
				now,
				selectedLawyer,
			}
		);
		if (lawyerValidationFailure) {
			return lawyerValidationFailure;
		}

		const lender = await getLenderByAuthId(ctx, args.viewerAuthId);
		if (!lender) {
			return checkoutFailure("unauthorized", "Lender profile is required");
		}

		const listingCheck = assertListingAvailableForCheckout(
			await ctx.db.get(args.listingId)
		);
		if (isFailureResult(listingCheck)) {
			return listingCheck;
		}

		let lenderConstraint: Awaited<
			ReturnType<typeof resolveViewerLenderConstraintForPortal>
		>;
		try {
			lenderConstraint = await resolveViewerLenderConstraintForPortal(ctx, {
				portalId: args.portalId,
				viewerAuthId: args.viewerAuthId,
				viewerIsFairLendAdmin: args.viewerIsFairLendAdmin,
			});
		} catch {
			return checkoutFailure(
				"listing_unavailable",
				"Listing is unavailable in this portal"
			);
		}

		const visibilityFilters = clampMarketplaceFiltersToLenderConstraints(
			undefined,
			lenderConstraint
		);
		if (!matchesMarketplaceFilters(listingCheck, visibilityFilters)) {
			return checkoutFailure(
				"listing_unavailable",
				"Listing is unavailable in this portal"
			);
		}

		const activeCheckout = await findActiveCheckoutSession(ctx, {
			lenderId: lender._id,
			listingId: listingCheck._id,
			now,
			portalId: args.portalId,
			requestedFractions,
			selectedLawyer,
		});
		if (activeCheckout) {
			return checkoutPrepared(activeCheckout);
		}

		const buyerLedgerLenderId = resolveLedgerLenderId(lender);
		const sellerAccount = await resolveSellerAccount(ctx, {
			actorAuthId: args.viewerAuthId,
			effectiveDate: today(),
			idempotencyKey: `marketplace-checkout:${String(
				listingCheck._id
			)}:${String(lender._id)}:${requestedFractions}:${selectedLawyerIdempotencyPart(
				selectedLawyer
			)}`,
			mortgageId: listingCheck.mortgageId,
			requestedFractions,
		});
		const sellerLedgerLenderId = sellerAccount
			? getAccountLenderId(sellerAccount)
			: undefined;
		if (!(sellerAccount && sellerLedgerLenderId)) {
			return checkoutFailure(
				"insufficient_fractions",
				"Insufficient fractions are available"
			);
		}

		let reservationId: Id<"ledger_reservations">;
		try {
			const reservation = await reserveSharesHandler(ctx, {
				mortgageId: String(listingCheck.mortgageId),
				sellerLenderId: sellerLedgerLenderId,
				buyerLenderId: buyerLedgerLenderId,
				amount: requestedFractions,
				effectiveDate: today(),
				idempotencyKey: `marketplace-checkout-reservation:${String(
					listingCheck._id
				)}:${String(lender._id)}:${requestedFractions}:${selectedLawyerIdempotencyPart(
					selectedLawyer
				)}:${String(now)}`,
				source: checkoutSource(args.viewerAuthId),
				metadata: {
					listingId: String(listingCheck._id),
					portalId: String(args.portalId),
					selectedLawyerType: selectedLawyer.type,
				},
			});
			reservationId = reservation.reservationId;
		} catch {
			return checkoutFailure(
				"insufficient_fractions",
				"Insufficient fractions are available"
			);
		}

		const startedAt = now;
		const reservationDoc = await ctx.db.get(reservationId);
		if (!reservationDoc) {
			throw new ConvexError("Reservation missing after checkout prepare");
		}

		const checkoutSessionId = await ctx.db.insert("checkoutSessions", {
			status: "preparing_provider_session",
			listingId: listingCheck._id,
			mortgageId: listingCheck.mortgageId,
			portalId: args.portalId,
			lenderId: lender._id,
			lenderAuthId: args.viewerAuthId,
			sellerAccountId: sellerAccount._id,
			buyerAccountId: reservationDoc.buyerAccountId,
			reservationId,
			requestedFractions,
			lockFeeAmount: CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
			lockFeeCurrency: CHECKOUT_LOCK_FEE_CURRENCY,
			selectedLawyer,
			startedAt,
			expiresAt: startedAt + CHECKOUT_SESSION_TTL_MS,
			idempotencyKey: "pending",
			createdBy: args.viewerAuthId,
			updatedAt: startedAt,
		});
		const checkoutSession = await ctx.db.get(checkoutSessionId);
		if (!checkoutSession) {
			throw new ConvexError("Failed to create checkout session");
		}
		const idempotencyKey = buildCheckoutIdempotencyKey(checkoutSessionId);
		await ctx.db.patch(checkoutSessionId, {
			idempotencyKey,
			updatedAt: Date.now(),
		});

		return checkoutPrepared({
			...checkoutSession,
			idempotencyKey,
		});
	})
	.internal();

export const attachProviderSession = convex
	.mutation()
	.input(attachProviderSessionArgsValidator)
	.handler(async (ctx, args) => {
		const now = args.now ?? Date.now();
		const checkoutSession = await ctx.db.get(args.checkoutSessionId);
		if (!checkoutSession) {
			throw new ConvexError("Checkout session not found");
		}

		if (checkoutSession.status === "hosted_checkout_open") {
			if (
				checkoutSession.stripeCheckoutSessionId !== args.stripeCheckoutSessionId
			) {
				throw new ConvexError("Checkout provider session mismatch");
			}
			return checkoutPrepared(checkoutSession);
		}

		assertCheckoutTransitionAllowed(
			checkoutSession.status,
			"hosted_checkout_open"
		);

		await ctx.db.patch(checkoutSession._id, {
			status: "hosted_checkout_open",
			stripeCheckoutSessionId: args.stripeCheckoutSessionId,
			...(args.stripePaymentIntentId
				? { stripePaymentIntentId: args.stripePaymentIntentId }
				: {}),
			updatedAt: now,
		});

		const updated = await ctx.db.get(checkoutSession._id);
		if (!updated) {
			throw new ConvexError("Checkout session missing after provider attach");
		}
		return checkoutPrepared(updated);
	})
	.internal();

export const markProviderStartFailed = convex
	.mutation()
	.input(markProviderStartFailedArgsValidator)
	.handler(async (ctx, args) => {
		const now = args.now ?? Date.now();
		const checkoutSession = await ctx.db.get(args.checkoutSessionId);
		if (!checkoutSession) {
			throw new ConvexError("Checkout session not found");
		}
		if (checkoutSession.status === "provider_start_failed") {
			return checkoutPrepared(checkoutSession);
		}
		if (checkoutSession.status !== "preparing_provider_session") {
			assertCheckoutTransitionAllowed(
				checkoutSession.status,
				"provider_start_failed"
			);
		}

		const reservation = await ctx.db.get(checkoutSession.reservationId);
		if (reservation?.status === "pending") {
			await voidReservationHandler(ctx, {
				reservationId: checkoutSession.reservationId,
				effectiveDate: today(),
				idempotencyKey: `marketplace-checkout-provider-failed:${String(
					checkoutSession._id
				)}`,
				reason: args.failureReason,
				source: checkoutSource(checkoutSession.createdBy),
			});
		}

		await ctx.db.patch(checkoutSession._id, {
			status: "provider_start_failed",
			failureReason: args.failureReason,
			resolvedAt: now,
			updatedAt: now,
		});

		const updated = await ctx.db.get(checkoutSession._id);
		if (!updated) {
			throw new ConvexError("Checkout session missing after compensation");
		}
		return checkoutPrepared(updated);
	})
	.internal();

export const expireCheckoutSession = convex
	.mutation()
	.input(expireCheckoutSessionArgsValidator)
	.handler(async (ctx, args) => {
		const now = args.now ?? Date.now();
		const checkoutSession = await ctx.db.get(args.checkoutSessionId);
		if (!checkoutSession) {
			throw new ConvexError("Checkout session not found");
		}
		if (
			isActiveCheckoutStatus(checkoutSession.status) &&
			checkoutSession.expiresAt > now
		) {
			return releasePrepared(checkoutSession);
		}
		return releaseCheckoutSession(ctx, {
			actorAuthId: "checkout-expiry",
			checkoutSession,
			now,
			reason: args.reason ?? "checkout_expired",
			sourceType: "system",
			status: "expired",
		});
	})
	.internal();

export const abandonCheckoutSession = convex
	.mutation()
	.input(abandonCheckoutSessionArgsValidator)
	.handler(async (ctx, args) => {
		const now = args.now ?? Date.now();
		const checkoutSession = await ctx.db.get(args.checkoutSessionId);
		if (!checkoutSession) {
			throw new ConvexError("Checkout session not found");
		}
		if (
			checkoutSession.lenderAuthId !== args.viewerAuthId &&
			!args.viewerIsFairLendAdmin
		) {
			throw new ConvexError("Forbidden: checkout session owner required");
		}
		return releaseCheckoutSession(ctx, {
			actorAuthId: args.viewerAuthId,
			checkoutSession,
			now,
			reason: "checkout_abandoned",
			sourceType: "user",
			status: "abandoned",
		});
	})
	.internal();

export const listExpiredCheckoutSessions = convex
	.query()
	.input(listExpiredCheckoutSessionsArgsValidator)
	.handler(async (ctx, args) => {
		const now = args.now ?? Date.now();
		const limit = Math.max(1, Math.min(args.limit ?? 25, 100));
		const checkoutSessionIds: Id<"checkoutSessions">[] = [];
		for (const status of CHECKOUT_ACTIVE_STATUSES) {
			const sessions = await ctx.db
				.query("checkoutSessions")
				.withIndex("by_status_expires_at", (q) =>
					q.eq("status", status).lte("expiresAt", now)
				)
				.take(limit - checkoutSessionIds.length);
			checkoutSessionIds.push(...sessions.map((session) => session._id));
			if (checkoutSessionIds.length >= limit) {
				break;
			}
		}
		if (checkoutSessionIds.length < limit) {
			const unfinishedTerminalSessions = await ctx.db
				.query("checkoutSessions")
				.withIndex("by_status_expires_at", (q) =>
					q.eq("status", "expired").lte("expiresAt", now)
				)
				.filter((q) =>
					q.and(
						q.neq(q.field("providerExpiryStatus"), "succeeded"),
						q.neq(q.field("providerExpiryStatus"), "not_required")
					)
				)
				.take(limit - checkoutSessionIds.length);
			checkoutSessionIds.push(
				...unfinishedTerminalSessions
					.filter(isProviderCleanupUnfinished)
					.map((session) => session._id)
			);
		}
		return { checkoutSessionIds, now };
	})
	.internal();

export const recordProviderExpiryAttempt = convex
	.mutation()
	.input(recordProviderExpiryAttemptArgsValidator)
	.handler(async (ctx, args) => {
		const now = args.now ?? Date.now();
		const checkoutSession = await ctx.db.get(args.checkoutSessionId);
		if (!checkoutSession) {
			throw new ConvexError("Checkout session not found");
		}
		if (
			checkoutSession.providerExpiryStatus === "succeeded" ||
			checkoutSession.providerExpiryStatus === "not_required"
		) {
			return releasePrepared(checkoutSession);
		}
		await ctx.db.patch(args.checkoutSessionId, {
			providerExpiryAttemptedAt: now,
			providerExpiryFailureReason: args.ok ? undefined : args.error,
			providerExpiryStatus: args.ok ? "succeeded" : "failed",
			updatedAt: now,
		});
		const updated = await ctx.db.get(args.checkoutSessionId);
		if (!updated) {
			throw new ConvexError("Checkout session missing after provider record");
		}
		return releasePrepared(updated);
	})
	.internal();
