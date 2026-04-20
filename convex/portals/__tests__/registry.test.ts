import { describe, expect, it } from "vitest";
import migrationsSchema from "../../../node_modules/@convex-dev/migrations/dist/component/schema.js";
import {
	createMockViewer,
	createTestConvex,
	ensureSeededIdentity,
} from "../../../src/test/auth/helpers";
import { FAIRLEND_ADMIN } from "../../../src/test/auth/identities";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import {
	FAIRLEND_BROKERAGE_ORG_ID,
	FAIRLEND_STAFF_ORG_ID,
} from "../../constants";
import { DEFAULT_PORTAL_POST_AUTH_PATH } from "../helpers";
import { assertPortalRegistryInvariants } from "../invariants";

const migrationsModules = import.meta.glob(
	"../../../node_modules/@convex-dev/migrations/dist/component/**/*.js"
);
const ALREADY_CLAIMED_ERROR_REGEX = /already claimed/;
const DUPLICATE_PORTAL_CLAIM_ERROR_REGEX = /Duplicate portal claim/;

function createHarness() {
	const t = createTestConvex();
	t.registerComponent("migrations", migrationsSchema, migrationsModules);
	return t;
}

function buildPortalRecord(overrides?: {
	brokerId?: Id<"brokers">;
	localHost?: string;
	orgId?: string;
	portalType?: "broker" | "fairlend";
	productionHost?: string;
	slug?: string;
}) {
	const now = Date.now();
	return {
		slug: overrides?.slug ?? "portal",
		portalType: overrides?.portalType ?? "broker",
		brokerId: overrides?.brokerId,
		orgId: overrides?.orgId ?? "org_portal",
		productionHost:
			overrides?.productionHost ?? `${overrides?.slug ?? "portal"}.fairlend.ca`,
		localHost:
			overrides?.localHost ?? `${overrides?.slug ?? "portal"}.localhost:3000`,
		status: "active" as const,
		isPublished: true,
		publicTeaserEnabled: true,
		teaserListingLimit: 12,
		defaultPostAuthPath: DEFAULT_PORTAL_POST_AUTH_PATH,
		createdAt: now,
		updatedAt: now,
	};
}

async function seedPortalBackfillFixture(t: ReturnType<typeof createHarness>) {
	await ensureSeededIdentity(t, FAIRLEND_ADMIN);

	return await t.run(async (ctx) => {
		const now = Date.now();
		const brokerOrgId = "org_brokerage_meridian";

		const adminUser = await ctx.db
			.query("users")
			.withIndex("authId", (query) =>
				query.eq("authId", FAIRLEND_ADMIN.subject)
			)
			.unique();
		if (!adminUser) {
			throw new Error("Expected seeded FairLend admin user");
		}

		await ctx.db.insert("organizationMemberships", {
			workosId: "om_fairlend_admin",
			organizationWorkosId: FAIRLEND_STAFF_ORG_ID,
			organizationName: "FairLend Staff",
			userWorkosId: FAIRLEND_ADMIN.subject,
			status: "active",
			roleSlug: "admin",
			roleSlugs: ["admin"],
		});

		const brokerUserId = await ctx.db.insert("users", {
			authId: "user_broker_meridian",
			email: "broker-meridian@test.fairlend.ca",
			firstName: "Meridian",
			lastName: "Broker",
		});
		const brokerId = await ctx.db.insert("brokers", {
			status: "active",
			lastTransitionAt: undefined,
			userId: brokerUserId,
			licenseId: undefined,
			licenseProvince: undefined,
			brokerageName: "Meridian Mortgage Group",
			orgId: undefined,
			onboardedAt: now,
			createdAt: now,
		});
		await ctx.db.insert("organizationMemberships", {
			workosId: "om_broker_meridian",
			organizationWorkosId: brokerOrgId,
			organizationName: "Meridian Mortgage Group",
			userWorkosId: "user_broker_meridian",
			status: "active",
			roleSlug: "admin",
			roleSlugs: ["admin"],
		});
		await ctx.db.insert("lenderOnboardings", {
			status: "approved",
			machineContext: undefined,
			lastTransitionAt: undefined,
			entryPath: "admin_invite",
			lenderId: undefined,
			brokerId,
			email: "investor-meridian@test.fairlend.ca",
			inviteToken: undefined,
			adminInviteToken: undefined,
			invitedByAdminId: undefined,
			subdomain: "Meridian",
			fullName: "Meridian Investor",
			phone: undefined,
			address: undefined,
			accreditationStatus: undefined,
			personaInquiryId: undefined,
			idvResult: undefined,
			kycDocumentIds: undefined,
			kycResult: undefined,
			verificationScore: undefined,
			startedAt: now,
			lastActivityAt: now,
			expiresAt: now + 86_400_000,
			createdAt: now,
		});

		const borrowerUserId = await ctx.db.insert("users", {
			authId: "user_borrower_meridian",
			email: "borrower-meridian@test.fairlend.ca",
			firstName: "Borrower",
			lastName: "Meridian",
		});
		await ctx.db.insert("borrowers", {
			status: "active",
			lastTransitionAt: undefined,
			orgId: brokerOrgId,
			userId: borrowerUserId,
			financialProfile: undefined,
			idvStatus: undefined,
			personaInquiryId: undefined,
			creationSource: undefined,
			originatingWorkflowId: undefined,
			originatingWorkflowType: undefined,
			workflowSourceId: undefined,
			workflowSourceKey: undefined,
			workflowSourceType: undefined,
			onboardedAt: now,
			createdAt: now,
		});

		const fallbackUserId = await ctx.db.insert("users", {
			authId: "user_member_default_portal",
			email: "member-default@test.fairlend.ca",
			firstName: "Default",
			lastName: "Member",
		});

		return {
			adminUserId: adminUser._id,
			borrowerUserId,
			brokerId,
			brokerOrgId,
			brokerUserId,
			fallbackUserId,
		};
	});
}

describe("portal registry backfill", () => {
	it("syncs a freshly created user's home portal to the FairLend app portal", async () => {
		const t = createHarness();
		const authId = "user_marketing_signup";
		const userId = await t.run(async (ctx) => {
			return ctx.db.insert("users", {
				authId,
				email: "marketing-signup@test.fairlend.ca",
				firstName: "Marketing",
				lastName: "Signup",
			});
		});

		const result = await t.mutation(
			internal.auth.syncUserHomePortalAssignment,
			{
				authId,
			}
		);
		expect(String(result?.userId)).toBe(String(userId));

		const fairLendPortal = await t.query(
			api.portals.queries.getFairLendPortal,
			{}
		);
		expect(fairLendPortal?.slug).toBe("app");

		const user = await t.run(async (ctx) => await ctx.db.get(userId));
		expect(String(user?.homePortalId)).toBe(String(fairLendPortal?.portalId));
	});

	it("creates FairLend and broker portal rows and assigns home portals deterministically", async () => {
		const t = createHarness();
		const fixture = await seedPortalBackfillFixture(t);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);

		await asAdmin.mutation(
			api.brokers.migrations.runPortalRegistryBackfill,
			{}
		);

		const status = await asAdmin.query(
			api.brokers.migrations.getPortalRegistryBackfillStatus,
			{}
		);
		expect(status.fairLendPortalExists).toBe(true);
		expect(status.brokersMissingOrgIdCount).toBe(0);
		expect(status.brokersMissingPortalCount).toBe(0);
		expect(status.usersMissingHomePortalCount).toBe(0);

		const fairLendPortal = await t.query(
			api.portals.queries.getFairLendPortal,
			{}
		);
		expect(fairLendPortal?.portalType).toBe("fairlend");
		expect(fairLendPortal?.slug).toBe("app");
		const fairLendPortalByHost = await t.query(
			api.portals.queries.resolvePortalByHost,
			{
				host: "APP.localhost:3000",
			}
		);
		expect(fairLendPortalByHost?.portal.portalType).toBe("fairlend");
		expect(fairLendPortalByHost?.canonicalHost).toBe("app.localhost:3000");

		const brokerPortal = await t.query(
			api.portals.queries.resolvePortalByHost,
			{
				host: "MERIDIAN.localhost:3000",
			}
		);
		expect(brokerPortal?.portal.slug).toBe("meridian");
		expect(brokerPortal?.portal.portalType).toBe("broker");
		expect(brokerPortal?.canonicalHost).toBe("meridian.localhost:3000");

		const records = await t.run(async (ctx) => {
			const broker = await ctx.db.get(fixture.brokerId);
			const brokerUser = await ctx.db.get(fixture.brokerUserId);
			const borrowerUser = await ctx.db.get(fixture.borrowerUserId);
			const fallbackUser = await ctx.db.get(fixture.fallbackUserId);
			const adminUser = await ctx.db.get(fixture.adminUserId);
			const brokerPortalRow = await ctx.db
				.query("portals")
				.withIndex("by_broker", (query) =>
					query.eq("brokerId", fixture.brokerId)
				)
				.unique();
			return {
				adminUser,
				borrowerUser,
				broker,
				brokerPortalRow,
				brokerUser,
				fallbackUser,
			};
		});

		expect(records.broker?.orgId).toBe(fixture.brokerOrgId);
		expect(records.brokerPortalRow?.orgId).toBe(fixture.brokerOrgId);
		expect(records.brokerUser?.homePortalId).toBe(
			brokerPortal?.portal.portalId as Id<"portals">
		);
		expect(records.borrowerUser?.homePortalId).toBe(
			brokerPortal?.portal.portalId as Id<"portals">
		);
		expect(records.fallbackUser?.homePortalId).toBe(
			fairLendPortal?.portalId as Id<"portals">
		);
		expect(records.adminUser?.homePortalId).toBe(
			fairLendPortal?.portalId as Id<"portals">
		);
	});

	it("rejects conflicting FairLend host claims during the portal backfill", async () => {
		const t = createHarness();
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);

		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		await t.run(async (ctx) => {
			await ctx.db.insert("organizationMemberships", {
				workosId: "om_fairlend_admin_conflict",
				organizationWorkosId: FAIRLEND_STAFF_ORG_ID,
				organizationName: "FairLend Staff",
				userWorkosId: FAIRLEND_ADMIN.subject,
				status: "active",
				roleSlug: "admin",
				roleSlugs: ["admin"],
			});
			await ctx.db.insert(
				"portals",
				buildPortalRecord({
					localHost: "legacy-app.localhost:3000",
					orgId: FAIRLEND_BROKERAGE_ORG_ID,
					portalType: "fairlend",
					productionHost: "legacy-app.fairlend.ca",
					slug: "app",
				})
			);
			await ctx.db.insert(
				"portals",
				buildPortalRecord({
					localHost: "app.localhost:3000",
					orgId: "org_conflict_shadow",
					productionHost: "app.fairlend.ca",
					slug: "shadow-app",
				})
			);
			await ctx.db.insert(
				"portals",
				buildPortalRecord({
					localHost: "shadow.localhost:3000",
					orgId: "org_conflict_shadow_two",
					productionHost: "shadow.fairlend.ca",
					slug: "shadow-two",
				})
			);
		});

		await expect(
			asAdmin.mutation(api.brokers.migrations.runPortalRegistryBackfill, {})
		).rejects.toThrow(ALREADY_CLAIMED_ERROR_REGEX);
	});

	it("throws when duplicate portal host rows already exist at read time", async () => {
		const t = createHarness();

		await t.run(async (ctx) => {
			await ctx.db.insert(
				"portals",
				buildPortalRecord({
					localHost: "duplicate.localhost:3000",
					orgId: "org_duplicate_a",
					productionHost: "duplicate-a.fairlend.ca",
					slug: "duplicate-a",
				})
			);
			await ctx.db.insert(
				"portals",
				buildPortalRecord({
					localHost: "duplicate.localhost:3000",
					orgId: "org_duplicate_b",
					productionHost: "duplicate-b.fairlend.ca",
					slug: "duplicate-b",
				})
			);
		});

		await expect(
			t.query(api.portals.queries.resolvePortalByHost, {
				host: "duplicate.localhost:3000",
			})
		).rejects.toThrow(DUPLICATE_PORTAL_CLAIM_ERROR_REGEX);
	});

	it("returns the authenticated viewer's home portal assignment and admin bypass flag", async () => {
		const t = createHarness();
		const fixture = await seedPortalBackfillFixture(t);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);

		await asAdmin.mutation(
			api.brokers.migrations.runPortalRegistryBackfill,
			{}
		);

		const brokerViewer = createMockViewer({
			subject: "user_broker_meridian",
			email: "broker-meridian@test.fairlend.ca",
			firstName: "Meridian",
			lastName: "Broker",
			orgId: fixture.brokerOrgId,
			orgName: "Meridian Mortgage Group",
			roles: ["admin"],
		});

		const brokerResult = await t
			.withIdentity(brokerViewer)
			.query(api.portals.queries.getViewerHomePortal, {});
		expect(brokerResult.isFairLendAdmin).toBe(false);
		expect(String(brokerResult.homePortalId)).toBe(
			String(brokerResult.homePortal?.portalId)
		);
		expect(brokerResult.homePortal?.slug).toBe("meridian");

		const adminResult = await asAdmin.query(
			api.portals.queries.getViewerHomePortal,
			{}
		);
		expect(adminResult.isFairLendAdmin).toBe(true);
		expect(adminResult.homePortal?.slug).toBe("app");
		expect(String(adminResult.homePortalId)).toBe(
			String(adminResult.homePortal?.portalId)
		);
	});
});

describe("portal registry cross-host invariants", () => {
	it("rejects a candidate production host that matches another portal's local host", async () => {
		const t = createHarness();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		await t.run(async (ctx) => {
			await ctx.db.insert(
				"portals",
				buildPortalRecord({
					slug: "cross-host-alpha",
					orgId: "org_cross_alpha",
					localHost: "cross-alpha.localhost:3000",
					productionHost: "cross-alpha.fairlend.ca",
				})
			);
			await expect(
				assertPortalRegistryInvariants(ctx, {
					orgId: "org_cross_beta",
					slug: "cross-host-beta",
					localHost: "cross-beta.localhost:3000",
					productionHost: "cross-alpha.localhost:3000",
				})
			).rejects.toThrow(/collides with another portal's local host/);
		});
	});

	it("rejects a candidate local host that matches another portal's production host", async () => {
		const t = createHarness();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		await t.run(async (ctx) => {
			await ctx.db.insert(
				"portals",
				buildPortalRecord({
					slug: "cross-host-gamma",
					orgId: "org_cross_gamma",
					localHost: "cross-gamma.localhost:3000",
					productionHost: "shared-prod-host.fairlend.ca",
				})
			);
			await expect(
				assertPortalRegistryInvariants(ctx, {
					orgId: "org_cross_delta",
					slug: "cross-host-delta",
					localHost: "shared-prod-host.fairlend.ca",
					productionHost: "cross-delta.fairlend.ca",
				})
			).rejects.toThrow(/collides with another portal's production host/);
		});
	});
});
