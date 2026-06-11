import { describe, expect, it } from "vitest";
import { createTestConvex } from "../../../src/test/auth/helpers";
import {
	EXTERNAL_ORG_ADMIN,
	FAIRLEND_ADMIN,
} from "../../../src/test/auth/identities";
import { api, components } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { deriveMarketplacePropertyType } from "../../listings/marketplaceShared";

const FEATURED_LISTING_HANDOFF_HREF_PATTERN =
	/^\/start-lending\?source=featured-listing&listingId=/;

function createHarness() {
	return createTestConvex();
}

async function insertBroker(t: ReturnType<typeof createHarness>) {
	return await t.run(async (ctx) => {
		const now = 1_710_000_000_000;
		const userId = await ctx.db.insert("users", {
			authId: "broker-meridian",
			email: "broker-meridian@fairlend.test",
			firstName: "Meridian",
			lastName: "Broker",
		});

		return await ctx.db.insert("brokers", {
			brokerageName: "Meridian Capital",
			createdAt: now,
			lastTransitionAt: undefined,
			licenseId: "12847",
			licenseProvince: "FSRA",
			orgId: "org_meridian",
			status: "active",
			userId,
		});
	});
}

async function insertPortal(
	t: ReturnType<typeof createHarness>,
	overrides: Partial<Omit<Doc<"portals">, "_creationTime" | "_id">> = {}
) {
	return await t.run(async (ctx) => {
		const now = 1_710_000_000_000;
		const portalId = await ctx.db.insert("portals", {
			brokerId: undefined,
			createdAt: now,
			defaultPostAuthPath: "/",
			isPublished: true,
			landingPageId: undefined,
			localHost: "meridian.localhost:3000",
			orgId: "org_meridian",
			portalType: "broker",
			pricingPolicyId: undefined,
			productionHost: "meridian.fairlend.ca",
			publicTeaserEnabled: true,
			slug: "meridian",
			status: "active",
			teaserListingLimit: 12,
			updatedAt: now,
			...overrides,
		});
		const policyId = await ctx.db.insert("portalPricingPolicies", {
			brokerSplitPercent: 10,
			createdAt: now,
			effectiveFrom: now - 1000,
			effectiveTo: undefined,
			portalId,
			status: "active",
			updatedAt: now,
		});
		await ctx.db.patch(portalId, {
			pricingPolicyId: policyId,
			updatedAt: now,
		});

		return portalId;
	});
}

async function insertLandingContent(
	t: ReturnType<typeof createHarness>,
	portalId: Id<"portals">,
	overrides: Partial<
		NonNullable<Doc<"portalLandingPages">["v1LandingContent"]>
	> = {}
) {
	return await t.run(async (ctx) => {
		const now = 1_710_000_000_000;
		const landingPageId = await ctx.db.insert("portalLandingPages", {
			createdAt: now,
			portalId,
			updatedAt: now,
			v1LandingContent: {
				brand: overrides.brand,
				featuredListings: {
					subcopy: "Curated mortgage opportunities",
					...overrides.featuredListings,
				},
				hero: {
					headline: "Broker capital, cleanly routed.",
					...overrides.hero,
				},
				switchboard: {
					borrower: {
						secondaryActions: [
							{ href: "/financing/start", label: "Borrower intake" },
							{
								href: "/financing/pre-approval",
								label: "Jump to pre-approval",
							},
						],
						...overrides.switchboard?.borrower,
					},
					intro: overrides.switchboard?.intro,
					lender: overrides.switchboard?.lender,
				},
				theme: overrides.theme,
				trustStrip: overrides.trustStrip ?? [
					{ label: "FSRA Licensed #12847" },
					{ label: "12 Years Experience" },
				],
			},
		});
		await ctx.db.patch(portalId, { landingPageId, updatedAt: now });
		return landingPageId;
	});
}

function buildListingDoc(
	overrides: Partial<Omit<Doc<"listings">, "_creationTime" | "_id">> = {}
): Omit<Doc<"listings">, "_creationTime" | "_id"> {
	const propertyType = overrides.propertyType ?? "residential";

	return {
		adminNotes: undefined,
		approximateLatitude: undefined,
		approximateLongitude: undefined,
		borrowerSignal: undefined,
		city: "Toronto",
		createdAt: 1_710_000_000_000,
		dataSource: "mortgage_pipeline",
		delistReason: undefined,
		delistedAt: undefined,
		description: "Listing description",
		displayOrder: undefined,
		featured: true,
		heroImages: [],
		interestRate: 10,
		lastTransitionAt: undefined,
		lienPosition: 1,
		loanType: "conventional",
		ltvRatio: 0.65,
		machineContext: undefined,
		marketplaceCopy: "Marketplace copy",
		marketplacePropertyType: deriveMarketplacePropertyType(propertyType),
		maturityDate: "2027-01-01",
		monthlyPayment: 1000,
		mortgageId: undefined,
		paymentFrequency: "monthly",
		paymentHistory: undefined,
		principal: 450_000,
		propertyId: undefined,
		propertyType,
		province: "ON",
		publicDocumentIds: [],
		publishedAt: 1_710_000_000_000,
		rateType: "fixed",
		seoSlug: undefined,
		status: "published",
		termMonths: 24,
		title: "Detached Home, North York",
		updatedAt: 1_710_000_000_000,
		viewCount: 0,
		...overrides,
	};
}

async function insertPublishedListings(
	t: ReturnType<typeof createHarness>,
	count: number
) {
	await t.run(async (ctx) => {
		for (let index = 0; index < count; index += 1) {
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					displayOrder: index,
					lienPosition: index === 1 ? 2 : 1,
					title: `Listing ${String(index + 1)}`,
				})
			);
		}
	});
}

describe("public portal landing contract", () => {
	it("returns deterministic broker fallback copy with nested pre-approval", async () => {
		const t = createHarness();
		const brokerId = await insertBroker(t);
		const portalId = await insertPortal(t, { brokerId });

		const landing = await t.query(
			api.portals.queries.getPublicPortalLandingPage,
			{
				portalId,
			}
		);

		expect(landing?.navigation.brandLabel).toBe("Meridian Capital");
		expect(landing?.broker.license?.label).toBe("FSRA Licensed #12847");
		expect(landing?.switchboard.lender.label).toBe("Lender");
		expect(landing?.switchboard.lender.primaryAction).toEqual({
			href: "/start-lending?source=switchboard",
			label: "Browse current listings",
		});
		expect(landing?.switchboard.borrower.label).toBe(
			"Borrower / Mortgage Applicant"
		);
		expect(landing?.switchboard.borrower.nestedActions).toEqual([
			{ href: "/financing/start", label: "Borrower intake" },
			{ href: "/financing/pre-approval", label: "Jump to pre-approval" },
		]);
	});

	it("applies thin optional landing copy without changing the contract shape", async () => {
		const t = createHarness();
		const brokerId = await insertBroker(t);
		const portalId = await insertPortal(t, { brokerId });
		await insertLandingContent(t, portalId);

		const landing = await t.query(
			api.portals.queries.getPublicPortalLandingPage,
			{
				portalId,
			}
		);

		expect(landing?.hero.headline).toBe("Broker capital, cleanly routed.");
		expect(landing?.trustStrip.items).toEqual([
			{ label: "FSRA Licensed #12847" },
			{ label: "12 Years Experience" },
		]);
		expect(landing?.featuredListings.subcopy).toBe(
			"Curated mortgage opportunities"
		);
		expect(landing?.switchboard.borrower.nestedActions[1]).toEqual({
			href: "/financing/pre-approval",
			label: "Jump to pre-approval",
		});
	});

	it("projects constrained brand and theme overrides with deterministic fallbacks", async () => {
		const t = createHarness();
		const brokerId = await insertBroker(t);
		const portalId = await insertPortal(t, { brokerId });
		await insertLandingContent(t, portalId, {
			brand: {
				logoAlt: "Meridian crest",
				logoUrl: "/logos/meridian.svg",
			},
			theme: {
				accentColor: "#0f766e",
				backgroundColor: "#f8fafc",
				primaryColor: "#1d4ed8",
				primaryHoverColor: "#1e40af",
				textColor: "#111827",
			},
		});

		const landing = await t.query(
			api.portals.queries.getPublicPortalLandingPage,
			{
				portalId,
			}
		);

		expect(landing?.brand).toEqual({
			logoAlt: "Meridian crest",
			logoUrl: "/logos/meridian.svg",
		});
		expect(landing?.theme).toMatchObject({
			accentColor: "#0f766e",
			backgroundColor: "#f8fafc",
			borderColor: "#e7e5e4",
			mutedTextColor: "#57534e",
			primaryColor: "#1d4ed8",
			primaryHoverColor: "#1e40af",
			surfaceColor: "#ffffff",
			textColor: "#111827",
		});
	});

	it("keeps lender-owned landing actions on the canonical handoff even when content has stale hrefs", async () => {
		const t = createHarness();
		const brokerId = await insertBroker(t);
		const portalId = await insertPortal(t, { brokerId });
		await insertLandingContent(t, portalId, {
			featuredListings: {
				viewAllAction: { href: "/stale-listings", label: "See all deals" },
			},
			switchboard: {
				lender: {
					primaryAction: {
						href: "/stale-lender-path",
						label: "Review opportunities",
					},
				},
			},
		});

		const landing = await t.query(
			api.portals.queries.getPublicPortalLandingPage,
			{
				portalId,
			}
		);

		expect(landing?.switchboard.lender.primaryAction).toEqual({
			href: "/start-lending?source=switchboard",
			label: "Review opportunities",
		});
		expect(landing?.featuredListings.viewAllAction).toEqual({
			href: "/start-lending?source=view-all",
			label: "See all deals",
		});
	});

	it("uses the same contract shape for the FairLend app portal", async () => {
		const t = createHarness();
		const portalId = await insertPortal(t, {
			brokerId: undefined,
			localHost: "app.localhost:3000",
			orgId: "org_fairlend_staff",
			portalType: "fairlend",
			productionHost: "app.fairlend.ca",
			slug: "app",
		});

		const landing = await t.query(
			api.portals.queries.getPublicPortalLandingPage,
			{
				portalId,
			}
		);

		expect(landing?.navigation.brandLabel).toBe("FairLend");
		expect(landing?.navigation.poweredByLabel).toBe(
			"Private mortgage marketplace"
		);
		expect(landing?.portal.portalType).toBe("fairlend");
		expect(landing?.switchboard.borrower.primaryAction.href).toBe(
			"/financing/start"
		);
		expect(landing?.switchboard.lender.primaryAction).toEqual({
			href: "/listings",
			label: "Browse current listings",
		});
	});

	it("returns disabled teaser metadata without listing items", async () => {
		const t = createHarness();
		const portalId = await insertPortal(t, { publicTeaserEnabled: false });
		await insertPublishedListings(t, 2);

		const landing = await t.query(
			api.portals.queries.getPublicPortalLandingPage,
			{
				portalId,
			}
		);

		expect(landing?.featuredListings.enabled).toBe(false);
		expect(landing?.featuredListings.items).toEqual([]);
		expect(landing?.featuredListings.visibleCardCount).toBe(3);
	});

	it("returns null for unpublished or inactive public portals", async () => {
		const t = createHarness();
		const unpublishedPortalId = await insertPortal(t, {
			isPublished: false,
			slug: "unpublished-meridian",
		});
		const suspendedPortalId = await insertPortal(t, {
			localHost: "suspended.localhost:3000",
			productionHost: "suspended.fairlend.ca",
			slug: "suspended-meridian",
			status: "suspended",
		});
		await insertPublishedListings(t, 2);

		await expect(
			t.query(api.portals.queries.getPublicPortalLandingPage, {
				portalId: unpublishedPortalId,
			})
		).resolves.toBeNull();
		await expect(
			t.query(api.portals.queries.getPublicPortalLandingPage, {
				portalId: suspendedPortalId,
			})
		).resolves.toBeNull();
	});

	it("caps featured teaser listings by the portal teaser limit", async () => {
		const t = createHarness();
		const portalId = await insertPortal(t, { teaserListingLimit: 1 });
		await insertLandingContent(t, portalId, {
			featuredListings: {
				visibleCardCount: 3,
			},
		});
		await insertPublishedListings(t, 4);

		const landing = await t.query(
			api.portals.queries.getPublicPortalLandingPage,
			{
				portalId,
			}
		);

		expect(landing?.featuredListings.items).toHaveLength(1);
		expect(landing?.featuredListings.visibleCardCount).toBe(1);
		expect(landing?.featuredListings.hasBlurredContinuation).toBe(true);
	});

	it("allows a zero teaser limit without exposing listing items", async () => {
		const t = createHarness();
		const portalId = await insertPortal(t, { teaserListingLimit: 0 });
		await insertPublishedListings(t, 2);

		const landing = await t.query(
			api.portals.queries.getPublicPortalLandingPage,
			{
				portalId,
			}
		);

		expect(landing?.featuredListings.enabled).toBe(true);
		expect(landing?.featuredListings.items).toEqual([]);
		expect(landing?.featuredListings.visibleCardCount).toBe(0);
	});

	it("rejects unsafe stored landing CTA hrefs", async () => {
		const t = createHarness();
		const portalId = await insertPortal(t);
		await insertLandingContent(t, portalId, {
			hero: {
				primaryAction: {
					href: "javascript:alert(1)",
					label: "Unsafe",
				},
			},
		});

		await expect(
			t.query(api.portals.queries.getPublicPortalLandingPage, {
				portalId,
			})
		).rejects.toThrow("Unsafe portal landing href");
	});

	it("rejects stored landing hrefs with browser-normalized backslashes", async () => {
		const t = createHarness();
		const portalId = await insertPortal(t);
		await insertLandingContent(t, portalId, {
			hero: {
				primaryAction: {
					href: "/\\evil.example/path",
					label: "Unsafe",
				},
			},
		});

		await expect(
			t.query(api.portals.queries.getPublicPortalLandingPage, {
				portalId,
			})
		).rejects.toThrow("Unsafe portal landing href");
	});

	it("rejects unsafe stored landing theme and brand values", async () => {
		const t = createHarness();
		const portalId = await insertPortal(t);
		await insertLandingContent(t, portalId, {
			brand: {
				logoUrl: "javascript:alert(1)",
			},
			theme: {
				primaryColor: "url(javascript:alert(1))",
			},
		});

		await expect(
			t.query(api.portals.queries.getPublicPortalLandingPage, {
				portalId,
			})
		).rejects.toThrow("Unsafe portal landing image URL");
	});

	it("rejects unsafe stored landing color tokens", async () => {
		const t = createHarness();
		const portalId = await insertPortal(t);
		await insertLandingContent(t, portalId, {
			theme: {
				primaryColor: "url(javascript:alert(1))",
			},
		});

		await expect(
			t.query(api.portals.queries.getPublicPortalLandingPage, {
				portalId,
			})
		).rejects.toThrow("Unsafe portal landing color token");
	});

	it("lets FairLend staff upsert constrained landing customization", async () => {
		const t = createHarness();
		const portalId = await insertPortal(t);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);

		const landingPageId = await asAdmin.mutation(
			api.portals.landingMutations.upsertPortalLandingPageContent,
			{
				content: {
					brand: {
						logoAlt: "Meridian mark",
						logoUrl: "https://cdn.fairlend.ca/meridian.svg",
					},
					hero: {
						headline: "Meridian private mortgage access.",
					},
					theme: {
						primaryColor: "#0f766e",
					},
					trustStrip: [{ label: "FSRA Licensed #12847" }],
				},
				portalId,
			}
		);

		const landing = await t.query(
			api.portals.queries.getPublicPortalLandingPage,
			{
				portalId,
			}
		);

		expect(landingPageId).toBeDefined();
		expect(landing?.brand.logoUrl).toBe("https://cdn.fairlend.ca/meridian.svg");
		expect(landing?.hero.headline).toBe("Meridian private mortgage access.");
		expect(landing?.theme.primaryColor).toBe("#0f766e");
		expect(landing?.trustStrip.items).toEqual([
			{ label: "FSRA Licensed #12847" },
		]);

		const auditEntries = await t.query(
			components.auditLog.lib.queryByResource,
			{
				resourceId: landingPageId,
				resourceType: "portalLandingPages",
			}
		);
		const createEntry = auditEntries.find(
			(entry: { action: string }) =>
				entry.action === "portal.landing_page_content.created"
		);
		expect(createEntry).toBeDefined();
		expect(createEntry?.actorId).toBe(FAIRLEND_ADMIN.subject);
		expect(createEntry?.metadata).toMatchObject({
			portalId,
			portalSlug: "meridian",
			providedSections: ["brand", "hero", "theme", "trustStrip"],
			relinkedPortalLandingPage: true,
		});
	});

	it("merges staff landing customization updates without erasing omitted groups", async () => {
		const t = createHarness();
		const portalId = await insertPortal(t);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const landingPageId = await insertLandingContent(t, portalId, {
			brand: {
				logoAlt: "Original mark",
				logoUrl: "/logos/original.svg",
			},
			hero: {
				body: "Existing body",
				headline: "Existing headline",
			},
			theme: {
				accentColor: "#0f766e",
				primaryColor: "#134e4a",
			},
			trustStrip: [{ label: "Existing trust" }],
		});

		const returnedId = await asAdmin.mutation(
			api.portals.landingMutations.upsertPortalLandingPageContent,
			{
				content: {
					hero: {
						headline: "Updated headline",
					},
					theme: {
						primaryColor: "#1d4ed8",
					},
				},
				portalId,
			}
		);

		const rows = await t.run(async (ctx) =>
			ctx.db
				.query("portalLandingPages")
				.withIndex("by_portal", (query) => query.eq("portalId", portalId))
				.collect()
		);
		const landing = await t.query(
			api.portals.queries.getPublicPortalLandingPage,
			{
				portalId,
			}
		);
		const auditEntries = await t.query(
			components.auditLog.lib.queryByResource,
			{
				resourceId: landingPageId,
				resourceType: "portalLandingPages",
			}
		);
		const updateEntry = auditEntries.find(
			(entry: { action: string }) =>
				entry.action === "portal.landing_page_content.updated"
		);

		expect(returnedId).toBe(landingPageId);
		expect(rows).toHaveLength(1);
		expect(landing?.brand).toEqual({
			logoAlt: "Original mark",
			logoUrl: "/logos/original.svg",
		});
		expect(landing?.hero.body).toBe("Existing body");
		expect(landing?.hero.headline).toBe("Updated headline");
		expect(landing?.theme.accentColor).toBe("#0f766e");
		expect(landing?.theme.primaryColor).toBe("#1d4ed8");
		expect(landing?.trustStrip.items).toEqual([{ label: "Existing trust" }]);
		expect(updateEntry).toBeDefined();
		expect(updateEntry?.actorId).toBe(FAIRLEND_ADMIN.subject);
		expect(updateEntry?.metadata).toMatchObject({
			portalId,
			portalSlug: "meridian",
			providedSections: ["hero", "theme"],
			relinkedPortalLandingPage: false,
		});
	});

	it("blocks non-FairLend admins from staff landing customization", async () => {
		const t = createHarness();
		const portalId = await insertPortal(t);

		await expect(
			t
				.withIdentity(EXTERNAL_ORG_ADMIN)
				.mutation(api.portals.landingMutations.upsertPortalLandingPageContent, {
					content: {
						hero: {
							headline: "External edit",
						},
					},
					portalId,
				})
		).rejects.toThrow("Forbidden: fair lend admin role required");
	});

	it("projects featured teaser listings through portal pricing", async () => {
		const t = createHarness();
		const brokerId = await insertBroker(t);
		const portalId = await insertPortal(t, { brokerId, teaserListingLimit: 3 });
		await insertPublishedListings(t, 4);

		const landing = await t.query(
			api.portals.queries.getPublicPortalLandingPage,
			{
				portalId,
			}
		);

		expect(landing?.featuredListings.enabled).toBe(true);
		expect(landing?.featuredListings.items).toHaveLength(3);
		expect(landing?.featuredListings.items[0]).toMatchObject({
			action: {
				href: expect.stringMatching(FEATURED_LISTING_HANDOFF_HREF_PATTERN),
				label: "Continue with Listing 1",
			},
			amountLabel: "$450,000",
			ltvLabel: "65% LTV",
			mortgagePositionLabel: "1st",
			rateLabel: "9%",
			termLabel: "24 mo",
			title: "Listing 1",
		});
		expect(landing?.featuredListings.items[1]?.mortgagePositionLabel).toBe(
			"2nd"
		);
		expect(landing?.featuredListings.viewAllAction).toEqual({
			href: "/start-lending?source=view-all",
			label: "View All",
		});
		expect(landing?.featuredListings.hasBlurredContinuation).toBe(true);
	});
});
