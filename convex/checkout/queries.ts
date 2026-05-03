import { ConvexError, v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { authedQuery, requirePermission } from "../fluent";

const checkoutStatusArgsValidator = {
	checkoutSessionId: v.id("checkoutSessions"),
};

const checkoutConfirmationArgsValidator = {
	stripeCheckoutSessionId: v.string(),
};

export const getMarketplaceCheckoutStatus = authedQuery
	.use(requirePermission("listing:invest"))
	.input(checkoutStatusArgsValidator)
	.handler(async (ctx, args) => {
		const checkoutSession = await ctx.db.get(args.checkoutSessionId);
		if (!checkoutSession) {
			return null;
		}
		if (checkoutSession.lenderAuthId !== ctx.viewer.authId) {
			throw new ConvexError(
				"Forbidden: checkout session is not owned by viewer"
			);
		}
		return {
			checkoutSessionId: checkoutSession._id,
			completedAt: checkoutSession.completedAt,
			expiresAt: checkoutSession.expiresAt,
			failureReason: checkoutSession.failureReason,
			lateSuccessRefundStatus: checkoutSession.lateSuccessRefund?.status,
			resolvedAt: checkoutSession.resolvedAt,
			status: checkoutSession.status,
			stripeCheckoutSessionId: checkoutSession.stripeCheckoutSessionId,
		};
	})
	.public();

export const getMarketplaceCheckoutConfirmation = authedQuery
	.use(requirePermission("listing:invest"))
	.input(checkoutConfirmationArgsValidator)
	.handler(async (ctx, args) => {
		const checkoutSession = await ctx.db
			.query("checkoutSessions")
			.withIndex("by_stripe_checkout_session", (query) =>
				query.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId)
			)
			.unique();
		if (!checkoutSession) {
			return null;
		}
		if (checkoutSession.lenderAuthId !== ctx.viewer.authId) {
			throw new ConvexError(
				"Forbidden: checkout session is not owned by viewer"
			);
		}

		const listing = await ctx.db.get(checkoutSession.listingId);

		return {
			checkoutSessionId: checkoutSession._id,
			completedAt: checkoutSession.completedAt,
			dealId: checkoutSession.dealId,
			expiresAt: checkoutSession.expiresAt,
			listing: listing
				? {
						city: listing.city,
						id: listing._id,
						province: listing.province,
						title:
							listing.title ??
							`Mortgage listing in ${listing.city}, ${listing.province}`,
					}
				: null,
			lockFeeAmount: checkoutSession.lockFeeAmount,
			lockFeeCurrency: checkoutSession.lockFeeCurrency,
			mortgageId: checkoutSession.mortgageId,
			requestedFractions: checkoutSession.requestedFractions,
			selectedLawyer: checkoutSession.selectedLawyer,
			status: checkoutSession.status,
			stripeCheckoutSessionId: checkoutSession.stripeCheckoutSessionId,
			stripePaymentIntentId: checkoutSession.stripePaymentIntentId,
		};
	})
	.public();

export const getCheckoutSessionForReceiptInternal = internalQuery({
	args: checkoutConfirmationArgsValidator,
	handler: async (ctx, args) => {
		const checkoutSession = await ctx.db
			.query("checkoutSessions")
			.withIndex("by_stripe_checkout_session", (query) =>
				query.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId)
			)
			.unique();
		if (!checkoutSession) {
			return null;
		}
		return {
			checkoutSessionId: checkoutSession._id,
			lenderAuthId: checkoutSession.lenderAuthId,
			stripePaymentIntentId: checkoutSession.stripePaymentIntentId,
		};
	},
});
