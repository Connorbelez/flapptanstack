import { describe, expect, it } from "vitest";
import { api } from "../../../../convex/_generated/api";
import { getRequiredDefaultOriginationOwner } from "../../../../convex/platform/defaultOriginationOwner";
import {
	MIC_PORTAL_DEFAULT_POST_AUTH_PATH,
	MIC_PORTAL_LOCAL_HOST,
	MIC_PORTAL_PRODUCTION_HOST,
	MIC_PORTAL_SLUG,
} from "../../../../convex/portals/helpers";
import { FAIRLEND_MIC_LENDER_EMAIL } from "../../../../convex/platform/defaultOriginationOwnerContract";
import { seedAuthIdFromEmail } from "../../../../convex/seed/seedHelpers";
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

	it("keeps replays pinned to the original trust account when duplicate MIC trust accounts exist", async () => {
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

		const snapshot = await t.run(async (ctx) => {
			const resolved = await getRequiredDefaultOriginationOwner(ctx);
			const trustAccounts = await ctx.db
				.query("bankAccounts")
				.withIndex("by_owner", (query) =>
					query
						.eq("ownerType", "trust")
						.eq("ownerId", String(first.defaultOriginationInvestmentVehicleId))
				)
				.collect();

			return { resolved, trustAccounts };
		});

		expect(second.defaultFairlendTrustBankAccountId).toBe(
			first.defaultFairlendTrustBankAccountId
		);
		expect(second.reused.bankAccounts).toBe(1);
		expect(snapshot.trustAccounts).toHaveLength(3);
		expect(snapshot.resolved.trustBankAccount?._id).toBe(
			first.defaultFairlendTrustBankAccountId
		);
	});

	it("repairs the canonical MIC portal host with the FairLend MIC lender mapping", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);

		const now = Date.now();
		const brokenPortalId = await t.run(async (ctx) => {
			return await ctx.db.insert("portals", {
				createdAt: now,
				defaultPostAuthPath: MIC_PORTAL_DEFAULT_POST_AUTH_PATH,
				isPublished: true,
				localHost: MIC_PORTAL_LOCAL_HOST,
				orgId: "org_mic_investors",
				portalType: "mic",
				productionHost: "mic-e2e.fairlend.test",
				publicTeaserEnabled: false,
				slug: MIC_PORTAL_SLUG,
				status: "active",
				teaserListingLimit: 0,
				updatedAt: now,
			});
		});

		const before = await t.query(api.portals.queries.resolvePortalByHost, {
			host: MIC_PORTAL_LOCAL_HOST,
		});
		expect(before?.availability).toBe("misconfigured");

		const repaired = await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.seed.seedPlatformOwnership.ensureFairLendMicPortal,
			{
				orgId: "org_fairlend_mic",
			}
		);
		const after = await t.query(api.portals.queries.resolvePortalByHost, {
			host: MIC_PORTAL_LOCAL_HOST,
		});
		const portal = await t.run(async (ctx) => {
			return await ctx.db.get(repaired.portalId);
		});

		expect(repaired.wasCreated).toBe(false);
		expect(repaired.portalId).toBe(brokenPortalId);
		expect(repaired.micLenderAuthId).toBe(
			seedAuthIdFromEmail(FAIRLEND_MIC_LENDER_EMAIL)
		);
		expect(after?.availability).toBe("active");
		expect(after?.portal.productionHost).toBe(MIC_PORTAL_PRODUCTION_HOST);
		expect(portal?.micLenderAuthId).toBe(repaired.micLenderAuthId);
		expect(portal?.orgId).toBe("org_fairlend_mic");
	});
});
