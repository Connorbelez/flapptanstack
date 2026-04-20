import { describe, expect, it } from "vitest";
import { api } from "../../../../convex/_generated/api";
import { getRequiredDefaultOriginationOwner } from "../../../../convex/platform/defaultOriginationOwner";
import { createTestConvex, ensureSeededIdentity } from "../../auth/helpers";
import { FAIRLEND_ADMIN } from "../../auth/identities";

describe("seedPlatformOwnership chaos", () => {
	it("keeps replays pinned to the original FairLend MIC trust account even after duplicate trust accounts appear", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);

		const brokers = await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.seed.seedBroker.seedBroker,
			{}
		);
		const first = await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.seed.seedPlatformOwnership.seedPlatformOwnership,
			{ brokerId: brokers.brokerIds[0] }
		);

		await t.run(async (ctx) => {
			const now = Date.now();
			await ctx.db.insert("bankAccounts", {
				accountLast4: "5511",
				country: "CA",
				createdAt: now + 1,
				currency: "CAD",
				institutionNumber: "001",
				mandateStatus: "not_required",
				ownerId: String(first.defaultOriginationInvestmentVehicleId),
				ownerType: "trust",
				status: "validated",
				transitNumber: "00022",
				updatedAt: now + 1,
				validationMethod: "manual",
			});
			await ctx.db.insert("bankAccounts", {
				accountLast4: "8822",
				country: "CA",
				createdAt: now + 2,
				currency: "CAD",
				institutionNumber: "001",
				mandateStatus: "not_required",
				ownerId: String(first.defaultOriginationInvestmentVehicleId),
				ownerType: "trust",
				status: "validated",
				transitNumber: "00033",
				updatedAt: now + 2,
				validationMethod: "manual",
			});
		});

		const second = await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.seed.seedPlatformOwnership.seedPlatformOwnership,
			{ brokerId: brokers.brokerIds[0] }
		);
		const third = await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.seed.seedPlatformOwnership.seedPlatformOwnership,
			{ brokerId: brokers.brokerIds[0] }
		);

		expect(second.defaultFairlendTrustBankAccountId).toBe(
			first.defaultFairlendTrustBankAccountId
		);
		expect(third.defaultFairlendTrustBankAccountId).toBe(
			first.defaultFairlendTrustBankAccountId
		);
		expect(second.reused.bankAccounts).toBe(1);
		expect(third.reused.bankAccounts).toBe(1);

		const snapshot = await t.run(async (ctx) => {
			const resolved = await getRequiredDefaultOriginationOwner(ctx);
			const platformSettings = await ctx.db.query("platformSettings").collect();
			const trustAccounts = await ctx.db
				.query("bankAccounts")
				.withIndex("by_owner", (query) =>
					query
						.eq("ownerType", "trust")
						.eq("ownerId", String(first.defaultOriginationInvestmentVehicleId))
				)
				.collect();

			return { platformSettings, resolved, trustAccounts };
		});

		expect(snapshot.platformSettings).toHaveLength(1);
		expect(snapshot.trustAccounts).toHaveLength(3);
		expect(snapshot.resolved.settings.defaultFairlendTrustBankAccountId).toBe(
			first.defaultFairlendTrustBankAccountId
		);
		expect(snapshot.resolved.trustBankAccount?._id).toBe(
			first.defaultFairlendTrustBankAccountId
		);
		expect(snapshot.resolved.lender._id).toBe(first.defaultOriginationLenderId);
		expect(snapshot.resolved.investmentVehicle._id).toBe(
			first.defaultOriginationInvestmentVehicleId
		);
		expect(snapshot.resolved.workspace?._id).toBe(
			first.defaultOriginationWorkspaceId
		);
	});
});
