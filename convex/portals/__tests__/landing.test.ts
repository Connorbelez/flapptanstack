import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { deriveMarketplacePropertyType } from "../../listings/marketplaceShared";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";

const modules = convexModules;

function createHarness() {
	return convexTest(schema, modules);
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

	it("projects featured teaser listings through portal pricing", async () => {
		const t = createHarness();
		const portalId = await insertPortal(t, { teaserListingLimit: 3 });
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
		expect(landing?.featuredListings.hasBlurredContinuation).toBe(true);
	});
});
