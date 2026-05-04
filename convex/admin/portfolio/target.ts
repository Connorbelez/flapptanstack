import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { Viewer } from "../../fluent";
import {
	loadPortalContext,
	type PortalLenderContext,
} from "../../portals/middleware";

type AdminPortfolioReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

export interface AdminPortfolioTarget {
	lender: Doc<"lenders">;
	lenderAuthId: string;
	portalContext: PortalLenderContext;
	user: Doc<"users">;
}

async function loadActiveBrokerPortal(
	ctx: AdminPortfolioReaderCtx,
	brokerId: Id<"brokers">
) {
	const portals = await ctx.db
		.query("portals")
		.withIndex("by_broker", (query) => query.eq("brokerId", brokerId))
		.collect();
	const activePortals = portals.filter(
		(portal) => portal.status === "active" && portal.isPublished
	);

	if (activePortals.length === 0) {
		throw new ConvexError("Admin portfolio target has no active broker portal");
	}
	if (activePortals.length > 1) {
		throw new ConvexError("Admin portfolio target has multiple active portals");
	}
	return activePortals[0];
}

export async function resolveAdminPortfolioTarget(
	ctx: AdminPortfolioReaderCtx & { viewer: Viewer },
	targetLenderId: Id<"lenders">
): Promise<AdminPortfolioTarget> {
	const lender = await ctx.db.get(targetLenderId);
	if (!lender) {
		throw new ConvexError("Admin portfolio target lender not found");
	}

	const user = await ctx.db.get(lender.userId);
	if (!user?.authId) {
		throw new ConvexError("Admin portfolio target lender is missing auth");
	}

	const portal = await loadActiveBrokerPortal(ctx, lender.brokerId);
	const portalContext = await loadPortalContext(ctx, portal._id);

	return {
		lender,
		lenderAuthId: user.authId,
		portalContext: {
			...portalContext,
			lender,
			portalAccess: {
				mode: "admin-override",
				viewerUser: null,
			},
		},
		user,
	};
}

export function withAdminPortfolioTarget<TCtx extends QueryCtx | MutationCtx>(
	ctx: TCtx & { viewer: Viewer },
	target: AdminPortfolioTarget
): TCtx & PortalLenderContext & { viewer: Viewer } {
	return {
		...ctx,
		...target.portalContext,
		viewer: {
			...ctx.viewer,
			authId: target.lenderAuthId,
		},
	} as unknown as TCtx & PortalLenderContext & { viewer: Viewer };
}
