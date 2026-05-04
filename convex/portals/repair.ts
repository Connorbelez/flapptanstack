import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { FAIRLEND_STAFF_ORG_ID } from "../constants";
import { convex } from "../fluent";
import { FAIRLEND_PORTAL_SLUG } from "./helpers";

interface ReassignedPortalResult {
	orgId: string;
	portalId: Id<"portals">;
	previousOrgId: string;
	slug: string;
}

function buildReassignedPortalOrgId(slug: string) {
	return `org_dev_reassigned_${slug}`;
}

export const repairFairLendStaffPortalMapping = convex
	.mutation()
	.input({})
	.handler(async (ctx) => {
		const now = Date.now();
		const appPortal = await ctx.db
			.query("portals")
			.withIndex("by_slug", (query) => query.eq("slug", FAIRLEND_PORTAL_SLUG))
			.unique();
		if (!appPortal) {
			throw new ConvexError("FairLend app portal not found.");
		}

		const staffOrgPortals = await ctx.db
			.query("portals")
			.withIndex("by_org", (query) => query.eq("orgId", FAIRLEND_STAFF_ORG_ID))
			.collect();

		const reassignedPortals: ReassignedPortalResult[] = [];
		for (const portal of staffOrgPortals) {
			if (portal._id === appPortal._id) {
				continue;
			}
			const previousOrgId = portal.orgId;
			const orgId = buildReassignedPortalOrgId(portal.slug);
			await ctx.db.patch(portal._id, { orgId, updatedAt: now });
			reassignedPortals.push({
				portalId: portal._id,
				slug: portal.slug,
				previousOrgId,
				orgId,
			});
		}

		const previousAppOrgId = appPortal.orgId;
		if (appPortal.orgId !== FAIRLEND_STAFF_ORG_ID) {
			await ctx.db.patch(appPortal._id, {
				orgId: FAIRLEND_STAFF_ORG_ID,
				updatedAt: now,
			});
		}

		return {
			appPortalId: appPortal._id,
			appPortalSlug: appPortal.slug,
			previousAppOrgId,
			appOrgId: FAIRLEND_STAFF_ORG_ID,
			reassignedPortals,
		};
	})
	.internal();
