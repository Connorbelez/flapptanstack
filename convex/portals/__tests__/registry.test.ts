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
import { FAIRLEND_STAFF_ORG_ID } from "../../constants";
import { getLatestOnboardingPortalIdForUser } from "../borrowerPortalAttribution";
import {
	DEFAULT_PORTAL_POST_AUTH_PATH,
	MIC_PORTAL_DEFAULT_POST_AUTH_PATH,
	MIC_PORTAL_LOCAL_HOST,
	MIC_PORTAL_PRODUCTION_HOST,
	MIC_PORTAL_SLUG,
	micPortalFields,
} from "../helpers";
import { assertPortalRegistryInvariants } from "../invariants";

const migrationsModules = import.meta.glob(
	"../../../node_modules/@convex-dev/migrations/dist/component/**/*.js"
);
const ALREADY_CLAIMED_ERROR_REGEX = /already claimed/;
const DUPLICATE_PORTAL_CLAIM_ERROR_REGEX = /Duplicate portal claim/;
const LOCAL_HOST_COLLISION_ERROR_REGEX =
	/collides with another portal's local host/;
const PRODUCTION_HOST_COLLISION_ERROR_REGEX =
	/collides with another portal's production host/;

function createHarness() {
	const t = createTestConvex();
	t.registerComponent("migrations", migrationsSchema, migrationsModules);
	return t;
}

function buildPortalRecord(overrides?: {
	brokerId?: Id<"brokers">;
	localHost?: string;
	micLenderAuthId?: string;
	orgId?: string;
	portalType?: "broker" | "fairlend" | "mic";
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
		micLenderAuthId: overrides?.micLenderAuthId,
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
		const borrowerId = await ctx.db.insert("borrowers", {
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
		const onboardingAttributedRequestId = await ctx.db.insert(
			"onboardingRequests",
			{
				userId: borrowerUserId,
				requestedRole: "lender",
				status: "pending_review",
				referralSource: "self_signup",
				targetOrganizationId: FAIRLEND_STAFF_ORG_ID,
				createdAt: now + 1,
			}
		);

		const orgFallbackBorrowerUserId = await ctx.db.insert("users", {
			authId: "user_borrower_org_fallback",
			email: "borrower-org-fallback@test.fairlend.ca",
			firstName: "Borrower",
			lastName: "OrgFallback",
		});
		const orgFallbackBorrowerId = await ctx.db.insert("borrowers", {
			status: "active",
			lastTransitionAt: undefined,
			orgId: brokerOrgId,
			userId: orgFallbackBorrowerUserId,
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

		const unresolvedBorrowerUserId = await ctx.db.insert("users", {
			authId: "user_borrower_unresolved",
			email: "borrower-unresolved@test.fairlend.ca",
			firstName: "Borrower",
			lastName: "Unresolved",
		});
		const unresolvedBorrowerId = await ctx.db.insert("borrowers", {
			status: "active",
			lastTransitionAt: undefined,
			userId: unresolvedBorrowerUserId,
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
		const unresolvedOnboardingRequestId = await ctx.db.insert(
			"onboardingRequests",
			{
				userId: brokerUserId,
				requestedRole: "broker",
				status: "pending_review",
				referralSource: "self_signup",
				createdAt: now + 2,
			}
		);

		return {
			adminUserId: adminUser._id,
			borrowerAuthId: "user_borrower_meridian",
			borrowerId,
			borrowerUserId,
			brokerId,
			brokerOrgId,
			brokerUserId,
			fallbackUserId,
			onboardingAttributedRequestId,
			orgFallbackBorrowerId,
			orgFallbackBorrowerAuthId: "user_borrower_org_fallback",
			orgFallbackBorrowerUserId,
			unresolvedBorrowerId,
			unresolvedBorrowerUserId,
			unresolvedOnboardingRequestId,
		};
	});
}

describe("portal registry backfill", () => {
	it("resolves the latest attributed onboarding portal without requiring the newest request to be attributed", async () => {
		const t = createHarness();

		const result = await t.run(async (ctx) => {
			const now = Date.now();
			const userId = await ctx.db.insert("users", {
				authId: "user_latest_onboarding_portal",
				email: "latest-onboarding-portal@test.fairlend.ca",
				firstName: "Latest",
				lastName: "Portal",
			});
			const portalId = await ctx.db.insert("portals", {
				...buildPortalRecord({
					orgId: "org_latest_onboarding_portal",
					slug: "latest-onboarding",
				}),
				createdAt: now,
				updatedAt: now,
			});
			await ctx.db.insert("onboardingRequests", {
				userId,
				requestedRole: "broker",
				status: "approved",
				referralSource: "self_signup",
				portalId,
				createdAt: now,
			});
			await ctx.db.insert("onboardingRequests", {
				userId,
				requestedRole: "lender",
				status: "pending_review",
				referralSource: "self_signup",
				createdAt: now + 1,
			});

			return {
				portalId,
				resolvedPortalId: await getLatestOnboardingPortalIdForUser(ctx, userId),
			};
		});

		expect(result.resolvedPortalId).toBe(result.portalId);
	});

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

		const resolvedFairLendPortal = await t.query(
			api.portals.queries.resolvePortalByHost,
			{
				host: "app.localhost:3000",
			}
		);
		expect(resolvedFairLendPortal?.availability).toBe("active");

		const records = await t.run(async (ctx) => {
			const user = await ctx.db.get(userId);
			const portalRow = await ctx.db
				.query("portals")
				.withIndex("by_slug", (query) => query.eq("slug", "app"))
				.unique();
			const policy = portalRow?.pricingPolicyId
				? await ctx.db.get(portalRow.pricingPolicyId)
				: null;
			return { policy, portalRow, user };
		});
		expect(records.portalRow?.pricingPolicyId).toBeDefined();
		expect(String(records.user?.homePortalId)).toBe(
			String(records.portalRow?._id)
		);
		expect(records.policy?.brokerSplitPercent).toBe(0);
	});

	it("creates FairLend and broker portal rows and assigns home portals deterministically", async () => {
		const t = createHarness();
		const fixture = await seedPortalBackfillFixture(t);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);

		const runResult = await asAdmin.mutation(
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
		expect(status.onboardingRequestsMissingPortalCount).toBe(1);
		expect(status.unresolvedOnboardingRequestCount).toBe(1);
		expect(status.unresolvedOnboardingRequestIds).toEqual([
			fixture.unresolvedOnboardingRequestId,
		]);
		expect(status.borrowersMissingPortalCount).toBe(1);
		expect(status.unresolvedBorrowerCount).toBe(1);
		expect(status.unresolvedBorrowerIds).toEqual([
			fixture.unresolvedBorrowerId,
		]);
		expect(status.usersMissingHomePortalCount).toBe(0);
		expect(runResult).toEqual(status);

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
		expect(fairLendPortalByHost?.availability).toBe("active");
		expect(fairLendPortalByHost?.portal.portalType).toBe("fairlend");
		expect(fairLendPortalByHost?.canonicalHost).toBe("app.localhost:3000");

		const brokerPortal = await t.query(
			api.portals.queries.resolvePortalByHost,
			{
				host: "MERIDIAN.localhost:3000",
			}
		);
		expect(brokerPortal?.availability).toBe("active");
		expect(brokerPortal?.portal.slug).toBe("meridian");
		expect(brokerPortal?.portal.portalType).toBe("broker");
		expect(brokerPortal?.canonicalHost).toBe("meridian.localhost:3000");

		const records = await t.run(async (ctx) => {
			const broker = await ctx.db.get(fixture.brokerId);
			const borrower = await ctx.db.get(fixture.borrowerId);
			const brokerUser = await ctx.db.get(fixture.brokerUserId);
			const borrowerUser = await ctx.db.get(fixture.borrowerUserId);
			const orgFallbackBorrower = await ctx.db.get(
				fixture.orgFallbackBorrowerId
			);
			const orgFallbackBorrowerUser = await ctx.db.get(
				fixture.orgFallbackBorrowerUserId
			);
			const unresolvedBorrower = await ctx.db.get(fixture.unresolvedBorrowerId);
			const unresolvedBorrowerUser = await ctx.db.get(
				fixture.unresolvedBorrowerUserId
			);
			const fallbackUser = await ctx.db.get(fixture.fallbackUserId);
			const adminUser = await ctx.db.get(fixture.adminUserId);
			const onboardingAttributedRequest = await ctx.db.get(
				fixture.onboardingAttributedRequestId
			);
			const unresolvedOnboardingRequest = await ctx.db.get(
				fixture.unresolvedOnboardingRequestId
			);
			const brokerPortalRow = await ctx.db
				.query("portals")
				.withIndex("by_broker", (query) =>
					query.eq("brokerId", fixture.brokerId)
				)
				.unique();
			const fairLendPortalRow = await ctx.db
				.query("portals")
				.withIndex("by_slug", (query) => query.eq("slug", "app"))
				.unique();
			const brokerPolicies = brokerPortalRow
				? await ctx.db
						.query("portalPricingPolicies")
						.withIndex("by_portal", (query) =>
							query.eq("portalId", brokerPortalRow._id)
						)
						.collect()
				: [];
			const fairLendPolicies = fairLendPortalRow
				? await ctx.db
						.query("portalPricingPolicies")
						.withIndex("by_portal", (query) =>
							query.eq("portalId", fairLendPortalRow._id)
						)
						.collect()
				: [];
			return {
				adminUser,
				borrower,
				borrowerUser,
				broker,
				brokerPolicies,
				brokerPortalRow,
				brokerUser,
				fairLendPolicies,
				fairLendPortalRow,
				fallbackUser,
				onboardingAttributedRequest,
				orgFallbackBorrower,
				orgFallbackBorrowerUser,
				unresolvedBorrower,
				unresolvedBorrowerUser,
				unresolvedOnboardingRequest,
			};
		});

		expect(records.broker?.orgId).toBe(fixture.brokerOrgId);
		expect(records.brokerPortalRow?.orgId).toBe(fixture.brokerOrgId);
		expect(records.brokerPortalRow?.pricingPolicyId).toBeDefined();
		expect(
			records.brokerPolicies.find(
				(policy) => policy._id === records.brokerPortalRow?.pricingPolicyId
			)?.brokerSplitPercent
		).toBe(0);
		expect(records.fairLendPortalRow?.pricingPolicyId).toBeDefined();
		expect(
			records.fairLendPolicies.find(
				(policy) => policy._id === records.fairLendPortalRow?.pricingPolicyId
			)?.brokerSplitPercent
		).toBe(0);
		expect(records.onboardingAttributedRequest?.portalId).toBe(
			fairLendPortal?.portalId as Id<"portals">
		);
		expect(records.unresolvedOnboardingRequest?.portalId).toBeUndefined();
		expect(records.borrower?.portalId).toBe(
			fairLendPortal?.portalId as Id<"portals">
		);
		expect(records.orgFallbackBorrower?.portalId).toBe(
			brokerPortal?.portal.portalId as Id<"portals">
		);
		expect(records.unresolvedBorrower?.portalId).toBeUndefined();
		expect(records.brokerUser?.homePortalId).toBe(
			brokerPortal?.portal.portalId as Id<"portals">
		);
		expect(records.borrowerUser?.homePortalId).toBe(
			fairLendPortal?.portalId as Id<"portals">
		);
		expect(records.orgFallbackBorrowerUser?.homePortalId).toBe(
			brokerPortal?.portal.portalId as Id<"portals">
		);
		expect(records.unresolvedBorrowerUser?.homePortalId).toBe(
			fairLendPortal?.portalId as Id<"portals">
		);
		expect(records.fallbackUser?.homePortalId).toBe(
			fairLendPortal?.portalId as Id<"portals">
		);
		expect(records.adminUser?.homePortalId).toBe(
			fairLendPortal?.portalId as Id<"portals">
		);
	});

	it("resolves an active MIC portal as a first-class portal registry record", async () => {
		const t = createHarness();
		const micOrgId = "org_mic_investors";
		const micLenderAuthId = "lender_auth_mic";

		const micPortalId = await t.run(async (ctx) => {
			return await ctx.db.insert(
				"portals",
				micPortalFields({
					micLenderAuthId,
					now: Date.now(),
					orgId: micOrgId,
				})
			);
		});

		const byLocalHost = await t.query(api.portals.queries.resolvePortalByHost, {
			host: "MIC.localhost:3000.",
		});
		expect(byLocalHost).toMatchObject({
			availability: "active",
			canonicalHost: MIC_PORTAL_LOCAL_HOST,
			matchedHostType: "local",
			portal: {
				defaultPostAuthPath: MIC_PORTAL_DEFAULT_POST_AUTH_PATH,
				portalId: micPortalId,
				portalType: "mic",
				slug: MIC_PORTAL_SLUG,
			},
		});

		const byAlternateLocalPort = await t.query(
			api.portals.queries.resolvePortalByHost,
			{
				host: "MIC.localhost:3001",
			}
		);
		expect(byAlternateLocalPort).toMatchObject({
			availability: "active",
			canonicalHost: MIC_PORTAL_LOCAL_HOST,
			matchedHostType: "local",
			requestedHost: "mic.localhost:3001",
			portal: {
				portalId: micPortalId,
				portalType: "mic",
				slug: MIC_PORTAL_SLUG,
			},
		});

		const byProductionHost = await t.query(
			api.portals.queries.resolvePortalByHost,
			{
				host: MIC_PORTAL_PRODUCTION_HOST,
			}
		);
		expect(byProductionHost?.availability).toBe("active");
		expect(byProductionHost?.portal.portalId).toBe(micPortalId);

		const config = await t.query(
			internal.portals.micConfig.getMicPortalConfig,
			{
				portalId: micPortalId,
			}
		);
		expect(config).toEqual({
			availability: "active",
			micLenderAuthId,
			orgId: micOrgId,
			portalId: micPortalId,
		});
	});

	it("fails closed when a MIC portal is missing its explicit lender mapping", async () => {
		const t = createHarness();

		const micPortalId = await t.run(async (ctx) => {
			return await ctx.db.insert(
				"portals",
				buildPortalRecord({
					localHost: MIC_PORTAL_LOCAL_HOST,
					orgId: "org_mic_investors",
					portalType: "mic",
					productionHost: MIC_PORTAL_PRODUCTION_HOST,
					slug: MIC_PORTAL_SLUG,
				})
			);
		});

		const config = await t.query(
			internal.portals.micConfig.getMicPortalConfig,
			{
				portalId: micPortalId,
			}
		);
		expect(config).toEqual({
			availability: "missing_lender_mapping",
			portalId: micPortalId,
		});
	});

	it("fails closed for inactive, unpublished, or non-MIC portal config requests", async () => {
		const t = createHarness();

		const ids = await t.run(async (ctx) => {
			const unpublishedMic = await ctx.db.insert("portals", {
				...micPortalFields({
					micLenderAuthId: "lender_auth_mic",
					now: Date.now(),
					orgId: "org_mic_investors",
				}),
				isPublished: false,
			});
			const suspendedMic = await ctx.db.insert("portals", {
				...micPortalFields({
					micLenderAuthId: "lender_auth_mic",
					now: Date.now(),
					orgId: "org_mic_investors",
				}),
				localHost: "suspended-mic.localhost:3000",
				productionHost: "suspended-mic.fairlend.ca",
				slug: "suspended-mic",
				status: "suspended" as const,
			});
			const broker = await ctx.db.insert(
				"portals",
				buildPortalRecord({
					orgId: "org_broker",
					portalType: "broker",
					slug: "broker",
				})
			);
			return { broker, suspendedMic, unpublishedMic };
		});

		await expect(
			t.query(internal.portals.micConfig.getMicPortalConfig, {
				portalId: ids.unpublishedMic,
			})
		).resolves.toEqual({
			availability: "unpublished",
			portalId: ids.unpublishedMic,
		});
		await expect(
			t.query(internal.portals.micConfig.getMicPortalConfig, {
				portalId: ids.suspendedMic,
			})
		).resolves.toEqual({
			availability: "unavailable",
			portalId: ids.suspendedMic,
		});
		await expect(
			t.query(internal.portals.micConfig.getMicPortalConfig, {
				portalId: ids.broker,
			})
		).resolves.toEqual({
			availability: "not_mic_portal",
			portalId: ids.broker,
		});
	});

	it("repairs stale FairLend fallback assignments once broker portals are backfilled", async () => {
		const t = createHarness();
		const fixture = await seedPortalBackfillFixture(t);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);

		await t.mutation(internal.auth.syncUserHomePortalAssignment, {
			authId: fixture.orgFallbackBorrowerAuthId,
		});

		const fairLendPortal = await t.query(
			api.portals.queries.getFairLendPortal,
			{}
		);
		const beforeBackfill = await t.run(async (ctx) => {
			return ctx.db.get(fixture.orgFallbackBorrowerUserId);
		});
		expect(beforeBackfill?.homePortalId).toBe(
			fairLendPortal?.portalId as Id<"portals">
		);

		await asAdmin.mutation(
			api.brokers.migrations.runPortalRegistryBackfill,
			{}
		);

		const brokerPortal = await t.query(
			api.portals.queries.resolvePortalByHost,
			{
				host: "meridian.localhost:3000",
			}
		);
		const afterBackfill = await t.run(async (ctx) => {
			return ctx.db.get(fixture.orgFallbackBorrowerUserId);
		});
		expect(afterBackfill?.homePortalId).toBe(
			brokerPortal?.portal.portalId as Id<"portals">
		);
	});

	it("falls back to the FairLend portal when a user only has inactive memberships", async () => {
		const t = createHarness();
		const fixture = await seedPortalBackfillFixture(t);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);

		await asAdmin.mutation(
			api.brokers.migrations.runPortalRegistryBackfill,
			{}
		);

		const inactiveUserAuthId = "user_inactive_broker_member";
		const inactiveUserId = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {
				authId: inactiveUserAuthId,
				email: "inactive-member@test.fairlend.ca",
				firstName: "Inactive",
				lastName: "Member",
			});
			await ctx.db.insert("organizationMemberships", {
				workosId: "om_inactive_broker_member",
				organizationWorkosId: fixture.brokerOrgId,
				organizationName: "Meridian Mortgage Group",
				userWorkosId: inactiveUserAuthId,
				status: "inactive",
				roleSlug: "member",
				roleSlugs: ["member"],
			});
			return userId;
		});

		await t.mutation(internal.auth.syncUserHomePortalAssignment, {
			authId: inactiveUserAuthId,
		});

		const fairLendPortal = await t.query(
			api.portals.queries.getFairLendPortal,
			{}
		);
		const inactiveUser = await t.run(async (ctx) => {
			return ctx.db.get(inactiveUserId);
		});
		expect(inactiveUser?.homePortalId).toBe(
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
					orgId: FAIRLEND_STAFF_ORG_ID,
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
		expect(String(brokerResult.currentOrgPortalId)).toBe(
			String(brokerResult.currentOrgPortal?.portalId)
		);
		expect(brokerResult.currentOrgPortal?.slug).toBe("meridian");

		const adminResult = await asAdmin.query(
			api.portals.queries.getViewerHomePortal,
			{}
		);
		expect(adminResult.isFairLendAdmin).toBe(true);
		expect(adminResult.homePortal?.slug).toBe("app");
		expect(String(adminResult.homePortalId)).toBe(
			String(adminResult.homePortal?.portalId)
		);
		expect(String(adminResult.currentOrgPortalId)).toBe(
			String(adminResult.currentOrgPortal?.portalId)
		);
		expect(adminResult.currentOrgPortal?.slug).toBe("app");

		await t.run(async (ctx) => {
			await ctx.db.insert("organizationMemberships", {
				workosId: "om_fairlend_admin_broker",
				organizationWorkosId: fixture.brokerOrgId,
				organizationName: "Meridian Mortgage Group",
				userWorkosId: FAIRLEND_ADMIN.subject,
				status: "active",
				roleSlug: "broker",
				roleSlugs: ["broker"],
			});
		});

		const brokerOrgAdminViewer = createMockViewer({
			subject: FAIRLEND_ADMIN.subject,
			email: FAIRLEND_ADMIN.email,
			firstName: FAIRLEND_ADMIN.firstName,
			lastName: FAIRLEND_ADMIN.lastName,
			orgId: fixture.brokerOrgId,
			orgName: "Meridian Mortgage Group",
			role: "broker",
			roles: ["broker"],
		});
		const brokerOrgAdminResult = await t
			.withIdentity(brokerOrgAdminViewer)
			.query(api.portals.queries.getViewerHomePortal, {});
		expect(brokerOrgAdminResult.homePortal?.slug).toBe("app");
		expect(String(brokerOrgAdminResult.currentOrgPortalId)).toBe(
			String(brokerOrgAdminResult.currentOrgPortal?.portalId)
		);
		expect(brokerOrgAdminResult.currentOrgPortal?.slug).toBe("meridian");
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
			).rejects.toThrow(LOCAL_HOST_COLLISION_ERROR_REGEX);
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
			).rejects.toThrow(PRODUCTION_HOST_COLLISION_ERROR_REGEX);
		});
	});
});
