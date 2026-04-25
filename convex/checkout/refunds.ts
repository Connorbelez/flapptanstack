import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { convex, paymentAction } from "../fluent";
import { createStripeCheckoutProviderFromEnv } from "./stripe";
import {
	CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
	CHECKOUT_LOCK_FEE_CURRENCY,
} from "./validators";

export interface LateSuccessRefundRequest {
	readonly amount: typeof CHECKOUT_LOCK_FEE_AMOUNT_CENTS;
	readonly checkoutSessionId: string;
	readonly idempotencyKey: string;
	readonly paymentIntentId: string;
	readonly providerEventId: string;
	readonly webhookEventId: Id<"webhookEvents">;
}

export interface LateSuccessRefundCompletion {
	readonly checkoutSessionId: string;
	readonly providerEventId: string;
	readonly stripeRefundId: string;
	readonly webhookEventId: string;
}

const refundCompletionArgsValidator = {
	checkoutSessionId: v.id("checkoutSessions"),
	providerEventId: v.string(),
	stripeRefundId: v.string(),
	webhookEventId: v.id("webhookEvents"),
};

const refundFailureArgsValidator = {
	checkoutSessionId: v.id("checkoutSessions"),
	error: v.string(),
	providerEventId: v.string(),
	webhookEventId: v.id("webhookEvents"),
};

const refundRetryArgsValidator = {
	checkoutSessionId: v.id("checkoutSessions"),
};

type LateSuccessRefundRetryLoadResult =
	| {
			readonly ok: false;
			readonly error: string;
	  }
	| {
			readonly ok: true;
			readonly refundRequest: {
				readonly amount: typeof CHECKOUT_LOCK_FEE_AMOUNT_CENTS;
				readonly checkoutSessionId: Id<"checkoutSessions">;
				readonly idempotencyKey: string;
				readonly paymentIntentId: string;
				readonly providerEventId: string;
				readonly webhookEventId: Id<"webhookEvents">;
			};
	  };

type LateSuccessRefundRetryResult =
	| {
			readonly ok: false;
			readonly error: string;
	  }
	| {
			readonly ok: true;
			readonly stripeRefundId: string;
	  };

const loadLateSuccessRefundRetryRef = makeFunctionReference<
	"mutation",
	{ readonly checkoutSessionId: Id<"checkoutSessions"> },
	LateSuccessRefundRetryLoadResult
>("checkout/refunds:loadLateSuccessRefundRetry");

const completeLateSuccessRefundRef = makeFunctionReference<
	"mutation",
	{
		readonly checkoutSessionId: Id<"checkoutSessions">;
		readonly providerEventId: string;
		readonly stripeRefundId: string;
		readonly webhookEventId: Id<"webhookEvents">;
	},
	{ readonly ok: true }
>("checkout/refunds:completeLateSuccessRefund");

const failLateSuccessRefundRef = makeFunctionReference<
	"mutation",
	{
		readonly checkoutSessionId: Id<"checkoutSessions">;
		readonly error: string;
		readonly providerEventId: string;
		readonly webhookEventId: Id<"webhookEvents">;
	},
	{ readonly ok: false; readonly error: string }
>("checkout/refunds:failLateSuccessRefund");

const retryLateSuccessRefundRef = makeFunctionReference<
	"action",
	{ readonly checkoutSessionId: Id<"checkoutSessions"> },
	LateSuccessRefundRetryResult
>("checkout/refunds:retryLateSuccessRefund");

export function buildLateSuccessRefundIdempotencyKey(
	checkoutSessionId: string,
	paymentIntentId: string
): string {
	return `checkout-late-success-refund:${checkoutSessionId}:${paymentIntentId}`;
}

export const completeLateSuccessRefund = convex
	.mutation()
	.input(refundCompletionArgsValidator)
	.handler(async (ctx, args) => {
		const checkoutSession = await ctx.db.get(args.checkoutSessionId);
		if (!checkoutSession) {
			throw new ConvexError("Checkout session not found for refund completion");
		}
		const existing = checkoutSession.lateSuccessRefund;
		if (!existing || existing.providerEventId !== args.providerEventId) {
			throw new ConvexError("Late-success refund intent not found");
		}
		const now = Date.now();
		await ctx.db.patch(checkoutSession._id, {
			lateSuccessRefund: {
				status: "completed",
				amount: existing.amount,
				currency: existing.currency,
				idempotencyKey: existing.idempotencyKey,
				providerEventId: existing.providerEventId,
				paymentIntentId: existing.paymentIntentId,
				webhookEventId: existing.webhookEventId,
				attemptedAt: existing.attemptedAt,
				stripeRefundId: args.stripeRefundId,
				completedAt: now,
			},
			resolvedAt: checkoutSession.resolvedAt ?? now,
			updatedAt: now,
		});
		const webhookEvent = await ctx.db.get(args.webhookEventId);
		await ctx.db.patch(args.webhookEventId, {
			status: "processed",
			processedAt: now,
			attempts: (webhookEvent?.attempts ?? 0) + 1,
			error: undefined,
		});
		return { ok: true };
	})
	.internal();

export const failLateSuccessRefund = convex
	.mutation()
	.input(refundFailureArgsValidator)
	.handler(async (ctx, args) => {
		const checkoutSession = await ctx.db.get(args.checkoutSessionId);
		if (!checkoutSession) {
			throw new ConvexError("Checkout session not found for refund failure");
		}
		const existing = checkoutSession.lateSuccessRefund;
		if (!existing || existing.providerEventId !== args.providerEventId) {
			throw new ConvexError("Late-success refund intent not found");
		}
		if (existing.status === "completed") {
			throw new ConvexError("Late-success refund already completed");
		}
		const now = Date.now();
		await ctx.db.patch(checkoutSession._id, {
			lateSuccessRefund: {
				...existing,
				status: "failed",
				error: args.error,
				failedAt: now,
			},
			updatedAt: now,
		});
		const webhookEvent = await ctx.db.get(args.webhookEventId);
		await ctx.db.patch(args.webhookEventId, {
			status: "failed",
			processedAt: now,
			attempts: (webhookEvent?.attempts ?? 0) + 1,
			error: args.error,
		});
		return { ok: false, error: args.error };
	})
	.internal();

export const loadLateSuccessRefundRetry = convex
	.mutation()
	.input(refundRetryArgsValidator)
	.handler(async (ctx, args) => {
		const checkoutSession = await ctx.db.get(args.checkoutSessionId);
		if (!checkoutSession) {
			throw new ConvexError("Checkout session not found for refund retry");
		}
		const refund = checkoutSession.lateSuccessRefund;
		if (!refund) {
			return { ok: false as const, error: "late_success_refund_not_found" };
		}
		if (refund.status === "completed") {
			return {
				ok: false as const,
				error: "late_success_refund_already_completed",
			};
		}
		return {
			ok: true as const,
			refundRequest: {
				amount: refund.amount,
				checkoutSessionId: checkoutSession._id,
				idempotencyKey: refund.idempotencyKey,
				paymentIntentId: refund.paymentIntentId,
				providerEventId: refund.providerEventId,
				webhookEventId: refund.webhookEventId,
			},
		};
	})
	.internal();

export const retryLateSuccessRefund = convex
	.action()
	.input(refundRetryArgsValidator)
	.handler(async (ctx, args): Promise<LateSuccessRefundRetryResult> => {
		const loaded = await ctx.runMutation(loadLateSuccessRefundRetryRef, args);
		if (!loaded.ok) {
			return loaded;
		}
		const provider = createStripeCheckoutProviderFromEnv();
		let refund: Awaited<ReturnType<typeof provider.refundPaymentIntent>>;
		try {
			refund = await provider.refundPaymentIntent({
				amount: loaded.refundRequest.amount,
				idempotencyKey: loaded.refundRequest.idempotencyKey,
				paymentIntentId: loaded.refundRequest.paymentIntentId,
			});
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "stripe_refund_failed";
			await ctx.runMutation(failLateSuccessRefundRef, {
				checkoutSessionId: loaded.refundRequest.checkoutSessionId,
				error: message,
				providerEventId: loaded.refundRequest.providerEventId,
				webhookEventId: loaded.refundRequest.webhookEventId,
			});
			return { ok: false as const, error: message };
		}
		await ctx.runMutation(completeLateSuccessRefundRef, {
			checkoutSessionId: loaded.refundRequest.checkoutSessionId,
			providerEventId: loaded.refundRequest.providerEventId,
			stripeRefundId: refund.stripeRefundId,
			webhookEventId: loaded.refundRequest.webhookEventId,
		});
		return { ok: true as const, stripeRefundId: refund.stripeRefundId };
	})
	.internal();

export const retryLateSuccessRefundAdmin = paymentAction
	.input(refundRetryArgsValidator)
	.handler(async (ctx, args): Promise<LateSuccessRefundRetryResult> => {
		return await ctx.runAction(retryLateSuccessRefundRef, args);
	})
	.public();

export function buildLateSuccessRefundRequest(args: {
	readonly checkoutSessionId: string;
	readonly paymentIntentId?: string;
	readonly providerEventId: string;
	readonly webhookEventId: Id<"webhookEvents">;
}): LateSuccessRefundRequest {
	if (!args.paymentIntentId) {
		throw new Error(
			"Stripe PaymentIntent ID is required for late-success refund"
		);
	}
	return {
		amount: CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
		checkoutSessionId: args.checkoutSessionId,
		idempotencyKey: buildLateSuccessRefundIdempotencyKey(
			args.checkoutSessionId,
			args.paymentIntentId
		),
		paymentIntentId: args.paymentIntentId,
		providerEventId: args.providerEventId,
		webhookEventId: args.webhookEventId,
	};
}

export const lateSuccessRefundCurrency = CHECKOUT_LOCK_FEE_CURRENCY;
