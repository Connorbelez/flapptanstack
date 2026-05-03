import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { executeTransition } from "../engine/transition";
import { adminMutation, type Viewer } from "../fluent";

function assertE2eEnabled() {
	if (process.env.ALLOW_TEST_AUTH_ENDPOINTS !== "true") {
		throw new ConvexError("Deal portal e2e endpoints are disabled");
	}
}

function source(viewer: Viewer) {
	return {
		actorId: viewer.authId,
		actorType: "admin" as const,
		channel: "admin_dashboard" as const,
	};
}

async function transitionDealForE2e(
	ctx: MutationCtx & { viewer: Viewer },
	dealId: Id<"deals">,
	eventType: "ALL_PARTIES_SIGNED" | "LAWYER_APPROVED_DOCUMENTS"
) {
	const result = await executeTransition(ctx, {
		entityId: dealId,
		entityType: "deal",
		eventType,
		source: source(ctx.viewer),
	});
	if (!result.success) {
		throw new ConvexError(result.reason ?? `${eventType} rejected`);
	}
	return result;
}

export const completeSigningForDeal = adminMutation
	.input({ dealId: v.id("deals") })
	.handler(async (ctx, args) => {
		assertE2eEnabled();
		const before = await ctx.db.get(args.dealId);
		if (!before) {
			throw new ConvexError("Deal not found");
		}
		if (before.status === "documentReview.pending") {
			await transitionDealForE2e(ctx, args.dealId, "LAWYER_APPROVED_DOCUMENTS");
		}
		const afterApproval = await ctx.db.get(args.dealId);
		if (afterApproval?.status === "documentReview.signed") {
			await transitionDealForE2e(ctx, args.dealId, "ALL_PARTIES_SIGNED");
		}
		const afterSigning = await ctx.db.get(args.dealId);
		return { status: afterSigning?.status ?? null };
	})
	.public();
