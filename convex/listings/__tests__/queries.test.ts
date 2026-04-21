import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { seedFromIdentity } from "../../../src/test/auth/helpers";
import { LENDER } from "../../../src/test/auth/identities";
import { api, internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { FAIRLEND_STAFF_ORG_ID } from "../../constants";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";
import { deriveMarketplacePropertyType } from "../marketplaceShared";

const modules = convexModules;
const listingApi = anyApi.listings.queries;
const portalListingApi = anyApi.listings.portalQueries;

const AUThed_IDENTITY = {
	subject: "listing-user",
	issuer: "https://api.workos.com",
	org_id: "org_listing_viewer",
	organization_name: "Listing Viewer Org",
	role: "member",
	roles: JSON.stringify(["member"]),
	permissions: JSON.stringify([]),
	user_email: "listing-viewer@fairlend.ca",
	user_first_name: "Listing",
	user_last_name: "Viewer",
};

const ADMIN_IDENTITY = {
	subject: "listing-admin",
	issuer: "https://api.workos.com",
	org_id: FAIRLEND_STAFF_ORG_ID,
	organization_name: "FairLend Staff",
	role: "admin",
	roles: JSON.stringify(["admin"]),
	permissions: JSON.stringify(["ledger:view", "ledger:correct"]),
	user_email: "listing-admin@fairlend.ca",
	user_first_name: "Listing",
	user_last_name: "Admin",
};

const SYS_SOURCE = { type: "system" as const, channel: "test" };

function createHarness() {
	return convexTest(schema, modules);
}

function asAuthedUser(t: ReturnType<typeof createHarness>) {
	return t.withIdentity(AUThed_IDENTITY);
}

function asAdminUser(t: ReturnType<typeof createHarness>) {
	return t.withIdentity(ADMIN_IDENTITY);
}

async function initializeLedger(auth: ReturnType<typeof asAdminUser>) {
	await auth.mutation(api.ledger.sequenceCounter.initializeSequenceCounter, {});
}

async function mintMortgage(
	auth: ReturnType<typeof asAdminUser>,
	mortgageId: string,
	idempotencyKey: string
) {
	await initializeLedger(auth);
	return await auth.mutation(api.ledger.mutations.mintMortgage, {
		effectiveDate: "2026-01-01",
		idempotencyKey,
		mortgageId,
		source: SYS_SOURCE,
	});
}

async function issueShares(
	auth: ReturnType<typeof asAdminUser>,
	mortgageId: string,
	lenderId: string,
	amount: number,
	idempotencyKey: string
) {
	return await auth.mutation(internal.ledger.mutations.issueShares, {
		amount,
		effectiveDate: "2026-01-01",
		idempotencyKey,
		lenderId,
		mortgageId,
		source: SYS_SOURCE,
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
		ltvRatio: 0.65,
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

async function insertMortgageFixture(t: ReturnType<typeof createHarness>) {
	return await t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {
			authId: `broker_${Date.now()}`,
			email: `broker_${Date.now()}@example.com`,
			firstName: "Broker",
			lastName: "Fixture",
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
	brokerSplitPercent = 12.5
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

describe("listing queries", () => {
	it("returns listing by id and by mortgage", async () => {
		const t = createHarness();
		const auth = asAuthedUser(t);
		const { mortgageId, propertyId } = await insertMortgageFixture(t);

		let listingId!: Id<"listings">;

		await t.run(async (ctx) => {
			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({ mortgageId, propertyId })
			);
		});

		const byId = await auth.query(listingApi.getListingById, {
			listingId,
		});
		const byMortgage = await auth.query(listingApi.getListingByMortgage, {
			mortgageId,
		});

		expect(byId?._id).toBe(listingId);
		expect(byMortgage?._id).toBe(listingId);
	});

	it("returns null availability for demo listings", async () => {
		const t = createHarness();
		const auth = asAuthedUser(t);

		let listingId!: Id<"listings">;
		await t.run(async (ctx) => {
			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({
					dataSource: "demo",
					mortgageId: undefined,
					propertyId: undefined,
				})
			);
		});

		const result = await auth.query(listingApi.getListingWithAvailability, {
			listingId,
		});

		expect(result?.availability).toBeNull();
	});

	it("derives live availability from ledger positions", async () => {
		const t = createHarness();
		const auth = asAuthedUser(t);
		const admin = asAdminUser(t);
		const { mortgageId, propertyId } = await insertMortgageFixture(t);

		let listingId!: Id<"listings">;

		await t.run(async (ctx) => {
			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({
					mortgageId,
					propertyId,
				})
			);
		});

		await mintMortgage(admin, String(mortgageId), "mint-availability");
		await issueShares(
			admin,
			String(mortgageId),
			"seed_maple_mic_lender_fairlend_ca",
			6000,
			"issue-mic"
		);
		await issueShares(
			admin,
			String(mortgageId),
			"investor-alpha",
			4000,
			"issue-investor"
		);

		const result = await auth.query(listingApi.getListingWithAvailability, {
			listingId,
		});

		expect(result?.availability).toEqual({
			availableFractions: 6000,
			micPosition: {
				balance: 6000,
				hasPosition: true,
				inferred: true,
				lenderId: "seed_maple_mic_lender_fairlend_ca",
			},
			percentageSold: 40,
			totalFractions: 10_000,
			totalInvestors: 1,
		});
	});

	it("filters, sorts, and paginates published listings", async () => {
		const t = createHarness();
		const auth = asAuthedUser(t);

		await t.run(async (ctx) => {
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					city: "Toronto",
					interestRate: 9.25,
					lienPosition: 1,
					principal: 300_000,
					publishedAt: 1_710_000_000_100,
					title: "Toronto First",
					viewCount: 15,
				})
			);
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					city: "Toronto",
					interestRate: 7.75,
					lienPosition: 2,
					principal: 220_000,
					publishedAt: 1_710_000_000_200,
					title: "Toronto Second",
					viewCount: 3,
				})
			);
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					city: "Ottawa",
					interestRate: 8.9,
					publishedAt: 1_710_000_000_300,
					title: "Ottawa Listing",
					viewCount: 8,
				})
			);
		});

		const firstPage = await auth.query(listingApi.listPublishedListings, {
			cursor: null,
			filters: {
				city: "Toronto",
				lienPosition: 1,
			},
			numItems: 1,
			sort: {
				direction: "desc",
				field: "interestRate",
			},
		});

		expect(firstPage.page).toHaveLength(1);
		expect(firstPage.page[0]?.title).toBe("Toronto First");
		expect(firstPage.isDone).toBe(true);
		expect(firstPage.continueCursor).toBeNull();

		const secondPage = await auth.query(listingApi.listPublishedListings, {
			cursor: null,
			filters: { city: "Toronto" },
			numItems: 1,
			sort: {
				direction: "desc",
				field: "publishedAt",
			},
		});

		expect(secondPage.page[0]?.title).toBe("Toronto Second");
		expect(secondPage.continueCursor).toBe("offset:1");
		expect(secondPage.isDone).toBe(false);
	});

	it("returns all statuses for admin listings", async () => {
		const t = createHarness();
		const admin = asAdminUser(t);

		await t.run(async (ctx) => {
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					status: "draft",
					publishedAt: undefined,
					title: "Draft",
				})
			);
			await ctx.db.insert(
				"listings",
				buildListingDoc({ status: "published", title: "Published" })
			);
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					delistedAt: 1_710_000_100_000,
					delistReason: "admin_decision",
					status: "delisted",
					title: "Delisted",
				})
			);
		});

		const result = await admin.query(listingApi.listListingsForAdmin, {
			cursor: null,
			numItems: 10,
			status: "published",
		});

		expect(result.page.map((listing) => listing.status)).toEqual(["published"]);
	});

	it("requires a status filter for admin listings", async () => {
		const t = createHarness();
		const admin = asAdminUser(t);

		await expect(
			admin.query(listingApi.listListingsForAdmin, {
				cursor: null,
				numItems: 10,
			})
		).rejects.toThrow(
			"status is required to list listings for admin without scanning the entire table"
		);
	});

	it("returns appraisals with comparables and encumbrances by property", async () => {
		const t = createHarness();
		const auth = asAuthedUser(t);

		let propertyId!: Id<"properties">;
		await t.run(async (ctx) => {
			propertyId = await ctx.db.insert("properties", {
				city: "Hamilton",
				createdAt: Date.now(),
				propertyType: "residential",
				province: "ON",
				postalCode: "L8P1A1",
				streetAddress: "50 James St S",
			});

			const appraisalId = await ctx.db.insert("appraisals", {
				appraisalType: "as_is",
				appraisedValue: 500_000,
				appraiserFirm: "North Appraisal",
				appraiserName: "N. Appraiser",
				createdAt: 1_710_000_000_000,
				effectiveDate: "2026-03-01",
				propertyId,
				reportDate: "2026-03-03",
			});

			await ctx.db.insert("appraisalComparables", {
				address: "10 Bay St",
				appraisalId,
				createdAt: 1_710_000_000_100,
				sortOrder: 2,
			});
			await ctx.db.insert("appraisalComparables", {
				address: "20 King St",
				appraisalId,
				createdAt: 1_710_000_000_200,
				sortOrder: 1,
			});

			await ctx.db.insert("priorEncumbrances", {
				createdAt: 1_710_000_000_300,
				encumbranceType: "first_mortgage",
				holder: "Existing Bank",
				propertyId,
				priority: 1,
			});
		});

		const appraisals = await auth.query(listingApi.getListingAppraisals, {
			propertyId,
		});
		const encumbrances = await auth.query(listingApi.getListingEncumbrances, {
			propertyId,
		});

		expect(appraisals).toHaveLength(1);
		expect(appraisals[0]?.comparables.map((item) => item.address)).toEqual([
			"20 King St",
			"10 Bay St",
		]);
		expect(encumbrances).toHaveLength(1);
		expect(encumbrances[0]?.holder).toBe("Existing Bank");
	});

	it("returns transaction history for real listings and [] for demo listings", async () => {
		const t = createHarness();
		const auth = asAuthedUser(t);
		const admin = asAdminUser(t);
		const { mortgageId, propertyId } = await insertMortgageFixture(t);

		const demoHistory = await auth.query(
			listingApi.getListingTransactionHistory,
			{
				mortgageId: undefined,
			}
		);
		expect(demoHistory).toEqual([]);

		await mintMortgage(admin, String(mortgageId), "mint-history");
		await issueShares(
			admin,
			String(mortgageId),
			"seed_maple_mic_lender_fairlend_ca",
			8000,
			"issue-history-mic"
		);
		await issueShares(
			admin,
			String(mortgageId),
			"investor-a",
			2000,
			"issue-history-a"
		);
		await admin.mutation(api.ledger.mutations.transferShares, {
			amount: 1000,
			buyerLenderId: "investor-b",
			effectiveDate: "2026-01-02",
			idempotencyKey: "transfer-history",
			mortgageId: String(mortgageId),
			sellerLenderId: "investor-a",
			source: SYS_SOURCE,
		});

		await t.run(async (ctx) => {
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					mortgageId,
					propertyId,
					title: "History listing",
				})
			);
		});

		const history = await auth.query(listingApi.getListingTransactionHistory, {
			mortgageId,
		});

		expect(history).toHaveLength(3);
		expect(history[0]?.entryType).toBe("SHARES_TRANSFERRED");
		expect(history[0]?.eventType).toBe("transfer");
		expect(history[0]?.fromLenderId).toBe("investor-a");
		expect(history[0]?.toLenderId).toBe("investor-b");
	});

	it("projects listing detail results through portal pricing when a portal is active", async () => {
		const t = createHarness();
		const auth = asAuthedUser(t);
		const { mortgageId, propertyId } = await insertMortgageFixture(t);

		let listingId!: Id<"listings">;
		await t.run(async (ctx) => {
			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({
					interestRate: 8.75,
					monthlyPayment: 1633.335,
					mortgageId,
					propertyId,
				})
			);
		});
		const portalId = await insertBrokerPortalPricingFixture(t);

		const canonicalDetail = await auth.query(
			listingApi.getListingWithAvailability,
			{
				listingId,
			}
		);
		const projectedDetail = await auth.query(
			listingApi.getListingWithAvailability,
			{
				listingId,
				portalId,
			}
		);

		expect(canonicalDetail).not.toBeNull();
		expect(projectedDetail).not.toBeNull();
		if (!(canonicalDetail && projectedDetail)) {
			throw new Error("Expected listing detail to exist");
		}

		expect(projectedDetail.listing.interestRate).toBe(7.66);
		expect(projectedDetail.listing.monthlyPayment).toBe(1429.17);
		expect(projectedDetail.listing.principal).toBe(
			canonicalDetail.listing.principal
		);
		expect(projectedDetail.listing.ltvRatio).toBe(
			canonicalDetail.listing.ltvRatio
		);
		expect(projectedDetail.availability).toEqual(canonicalDetail.availability);
	});

	it("projects published listing rows through portal pricing when a portal is active", async () => {
		const t = createHarness();
		const auth = asAuthedUser(t);

		await t.run(async (ctx) => {
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					interestRate: 8.75,
					monthlyPayment: 1633.335,
					publishedAt: 1_710_000_000_100,
					title: "Projected Listing",
				})
			);
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					interestRate: 6.5,
					monthlyPayment: 980,
					publishedAt: 1_710_000_000_200,
					title: "Newest Listing",
				})
			);
		});
		const portalId = await insertBrokerPortalPricingFixture(t);

		const canonicalPage = await auth.query(listingApi.listPublishedListings, {
			cursor: null,
			numItems: 10,
			sort: {
				direction: "desc",
				field: "publishedAt",
			},
		});
		const projectedPage = await auth.query(listingApi.listPublishedListings, {
			cursor: null,
			numItems: 10,
			portalId,
			sort: {
				direction: "desc",
				field: "publishedAt",
			},
		});

		const canonicalProjectedListing = canonicalPage.page.find(
			(listing) => listing.title === "Projected Listing"
		);
		const portalProjectedListing = projectedPage.page.find(
			(listing) => listing.title === "Projected Listing"
		);

		expect(canonicalProjectedListing).toBeDefined();
		expect(portalProjectedListing).toBeDefined();
		expect(portalProjectedListing?.interestRate).toBe(7.66);
		expect(portalProjectedListing?.monthlyPayment).toBe(1429.17);
		expect(portalProjectedListing?.principal).toBe(
			canonicalProjectedListing?.principal
		);
		expect(portalProjectedListing?.ltvRatio).toBe(
			canonicalProjectedListing?.ltvRatio
		);
	});

	it("caps public portal teaser listings to the configured teaser limit", async () => {
		const t = createHarness();

		await t.run(async (ctx) => {
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					interestRate: 6.5,
					monthlyPayment: 980,
					publishedAt: 1_710_000_000_100,
					title: "Older Listing",
				})
			);
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					interestRate: 8.75,
					monthlyPayment: 1633.335,
					publishedAt: 1_710_000_000_200,
					title: "Newest Listing",
				})
			);
		});

		const portalId = await t.run(async (ctx) => {
			const teaserPortalId = await ctx.db.insert("portals", {
				brokerId: undefined,
				createdAt: 1_710_000_500_000,
				defaultPostAuthPath: "/",
				isPublished: true,
				landingPageId: undefined,
				localHost: "teaser.localhost:3000",
				orgId: "org_teaser",
				portalType: "broker",
				pricingPolicyId: undefined,
				productionHost: "teaser.fairlend.ca",
				publicTeaserEnabled: true,
				slug: "teaser",
				status: "active",
				teaserListingLimit: 1,
				updatedAt: 1_710_000_500_000,
			});
			const policyId = await ctx.db.insert("portalPricingPolicies", {
				brokerSplitPercent: 12.5,
				createdAt: 1_710_000_500_000,
				effectiveFrom: 1_710_000_495_000,
				effectiveTo: undefined,
				portalId: teaserPortalId,
				status: "active",
				updatedAt: 1_710_000_500_000,
			});
			await ctx.db.patch(teaserPortalId, {
				pricingPolicyId: policyId,
				updatedAt: 1_710_000_500_000,
			});
			return teaserPortalId;
		});

		const result = await t.query(portalListingApi.listPublicPortalListings, {
			cursor: null,
			numItems: -1,
			portalId,
		});

		expect(result.teaserEnabled).toBe(true);
		expect(result.teaserListingLimit).toBe(1);
		expect(result.page).toHaveLength(1);
		expect(result.page[0]?.title).toBe("Newest Listing");
		expect(result.page[0]?.interestRate).toBe(7.66);
		expect(result.isDone).toBe(false);
		expect(result.continueCursor).toBe("offset:1");
	});

	it("returns an explicit disabled teaser contract when the portal hides public listings", async () => {
		const t = createHarness();

		const portalId = await t.run(async (ctx) => {
			return await ctx.db.insert("portals", {
				brokerId: undefined,
				createdAt: 1_710_000_500_000,
				defaultPostAuthPath: "/",
				isPublished: true,
				landingPageId: undefined,
				localHost: "hidden.localhost:3000",
				orgId: "org_hidden",
				portalType: "broker",
				pricingPolicyId: undefined,
				productionHost: "hidden.fairlend.ca",
				publicTeaserEnabled: false,
				slug: "hidden",
				status: "active",
				teaserListingLimit: 6,
				updatedAt: 1_710_000_500_000,
			});
		});

		const result = await t.query(portalListingApi.listPublicPortalListings, {
			cursor: null,
			numItems: 10,
			portalId,
		});

		expect(result).toEqual({
			continueCursor: null,
			isDone: true,
			page: [],
			teaserEnabled: false,
			teaserListingLimit: 6,
		});
	});

	it("clamps lender portal filters to the current portal constraints", async () => {
		const t = createHarness();
		const lenderAuth = t.withIdentity(LENDER);
		const { brokerId, lenderId, portalId } = await insertPortalLenderFixture(t);

		await t.run(async (ctx) => {
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					interestRate: 8.75,
					ltvRatio: 0.6,
					maturityDate: "2026-06-01",
					principal: 225_000,
					propertyType: "residential",
					publishedAt: 1_710_000_000_200,
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
					publishedAt: 1_710_000_000_300,
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

		const result = await lenderAuth.query(
			portalListingApi.listLenderPortalListings,
			{
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
			}
		);

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

	it("returns no listings when lender-requested enum filters do not overlap the portal constraints", async () => {
		const t = createHarness();
		const lenderAuth = t.withIdentity(LENDER);
		const { brokerId, lenderId, portalId } = await insertPortalLenderFixture(t);

		await t.run(async (ctx) => {
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					lienPosition: 1,
					propertyType: "residential",
					publishedAt: 1_710_000_000_200,
					title: "Allowed Match",
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

		const result = await lenderAuth.query(
			portalListingApi.listLenderPortalListings,
			{
				cursor: null,
				filters: {
					mortgageTypes: ["Second"],
					propertyTypes: ["Commercial"],
				},
				numItems: 24,
				portalId,
			}
		);

		expect(result.effectiveFilters).toEqual({
			interestRate: undefined,
			ltv: undefined,
			maturityDate: undefined,
			mortgageTypes: [],
			principalAmount: undefined,
			propertyTypes: [],
			searchQuery: undefined,
		});
		expect(result.page).toEqual([]);
	});

	it("treats empty stored portal allowlists as deny-all filters", async () => {
		const t = createHarness();
		const lenderAuth = t.withIdentity(LENDER);
		const { brokerId, lenderId, portalId } = await insertPortalLenderFixture(t);

		await t.run(async (ctx) => {
			await ctx.db.insert(
				"listings",
				buildListingDoc({
					lienPosition: 1,
					propertyType: "residential",
					publishedAt: 1_710_000_000_200,
					title: "Would otherwise match",
				})
			);
			await ctx.db.insert("lenderFilterConstraints", {
				allowedMortgageTypes: [],
				allowedPropertyTypes: [],
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

		const result = await lenderAuth.query(
			portalListingApi.listLenderPortalListings,
			{
				cursor: null,
				numItems: 24,
				portalId,
			}
		);

		expect(result.effectiveFilters).toEqual({
			interestRate: undefined,
			ltv: undefined,
			maturityDate: undefined,
			mortgageTypes: [],
			principalAmount: undefined,
			propertyTypes: [],
			searchQuery: undefined,
		});
		expect(result.page).toEqual([]);
	});

	it("returns projected lender portal listing detail with public documents", async () => {
		const t = createHarness();
		const lenderAuth = t.withIdentity(LENDER);
		const admin = asAdminUser(t);
		const { mortgageId, propertyId } = await insertMortgageFixture(t);
		const { portalId } = await insertPortalLenderFixture(t);

		let listingId!: Id<"listings">;
		let publicDocumentAssetId!: Id<"documentAssets">;
		let publicDocumentBlueprintId!: Id<"mortgageDocumentBlueprints">;

		await t.run(async (ctx) => {
			const lenderUser = await ctx.db
				.query("users")
				.withIndex("authId", (query) => query.eq("authId", LENDER.subject))
				.unique();
			if (!lenderUser) {
				throw new Error(
					"Expected seeded lender user for public document asset"
				);
			}

			const publicDocumentFileRef = await (
				ctx.storage as unknown as {
					store: (blob: Blob) => Promise<Id<"_storage">>;
				}
			).store(new Blob(["investor summary pdf"]));

			publicDocumentAssetId = await ctx.db.insert("documentAssets", {
				description: "Visible to authenticated lenders.",
				fileHash: "listing-public-doc",
				fileRef: publicDocumentFileRef,
				fileSize: 128,
				mimeType: "application/pdf",
				name: "Investor Summary",
				originalFilename: "investor-summary.pdf",
				pageCount: 1,
				source: "admin_upload",
				uploadedAt: 1_710_000_500_000,
				uploadedByUserId: lenderUser._id,
			});
			publicDocumentBlueprintId = await ctx.db.insert(
				"mortgageDocumentBlueprints",
				{
					archivedAt: undefined,
					archivedByUserId: undefined,
					assetId: publicDocumentAssetId,
					category: "public",
					class: "public_static",
					createdAt: 1_710_000_500_000,
					createdByUserId: lenderUser._id,
					description: "Visible to authenticated lenders.",
					displayName: "Investor Summary",
					displayOrder: 0,
					mortgageId,
					packageKey: "public",
					packageLabel: "Public docs",
					sourceDraftId: undefined,
					sourceKind: "asset",
					status: "active",
					templateId: undefined,
					templateSnapshotMeta: undefined,
					templateVersion: undefined,
				}
			);
			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({
					interestRate: 8.5,
					monthlyPayment: 1250,
					mortgageId,
					propertyId,
					title: "Visible Detail",
				})
			);
		});

		await mintMortgage(admin, String(mortgageId), "mint-visible-detail");
		await issueShares(
			admin,
			String(mortgageId),
			"seed_maple_mic_lender_fairlend_ca",
			6000,
			"issue-visible-detail-mic"
		);
		await issueShares(
			admin,
			String(mortgageId),
			"investor-alpha",
			4000,
			"issue-visible-detail-investor"
		);

		const result = await lenderAuth.query(
			portalListingApi.getLenderPortalListingDetail,
			{
				listingId,
				portalId,
			}
		);

		expect(result).not.toBeNull();
		if (!result) {
			throw new Error("Expected lender portal listing detail");
		}

		expect(result.listing._id).toBe(listingId);
		expect(result.listing.title).toBe("Visible Detail");
		expect(result.listing.interestRate).toBe(7.44);
		expect(result.listing.monthlyPayment).toBe(1093.75);
		expect(result.availability).toEqual({
			availableFractions: 6000,
			micPosition: {
				balance: 6000,
				hasPosition: true,
				inferred: true,
				lenderId: "seed_maple_mic_lender_fairlend_ca",
			},
			percentageSold: 40,
			totalFractions: 10_000,
			totalInvestors: 1,
		});
		expect(result.documents).toHaveLength(1);
		expect(result.documents[0]).toMatchObject({
			assetId: publicDocumentAssetId,
			blueprintId: publicDocumentBlueprintId,
			class: "public_static",
			description: "Visible to authenticated lenders.",
			displayName: "Investor Summary",
		});
		expect(result.documents[0]?.url).toEqual(expect.any(String));
	});

	it("rejects unpublished lender portal listing detail", async () => {
		const t = createHarness();
		const lenderAuth = t.withIdentity(LENDER);
		const { portalId } = await insertPortalLenderFixture(t);

		let listingId!: Id<"listings">;
		await t.run(async (ctx) => {
			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({
					status: "draft",
					publishedAt: undefined,
					title: "Draft Listing",
				})
			);
		});

		const result = await lenderAuth.query(
			portalListingApi.getLenderPortalListingDetail,
			{
				listingId,
				portalId,
			}
		);

		expect(result).toBeNull();
	});

	it("rejects lender portal listing detail for listings excluded by lender constraints", async () => {
		const t = createHarness();
		const lenderAuth = t.withIdentity(LENDER);
		const { brokerId, lenderId, portalId } = await insertPortalLenderFixture(t);

		let listingId!: Id<"listings">;
		await t.run(async (ctx) => {
			listingId = await ctx.db.insert(
				"listings",
				buildListingDoc({
					lienPosition: 2,
					propertyType: "commercial",
					publishedAt: 1_710_000_000_300,
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

		const result = await lenderAuth.query(
			portalListingApi.getLenderPortalListingDetail,
			{
				listingId,
				portalId,
			}
		);

		expect(result).toBeNull();
	});
});
