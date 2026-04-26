import { describe, expect, it } from "vitest";
import { api } from "../../../../../convex/_generated/api";
import { createTestConvex, ensureSeededIdentity } from "../../../auth/helpers";
import { FAIRLEND_ADMIN } from "../../../auth/identities";

async function seedDraftListing(t: ReturnType<typeof createTestConvex>) {
	await ensureSeededIdentity(t, FAIRLEND_ADMIN);

	return await t.run(async (ctx) => {
		const now = 1_710_001_000_000;
		return await ctx.db.insert("listings", {
			adminNotes: "Mock listing seeded for publication test",
			approximateLatitude: 43.6532,
			approximateLongitude: -79.3832,
			borrowerSignal: undefined,
			city: "Toronto",
			createdAt: now,
			dataSource: "demo",
			delistedAt: undefined,
			delistReason: undefined,
			description: "Draft listing for publication",
			displayOrder: 1,
			featured: false,
			heroImages: [],
			interestRate: 7.5,
			lastTransitionAt: undefined,
			lienPosition: 1,
			loanType: "conventional",
			ltvRatio: 65,
			machineContext: undefined,
			marketplaceCopy: "Draft marketplace copy",
			marketplacePropertyType: "Detached Home",
			maturityDate: "2027-05-01",
			monthlyPayment: 342_100,
			mortgageId: undefined,
			paymentFrequency: "monthly",
			paymentHistory: undefined,
			principal: 45_000_000,
			propertyId: undefined,
			propertyType: "residential",
			province: "ON",
			publicDocumentIds: [],
			publishedAt: undefined,
			rateType: "fixed",
			seoSlug: "draft-publication-test",
			status: "draft",
			termMonths: 12,
			title: "Draft Mock Listing",
			updatedAt: now,
			viewCount: 0,
		});
	});
}

describe("listing publication settings seam", () => {
	it("publishes a draft listing and reports the updated status", async () => {
		const t = createTestConvex();
		const listingId = await seedDraftListing(t);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);

		const before = await asAdmin.query(
			api.admin.settings.queries.getListingPublicationStatus,
			{
				listingId,
			}
		);
		expect(before?.status).toBe("draft");
		expect(before?.isPublished).toBe(false);
		expect(before?.canPublish).toBe(true);
		expect(before?.publishedAt).toBeNull();

		const publishResult = await asAdmin.mutation(
			api.admin.settings.mutations.publishListing,
			{
				listingId,
			}
		);
		expect(publishResult.wasAlreadyPublished).toBe(false);
		expect(publishResult.publication.status).toBe("published");
		expect(publishResult.publication.isPublished).toBe(true);
		expect(publishResult.publication.publishedAt).not.toBeNull();

		const after = await asAdmin.query(
			api.admin.settings.queries.getListingPublicationStatus,
			{
				listingId,
			}
		);
		expect(after?.status).toBe("published");
		expect(after?.canPublish).toBe(false);
		expect(after?.publishedAt).toBeTypeOf("number");

		const storedListing = await t.run(async (ctx) => ctx.db.get(listingId));
		expect(storedListing?.status).toBe("published");
		expect(storedListing?.publishedAt).toBeTypeOf("number");
		expect(storedListing?.lastTransitionAt).toBeTypeOf("number");
	});

	it("returns the existing published state without changing timestamps", async () => {
		const t = createTestConvex();
		const listingId = await seedDraftListing(t);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);

		const first = await asAdmin.mutation(
			api.admin.settings.mutations.publishListing,
			{
				listingId,
			}
		);
		const second = await asAdmin.mutation(
			api.admin.settings.mutations.publishListing,
			{
				listingId,
			}
		);

		expect(second.wasAlreadyPublished).toBe(true);
		expect(second.publication.publishedAt).toBe(first.publication.publishedAt);
	});
});
