import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, internalAction } from "../_generated/server";
import { authedAction, requirePermissionAction } from "../fluent";
import { buildCheckoutStripeMetadata } from "./metadata";
import type { CheckoutStatus } from "./status";
import {
	type CheckoutProvider,
	createStripeCheckoutProviderFromEnv,
	type HostedCheckoutSession,
	type RetrievedHostedCheckoutSession,
	readCheckoutRedirectUrlsFromEnv,
} from "./stripe";
import {
	checkoutFailure,
	type StartMarketplaceCheckoutResult,
	startMarketplaceCheckoutArgsValidator,
	startMarketplaceCheckoutResultValidator,
} from "./types";

const abandonMarketplaceCheckoutArgsValidator = {
	checkoutSessionId: v.id("checkoutSessions"),
};

const sweepExpiredCheckoutSessionsArgsValidator = {
	limit: v.optional(v.number()),
	now: v.optional(v.number()),
};

const marketplaceCheckoutReceiptArgsValidator = {
	stripeCheckoutSessionId: v.string(),
};

const marketplaceCheckoutSyncArgsValidator = {
	stripeCheckoutSessionId: v.string(),
};

interface ReleasedCheckoutSession {
	readonly checkoutSessionId: Id<"checkoutSessions">;
	readonly providerExpiryAttemptedAt?: number;
	readonly providerExpiryStatus?: "failed" | "not_required" | "succeeded";
	readonly status: CheckoutStatus;
	readonly stripeCheckoutSessionId?: string;
}

type ProviderExpiryStatus = "failed" | "not_required" | "succeeded";

type CheckoutReconciliationResult =
	| {
			readonly error: string;
			readonly ok: false;
	  }
	| {
			readonly ok: true;
			readonly status: string;
			readonly transferRequestId?: Id<"transferRequests">;
	  };

type MarketplaceCheckoutSyncResult =
	| {
			readonly message: string;
			readonly ok: false;
			readonly status:
				| "not_found"
				| "provider_lookup_failed"
				| "reconciliation_failed";
	  }
	| {
			readonly ok: true;
			readonly paymentStatus: string;
			readonly status: string;
			readonly stripePaymentIntentId?: string;
			readonly stripeStatus?: string;
	  };

type ProviderExpiryResult =
	| {
			readonly ok: true;
			readonly providerExpiryStatus?: ProviderExpiryStatus;
			readonly skipped?: true;
	  }
	| {
			readonly error: string;
			readonly ok: false;
			readonly providerExpiryStatus?: ProviderExpiryStatus;
	  };

interface CheckoutReleaseActionResponse {
	readonly checkoutSessionId: Id<"checkoutSessions">;
	readonly ok: true;
	readonly providerExpiryStatus: ProviderExpiryStatus;
	readonly status: CheckoutStatus;
}

interface PreparedMarketplaceCheckout {
	readonly checkoutSessionId: Id<"checkoutSessions">;
	readonly expiresAt: number;
	readonly idempotencyKey: string;
	readonly lenderAuthId: string;
	readonly lenderId: Parameters<
		typeof buildCheckoutStripeMetadata
	>[0]["lenderId"];
	readonly listingId: Parameters<
		typeof buildCheckoutStripeMetadata
	>[0]["listingId"];
	readonly mortgageId: Parameters<
		typeof buildCheckoutStripeMetadata
	>[0]["mortgageId"];
	readonly ok: true;
	readonly portalId: Parameters<
		typeof buildCheckoutStripeMetadata
	>[0]["portalId"];
	readonly requestedFractions: number;
	readonly reservationId: Parameters<
		typeof buildCheckoutStripeMetadata
	>[0]["reservationId"];
	readonly selectedLawyer: Parameters<
		typeof buildCheckoutStripeMetadata
	>[0]["selectedLawyer"];
}

function providerFailureMessage(error: unknown): string {
	return error instanceof Error ? error.message : "provider_start_failed";
}

function errorLogDetails(error: unknown): Record<string, unknown> {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
			data:
				error && typeof error === "object" && "data" in error
					? error.data
					: undefined,
		};
	}
	return { error };
}

function logMarketplaceCheckoutProviderFailure(args: {
	error: unknown;
	prepared: PreparedMarketplaceCheckout;
	stage: "attach_provider_session" | "create_provider_session";
	stripeCheckoutSessionId?: string;
}) {
	console.error("[checkout.startMarketplaceCheckout] provider failure", {
		checkoutSessionId: String(args.prepared.checkoutSessionId),
		idempotencyKey: args.prepared.idempotencyKey,
		lenderAuthId: args.prepared.lenderAuthId,
		listingId: String(args.prepared.listingId),
		mortgageId: String(args.prepared.mortgageId),
		portalId: String(args.prepared.portalId),
		requestedFractions: args.prepared.requestedFractions,
		reservationId: String(args.prepared.reservationId),
		selectedLawyer: {
			hasLso: args.prepared.selectedLawyer.lso !== undefined,
			lawyerId:
				"lawyerId" in args.prepared.selectedLawyer
					? args.prepared.selectedLawyer.lawyerId
					: undefined,
			source:
				"source" in args.prepared.selectedLawyer
					? args.prepared.selectedLawyer.source
					: undefined,
			type: args.prepared.selectedLawyer.type,
		},
		stage: args.stage,
		stripeCheckoutSessionId: args.stripeCheckoutSessionId,
		...errorLogDetails(args.error),
	});
}

function requireStripeSecretKey(): string {
	const secretKey = process.env.STRIPE_SECRET_KEY;
	if (!secretKey) {
		throw new Error("STRIPE_SECRET_KEY is not configured");
	}
	return secretKey;
}

function asObject(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: null;
}

function readStripeReceiptUrl(value: unknown): string | null {
	const root = asObject(value);
	const latestCharge = asObject(root?.latest_charge);
	const receiptUrl = latestCharge?.receipt_url;
	return typeof receiptUrl === "string" && receiptUrl.trim().length > 0
		? receiptUrl
		: null;
}

async function fetchStripePaymentIntentReceiptUrl(args: {
	paymentIntentId: string;
	secretKey: string;
}): Promise<string | null> {
	const encodedPaymentIntentId = encodeURIComponent(args.paymentIntentId);
	const response = await fetch(
		`https://api.stripe.com/v1/payment_intents/${encodedPaymentIntentId}?expand[]=latest_charge`,
		{
			headers: {
				Authorization: `Bearer ${args.secretKey}`,
				"Stripe-Version": "2025-10-29.clover",
			},
			method: "GET",
		}
	);
	if (!response.ok) {
		const body = await response.text();
		throw new Error(
			`Stripe PaymentIntent receipt lookup failed with ${response.status}: ${body}`
		);
	}
	return readStripeReceiptUrl(await response.json());
}

function checkoutLandingSyncProviderEventId(
	stripeCheckoutSessionId: string
): string {
	return `checkout-landing-sync:${stripeCheckoutSessionId}`;
}

async function persistCheckoutLandingSyncEvent(
	ctx: Pick<ActionCtx, "runMutation">,
	args: {
		readonly stripeCheckoutSession: RetrievedHostedCheckoutSession;
	}
): Promise<Id<"webhookEvents">> {
	return ctx.runMutation(
		internal.payments.webhooks.transferCore.persistTransferWebhookEvent,
		{
			provider: "stripe",
			providerEventId: checkoutLandingSyncProviderEventId(
				args.stripeCheckoutSession.stripeCheckoutSessionId
			),
			rawBody: JSON.stringify({
				source: "checkout_landing_sync",
				stripeCheckoutSession: args.stripeCheckoutSession,
			}),
			signatureVerified: false,
			normalizedEventType: "FUNDS_SETTLED",
		}
	);
}

async function reconcilePaidStripeCheckoutSession(
	ctx: Pick<ActionCtx, "runMutation">,
	args: {
		readonly stripeCheckoutSession: RetrievedHostedCheckoutSession;
	}
): Promise<CheckoutReconciliationResult> {
	const providerEventId = checkoutLandingSyncProviderEventId(
		args.stripeCheckoutSession.stripeCheckoutSessionId
	);
	const webhookEventId = await persistCheckoutLandingSyncEvent(ctx, args);
	const result: CheckoutReconciliationResult = await ctx.runMutation(
		internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
		{
			amount: args.stripeCheckoutSession.amountTotal,
			currency: args.stripeCheckoutSession.currency,
			kind: "success",
			metadata: args.stripeCheckoutSession.metadata,
			occurredAt: Date.now(),
			providerEventId,
			stripeCheckoutSessionId:
				args.stripeCheckoutSession.stripeCheckoutSessionId,
			stripePaymentIntentId: args.stripeCheckoutSession.paymentIntentId,
			webhookEventId,
		}
	);
	return result;
}

function isPreparedMarketplaceCheckout(value: {
	readonly ok: true;
}): value is PreparedMarketplaceCheckout {
	return "idempotencyKey" in value;
}

function buildProviderExpiryIdempotencyKey(args: {
	checkoutSessionId: Id<"checkoutSessions">;
	providerExpiryAttemptedAt?: number;
	providerExpiryStatus?: ReleasedCheckoutSession["providerExpiryStatus"];
}): string {
	const baseKey = `marketplace-checkout-provider-expire:${String(args.checkoutSessionId)}`;
	if (
		args.providerExpiryStatus === "failed" &&
		args.providerExpiryAttemptedAt !== undefined
	) {
		return `${baseKey}:retry-after-${args.providerExpiryAttemptedAt}`;
	}
	return baseKey;
}

async function expireProviderSession(
	provider: CheckoutProvider,
	args: {
		checkoutSessionId: Id<"checkoutSessions">;
		providerExpiryAttemptedAt?: number;
		providerExpiryStatus?: ReleasedCheckoutSession["providerExpiryStatus"];
		stripeCheckoutSessionId: string;
	}
): Promise<ProviderExpiryResult> {
	try {
		return await provider.expireHostedCheckoutSession({
			idempotencyKey: buildProviderExpiryIdempotencyKey(args),
			stripeCheckoutSessionId: args.stripeCheckoutSessionId,
		});
	} catch (error) {
		return {
			ok: false as const,
			error: error instanceof Error ? error.message : "provider_expiry_failed",
		};
	}
}

async function recordProviderExpiryAttempt(
	ctx: Pick<ActionCtx, "runMutation">,
	args: {
		checkoutSessionId: Id<"checkoutSessions">;
		error?: string;
		ok: boolean;
		now?: number;
	}
): Promise<ReleasedCheckoutSession> {
	return (await ctx.runMutation(
		internal.checkout.mutations.recordProviderExpiryAttempt,
		args
	)) as ReleasedCheckoutSession;
}

async function expireProviderIfPresent(
	ctx: Pick<ActionCtx, "runMutation">,
	args: {
		now?: number;
		provider: CheckoutProvider;
		released: ReleasedCheckoutSession;
	}
): Promise<ProviderExpiryResult> {
	if (!args.released.stripeCheckoutSessionId) {
		return { ok: true as const, skipped: true as const };
	}
	const result = await expireProviderSession(args.provider, {
		checkoutSessionId: args.released.checkoutSessionId,
		providerExpiryAttemptedAt: args.released.providerExpiryAttemptedAt,
		providerExpiryStatus: args.released.providerExpiryStatus,
		stripeCheckoutSessionId: args.released.stripeCheckoutSessionId,
	});
	const recorded: ReleasedCheckoutSession = await recordProviderExpiryAttempt(
		ctx,
		{
			checkoutSessionId: args.released.checkoutSessionId,
			now: args.now,
			...result,
		}
	);
	return { ...result, providerExpiryStatus: recorded.providerExpiryStatus };
}

function providerExpiryStatusFor(args: {
	providerResult: {
		readonly ok: boolean;
		readonly providerExpiryStatus?: ProviderExpiryStatus;
	};
	released: ReleasedCheckoutSession;
}): ProviderExpiryStatus {
	if (args.providerResult.providerExpiryStatus) {
		return args.providerResult.providerExpiryStatus;
	}
	if (!args.released.stripeCheckoutSessionId) {
		return "not_required";
	}
	if (args.providerResult.ok) {
		return "succeeded";
	}
	return "failed";
}

function providerExpiryAlreadyFinal(
	status: ReleasedCheckoutSession["providerExpiryStatus"]
): status is "not_required" | "succeeded" {
	return status === "succeeded" || status === "not_required";
}

function shouldExpireProviderForReleasedCheckout(
	released: ReleasedCheckoutSession
): boolean {
	return (
		released.stripeCheckoutSessionId !== undefined &&
		(released.status === "abandoned" || released.status === "expired") &&
		!providerExpiryAlreadyFinal(released.providerExpiryStatus)
	);
}

function checkoutReleaseResponse(
	released: ReleasedCheckoutSession
): CheckoutReleaseActionResponse {
	return {
		ok: true as const,
		checkoutSessionId: released.checkoutSessionId,
		providerExpiryStatus: released.providerExpiryStatus ?? "not_required",
		status: released.status,
	};
}

export const startMarketplaceCheckout = authedAction
	.use(requirePermissionAction("listing:invest"))
	.input(startMarketplaceCheckoutArgsValidator)
	.returns(startMarketplaceCheckoutResultValidator)
	.handler(async (ctx, args): Promise<StartMarketplaceCheckoutResult> => {
		const prepared = await ctx.runMutation(
			internal.checkout.mutations.prepareMarketplaceCheckout,
			{
				...args,
				viewerAuthId: ctx.viewer.authId,
				viewerIsFairLendAdmin: ctx.viewer.isFairLendAdmin,
			}
		);
		if (!prepared.ok) {
			return prepared;
		}
		if (!isPreparedMarketplaceCheckout(prepared)) {
			throw new Error("Prepared checkout payload is missing provider metadata");
		}

		const metadata = buildCheckoutStripeMetadata({
			checkoutSessionId: String(prepared.checkoutSessionId),
			idempotencyKey: prepared.idempotencyKey,
			lenderAuthId: prepared.lenderAuthId,
			lenderId: prepared.lenderId,
			listingId: prepared.listingId,
			mortgageId: prepared.mortgageId,
			portalId: prepared.portalId,
			requestedFractions: prepared.requestedFractions,
			reservationId: prepared.reservationId,
			selectedLawyer: prepared.selectedLawyer,
		});

		let hostedSession: HostedCheckoutSession;
		let provider: CheckoutProvider;
		try {
			provider = createStripeCheckoutProviderFromEnv();
			const redirectUrls = readCheckoutRedirectUrlsFromEnv({
				listingId: String(prepared.listingId),
			});
			hostedSession = await provider.createHostedCheckoutSession({
				...redirectUrls,
				idempotencyKey: prepared.idempotencyKey,
				metadata,
			});
		} catch (error) {
			logMarketplaceCheckoutProviderFailure({
				error,
				prepared,
				stage: "create_provider_session",
			});
			await ctx.runMutation(
				internal.checkout.mutations.markProviderStartFailed,
				{
					checkoutSessionId: prepared.checkoutSessionId,
					failureReason: providerFailureMessage(error),
				}
			);
			return checkoutFailure(
				"provider_start_failed",
				"Unable to start hosted checkout"
			);
		}

		try {
			const attached = await ctx.runMutation(
				internal.checkout.mutations.attachProviderSession,
				{
					checkoutSessionId: prepared.checkoutSessionId,
					stripeCheckoutSessionId: hostedSession.stripeCheckoutSessionId,
					stripePaymentIntentId: hostedSession.paymentIntentId,
				}
			);
			return {
				ok: true,
				checkoutSessionId: attached.checkoutSessionId,
				stripeCheckoutUrl: hostedSession.url,
				expiresAt: attached.expiresAt,
			};
		} catch (error) {
			logMarketplaceCheckoutProviderFailure({
				error,
				prepared,
				stage: "attach_provider_session",
				stripeCheckoutSessionId: hostedSession.stripeCheckoutSessionId,
			});
			await expireProviderSession(provider, {
				checkoutSessionId: prepared.checkoutSessionId,
				stripeCheckoutSessionId: hostedSession.stripeCheckoutSessionId,
			});
			await ctx.runMutation(
				internal.checkout.mutations.markProviderStartFailed,
				{
					checkoutSessionId: prepared.checkoutSessionId,
					failureReason: providerFailureMessage(error),
				}
			);
			return checkoutFailure(
				"provider_start_failed",
				"Unable to link hosted checkout"
			);
		}
	})
	.public();

export const getMarketplaceCheckoutReceiptUrl = authedAction
	.use(requirePermissionAction("listing:invest"))
	.input(marketplaceCheckoutReceiptArgsValidator)
	.handler(async (ctx, args) => {
		const checkoutSession = await ctx.runQuery(
			internal.checkout.queries.getCheckoutSessionForReceiptInternal,
			{ stripeCheckoutSessionId: args.stripeCheckoutSessionId }
		);
		if (!checkoutSession) {
			return {
				ok: false as const,
				message: "Checkout session was not found.",
			};
		}
		if (checkoutSession.lenderAuthId !== ctx.viewer.authId) {
			throw new Error("Forbidden: checkout session is not owned by viewer");
		}
		if (!checkoutSession.stripePaymentIntentId) {
			return {
				ok: false as const,
				message: "Stripe payment intent is not available yet.",
			};
		}

		const receiptUrl = await fetchStripePaymentIntentReceiptUrl({
			paymentIntentId: checkoutSession.stripePaymentIntentId,
			secretKey: requireStripeSecretKey(),
		});
		return receiptUrl
			? { ok: true as const, receiptUrl }
			: {
					ok: false as const,
					message: "Stripe receipt URL is not available yet.",
				};
	})
	.public();

export const syncMarketplaceCheckoutFromStripe = authedAction
	.use(requirePermissionAction("listing:invest"))
	.input(marketplaceCheckoutSyncArgsValidator)
	.handler(async (ctx, args): Promise<MarketplaceCheckoutSyncResult> => {
		const checkoutSession = await ctx.runQuery(
			internal.checkout.queries.getCheckoutSessionForReceiptInternal,
			{ stripeCheckoutSessionId: args.stripeCheckoutSessionId }
		);
		if (!checkoutSession) {
			return {
				ok: false as const,
				message: "Checkout session was not found.",
				status: "not_found" as const,
			};
		}
		if (checkoutSession.lenderAuthId !== ctx.viewer.authId) {
			throw new Error("Forbidden: checkout session is not owned by viewer");
		}

		let stripeCheckoutSession: RetrievedHostedCheckoutSession;
		try {
			const provider = createStripeCheckoutProviderFromEnv();
			stripeCheckoutSession = await provider.retrieveHostedCheckoutSession({
				stripeCheckoutSessionId: args.stripeCheckoutSessionId,
			});
		} catch (error) {
			console.error("[checkout.syncMarketplaceCheckoutFromStripe] failed", {
				checkoutSessionId: String(checkoutSession.checkoutSessionId),
				stripeCheckoutSessionId: args.stripeCheckoutSessionId,
				...errorLogDetails(error),
			});
			return {
				ok: false as const,
				message: "Unable to refresh Stripe checkout status.",
				status: "provider_lookup_failed" as const,
			};
		}

		if (stripeCheckoutSession.paymentStatus !== "paid") {
			console.info("[checkout.syncMarketplaceCheckoutFromStripe] not paid", {
				checkoutSessionId: String(checkoutSession.checkoutSessionId),
				paymentStatus: stripeCheckoutSession.paymentStatus,
				status: stripeCheckoutSession.status,
				stripeCheckoutSessionId: stripeCheckoutSession.stripeCheckoutSessionId,
			});
			return {
				ok: true as const,
				paymentStatus: stripeCheckoutSession.paymentStatus ?? "unknown",
				status: "waiting_for_payment" as const,
				stripeStatus: stripeCheckoutSession.status ?? "unknown",
			};
		}

		const result: CheckoutReconciliationResult =
			await reconcilePaidStripeCheckoutSession(ctx, {
				stripeCheckoutSession,
			});
		if (!result.ok) {
			console.warn(
				"[checkout.syncMarketplaceCheckoutFromStripe] reconciliation failed",
				{
					checkoutSessionId: String(checkoutSession.checkoutSessionId),
					error: result.error,
					stripeCheckoutSessionId:
						stripeCheckoutSession.stripeCheckoutSessionId,
					stripePaymentIntentId: stripeCheckoutSession.paymentIntentId,
				}
			);
			return {
				ok: false as const,
				message: result.error,
				status: "reconciliation_failed" as const,
			};
		}

		console.info("[checkout.syncMarketplaceCheckoutFromStripe] reconciled", {
			checkoutSessionId: String(checkoutSession.checkoutSessionId),
			reconciliationStatus: result.status,
			stripeCheckoutSessionId: stripeCheckoutSession.stripeCheckoutSessionId,
			stripePaymentIntentId: stripeCheckoutSession.paymentIntentId,
		});
		return {
			ok: true as const,
			paymentStatus: stripeCheckoutSession.paymentStatus,
			status: result.status,
			stripePaymentIntentId: stripeCheckoutSession.paymentIntentId,
		};
	})
	.public();

export const abandonMarketplaceCheckout = authedAction
	.input(abandonMarketplaceCheckoutArgsValidator)
	.handler(async (ctx, args) => {
		const released = (await ctx.runMutation(
			internal.checkout.mutations.abandonCheckoutSession,
			{
				checkoutSessionId: args.checkoutSessionId,
				viewerAuthId: ctx.viewer.authId,
				viewerIsFairLendAdmin: ctx.viewer.isFairLendAdmin,
			}
		)) as ReleasedCheckoutSession;

		if (providerExpiryAlreadyFinal(released.providerExpiryStatus)) {
			return checkoutReleaseResponse(released);
		}
		if (!shouldExpireProviderForReleasedCheckout(released)) {
			return checkoutReleaseResponse(released);
		}

		let provider: CheckoutProvider;
		try {
			provider = createStripeCheckoutProviderFromEnv();
		} catch (error) {
			if (released.stripeCheckoutSessionId) {
				const recorded = await recordProviderExpiryAttempt(ctx, {
					checkoutSessionId: released.checkoutSessionId,
					error: providerFailureMessage(error),
					ok: false,
				});
				return {
					ok: true as const,
					checkoutSessionId: released.checkoutSessionId,
					providerExpiryStatus: recorded.providerExpiryStatus ?? "failed",
					status: released.status,
				};
			}
			return {
				ok: true as const,
				checkoutSessionId: released.checkoutSessionId,
				providerExpiryStatus: "not_required" as const,
				status: released.status,
			};
		}

		const providerResult = await expireProviderIfPresent(ctx, {
			provider,
			released,
		});
		return {
			ok: true as const,
			checkoutSessionId: released.checkoutSessionId,
			providerExpiryStatus: providerExpiryStatusFor({
				providerResult,
				released,
			}),
			status: released.status,
		};
	})
	.public();

export const sweepExpiredCheckoutSessions = internalAction({
	args: sweepExpiredCheckoutSessionsArgsValidator,
	handler: async (ctx, args) => {
		const listed = await ctx.runQuery(
			internal.checkout.mutations.listExpiredCheckoutSessions,
			args
		);
		const results: Array<{
			checkoutSessionId: Id<"checkoutSessions">;
			providerExpiryStatus: ProviderExpiryStatus;
			status: string;
		}> = [];

		for (const checkoutSessionId of listed.checkoutSessionIds) {
			const released = (await ctx.runMutation(
				internal.checkout.mutations.expireCheckoutSession,
				{
					checkoutSessionId,
					now: listed.now,
					reason: "checkout_expired",
				}
			)) as ReleasedCheckoutSession;
			if (released.status !== "expired") {
				results.push({
					checkoutSessionId: released.checkoutSessionId,
					providerExpiryStatus: released.providerExpiryStatus ?? "not_required",
					status: released.status,
				});
				continue;
			}
			if (!shouldExpireProviderForReleasedCheckout(released)) {
				results.push({
					checkoutSessionId: released.checkoutSessionId,
					providerExpiryStatus: released.providerExpiryStatus ?? "not_required",
					status: released.status,
				});
				continue;
			}
			let provider: CheckoutProvider | null = null;
			let providerConfigFailureStatus: ProviderExpiryStatus | undefined;
			try {
				provider = createStripeCheckoutProviderFromEnv();
			} catch (error) {
				if (released.stripeCheckoutSessionId) {
					const recorded = await recordProviderExpiryAttempt(ctx, {
						checkoutSessionId: released.checkoutSessionId,
						error: providerFailureMessage(error),
						now: listed.now,
						ok: false,
					});
					providerConfigFailureStatus =
						recorded.providerExpiryStatus ?? "failed";
				}
			}
			if (!provider) {
				results.push({
					checkoutSessionId: released.checkoutSessionId,
					providerExpiryStatus:
						providerConfigFailureStatus ??
						(released.stripeCheckoutSessionId ? "failed" : "not_required"),
					status: released.status,
				});
				continue;
			}
			const providerResult = await expireProviderIfPresent(ctx, {
				now: listed.now,
				provider,
				released,
			});
			results.push({
				checkoutSessionId: released.checkoutSessionId,
				providerExpiryStatus: providerExpiryStatusFor({
					providerResult,
					released,
				}),
				status: released.status,
			});
		}

		return {
			processed: results.length,
			results,
		};
	},
});
