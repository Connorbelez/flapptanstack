import { ConvexError, type Infer, v } from "convex/values";

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

export const portalPricingPolicyStatusValidator = v.union(
	v.literal("draft"),
	v.literal("active"),
	v.literal("archived")
);

export const portalPricingPolicyParametersValidator = v.object({
	/** Percent of the canonical listing return retained by the broker in v1. */
	brokerSplitPercent: v.number(),
});

interface PortalPricingPolicyContractLike {
	brokerSplitPercent: number;
	effectiveFrom: number;
	effectiveTo?: number;
}

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

export const publicPortalSummaryValidator = v.object({
	portalId: v.id("portals"),
	slug: v.string(),
	portalType: portalTypeValidator,
	productionHost: v.string(),
	localHost: v.string(),
	status: portalStatusValidator,
	isPublished: v.boolean(),
	publicTeaserEnabled: v.boolean(),
	teaserListingLimit: v.optional(v.number()),
	defaultPostAuthPath: v.optional(v.string()),
});

export const resolvedPortalHostValidator = v.object({
	requestedHost: v.string(),
	canonicalHost: v.string(),
	matchedHostType: portalMatchedHostTypeValidator,
	portal: publicPortalSummaryValidator,
});

export function validatePortalPricingPolicyParameters(input: {
	brokerSplitPercent: number;
}): PortalPricingPolicyParameters {
	if (!Number.isFinite(input.brokerSplitPercent)) {
		throw new ConvexError("Portal pricing brokerSplitPercent must be finite");
	}
	if (input.brokerSplitPercent < 0 || input.brokerSplitPercent > 100) {
		throw new ConvexError(
			"Portal pricing brokerSplitPercent must stay between 0 and 100"
		);
	}

	return {
		brokerSplitPercent: input.brokerSplitPercent,
	};
}

export function validatePortalPricingPolicyContract<
	T extends PortalPricingPolicyContractLike,
>(input: T): T {
	validatePortalPricingPolicyParameters(input);

	if (!Number.isFinite(input.effectiveFrom)) {
		throw new ConvexError("Portal pricing effectiveFrom must be finite");
	}

	if (input.effectiveTo !== undefined && !Number.isFinite(input.effectiveTo)) {
		throw new ConvexError("Portal pricing effectiveTo must be finite");
	}

	if (
		input.effectiveTo !== undefined &&
		input.effectiveTo <= input.effectiveFrom
	) {
		throw new ConvexError(
			"Portal pricing effectiveTo must be greater than effectiveFrom"
		);
	}

	return input;
}

export type PortalType = Infer<typeof portalTypeValidator>;
export type PortalStatus = Infer<typeof portalStatusValidator>;
export type PortalPricingPolicyStatus = Infer<
	typeof portalPricingPolicyStatusValidator
>;
export type PortalPricingPolicyParameters = Infer<
	typeof portalPricingPolicyParametersValidator
>;
export type NonPortalContextKind = Infer<typeof nonPortalContextKindValidator>;
export type PortalSummary = Infer<typeof portalSummaryValidator>;
export type PublicPortalSummary = Infer<typeof publicPortalSummaryValidator>;
export type ResolvedPortalHost = Infer<typeof resolvedPortalHostValidator>;
