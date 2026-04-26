import { describe, expect, it } from "vitest";
import { api, components } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
	FAIRLEND_PORTAL_LOCAL_HOST,
	FAIRLEND_PORTAL_PRODUCTION_HOST,
	FAIRLEND_PORTAL_SLUG,
} from "../../../../../convex/portals/helpers";
import { createTestConvex, ensureSeededIdentity } from "../../../auth/helpers";
import { FAIRLEND_ADMIN } from "../../../auth/identities";

function buildPortalRecord(overrides: {
	localHost: string;
	orgId: string;
	portalType: "broker" | "fairlend";
	productionHost: string;
	slug: string;
}) {
	const now = 1_710_001_000_000;
	return {
		brokerId: undefined,
		createdAt: now,
		defaultPostAuthPath: "/",
		isPublished: true,
		landingPageId: undefined,
		localHost: overrides.localHost,
		orgId: overrides.orgId,
		portalType: overrides.portalType,
		pricingPolicyId: undefined,
		productionHost: overrides.productionHost,
		publicTeaserEnabled: true,
		slug: overrides.slug,
		status: "active" as const,
		teaserListingLimit: 12,
		updatedAt: now,
	};
}

async function seedSettingsFixture(t: ReturnType<typeof createTestConvex>) {
	await ensureSeededIdentity(t, FAIRLEND_ADMIN);

	return await t.run(async (ctx) => {
		await ctx.db.insert("organizations", {
			allowProfilesOutsideOrganization: false,
			externalId: undefined,
			metadata: {},
			name: "FairLend Staff",
			workosId: FAIRLEND_ADMIN.org_id ?? "org_fairlend_staff",
		});
		await ctx.db.insert("organizationMemberships", {
			organizationName: "FairLend Staff",
			organizationWorkosId: FAIRLEND_ADMIN.org_id ?? "org_fairlend_staff",
			roleSlug: "admin",
			roleSlugs: ["admin"],
			status: "active",
			userWorkosId: FAIRLEND_ADMIN.subject,
			workosId: "om_fairlend_admin_settings",
		});

		const fairLendPortalId = await ctx.db.insert(
			"portals",
			buildPortalRecord({
				localHost: FAIRLEND_PORTAL_LOCAL_HOST,
				orgId: "org_fairlend",
				portalType: "fairlend",
				productionHost: FAIRLEND_PORTAL_PRODUCTION_HOST,
				slug: FAIRLEND_PORTAL_SLUG,
			})
		);
		const brokerPortalIds = await Promise.all([
			ctx.db.insert(
				"portals",
				buildPortalRecord({
					localHost: "meridian.localhost:3000",
					orgId: "org_meridian",
					portalType: "broker",
					productionHost: "meridian.fairlend.ca",
					slug: "meridian",
				})
			),
			ctx.db.insert(
				"portals",
				buildPortalRecord({
					localHost: "harbour.localhost:3000",
					orgId: "org_harbour",
					portalType: "broker",
					productionHost: "harbour.fairlend.ca",
					slug: "harbour",
				})
			),
		]);

		return {
			brokerPortalIds,
			fairLendPortalId,
		};
	});
}

async function getSelectedBrokerSplitPercent(
	t: ReturnType<typeof createTestConvex>,
	portalId: Id<"portals">
) {
	return await t.run(async (ctx) => {
		const portal = await ctx.db.get(portalId);
		if (!portal?.pricingPolicyId) {
			return null;
		}

		const policy = await ctx.db.get(portal.pricingPolicyId);
		return policy?.brokerSplitPercent ?? null;
	});
}

describe("broker portal pricing settings", () => {
	it("boots the singleton setting at 0% and fans it out to broker portals", async () => {
		const t = createTestConvex();
		const fixture = await seedSettingsFixture(t);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);

		const result = await asAdmin.mutation(
			api.admin.settings.mutations.setBrokerPortalPricing,
			{
				brokerSplitPercent: 0,
			}
		);

		expect(result.brokerSplitPercent).toBe(0);
		expect(result.brokerPortalCount).toBe(2);

		const snapshot = await asAdmin.query(api.admin.settings.queries.getOrgSettings, {});
		expect(snapshot?.brokerPortalPricing.brokerSplitPercent).toBe(0);
		expect(snapshot?.brokerPortalPricing.brokerPortalCount).toBe(2);
		expect(snapshot?.brokerPortalPricing.driftedBrokerPortalCount).toBe(0);

		expect(
			await getSelectedBrokerSplitPercent(t, fixture.brokerPortalIds[0] as Id<"portals">)
		).toBe(0);
		expect(
			await getSelectedBrokerSplitPercent(t, fixture.brokerPortalIds[1] as Id<"portals">)
		).toBe(0);
		expect(
			await getSelectedBrokerSplitPercent(t, fixture.fairLendPortalId)
		).toBe(0);
	});

	it("updates broker portals to a non-zero split, stays idempotent, and keeps FairLend pinned at 0%", async () => {
		const t = createTestConvex();
		const fixture = await seedSettingsFixture(t);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);

		await asAdmin.mutation(api.admin.settings.mutations.setBrokerPortalPricing, {
			brokerSplitPercent: 15,
		});

		const firstCounts = await t.run(async (ctx) => ({
			policies: (await ctx.db.query("portalPricingPolicies").collect()).length,
			settings: (await ctx.db.query("brokerPortalPricingSettings").collect()).length,
		}));

		await asAdmin.mutation(api.admin.settings.mutations.setBrokerPortalPricing, {
			brokerSplitPercent: 15,
		});

		const secondCounts = await t.run(async (ctx) => ({
			policies: (await ctx.db.query("portalPricingPolicies").collect()).length,
			settings: (await ctx.db.query("brokerPortalPricingSettings").collect()).length,
		}));

		expect(firstCounts.settings).toBe(1);
		expect(secondCounts.settings).toBe(1);
		expect(secondCounts.policies).toBe(firstCounts.policies);
		expect(
			await getSelectedBrokerSplitPercent(t, fixture.brokerPortalIds[0] as Id<"portals">)
		).toBe(15);
		expect(
			await getSelectedBrokerSplitPercent(t, fixture.brokerPortalIds[1] as Id<"portals">)
		).toBe(15);
		expect(
			await getSelectedBrokerSplitPercent(t, fixture.fairLendPortalId)
		).toBe(0);

		const settingsRow = await t.run(async (ctx) =>
			(await ctx.db.query("brokerPortalPricingSettings").collect())[0] ?? null
		);
		expect(settingsRow).not.toBeNull();

		const auditEntries = await t.query(components.auditLog.lib.queryByResource, {
			resourceId: settingsRow!._id,
			resourceType: "brokerPortalPricingSettings",
		});
		const updateEntry = auditEntries.find(
			(entry: { action: string }) =>
				entry.action === "portal.broker_pricing.updated"
		);
		expect(updateEntry).toBeDefined();
		expect(updateEntry?.actorId).toBe(FAIRLEND_ADMIN.subject);
		expect(updateEntry?.metadata).toMatchObject({
			newBrokerSplitPercent: 15,
			previousBrokerSplitPercent: 0,
		});
	});
});
