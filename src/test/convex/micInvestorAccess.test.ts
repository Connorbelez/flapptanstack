import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
	type WorkosProvisioning,
	setWorkosProvisioningForTests,
} from "../../../convex/engine/effects/workosProvisioning";
import { micPortalFields } from "../../../convex/portals/helpers";
import { FAIRLEND_ADMIN } from "../auth/identities";
import { createTestConvex, ensureSeededIdentity } from "../auth/helpers";
import { drainScheduledWork } from "./runtime";

function createProvisioningMock(overrides?: {
	createOrganizationMembership?: WorkosProvisioning["createOrganizationMembership"];
	createUser?: WorkosProvisioning["createUser"];
	listUsers?: WorkosProvisioning["listUsers"];
}) {
	return {
		createOrganization: vi.fn().mockResolvedValue({ id: "org_unused" }),
		createOrganizationMembership:
			overrides?.createOrganizationMembership ??
			vi.fn().mockResolvedValue({ id: "om_mic_test" }),
		createUser:
			overrides?.createUser ??
			vi
				.fn()
				.mockResolvedValue({ email: "investor@test.fairlend.ca", id: "user_mic_test" }),
		listUsers: overrides?.listUsers ?? vi.fn().mockResolvedValue([]),
	} satisfies WorkosProvisioning;
}

async function seedMicPortal(t: ReturnType<typeof createTestConvex>) {
	return await t.run(async (ctx) => {
		const now = Date.now();
		const orgId = "org_mic_test";
		const brokerUserId = await ctx.db.insert("users", {
			authId: "user_mic_broker",
			email: "broker-mic@test.fairlend.ca",
			firstName: "MIC",
			lastName: "Broker",
		});
		const brokerId = await ctx.db.insert("brokers", {
			status: "active",
			lastTransitionAt: undefined,
			userId: brokerUserId,
			licenseId: undefined,
			licenseProvince: undefined,
			brokerageName: "MIC Test Brokerage",
			orgId,
			onboardedAt: now,
			createdAt: now,
		});
		const lenderUserId = await ctx.db.insert("users", {
			authId: "user_mic_lender",
			email: "lender-mic@test.fairlend.ca",
			firstName: "MIC",
			lastName: "Lender",
		});
		const lenderId = await ctx.db.insert("lenders", {
			userId: lenderUserId,
			orgId,
			brokerId,
			accreditationStatus: "accredited",
			idvStatus: undefined,
			kycStatus: undefined,
			personaInquiryId: undefined,
			onboardingEntryPath: "admin_invite",
			onboardingId: undefined,
			status: "active",
			activatedAt: now,
			createdAt: now,
			payoutFrequency: undefined,
			lastPayoutDate: undefined,
			minimumPayoutCents: undefined,
		});
		const portalId = await ctx.db.insert(
			"portals",
			micPortalFields({
				lenderId,
				now,
				orgId,
				slug: "mic",
			})
		);

		return { orgId, portalId };
	});
}

async function getMicRequest(
	t: ReturnType<typeof createTestConvex>,
	requestId: Id<"micInvestorAccessRequests">
) {
	return await t.run(async (ctx) => await ctx.db.get(requestId));
}

async function getMicRequestsByEmail(
	t: ReturnType<typeof createTestConvex>,
	portalId: Id<"portals">,
	normalizedEmail: string
) {
	return await t.run(async (ctx) =>
		await ctx.db
			.query("micInvestorAccessRequests")
			.withIndex("by_portal_normalized_email", (query) =>
				query.eq("portalId", portalId).eq("normalizedEmail", normalizedEmail)
			)
			.collect()
	);
}

describe("mic investor access workflow", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		setWorkosProvisioningForTests(null);
		vi.restoreAllMocks();
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("dedupes public requests by portal and normalized email", async () => {
		const t = createTestConvex();
		const { portalId } = await seedMicPortal(t);

		const first = await t.mutation(api.micInvestorAccess.mutations.submitRequest, {
			email: "Investor@Test.FairLend.ca",
			portalSlug: "mic",
		});
		const second = await t.mutation(api.micInvestorAccess.mutations.submitRequest, {
			email: "investor@test.fairlend.ca",
			portalSlug: "mic",
		});
		const requests = await getMicRequestsByEmail(
			t,
			portalId,
			"investor@test.fairlend.ca"
		);

		expect(first).toEqual({ ok: true });
		expect(second).toEqual({ ok: true });
		expect(requests).toHaveLength(1);
	});

	it("approves a request, provisions MIC access, and syncs the user's home portal", async () => {
		const t = createTestConvex();
		const { portalId } = await seedMicPortal(t);
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		setWorkosProvisioningForTests(
			createProvisioningMock({
				createOrganizationMembership: vi
					.fn()
					.mockResolvedValue({ id: "om_approved" }),
				createUser: vi.fn().mockResolvedValue({
					email: "approved@test.fairlend.ca",
					id: "user_approved",
				}),
			})
		);

		await t.mutation(api.micInvestorAccess.mutations.submitRequest, {
			email: "approved@test.fairlend.ca",
			portalSlug: "mic",
		});
		const [submittedRequest] = await getMicRequestsByEmail(
			t,
			portalId,
			"approved@test.fairlend.ca"
		);
		if (!submittedRequest) {
			throw new Error("Expected submitted MIC request");
		}
		const requestId = submittedRequest._id;

		await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.micInvestorAccess.mutations.approveRequest,
			{ requestId }
		);
		await drainScheduledWork(t, { flushMicrotasks: true });

		const request = await getMicRequest(t, requestId);
		const provisionedUser = await t.run(async (ctx) =>
			ctx.db
				.query("users")
				.withIndex("authId", (query) => query.eq("authId", "user_approved"))
				.unique()
		);
		const membership = await t.run(async (ctx) =>
			ctx.db
				.query("organizationMemberships")
				.withIndex("byUser", (query) => query.eq("userWorkosId", "user_approved"))
				.first()
		);

		expect(request?.status).toBe("approved");
		expect(request?.provisioningState).toBe("provisioned");
		expect(request?.workosUserId).toBe("user_approved");
		expect(request?.workosMembershipId).toBe("om_approved");
		expect(provisionedUser?.homePortalId).toBe(portalId);
		expect(membership?.organizationWorkosId).toBe("org_mic_test");
		expect(membership?.roleSlug).toBe("micinvestor");
	});

	it("records provisioning failures without pretending access was granted", async () => {
		const t = createTestConvex();
		const { portalId } = await seedMicPortal(t);
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		setWorkosProvisioningForTests(
			createProvisioningMock({
				createOrganizationMembership: vi
					.fn()
					.mockRejectedValue(new Error("membership failed")),
				createUser: vi.fn().mockResolvedValue({
					email: "failed@test.fairlend.ca",
					id: "user_failed",
				}),
			})
		);

		await t.mutation(api.micInvestorAccess.mutations.submitRequest, {
			email: "failed@test.fairlend.ca",
			portalSlug: "mic",
		});
		const [submittedRequest] = await getMicRequestsByEmail(
			t,
			portalId,
			"failed@test.fairlend.ca"
		);
		if (!submittedRequest) {
			throw new Error("Expected submitted MIC request");
		}
		const requestId = submittedRequest._id;

		await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.micInvestorAccess.mutations.approveRequest,
			{ requestId }
		);
		await drainScheduledWork(t, { flushMicrotasks: true });

		const request = await getMicRequest(t, requestId);
		expect(request?.status).toBe("approved");
		expect(request?.provisioningState).toBe("failed");
		expect(request?.provisioningError).toContain("membership failed");
	});
});
