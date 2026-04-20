import { describe, expect, it } from "vitest";
import { api } from "../../../../convex/_generated/api";
import { createTestConvex, ensureSeededIdentity } from "../../auth/helpers";
import { FAIRLEND_ADMIN } from "../../auth/identities";

describe("seedPlatformOwnership", () => {
	it("creates one canonical lender/vehicle/workspace/settings pair and reuses it on replay", async () => {
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
		const second = await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.seed.seedPlatformOwnership.seedPlatformOwnership,
			{ brokerId: brokers.brokerIds[0] }
		);

		expect(first.defaultOriginationLenderId).toBe(
			second.defaultOriginationLenderId
		);
		expect(first.defaultOriginationInvestmentVehicleId).toBe(
			second.defaultOriginationInvestmentVehicleId
		);
		expect(first.created).toMatchObject({
			investmentVehicles: 1,
			investmentVehicleWorkspaces: 1,
			platformSettings: 1,
		});
		expect(second.reused.platformSettings).toBe(1);
	});
});
