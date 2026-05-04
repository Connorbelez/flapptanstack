import { ConvexError, type Infer, v } from "convex/values";

export const portalTypeValidator = v.union(
	v.literal("fairlend"),
	v.literal("broker"),
	v.literal("mic")
);

export const portalStatusValidator = v.union(
	v.literal("draft"),
	v.literal("active"),
	v.literal("suspended"),
	v.literal("archived")
);

export const portalAvailabilityValidator = v.union(
	v.literal("draft"),
	v.literal("active"),
	v.literal("suspended"),
	v.literal("archived"),
	v.literal("unpublished"),
	v.literal("misconfigured")
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

export const portalLandingActionValidator = v.object({
	href: v.string(),
	label: v.string(),
});

export const portalLandingTrustItemValidator = v.object({
	label: v.string(),
});

export const portalLandingNavigationItemValidator = v.object({
	href: v.string(),
	label: v.string(),
});

export const portalLandingInlineFieldValidator = v.object({
	key: v.string(),
	label: v.string(),
});

export const portalLandingBrandValidator = v.object({
	logoAlt: v.optional(v.string()),
	logoUrl: v.optional(v.string()),
});

export const portalLandingThemeValidator = v.object({
	accentColor: v.optional(v.string()),
	backgroundColor: v.optional(v.string()),
	borderColor: v.optional(v.string()),
	mutedTextColor: v.optional(v.string()),
	primaryColor: v.optional(v.string()),
	primaryHoverColor: v.optional(v.string()),
	surfaceColor: v.optional(v.string()),
	textColor: v.optional(v.string()),
});

export const portalLandingPageContentValidator = v.object({
	brand: v.optional(portalLandingBrandValidator),
	featuredListings: v.optional(
		v.object({
			label: v.optional(v.string()),
			subcopy: v.optional(v.string()),
			viewAllAction: v.optional(portalLandingActionValidator),
			visibleCardCount: v.optional(v.number()),
		})
	),
	financingStrip: v.optional(
		v.object({
			body: v.optional(v.string()),
			fields: v.optional(v.array(portalLandingInlineFieldValidator)),
			kicker: v.optional(v.string()),
			submitAction: v.optional(portalLandingActionValidator),
			title: v.optional(v.string()),
		})
	),
	hero: v.optional(
		v.object({
			body: v.optional(v.string()),
			eyebrow: v.optional(v.string()),
			headline: v.optional(v.string()),
			primaryAction: v.optional(portalLandingActionValidator),
			secondaryAction: v.optional(portalLandingActionValidator),
		})
	),
	navigation: v.optional(
		v.object({
			items: v.optional(v.array(portalLandingNavigationItemValidator)),
			rightLabel: v.optional(v.string()),
		})
	),
	switchboard: v.optional(
		v.object({
			borrower: v.optional(
				v.object({
					body: v.optional(v.string()),
					helper: v.optional(v.string()),
					label: v.optional(v.string()),
					primaryAction: v.optional(portalLandingActionValidator),
					secondaryActions: v.optional(v.array(portalLandingActionValidator)),
				})
			),
			intro: v.optional(
				v.object({
					body: v.optional(v.string()),
					kicker: v.optional(v.string()),
					title: v.optional(v.string()),
				})
			),
			lender: v.optional(
				v.object({
					body: v.optional(v.string()),
					helper: v.optional(v.string()),
					label: v.optional(v.string()),
					primaryAction: v.optional(portalLandingActionValidator),
				})
			),
		})
	),
	theme: v.optional(portalLandingThemeValidator),
	trustStrip: v.optional(v.array(portalLandingTrustItemValidator)),
});

export const publicPortalLandingPageValidator = v.object({
	brand: v.object({
		logoAlt: v.string(),
		logoUrl: v.union(v.string(), v.null()),
	}),
	broker: v.object({
		brokerageName: v.union(v.string(), v.null()),
		license: v.union(
			v.object({
				id: v.union(v.string(), v.null()),
				label: v.string(),
				province: v.union(v.string(), v.null()),
			}),
			v.null()
		),
	}),
	featuredListings: v.object({
		enabled: v.boolean(),
		hasBlurredContinuation: v.boolean(),
		items: v.array(
			v.object({
				action: portalLandingActionValidator,
				amountLabel: v.string(),
				heroImageUrl: v.union(v.string(), v.null()),
				id: v.string(),
				ltvLabel: v.string(),
				mortgagePositionLabel: v.string(),
				propertyTypeLabel: v.string(),
				rateLabel: v.string(),
				statusLabel: v.string(),
				termLabel: v.string(),
				title: v.string(),
			})
		),
		label: v.string(),
		subcopy: v.string(),
		viewAllAction: portalLandingActionValidator,
		visibleCardCount: v.number(),
	}),
	financingStrip: v.object({
		body: v.string(),
		fields: v.array(portalLandingInlineFieldValidator),
		kicker: v.string(),
		submitAction: portalLandingActionValidator,
		title: v.string(),
	}),
	hero: v.object({
		body: v.string(),
		eyebrow: v.string(),
		headline: v.string(),
		primaryAction: portalLandingActionValidator,
		secondaryAction: portalLandingActionValidator,
	}),
	navigation: v.object({
		brandLabel: v.string(),
		items: v.array(portalLandingNavigationItemValidator),
		poweredByLabel: v.string(),
		rightLabel: v.string(),
	}),
	portal: v.object({
		defaultPostAuthPath: v.union(v.string(), v.null()),
		localHost: v.string(),
		portalId: v.id("portals"),
		portalType: portalTypeValidator,
		productionHost: v.string(),
		slug: v.string(),
	}),
	switchboard: v.object({
		borrower: v.object({
			body: v.string(),
			helper: v.string(),
			label: v.string(),
			nestedActions: v.array(portalLandingActionValidator),
			primaryAction: portalLandingActionValidator,
		}),
		intro: v.object({
			body: v.string(),
			kicker: v.string(),
			title: v.string(),
		}),
		lender: v.object({
			body: v.string(),
			helper: v.string(),
			label: v.string(),
			primaryAction: portalLandingActionValidator,
		}),
	}),
	theme: v.object({
		accentColor: v.string(),
		backgroundColor: v.string(),
		borderColor: v.string(),
		mutedTextColor: v.string(),
		primaryColor: v.string(),
		primaryHoverColor: v.string(),
		surfaceColor: v.string(),
		textColor: v.string(),
	}),
	trustStrip: v.object({
		items: v.array(portalLandingTrustItemValidator),
	}),
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
	availability: portalAvailabilityValidator,
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
export type PortalAvailability = Infer<typeof portalAvailabilityValidator>;
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
export type PortalLandingPageContent = Infer<
	typeof portalLandingPageContentValidator
>;
export type PublicPortalLandingPage = Infer<
	typeof publicPortalLandingPageValidator
>;

const SAFE_PORTAL_LANDING_HREF_PATTERN = /^(#[^\s#/?][^\s]*|\/(?!\/)[^\s]*)$/;
const SAFE_PORTAL_LANDING_IMAGE_URL_PATTERN =
	/^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/;
const SAFE_PORTAL_LANDING_HEX_COLOR_PATTERN =
	/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function assertSafePortalLandingHref(href: string, fieldPath: string): void {
	if (!SAFE_PORTAL_LANDING_HREF_PATTERN.test(href)) {
		throw new ConvexError(
			`Unsafe portal landing href at ${fieldPath}: ${href}`
		);
	}
}

function assertSafePortalLandingAction(
	action: { href: string; label: string } | undefined,
	fieldPath: string
): void {
	if (!action) {
		return;
	}
	assertSafePortalLandingHref(action.href, `${fieldPath}.href`);
}

function assertSafePortalLandingActions(
	actions: readonly { href: string; label: string }[] | undefined,
	fieldPath: string
): void {
	if (!actions) {
		return;
	}
	for (const [index, action] of actions.entries()) {
		assertSafePortalLandingAction(action, `${fieldPath}[${String(index)}]`);
	}
}

function assertSafePortalLandingImageUrl(
	url: string | undefined,
	fieldPath: string
): void {
	if (url === undefined) {
		return;
	}
	if (!SAFE_PORTAL_LANDING_IMAGE_URL_PATTERN.test(url)) {
		throw new ConvexError(
			`Unsafe portal landing image URL at ${fieldPath}: ${url}`
		);
	}
}

function assertSafePortalLandingColor(
	color: string | undefined,
	fieldPath: string
): void {
	if (color === undefined) {
		return;
	}
	if (!SAFE_PORTAL_LANDING_HEX_COLOR_PATTERN.test(color)) {
		throw new ConvexError(
			`Unsafe portal landing color token at ${fieldPath}: ${color}`
		);
	}
}

function assertSafePortalLandingTheme(
	theme: PortalLandingPageContent["theme"] | undefined
): void {
	if (!theme) {
		return;
	}
	assertSafePortalLandingColor(theme.accentColor, "theme.accentColor");
	assertSafePortalLandingColor(theme.backgroundColor, "theme.backgroundColor");
	assertSafePortalLandingColor(theme.borderColor, "theme.borderColor");
	assertSafePortalLandingColor(theme.mutedTextColor, "theme.mutedTextColor");
	assertSafePortalLandingColor(theme.primaryColor, "theme.primaryColor");
	assertSafePortalLandingColor(
		theme.primaryHoverColor,
		"theme.primaryHoverColor"
	);
	assertSafePortalLandingColor(theme.surfaceColor, "theme.surfaceColor");
	assertSafePortalLandingColor(theme.textColor, "theme.textColor");
}

export function validatePortalLandingPageContentSafety(
	content: PortalLandingPageContent
): PortalLandingPageContent {
	assertSafePortalLandingImageUrl(content.brand?.logoUrl, "brand.logoUrl");
	assertSafePortalLandingAction(
		content.featuredListings?.viewAllAction,
		"featuredListings.viewAllAction"
	);
	assertSafePortalLandingAction(
		content.financingStrip?.submitAction,
		"financingStrip.submitAction"
	);
	assertSafePortalLandingAction(
		content.hero?.primaryAction,
		"hero.primaryAction"
	);
	assertSafePortalLandingAction(
		content.hero?.secondaryAction,
		"hero.secondaryAction"
	);
	assertSafePortalLandingActions(content.navigation?.items, "navigation.items");
	assertSafePortalLandingAction(
		content.switchboard?.borrower?.primaryAction,
		"switchboard.borrower.primaryAction"
	);
	assertSafePortalLandingActions(
		content.switchboard?.borrower?.secondaryActions,
		"switchboard.borrower.secondaryActions"
	);
	assertSafePortalLandingAction(
		content.switchboard?.lender?.primaryAction,
		"switchboard.lender.primaryAction"
	);
	assertSafePortalLandingTheme(content.theme);

	return content;
}
