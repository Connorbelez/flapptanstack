import {
	buildPortalHosts as buildSharedPortalHosts,
	FAIRLEND_PORTAL_LOCAL_HOST as fairlendPortalLocalHost,
	FAIRLEND_PORTAL_PRODUCTION_HOST as fairlendPortalProductionHost,
	FAIRLEND_PORTAL_SLUG as fairlendPortalSlug,
	isReservedPortalSlug as isReservedSharedPortalSlug,
	normalizePortalHost as normalizeSharedPortalHost,
	normalizePortalSlug as normalizeSharedPortalSlug,
	PORTAL_RESERVED_SLUGS as reservedPortalSlugs,
} from "../../shared/portal/contracts";
import type { Id } from "../_generated/dataModel";
import { FAIRLEND_BROKERAGE_ORG_ID } from "../constants";

export const DEFAULT_PORTAL_POST_AUTH_PATH = "/";
export const DEFAULT_PORTAL_TEASER_LIMIT = 12;
export const FAIRLEND_PORTAL_LOCAL_HOST = fairlendPortalLocalHost;
export const FAIRLEND_PORTAL_PRODUCTION_HOST = fairlendPortalProductionHost;
export const FAIRLEND_PORTAL_SLUG = fairlendPortalSlug;
export const PORTAL_RESERVED_SLUGS = reservedPortalSlugs;
export const isReservedPortalSlug = isReservedSharedPortalSlug;
export const normalizePortalHost = normalizeSharedPortalHost;
export const normalizePortalSlug = normalizeSharedPortalSlug;

export function buildPortalHosts(slug: string) {
	return buildSharedPortalHosts(slug);
}

export function fairLendPortalFields(now: number) {
	return {
		slug: fairlendPortalSlug,
		portalType: "fairlend" as const,
		brokerId: undefined,
		orgId: FAIRLEND_BROKERAGE_ORG_ID,
		productionHost: fairlendPortalProductionHost,
		localHost: fairlendPortalLocalHost,
		status: "active" as const,
		isPublished: true,
		publicTeaserEnabled: true,
		teaserListingLimit: DEFAULT_PORTAL_TEASER_LIMIT,
		defaultPostAuthPath: DEFAULT_PORTAL_POST_AUTH_PATH,
		createdAt: now,
		updatedAt: now,
	};
}

export function micPortalFields(args: {
	lenderId: Id<"lenders">;
	now: number;
	orgId: string;
	slug: string;
}) {
	const hosts = buildPortalHosts(args.slug);
	return {
		slug: args.slug,
		portalType: "mic" as const,
		brokerId: undefined,
		lenderId: args.lenderId,
		orgId: args.orgId,
		productionHost: hosts.productionHost,
		localHost: hosts.localHost,
		status: "active" as const,
		isPublished: true,
		publicTeaserEnabled: false,
		teaserListingLimit: 0,
		defaultPostAuthPath: "/portal",
		createdAt: args.now,
		updatedAt: args.now,
	};
}
