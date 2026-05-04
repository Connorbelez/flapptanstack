import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
	setWorkosProvisioningForTests,
	type WorkosProvisioning,
} from "../../../../convex/engine/effects/workosProvisioning";
import { FAIRLEND_ADMIN } from "../../auth/identities";
import { ensureSeededIdentity } from "../../auth/helpers";
import {
	createMicRequestTestConvex,
	getAuditJournalRows,
	getAuditLogEvents,
	MIC_ORG_ID,
	seedMicPortal,
	seedRequest,
	type MicRequestTestConvex,
} from "./helpers";

function createProvisioningMock(overrides?: {
	createOrganization?: WorkosProvisioning["createOrganization"];
	createOrganizationMembership?: WorkosProvisioning["createOrganizationMembership"];
	createUser?: WorkosProvisioning["createUser"];
	listUsers?: WorkosProvisioning["listUsers"];
}): WorkosProvisioning {
	return {
		createOrganization:
			overrides?.createOrganization ??
			vi.fn().mockResolvedValue({ id: "org_unused" }),
		createOrganizationMembership:
			overrides?.createOrganizationMembership ??
			vi.fn().mockResolvedValue({ id: "membership_mic_investor" }),
		createUser:
			overrides?.createUser ??
			vi.fn().mockResolvedValue({
				email: "investor@example.com",
				id: "user_mic_investor",
			}),
		listUsers: overrides?.listUsers ?? vi.fn().mockResolvedValue([]),
	};
}

async function approveMicAccessRequest(
	t: MicRequestTestConvex,
	requestId: Id<"micInvestorAccessRequests">
) {
	await ensureSeededIdentity(t, FAIRLEND_ADMIN);
	await t
		.withIdentity(FAIRLEND_ADMIN)
		.mutation(api.micInvestorAccessRequests.mutations.approveRequest, {
			requestId,
		});

	const approveJournal = (await getAuditJournalRows(t, requestId)).find(
		(row) => row.eventType === "APPROVE"
	);
	if (!approveJournal) {
		throw new Error("Expected APPROVE journal row");
	}
	return approveJournal;
}

async function runProvisioningAction(
	t: MicRequestTestConvex,
	args: {
		entityId: Id<"micInvestorAccessRequests">;
		journalEntryId: string;
	}
) {
	return await t.action(
		internal.engine.effects.micInvestorAccessRequests.provisionMicInvestorAccess,
		{
			effectName: "provisionMicInvestorAccess",
			entityId: args.entityId,
			entityType: "micInvestorAccessRequest",
			eventType: "APPROVE",
			journalEntryId: args.journalEntryId,
			source: { actorType: "system", channel: "scheduler" },
		}
	);
}

async function prepareApprovedMicRequest(email = "investor@example.com") {
	const t = createMicRequestTestConvex();
	const portalId = await seedMicPortal(t);
	const requestId = await seedRequest(t, {
		email,
		portalId,
		status: "pending_review",
	});
	const approveJournal = await approveMicAccessRequest(t, requestId);
	return { approveJournal, portalId, requestId, t };
}

describe("MIC investor access provisioning effect", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		setWorkosProvisioningForTests(null);
		vi.restoreAllMocks();
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("creates a WorkOS user and MIC membership, then marks provisioning completed", async () => {
		const { approveJournal, requestId, t } = await prepareApprovedMicRequest();
		const provisioning = createProvisioningMock();
		setWorkosProvisioningForTests(provisioning);

		await runProvisioningAction(t, {
			entityId: requestId,
			journalEntryId: approveJournal._id,
		});

		expect(provisioning.listUsers).toHaveBeenCalledWith({
			email: "investor@example.com",
		});
		expect(provisioning.createUser).toHaveBeenCalledWith({
			email: "investor@example.com",
		});
		expect(provisioning.createOrganizationMembership).toHaveBeenCalledWith({
			organizationId: MIC_ORG_ID,
			roleSlug: "micinvestor",
			userId: "user_mic_investor",
		});

		const request = await t.run(async (ctx) => await ctx.db.get(requestId));
		expect(request).toMatchObject({
			invitedUserWorkosId: "user_mic_investor",
			membershipWorkosId: "membership_mic_investor",
			provisioningState: "completed",
			status: "approved",
		});
		expect(request?.activeProvisioningJournalId).toBeUndefined();
		expect(request?.processedProvisioningJournalIds).toContain(
			approveJournal._id
		);

		const auditEvents = await getAuditLogEvents(t, requestId);
		expect(
			auditEvents.some(
				(event) =>
					event.action === "micInvestorAccessRequest.provisioning_completed"
			)
		).toBe(true);
		expect(
			(await getAuditJournalRows(t, requestId)).some(
				(row) => row.eventType === "PROVISIONING_COMPLETED"
			)
		).toBe(true);
	});

	it("reuses an existing WorkOS user when the email already exists", async () => {
		const { approveJournal, requestId, t } = await prepareApprovedMicRequest(
			"Existing@Example.com"
		);
		const provisioning = createProvisioningMock({
			listUsers: vi.fn().mockResolvedValue([
				{
					email: "existing@example.com",
					id: "user_existing_mic",
				},
			]),
		});
		setWorkosProvisioningForTests(provisioning);

		await runProvisioningAction(t, {
			entityId: requestId,
			journalEntryId: approveJournal._id,
		});

		expect(provisioning.createUser).not.toHaveBeenCalled();
		expect(provisioning.createOrganizationMembership).toHaveBeenCalledWith({
			organizationId: MIC_ORG_ID,
			roleSlug: "micinvestor",
			userId: "user_existing_mic",
		});
		const request = await t.run(async (ctx) => await ctx.db.get(requestId));
		expect(request?.invitedUserWorkosId).toBe("user_existing_mic");
	});

	it("treats existing MIC membership as an idempotent success", async () => {
		const { approveJournal, requestId, t } = await prepareApprovedMicRequest();
		const provisioning = createProvisioningMock({
			createOrganizationMembership: vi
				.fn()
				.mockRejectedValue(new Error("organization membership already exists")),
		});
		setWorkosProvisioningForTests(provisioning);

		await runProvisioningAction(t, {
			entityId: requestId,
			journalEntryId: approveJournal._id,
		});

		const request = await t.run(async (ctx) => await ctx.db.get(requestId));
		expect(request).toMatchObject({
			invitedUserWorkosId: "user_mic_investor",
			provisioningState: "completed",
		});
		expect(request?.membershipWorkosId).toBeUndefined();
	});

	it("records provisioning failure without changing the approved request status", async () => {
		const { approveJournal, requestId, t } = await prepareApprovedMicRequest();
		const provisioning = createProvisioningMock({
			createOrganizationMembership: vi
				.fn()
				.mockRejectedValue(new Error("WorkOS outage")),
		});
		setWorkosProvisioningForTests(provisioning);

		await runProvisioningAction(t, {
			entityId: requestId,
			journalEntryId: approveJournal._id,
		});

		const request = await t.run(async (ctx) => await ctx.db.get(requestId));
		expect(request).toMatchObject({
			invitedUserWorkosId: "user_mic_investor",
			provisioningError: "WorkOS outage",
			provisioningState: "failed",
			status: "approved",
		});
		expect(request?.activeProvisioningJournalId).toBeUndefined();
		expect(
			(await getAuditJournalRows(t, requestId)).some(
				(row) => row.eventType === "PROVISIONING_FAILED"
			)
		).toBe(true);
	});

	it("skips WorkOS calls when the provisioning journal was already processed", async () => {
		const { approveJournal, requestId, t } = await prepareApprovedMicRequest();
		await t.run(async (ctx) => {
			await ctx.db.patch(requestId, {
				processedProvisioningJournalIds: [approveJournal._id],
				provisioningState: "completed",
			});
		});
		const provisioning = createProvisioningMock();
		setWorkosProvisioningForTests(provisioning);

		await runProvisioningAction(t, {
			entityId: requestId,
			journalEntryId: approveJournal._id,
		});

		expect(provisioning.listUsers).not.toHaveBeenCalled();
		expect(provisioning.createUser).not.toHaveBeenCalled();
		expect(provisioning.createOrganizationMembership).not.toHaveBeenCalled();
	});

	it("assigns the MIC portal as home portal for a synced compatible user", async () => {
		const { approveJournal, portalId, requestId, t } =
			await prepareApprovedMicRequest();
		const provisioning = createProvisioningMock();
		setWorkosProvisioningForTests(provisioning);
		const userId = await t.run(async (ctx) => {
			return await ctx.db.insert("users", {
				authId: "user_mic_investor",
				email: "investor@example.com",
				firstName: "MIC",
				lastName: "Investor",
			});
		});

		await runProvisioningAction(t, {
			entityId: requestId,
			journalEntryId: approveJournal._id,
		});

		const user = await t.run(async (ctx) => await ctx.db.get(userId));
		expect(user?.homePortalId).toBe(portalId);
	});

	it("fails visibly when the MIC portal is unavailable", async () => {
		const t = createMicRequestTestConvex();
		const portalId = await seedMicPortal(t, { isPublished: false });
		const requestId = await seedRequest(t, {
			email: "unavailable@example.com",
			portalId,
			status: "pending_review",
		});
		const approveJournal = await approveMicAccessRequest(t, requestId);
		const provisioning = createProvisioningMock();
		setWorkosProvisioningForTests(provisioning);

		await runProvisioningAction(t, {
			entityId: requestId,
			journalEntryId: approveJournal._id,
		});

		expect(provisioning.listUsers).not.toHaveBeenCalled();
		const request = await t.run(async (ctx) => await ctx.db.get(requestId));
		expect(request).toMatchObject({
			provisioningError: "MIC portal unavailable for provisioning: unpublished",
			provisioningState: "failed",
			status: "approved",
		});
	});

	it("rejects overlapping active provisioning journals", async () => {
		const { approveJournal, requestId, t } = await prepareApprovedMicRequest();
		await t.run(async (ctx) => {
			await ctx.db.patch(requestId, {
				activeProvisioningJournalId: "other-journal",
				provisioningState: "in_progress",
			});
		});
		const provisioning = createProvisioningMock();
		setWorkosProvisioningForTests(provisioning);

		await expect(
			runProvisioningAction(t, {
				entityId: requestId,
				journalEntryId: approveJournal._id,
			})
		).rejects.toThrow("provisioning already in progress");

		expect(provisioning.listUsers).not.toHaveBeenCalled();
	});

	it("includes provisioning audit history in the admin detail view", async () => {
		const { approveJournal, requestId, t } = await prepareApprovedMicRequest();
		const provisioning = createProvisioningMock();
		setWorkosProvisioningForTests(provisioning);
		await runProvisioningAction(t, {
			entityId: requestId,
			journalEntryId: approveJournal._id,
		});

		const detail = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(api.micInvestorAccessRequests.queries.getAdminRequestDetail, {
				requestId,
			});

		expect(
			detail?.auditEvents.some(
				(event) =>
					event.action === "micInvestorAccessRequest.provisioning_completed"
			)
		).toBe(true);
		expect(
			detail?.journalEvents.some(
				(event) => event.eventType === "PROVISIONING_COMPLETED"
			)
		).toBe(true);
	});
});
