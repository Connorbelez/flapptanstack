import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { authedAction } from "../fluent";
import {
	DEAL_LOCK_CHECKOUT_TIMEOUT_MS,
	DEAL_LOCK_FEE_AMOUNT_CENTS,
	DEAL_LOCK_FEE_CURRENCY,
	startDealLockCheckoutArgsValidator,
} from "./validators";

interface StripeCheckoutSessionResponse {
	id: string;
	payment_intent?: string;
	url?: string;
}

interface CreatedStripeCheckoutSession {
	id: string;
	payment_intent?: string;
	url: string;
}

interface StartCheckoutResult {
	checkoutSessionId: Id<"dealLockCheckoutSessions">;
	expiresAt: number;
	stripeCheckoutSessionId?: string;
	url: string;
}

const TRAILING_SLASH_PATTERN = /\/$/;

function requireStripeSecretKey(): string {
	const key = process.env.STRIPE_SECRET_KEY;
	if (!key) {
		throw new ConvexError({
			code: "STRIPE_NOT_CONFIGURED" as const,
			message: "Stripe checkout is not configured",
		});
	}
	return key;
}

function requireListingInvestPermission(
	permissions: ReadonlySet<string>
): void {
	if (!(permissions.has("listing:invest") || permissions.has("admin:access"))) {
		throw new ConvexError({
			code: "LISTING_INVEST_FORBIDDEN" as const,
			message: "Missing listing investment permission",
		});
	}
}

function buildIdempotencyKey(args: {
	buyerAuthId: string;
	fractionalShareUnits: number;
	listingId: Id<"listings">;
	selectedLawyerAuthId?: string;
	selectedLawyerType?: string;
}) {
	const attemptWindow = Math.floor(Date.now() / DEAL_LOCK_CHECKOUT_TIMEOUT_MS);
	return [
		"listing-lock",
		String(args.listingId),
		args.buyerAuthId,
		String(args.fractionalShareUnits),
		args.selectedLawyerAuthId ?? "no-lawyer",
		args.selectedLawyerType ?? "no-lawyer-type",
		String(attemptWindow),
	].join(":");
}

function baseAppUrl() {
	return (
		process.env.FAIRLEND_APP_URL ??
		process.env.SITE_URL ??
		process.env.VITE_APP_URL ??
		"http://localhost:3000"
	).replace(TRAILING_SLASH_PATTERN, "");
}

async function createStripeCheckoutSession(args: {
	checkoutSessionId: Id<"dealLockCheckoutSessions">;
	idempotencyKey: string;
	listingId: Id<"listings">;
	stripeSecretKey: string;
}): Promise<CreatedStripeCheckoutSession> {
	const params = new URLSearchParams();
	params.set("mode", "payment");
	params.set(
		"success_url",
		`${baseAppUrl()}/listings/${String(args.listingId)}`
	);
	params.set(
		"cancel_url",
		`${baseAppUrl()}/listings/${String(args.listingId)}`
	);
	params.set("line_items[0][quantity]", "1");
	params.set("line_items[0][price_data][currency]", DEAL_LOCK_FEE_CURRENCY);
	params.set(
		"line_items[0][price_data][unit_amount]",
		String(DEAL_LOCK_FEE_AMOUNT_CENTS)
	);
	params.set(
		"line_items[0][price_data][product_data][name]",
		"FairLend listing lock fee"
	);
	params.set("metadata[fairlend_checkout_session_id]", args.checkoutSessionId);
	params.set("metadata[fairlend_listing_id]", String(args.listingId));

	const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
		body: params,
		headers: {
			authorization: `Bearer ${args.stripeSecretKey}`,
			"content-type": "application/x-www-form-urlencoded",
			"idempotency-key": args.idempotencyKey,
		},
		method: "POST",
	});

	if (!response.ok) {
		const message = await response.text();
		throw new ConvexError({
			code: "STRIPE_CHECKOUT_CREATE_FAILED" as const,
			message,
		});
	}

	const json = (await response.json()) as StripeCheckoutSessionResponse;
	if (!(json.id && json.url)) {
		throw new ConvexError({
			code: "STRIPE_CHECKOUT_RESPONSE_INVALID" as const,
			message: "Stripe checkout session response did not include id and url",
		});
	}
	return { ...json, id: json.id, url: json.url };
}

export const startCheckout = authedAction
	.input(startDealLockCheckoutArgsValidator)
	.handler(async (ctx, args): Promise<StartCheckoutResult> => {
		requireListingInvestPermission(ctx.viewer.permissions);
		const stripeSecretKey = requireStripeSecretKey();
		const idempotencyKey =
			args.idempotencyKey ??
			buildIdempotencyKey({
				buyerAuthId: ctx.viewer.authId,
				fractionalShareUnits: args.fractionalShareUnits,
				listingId: args.listingId,
				selectedLawyerAuthId: args.selectedLawyerAuthId,
				selectedLawyerType: args.selectedLawyerType,
			});

		const prepared = (await ctx.runMutation(
			internal.dealLocks.mutations.prepareCheckoutSession,
			{
				buyerAuthId: ctx.viewer.authId,
				fractionalShareUnits: args.fractionalShareUnits,
				idempotencyKey,
				listingId: args.listingId,
				portalId: args.portalId,
				selectedLawyerAuthId: args.selectedLawyerAuthId,
				selectedLawyerType: args.selectedLawyerType,
				viewerIsFairLendAdmin: ctx.viewer.isFairLendAdmin,
			}
		)) as Doc<"dealLockCheckoutSessions">;

		if (
			prepared.status === "created" &&
			prepared.expiresAt > Date.now() &&
			prepared.stripeCheckoutSessionId &&
			prepared.stripeCheckoutUrl
		) {
			return {
				checkoutSessionId: prepared._id,
				expiresAt: prepared.expiresAt,
				stripeCheckoutSessionId: prepared.stripeCheckoutSessionId,
				url: prepared.stripeCheckoutUrl,
			};
		}
		if (prepared.status !== "created" || prepared.expiresAt <= Date.now()) {
			throw new ConvexError({
				code: "CHECKOUT_SESSION_NOT_REUSABLE" as const,
				message: "Checkout session can no longer be reused",
			});
		}

		try {
			const stripe = await createStripeCheckoutSession({
				checkoutSessionId: prepared._id,
				idempotencyKey,
				listingId: args.listingId,
				stripeSecretKey,
			});
			const attached = (await ctx.runMutation(
				internal.dealLocks.mutations.attachStripeCheckoutSession,
				{
					checkoutSessionId: prepared._id,
					stripeCheckoutSessionId: stripe.id,
					stripeCheckoutUrl: stripe.url,
				}
			)) as Doc<"dealLockCheckoutSessions"> | null;
			if (!attached?.stripeCheckoutUrl) {
				throw new ConvexError("CHECKOUT_SESSION_ATTACH_FAILED");
			}
			return {
				checkoutSessionId: attached._id,
				expiresAt: attached.expiresAt,
				stripeCheckoutSessionId: attached.stripeCheckoutSessionId,
				url: attached.stripeCheckoutUrl,
			};
		} catch (error) {
			await ctx.runMutation(
				internal.dealLocks.mutations.markCheckoutSessionFailed,
				{
					checkoutSessionId: prepared._id,
					failureReason:
						error instanceof Error ? error.message : "stripe_checkout_failed",
				}
			);
			throw error;
		}
	})
	.public();
