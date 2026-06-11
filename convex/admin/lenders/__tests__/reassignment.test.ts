import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FAIRLEND_ADMIN } from "../../../../src/test/auth/identities";
import type { Doc, Id } from "../../../_generated/dataModel";
import {
	FAIRLEND_BROKERAGE_ORG_ID,
	FAIRLEND_STAFF_ORG_ID,
} from "../../../constants";
import {
	setWorkosProvisioningForTests,
	type WorkosOrganizationMembership,
	type WorkosOrganizationMembershipListArgs,
	type WorkosProvisioning,
} from "../../../engine/effects/workosProvisioning";
import {
	FAIRLEND_PORTAL_LOCAL_HOST,
	FAIRLEND_PORTAL_PRODUCTION_HOST,
	FAIRLEND_PORTAL_SLUG,
} from "../../../portals/helpers";
import schema from "../../../schema";
import { convexModules } from "../../../test/moduleMaps";

interface PreviewArgs extends Record<string, unknown> {
	expectedCurrentBrokerId?: Id<"brokers">;
	expectedCurrentOrgId?: string;
	lenderId: Id<"lenders">;
	targetBrokerId: Id<"brokers">;
}

interface SearchArgs extends Record<string, unknown> {
	search?: string;
}

interface ReassignBrokerArgs extends Record<string, unknown> {
	expectedCurrentBrokerId: Id<"brokers">;
	expectedCurrentOrgId?: string;
	lenderId: Id<"lenders">;
	targetBrokerId: Id<"brokers">;
}

interface ReassignBrokerResult {
	attemptId: Id<"lenderBrokerReassignmentAttempts">;
	targetBrokerId: Id<"brokers">;
	targetOrgId: string;
	targetPortalHost: string;
	targetPortalId: Id<"portals">;
}

interface PortalSummary {
	host: string;
	portalId: Id<"portals"> | null;
	portalType: Doc<"portals">["portalType"];
	willEnsure: boolean;
}

interface PartySummary {
	brokerId: Id<"brokers">;
	displayName: string;
	orgId: string;
	portal: PortalSummary | null;
	status: string;
}

interface PreviewResult {
	blockingReasons: string[];
	current: PartySummary;
	portalHostWillChange: boolean;
	target: PartySummary;
	workosOperations: {
		addTargetMembership: boolean;
		deactivateCurrentMembership: boolean;
		roleSlug: "lender";
	};
}

const previewBrokerReassignmentRef = makeFunctionReference<
	"query",
	PreviewArgs,
	PreviewResult
>("admin/lenders/reassignment:previewBrokerReassignment");

const searchActiveBrokerTargetsRef = makeFunctionReference<
	"query",
	SearchArgs,
	PartySummary[]
>("admin/lenders/reassignment:searchActiveBrokerTargets");

const reassignBrokerRef = makeFunctionReference<
	"action",
	ReassignBrokerArgs,
	ReassignBrokerResult
>("admin/lenders/reassignment:reassignBroker");

const modules = {
	...convexModules,
	"/convex/admin/lenders/reassignmentInternal.ts": async () =>
		await import("../reassignmentInternal"),
	"/convex/admin/lenders/reassignment.ts": async () =>
		await import("../reassignment"),
};

function createTestHarness() {
	return convexTest(schema, modules);
}

afterEach(() => {
	setWorkosProvisioningForTests(null);
});

function createWorkosMembership(
	input: Partial<WorkosOrganizationMembership> & {
		organizationId: string;
		userId: string;
	}
): WorkosOrganizationMembership {
	return {
		id: input.id ?? `om_${input.organizationId}_${input.userId}`,
		organizationId: input.organizationId,
		roleSlug: input.roleSlug ?? "lender",
		roleSlugs: input.roleSlugs ?? ["lender"],
		status: input.status ?? "active",
		userId: input.userId,
	};
}

function createWorkosProvisioningMock(overrides?: {
	createOrganizationMembership?: WorkosProvisioning["createOrganizationMembership"];
	deactivateOrganizationMembership?: WorkosProvisioning["deactivateOrganizationMembership"];
	deleteOrganizationMembership?: WorkosProvisioning["deleteOrganizationMembership"];
	memberships?: WorkosOrganizationMembership[];
	updateOrganizationMembership?: WorkosProvisioning["updateOrganizationMembership"];
}) {
	const memberships = [...(overrides?.memberships ?? [])];
	const provisioning: WorkosProvisioning = {
		createOrganization: vi.fn().mockResolvedValue({ id: "org_created" }),
		createOrganizationMembership:
			overrides?.createOrganizationMembership ??
			vi.fn().mockResolvedValue({ id: "om_target" }),
		createUser: vi.fn().mockResolvedValue({
			email: "created@test.local",
			id: "user_created",
		}),
		deactivateOrganizationMembership:
			overrides?.deactivateOrganizationMembership ??
			vi.fn().mockImplementation(async (membershipId: string) => {
				const membership = memberships.find((row) => row.id === membershipId);
				return {
					...(membership ??
						createWorkosMembership({
							id: membershipId,
							organizationId: "org_unknown",
							userId: "user_unknown",
						})),
					status: "inactive" as const,
				};
			}),
		deleteOrganizationMembership:
			overrides?.deleteOrganizationMembership ??
			vi.fn().mockResolvedValue(undefined),
		listOrganizationMemberships: vi
			.fn()
			.mockImplementation(async (args: WorkosOrganizationMembershipListArgs) =>
				memberships.filter(
					(membership) =>
						(args.organizationId === undefined ||
							membership.organizationId === args.organizationId) &&
						(args.userId === undefined || membership.userId === args.userId) &&
						(args.statuses === undefined ||
							args.statuses.includes(membership.status))
				)
			),
		listUsers: vi.fn().mockResolvedValue([]),
		updateOrganizationMembership:
			overrides?.updateOrganizationMembership ??
			vi
				.fn()
				.mockImplementation(
					async (
						membershipId: string,
						args: { roleSlug?: string; roleSlugs?: string[] }
					) => {
						const membership = memberships.find(
							(row) => row.id === membershipId
						);
						const roleSlugs =
							args.roleSlugs ?? (args.roleSlug ? [args.roleSlug] : []);
						return {
							...(membership ??
								createWorkosMembership({
									id: membershipId,
									organizationId: "org_unknown",
									userId: "user_unknown",
								})),
							roleSlug: args.roleSlug ?? roleSlugs[0],
							roleSlugs,
						};
					}
				),
	};
	return provisioning;
}

function thrownMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

async function insertUser(
	t: ReturnType<typeof createTestHarness>,
	input: {
		authId: string;
		email: string;
		firstName: string;
		lastName: string;
	}
) {
	return await t.run(async (ctx) => {
		return await ctx.db.insert("users", input);
	});
}

async function insertBroker(
	t: ReturnType<typeof createTestHarness>,
	input: {
		brokerageName: string;
		orgId?: string;
		status?: string;
		userId: Id<"users">;
	}
) {
	return await t.run(async (ctx) => {
		const now = Date.now();
		const broker: Omit<Doc<"brokers">, "_creationTime" | "_id"> = {
			brokerageName: input.brokerageName,
			createdAt: now,
			status: input.status ?? "active",
			updatedAt: now,
			userId: input.userId,
		};
		if (input.orgId) {
			broker.orgId = input.orgId;
		}
		return await ctx.db.insert("brokers", broker);
	});
}

async function insertLender(
	t: ReturnType<typeof createTestHarness>,
	input: {
		brokerId: Id<"brokers">;
		orgId: string;
		userId: Id<"users">;
	}
) {
	return await t.run(async (ctx) => {
		return await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId: input.brokerId,
			createdAt: Date.now(),
			onboardingEntryPath: "admin_seed",
			orgId: input.orgId,
			status: "active",
			userId: input.userId,
		});
	});
}

async function insertPortal(
	t: ReturnType<typeof createTestHarness>,
	input: {
		brokerId?: Id<"brokers">;
		localHost: string;
		orgId: string;
		portalType: Doc<"portals">["portalType"];
		productionHost: string;
		slug: string;
	}
) {
	return await t.run(async (ctx) => {
		const now = Date.now();
		return await ctx.db.insert("portals", {
			brokerId: input.brokerId,
			createdAt: now,
			defaultPostAuthPath: "/",
			isPublished: true,
			localHost: input.localHost,
			orgId: input.orgId,
			portalType: input.portalType,
			productionHost: input.productionHost,
			publicTeaserEnabled: true,
			slug: input.slug,
			status: "active",
			teaserListingLimit: 12,
			updatedAt: now,
		});
	});
}

async function seedAdmin(t: ReturnType<typeof createTestHarness>) {
	await insertUser(t, {
		authId: FAIRLEND_ADMIN.subject,
		email: FAIRLEND_ADMIN.user_email,
		firstName: FAIRLEND_ADMIN.user_first_name,
		lastName: FAIRLEND_ADMIN.user_last_name,
	});
}

async function seedBaseReassignmentFixture(
	t: ReturnType<typeof createTestHarness>
) {
	await seedAdmin(t);
	const currentBrokerUserId = await insertUser(t, {
		authId: "user_current_broker",
		email: "current-broker@fairlend.test",
		firstName: "Current",
		lastName: "Broker",
	});
	const lenderUserId = await insertUser(t, {
		authId: "user_lender",
		email: "lender@fairlend.test",
		firstName: "Loan",
		lastName: "Investor",
	});
	const currentBrokerId = await insertBroker(t, {
		brokerageName: "Current Brokerage",
		orgId: "org_current_brokerage",
		userId: currentBrokerUserId,
	});
	const lenderId = await insertLender(t, {
		brokerId: currentBrokerId,
		orgId: "org_current_brokerage",
		userId: lenderUserId,
	});
	await insertPortal(t, {
		brokerId: currentBrokerId,
		localHost: "current.localhost:3000",
		orgId: "org_current_brokerage",
		portalType: "broker",
		productionHost: "current.fairlend.ca",
		slug: "current",
	});

	return { currentBrokerId, lenderId, lenderUserId };
}

async function seedExternalTargetBroker(
	t: ReturnType<typeof createTestHarness>,
	input?: {
		authId?: string;
		brokerageName?: string;
		orgId?: string;
		portalSlug?: string;
	}
) {
	const orgId = input?.orgId ?? "org_external_target";
	const targetBrokerUserId = await insertUser(t, {
		authId: input?.authId ?? "user_target_broker",
		email: `${input?.authId ?? "target-broker"}@fairlend.test`,
		firstName: "Target",
		lastName: "Broker",
	});
	const targetBrokerId = await insertBroker(t, {
		brokerageName: input?.brokerageName ?? "Target Brokerage",
		orgId,
		userId: targetBrokerUserId,
	});
	const targetPortalId = await insertPortal(t, {
		brokerId: targetBrokerId,
		localHost: `${input?.portalSlug ?? "target"}.localhost:3000`,
		orgId,
		portalType: "broker",
		productionHost: `${input?.portalSlug ?? "target"}.fairlend.ca`,
		slug: input?.portalSlug ?? "target",
	});

	return { orgId, targetBrokerId, targetBrokerUserId, targetPortalId };
}

async function seedFairLendTargetBrokerWithoutPortal(
	t: ReturnType<typeof createTestHarness>
) {
	const targetBrokerUserId = await insertUser(t, {
		authId: "user_fairlend_target_broker",
		email: "fairlend-target-broker@fairlend.test",
		firstName: "FairLend",
		lastName: "Target",
	});
	const targetBrokerId = await insertBroker(t, {
		brokerageName: "FairLend Brokerage",
		orgId: FAIRLEND_BROKERAGE_ORG_ID,
		userId: targetBrokerUserId,
	});

	return {
		orgId: FAIRLEND_BROKERAGE_ORG_ID,
		targetBrokerId,
		targetBrokerUserId,
	};
}

async function seedMortgageAndDealForBroker(
	t: ReturnType<typeof createTestHarness>,
	input: {
		brokerId: Id<"brokers">;
		lenderId: Id<"lenders">;
		orgId: string;
	}
) {
	return await t.run(async (ctx) => {
		const now = Date.now();
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: now,
			postalCode: "M5V 2T6",
			propertyType: "residential",
			province: "ON",
			streetAddress: "1 Test Street",
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 300,
			brokerOfRecordId: input.brokerId,
			createdAt: now,
			firstPaymentDate: "2026-07-01",
			interestAdjustmentDate: "2026-06-01",
			interestRate: 0.05,
			lienPosition: 1,
			loanType: "conventional",
			maturityDate: "2031-06-01",
			orgId: input.orgId,
			paymentAmount: 2500,
			paymentFrequency: "monthly",
			principal: 500_000,
			propertyId,
			rateType: "fixed",
			status: "active",
			termMonths: 60,
			termStartDate: "2026-06-01",
		});
		const dealId = await ctx.db.insert("deals", {
			buyerId: "buyer_workos_user",
			createdAt: now,
			createdBy: "admin",
			fractionalShare: 0.1,
			lenderId: input.lenderId,
			mortgageId,
			orgId: input.orgId,
			sellerId: "seller_workos_user",
			status: "approved",
		});
		return { dealId, mortgageId };
	});
}

async function readCanonicalAssignment(
	t: ReturnType<typeof createTestHarness>,
	input: { lenderId: Id<"lenders">; lenderUserId: Id<"users"> }
) {
	return await t.run(async (ctx) => ({
		lender: await ctx.db.get(input.lenderId),
		user: await ctx.db.get(input.lenderUserId),
	}));
}

async function readAttempt(
	t: ReturnType<typeof createTestHarness>,
	attemptId: Id<"lenderBrokerReassignmentAttempts">
) {
	return await t.run(async (ctx) => await ctx.db.get(attemptId));
}

async function readLatestAttemptForLender(
	t: ReturnType<typeof createTestHarness>,
	lenderId: Id<"lenders">
) {
	return await t.run(async (ctx) => {
		const attempts = await ctx.db
			.query("lenderBrokerReassignmentAttempts")
			.withIndex("by_lender_created_at", (query) =>
				query.eq("lenderId", lenderId)
			)
			.collect();
		return attempts.at(-1) ?? null;
	});
}

async function clearBrokerOrgId(
	t: ReturnType<typeof createTestHarness>,
	brokerId: Id<"brokers">
) {
	await t.run(async (ctx) => {
		await ctx.db.patch(brokerId, { orgId: undefined });
	});
}

describe("previewBrokerReassignment", () => {
	it("previews the global app portal for FairLend-owned target brokers", async () => {
		const t = createTestHarness();
		const { lenderId } = await seedBaseReassignmentFixture(t);
		const targetBrokerUserId = await insertUser(t, {
			authId: "user_fairlend_broker",
			email: "fairlend-broker@fairlend.test",
			firstName: "FairLend",
			lastName: "Broker",
		});
		const targetBrokerId = await insertBroker(t, {
			brokerageName: "FairLend Brokerage",
			orgId: FAIRLEND_BROKERAGE_ORG_ID,
			userId: targetBrokerUserId,
		});
		const appPortalId = await insertPortal(t, {
			localHost: FAIRLEND_PORTAL_LOCAL_HOST,
			orgId: FAIRLEND_STAFF_ORG_ID,
			portalType: "fairlend",
			productionHost: FAIRLEND_PORTAL_PRODUCTION_HOST,
			slug: FAIRLEND_PORTAL_SLUG,
		});

		const preview = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(previewBrokerReassignmentRef, { lenderId, targetBrokerId });

		expect(preview.blockingReasons).toEqual([]);
		expect(preview.target.portal).toEqual({
			host: FAIRLEND_PORTAL_LOCAL_HOST,
			portalId: appPortalId,
			portalType: "fairlend",
			willEnsure: false,
		});
		expect(preview.portalHostWillChange).toBe(true);
		expect(preview.workosOperations).toEqual({
			addTargetMembership: true,
			deactivateCurrentMembership: true,
			roleSlug: "lender",
		});
	});

	it("previews a future ensured app portal for FairLend-owned target brokers when the portal is not seeded", async () => {
		const t = createTestHarness();
		const { lenderId } = await seedBaseReassignmentFixture(t);
		const targetBrokerUserId = await insertUser(t, {
			authId: "user_fairlend_broker_no_portal",
			email: "fairlend-broker-no-portal@fairlend.test",
			firstName: "FairLend",
			lastName: "Broker",
		});
		const targetBrokerId = await insertBroker(t, {
			brokerageName: "FairLend Brokerage",
			orgId: FAIRLEND_BROKERAGE_ORG_ID,
			userId: targetBrokerUserId,
		});

		const preview = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(previewBrokerReassignmentRef, { lenderId, targetBrokerId });

		expect(preview.blockingReasons).toEqual([]);
		expect(preview.target.portal).toEqual({
			host: FAIRLEND_PORTAL_LOCAL_HOST,
			portalId: null,
			portalType: "fairlend",
			willEnsure: true,
		});
	});

	it("blocks external active target brokers without an active published portal", async () => {
		const t = createTestHarness();
		const { lenderId } = await seedBaseReassignmentFixture(t);
		const targetBrokerUserId = await insertUser(t, {
			authId: "user_external_broker",
			email: "external-broker@fairlend.test",
			firstName: "External",
			lastName: "Broker",
		});
		const targetBrokerId = await insertBroker(t, {
			brokerageName: "External Brokerage",
			orgId: "org_external_brokerage",
			userId: targetBrokerUserId,
		});

		const preview = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(previewBrokerReassignmentRef, { lenderId, targetBrokerId });

		expect(preview.blockingReasons).toEqual([
			"Target external broker does not have an active published portal.",
		]);
		expect(preview.target.portal).toBeNull();
	});

	it("blocks inactive target brokers before reassignment can run", async () => {
		const t = createTestHarness();
		const { lenderId } = await seedBaseReassignmentFixture(t);
		const targetBrokerUserId = await insertUser(t, {
			authId: "user_inactive_broker",
			email: "inactive-broker@fairlend.test",
			firstName: "Inactive",
			lastName: "Broker",
		});
		const targetBrokerId = await insertBroker(t, {
			brokerageName: "Inactive Brokerage",
			orgId: "org_inactive_brokerage",
			status: "inactive",
			userId: targetBrokerUserId,
		});
		await insertPortal(t, {
			brokerId: targetBrokerId,
			localHost: "inactive.localhost:3000",
			orgId: "org_inactive_brokerage",
			portalType: "broker",
			productionHost: "inactive.fairlend.ca",
			slug: "inactive",
		});

		const preview = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(previewBrokerReassignmentRef, { lenderId, targetBrokerId });

		expect(preview.blockingReasons).toContain("Target broker is not active.");
	});

	it("blocks selecting the lender's currently assigned broker", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId } = await seedBaseReassignmentFixture(t);

		const preview = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(previewBrokerReassignmentRef, {
				lenderId,
				targetBrokerId: currentBrokerId,
			});

		expect(preview.blockingReasons).toContain(
			"Target broker is already assigned to this lender."
		);
	});

	it("blocks stale expected current assignment in the preview", async () => {
		const t = createTestHarness();
		const { lenderId } = await seedBaseReassignmentFixture(t);
		const staleBroker = await seedExternalTargetBroker(t, {
			authId: "user_preview_stale_broker",
			brokerageName: "Preview Stale Brokerage",
			orgId: "org_preview_stale",
			portalSlug: "preview-stale",
		});
		const target = await seedExternalTargetBroker(t);

		const preview = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(previewBrokerReassignmentRef, {
				expectedCurrentBrokerId: staleBroker.targetBrokerId,
				expectedCurrentOrgId: "org_current_brokerage",
				lenderId,
				targetBrokerId: target.targetBrokerId,
			});

		expect(preview.blockingReasons).toContain(
			"Lender broker assignment changed. Refresh and try again."
		);
	});

	it("previews WorkOS operations from the lender canonical org instead of the broker row", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId } = await seedBaseReassignmentFixture(t);
		await clearBrokerOrgId(t, currentBrokerId);
		const target = await seedExternalTargetBroker(t, {
			authId: "user_same_canonical_org_target",
			brokerageName: "Same Canonical Org Target",
			orgId: "org_current_brokerage",
			portalSlug: "same-canonical-org-target",
		});

		const preview = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(previewBrokerReassignmentRef, {
				expectedCurrentBrokerId: currentBrokerId,
				expectedCurrentOrgId: "org_current_brokerage",
				lenderId,
				targetBrokerId: target.targetBrokerId,
			});

		expect(preview.current.orgId).toBe("");
		expect(preview.target.orgId).toBe("org_current_brokerage");
		expect(preview.workosOperations).toEqual({
			addTargetMembership: false,
			deactivateCurrentMembership: false,
			roleSlug: "lender",
		});
	});
});

describe("searchActiveBrokerTargets", () => {
	it("includes active brokers across organizations and excludes inactive brokers", async () => {
		const t = createTestHarness();
		const { currentBrokerId } = await seedBaseReassignmentFixture(t);
		const activeExternal = await seedExternalTargetBroker(t, {
			brokerageName: "External Active Brokerage",
			orgId: "org_external_active",
			portalSlug: "external-active",
		});
		const inactiveBrokerUserId = await insertUser(t, {
			authId: "user_inactive_search_broker",
			email: "inactive-search-broker@fairlend.test",
			firstName: "Inactive",
			lastName: "Search",
		});
		const inactiveBrokerId = await insertBroker(t, {
			brokerageName: "Inactive Search Brokerage",
			orgId: "org_inactive_search",
			status: "inactive",
			userId: inactiveBrokerUserId,
		});

		const allTargets = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(searchActiveBrokerTargetsRef, {});

		expect(allTargets.map((target) => target.brokerId)).toEqual(
			expect.arrayContaining([currentBrokerId, activeExternal.targetBrokerId])
		);
		expect(allTargets.map((target) => target.brokerId)).not.toContain(
			inactiveBrokerId
		);
		expect(
			allTargets.find(
				(target) => target.brokerId === activeExternal.targetBrokerId
			)?.orgId
		).toBe("org_external_active");
	});

	it("searches active broker targets by organization id", async () => {
		const t = createTestHarness();
		await seedBaseReassignmentFixture(t);
		const target = await seedExternalTargetBroker(t, {
			brokerageName: "Queryable Brokerage",
			orgId: "org_queryable_target",
			portalSlug: "queryable",
		});

		const results = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(searchActiveBrokerTargetsRef, { search: "queryable_target" });

		expect(results.map((result) => result.brokerId)).toEqual([
			target.targetBrokerId,
		]);
	});
});

describe("reassignBroker", () => {
	it("transfers WorkOS membership before patching canonical lender assignment", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId, lenderUserId } =
			await seedBaseReassignmentFixture(t);
		const target = await seedExternalTargetBroker(t);
		const provisioning = createWorkosProvisioningMock({
			memberships: [
				createWorkosMembership({
					id: "om_old",
					organizationId: "org_current_brokerage",
					userId: "user_lender",
				}),
			],
		});
		setWorkosProvisioningForTests(provisioning);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(reassignBrokerRef, {
				expectedCurrentBrokerId: currentBrokerId,
				expectedCurrentOrgId: "org_current_brokerage",
				lenderId,
				targetBrokerId: target.targetBrokerId,
			});

		expect(result.targetBrokerId).toBe(target.targetBrokerId);
		expect(result.targetOrgId).toBe(target.orgId);
		expect(result.targetPortalId).toBe(target.targetPortalId);
		expect(provisioning.listOrganizationMemberships).toHaveBeenNthCalledWith(
			1,
			{
				organizationId: target.orgId,
				statuses: ["active", "inactive"],
				userId: "user_lender",
			}
		);
		expect(provisioning.createOrganizationMembership).toHaveBeenCalledWith({
			organizationId: target.orgId,
			roleSlug: "lender",
			userId: "user_lender",
		});
		expect(provisioning.listOrganizationMemberships).toHaveBeenNthCalledWith(
			2,
			{
				organizationId: "org_current_brokerage",
				statuses: ["active"],
				userId: "user_lender",
			}
		);
		expect(provisioning.deactivateOrganizationMembership).toHaveBeenCalledWith(
			"om_old"
		);

		const { lender, user } = await readCanonicalAssignment(t, {
			lenderId,
			lenderUserId,
		});
		expect(lender?.brokerId).toBe(target.targetBrokerId);
		expect(lender?.orgId).toBe(target.orgId);
		expect(user?.homePortalId).toBe(target.targetPortalId);

		const attempt = await readAttempt(t, result.attemptId);
		expect(attempt?.status).toBe("succeeded");
		expect(attempt?.targetMembershipId).toBe("om_target");
		expect(attempt?.targetMembershipWasPreexisting).toBe(false);
		expect(attempt?.targetBrokerId).toBe(target.targetBrokerId);
		expect(attempt?.targetOrgId).toBe(target.orgId);
		expect(attempt?.targetPortalId).toBe(target.targetPortalId);
		expect(attempt?.currentMembershipId).toBe("om_old");
		expect(attempt?.currentMembershipOperation).toBe("deactivated");
		expect(attempt?.currentMembershipRoleSlugsBefore).toEqual(["lender"]);
		expect(attempt?.currentMembershipRoleSlugsAfter).toEqual([]);
	});

	it("removes the old WorkOS membership from the lender canonical org when the broker org is missing", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId, lenderUserId } =
			await seedBaseReassignmentFixture(t);
		await clearBrokerOrgId(t, currentBrokerId);
		const target = await seedExternalTargetBroker(t);
		const provisioning = createWorkosProvisioningMock({
			memberships: [
				createWorkosMembership({
					id: "om_old_canonical",
					organizationId: "org_current_brokerage",
					userId: "user_lender",
				}),
			],
		});
		setWorkosProvisioningForTests(provisioning);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(reassignBrokerRef, {
				expectedCurrentBrokerId: currentBrokerId,
				expectedCurrentOrgId: "org_current_brokerage",
				lenderId,
				targetBrokerId: target.targetBrokerId,
			});

		expect(provisioning.listOrganizationMemberships).toHaveBeenNthCalledWith(
			2,
			{
				organizationId: "org_current_brokerage",
				statuses: ["active"],
				userId: "user_lender",
			}
		);
		expect(provisioning.deactivateOrganizationMembership).toHaveBeenCalledWith(
			"om_old_canonical"
		);
		const { lender, user } = await readCanonicalAssignment(t, {
			lenderId,
			lenderUserId,
		});
		expect(lender?.brokerId).toBe(target.targetBrokerId);
		expect(lender?.orgId).toBe(target.orgId);
		expect(user?.homePortalId).toBe(target.targetPortalId);
		const attempt = await readAttempt(t, result.attemptId);
		expect(attempt?.currentMembershipId).toBe("om_old_canonical");
		expect(attempt?.currentMembershipOperation).toBe("deactivated");
	});

	it("adds the lender role to an existing active target membership before reassignment", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId, lenderUserId } =
			await seedBaseReassignmentFixture(t);
		const target = await seedExternalTargetBroker(t);
		const provisioning = createWorkosProvisioningMock({
			memberships: [
				createWorkosMembership({
					id: "om_target_existing",
					organizationId: target.orgId,
					roleSlug: "borrower",
					roleSlugs: ["borrower"],
					userId: "user_lender",
				}),
				createWorkosMembership({
					id: "om_old",
					organizationId: "org_current_brokerage",
					userId: "user_lender",
				}),
			],
		});
		setWorkosProvisioningForTests(provisioning);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(reassignBrokerRef, {
				expectedCurrentBrokerId: currentBrokerId,
				expectedCurrentOrgId: "org_current_brokerage",
				lenderId,
				targetBrokerId: target.targetBrokerId,
			});

		expect(provisioning.createOrganizationMembership).not.toHaveBeenCalled();
		expect(provisioning.updateOrganizationMembership).toHaveBeenCalledWith(
			"om_target_existing",
			{ roleSlugs: ["borrower", "lender"] }
		);
		const { lender, user } = await readCanonicalAssignment(t, {
			lenderId,
			lenderUserId,
		});
		expect(lender?.brokerId).toBe(target.targetBrokerId);
		expect(lender?.orgId).toBe(target.orgId);
		expect(user?.homePortalId).toBe(target.targetPortalId);
		const attempt = await readAttempt(t, result.attemptId);
		expect(attempt?.targetMembershipId).toBe("om_target_existing");
		expect(attempt?.targetMembershipWasPreexisting).toBe(true);
	});

	it("reactivates an inactive target membership instead of treating the target org as new", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId, lenderUserId } =
			await seedBaseReassignmentFixture(t);
		const target = await seedExternalTargetBroker(t);
		const provisioning = createWorkosProvisioningMock({
			createOrganizationMembership: vi
				.fn()
				.mockResolvedValue({ id: "om_target_inactive" }),
			memberships: [
				createWorkosMembership({
					id: "om_target_inactive",
					organizationId: target.orgId,
					status: "inactive",
					userId: "user_lender",
				}),
				createWorkosMembership({
					id: "om_old",
					organizationId: "org_current_brokerage",
					userId: "user_lender",
				}),
			],
		});
		setWorkosProvisioningForTests(provisioning);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(reassignBrokerRef, {
				expectedCurrentBrokerId: currentBrokerId,
				expectedCurrentOrgId: "org_current_brokerage",
				lenderId,
				targetBrokerId: target.targetBrokerId,
			});

		expect(provisioning.listOrganizationMemberships).toHaveBeenNthCalledWith(
			1,
			{
				organizationId: target.orgId,
				statuses: ["active", "inactive"],
				userId: "user_lender",
			}
		);
		expect(provisioning.createOrganizationMembership).toHaveBeenCalledWith({
			organizationId: target.orgId,
			roleSlug: "lender",
			userId: "user_lender",
		});
		const { lender, user } = await readCanonicalAssignment(t, {
			lenderId,
			lenderUserId,
		});
		expect(lender?.brokerId).toBe(target.targetBrokerId);
		expect(user?.homePortalId).toBe(target.targetPortalId);
		const attempt = await readAttempt(t, result.attemptId);
		expect(attempt?.targetMembershipId).toBe("om_target_inactive");
		expect(attempt?.targetMembershipWasPreexisting).toBe(true);
	});

	it("removes only the lender role from an old multi-role membership", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId, lenderUserId } =
			await seedBaseReassignmentFixture(t);
		const target = await seedExternalTargetBroker(t);
		const provisioning = createWorkosProvisioningMock({
			memberships: [
				createWorkosMembership({
					id: "om_old_multi",
					organizationId: "org_current_brokerage",
					roleSlug: "lender",
					roleSlugs: ["borrower", "lender"],
					userId: "user_lender",
				}),
			],
		});
		setWorkosProvisioningForTests(provisioning);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(reassignBrokerRef, {
				expectedCurrentBrokerId: currentBrokerId,
				expectedCurrentOrgId: "org_current_brokerage",
				lenderId,
				targetBrokerId: target.targetBrokerId,
			});

		expect(
			provisioning.deactivateOrganizationMembership
		).not.toHaveBeenCalled();
		expect(provisioning.updateOrganizationMembership).toHaveBeenCalledWith(
			"om_old_multi",
			{ roleSlugs: ["borrower"] }
		);
		const { lender, user } = await readCanonicalAssignment(t, {
			lenderId,
			lenderUserId,
		});
		expect(lender?.brokerId).toBe(target.targetBrokerId);
		expect(user?.homePortalId).toBe(target.targetPortalId);
		const attempt = await readAttempt(t, result.attemptId);
		expect(attempt?.currentMembershipId).toBe("om_old_multi");
		expect(attempt?.currentMembershipOperation).toBe("role_removed");
		expect(attempt?.currentMembershipRoleSlugsBefore).toEqual([
			"borrower",
			"lender",
		]);
		expect(attempt?.currentMembershipRoleSlugsAfter).toEqual(["borrower"]);
	});

	it("ignores unrelated old-org memberships that do not have the lender role", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId } = await seedBaseReassignmentFixture(t);
		const target = await seedExternalTargetBroker(t);
		const provisioning = createWorkosProvisioningMock({
			memberships: [
				createWorkosMembership({
					id: "om_old_borrower",
					organizationId: "org_current_brokerage",
					roleSlug: "borrower",
					roleSlugs: ["borrower"],
					userId: "user_lender",
				}),
			],
		});
		setWorkosProvisioningForTests(provisioning);

		await t.withIdentity(FAIRLEND_ADMIN).action(reassignBrokerRef, {
			expectedCurrentBrokerId: currentBrokerId,
			expectedCurrentOrgId: "org_current_brokerage",
			lenderId,
			targetBrokerId: target.targetBrokerId,
		});

		expect(
			provisioning.deactivateOrganizationMembership
		).not.toHaveBeenCalled();
		expect(provisioning.updateOrganizationMembership).not.toHaveBeenCalledWith(
			"om_old_borrower",
			expect.anything()
		);
	});

	it("rejects same-broker reassignment before WorkOS and leaves Convex unchanged", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId, lenderUserId } =
			await seedBaseReassignmentFixture(t);
		const before = await readCanonicalAssignment(t, { lenderId, lenderUserId });
		const provisioning = createWorkosProvisioningMock();
		setWorkosProvisioningForTests(provisioning);

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(reassignBrokerRef, {
				expectedCurrentBrokerId: currentBrokerId,
				expectedCurrentOrgId: "org_current_brokerage",
				lenderId,
				targetBrokerId: currentBrokerId,
			})
		).rejects.toThrow("Target broker is already assigned to this lender.");

		expect(provisioning.listOrganizationMemberships).not.toHaveBeenCalled();
		expect(provisioning.createOrganizationMembership).not.toHaveBeenCalled();
		expect(
			provisioning.deactivateOrganizationMembership
		).not.toHaveBeenCalled();
		const after = await readCanonicalAssignment(t, { lenderId, lenderUserId });
		expect(after.lender?.brokerId).toBe(before.lender?.brokerId);
		expect(after.lender?.orgId).toBe(before.lender?.orgId);
		expect(after.user?.homePortalId).toBe(before.user?.homePortalId);
		const attempt = await readLatestAttemptForLender(t, lenderId);
		expect(attempt?.status).toBe("failed");
		expect(attempt?.failurePhase).toBe("validation");
		expect(attempt?.rollbackStatus).toBe("not_needed");
		expect(attempt?.failureMessage).toContain(
			"Target broker is already assigned to this lender."
		);
	});

	it("records validation evidence when an inactive target broker is submitted", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId, lenderUserId } =
			await seedBaseReassignmentFixture(t);
		const targetBrokerUserId = await insertUser(t, {
			authId: "user_action_inactive_broker",
			email: "action-inactive-broker@fairlend.test",
			firstName: "Action",
			lastName: "Inactive",
		});
		const targetBrokerId = await insertBroker(t, {
			brokerageName: "Action Inactive Brokerage",
			orgId: "org_action_inactive",
			status: "inactive",
			userId: targetBrokerUserId,
		});
		await insertPortal(t, {
			brokerId: targetBrokerId,
			localHost: "action-inactive.localhost:3000",
			orgId: "org_action_inactive",
			portalType: "broker",
			productionHost: "action-inactive.fairlend.ca",
			slug: "action-inactive",
		});
		const before = await readCanonicalAssignment(t, { lenderId, lenderUserId });
		const provisioning = createWorkosProvisioningMock();
		setWorkosProvisioningForTests(provisioning);

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(reassignBrokerRef, {
				expectedCurrentBrokerId: currentBrokerId,
				expectedCurrentOrgId: "org_current_brokerage",
				lenderId,
				targetBrokerId,
			})
		).rejects.toThrow("Target broker is not active.");

		expect(provisioning.listOrganizationMemberships).not.toHaveBeenCalled();
		const after = await readCanonicalAssignment(t, { lenderId, lenderUserId });
		expect(after.lender?.brokerId).toBe(before.lender?.brokerId);
		expect(after.lender?.orgId).toBe(before.lender?.orgId);
		expect(after.user?.homePortalId).toBe(before.user?.homePortalId);
		const attempt = await readLatestAttemptForLender(t, lenderId);
		expect(attempt?.status).toBe("failed");
		expect(attempt?.failurePhase).toBe("validation");
		expect(attempt?.failureMessage).toContain("Target broker is not active.");
	});

	it("leaves persisted mortgage and deal assignment scope unchanged", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId } = await seedBaseReassignmentFixture(t);
		const target = await seedExternalTargetBroker(t);
		const historical = await seedMortgageAndDealForBroker(t, {
			brokerId: currentBrokerId,
			lenderId,
			orgId: "org_current_brokerage",
		});
		setWorkosProvisioningForTests(
			createWorkosProvisioningMock({
				memberships: [
					createWorkosMembership({
						id: "om_old",
						organizationId: "org_current_brokerage",
						userId: "user_lender",
					}),
				],
			})
		);

		await t.withIdentity(FAIRLEND_ADMIN).action(reassignBrokerRef, {
			expectedCurrentBrokerId: currentBrokerId,
			expectedCurrentOrgId: "org_current_brokerage",
			lenderId,
			targetBrokerId: target.targetBrokerId,
		});

		// Ledger rows are not constructed here; this workflow does not mutate ledger
		// tables, and this regression covers persisted broker/org scope fields.
		const records = await t.run(async (ctx) => ({
			deal: await ctx.db.get(historical.dealId),
			mortgage: await ctx.db.get(historical.mortgageId),
		}));
		expect(records.mortgage?.brokerOfRecordId).toBe(currentBrokerId);
		expect(records.mortgage?.orgId).toBe("org_current_brokerage");
		expect(records.deal?.orgId).toBe("org_current_brokerage");
	});

	it("does not patch Convex when target membership creation fails", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId, lenderUserId } =
			await seedBaseReassignmentFixture(t);
		const target = await seedExternalTargetBroker(t);
		const before = await readCanonicalAssignment(t, { lenderId, lenderUserId });
		const provisioning = createWorkosProvisioningMock({
			createOrganizationMembership: vi
				.fn()
				.mockRejectedValue(new Error("WorkOS add failed")),
			memberships: [
				createWorkosMembership({
					id: "om_old",
					organizationId: "org_current_brokerage",
					userId: "user_lender",
				}),
			],
		});
		setWorkosProvisioningForTests(provisioning);

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(reassignBrokerRef, {
				expectedCurrentBrokerId: currentBrokerId,
				expectedCurrentOrgId: "org_current_brokerage",
				lenderId,
				targetBrokerId: target.targetBrokerId,
			})
		).rejects.toThrow("WorkOS add failed");

		expect(
			provisioning.deactivateOrganizationMembership
		).not.toHaveBeenCalled();
		const after = await readCanonicalAssignment(t, { lenderId, lenderUserId });
		expect(after.lender?.brokerId).toBe(before.lender?.brokerId);
		expect(after.lender?.orgId).toBe(before.lender?.orgId);
		expect(after.user?.homePortalId).toBe(before.user?.homePortalId);

		const attempt = await readLatestAttemptForLender(t, lenderId);
		expect(attempt?.status).toBe("failed");
		expect(attempt?.failurePhase).toBe("target_membership");
		expect(attempt?.rollbackStatus).toBe("not_needed");
	});

	it("marks repair needed when target membership creation returns no membership id", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId, lenderUserId } =
			await seedBaseReassignmentFixture(t);
		const target = await seedExternalTargetBroker(t);
		const before = await readCanonicalAssignment(t, { lenderId, lenderUserId });
		const provisioning = createWorkosProvisioningMock({
			createOrganizationMembership: vi.fn().mockResolvedValue({}),
			memberships: [
				createWorkosMembership({
					id: "om_old",
					organizationId: "org_current_brokerage",
					userId: "user_lender",
				}),
			],
		});
		setWorkosProvisioningForTests(provisioning);

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(reassignBrokerRef, {
				expectedCurrentBrokerId: currentBrokerId,
				expectedCurrentOrgId: "org_current_brokerage",
				lenderId,
				targetBrokerId: target.targetBrokerId,
			})
		).rejects.toThrow("WorkOS target membership creation did not return an id");

		expect(
			provisioning.deactivateOrganizationMembership
		).not.toHaveBeenCalled();
		expect(provisioning.deleteOrganizationMembership).not.toHaveBeenCalled();
		const after = await readCanonicalAssignment(t, { lenderId, lenderUserId });
		expect(after.lender?.brokerId).toBe(before.lender?.brokerId);
		expect(after.lender?.orgId).toBe(before.lender?.orgId);
		expect(after.user?.homePortalId).toBe(before.user?.homePortalId);

		const attempt = await readLatestAttemptForLender(t, lenderId);
		expect(attempt?.status).toBe("repair_needed");
		expect(attempt?.failurePhase).toBe("target_membership");
		expect(attempt?.rollbackStatus).toBe("failed");
		expect(attempt?.failureMessage).toContain(
			"WorkOS target membership creation did not return an id"
		);
	});

	it("rolls back a newly-created target membership when old org deactivation fails", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId, lenderUserId } =
			await seedBaseReassignmentFixture(t);
		const target = await seedExternalTargetBroker(t);
		const before = await readCanonicalAssignment(t, { lenderId, lenderUserId });
		const provisioning = createWorkosProvisioningMock({
			deactivateOrganizationMembership: vi
				.fn()
				.mockRejectedValue(new Error("WorkOS deactivate failed")),
			memberships: [
				createWorkosMembership({
					id: "om_old",
					organizationId: "org_current_brokerage",
					userId: "user_lender",
				}),
			],
		});
		setWorkosProvisioningForTests(provisioning);

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(reassignBrokerRef, {
				expectedCurrentBrokerId: currentBrokerId,
				expectedCurrentOrgId: "org_current_brokerage",
				lenderId,
				targetBrokerId: target.targetBrokerId,
			})
		).rejects.toThrow("WorkOS deactivate failed");

		expect(provisioning.deleteOrganizationMembership).toHaveBeenCalledWith(
			"om_target"
		);
		const after = await readCanonicalAssignment(t, { lenderId, lenderUserId });
		expect(after.lender?.brokerId).toBe(before.lender?.brokerId);
		expect(after.lender?.orgId).toBe(before.lender?.orgId);
		expect(after.user?.homePortalId).toBe(before.user?.homePortalId);

		const attempt = await readLatestAttemptForLender(t, lenderId);
		expect(attempt?.status).toBe("failed");
		expect(attempt?.failurePhase).toBe("old_membership_removal");
		expect(attempt?.rollbackStatus).toBe("succeeded");
		expect(attempt?.currentMembershipId).toBe("om_old");
		expect(attempt?.currentMembershipOperation).toBe("deactivated");
		expect(attempt?.currentMembershipRoleSlugsBefore).toEqual(["lender"]);
		expect(attempt?.currentMembershipRoleSlugsAfter).toEqual([]);
	});

	it("marks repair needed when rollback of a newly-created target membership fails", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId, lenderUserId } =
			await seedBaseReassignmentFixture(t);
		const target = await seedExternalTargetBroker(t);
		const before = await readCanonicalAssignment(t, { lenderId, lenderUserId });
		const provisioning = createWorkosProvisioningMock({
			deactivateOrganizationMembership: vi
				.fn()
				.mockRejectedValue(new Error("WorkOS deactivate failed")),
			deleteOrganizationMembership: vi
				.fn()
				.mockRejectedValue(new Error("WorkOS rollback delete failed")),
			memberships: [
				createWorkosMembership({
					id: "om_old",
					organizationId: "org_current_brokerage",
					userId: "user_lender",
				}),
			],
		});
		setWorkosProvisioningForTests(provisioning);

		let thrown: unknown;
		try {
			await t.withIdentity(FAIRLEND_ADMIN).action(reassignBrokerRef, {
				expectedCurrentBrokerId: currentBrokerId,
				expectedCurrentOrgId: "org_current_brokerage",
				lenderId,
				targetBrokerId: target.targetBrokerId,
			});
		} catch (error) {
			thrown = error;
		}

		expect(thrownMessage(thrown)).toContain(
			"Identity transfer incomplete. Lender assignment was not changed."
		);
		expect(thrownMessage(thrown)).toContain("Repair needed.");

		const after = await readCanonicalAssignment(t, { lenderId, lenderUserId });
		expect(after.lender?.brokerId).toBe(before.lender?.brokerId);
		expect(after.lender?.orgId).toBe(before.lender?.orgId);
		expect(after.user?.homePortalId).toBe(before.user?.homePortalId);

		const attempt = await readLatestAttemptForLender(t, lenderId);
		expect(attempt?.status).toBe("repair_needed");
		expect(attempt?.failurePhase).toBe("rollback");
		expect(attempt?.rollbackStatus).toBe("failed");
		expect(attempt?.targetMembershipId).toBe("om_target");
		expect(attempt?.targetMembershipWasPreexisting).toBe(false);
		expect(attempt?.currentMembershipId).toBe("om_old");
		expect(attempt?.currentMembershipOperation).toBe("deactivated");
		expect(attempt?.currentMembershipRoleSlugsBefore).toEqual(["lender"]);
		expect(attempt?.currentMembershipRoleSlugsAfter).toEqual([]);
		expect(attempt?.failureMessage).toContain("WorkOS deactivate failed");
		expect(attempt?.failureMessage).toContain("WorkOS rollback delete failed");
		expect(thrownMessage(thrown)).toContain(String(attempt?._id));
	});

	it("marks repair needed when assignment changes before the final Convex patch", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId, lenderUserId } =
			await seedBaseReassignmentFixture(t);
		const target = await seedExternalTargetBroker(t);
		const raceBroker = await seedExternalTargetBroker(t, {
			authId: "user_race_broker",
			brokerageName: "Race Brokerage",
			orgId: "org_race_brokerage",
			portalSlug: "race",
		});
		const provisioning = createWorkosProvisioningMock({
			deactivateOrganizationMembership: vi.fn().mockImplementation(async () => {
				await t.run(async (ctx) => {
					await ctx.db.patch(lenderId, {
						brokerId: raceBroker.targetBrokerId,
						orgId: raceBroker.orgId,
					});
				});
				return createWorkosMembership({
					id: "om_old",
					organizationId: "org_current_brokerage",
					status: "inactive",
					userId: "user_lender",
				});
			}),
			memberships: [
				createWorkosMembership({
					id: "om_old",
					organizationId: "org_current_brokerage",
					userId: "user_lender",
				}),
			],
		});
		setWorkosProvisioningForTests(provisioning);

		let thrown: unknown;
		try {
			await t.withIdentity(FAIRLEND_ADMIN).action(reassignBrokerRef, {
				expectedCurrentBrokerId: currentBrokerId,
				expectedCurrentOrgId: "org_current_brokerage",
				lenderId,
				targetBrokerId: target.targetBrokerId,
			});
		} catch (error) {
			thrown = error;
		}

		expect(thrownMessage(thrown)).toContain(
			"Identity transfer incomplete. Lender assignment was not changed."
		);
		expect(thrownMessage(thrown)).toContain("Repair needed.");

		const after = await readCanonicalAssignment(t, { lenderId, lenderUserId });
		expect(after.lender?.brokerId).toBe(raceBroker.targetBrokerId);
		expect(after.lender?.orgId).toBe(raceBroker.orgId);
		expect(after.user?.homePortalId).not.toBe(target.targetPortalId);

		const attempt = await readLatestAttemptForLender(t, lenderId);
		expect(attempt?.status).toBe("repair_needed");
		expect(attempt?.failurePhase).toBe("convex_patch");
		expect(attempt?.rollbackStatus).toBe("not_needed");
		expect(attempt?.targetMembershipId).toBe("om_target");
		expect(attempt?.targetMembershipWasPreexisting).toBe(false);
		expect(attempt?.failureMessage).toContain(
			"Lender assignment changed during reassignment"
		);
		expect(thrownMessage(thrown)).toContain(String(attempt?._id));
	});

	it("blocks stale expected current broker before WorkOS and leaves Convex unchanged", async () => {
		const t = createTestHarness();
		const { lenderId, lenderUserId } = await seedBaseReassignmentFixture(t);
		const staleBroker = await seedExternalTargetBroker(t, {
			authId: "user_stale_broker",
			brokerageName: "Stale Brokerage",
			orgId: "org_stale_brokerage",
			portalSlug: "stale",
		});
		const target = await seedExternalTargetBroker(t);
		const before = await readCanonicalAssignment(t, { lenderId, lenderUserId });
		const provisioning = createWorkosProvisioningMock();
		setWorkosProvisioningForTests(provisioning);

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(reassignBrokerRef, {
				expectedCurrentBrokerId: staleBroker.targetBrokerId,
				expectedCurrentOrgId: "org_current_brokerage",
				lenderId,
				targetBrokerId: target.targetBrokerId,
			})
		).rejects.toThrow(
			"Lender broker assignment changed. Refresh and try again."
		);

		expect(provisioning.listOrganizationMemberships).not.toHaveBeenCalled();
		const after = await readCanonicalAssignment(t, { lenderId, lenderUserId });
		expect(after.lender?.brokerId).toBe(before.lender?.brokerId);
		expect(after.lender?.orgId).toBe(before.lender?.orgId);
		expect(after.user?.homePortalId).toBe(before.user?.homePortalId);
		const attempt = await readLatestAttemptForLender(t, lenderId);
		expect(attempt?.status).toBe("failed");
		expect(attempt?.failurePhase).toBe("validation");
		expect(attempt?.failureMessage).toContain(
			"Lender broker assignment changed. Refresh and try again."
		);
	});

	it("blocks stale expected current org before WorkOS and leaves Convex unchanged", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId, lenderUserId } =
			await seedBaseReassignmentFixture(t);
		const target = await seedExternalTargetBroker(t);
		const before = await readCanonicalAssignment(t, { lenderId, lenderUserId });
		const provisioning = createWorkosProvisioningMock();
		setWorkosProvisioningForTests(provisioning);

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(reassignBrokerRef, {
				expectedCurrentBrokerId: currentBrokerId,
				expectedCurrentOrgId: "org_stale",
				lenderId,
				targetBrokerId: target.targetBrokerId,
			})
		).rejects.toThrow(
			"Lender organization assignment changed. Refresh and try again."
		);

		expect(provisioning.listOrganizationMemberships).not.toHaveBeenCalled();
		const after = await readCanonicalAssignment(t, { lenderId, lenderUserId });
		expect(after.lender?.brokerId).toBe(before.lender?.brokerId);
		expect(after.lender?.orgId).toBe(before.lender?.orgId);
		expect(after.user?.homePortalId).toBe(before.user?.homePortalId);
	});

	it("ensures the FairLend app portal when preview has no target portal id", async () => {
		const t = createTestHarness();
		const { currentBrokerId, lenderId, lenderUserId } =
			await seedBaseReassignmentFixture(t);
		const target = await seedFairLendTargetBrokerWithoutPortal(t);
		const provisioning = createWorkosProvisioningMock({
			memberships: [
				createWorkosMembership({
					id: "om_old",
					organizationId: "org_current_brokerage",
					userId: "user_lender",
				}),
			],
		});
		setWorkosProvisioningForTests(provisioning);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(reassignBrokerRef, {
				expectedCurrentBrokerId: currentBrokerId,
				expectedCurrentOrgId: "org_current_brokerage",
				lenderId,
				targetBrokerId: target.targetBrokerId,
			});

		const user = await t.run(async (ctx) => ctx.db.get(lenderUserId));
		const ensuredPortal = await t.run(async (ctx) =>
			ctx.db
				.query("portals")
				.withIndex("by_slug", (query) => query.eq("slug", FAIRLEND_PORTAL_SLUG))
				.first()
		);
		expect(ensuredPortal?._id).toBe(result.targetPortalId);
		expect(ensuredPortal?.portalType).toBe("fairlend");
		expect(user?.homePortalId).toBe(result.targetPortalId);
	});
});
