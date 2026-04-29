import { ConvexError, type ObjectType, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getLenderByAuthId, getUserByAuthId } from "../auth/actorResolution";
import type { Viewer } from "../fluent";
import type { PortalSummary, PublicPortalSummary } from "./validators";

type PortalReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;
interface PortalBaseContext {
	db: QueryCtx["db"] | MutationCtx["db"];
}
type PortalAuthedBaseContext = PortalBaseContext & { viewer: Viewer };

export const portalArgsValidator = {
	portalId: v.id("portals"),
};

export type PortalArgs = ObjectType<typeof portalArgsValidator>;

export interface PublicPortalResolvedContext {
	portal: PublicPortalSummary;
}

export interface PortalResolvedContext extends PublicPortalResolvedContext {
	portal: PortalSummary;
}

export interface PortalAccessContext extends PortalResolvedContext {
	portalAccess: {
		mode: "admin-override" | "same-portal";
		viewerUser: Doc<"users"> | null;
	};
}

export interface PortalBorrowerContext extends PortalAccessContext {
	borrower: Doc<"borrowers">;
}

export interface PortalLenderContext extends PortalAccessContext {
	lender: Doc<"lenders">;
}

export interface PortalMicContext extends PortalAccessContext {
	micLender: Doc<"lenders">;
	micLenderUser: Doc<"users">;
}

export interface PortalFilterBoundsContext extends PortalResolvedContext {
	portalFilterBounds: {
		brokerId: Id<"brokers"> | undefined;
		orgId: string;
		portalId: Id<"portals">;
		portalType: PortalSummary["portalType"];
	};
}

export interface PortalPricingProjectionContext extends PortalResolvedContext {
	portalPricingProjection: {
		brokerId: Id<"brokers"> | undefined;
		orgId: string;
		portalId: Id<"portals">;
		pricingPolicyId: Id<"portalPricingPolicies"> | undefined;
	};
}

export function buildPortalFilterBounds(
	portal: PortalSummary
): PortalFilterBoundsContext["portalFilterBounds"] {
	return {
		portalId: portal.portalId,
		brokerId: portal.brokerId,
		orgId: portal.orgId,
		portalType: portal.portalType,
	};
}

export function buildPortalPricingProjection(
	portal: PortalSummary
): PortalPricingProjectionContext["portalPricingProjection"] {
	return {
		portalId: portal.portalId,
		brokerId: portal.brokerId,
		orgId: portal.orgId,
		pricingPolicyId: portal.pricingPolicyId,
	};
}

function toPublicPortalSummary(portal: Doc<"portals">): PublicPortalSummary {
	return {
		portalId: portal._id,
		slug: portal.slug,
		portalType: portal.portalType,
		productionHost: portal.productionHost,
		localHost: portal.localHost,
		status: portal.status,
		isPublished: portal.isPublished,
		publicTeaserEnabled: portal.publicTeaserEnabled,
		teaserListingLimit: portal.teaserListingLimit,
		defaultPostAuthPath: portal.defaultPostAuthPath,
	};
}

function toPortalSummary(portal: Doc<"portals">): PortalSummary {
	return {
		portalId: portal._id,
		slug: portal.slug,
		portalType: portal.portalType,
		brokerId: portal.brokerId,
		lenderId: portal.lenderId,
		orgId: portal.orgId,
		productionHost: portal.productionHost,
		localHost: portal.localHost,
		status: portal.status,
		isPublished: portal.isPublished,
		publicTeaserEnabled: portal.publicTeaserEnabled,
		teaserListingLimit: portal.teaserListingLimit,
		defaultPostAuthPath: portal.defaultPostAuthPath,
		landingPageId: portal.landingPageId,
		pricingPolicyId: portal.pricingPolicyId,
	};
}

async function loadPortalOrThrow(
	ctx: PortalReaderCtx,
	portalId: Id<"portals">
): Promise<Doc<"portals">> {
	const portal = await ctx.db.get(portalId);
	if (!portal) {
		throw new ConvexError("Forbidden: portal not found");
	}

	if (portal.status !== "active" || !portal.isPublished) {
		throw new ConvexError("Forbidden: portal unavailable");
	}

	return portal;
}

export async function loadPublicPortalContext(
	ctx: PortalReaderCtx,
	portalId: Id<"portals">
): Promise<PublicPortalResolvedContext> {
	return {
		portal: toPublicPortalSummary(await loadPortalOrThrow(ctx, portalId)),
	};
}

export async function loadPortalContext(
	ctx: PortalReaderCtx,
	portalId: Id<"portals">
): Promise<PortalResolvedContext> {
	return {
		portal: toPortalSummary(await loadPortalOrThrow(ctx, portalId)),
	};
}

export async function resolvePortalAccess(
	context: PortalAuthedBaseContext & PortalResolvedContext
): Promise<PortalAccessContext["portalAccess"]> {
	const viewerUser = await getUserByAuthId(context, context.viewer.authId);
	const isSamePortal =
		viewerUser?.homePortalId !== undefined &&
		viewerUser.homePortalId === context.portal.portalId;

	if (!(isSamePortal || context.viewer.isFairLendAdmin)) {
		throw new ConvexError("Forbidden: wrong portal");
	}

	return {
		mode: isSamePortal ? "same-portal" : "admin-override",
		viewerUser,
	};
}

export async function resolvePortalBorrower(
	context: PortalAuthedBaseContext & PortalResolvedContext
): Promise<Doc<"borrowers">> {
	const viewerUser = await getUserByAuthId(context, context.viewer.authId);
	if (!viewerUser) {
		throw new ConvexError("Forbidden: borrower does not belong to this portal");
	}

	const borrower = await context.db
		.query("borrowers")
		.withIndex("by_portal_user", (query) =>
			query.eq("portalId", context.portal.portalId).eq("userId", viewerUser._id)
		)
		.first();
	if (!borrower) {
		throw new ConvexError("Forbidden: borrower does not belong to this portal");
	}

	return borrower;
}

export async function resolvePortalLender(
	context: PortalAuthedBaseContext & PortalResolvedContext
): Promise<Doc<"lenders">> {
	const lender = await getLenderByAuthId(context, context.viewer.authId);
	const matchesBroker =
		context.portal.brokerId !== undefined &&
		lender?.brokerId === context.portal.brokerId;

	if (!(lender && matchesBroker)) {
		throw new ConvexError("Forbidden: lender does not belong to this portal");
	}

	return lender;
}

export function withPublicPortalContext<
	TContext extends PortalBaseContext,
	TArgs extends PortalArgs,
	TResult,
>(
	handler: (
		context: TContext & PublicPortalResolvedContext,
		args: TArgs
	) => Promise<TResult>
) {
	return async (context: TContext, args: TArgs): Promise<TResult> => {
		return handler(
			{
				...context,
				...(await loadPublicPortalContext(context, args.portalId)),
			},
			args
		);
	};
}

export async function resolvePortalMic(
	context: PortalAuthedBaseContext & PortalResolvedContext
): Promise<Pick<PortalMicContext, "micLender" | "micLenderUser">> {
	if (context.portal.portalType !== "mic") {
		throw new ConvexError("Forbidden: portal is not a MIC portal");
	}

	if (!context.portal.lenderId) {
		throw new ConvexError("Forbidden: MIC portal is missing a lender mapping");
	}

	const lender = await context.db.get(context.portal.lenderId);
	if (!lender) {
		throw new ConvexError("Forbidden: MIC lender mapping is invalid");
	}

	const lenderUser = await context.db.get(lender.userId);
	if (!lenderUser?.authId) {
		throw new ConvexError(
			"Forbidden: MIC lender mapping is missing an auth-linked user"
		);
	}

	return {
		micLender: lender,
		micLenderUser: lenderUser,
	};
}

export function withPortalContext<
	TContext extends PortalBaseContext,
	TArgs extends PortalArgs,
	TResult,
>(
	handler: (
		context: TContext & PortalResolvedContext,
		args: TArgs
	) => Promise<TResult>
) {
	return async (context: TContext, args: TArgs): Promise<TResult> => {
		return handler(
			{ ...context, ...(await loadPortalContext(context, args.portalId)) },
			args
		);
	};
}

export function withPortalAccess<
	TContext extends PortalAuthedBaseContext,
	TArgs extends PortalArgs,
	TResult,
>(
	handler: (
		context: TContext & PortalAccessContext,
		args: TArgs
	) => Promise<TResult>
) {
	return withPortalContext<TContext, TArgs, TResult>(async (context, args) => {
		return handler(
			{
				...context,
				portalAccess: await resolvePortalAccess(context),
			},
			args
		);
	});
}

export function withPortalBorrower<
	TContext extends PortalAuthedBaseContext,
	TArgs extends PortalArgs,
	TResult,
>(
	handler: (
		context: TContext & PortalBorrowerContext,
		args: TArgs
	) => Promise<TResult>
) {
	return withPortalAccess<TContext, TArgs, TResult>(async (context, args) => {
		return handler(
			{ ...context, borrower: await resolvePortalBorrower(context) },
			args
		);
	});
}

export function withPortalLender<
	TContext extends PortalAuthedBaseContext,
	TArgs extends PortalArgs,
	TResult,
>(
	handler: (
		context: TContext & PortalLenderContext,
		args: TArgs
	) => Promise<TResult>
) {
	return withPortalAccess<TContext, TArgs, TResult>(async (context, args) => {
		return handler(
			{ ...context, lender: await resolvePortalLender(context) },
			args
		);
	});
}

export function withPortalMic<
	TContext extends PortalAuthedBaseContext,
	TArgs extends PortalArgs,
	TResult,
>(
	handler: (
		context: TContext & PortalMicContext,
		args: TArgs
	) => Promise<TResult>
) {
	return withPortalAccess<TContext, TArgs, TResult>(async (context, args) => {
		return handler(
			{
				...context,
				...(await resolvePortalMic(context)),
			},
			args
		);
	});
}

export function withPortalFilterBounds<
	TContext extends PortalResolvedContext,
	TArgs,
	TResult,
>(
	handler: (
		context: TContext & PortalFilterBoundsContext,
		args: TArgs
	) => Promise<TResult>
) {
	return async (context: TContext, args: TArgs): Promise<TResult> => {
		return handler(
			{
				...context,
				portalFilterBounds: buildPortalFilterBounds(context.portal),
			},
			args
		);
	};
}

export function withPortalPricingProjection<
	TContext extends PortalResolvedContext,
	TArgs,
	TResult,
>(
	handler: (
		context: TContext & PortalPricingProjectionContext,
		args: TArgs
	) => Promise<TResult>
) {
	return async (context: TContext, args: TArgs): Promise<TResult> => {
		return handler(
			{
				...context,
				portalPricingProjection: buildPortalPricingProjection(context.portal),
			},
			args
		);
	};
}
