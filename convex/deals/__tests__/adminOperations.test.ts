import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../../_generated/api";
import { FAIRLEND_STAFF_ORG_ID } from "../../constants";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";

const modules = convexModules;

const ADMIN_IDENTITY = {
	subject: "admin-auth",
	issuer: "https://api.workos.com",
	org_id: FAIRLEND_STAFF_ORG_ID,
	organization_name: "FairLend Staff",
	role: "admin",
	roles: JSON.stringify(["admin"]),
	permissions: JSON.stringify(["admin:access"]),
	user_email: "admin@test.fairlend.ca",
	user_first_name: "Admin",
	user_last_name: "User",
};

type TestHarness = ReturnType<typeof convexTest>;

async function seedAdminDeal(
	t: TestHarness,
	overrides: {
		deleteMortgage?: boolean;
		status?: string;
	} = {}
) {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {
			authId: "seed-admin",
			email: "admin@test.fairlend.ca",
			firstName: "Admin",
			lastName: "User",
		});
		const propertyId = await ctx.db.insert("properties", {
			streetAddress: "123 Admin Ops St",
			city: "Toronto",
			province: "ON",
			postalCode: "M5V 1A1",
			propertyType: "residential",
			createdAt: 1,
		});
		const brokerId = await ctx.db.insert("brokers", {
			status: "active",
			userId,
			createdAt: 1,
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			status: "funded",
			propertyId,
			principal: 500_000,
			interestRate: 9.5,
			rateType: "fixed",
			termMonths: 60,
			amortizationMonths: 300,
			paymentAmount: 2500,
			paymentFrequency: "monthly",
			loanType: "conventional",
			lienPosition: 1,
			interestAdjustmentDate: "2026-01-01",
			termStartDate: "2026-01-01",
			maturityDate: "2031-01-01",
			firstPaymentDate: "2026-02-01",
			brokerOfRecordId: brokerId,
			createdAt: 1,
		});
		const dealId = await ctx.db.insert("deals", {
			status: overrides.status ?? "initiated",
			mortgageId,
			buyerId: "buyer-auth",
			sellerId: "seller-auth",
			fractionalShare: 2500,
			closingDate: 2,
			createdAt: 1,
			createdBy: "seed-admin",
		});
		if (overrides.deleteMortgage) {
			await ctx.db.delete(mortgageId);
		}
		return { dealId, mortgageId };
	});
}

describe("admin deal operations projection", () => {
	let t: TestHarness;

	beforeEach(() => {
		t = convexTest(schema, modules);
	});

	it("keeps deals with missing mortgage rows visible with a critical blocker", async () => {
		const { dealId } = await seedAdminDeal(t, { deleteMortgage: true });

		const projection = await t
			.withIdentity(ADMIN_IDENTITY)
			.query(api.deals.queries.getAdminDealOperations);
		const card = projection.cards.find((entry) => entry._id === dealId);

		expect(card).toBeDefined();
		expect(card?.blockers).toContainEqual(
			expect.objectContaining({
				kind: "missing_contract",
				severity: "critical",
			})
		);
		expect(card?.filters).toContain("blocked");

		const detail = await t
			.withIdentity(ADMIN_IDENTITY)
			.query(api.deals.queries.getAdminDealOperationsDetail, { dealId });

		expect(detail).not.toBeNull();
		expect(detail?.mortgage).toBeNull();
		expect(detail?.blockers).toContainEqual(
			expect.objectContaining({
				kind: "missing_contract",
				severity: "critical",
			})
		);
	});

	it("surfaces unknown deal statuses as missing contract state", async () => {
		const { dealId } = await seedAdminDeal(t, {
			status: "escrow.unmapped",
		});

		const projection = await t
			.withIdentity(ADMIN_IDENTITY)
			.query(api.deals.queries.getAdminDealOperations);
		const card = projection.cards.find((entry) => entry._id === dealId);

		expect(card?.lifecycle.phase).toBe("unknown");
		expect(card?.nextAction).toBeNull();
		expect(card?.actions).toEqual([]);
		expect(card?.blockers).toContainEqual(
			expect.objectContaining({
				kind: "missing_contract",
				severity: "critical",
			})
		);
		expect(projection.columns.unknown.map((entry) => entry._id)).toContain(
			dealId
		);
	});

	it("projects cancel as a server action on non-terminal cards", async () => {
		const { dealId } = await seedAdminDeal(t);

		const projection = await t
			.withIdentity(ADMIN_IDENTITY)
			.query(api.deals.queries.getAdminDealOperations);
		const card = projection.cards.find((entry) => entry._id === dealId);

		expect(card?.actions.map((action) => action.event)).toEqual([
			"DEAL_LOCKED",
			"DEAL_CANCELLED",
		]);
	});

	it("does not project lawyer verification as actionable without a selected lawyer", async () => {
		const { dealId } = await seedAdminDeal(t, {
			status: "lawyerOnboarding.pending",
		});

		const projection = await t
			.withIdentity(ADMIN_IDENTITY)
			.query(api.deals.queries.getAdminDealOperations);
		const card = projection.cards.find((entry) => entry._id === dealId);

		expect(card?.actions.map((action) => action.event)).toEqual([
			"DEAL_CANCELLED",
		]);
		expect(card?.nextAction).toBeNull();
		expect(card?.filters).not.toContain("needs_action");

		const detail = await t
			.withIdentity(ADMIN_IDENTITY)
			.query(api.deals.queries.getAdminDealOperationsDetail, { dealId });

		expect(detail?.nextActions).toContainEqual(
			expect.objectContaining({
				disabledReason: "No selected lawyer is recorded for this deal.",
				event: "LAWYER_VERIFIED",
			})
		);
	});
});
