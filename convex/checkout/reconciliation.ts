import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { executeTransition } from "../engine/transition";
import type { CommandSource } from "../engine/types";
import { convex } from "../fluent";
import { getAccountLenderId } from "../ledger/accountOwnership";
import { reserveSharesHandler } from "../ledger/reservations";
import { createTransferRequestRecord } from "../payments/transfers/mutations";
import { parseCheckoutStripeMetadata } from "./metadata";
import {
	buildLateSuccessRefundRequest,
	lateSuccessRefundCurrency,
} from "./refunds";
import {
	assertCheckoutTransitionAllowed,
	isActiveCheckoutStatus,
} from "./status";
import {
	CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
	CHECKOUT_LOCK_FEE_CURRENCY,
} from "./validators";

type CheckoutSessionDoc = Doc<"checkoutSessions">;
type TransferRequestDoc = Doc<"transferRequests">;
interface CheckoutPatchBase {
	readonly lastProviderEventId: string;
	readonly stripeCheckoutSessionId: string;
	readonly stripePaymentIntentId?: string;
	readonly updatedAt: number;
}
interface StripeSuccessReconciliationArgs {
	readonly amount?: number;
	readonly checkoutSession: CheckoutSessionDoc;
	readonly currency?: string;
	readonly occurredAt: number;
	readonly providerEventId: string;
	readonly stripeCheckoutSessionId: string;
	readonly stripePaymentIntentId?: string;
	readonly webhookEventId: Id<"webhookEvents">;
}

const checkoutReconciliationKindValidator = v.union(
	v.literal("success"),
	v.literal("failure")
);

const reconcileStripeCheckoutWebhookArgsValidator = {
	amount: v.optional(v.number()),
	currency: v.optional(v.string()),
	failureReason: v.optional(v.string()),
	kind: checkoutReconciliationKindValidator,
	metadata: v.record(v.string(), v.string()),
	occurredAt: v.number(),
	providerEventId: v.string(),
	stripeCheckoutSessionId: v.optional(v.string()),
	stripePaymentIntentId: v.optional(v.string()),
	webhookEventId: v.id("webhookEvents"),
};

const checkoutWebhookSource: CommandSource = {
	actorId: "stripe",
	actorType: "system",
	channel: "api_webhook",
};

const today = () => new Date().toISOString().slice(0, 10);

function isKnownTerminalInvalidForLateSuccess(
	status: CheckoutSessionDoc["status"]
) {
	return (
		status === "expired" ||
		status === "abandoned" ||
		status === "provider_start_failed" ||
		status === "refunded_late_success"
	);
}

function isActiveExpiredForLateSuccess(
	checkoutSession: CheckoutSessionDoc,
	now: number
) {
	return (
		(checkoutSession.status === "hosted_checkout_open" ||
			checkoutSession.status === "payment_failed_retryable") &&
		checkoutSession.expiresAt <= now
	);
}

function canAttemptLateRelock(
	checkoutSession: CheckoutSessionDoc,
	now: number
) {
	return (
		checkoutSession.status === "expired" ||
		isActiveExpiredForLateSuccess(checkoutSession, now) ||
		(checkoutSession.status === "refunded_late_success" &&
			checkoutSession.lateSuccessRefund?.status !== "completed")
	);
}

function providerRefForCheckoutTransfer(args: {
	readonly stripeCheckoutSessionId: string;
	readonly stripePaymentIntentId?: string;
}) {
	return args.stripePaymentIntentId ?? args.stripeCheckoutSessionId;
}

function checkoutTransferMetadata(args: {
	readonly checkoutSession: CheckoutSessionDoc;
	readonly idempotencyKey: string;
	readonly providerEventId: string;
	readonly stripeCheckoutSessionId: string;
	readonly stripePaymentIntentId?: string;
}): Record<string, unknown> {
	return {
		checkoutSessionId: String(args.checkoutSession._id),
		idempotencyKey: args.idempotencyKey,
		providerEventId: args.providerEventId,
		reservationId: String(args.checkoutSession.reservationId),
		stripeCheckoutSessionId: args.stripeCheckoutSessionId,
		...(args.stripePaymentIntentId
			? { stripePaymentIntentId: args.stripePaymentIntentId }
			: {}),
	};
}

function shallowMetadataEqual(
	left: Record<string, unknown> | undefined,
	right: Record<string, unknown>
): boolean {
	const leftRecord = left ?? {};
	const leftKeys = Object.keys(leftRecord);
	const rightKeys = Object.keys(right);
	return (
		leftKeys.length === rightKeys.length &&
		rightKeys.every((key) => leftRecord[key] === right[key])
	);
}

async function patchWebhookStatus(
	ctx: MutationCtx,
	args: {
		readonly error?: string;
		readonly status: "processed" | "failed";
		readonly transferRequestId?: Id<"transferRequests">;
		readonly webhookEventId: Id<"webhookEvents">;
	}
) {
	const webhookEvent = await ctx.db.get(args.webhookEventId);
	if (!webhookEvent) {
		throw new ConvexError("Webhook event not found");
	}
	await ctx.db.patch(args.webhookEventId, {
		status: args.status,
		processedAt: Date.now(),
		attempts: webhookEvent.attempts + 1,
		...(args.error ? { error: args.error } : { error: undefined }),
		...(args.transferRequestId
			? { transferRequestId: args.transferRequestId }
			: {}),
	});
}

async function failReconciliation(
	ctx: MutationCtx,
	args: {
		readonly checkoutSessionId?: Id<"checkoutSessions">;
		readonly error: string;
		readonly providerEventId: string;
		readonly webhookEventId: Id<"webhookEvents">;
	}
) {
	if (args.checkoutSessionId) {
		const checkoutSession = await ctx.db.get(args.checkoutSessionId);
		if (checkoutSession) {
			await ctx.db.patch(checkoutSession._id, {
				failureReason: args.error,
				lastProviderEventId: args.providerEventId,
				updatedAt: Date.now(),
			});
		}
	}
	await patchWebhookStatus(ctx, {
		error: args.error,
		status: "failed",
		webhookEventId: args.webhookEventId,
	});
	return { ok: false as const, error: args.error };
}

async function resolveCheckoutSession(
	ctx: MutationCtx,
	args: {
		readonly metadataCheckoutSessionId: string;
		readonly stripeCheckoutSessionId?: string;
	}
): Promise<CheckoutSessionDoc | null> {
	if (args.stripeCheckoutSessionId) {
		const byStripeId = await ctx.db
			.query("checkoutSessions")
			.withIndex("by_stripe_checkout_session", (q) =>
				q.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId)
			)
			.first();
		if (byStripeId) {
			return byStripeId;
		}
	}
	return ctx.db.get(args.metadataCheckoutSessionId as Id<"checkoutSessions">);
}

function validateMetadataMatchesCheckout(
	checkoutSession: CheckoutSessionDoc,
	metadata: ReturnType<typeof parseCheckoutStripeMetadata>
): string | null {
	const checks: [string, string, string][] = [
		[
			"checkoutSessionId",
			String(checkoutSession._id),
			metadata.checkoutSessionId,
		],
		[
			"reservationId",
			String(checkoutSession.reservationId),
			String(metadata.reservationId),
		],
		[
			"listingId",
			String(checkoutSession.listingId),
			String(metadata.listingId),
		],
		[
			"mortgageId",
			String(checkoutSession.mortgageId),
			String(metadata.mortgageId),
		],
		["portalId", String(checkoutSession.portalId), String(metadata.portalId)],
		["lenderId", String(checkoutSession.lenderId), String(metadata.lenderId)],
		["lenderAuthId", checkoutSession.lenderAuthId, metadata.lenderAuthId],
	];
	for (const [field, expected, actual] of checks) {
		if (expected !== actual) {
			return `Stripe checkout metadata ${field} mismatch`;
		}
	}
	if (checkoutSession.requestedFractions !== metadata.requestedFractions) {
		return "Stripe checkout metadata requestedFractions mismatch";
	}
	if (checkoutSession.lockFeeAmount !== metadata.lockFeeAmount) {
		return "Stripe checkout metadata lockFeeAmount mismatch";
	}
	if (checkoutSession.lockFeeCurrency !== metadata.lockFeeCurrency) {
		return "Stripe checkout metadata lockFeeCurrency mismatch";
	}
	if (checkoutSession.selectedLawyer.type !== metadata.selectedLawyerType) {
		return "Stripe checkout metadata selectedLawyerType mismatch";
	}
	if (
		checkoutSession.selectedLawyer.type === "platform_lawyer" &&
		checkoutSession.selectedLawyer.lawyerId !== metadata.selectedLawyerId
	) {
		return "Stripe checkout metadata selectedLawyerId mismatch";
	}
	return null;
}

async function getExistingTransfer(
	ctx: MutationCtx,
	transferId: Id<"transferRequests"> | undefined
): Promise<TransferRequestDoc | null> {
	return transferId ? ctx.db.get(transferId) : null;
}

async function createOrConfirmLockFeeTransfer(
	ctx: MutationCtx,
	args: {
		readonly checkoutSession: CheckoutSessionDoc;
		readonly providerEventId: string;
		readonly settledAt: number;
		readonly stripeCheckoutSessionId: string;
		readonly stripePaymentIntentId?: string;
	}
) {
	const idempotencyKey = `checkout-lock-fee:${String(args.checkoutSession._id)}`;
	const metadata = checkoutTransferMetadata({
		checkoutSession: args.checkoutSession,
		idempotencyKey,
		providerEventId: args.providerEventId,
		stripeCheckoutSessionId: args.stripeCheckoutSessionId,
		stripePaymentIntentId: args.stripePaymentIntentId,
	});
	const transferId = await createTransferRequestRecord(ctx, {
		amount: CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
		counterpartyId: String(args.checkoutSession.lenderId),
		counterpartyType: "lender",
		currency: CHECKOUT_LOCK_FEE_CURRENCY,
		direction: "inbound",
		idempotencyKey,
		lenderId: args.checkoutSession.lenderId,
		metadata,
		mortgageId: args.checkoutSession.mortgageId,
		providerCode: "stripe",
		source: checkoutWebhookSource,
		transferType: "locking_fee_collection",
	});

	const transfer = await ctx.db.get(transferId);
	if (!transfer) {
		throw new ConvexError("Lock-fee transfer missing after creation");
	}
	const providerRef = providerRefForCheckoutTransfer(args);
	const transferPatch: {
		metadata?: Record<string, unknown>;
		providerRef?: string;
	} = {};
	if (transfer.providerRef !== providerRef) {
		transferPatch.providerRef = providerRef;
	}
	const mergedMetadata = {
		...(transfer.metadata as Record<string, unknown> | undefined),
		...metadata,
	};
	if (
		!shallowMetadataEqual(
			transfer.metadata as Record<string, unknown> | undefined,
			mergedMetadata
		)
	) {
		transferPatch.metadata = mergedMetadata;
	}
	if (Object.keys(transferPatch).length > 0) {
		await ctx.db.patch(transferId, transferPatch);
	}

	if (transfer.status !== "confirmed") {
		await executeTransition(ctx, {
			entityType: "transfer",
			entityId: transferId,
			eventType: "FUNDS_SETTLED",
			payload: {
				settledAt: args.settledAt,
				providerData: {
					providerRef,
					stripeCheckoutSessionId: args.stripeCheckoutSessionId,
					stripePaymentIntentId: args.stripePaymentIntentId,
				},
			},
			source: checkoutWebhookSource,
		});
	}

	return transferId;
}

async function relockExpiredCheckoutReservation(
	ctx: MutationCtx,
	args: {
		readonly checkoutSession: CheckoutSessionDoc;
		readonly providerEventId: string;
		readonly stripeCheckoutSessionId: string;
		readonly stripePaymentIntentId?: string;
	}
): Promise<CheckoutSessionDoc | null> {
	const reservation = await ctx.db.get(args.checkoutSession.reservationId);
	if (reservation?.status === "pending") {
		return args.checkoutSession;
	}
	if (reservation?.status !== "voided") {
		return null;
	}

	const [sellerAccount, buyerAccount] = await Promise.all([
		ctx.db.get(args.checkoutSession.sellerAccountId),
		ctx.db.get(args.checkoutSession.buyerAccountId),
	]);
	const sellerLenderId = sellerAccount
		? getAccountLenderId(sellerAccount)
		: undefined;
	const buyerLenderId = buyerAccount
		? getAccountLenderId(buyerAccount)
		: undefined;
	if (!(sellerLenderId && buyerLenderId)) {
		return null;
	}

	const relockArgs = {
		amount: args.checkoutSession.requestedFractions,
		buyerLenderId,
		effectiveDate: today(),
		idempotencyKey: `marketplace-checkout-late-relock:${String(
			args.checkoutSession._id
		)}:${providerRefForCheckoutTransfer(args)}`,
		metadata: {
			checkoutSessionId: String(args.checkoutSession._id),
			originalReservationId: String(args.checkoutSession.reservationId),
			providerEventId: args.providerEventId,
			stripeCheckoutSessionId: args.stripeCheckoutSessionId,
			stripePaymentIntentId: args.stripePaymentIntentId,
		},
		mortgageId: String(args.checkoutSession.mortgageId),
		sellerLenderId,
		source: { type: "webhook", actor: "stripe", channel: "api_webhook" },
	} as const;
	let replacement: Awaited<ReturnType<typeof reserveSharesHandler>>;
	try {
		replacement = await reserveSharesHandler(ctx, relockArgs);
	} catch (error) {
		console.warn("[checkout.reconciliation] late checkout re-lock failed", {
			checkoutSessionId: String(args.checkoutSession._id),
			error: error instanceof Error ? error.message : error,
			providerEventId: args.providerEventId,
			stripeCheckoutSessionId: args.stripeCheckoutSessionId,
			stripePaymentIntentId: args.stripePaymentIntentId,
		});
		return null;
	}
	const replacementReservation = await ctx.db.get(replacement.reservationId);
	if (!replacementReservation) {
		throw new ConvexError("Late checkout re-lock reservation missing");
	}
	await ctx.db.patch(args.checkoutSession._id, {
		buyerAccountId: replacementReservation.buyerAccountId,
		failureReason: undefined,
		reservationId: replacementReservation._id,
		sellerAccountId: replacementReservation.sellerAccountId,
		updatedAt: Date.now(),
	});
	const updated = await ctx.db.get(args.checkoutSession._id);
	if (!updated) {
		throw new ConvexError("Checkout session missing after late re-lock");
	}
	return updated;
}

async function completeCheckoutFromStripeSuccess(
	ctx: MutationCtx,
	args: {
		readonly checkoutPatchBase: CheckoutPatchBase;
		readonly checkoutSession: CheckoutSessionDoc;
		readonly occurredAt: number;
		readonly providerEventId: string;
		readonly stripeCheckoutSessionId: string;
		readonly stripePaymentIntentId?: string;
		readonly webhookEventId: Id<"webhookEvents">;
	}
) {
	assertStripeSuccessCompletionAllowed(args.checkoutSession);
	const transferId = await createOrConfirmLockFeeTransfer(ctx, {
		checkoutSession: args.checkoutSession,
		providerEventId: args.providerEventId,
		settledAt: args.occurredAt,
		stripeCheckoutSessionId: args.stripeCheckoutSessionId,
		stripePaymentIntentId: args.stripePaymentIntentId,
	});
	await ctx.db.patch(args.checkoutSession._id, {
		...args.checkoutPatchBase,
		status: "completed",
		completedAt: args.occurredAt,
		failureReason: undefined,
		lateSuccessRefund: undefined,
		resolvedAt: args.occurredAt,
		lockFeeTransferRequestId: transferId,
	});
	await patchWebhookStatus(ctx, {
		status: "processed",
		transferRequestId: transferId,
		webhookEventId: args.webhookEventId,
	});
	return {
		ok: true as const,
		status: "completed" as const,
		transferRequestId: transferId,
	};
}

function assertStripeSuccessCompletionAllowed(
	checkoutSession: CheckoutSessionDoc
) {
	if (
		checkoutSession.status === "expired" ||
		(checkoutSession.status === "refunded_late_success" &&
			checkoutSession.lateSuccessRefund?.status !== "completed")
	) {
		return;
	}
	assertCheckoutTransitionAllowed(checkoutSession.status, "completed");
}

async function reconcileLateSuccess(
	ctx: MutationCtx,
	args: StripeSuccessReconciliationArgs & {
		readonly checkoutPatchBase: CheckoutPatchBase;
		readonly now: number;
	}
) {
	if (canAttemptLateRelock(args.checkoutSession, args.now)) {
		const relockedCheckoutSession = await relockExpiredCheckoutReservation(
			ctx,
			args
		);
		if (relockedCheckoutSession) {
			return completeCheckoutFromStripeSuccess(ctx, {
				checkoutPatchBase: args.checkoutPatchBase,
				checkoutSession: relockedCheckoutSession,
				occurredAt: args.occurredAt,
				providerEventId: args.providerEventId,
				stripeCheckoutSessionId: args.stripeCheckoutSessionId,
				stripePaymentIntentId: args.stripePaymentIntentId,
				webhookEventId: args.webhookEventId,
			});
		}
	}

	const refundRequest = buildLateSuccessRefundRequest({
		checkoutSessionId: String(args.checkoutSession._id),
		paymentIntentId: args.stripePaymentIntentId,
		providerEventId: args.providerEventId,
		webhookEventId: args.webhookEventId,
	});
	if (args.checkoutSession.lateSuccessRefund) {
		if (
			args.checkoutSession.lateSuccessRefund.paymentIntentId !==
			refundRequest.paymentIntentId
		) {
			return failReconciliation(ctx, {
				checkoutSessionId: args.checkoutSession._id,
				error: "late_success_refund_payment_intent_mismatch",
				providerEventId: args.providerEventId,
				webhookEventId: args.webhookEventId,
			});
		}
		if (args.checkoutSession.lateSuccessRefund.status !== "completed") {
			return {
				ok: true as const,
				status: "refund_required" as const,
				refundRequest: {
					amount: args.checkoutSession.lateSuccessRefund.amount,
					checkoutSessionId: args.checkoutSession._id,
					idempotencyKey: args.checkoutSession.lateSuccessRefund.idempotencyKey,
					paymentIntentId:
						args.checkoutSession.lateSuccessRefund.paymentIntentId,
					providerEventId:
						args.checkoutSession.lateSuccessRefund.providerEventId,
					webhookEventId: args.webhookEventId,
				},
			};
		}
		await patchWebhookStatus(ctx, {
			status: "processed",
			webhookEventId: args.webhookEventId,
		});
		return {
			ok: true as const,
			status: "refund_already_recorded" as const,
		};
	}
	if (args.checkoutSession.status !== "refunded_late_success") {
		assertCheckoutTransitionAllowed(
			args.checkoutSession.status,
			"refunded_late_success"
		);
	}
	await ctx.db.patch(args.checkoutSession._id, {
		...args.checkoutPatchBase,
		status: "refunded_late_success",
		lateSuccessRefund: {
			status: "intent_recorded",
			amount: CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
			currency: lateSuccessRefundCurrency,
			idempotencyKey: refundRequest.idempotencyKey,
			providerEventId: args.providerEventId,
			paymentIntentId: refundRequest.paymentIntentId,
			webhookEventId: args.webhookEventId,
			attemptedAt: args.now,
		},
		resolvedAt: args.checkoutSession.resolvedAt ?? args.now,
	});
	return {
		ok: true as const,
		status: "refund_required" as const,
		refundRequest: {
			...refundRequest,
			checkoutSessionId: args.checkoutSession._id,
			webhookEventId: args.webhookEventId,
		},
	};
}

async function reconcileSuccess(
	ctx: MutationCtx,
	args: StripeSuccessReconciliationArgs
) {
	const now = Date.now();
	if (args.amount !== args.checkoutSession.lockFeeAmount) {
		return failReconciliation(ctx, {
			checkoutSessionId: args.checkoutSession._id,
			error: "stripe_checkout_amount_mismatch",
			providerEventId: args.providerEventId,
			webhookEventId: args.webhookEventId,
		});
	}
	if (
		(args.currency ?? "").trim().toUpperCase() !==
		args.checkoutSession.lockFeeCurrency
	) {
		return failReconciliation(ctx, {
			checkoutSessionId: args.checkoutSession._id,
			error: "stripe_checkout_currency_mismatch",
			providerEventId: args.providerEventId,
			webhookEventId: args.webhookEventId,
		});
	}
	const checkoutPatchBase = {
		lastProviderEventId: args.providerEventId,
		stripeCheckoutSessionId: args.stripeCheckoutSessionId,
		...(args.stripePaymentIntentId
			? { stripePaymentIntentId: args.stripePaymentIntentId }
			: {}),
		updatedAt: now,
	};

	if (args.checkoutSession.status === "completed") {
		await ctx.db.patch(args.checkoutSession._id, checkoutPatchBase);
		await patchWebhookStatus(ctx, {
			status: "processed",
			transferRequestId: args.checkoutSession.lockFeeTransferRequestId,
			webhookEventId: args.webhookEventId,
		});
		return {
			ok: true as const,
			status: "already_completed" as const,
			transferRequestId: args.checkoutSession.lockFeeTransferRequestId,
		};
	}

	if (
		isActiveCheckoutStatus(args.checkoutSession.status) &&
		args.checkoutSession.expiresAt > now
	) {
		return completeCheckoutFromStripeSuccess(ctx, {
			checkoutPatchBase,
			checkoutSession: args.checkoutSession,
			occurredAt: args.occurredAt,
			providerEventId: args.providerEventId,
			stripeCheckoutSessionId: args.stripeCheckoutSessionId,
			stripePaymentIntentId: args.stripePaymentIntentId,
			webhookEventId: args.webhookEventId,
		});
	}

	if (
		isKnownTerminalInvalidForLateSuccess(args.checkoutSession.status) ||
		isActiveExpiredForLateSuccess(args.checkoutSession, now)
	) {
		return reconcileLateSuccess(ctx, { ...args, checkoutPatchBase, now });
	}

	return failReconciliation(ctx, {
		checkoutSessionId: args.checkoutSession._id,
		error: `Checkout success cannot be reconciled from status ${args.checkoutSession.status}`,
		providerEventId: args.providerEventId,
		webhookEventId: args.webhookEventId,
	});
}

async function reconcileFailure(
	ctx: MutationCtx,
	args: {
		readonly checkoutSession: CheckoutSessionDoc;
		readonly failureReason?: string;
		readonly providerEventId: string;
		readonly stripeCheckoutSessionId?: string;
		readonly stripePaymentIntentId?: string;
		readonly webhookEventId: Id<"webhookEvents">;
	}
) {
	const now = Date.now();
	const transitioned =
		isActiveCheckoutStatus(args.checkoutSession.status) &&
		args.checkoutSession.expiresAt > now;
	if (transitioned) {
		if (args.checkoutSession.status !== "payment_failed_retryable") {
			assertCheckoutTransitionAllowed(
				args.checkoutSession.status,
				"payment_failed_retryable"
			);
		}
		await ctx.db.patch(args.checkoutSession._id, {
			status: "payment_failed_retryable",
			failureReason: args.failureReason ?? "stripe_payment_failed",
			lastProviderEventId: args.providerEventId,
			...(args.stripeCheckoutSessionId
				? { stripeCheckoutSessionId: args.stripeCheckoutSessionId }
				: {}),
			...(args.stripePaymentIntentId
				? { stripePaymentIntentId: args.stripePaymentIntentId }
				: {}),
			updatedAt: now,
		});
	}
	await patchWebhookStatus(ctx, {
		status: "processed",
		webhookEventId: args.webhookEventId,
	});
	return {
		ok: true as const,
		status: transitioned
			? ("payment_failed_retryable" as const)
			: args.checkoutSession.status,
		...(transitioned ? {} : { result: "failure_ignored" as const }),
	};
}

export const reconcileStripeCheckoutWebhook = convex
	.mutation()
	.input(reconcileStripeCheckoutWebhookArgsValidator)
	.handler(async (ctx, args) => {
		let metadata: ReturnType<typeof parseCheckoutStripeMetadata>;
		try {
			metadata = parseCheckoutStripeMetadata(args.metadata);
		} catch (error) {
			return failReconciliation(ctx, {
				error:
					error instanceof Error ? error.message : "invalid_checkout_metadata",
				providerEventId: args.providerEventId,
				webhookEventId: args.webhookEventId,
			});
		}

		const checkoutSession = await resolveCheckoutSession(ctx, {
			metadataCheckoutSessionId: metadata.checkoutSessionId,
			stripeCheckoutSessionId: args.stripeCheckoutSessionId,
		});
		if (!checkoutSession) {
			return failReconciliation(ctx, {
				error: "checkout_session_not_found",
				providerEventId: args.providerEventId,
				webhookEventId: args.webhookEventId,
			});
		}

		if (
			checkoutSession.stripeCheckoutSessionId &&
			args.stripeCheckoutSessionId &&
			checkoutSession.stripeCheckoutSessionId !== args.stripeCheckoutSessionId
		) {
			return failReconciliation(ctx, {
				checkoutSessionId: checkoutSession._id,
				error: "stripe_checkout_session_id_mismatch",
				providerEventId: args.providerEventId,
				webhookEventId: args.webhookEventId,
			});
		}

		const metadataConflict = validateMetadataMatchesCheckout(
			checkoutSession,
			metadata
		);
		if (metadataConflict) {
			return failReconciliation(ctx, {
				checkoutSessionId: checkoutSession._id,
				error: metadataConflict,
				providerEventId: args.providerEventId,
				webhookEventId: args.webhookEventId,
			});
		}

		const existingTransfer = await getExistingTransfer(
			ctx,
			checkoutSession.lockFeeTransferRequestId
		);
		if (existingTransfer && existingTransfer.providerCode !== "stripe") {
			return failReconciliation(ctx, {
				checkoutSessionId: checkoutSession._id,
				error: "checkout_lock_fee_transfer_provider_mismatch",
				providerEventId: args.providerEventId,
				webhookEventId: args.webhookEventId,
			});
		}

		if (args.kind === "failure") {
			return reconcileFailure(ctx, {
				checkoutSession,
				failureReason: args.failureReason,
				providerEventId: args.providerEventId,
				stripeCheckoutSessionId: args.stripeCheckoutSessionId,
				stripePaymentIntentId: args.stripePaymentIntentId,
				webhookEventId: args.webhookEventId,
			});
		}

		if (!args.stripeCheckoutSessionId) {
			return failReconciliation(ctx, {
				checkoutSessionId: checkoutSession._id,
				error: "stripe_checkout_session_id_required",
				providerEventId: args.providerEventId,
				webhookEventId: args.webhookEventId,
			});
		}

		return reconcileSuccess(ctx, {
			amount: args.amount,
			checkoutSession,
			currency: args.currency,
			occurredAt: args.occurredAt,
			providerEventId: args.providerEventId,
			stripeCheckoutSessionId: args.stripeCheckoutSessionId,
			stripePaymentIntentId: args.stripePaymentIntentId,
			webhookEventId: args.webhookEventId,
		});
	})
	.internal();
