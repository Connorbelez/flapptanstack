import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { httpAction } from "../../_generated/server";
import { createStripeCheckoutProviderFromEnv } from "../../checkout/stripe";
import { convex } from "../../fluent";
import {
	markTransferWebhookFailed,
	persistVerifiedTransferWebhook,
} from "./transferCore";
import type { NormalizedTransferWebhookEventType } from "./types";
import { jsonResponse } from "./utils";
import type { VerificationResult } from "./verification";

// ── Stripe-specific types ───────────────────────────────────────────

export interface StripeWebhookEvent {
	created: number;
	data: {
		object: {
			amount?: number;
			amount_total?: number;
			charge?: string;
			currency?: string;
			failure_code?: string;
			failure_message?: string;
			id: string;
			metadata?: Record<string, string>;
			payment_intent?: string;
			reason?: string;
			status?: string;
		};
	};
	id: string;
	type: string;
}

interface StripeReversalPayload {
	originalAmount: number;
	provider: "stripe";
	providerEventId: string;
	providerRef: string;
	reversalCode?: string;
	reversalDate: string;
	reversalReason: string;
}

interface StripeCheckoutWebhookPayload {
	amount?: number;
	currency?: string;
	failureReason?: string;
	kind: "success" | "failure";
	metadata: Record<string, string>;
	occurredAt: number;
	providerEventId: string;
	stripeCheckoutSessionId?: string;
	stripePaymentIntentId?: string;
}

const UNSUPPORTED_PROVIDER_ERROR = "unsupported_provider";

// ── Constants ───────────────────────────────────────────────────────

export const REVERSAL_EVENT_TYPES = new Set([
	"charge.dispute.created",
	"charge.refunded",
	"payment_intent.payment_failed",
]);

export const CHECKOUT_SUCCESS_EVENT_TYPES = new Set([
	"checkout.session.completed",
	"checkout.session.async_payment_succeeded",
]);

export const CHECKOUT_FAILURE_EVENT_TYPES = new Set([
	"checkout.session.async_payment_failed",
	"payment_intent.payment_failed",
]);

type StripeWebhookClassification =
	| "checkout_failure"
	| "checkout_success"
	| "ignored"
	| "reversal";

const stripeUnsupportedWebhookArgsValidator = v.object({
	providerEventId: v.string(),
	webhookEventId: v.id("webhookEvents"),
});

// ── Helpers ─────────────────────────────────────────────────────────

export function extractProviderRef(event: StripeWebhookEvent): string {
	const obj = event.data.object;

	switch (event.type) {
		case "charge.refunded":
			return obj.metadata?.provider_ref ?? obj.metadata?.providerRef ?? obj.id;
		case "charge.dispute.created":
			return obj.charge ?? obj.id;
		case "payment_intent.payment_failed":
			return obj.id;
		default:
			return obj.id;
	}
}

export function buildReversalReason(event: StripeWebhookEvent): string {
	const obj = event.data.object;

	switch (event.type) {
		case "charge.refunded":
			return `ACH Return: ${obj.reason ?? obj.status ?? "refunded"}`;
		case "charge.dispute.created":
			return `Dispute: ${obj.reason ?? "opened"}`;
		case "payment_intent.payment_failed":
			return `ACH Failure: ${obj.failure_code ?? "unknown"} — ${obj.failure_message ?? ""}`;
		default:
			return "Unknown reversal";
	}
}

export function buildReversalCode(
	event: StripeWebhookEvent
): string | undefined {
	const obj = event.data.object;

	switch (event.type) {
		case "charge.refunded":
			return obj.reason ?? "REFUND";
		case "charge.dispute.created":
			return "DISPUTE";
		case "payment_intent.payment_failed":
			return obj.failure_code;
		default:
			return undefined;
	}
}

export function toPayload(event: StripeWebhookEvent): StripeReversalPayload {
	const reversalDate = new Date(event.created * 1000)
		.toISOString()
		.slice(0, 10);

	return {
		originalAmount: event.data.object.amount ?? 0,
		provider: "stripe",
		providerEventId: event.id,
		providerRef: extractProviderRef(event),
		reversalCode: buildReversalCode(event),
		reversalDate,
		reversalReason: buildReversalReason(event),
	};
}

function hasCheckoutMetadata(event: StripeWebhookEvent): boolean {
	return typeof event.data.object.metadata?.checkoutSessionId === "string";
}

export function classifyStripeWebhookEvent(
	event: StripeWebhookEvent
): StripeWebhookClassification {
	if (
		CHECKOUT_SUCCESS_EVENT_TYPES.has(event.type) &&
		hasCheckoutMetadata(event)
	) {
		return "checkout_success";
	}
	if (
		CHECKOUT_FAILURE_EVENT_TYPES.has(event.type) &&
		hasCheckoutMetadata(event)
	) {
		return "checkout_failure";
	}
	if (REVERSAL_EVENT_TYPES.has(event.type)) {
		return "reversal";
	}
	return "ignored";
}

function readPaymentIntentId(event: StripeWebhookEvent): string | undefined {
	if (event.type.startsWith("payment_intent.")) {
		return event.data.object.id;
	}
	const value = event.data.object.payment_intent;
	return typeof value === "string" && value.trim().length > 0
		? value
		: undefined;
}

function readCheckoutSessionId(event: StripeWebhookEvent): string | undefined {
	return event.type.startsWith("checkout.session.")
		? event.data.object.id
		: undefined;
}

function buildCheckoutFailureReason(event: StripeWebhookEvent): string {
	const object = event.data.object;
	return (
		object.failure_message ??
		object.failure_code ??
		object.status ??
		"stripe_payment_failed"
	);
}

export function toCheckoutPayload(
	event: StripeWebhookEvent,
	kind: "success" | "failure"
): StripeCheckoutWebhookPayload {
	const object = event.data.object;
	const metadata = object.metadata ?? {};
	return {
		amount: object.amount_total ?? object.amount,
		currency: object.currency,
		...(kind === "failure"
			? { failureReason: buildCheckoutFailureReason(event) }
			: {}),
		kind,
		metadata,
		occurredAt: event.created * 1000,
		providerEventId: event.id,
		stripeCheckoutSessionId: readCheckoutSessionId(event),
		stripePaymentIntentId: readPaymentIntentId(event),
	};
}

async function persistStripeWebhook(
	ctx: Parameters<typeof persistVerifiedTransferWebhook>[0],
	args: {
		body: string;
		normalizedEventType?: NormalizedTransferWebhookEventType;
		providerEventId: string;
	}
) {
	try {
		return {
			ok: true as const,
			webhookEventId: await persistVerifiedTransferWebhook(ctx, {
				provider: "stripe",
				providerEventId: args.providerEventId,
				rawBody: args.body,
				normalizedEventType: args.normalizedEventType,
			}),
		};
	} catch (error) {
		console.error("[Stripe Webhook] Failed to persist raw event:", error);
		return {
			ok: false as const,
			error:
				error instanceof Error
					? error.message
					: "stripe_webhook_persist_failed",
		};
	}
}

async function processStripeCheckoutWebhook(
	ctx: Parameters<typeof persistVerifiedTransferWebhook>[0],
	args: {
		body: string;
		event: StripeWebhookEvent;
		kind: "success" | "failure";
	}
) {
	const payload = toCheckoutPayload(args.event, args.kind);
	const persisted = await persistStripeWebhook(ctx, {
		body: args.body,
		normalizedEventType:
			args.kind === "success" ? "FUNDS_SETTLED" : "TRANSFER_FAILED",
		providerEventId: payload.providerEventId,
	});
	if (!persisted.ok) {
		return jsonResponse({ error: persisted.error }, 500);
	}

	const reconciled = await ctx.runMutation(
		internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
		{
			amount: payload.amount,
			currency: payload.currency,
			failureReason: payload.failureReason,
			kind: payload.kind,
			metadata: payload.metadata,
			occurredAt: payload.occurredAt,
			providerEventId: payload.providerEventId,
			stripeCheckoutSessionId: payload.stripeCheckoutSessionId,
			stripePaymentIntentId: payload.stripePaymentIntentId,
			webhookEventId: persisted.webhookEventId,
		}
	);

	if (!reconciled.ok) {
		return jsonResponse({
			accepted: true,
			processed: false,
			reason: reconciled.error,
			providerEventId: payload.providerEventId,
		});
	}

	if (reconciled.status === "refund_required") {
		const provider = createStripeCheckoutProviderFromEnv();
		let refund: Awaited<ReturnType<typeof provider.refundPaymentIntent>>;
		try {
			refund = await provider.refundPaymentIntent({
				amount: reconciled.refundRequest.amount,
				idempotencyKey: reconciled.refundRequest.idempotencyKey,
				paymentIntentId: reconciled.refundRequest.paymentIntentId,
			});
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "stripe_refund_failed";
			await ctx.runMutation(internal.checkout.refunds.failLateSuccessRefund, {
				checkoutSessionId: reconciled.refundRequest.checkoutSessionId,
				error: message,
				providerEventId: reconciled.refundRequest.providerEventId,
				webhookEventId: reconciled.refundRequest.webhookEventId,
			});
			return jsonResponse({
				accepted: true,
				processed: false,
				reason: message,
				providerEventId: payload.providerEventId,
			});
		}
		await ctx.runMutation(internal.checkout.refunds.completeLateSuccessRefund, {
			checkoutSessionId: reconciled.refundRequest.checkoutSessionId,
			providerEventId: reconciled.refundRequest.providerEventId,
			stripeRefundId: refund.stripeRefundId,
			webhookEventId: reconciled.refundRequest.webhookEventId,
		});
	}

	if (
		reconciled.status === "completed" ||
		reconciled.status === "already_completed"
	) {
		const checkoutSessionId = payload.metadata.checkoutSessionId;
		if (checkoutSessionId) {
			const handoff = await ctx.runAction(
				internal.checkout.dealHandoff.createDealFromPaidCheckoutInternal,
				{
					checkoutSessionId: checkoutSessionId as Id<"checkoutSessions">,
				}
			);
			if (!handoff.ok) {
				return jsonResponse({
					accepted: true,
					processed: false,
					reason: handoff.code,
					providerEventId: payload.providerEventId,
				});
			}
		}
	}

	return jsonResponse({
		accepted: true,
		processed: true,
		providerEventId: payload.providerEventId,
		status: reconciled.status,
	});
}

async function scheduleUnsupportedStripeWebhookProcessing(
	ctx: Parameters<typeof persistVerifiedTransferWebhook>[0],
	args: {
		providerEventId: string;
		webhookEventId: Id<"webhookEvents">;
	}
) {
	try {
		await ctx.scheduler.runAfter(
			0,
			internal.payments.webhooks.stripe.processUnsupportedStripeWebhook,
			args
		);
		return { ok: true as const };
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "stripe_webhook_scheduler_failed";
		console.error("[Stripe Webhook] Failed to schedule processing:", error);
		try {
			await markTransferWebhookFailed(ctx, {
				webhookEventId: args.webhookEventId,
				error: message,
			});
		} catch (markError) {
			console.error(
				"[Stripe Webhook] Failed to mark webhook as failed after scheduler error:",
				markError
			);
		}
		return { ok: false as const, error: message };
	}
}

export const processUnsupportedStripeWebhook = convex
	.action()
	.input(stripeUnsupportedWebhookArgsValidator)
	.handler(async (ctx, args) => {
		console.warn(
			`[Stripe Webhook] Provider event ${args.providerEventId} is persisted but still unsupported for automated reversal processing.`
		);
		await markTransferWebhookFailed(ctx, {
			webhookEventId: args.webhookEventId,
			error: UNSUPPORTED_PROVIDER_ERROR,
		});
		return {
			success: false,
			reason: UNSUPPORTED_PROVIDER_ERROR,
			providerEventId: args.providerEventId,
		};
	})
	.internal();

// ── HTTP Action ─────────────────────────────────────────────────────

export const stripeWebhook = httpAction(async (ctx, request) => {
	const body = await request.text();
	const signatureHeader = request.headers.get("stripe-signature");

	// 1. Verify signature (delegates to Node runtime via internalAction)
	if (!signatureHeader) {
		console.warn("[Stripe Webhook] Missing signature header");
		return jsonResponse({ error: "invalid_signature" }, 401);
	}

	const verification: VerificationResult = await ctx.runAction(
		internal.payments.webhooks.verification.verifyStripeSignatureAction,
		{ body, signatureHeader }
	);

	if (!verification.ok) {
		if (verification.error === "missing_secret") {
			console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured");
			return jsonResponse({ error: "server_configuration_error" }, 500);
		}
		console.warn("[Stripe Webhook] Signature verification failed");
		return jsonResponse({ error: "invalid_signature" }, 401);
	}

	// 2. Parse event
	let event: StripeWebhookEvent;
	try {
		event = JSON.parse(body) as StripeWebhookEvent;
	} catch {
		console.warn("[Stripe Webhook] Malformed JSON body");
		return jsonResponse({ error: "malformed_json" }, 400);
	}

	const classification = classifyStripeWebhookEvent(event);

	// 3. Filter for checkout/reversal events only
	if (classification === "ignored") {
		return jsonResponse({ ignored: true, event_type: event.type });
	}

	if (classification === "checkout_success") {
		return processStripeCheckoutWebhook(ctx, {
			body,
			event,
			kind: "success",
		});
	}

	if (classification === "checkout_failure") {
		return processStripeCheckoutWebhook(ctx, {
			body,
			event,
			kind: "failure",
		});
	}

	// Foot Gun P4: Log warning for disputes
	if (event.type === "charge.dispute.created") {
		console.warn(
			`[Stripe Webhook] DISPUTE received for ${event.data.object.id}. ` +
				"Manual review may be required."
		);
	}

	// 4. Build the normalized payload for logging/response metadata.
	const payload = toPayload(event);

	const persisted = await persistStripeWebhook(ctx, {
		body,
		normalizedEventType: "TRANSFER_REVERSED",
		providerEventId: payload.providerEventId,
	});
	if (!persisted.ok) {
		return jsonResponse({ error: persisted.error }, 500);
	}

	const scheduled = await scheduleUnsupportedStripeWebhookProcessing(ctx, {
		providerEventId: payload.providerEventId,
		webhookEventId: persisted.webhookEventId,
	});
	if (!scheduled.ok) {
		return jsonResponse({ error: scheduled.error }, 500);
	}

	return jsonResponse({
		accepted: true,
		processing: "deferred",
		reason: UNSUPPORTED_PROVIDER_ERROR,
		providerEventId: payload.providerEventId,
	});
});
