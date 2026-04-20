import { type Infer, v } from "convex/values";

export const portalTypeValidator = v.union(
	v.literal("fairlend"),
	v.literal("broker")
);

export const portalStatusValidator = v.union(
	v.literal("draft"),
	v.literal("active"),
	v.literal("suspended"),
	v.literal("archived")
);

export const nonPortalContextKindValidator = v.union(
	v.literal("marketing"),
	v.literal("admin"),
	v.literal("reserved"),
	v.literal("unknown")
);

export const portalMatchedHostTypeValidator = v.union(
	v.literal("production"),
	v.literal("local")
);

export const portalSummaryValidator = v.object({
	portalId: v.id("portals"),
	slug: v.string(),
	portalType: portalTypeValidator,
	brokerId: v.optional(v.id("brokers")),
	orgId: v.string(),
	productionHost: v.string(),
	localHost: v.string(),
	status: portalStatusValidator,
	isPublished: v.boolean(),
	publicTeaserEnabled: v.boolean(),
	teaserListingLimit: v.optional(v.number()),
	defaultPostAuthPath: v.optional(v.string()),
	landingPageId: v.optional(v.id("portalLandingPages")),
	pricingPolicyId: v.optional(v.id("portalPricingPolicies")),
});

export const resolvedPortalHostValidator = v.object({
	requestedHost: v.string(),
	canonicalHost: v.string(),
	matchedHostType: portalMatchedHostTypeValidator,
	portal: portalSummaryValidator,
});

export type PortalType = Infer<typeof portalTypeValidator>;
export type PortalStatus = Infer<typeof portalStatusValidator>;
export type NonPortalContextKind = Infer<typeof nonPortalContextKindValidator>;
export type PortalSummary = Infer<typeof portalSummaryValidator>;
export type ResolvedPortalHost = Infer<typeof resolvedPortalHostValidator>;
