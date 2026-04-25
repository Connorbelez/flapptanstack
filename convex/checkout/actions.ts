import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, internalAction } from "../_generated/server";
import { authedAction, requirePermissionAction } from "../fluent";
import { buildCheckoutStripeMetadata } from "./metadata";
import {
	type CheckoutProvider,
	createStripeCheckoutProviderFromEnv,
	type HostedCheckoutSession,
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

interface ReleasedCheckoutSession {
	readonly checkoutSessionId: Id<"checkoutSessions">;
	readonly providerExpiryStatus?: "failed" | "not_required" | "succeeded";
	readonly status: string;
	readonly stripeCheckoutSessionId?: string;
}

type ProviderExpiryStatus = "failed" | "not_required" | "succeeded";

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

function isPreparedMarketplaceCheckout(value: {
	readonly ok: true;
}): value is PreparedMarketplaceCheckout {
	return "idempotencyKey" in value;
}

async function expireProviderSession(
	provider: CheckoutProvider,
	stripeCheckoutSessionId: string
) {
	try {
		return await provider.expireHostedCheckoutSession(stripeCheckoutSessionId);
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
) {
	await ctx.runMutation(
		internal.checkout.mutations.recordProviderExpiryAttempt,
		args
	);
}

async function expireProviderIfPresent(
	ctx: Pick<ActionCtx, "runMutation">,
	args: {
		now?: number;
		provider: CheckoutProvider;
		released: ReleasedCheckoutSession;
	}
) {
	if (!args.released.stripeCheckoutSessionId) {
		return { ok: true as const, skipped: true as const };
	}
	const result = await expireProviderSession(
		args.provider,
		args.released.stripeCheckoutSessionId
	);
	await recordProviderExpiryAttempt(ctx, {
		checkoutSessionId: args.released.checkoutSessionId,
		now: args.now,
		...result,
	});
	return result;
}

function providerExpiryStatusFor(args: {
	providerResult: { readonly ok: boolean };
	released: ReleasedCheckoutSession;
}): ProviderExpiryStatus {
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

function checkoutReleaseResponse(released: ReleasedCheckoutSession) {
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
			const redirectUrls = readCheckoutRedirectUrlsFromEnv();
			hostedSession = await provider.createHostedCheckoutSession({
				...redirectUrls,
				idempotencyKey: prepared.idempotencyKey,
				metadata,
			});
		} catch (error) {
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
			await provider.expireHostedCheckoutSession(
				hostedSession.stripeCheckoutSessionId
			);
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

		let provider: CheckoutProvider;
		try {
			provider = createStripeCheckoutProviderFromEnv();
		} catch (error) {
			if (released.stripeCheckoutSessionId) {
				await recordProviderExpiryAttempt(ctx, {
					checkoutSessionId: released.checkoutSessionId,
					error: providerFailureMessage(error),
					ok: false,
				});
				return {
					ok: true as const,
					checkoutSessionId: released.checkoutSessionId,
					providerExpiryStatus: "failed" as const,
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
			let provider: CheckoutProvider | null = null;
			try {
				provider = createStripeCheckoutProviderFromEnv();
			} catch (error) {
				if (released.stripeCheckoutSessionId) {
					await recordProviderExpiryAttempt(ctx, {
						checkoutSessionId: released.checkoutSessionId,
						error: providerFailureMessage(error),
						now: listed.now,
						ok: false,
					});
				}
			}
			if (!provider) {
				results.push({
					checkoutSessionId: released.checkoutSessionId,
					providerExpiryStatus: released.stripeCheckoutSessionId
						? "failed"
						: "not_required",
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
