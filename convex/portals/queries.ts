import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { adminQuery, convex } from "../fluent";
import {
	FAIRLEND_PORTAL_LOCAL_HOST,
	FAIRLEND_PORTAL_PRODUCTION_HOST,
	FAIRLEND_PORTAL_SLUG,
	normalizePortalHost,
} from "./helpers";
import type { PortalSummary, ResolvedPortalHost } from "./validators";

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
	return assertSinglePortal(
		await ctx.db
			.query("portals")
			.withIndex("by_slug", (query) => query.eq("slug", slug))
			.collect(),
		`slug:${slug}`
	);
}

async function getPortalByProductionHost(ctx: PortalReaderCtx, host: string) {
	return assertSinglePortal(
		await ctx.db
			.query("portals")
			.withIndex("by_production_host", (query) =>
				query.eq("productionHost", host)
			)
			.collect(),
		`productionHost:${host}`
	);
}

async function getPortalByLocalHost(ctx: PortalReaderCtx, host: string) {
	return assertSinglePortal(
		await ctx.db
			.query("portals")
			.withIndex("by_local_host", (query) => query.eq("localHost", host))
			.collect(),
		`localHost:${host}`
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

export const getFairLendPortal = convex
	.query()
	.input({})
	.handler(async (ctx): Promise<PortalSummary | null> => {
		const portal = await getPortalBySlug(ctx, FAIRLEND_PORTAL_SLUG);
		return portal ? toPortalSummary(portal) : null;
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
				requestedHost,
				canonicalHost: productionPortal.productionHost,
				matchedHostType: "production" as const,
				portal: toPortalSummary(productionPortal),
			};
		}

		const localPortal = await getPortalByLocalHost(ctx, requestedHost);
		if (localPortal) {
			return {
				requestedHost,
				canonicalHost: localPortal.localHost,
				matchedHostType: "local" as const,
				portal: toPortalSummary(localPortal),
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
			.collect();
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
