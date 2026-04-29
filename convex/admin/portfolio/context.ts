import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { Viewer } from "../../fluent";
import {
	loadPortalContext,
	type PortalLenderContext,
} from "../../portals/middleware";

type AdminPortfolioBaseContext =
	| Pick<QueryCtx, "db" | "storage">
	| Pick<MutationCtx, "db" | "storage">;

export type AdminPortfolioContext<TCtx extends AdminPortfolioBaseContext> =
	TCtx &
		PortalLenderContext & {
			viewer: Pick<Viewer, "authId">;
		};

async function loadTargetHomePortalOrThrow(
	ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
	targetUser: Doc<"users">,
	targetBrokerId: Id<"brokers">
): Promise<Doc<"portals">> {
	if (!targetUser.homePortalId) {
		throw new ConvexError("Admin portfolio target lender missing home portal");
	}

	const portal = await ctx.db.get(targetUser.homePortalId);
	if (
		!portal ||
		portal.brokerId !== targetBrokerId ||
		portal.status !== "active" ||
		!portal.isPublished
	) {
		throw new ConvexError("Admin portfolio broker context missing");
	}

	return portal;
}

export async function resolveAdminPortfolioContext<
	TCtx extends AdminPortfolioBaseContext,
>(
	ctx: TCtx,
	targetLenderId: Id<"lenders">
): Promise<AdminPortfolioContext<TCtx>> {
	const targetLender = await ctx.db.get(targetLenderId);
	if (!targetLender) {
		throw new ConvexError("Admin portfolio lender record not found");
	}

	const targetUser = await ctx.db.get(targetLender.userId);
	if (!targetUser?.authId) {
		throw new ConvexError("Admin portfolio target lender missing auth id");
	}

	const broker = await ctx.db.get(targetLender.brokerId);
	if (!broker) {
		throw new ConvexError("Admin portfolio broker context missing");
	}

	const portalDoc = await loadTargetHomePortalOrThrow(
		ctx,
		targetUser,
		broker._id
	);
	const { portal } = await loadPortalContext(ctx, portalDoc._id);
	const portalAccess: PortalLenderContext["portalAccess"] = {
		mode: "admin-override",
		viewerUser: null,
	};
	const portalContext: PortalLenderContext = {
		lender: targetLender,
		portal,
		portalAccess,
	};

	const resolvedContext = {
		...ctx,
		...portalContext,
		viewer: {
			authId: targetUser.authId,
		},
	};
	return resolvedContext as AdminPortfolioContext<TCtx>;
}
