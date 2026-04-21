import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { adminQuery, authedQuery, convex } from "../fluent";
import {
	FAIRLEND_PORTAL_LOCAL_HOST,
	FAIRLEND_PORTAL_PRODUCTION_HOST,
	FAIRLEND_PORTAL_SLUG,
	normalizePortalHost,
} from "./helpers";
import {
	loadPortalPricingSelection,
	resolvePublishedPortalAvailability,
} from "./pricing";
import type {
	PortalSummary,
	PublicPortalSummary,
	ResolvedPortalHost,
} from "./validators";

type PortalReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

function assertSinglePortal(
	portals: Doc<"portals">[],
	label: string
): Doc<"portals"> | null {
	if (portals.length > 1) {
		throw new ConvexError(`Duplicate portal claim for ${label}`);
	}
	return portals[0] ?? null;
}

async function getPortalBySlug(ctx: PortalReaderCtx, slug: string) {
	const rows = await ctx.db
		.query("portals")
		.withIndex("by_slug", (query) => query.eq("slug", slug))
		.take(2);
	return assertSinglePortal(rows, `slug:${slug}`);
}

async function getPortalByProductionHost(ctx: PortalReaderCtx, host: string) {
	const rows = await ctx.db
		.query("portals")
		.withIndex("by_production_host", (query) =>
			query.eq("productionHost", host)
		)
		.take(2);
	return assertSinglePortal(rows, `productionHost:${host}`);
}

async function getPortalByLocalHost(ctx: PortalReaderCtx, host: string) {
	const rows = await ctx.db
		.query("portals")
		.withIndex("by_local_host", (query) => query.eq("localHost", host))
		.take(2);
	return assertSinglePortal(rows, `localHost:${host}`);
}

async function getPortalByOrgId(ctx: PortalReaderCtx, orgId: string) {
	return assertSinglePortal(
		await ctx.db
			.query("portals")
			.withIndex("by_org", (query) => query.eq("orgId", orgId))
			.collect(),
		`orgId:${orgId}`
	);
}

function toPortalSummary(portal: Doc<"portals">): PortalSummary {
	return {
		portalId: portal._id,
		slug: portal.slug,
		portalType: portal.portalType,
		brokerId: portal.brokerId,
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

async function resolvePortalAvailability(
	ctx: PortalReaderCtx,
	portal: Doc<"portals">
) {
	const pricingSelection =
		portal.isPublished && portal.status === "active"
			? await loadPortalPricingSelection(ctx, {
					atTime: Date.now(),
					portalId: portal._id,
				})
			: undefined;

	return resolvePublishedPortalAvailability({
		isPublished: portal.isPublished,
		portalStatus: portal.status,
		pricingSelection,
	});
}

export const getFairLendPortal = convex
	.query()
	.input({})
	.handler(async (ctx): Promise<PublicPortalSummary | null> => {
		const portal = await getPortalBySlug(ctx, FAIRLEND_PORTAL_SLUG);
		return portal ? toPublicPortalSummary(portal) : null;
	})
	.public();

export const resolvePortalByHost = convex
	.query()
	.input({ host: v.string() })
	.handler(async (ctx, args): Promise<ResolvedPortalHost | null> => {
		const requestedHost = normalizePortalHost(args.host);
		const productionPortal = await getPortalByProductionHost(
			ctx,
			requestedHost
		);
		if (productionPortal) {
			return {
				availability: await resolvePortalAvailability(ctx, productionPortal),
				requestedHost,
				canonicalHost: productionPortal.productionHost,
				matchedHostType: "production" as const,
				portal: toPublicPortalSummary(productionPortal),
			};
		}

		const localPortal = await getPortalByLocalHost(ctx, requestedHost);
		if (localPortal) {
			return {
				availability: await resolvePortalAvailability(ctx, localPortal),
				requestedHost,
				canonicalHost: localPortal.localHost,
				matchedHostType: "local" as const,
				portal: toPublicPortalSummary(localPortal),
			};
		}

		return null;
	})
	.public();

export const getPortalByBroker = adminQuery
	.input({ brokerId: v.id("brokers") })
	.handler(async (ctx, args) => {
		const portals = await ctx.db
			.query("portals")
			.withIndex("by_broker", (query) => query.eq("brokerId", args.brokerId))
			.take(2);
		const portal = assertSinglePortal(
			portals,
			`brokerId:${String(args.brokerId)}`
		);
		return portal ? toPortalSummary(portal) : null;
	})
	.public();

export const getFairLendPortalHosts = convex
	.query()
	.input({})
	.handler(async () => {
		return {
			productionHost: FAIRLEND_PORTAL_PRODUCTION_HOST,
			localHost: FAIRLEND_PORTAL_LOCAL_HOST,
		};
	})
	.public();

export const getViewerHomePortal = authedQuery
	.input({})
	.handler(async (ctx) => {
		const user = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", ctx.viewer.authId))
			.unique();
		const currentOrgPortal = ctx.viewer.orgId
			? await getPortalByOrgId(ctx, ctx.viewer.orgId)
			: null;

		if (!user?.homePortalId) {
			return {
				userId: user?._id ?? null,
				homePortalId: user?.homePortalId ?? null,
				homePortal: null,
				currentOrgPortalId: currentOrgPortal?._id ?? null,
				currentOrgPortal: currentOrgPortal
					? toPublicPortalSummary(currentOrgPortal)
					: null,
				isFairLendAdmin: ctx.viewer.isFairLendAdmin,
			};
		}

		const homePortal = await ctx.db.get(user.homePortalId);
		return {
			userId: user._id,
			homePortalId: user.homePortalId,
			homePortal: homePortal ? toPublicPortalSummary(homePortal) : null,
			currentOrgPortalId: currentOrgPortal?._id ?? null,
			currentOrgPortal: currentOrgPortal
				? toPublicPortalSummary(currentOrgPortal)
				: null,
			isFairLendAdmin: ctx.viewer.isFairLendAdmin,
		};
	})
	.public();
