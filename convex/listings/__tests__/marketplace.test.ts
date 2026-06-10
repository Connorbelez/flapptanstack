import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { seedFromIdentity } from "../../../src/test/auth/helpers";
import { LENDER } from "../../../src/test/auth/identities";
import type { Doc } from "../../_generated/dataModel";
import { FAIRLEND_STAFF_ORG_ID } from "../../constants";
import { FAIRLEND_MIC_LENDER_EMAIL } from "../../platform/defaultOriginationOwnerContract";
import schema from "../../schema";
import { seedAuthIdFromEmail } from "../../seed/seedHelpers";
import { convexModules } from "../../test/moduleMaps";
import { deriveMarketplacePropertyType } from "../marketplaceShared";

const modules = convexModules;
const listingApi = anyApi.listings.marketplace;
const platformLawyersApi = anyApi.legalRepresentation.platformLawyers;
const publicDocumentsApi = anyApi.listings.publicDocuments;
const CANONICAL_MIC_LENDER_AUTH_ID = seedAuthIdFromEmail(
	FAIRLEND_MIC_LENDER_EMAIL
);

function createHarness() {
	return convexTest(schema, modules);
}

function listingViewer(t: ReturnType<typeof createHarness>) {
	return t.withIdentity({
		subject: "listing-viewer",
		issuer: "https://api.workos.com",
		org_id: "org_listing_viewer",
		role: "lender",
		roles: JSON.stringify(["lender"]),
		permissions: JSON.stringify(["listing:view"]),
		user_email: "listing-viewer@fairlend.ca",
		user_first_name: "Listing",
		user_last_name: "Viewer",
	});
}

function fairlendAdmin(t: ReturnType<typeof createHarness>) {
	return t.withIdentity({
		subject: "marketplace-admin",
		issuer: "https://api.workos.com",
		org_id: FAIRLEND_STAFF_ORG_ID,
		role: "admin",
		roles: JSON.stringify(["admin"]),
		permissions: JSON.stringify(["admin:access", "listing:view"]),
		user_email: "marketplace-admin@fairlend.ca",
		user_first_name: "Marketplace",
		user_last_name: "Admin",
	});
}

function publicDocumentViewer(t: ReturnType<typeof createHarness>) {
	return t.withIdentity({
		subject: "public-document-viewer",
		issuer: "https://api.workos.com",
		org_id: "org_public_document_viewer",
		role: "lawyer",
		roles: JSON.stringify(["lawyer"]),
		permissions: JSON.stringify([]),
		user_email: "public-document-viewer@fairlend.ca",
		user_first_name: "Public",
		user_last_name: "Viewer",
	});
}

function memberViewer(t: ReturnType<typeof createHarness>) {
	return t.withIdentity({
		subject: "member-user",
		issuer: "https://api.workos.com",
		org_id: "org_member",
		role: "member",
		roles: JSON.stringify(["member"]),
		permissions: JSON.stringify([]),
		user_email: "member@fairlend.ca",
		user_first_name: "Member",
		user_last_name: "Viewer",
	});
}

async function insertMortgageFixture(t: ReturnType<typeof createHarness>) {
	return await t.run(async (ctx) => {
		const timestamp = Date.now();
		const userId = await ctx.db.insert("users", {
			authId: `marketplace_broker_${timestamp}`,
			email: `marketplace-broker-${timestamp}@test.fairlend.ca`,
			firstName: "Marketplace",
			lastName: "Broker",
		});

		const brokerId = await ctx.db.insert("brokers", {
			createdAt: Date.now(),
			lastTransitionAt: undefined,
			status: "active",
			userId,
		});

		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: Date.now(),
			propertyType: "residential",
			province: "ON",
			postalCode: "M5V1E3",
			streetAddress: "123 King St W",
		});

		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 240,
			assignedBrokerId: undefined,
			brokerOfRecordId: brokerId,
			createdAt: Date.now(),
			firstPaymentDate: "2026-02-01",
			fundedAt: undefined,
			interestAdjustmentDate: "2026-01-01",
			interestRate: 8.5,
			isRenewal: undefined,
			lastTransitionAt: undefined,
			lienPosition: 1,
			loanType: "conventional",
			machineContext: undefined,
			maturityDate: "2027-01-01",
			orgId: undefined,
			paymentAmount: 1200,
			paymentFrequency: "monthly",
			principal: 250_000,
			priorMortgageId: undefined,
			propertyId,
			rateType: "fixed",
			simulationId: undefined,
			status: "active",
			termMonths: 12,
			termStartDate: "2026-01-01",
		});

		return { mortgageId, propertyId };
	});
}

async function insertBrokerPortalPricingFixture(
	t: ReturnType<typeof createHarness>,
	brokerSplitPercent = 10
) {
	return await t.run(async (ctx) => {
		const portalId = await ctx.db.insert("portals", {
			brokerId: undefined,
			createdAt: 1_710_000_500_000,
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
			updatedAt: 1_710_000_500_000,
		});
		const policyId = await ctx.db.insert("portalPricingPolicies", {
			brokerSplitPercent,
			createdAt: 1_710_000_500_000,
			effectiveFrom: 1_710_000_495_000,
			effectiveTo: undefined,
			portalId,
			status: "active",
			updatedAt: 1_710_000_500_000,
		});
		await ctx.db.patch(portalId, {
			pricingPolicyId: policyId,
			updatedAt: 1_710_000_500_000,
		});
		return portalId;
	});
}

async function insertPortalLenderFixture(t: ReturnType<typeof createHarness>) {
	await seedFromIdentity(t, LENDER);

	return await t.run(async (ctx) => {
		const lenderUser = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", LENDER.subject))
			.unique();
		if (!(lenderUser && LENDER.org_id)) {
			throw new Error("Expected seeded lender identity with org context");
		}

		const brokerId = await ctx.db.insert("brokers", {
			createdAt: 1_710_000_500_000,
			orgId: LENDER.org_id,
			status: "active",
			userId: lenderUser._id,
		});
		const lenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: 1_710_000_500_000,
			onboardingEntryPath: "self_signup",
			orgId: LENDER.org_id,
			status: "active",
			userId: lenderUser._id,
		});
		const portalId = await ctx.db.insert("portals", {
			brokerId,
			createdAt: 1_710_000_500_000,
			defaultPostAuthPath: "/listings",
			isPublished: true,
			landingPageId: undefined,
			localHost: "meridian.localhost:3000",
			orgId: LENDER.org_id,
			portalType: "broker",
			pricingPolicyId: undefined,
			productionHost: "meridian.fairlend.ca",
			publicTeaserEnabled: true,
			slug: "meridian",
			status: "active",
			teaserListingLimit: 12,
			updatedAt: 1_710_000_500_000,
		});
		const policyId = await ctx.db.insert("portalPricingPolicies", {
			brokerSplitPercent: 12.5,
			createdAt: 1_710_000_500_000,
			effectiveFrom: 1_710_000_495_000,
			effectiveTo: undefined,
			portalId,
			status: "active",
			updatedAt: 1_710_000_500_000,
		});

		await ctx.db.patch(portalId, {
			pricingPolicyId: policyId,
			updatedAt: 1_710_000_500_000,
		});
		await ctx.db.patch(lenderUser._id, {
			homePortalId: portalId,
		});

		return { brokerId, lenderId, portalId };
	});
}

function buildListingDoc(
	overrides: Partial<Omit<Doc<"listings">, "_creationTime" | "_id">> = {}
): Omit<Doc<"listings">, "_creationTime" | "_id"> {
	const propertyType = overrides.propertyType ?? "residential";
	const marketplacePropertyType =
		overrides.marketplacePropertyType ??
		deriveMarketplacePropertyType(propertyType);

	return {
		adminNotes: undefined,
		approximateLatitude: 43.6532,
		approximateLongitude: -79.3832,
		borrowerSignal: undefined,
		city: "Toronto",
		createdAt: 1_710_000_000_000,
		dataSource: "mortgage_pipeline",
		delistReason: undefined,
		delistedAt: undefined,
		description: "Listing description",
		displayOrder: undefined,
		featured: false,
		heroImages: [],
		interestRate: 8.5,
		lastTransitionAt: undefined,
		lienPosition: 1,
		loanType: "conventional",
		ltvRatio: 65,
		machineContext: undefined,
		marketplaceCopy: "Marketplace copy",
		maturityDate: "2027-01-01",
		monthlyPayment: 1250,
		mortgageId: undefined,
		paymentFrequency: "monthly",
		paymentHistory: undefined,
		principal: 250_000,
		propertyId: undefined,
		propertyType,
		marketplacePropertyType,
		province: "ON",
		publicDocumentIds: [],
		publishedAt: 1_710_000_000_000,
		rateType: "fixed",
		seoSlug: undefined,
		status: "published",
		termMonths: 12,
		title: "Toronto Income Property",
		updatedAt: 1_710_000_000_000,
		viewCount: 10,
		...overrides,
	};
}

describe("marketplace listings", () => {
	it("requires listing:view for marketplace reads", async () => {
		const t = createHarness();
		const portalId = await insertBrokerPortalPricingFixture(t);
		const viewerWithoutListingView = memberViewer(t);

		await expect(
			viewerWithoutListingView.query(listingApi.listMarketplaceListings, {
				cursor: null,
				numItems: 20,
				portalId,
			})
		).rejects.toThrow('permission "listing:view" required');
	});

	it("allows public listing documents for authenticated non-member roles without listing:view", async () => {
		const t = createHarness();
		const auth = publicDocumentViewer(t);

		let listingId!: Doc<"listings">["_id"];
		await t.run(async (ctx) => {
			listingId = await ctx.db.insert("listings", buildListingDoc());
		});

		const documents = await auth.query(publicDocumentsApi.listForListing, {
			listingId,
		});

		expect(documents).toEqual([]);
	});

	it("denies public listing documents for member-only users", async () => {
		const t = createHarness();
		const auth = memberViewer(t);

		let listingId!: Doc<"listings">["_id"];
		await t.run(async (ctx) => {
			listingId = await ctx.db.insert("listings", buildListingDoc());
		});

		await expect(
			auth.query(publicDocumentsApi.listForListing, {
				listingId,
			})
		).rejects.toThrow("public document access required");
	});

	it("filters by the stored marketplace property type", async () => {
		const t = createHarness();
		const portalId = await insertBrokerPortalPricingFixture(t);
		const auth = listingViewer(t);

		await t.run(async (ctx) => {
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					propertyType: "multi_unit",
					title: "Duplex Listing",
				})
			);
		});

		const result = await auth.query(listingApi.listMarketplaceListings, {
			cursor: null,
			filters: {
				propertyTypes: ["Duplex"],
			},
			numItems: 20,
			portalId,
		});

		expect(result.page).toHaveLength(1);
		expect(result.page[0]?.propertyTypeLabel).toBe("Duplex");
	});

	it("searches, filters by mortgage type, and keeps featured rows first", async () => {
		const t = createHarness();
		const portalId = await insertBrokerPortalPricingFixture(t);
		const auth = listingViewer(t);

		await t.run(async (ctx) => {
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					city: "Toronto",
					displayOrder: 1,
					featured: true,
					lienPosition: 1,
					propertyType: "multi_unit",
					title: "Featured Toronto First",
				})
			);
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					city: "Toronto",
					displayOrder: 99,
					featured: false,
					lienPosition: 2,
					propertyType: "multi_unit",
					title: "Standard Toronto Second",
				})
			);
		});

		const result = await auth.query(listingApi.listMarketplaceListings, {
			cursor: null,
			filters: {
				mortgageTypes: ["First", "Second"],
				propertyTypes: ["Duplex"],
				searchQuery: "Toronto",
			},
			numItems: 20,
			portalId,
		});

		expect(result.page.map((listing) => listing.title)).toEqual([
			"Featured Toronto First",
			"Standard Toronto Second",
		]);
		expect(result.page[0]?.mortgageTypeLabel).toBe("First");
		expect(result.page[1]?.mortgageTypeLabel).toBe("Second");
	});

	it("filters marketplace rows by availability percent and derived minimum investment", async () => {
		const t = createHarness();
		const portalId = await insertBrokerPortalPricingFixture(t);
		const auth = listingViewer(t);

		await t.run(async (ctx) => {
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					principal: 250_000,
					title: "Low minimum investment",
				})
			);
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					principal: 500_000,
					title: "High minimum investment",
				})
			);
		});

		const affordable = await auth.query(listingApi.listMarketplaceListings, {
			cursor: null,
			filters: {
				availabilityPercent: { min: 90 },
				minimumInvestmentAmount: { max: 30_000 },
			},
			numItems: 20,
			portalId,
		});

		expect(affordable.page.map((listing) => listing.title)).toEqual([
			"Low minimum investment",
		]);

		const belowFullAvailability = await auth.query(
			listingApi.listMarketplaceListings,
			{
				cursor: null,
				filters: {
					availabilityPercent: { max: 90 },
				},
				numItems: 20,
				portalId,
			}
		);

		expect(belowFullAvailability.page).toHaveLength(0);
	});

	it("paginates marketplace listings with a stable cursor", async () => {
		const t = createHarness();
		const portalId = await insertBrokerPortalPricingFixture(t);
		const auth = listingViewer(t);

		await t.run(async (ctx) => {
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					displayOrder: 1,
					featured: true,
					title: "First Listing",
				})
			);
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					displayOrder: 2,
					featured: false,
					title: "Second Listing",
				})
			);
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					displayOrder: 3,
					featured: false,
					title: "Third Listing",
				})
			);
		});

		const firstPage = await auth.query(listingApi.listMarketplaceListings, {
			cursor: null,
			numItems: 2,
			portalId,
		});
		const secondPage = await auth.query(listingApi.listMarketplaceListings, {
			cursor: firstPage.continueCursor,
			numItems: 2,
			portalId,
		});

		expect(firstPage.page.map((listing) => listing.title)).toEqual([
			"First Listing",
			"Second Listing",
		]);
		expect(firstPage.isDone).toBe(false);
		expect(secondPage.page.map((listing) => listing.title)).toEqual([
			"Third Listing",
		]);
		expect(secondPage.isDone).toBe(true);
	});

	it("does not expose public documents for unpublished listings", async () => {
		const t = createHarness();
		const auth = listingViewer(t);

		let listingId!: Doc<"listings">["_id"];
		await t.run(async (ctx) => {
			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({
					status: "draft",
				})
			);
		});

		await expect(
			auth.query(publicDocumentsApi.listForListing, {
				listingId,
			})
		).rejects.toThrow("Listing not found");
	});

	it("returns a read-only marketplace detail payload", async () => {
		const t = createHarness();
		const portalId = await insertBrokerPortalPricingFixture(t);
		const auth = listingViewer(t);
		const { mortgageId, propertyId } = await insertMortgageFixture(t);

		let listingId!: Doc<"listings">["_id"];
		await t.run(async (ctx) => {
			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({
					description: "Projected lender-facing mortgage listing.",
					marketplaceCopy: "Well-located first mortgage opportunity.",
					mortgageId,
					propertyId,
					title: "King West Bridge Opportunity",
				})
			);
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					interestRate: 10,
					mortgageId,
					propertyId,
					title: "West End Similar Opportunity",
				})
			);
		});

		const result = await auth.query(listingApi.getMarketplaceListingDetail, {
			listingId,
			portalId,
		});

		expect(result?.listing.id).toBe(String(listingId));
		expect(result?.listing.readOnly).toBe(true);
		expect(result?.documents).toBeDefined();
		expect(result?.investment.availableFractions).toBeTypeOf("number");
		expect(result?.listing.interestRate).toBe(7.65);
		expect(result?.listing.monthlyPayment).toBe(1125);
		expect(result?.similarListings[0]?.interestRate).toBe(9);
	});

	it("uses active eligible platform lawyer profiles for marketplace checkout options", async () => {
		const t = createHarness();
		const portalId = await insertBrokerPortalPricingFixture(t);
		const auth = listingViewer(t);
		const { mortgageId, propertyId } = await insertMortgageFixture(t);

		let listingId!: Doc<"listings">["_id"];
		await t.run(async (ctx) => {
			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({
					mortgageId,
					propertyId,
					title: "Platform Lawyer Source Listing",
				})
			);
		});
		await fairlendAdmin(t).mutation(
			platformLawyersApi.seedPlatformLawyerRoster,
			{}
		);

		const result = await auth.query(listingApi.getMarketplaceListingDetail, {
			listingId,
			portalId,
		});

		expect(result?.lawyers.map((lawyer) => lawyer.displayName)).toEqual([
			"Avery Chen",
			"Morgan Patel",
		]);
		expect(result?.lawyers.map((lawyer) => lawyer.platformStatus)).toEqual([
			"active",
			"active",
		]);
		expect(result?.lawyers.map((lawyer) => lawyer.eligibilityStatus)).toEqual([
			"eligible",
			"eligible",
		]);
	});

	it("defaults canonical MIC-owned mortgages to fully available for sale", async () => {
		const t = createHarness();
		const portalId = await insertBrokerPortalPricingFixture(t);
		const auth = listingViewer(t);
		const { mortgageId, propertyId } = await insertMortgageFixture(t);

		let listingId!: Doc<"listings">["_id"];
		await t.run(async (ctx) => {
			await ctx.db.insert("ledger_accounts", {
				createdAt: 1_710_000_000_000,
				cumulativeCredits: 0n,
				cumulativeDebits: 10_000n,
				lenderId: CANONICAL_MIC_LENDER_AUTH_ID,
				mortgageId: String(mortgageId),
				pendingCredits: 0n,
				pendingDebits: 0n,
				type: "POSITION",
			});
			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({
					mortgageId,
					propertyId,
					title: "Canonical MIC Held Opportunity",
				})
			);
		});

		const result = await auth.query(listingApi.getMarketplaceListingDetail, {
			listingId,
			portalId,
		});

		expect(result?.investment.availableFractions).toBe(10_000);
		expect(result?.investment.soldPercent).toBe(0);
	});

	it("counts treasury-held mortgage fractions as FairLend MIC sale inventory", async () => {
		const t = createHarness();
		const portalId = await insertBrokerPortalPricingFixture(t);
		const auth = listingViewer(t);
		const { mortgageId, propertyId } = await insertMortgageFixture(t);

		let listingId!: Doc<"listings">["_id"];
		await t.run(async (ctx) => {
			await ctx.db.insert("ledger_accounts", {
				createdAt: 1_710_000_000_000,
				cumulativeCredits: 0n,
				cumulativeDebits: 10_000n,
				mortgageId: String(mortgageId),
				pendingCredits: 0n,
				pendingDebits: 0n,
				type: "TREASURY",
			});
			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({
					mortgageId,
					propertyId,
					title: "Treasury Held Opportunity",
				})
			);
		});

		const result = await auth.query(listingApi.getMarketplaceListingDetail, {
			listingId,
			portalId,
		});

		expect(result?.investment.availableFractions).toBe(10_000);
		expect(result?.investment.soldPercent).toBe(0);
	});

	it("aggregates treasury and MIC position sale inventory without counting non-MIC positions as available", async () => {
		const t = createHarness();
		const portalId = await insertBrokerPortalPricingFixture(t);
		const auth = listingViewer(t);
		const { mortgageId, propertyId } = await insertMortgageFixture(t);

		let listingId!: Doc<"listings">["_id"];
		await t.run(async (ctx) => {
			await ctx.db.insert("ledger_accounts", {
				createdAt: 1_710_000_000_000,
				cumulativeCredits: 2_000n,
				cumulativeDebits: 10_000n,
				mortgageId: String(mortgageId),
				pendingCredits: 0n,
				pendingDebits: 0n,
				type: "TREASURY",
			});
			await ctx.db.insert("ledger_accounts", {
				createdAt: 1_710_000_000_000,
				cumulativeCredits: 0n,
				cumulativeDebits: 1_250n,
				lenderId: CANONICAL_MIC_LENDER_AUTH_ID,
				mortgageId: String(mortgageId),
				pendingCredits: 0n,
				pendingDebits: 0n,
				type: "POSITION",
			});
			await ctx.db.insert("ledger_accounts", {
				createdAt: 1_710_000_000_000,
				cumulativeCredits: 0n,
				cumulativeDebits: 750n,
				lenderId: "private-lender-auth",
				mortgageId: String(mortgageId),
				pendingCredits: 0n,
				pendingDebits: 0n,
				type: "POSITION",
			});
			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({
					mortgageId,
					propertyId,
					title: "Mixed Inventory Opportunity",
				})
			);
		});

		const result = await auth.query(listingApi.getMarketplaceListingDetail, {
			listingId,
			portalId,
		});

		expect(result?.investment.availableFractions).toBe(9250);
		expect(result?.investment.investorCount).toBe(1);
		expect(result?.investment.soldPercent).toBe(7.5);
	});

	it("caps canonical MIC sale availability with the mortgage override", async () => {
		const t = createHarness();
		const portalId = await insertBrokerPortalPricingFixture(t);
		const auth = listingViewer(t);
		const { mortgageId, propertyId } = await insertMortgageFixture(t);

		let listingId!: Doc<"listings">["_id"];
		await t.run(async (ctx) => {
			await ctx.db.insert("ledger_accounts", {
				createdAt: 1_710_000_000_000,
				cumulativeCredits: 0n,
				cumulativeDebits: 10_000n,
				lenderId: CANONICAL_MIC_LENDER_AUTH_ID,
				mortgageId: String(mortgageId),
				pendingCredits: 0n,
				pendingDebits: 0n,
				type: "POSITION",
			});
			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({
					mortgageId,
					propertyId,
					title: "Capped MIC Held Opportunity",
				})
			);
		});

		await t.run(async (ctx) => {
			await ctx.db.insert("mortgageMicSaleAvailabilityOverrides", {
				availableLedgerUnits: 6000,
				createdAt: 1_710_000_000_000,
				mortgageId,
				reason: "Limit MIC sale allocation for staged marketplace release.",
				updatedAt: 1_710_000_000_000,
				updatedBy: "marketplace-admin",
			});
		});

		const capped = await auth.query(listingApi.getMarketplaceListingDetail, {
			listingId,
			portalId,
		});

		expect(capped?.investment.availableFractions).toBe(6000);

		await t.run(async (ctx) => {
			const override = await ctx.db
				.query("mortgageMicSaleAvailabilityOverrides")
				.withIndex("by_mortgage", (q) => q.eq("mortgageId", mortgageId))
				.unique();
			if (!override) {
				throw new Error("Expected sale availability override");
			}
			await ctx.db.patch(override._id, {
				availableLedgerUnits: undefined,
				reason: "Restore full MIC availability after staged release.",
				updatedAt: 1_710_000_100_000,
				updatedBy: "marketplace-admin",
			});
		});

		const cleared = await auth.query(listingApi.getMarketplaceListingDetail, {
			listingId,
			portalId,
		});

		expect(cleared?.investment.availableFractions).toBe(10_000);
	});

	it("includes live mortgage payment history and next upcoming payment on marketplace detail", async () => {
		const t = createHarness();
		const portalId = await insertBrokerPortalPricingFixture(t);
		const auth = listingViewer(t);
		const { mortgageId, propertyId } = await insertMortgageFixture(t);

		const now = Date.now();
		const lastPaymentDate = now - 30 * 24 * 60 * 60 * 1000;
		const nextPaymentDate = now + 14 * 24 * 60 * 60 * 1000;
		const nextCollectionDate = nextPaymentDate - 5 * 24 * 60 * 60 * 1000;
		let listingId!: Doc<"listings">["_id"];
		let upcomingObligationId!: Doc<"obligations">["_id"];
		let planEntryId!: Doc<"collectionPlanEntries">["_id"];

		await t.run(async (ctx) => {
			const borrowerUser = await ctx.db.query("users").first();
			if (!borrowerUser) {
				throw new Error("Expected mortgage fixture to seed a user.");
			}
			const borrowerId = await ctx.db.insert("borrowers", {
				createdAt: now,
				orgId: "org_listing_viewer",
				status: "active",
				userId: borrowerUser._id,
			});

			await ctx.db.insert("obligations", {
				amount: 125_000,
				amountSettled: 125_000,
				borrowerId,
				createdAt: lastPaymentDate,
				dueDate: lastPaymentDate,
				gracePeriodEnd: lastPaymentDate,
				lastTransitionAt: lastPaymentDate,
				machineContext: undefined,
				mortgageId,
				orgId: "org_listing_viewer",
				paymentNumber: 1,
				settledAt: lastPaymentDate,
				status: "settled",
				type: "regular_interest",
			});

			upcomingObligationId = await ctx.db.insert("obligations", {
				amount: 125_000,
				amountSettled: 0,
				borrowerId,
				createdAt: now,
				dueDate: nextPaymentDate,
				gracePeriodEnd: nextPaymentDate + 5 * 24 * 60 * 60 * 1000,
				lastTransitionAt: now,
				machineContext: undefined,
				mortgageId,
				orgId: "org_listing_viewer",
				paymentNumber: 2,
				settledAt: undefined,
				status: "upcoming",
				type: "regular_interest",
			});

			planEntryId = await ctx.db.insert("collectionPlanEntries", {
				amount: 125_000,
				createdAt: now,
				method: "manual",
				mortgageId,
				obligationIds: [upcomingObligationId],
				scheduledDate: nextCollectionDate,
				source: "default_schedule",
				status: "planned",
			});

			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({
					mortgageId,
					paymentHistory: {
						byStatus: { upcoming: 2 },
						months: [{ label: "Mar", status: "settled" }],
						totalObligations: 2,
					},
					propertyId,
					title: "Payment Snapshot Listing",
				})
			);
		});

		const result = await auth.query(listingApi.getMarketplaceListingDetail, {
			listingId,
			portalId,
		});

		expect(result?.listing.paymentHistory).toMatchObject({
			byStatus: { settled: 1, upcoming: 1 },
			lastDueDate: nextPaymentDate,
			totalObligations: 2,
			totalOutstanding: 125_000,
		});
		expect(result?.listing.paymentHistory?.months).toEqual([
			expect.objectContaining({
				label: expect.any(String),
				status: "settled",
			}),
		]);
		expect(result?.listing.paymentSnapshot).toMatchObject({
			mostRecentPaymentAmount: 125_000,
			mostRecentPaymentDate: lastPaymentDate,
			mostRecentPaymentStatus: "settled",
			nextUpcomingPaymentAmount: 125_000,
			nextUpcomingPaymentDate: nextPaymentDate,
			nextUpcomingPaymentStatus: "planned",
		});
		expect(result?.listing.nextPaymentDue).toEqual({
			amount: 125_000,
			date: nextPaymentDate,
			obligationId: String(upcomingObligationId),
			planEntryId: String(planEntryId),
			status: "planned",
		});
	});

	it("falls back to other published listings when no same-property similar listings exist", async () => {
		const t = createHarness();
		const portalId = await insertBrokerPortalPricingFixture(t);
		const auth = listingViewer(t);

		let listingId!: Doc<"listings">["_id"];
		await t.run(async (ctx) => {
			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({
					marketplacePropertyType: "Detached Home",
					propertyType: "residential",
					title: "Detached Detail Listing",
				})
			);
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					marketplacePropertyType: "Condo",
					propertyType: "condo",
					title: "Fallback Condo Opportunity",
				})
			);
		});

		const result = await auth.query(listingApi.getMarketplaceListingDetail, {
			listingId,
			portalId,
		});

		expect(result?.similarListings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					propertyTypeLabel: "Condo",
					title: "Fallback Condo Opportunity",
				}),
			])
		);
	});

	it("returns null for unpublished marketplace detail", async () => {
		const t = createHarness();
		const portalId = await insertBrokerPortalPricingFixture(t);
		const auth = listingViewer(t);

		let listingId!: Doc<"listings">["_id"];
		await t.run(async (ctx) => {
			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({
					status: "draft",
					title: "Draft Listing",
				})
			);
		});

		const result = await auth.query(listingApi.getMarketplaceListingDetail, {
			listingId,
			portalId,
		});

		expect(result).toBeNull();
	});

	it("projects marketplace card rows through the active portal pricing policy", async () => {
		const t = createHarness();
		const portalId = await insertBrokerPortalPricingFixture(t);
		const auth = listingViewer(t);

		await t.run(async (ctx) => {
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					interestRate: 8.5,
					title: "Projected Marketplace Listing",
				})
			);
		});

		const result = await auth.query(listingApi.listMarketplaceListings, {
			cursor: null,
			numItems: 20,
			portalId,
		});

		expect(result.page[0]?.interestRate).toBe(7.65);
	});

	it("clamps canonical marketplace filters for portal-matched lenders", async () => {
		const t = createHarness();
		const auth = t.withIdentity(LENDER);
		const { brokerId, lenderId, portalId } = await insertPortalLenderFixture(t);

		await t.run(async (ctx) => {
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					interestRate: 8.75,
					ltvRatio: 0.6,
					maturityDate: "2026-06-30",
					principal: 250_000,
					title: "Constrained Match",
				})
			);
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					interestRate: 9.1,
					ltvRatio: 0.75,
					maturityDate: "2028-01-01",
					principal: 450_000,
					propertyType: "commercial",
					title: "Blocked by constraints",
				})
			);
			await ctx.db.insert("lenderFilterConstraints", {
				allowedMortgageTypes: ["First"],
				allowedPropertyTypes: ["Detached Home"],
				brokerId,
				createdAt: 1_710_000_500_000,
				interestRateRange: undefined,
				lastUpdatedBy: "test",
				lenderId,
				loanAmountRange: { max: 300_000, min: 200_000 },
				ltvRange: { max: 0.65, min: 0.55 },
				maturityDateMax: "2026-12-31",
				setByOnboardingId: undefined,
				updatedAt: 1_710_000_500_000,
			});
		});

		const result = await auth.query(listingApi.listMarketplaceListings, {
			cursor: null,
			filters: {
				ltv: { max: 0.9, min: 0.2 },
				maturityDate: { end: "2028-12-31" },
				mortgageTypes: ["First", "Second"],
				principalAmount: { max: 500_000, min: 100_000 },
				propertyTypes: ["Detached Home", "Commercial"],
			},
			numItems: 24,
			portalId,
		});

		expect(result.effectiveFilters).toEqual({
			ltv: { max: 0.65, min: 0.55 },
			maturityDate: { end: "2026-12-31" },
			mortgageTypes: ["First"],
			principalAmount: { max: 300_000, min: 200_000 },
			propertyTypes: ["Detached Home"],
			searchQuery: undefined,
		});
		expect(result.page).toHaveLength(1);
		expect(result.page[0]?.title).toBe("Constrained Match");
		expect(result.page[0]?.interestRate).toBe(7.66);
	});

	it("hides canonical marketplace detail excluded by lender constraints", async () => {
		const t = createHarness();
		const auth = t.withIdentity(LENDER);
		const { brokerId, lenderId, portalId } = await insertPortalLenderFixture(t);

		let listingId!: Doc<"listings">["_id"];
		await t.run(async (ctx) => {
			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({
					lienPosition: 2,
					propertyType: "commercial",
					title: "Blocked Detail",
				})
			);
			await ctx.db.insert("lenderFilterConstraints", {
				allowedMortgageTypes: ["First"],
				allowedPropertyTypes: ["Detached Home"],
				brokerId,
				createdAt: 1_710_000_500_000,
				interestRateRange: undefined,
				lastUpdatedBy: "test",
				lenderId,
				loanAmountRange: undefined,
				ltvRange: undefined,
				maturityDateMax: undefined,
				setByOnboardingId: undefined,
				updatedAt: 1_710_000_500_000,
			});
		});

		const result = await auth.query(listingApi.getMarketplaceListingDetail, {
			listingId,
			portalId,
		});

		expect(result).toBeNull();
	});
});
