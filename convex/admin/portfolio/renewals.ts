import { v } from "convex/values";
import { adminMutation, requirePermission } from "../../fluent";
import {
	lenderRenewalIntentChoiceValidator,
	signalLenderRenewalIntentForContext,
} from "../../renewals/portal";
import { resolveAdminPortfolioTarget } from "./target";

export const signalAdminLenderRenewalIntent = adminMutation
	.use(requirePermission("portfolio:signal_renewal"))
	.input({
		intent: lenderRenewalIntentChoiceValidator,
		mortgageId: v.id("mortgages"),
		notes: v.optional(v.string()),
		partialExitFractions: v.optional(v.number()),
		reason: v.optional(v.string()),
		targetLenderId: v.id("lenders"),
	})
	.handler(async (ctx, args) => {
		const target = await resolveAdminPortfolioTarget(ctx, args.targetLenderId);
		return await signalLenderRenewalIntentForContext({
			ctx: {
				...ctx,
				lender: target.lender,
			},
			intent: args.intent,
			lenderAuthId: target.lenderAuthId,
			mortgageId: args.mortgageId,
			notes: args.notes,
			partialExitFractions: args.partialExitFractions,
			transitionSource: {
				actorId: ctx.viewer.authId,
				actorType: "admin",
				channel: "admin_dashboard",
			},
		});
	})
	.public();
