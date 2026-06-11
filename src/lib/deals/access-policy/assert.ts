import { ConvexError } from "convex/values";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { QueryCtx } from "../../../../convex/_generated/server";
import type { Viewer } from "../../../../convex/fluent";
import { resolveDealAccessDecision } from "./resolve";
import type { AllowedDealAccessDecision, DealAccessIntent } from "./types";

export async function assertDealAccessForIntent(
	ctx: Pick<QueryCtx, "db">,
	args: {
		dealId: Id<"deals">;
		intent: DealAccessIntent;
		viewer: Viewer;
	}
): Promise<AllowedDealAccessDecision> {
	const decision = await resolveDealAccessDecision(ctx, args);
	if (!decision?.allowed) {
		throw new ConvexError("Forbidden: deal access denied");
	}
	return decision;
}
