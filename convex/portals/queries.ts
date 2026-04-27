import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { adminQuery, authedQuery, convex } from "../fluent";
import {
	listMarketplaceListingsSnapshot,
	type MarketplaceListingsSnapshotArgs,
} from "../listings/marketplace";
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
	PortalLandingPageContent,
	PortalSummary,
	PublicPortalLandingPage,
	PublicPortalSummary,
	ResolvedPortalHost,
} from "./validators";
import { validatePortalLandingPageContentSafety } from "./validators";

type PortalReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;
type LandingListing =
	PublicPortalLandingPage["featuredListings"]["items"][number];
interface LandingFallbackBaseArgs {
	brandLabel: string;
	content: PortalLandingPageContent | undefined;
	portal: Doc<"portals">;
}

const SLUG_WORD_SEPARATOR_PATTERN = /[-_]+/;
const DEFAULT_LANDING_VISIBLE_CARD_COUNT = 3;
const MAX_LANDING_VISIBLE_CARD_COUNT = 3;
const DEFAULT_LANDING_THEME: PublicPortalLandingPage["theme"] = {
	accentColor: "#047857",
	backgroundColor: "#f7f5ef",
	borderColor: "#e7e5e4",
	mutedTextColor: "#57534e",
	primaryColor: "#064e3b",
	primaryHoverColor: "#065f46",
	surfaceColor: "#ffffff",
	textColor: "#1c1917",
};
const LENDER_HANDOFF_START_PATH = "/start-lending";

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
		micLenderAuthId: portal.micLenderAuthId,
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

function titleCaseSlug(slug: string): string {
	return slug
		.split(SLUG_WORD_SEPARATOR_PATTERN)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function formatCurrency(value: number): string {
	return new Intl.NumberFormat("en-CA", {
		currency: "CAD",
		maximumFractionDigits: 0,
		style: "currency",
	}).format(value);
}

function formatPercent(value: number): string {
	const normalized = Math.abs(value) <= 1 ? value * 100 : value;
	return `${new Intl.NumberFormat("en-CA", {
		maximumFractionDigits: 2,
		minimumFractionDigits: Number.isInteger(normalized) ? 0 : 2,
	}).format(normalized)}%`;
}

function mortgagePositionLabel(value: string): string {
	if (value === "First") {
		return "1st";
	}
	if (value === "Second") {
		return "2nd";
	}
	return value;
}

function action(label: string, href: string) {
	return { href, label };
}

function lenderHandoffAction(
	label: string,
	source: "featured-listing" | "switchboard" | "view-all",
	listingId?: string
) {
	const params = new URLSearchParams({ source });
	if (listingId) {
		params.set("listingId", listingId);
	}
	return action(label, `${LENDER_HANDOFF_START_PATH}?${params.toString()}`);
}

async function getPortalLandingPageContent(
	ctx: PortalReaderCtx,
	portal: Doc<"portals">
): Promise<PortalLandingPageContent | undefined> {
	if (portal.landingPageId) {
		const landingPage = await ctx.db.get(portal.landingPageId);
		if (landingPage?.portalId === portal._id) {
			return landingPage.v1LandingContent
				? validatePortalLandingPageContentSafety(landingPage.v1LandingContent)
				: undefined;
		}
	}

	const landingPages = await ctx.db
		.query("portalLandingPages")
		.withIndex("by_portal", (query) => query.eq("portalId", portal._id))
		.collect();
	if (landingPages.length > 1) {
		throw new ConvexError(
			`Duplicate landing-page attachment for ${portal.slug}`
		);
	}

	return landingPages[0]?.v1LandingContent
		? validatePortalLandingPageContentSafety(landingPages[0].v1LandingContent)
		: undefined;
}

function buildBrokerLicense(
	broker: Doc<"brokers"> | null
): PublicPortalLandingPage["broker"]["license"] {
	if (!(broker?.licenseId || broker?.licenseProvince)) {
		return null;
	}

	return {
		id: broker.licenseId ?? null,
		label: broker.licenseId
			? `${broker.licenseProvince ?? "FSRA"} Licensed #${broker.licenseId}`
			: `${broker.licenseProvince ?? "Provincial"} licensed brokerage`,
		province: broker.licenseProvince ?? null,
	};
}

function buildDefaultTrustItems(args: {
	brandLabel: string;
	license: PublicPortalLandingPage["broker"]["license"];
}) {
	return [
		args.license
			? { label: args.license.label }
			: { label: "Licensed brokerage" },
		{ label: "Broker-led review" },
		{ label: "Portal-aware pricing" },
		{ label: "Secure FairLend handoff" },
	];
}

function buildNavigation(
	args: LandingFallbackBaseArgs
): PublicPortalLandingPage["navigation"] {
	return {
		brandLabel: args.brandLabel,
		items: args.content?.navigation?.items ?? [
			action(`How ${args.brandLabel} works`, "#how-it-works"),
			action("Current opportunities", "/listings"),
			action("Borrower start", "/financing/start"),
			action("Contact", "#contact"),
		],
		poweredByLabel:
			args.portal.portalType === "fairlend"
				? "Private mortgage marketplace"
				: "Powered by FairLend",
		rightLabel:
			args.content?.navigation?.rightLabel ??
			(args.portal.portalType === "fairlend"
				? "Private mortgage marketplace"
				: "Private mortgage brokerage"),
	};
}

function buildHero(
	args: LandingFallbackBaseArgs
): PublicPortalLandingPage["hero"] {
	return {
		body:
			args.content?.hero?.body ??
			`${args.brandLabel} leads the public experience. FairLend is the operating layer behind it, with one clear path for lenders and one clear path for borrowers or mortgage applicants.`,
		eyebrow:
			args.content?.hero?.eyebrow ?? "Broker-led private mortgage access",
		headline:
			args.content?.hero?.headline ??
			"A branded front door for lenders and mortgage seekers.",
		primaryAction:
			args.content?.hero?.primaryAction ??
			action(`Talk to ${args.brandLabel}`, "#contact"),
		secondaryAction:
			args.content?.hero?.secondaryAction ??
			action("See how it works", "#how-it-works"),
	};
}

function buildBrand(args: {
	brandLabel: string;
	content: PortalLandingPageContent | undefined;
}): PublicPortalLandingPage["brand"] {
	return {
		logoAlt: args.content?.brand?.logoAlt ?? `${args.brandLabel} logo`,
		logoUrl: args.content?.brand?.logoUrl ?? null,
	};
}

function buildTheme(
	content: PortalLandingPageContent | undefined
): PublicPortalLandingPage["theme"] {
	return {
		accentColor:
			content?.theme?.accentColor ?? DEFAULT_LANDING_THEME.accentColor,
		backgroundColor:
			content?.theme?.backgroundColor ?? DEFAULT_LANDING_THEME.backgroundColor,
		borderColor:
			content?.theme?.borderColor ?? DEFAULT_LANDING_THEME.borderColor,
		mutedTextColor:
			content?.theme?.mutedTextColor ?? DEFAULT_LANDING_THEME.mutedTextColor,
		primaryColor:
			content?.theme?.primaryColor ?? DEFAULT_LANDING_THEME.primaryColor,
		primaryHoverColor:
			content?.theme?.primaryHoverColor ??
			DEFAULT_LANDING_THEME.primaryHoverColor,
		surfaceColor:
			content?.theme?.surfaceColor ?? DEFAULT_LANDING_THEME.surfaceColor,
		textColor: content?.theme?.textColor ?? DEFAULT_LANDING_THEME.textColor,
	};
}

function buildSwitchboard(
	args: LandingFallbackBaseArgs
): PublicPortalLandingPage["switchboard"] {
	return {
		borrower: {
			body:
				args.content?.switchboard?.borrower?.body ??
				`Start financing with ${args.brandLabel} whether you are exploring a mortgage path or ready to begin pre-approval.`,
			helper:
				args.content?.switchboard?.borrower?.helper ??
				"Pre-approval stays available, but nested under the broader borrower path.",
			label:
				args.content?.switchboard?.borrower?.label ??
				"Borrower / Mortgage Applicant",
			nestedActions: args.content?.switchboard?.borrower?.secondaryActions ?? [
				action("Borrower intake", "/financing/start"),
				action("Jump to pre-approval", "/financing/pre-approval"),
			],
			primaryAction:
				args.content?.switchboard?.borrower?.primaryAction ??
				action("Start financing intake", "/financing/start"),
		},
		intro: {
			body:
				args.content?.switchboard?.intro?.body ??
				"One half for lender discovery, one half for financing starts.",
			kicker:
				args.content?.switchboard?.intro?.kicker ?? "Choose your next step",
			title: args.content?.switchboard?.intro?.title ?? "Two clear ways in.",
		},
		lender: {
			body:
				args.content?.switchboard?.lender?.body ??
				`Review live opportunities, request access, and continue into ${args.brandLabel}'s broker-attributed onboarding path.`,
			helper:
				args.content?.switchboard?.lender?.helper ??
				"For accredited lenders and repeat deal-flow participants.",
			label: args.content?.switchboard?.lender?.label ?? "Lender",
			primaryAction: lenderHandoffAction(
				args.content?.switchboard?.lender?.primaryAction?.label ??
					"Browse current listings",
				"switchboard"
			),
		},
	};
}

function buildFinancingStrip(
	content: PortalLandingPageContent | undefined
): PublicPortalLandingPage["financingStrip"] {
	return {
		body:
			content?.financingStrip?.body ??
			"Give the broker desk just enough information to begin the conversation, then continue on the dedicated financing screen.",
		fields: content?.financingStrip?.fields ?? [
			{ key: "fullName", label: "Full name" },
			{ key: "email", label: "Email" },
			{ key: "amountNeeded", label: "Amount needed" },
		],
		kicker:
			content?.financingStrip?.kicker ??
			"Short inline start, then dedicated flow",
		submitAction:
			content?.financingStrip?.submitAction ??
			action("Continue", "/financing/start"),
		title: content?.financingStrip?.title ?? "Need to start quickly?",
	};
}

function buildLandingFallbacks(args: {
	broker: Doc<"brokers"> | null;
	content: PortalLandingPageContent | undefined;
	portal: Doc<"portals">;
}): Omit<PublicPortalLandingPage, "featuredListings"> {
	const brandLabel =
		args.broker?.brokerageName ??
		(args.portal.portalType === "fairlend"
			? "FairLend"
			: titleCaseSlug(args.portal.slug));
	const license = buildBrokerLicense(args.broker);
	const baseArgs = { brandLabel, content: args.content, portal: args.portal };

	return {
		brand: buildBrand({ brandLabel, content: args.content }),
		broker: {
			brokerageName: args.broker?.brokerageName ?? null,
			license,
		},
		financingStrip: buildFinancingStrip(args.content),
		hero: buildHero(baseArgs),
		navigation: buildNavigation(baseArgs),
		portal: {
			defaultPostAuthPath: args.portal.defaultPostAuthPath ?? null,
			localHost: args.portal.localHost,
			portalId: args.portal._id,
			portalType: args.portal.portalType,
			productionHost: args.portal.productionHost,
			slug: args.portal.slug,
		},
		switchboard: buildSwitchboard(baseArgs),
		theme: buildTheme(args.content),
		trustStrip: {
			items:
				args.content?.trustStrip && args.content.trustStrip.length > 0
					? args.content.trustStrip
					: buildDefaultTrustItems({ brandLabel, license }),
		},
	};
}

function toLandingListingItem(
	listing: Awaited<
		ReturnType<typeof listMarketplaceListingsSnapshot>
	>["page"][number]
): LandingListing {
	const statusLabel =
		listing.availability.lockedPercent > 0 ||
		(listing.availability.availablePercent > 0 &&
			listing.availability.availablePercent < 100)
			? "Filling"
			: "Active";

	return {
		amountLabel: formatCurrency(listing.principal),
		action: lenderHandoffAction(
			`Continue with ${listing.title}`,
			"featured-listing",
			listing.id
		),
		heroImageUrl: listing.heroImageUrl,
		id: listing.id,
		ltvLabel: `${formatPercent(listing.ltvRatio)} LTV`,
		mortgagePositionLabel: mortgagePositionLabel(listing.mortgageTypeLabel),
		propertyTypeLabel: listing.propertyTypeLabel,
		rateLabel: formatPercent(listing.interestRate),
		statusLabel,
		termLabel: `${String(listing.termMonths)} mo`,
		title: listing.title,
	};
}

async function buildFeaturedListings(args: {
	content: PortalLandingPageContent | undefined;
	ctx: Pick<QueryCtx, "db" | "storage">;
	portal: Doc<"portals">;
}): Promise<PublicPortalLandingPage["featuredListings"]> {
	const requestedVisibleCardCount = Math.max(
		0,
		Math.floor(
			args.content?.featuredListings?.visibleCardCount ??
				DEFAULT_LANDING_VISIBLE_CARD_COUNT
		)
	);
	const portalTeaserLimit = Math.max(
		0,
		Math.floor(
			args.portal.teaserListingLimit ?? DEFAULT_LANDING_VISIBLE_CARD_COUNT
		)
	);
	const visibleCardCount = Math.min(
		requestedVisibleCardCount,
		portalTeaserLimit,
		MAX_LANDING_VISIBLE_CARD_COUNT
	);
	const fallback = {
		enabled: args.portal.publicTeaserEnabled,
		hasBlurredContinuation: false,
		items: [],
		label: args.content?.featuredListings?.label ?? "Featured Listings",
		subcopy:
			args.content?.featuredListings?.subcopy ??
			"Currently available mortgage investment opportunities",
		viewAllAction: lenderHandoffAction(
			args.content?.featuredListings?.viewAllAction?.label ?? "View All",
			"view-all"
		),
		visibleCardCount,
	};

	if (!(args.portal.publicTeaserEnabled && visibleCardCount > 0)) {
		return fallback;
	}

	const pricingSelection = await loadPortalPricingSelection(args.ctx, {
		atTime: Date.now(),
		portalId: args.portal._id,
	});
	if (pricingSelection.kind !== "ready") {
		return fallback;
	}

	const queryArgs: MarketplaceListingsSnapshotArgs = {
		numItems: visibleCardCount,
	};
	const snapshot = await listMarketplaceListingsSnapshot(args.ctx, queryArgs, {
		pageSizeCap: visibleCardCount,
		pricingPolicy: pricingSelection.policy,
	});

	return {
		...fallback,
		hasBlurredContinuation: !snapshot.isDone,
		items: snapshot.page.map(toLandingListingItem),
	};
}

async function resolvePortalAvailability(
	ctx: PortalReaderCtx,
	portal: Doc<"portals">
) {
	if (portal.portalType === "mic" && !portal.micLenderAuthId?.trim()) {
		return "misconfigured";
	}

	const pricingSelection =
		portal.isPublished && portal.status === "active"
			? await loadPortalPricingSelection(ctx, {
					atTime: Date.now(),
					portal,
					portalId: portal._id,
				})
			: undefined;

	return resolvePublishedPortalAvailability({
		isPublished: portal.isPublished,
		portalType: portal.portalType,
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

export const getPublicPortalLandingPage = convex
	.query()
	.input({ portalId: v.id("portals") })
	.handler(async (ctx, args): Promise<PublicPortalLandingPage | null> => {
		const portal = await ctx.db.get(args.portalId);
		if (!portal) {
			return null;
		}
		if ((await resolvePortalAvailability(ctx, portal)) !== "active") {
			return null;
		}

		const [broker, content] = await Promise.all([
			portal.brokerId ? ctx.db.get(portal.brokerId) : Promise.resolve(null),
			getPortalLandingPageContent(ctx, portal),
		]);
		const contract = buildLandingFallbacks({
			broker,
			content,
			portal,
		});

		return {
			...contract,
			featuredListings: await buildFeaturedListings({
				content,
				ctx,
				portal,
			}),
		};
	})
	.public();
