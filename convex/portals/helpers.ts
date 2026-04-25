import {
	buildPortalHosts as buildSharedPortalHosts,
	FAIRLEND_PORTAL_LOCAL_HOST as fairlendPortalLocalHost,
	FAIRLEND_PORTAL_PRODUCTION_HOST as fairlendPortalProductionHost,
	FAIRLEND_PORTAL_SLUG as fairlendPortalSlug,
	isReservedPortalSlug as isReservedSharedPortalSlug,
	MIC_PORTAL_DEFAULT_POST_AUTH_PATH as micPortalDefaultPostAuthPath,
	MIC_PORTAL_LOCAL_HOST as micPortalLocalHost,
	MIC_PORTAL_PRODUCTION_HOST as micPortalProductionHost,
	MIC_PORTAL_SLUG as micPortalSlug,
	normalizePortalHost as normalizeSharedPortalHost,
	normalizePortalSlug as normalizeSharedPortalSlug,
	PORTAL_RESERVED_SLUGS as reservedPortalSlugs,
} from "../../shared/portal/contracts";
import { FAIRLEND_BROKERAGE_ORG_ID } from "../constants";

export const DEFAULT_PORTAL_POST_AUTH_PATH = "/";
export const DEFAULT_PORTAL_TEASER_LIMIT = 12;
export const FAIRLEND_PORTAL_LOCAL_HOST = fairlendPortalLocalHost;
export const FAIRLEND_PORTAL_PRODUCTION_HOST = fairlendPortalProductionHost;
export const FAIRLEND_PORTAL_SLUG = fairlendPortalSlug;
export const MIC_PORTAL_DEFAULT_POST_AUTH_PATH = micPortalDefaultPostAuthPath;
export const MIC_PORTAL_LOCAL_HOST = micPortalLocalHost;
export const MIC_PORTAL_PRODUCTION_HOST = micPortalProductionHost;
export const MIC_PORTAL_SLUG = micPortalSlug;
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

export function micPortalFields(input: {
	micLenderAuthId: string;
	now: number;
	orgId: string;
}) {
	return {
		slug: micPortalSlug,
		portalType: "mic" as const,
		brokerId: undefined,
		orgId: input.orgId,
		productionHost: micPortalProductionHost,
		localHost: micPortalLocalHost,
		status: "active" as const,
		isPublished: true,
		publicTeaserEnabled: false,
		teaserListingLimit: undefined,
		defaultPostAuthPath: micPortalDefaultPostAuthPath,
		micLenderAuthId: input.micLenderAuthId,
		createdAt: input.now,
		updatedAt: input.now,
	};
}
