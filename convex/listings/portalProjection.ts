import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { DatabaseReader } from "../_generated/server";
import {
	loadPortalPricingSelection,
	requirePortalPricingSelection,
} from "../portals/pricing";

export async function getRequiredPortalPricingPolicy(
	ctx: { db: Pick<DatabaseReader, "get" | "query"> },
	portalId: Id<"portals">
) {
	const portal = await ctx.db.get(portalId);
	if (!portal) {
		throw new ConvexError("Portal no longer exists for listing projection");
	}

	const selection = await loadPortalPricingSelection(ctx, {
		atTime: Date.now(),
		portalId,
	});
	return requirePortalPricingSelection(selection, portal.slug).policy;
}
