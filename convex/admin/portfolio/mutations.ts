import { ConvexError, v } from "convex/values";
import { adminMutation } from "../../fluent";
import { signalLenderRenewalIntentForContext } from "../../renewals/portal";
import { resolveAdminPortfolioContext } from "./context";

const lenderRenewalIntentChoiceValidator = v.union(
	v.literal("renew"),
	v.literal("exit"),
	v.literal("partial_exit")
);

export const signalAdminLenderRenewalIntent = adminMutation
	.input({
		intent: lenderRenewalIntentChoiceValidator,
		mortgageId: v.id("mortgages"),
		notes: v.optional(v.string()),
		partialExitFractions: v.optional(v.number()),
		reason: v.string(),
		targetLenderId: v.id("lenders"),
	})
	.handler(async (ctx, args) => {
		if (args.reason.trim().length === 0) {
			throw new ConvexError("Admin portfolio action reason is required");
		}

		const targetCtx = await resolveAdminPortfolioContext(
			ctx,
			args.targetLenderId
		);

		return await signalLenderRenewalIntentForContext(targetCtx, {
			intent: args.intent,
			mortgageId: args.mortgageId,
			notes: args.notes,
			partialExitFractions: args.partialExitFractions,
			transitionPayload: {
				adminActorAuthId: ctx.viewer.authId,
				affectedBusinessRecordIds: {
					mortgageId: String(args.mortgageId),
					targetLenderId: String(args.targetLenderId),
				},
				reason: args.reason,
				sourceRoute: "admin_lender_portfolio",
				targetLenderAuthId: targetCtx.viewer.authId,
				targetLenderId: String(args.targetLenderId),
				timestamp: Date.now(),
			},
			transitionSource: {
				actorId: ctx.viewer.authId,
				actorType: "admin",
				channel: "admin_dashboard",
			},
		});
	})
	.public();
