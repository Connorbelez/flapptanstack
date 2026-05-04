import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
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
