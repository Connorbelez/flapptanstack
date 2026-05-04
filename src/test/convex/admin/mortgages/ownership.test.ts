import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
	FAIRLEND_BROKERAGE_ORG_ID,
	FAIRLEND_STAFF_ORG_ID,
} from "../../../../../convex/constants";
import { TOTAL_SUPPLY } from "../../../../../convex/ledger/constants";
import { FAIRLEND_MIC_LENDER_EMAIL } from "../../../../../convex/platform/defaultOriginationOwnerContract";
import { seedAuthIdFromEmail } from "../../../../../convex/seed/seedHelpers";
import { createMockViewer, createTestConvex, ensureSeededIdentity } from "../../../auth/helpers";
import { FAIRLEND_ADMIN } from "../../../auth/identities";

const assignMortgageFractionsToFairLendMicRef = makeFunctionReference<
	"mutation",
	{
		mortgageId: Id<"mortgages">;
		reason: string;
		targetUnits?: number;
	},
	Promise<{
		entriesPosted: number;
		micLenderAuthId: string;
		micPositionUnits: number;
		mortgageId: Id<"mortgages">;
		targetUnits: number;
	}>
>("admin/mortgages/ownership:assignMortgageFractionsToFairLendMic");

async function seedBrokerRecord(t: ReturnType<typeof createTestConvex>) {
	const brokerIdentity = createMockViewer({
		email: "ownership.broker@test.fairlend.ca",
		firstName: "Ownership",
		lastName: "Broker",
		orgId: FAIRLEND_STAFF_ORG_ID,
		orgName: "FairLend Staff",
		roles: ["broker"],
		subject: "user_ownership_broker",
	});
	const userId = await ensureSeededIdentity(t, brokerIdentity);

	return t.run(async (ctx) => {
		const now = Date.now();
		return await ctx.db.insert("brokers", {
			createdAt: now,
			lastTransitionAt: now,
			onboardedAt: now,
			orgId: FAIRLEND_STAFF_ORG_ID,
			status: "active",
			userId,
		});
	});
}

async function seedDefaultOriginationOwner(t: ReturnType<typeof createTestConvex>) {
	const fairlendBroker = await t.withIdentity(FAIRLEND_ADMIN).mutation(
		api.seed.seedBroker.seedBroker,
		{}
	);
	return t.withIdentity(FAIRLEND_ADMIN).mutation(
		api.seed.seedPlatformOwnership.seedPlatformOwnership,
		{ brokerId: fairlendBroker.brokerIds[0] }
	);
}

async function seedMortgage(t: ReturnType<typeof createTestConvex>) {
	const brokerId = await seedBrokerRecord(t);
	return t.run(async (ctx) => {
		const now = Date.now();
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: now,
			postalCode: "M5V2T6",
			propertyType: "residential",
			province: "ON",
			streetAddress: "100 Override St",
		});
		return await ctx.db.insert("mortgages", {
			amortizationMonths: 300,
			brokerOfRecordId: brokerId,
			collectionExecutionMode: "app_owned",
			collectionExecutionUpdatedAt: now,
			createdAt: now,
			firstPaymentDate: "2026-06-01",
			interestAdjustmentDate: "2026-05-01",
			interestRate: 9.5,
			lienPosition: 1,
			loanType: "conventional",
			maturityDate: "2027-05-01",
			orgId: FAIRLEND_BROKERAGE_ORG_ID,
			paymentAmount: 2450,
			paymentFrequency: "monthly",
			principal: 250_000,
			propertyId,
			rateType: "fixed",
			status: "active",
			termMonths: 12,
			termStartDate: "2026-05-01",
		});
	});
}

describe("admin mortgage ownership overrides", () => {
	it("assigns a minted-only mortgage to the FairLend MIC through auditable ledger entries", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		await seedDefaultOriginationOwner(t);
		await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.ledger.sequenceCounter.initializeSequenceCounter,
			{}
		);
		const mortgageId = await seedMortgage(t);
		await t.withIdentity(FAIRLEND_ADMIN).mutation(api.ledger.mutations.mintMortgage, {
			effectiveDate: "2026-05-01",
			idempotencyKey: `ownership-test:${String(mortgageId)}:mint`,
			mortgageId: String(mortgageId),
			source: {
				actor: FAIRLEND_ADMIN.subject,
				channel: "test",
				type: "user",
			},
		});

		const result = await t.withIdentity(FAIRLEND_ADMIN).mutation(
			assignMortgageFractionsToFairLendMicRef,
			{
				mortgageId,
				reason: "Repair seeded mortgage ownership for MIC portal visibility.",
			}
		);

		const micLenderAuthId = seedAuthIdFromEmail(FAIRLEND_MIC_LENDER_EMAIL);
		const ledger = await t.withIdentity(FAIRLEND_ADMIN).query(
			api.ledger.queries.validateSupplyInvariant,
			{ mortgageId: String(mortgageId) }
		);
		const history = await t.withIdentity(FAIRLEND_ADMIN).query(
			api.ledger.queries.getMortgageHistory,
			{ mortgageId: String(mortgageId) }
		);

		expect(result).toMatchObject({
			entriesPosted: 1,
			micLenderAuthId,
			micPositionUnits: Number(TOTAL_SUPPLY),
			mortgageId,
			targetUnits: Number(TOTAL_SUPPLY),
		});
		expect(ledger.valid).toBe(true);
		expect(ledger.treasury).toBe(0n);
		expect(ledger.positions[micLenderAuthId]).toBe(TOTAL_SUPPLY);
		expect(history.some((entry) => entry.entryType === "CORRECTION")).toBe(true);
		expect(
			history.find((entry) => entry.entryType === "CORRECTION")?.reason
		).toBe("Repair seeded mortgage ownership for MIC portal visibility.");
	});
});
