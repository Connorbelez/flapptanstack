import { describe, expect, it } from "vitest";
import { createOriginationValuationSnapshot } from "../../../../convex/mortgages/valuation";
import { createTestConvex, ensureSeededIdentity } from "../../auth/helpers";
import { FAIRLEND_ADMIN } from "../../auth/identities";

async function seedValuationFixture(t: ReturnType<typeof createTestConvex>) {
	const userId = await ensureSeededIdentity(t, FAIRLEND_ADMIN);

	return await t.run(async (ctx) => {
		const now = 1_710_001_000_000;
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: now,
			lastTransitionAt: now,
			onboardedAt: now,
			orgId: FAIRLEND_ADMIN.org_id,
			status: "active",
			userId,
		});
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: now,
			latitude: 43.6532,
			longitude: -79.3832,
			postalCode: "M5V 2T6",
			propertyType: "residential",
			province: "ON",
			streetAddress: "123 Mockingbird Lane",
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 360,
			brokerOfRecordId: brokerId,
			createdAt: now,
			firstPaymentDate: "2026-06-01",
			interestAdjustmentDate: "2026-06-01",
			interestRate: 7.85,
			lastTransitionAt: now,
			lienPosition: 1,
			loanType: "conventional",
			machineContext: { lastPaymentAt: 0, missedPayments: 0 },
			maturityDate: "2027-05-01",
			orgId: FAIRLEND_ADMIN.org_id,
			paymentAmount: 340_000,
			paymentFrequency: "monthly",
			principal: 45_000_000,
			propertyId,
			rateType: "fixed",
			status: "active",
			termMonths: 12,
			termStartDate: "2026-06-01",
		});

		return {
			mortgageId,
			userId,
		};
	});
}

describe("createOriginationValuationSnapshot", () => {
	it("persists appraisal comparables alongside the valuation snapshot", async () => {
		const t = createTestConvex();
		const fixture = await seedValuationFixture(t);

		const result = await t.run(async (ctx) =>
			createOriginationValuationSnapshot(ctx, {
				comparables: [
					{
						address: "11 Example Ave, Toronto, ON M5V 1A1",
						adjustedValue: 65_200_000,
						propertyType: "Detached",
						saleDate: "2026-01-15",
						salePrice: 64_900_000,
						sortOrder: 0,
						squareFootage: 1620,
						yearBuilt: 1998,
					},
					{
						address: "19 Example Ave, Toronto, ON M5V 1A3",
						adjustedValue: 65_600_000,
						lotSize: "25 x 110",
						propertyType: "Detached",
						saleDate: "2025-12-22",
						salePrice: 65_900_000,
						sortOrder: 1,
						squareFootage: 1680,
						yearBuilt: 2001,
					},
				],
				createdAt: 1_710_001_500_000,
				createdByUserId: fixture.userId,
				mortgageId: fixture.mortgageId,
				source: "admin_origination",
				termStartDate: "2026-06-01",
				valuationDate: "2026-05-01",
				valueAsIs: 65_500_000,
			})
		);

		expect(result.valuationDate).toBe("2026-05-01");

		const persisted = await t.run(async (ctx) => {
			const appraisal = await ctx.db.get(result.appraisalId);
			const snapshot = await ctx.db.get(result.valuationSnapshotId);
			const comparables = await ctx.db
				.query("appraisalComparables")
				.withIndex("by_appraisal", (query) =>
					query.eq("appraisalId", result.appraisalId)
				)
				.collect();

			return { appraisal, comparables, snapshot };
		});

		expect(persisted.snapshot?.valueAsIs).toBe(65_500_000);
		expect(persisted.appraisal?.appraisedValue).toBe(65_500_000);
		expect(persisted.comparables).toHaveLength(2);
		expect(
			persisted.comparables.map((comparable) => comparable.address)
		).toEqual([
			"11 Example Ave, Toronto, ON M5V 1A1",
			"19 Example Ave, Toronto, ON M5V 1A3",
		]);
		expect(persisted.comparables.map((comparable) => comparable.sortOrder)).toEqual([
			0,
			1,
		]);
	});
});
