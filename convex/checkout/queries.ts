import { ConvexError, v } from "convex/values";
import { authedQuery, requirePermission } from "../fluent";

const checkoutStatusArgsValidator = {
	checkoutSessionId: v.id("checkoutSessions"),
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
