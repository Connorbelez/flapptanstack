import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../../../../convex/_generated/api";
import {
	setWorkosProvisioningForTests,
	type WorkosProvisioning,
} from "../../../../convex/engine/effects/workosProvisioning";
import { ensureSeededIdentity } from "../../auth/helpers";
import {
	createGovernedTestConvex,
	getLatestAuditJournalRow,
	runAssignRoleAction,
} from "./helpers";
import {
	approveBrokerApplication,
	buildVerifiedMemberIdentity,
	createActivePortal,
	getApplication,
	getReviewEntries,
	getUserByAuthId,
	prepareActivationReadyBrokerApplication,
	startBrokerApplication,
	submitBrokerApplication,
} from "./brokerApplicationTestHelpers";

process.env.DISABLE_GT_HASHCHAIN = "true";
process.env.DISABLE_CASH_LEDGER_HASHCHAIN = "true";

function createProvisioningMock(overrides?: {
	createOrganization?: WorkosProvisioning["createOrganization"];
	createOrganizationMembership?: WorkosProvisioning["createOrganizationMembership"];
	createUser?: WorkosProvisioning["createUser"];
	listUsers?: WorkosProvisioning["listUsers"];
}): WorkosProvisioning {
	return {
		createOrganization:
			overrides?.createOrganization ??
			vi.fn().mockResolvedValue({ id: "org_broker_activation" }),
		createOrganizationMembership:
			overrides?.createOrganizationMembership ?? vi.fn().mockResolvedValue({}),
		createUser:
			overrides?.createUser ??
			vi
				.fn()
				.mockResolvedValue({ email: "provisioned@test.fairlend.ca", id: "user_new" }),
		deactivateOrganizationMembership: vi.fn().mockResolvedValue({
			id: "om_old",
			organizationId: "org_old",
			roleSlug: "lender",
			roleSlugs: ["lender"],
			status: "inactive",
			userId: "user_lender",
		}),
		deleteOrganizationMembership: vi.fn().mockResolvedValue(undefined),
		listOrganizationMemberships: vi.fn().mockResolvedValue([]),
		listUsers: overrides?.listUsers ?? vi.fn().mockResolvedValue([]),
	};
}

async function submitActivationReadyApplication(
	label: string,
	options?: {
		licenseNumber?: string;
		portalSlug?: string;
	}
) {
	const t = createGovernedTestConvex();
	const identity = buildVerifiedMemberIdentity(label);
	const startResult = await startBrokerApplication(t, identity);
	const activationInput = await prepareActivationReadyBrokerApplication(
		t,
		identity,
		{
			applicationId: startResult.application._id,
			licenseNumber: options?.licenseNumber,
			portalSlug: options?.portalSlug ?? `${label}-portal`,
		}
	);
	await submitBrokerApplication(t, identity, startResult.application._id);
	return { activationInput, identity, startResult, t };
}

async function getLinkedRequest(
	t: ReturnType<typeof createGovernedTestConvex>,
	applicationId: Parameters<typeof getApplication>[1]
) {
	const application = await getApplication(t, applicationId);
	if (!application?.downstreamOnboardingRequestId) {
		throw new Error("Expected application to have linked request");
	}
	const request = await t.run(async (ctx) =>
		ctx.db.get(application.downstreamOnboardingRequestId!)
	);
	if (!request) {
		throw new Error("Expected linked request to exist");
	}
	return { application, request };
}

async function runLinkedRequestRoleAssignment(
	t: ReturnType<typeof createGovernedTestConvex>,
	applicationId: Parameters<typeof getApplication>[1]
) {
	const { request } = await getLinkedRequest(t, applicationId);
	const approveJournal = await getLatestAuditJournalRow(t, request._id);
	if (!approveJournal) {
		throw new Error("Expected approved downstream request audit journal");
	}
	await runAssignRoleAction(t, {
		entityId: request._id,
		journalEntryId: approveJournal._id,
	});
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	setWorkosProvisioningForTests(null);
	vi.restoreAllMocks();
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe("broker onboarding downstream handoff", () => {
	it("creates and approves one downstream onboardingRequest when an application is approved", async () => {
		const { identity, startResult, t } =
			await submitActivationReadyApplication("handoff-create");

		await approveBrokerApplication(t, startResult.application._id);

		const { application, request } = await getLinkedRequest(
			t,
			startResult.application._id
		);
		const entries = await getReviewEntries(t, startResult.application._id);

		expect(application.status).toBe("approved");
		expect(application.downstreamHandoffStatus).toBe("linked");
		expect(request.status).toBe("approved");
		expect(request.requestedRole).toBe("broker");
		expect(request.userId).toBe(application.userId);
		expect(request.portalId).toBe(application.portalId);
		expect(request.referralSource).toBe("self_signup");
		expect(request.brokerOnboardingApplicationId).toBe(
			startResult.application._id
		);
		expect(
			entries.some(
				(entry) =>
					entry.systemEventType === "downstream_onboarding_request_linked"
			)
		).toBe(true);

		await approveBrokerApplication(t, startResult.application._id).catch((error) =>
			expect(error.message).toContain("Only submitted applications")
		);
		const requests = await t.run(async (ctx) =>
			ctx.db
				.query("onboardingRequests")
				.withIndex("by_broker_onboarding_application", (query) =>
					query.eq("brokerOnboardingApplicationId", startResult.application._id)
				)
				.collect()
		);
		expect(requests).toHaveLength(1);
		expect(identity.subject).toBe(application.authUserId);
	});

	it("fails closed when an existing downstream onboardingRequest is rejected", async () => {
		const { startResult, t } = await submitActivationReadyApplication(
			"handoff-rejected-downstream"
		);
		const application = await getApplication(t, startResult.application._id);
		if (!application) {
			throw new Error("Expected broker application to exist");
		}

		await t.run(async (ctx) => {
			const now = Date.now();
			await ctx.db.insert("onboardingRequests", {
				userId: application.userId,
				requestedRole: "broker",
				status: "rejected",
				machineContext: undefined,
				lastTransitionAt: now,
				referralSource: "self_signup",
				brokerOnboardingApplicationId: application._id,
				targetOrganizationId: undefined,
				portalId: application.portalId,
				rejectionReason: "Rejected before broker application approval",
				createdAt: now,
			});
		});

		await expect(
			approveBrokerApplication(t, startResult.application._id)
		).rejects.toThrow(
			'Cannot hand off broker application to downstream onboarding request in status "rejected"'
		);
		const unchangedApplication = await getApplication(
			t,
			startResult.application._id
		);

		expect(unchangedApplication?.status).toBe("submitted");
		expect(unchangedApplication?.downstreamOnboardingRequestId).toBeUndefined();
		expect(unchangedApplication?.downstreamHandoffStatus).toBe("not_started");
	});

	it("activates broker, portal, and home portal after downstream role assignment completes", async () => {
		const { activationInput, identity, startResult, t } =
			await submitActivationReadyApplication("handoff-activate", {
				licenseNumber: "ON-HANDOFF-ACTIVATE",
				portalSlug: "handoff-activate",
			});
		const provisioning = createProvisioningMock({
			createOrganization: vi
				.fn()
				.mockResolvedValue({ id: "org_handoff_activate" }),
		});
		setWorkosProvisioningForTests(provisioning);

		await approveBrokerApplication(t, startResult.application._id);
		await runLinkedRequestRoleAssignment(t, startResult.application._id);

		const { application, request } = await getLinkedRequest(
			t,
			startResult.application._id
		);
		const user = await getUserByAuthId(t, identity.subject);
		const broker = await t.run(async (ctx) =>
			ctx.db
				.query("brokers")
				.withIndex("by_license", (query) =>
					query.eq("licenseId", activationInput.licenseNumber)
				)
				.unique()
		);
		const portal = await t.run(async (ctx) =>
			ctx.db
				.query("portals")
				.withIndex("by_slug", (query) => query.eq("slug", "handoff-activate"))
				.unique()
		);

		expect(provisioning.createOrganization).toHaveBeenCalledTimes(1);
		expect(provisioning.createOrganizationMembership).toHaveBeenCalledWith({
			userId: identity.subject,
			organizationId: "org_handoff_activate",
			roleSlug: "broker",
		});
		expect(request.status).toBe("role_assigned");
		expect(request.targetOrganizationId).toBe("org_handoff_activate");
		expect(application.status).toBe("activated");
		expect(application.downstreamHandoffStatus).toBe("activated");
		expect(application.activatedBrokerId).toBe(broker?._id);
		expect(application.activatedPortalId).toBe(portal?._id);
		expect(application.activatedHomePortalId).toBe(portal?._id);
		expect(application.activationOutcome).toMatchObject({
			brokerId: broker?._id,
			homePortalId: portal?._id,
			onboardingRequestId: request._id,
			portalId: portal?._id,
			targetOrganizationId: "org_handoff_activate",
			userId: user?._id,
		});
		expect(broker).toMatchObject({
			brokerOnboardingApplicationId: startResult.application._id,
			activatedPortalId: portal?._id,
			licenseId: "ON-HANDOFF-ACTIVATE",
			orgId: "org_handoff_activate",
			referralSource: "self_signup",
			status: "active",
			userId: user?._id,
		});
		expect(portal).toMatchObject({
			brokerId: broker?._id,
			orgId: "org_handoff_activate",
			portalType: "broker",
			status: "active",
			isPublished: true,
		});
		expect(user?.homePortalId).toBe(portal?._id);
	});

	it("activates when downstream onboarding request is already role_assigned at approval time", async () => {
		const { activationInput, identity, startResult, t } =
			await submitActivationReadyApplication("handoff-prelinked-ra", {
				licenseNumber: "ON-HANDOFF-PRELINKED-RA",
				portalSlug: "handoff-prelinked-ra",
			});
		const provisioning = createProvisioningMock({
			createOrganization: vi
				.fn()
				.mockResolvedValue({ id: "org_handoff_prelinked_ra" }),
		});
		setWorkosProvisioningForTests(provisioning);

		const applicationBefore = await getApplication(t, startResult.application._id);
		if (!applicationBefore) {
			throw new Error("Expected broker application to exist");
		}
		const now = Date.now();
		const prelinkedRequestId = await t.run(async (ctx) => {
			return await ctx.db.insert("onboardingRequests", {
				userId: applicationBefore.userId,
				requestedRole: "broker",
				status: "role_assigned",
				machineContext: undefined,
				lastTransitionAt: now,
				referralSource: "self_signup",
				brokerOnboardingApplicationId: startResult.application._id,
				targetOrganizationId: "org_handoff_prelinked_ra",
				portalId: applicationBefore.portalId,
				createdAt: now,
			});
		});
		await t.run(async (ctx) => {
			await ctx.db.patch(startResult.application._id, {
				downstreamOnboardingRequestId: prelinkedRequestId,
				downstreamHandoffStatus: "role_assigned",
				downstreamLinkedAt: now,
				downstreamRoleAssignedAt: now,
				lastActivityAt: now,
				updatedAt: now,
			});
		});

		await approveBrokerApplication(t, startResult.application._id);

		const broker = await t.run(async (ctx) =>
			ctx.db
				.query("brokers")
				.withIndex("by_license", (query) =>
					query.eq("licenseId", activationInput.licenseNumber)
				)
				.unique()
		);
		const portal = await t.run(async (ctx) =>
			ctx.db
				.query("portals")
				.withIndex("by_slug", (query) =>
					query.eq("slug", "handoff-prelinked-ra")
				)
				.unique()
		);
		const activatedApplication = await getApplication(
			t,
			startResult.application._id
		);
		const user = await getUserByAuthId(t, identity.subject);

		expect(provisioning.createOrganizationMembership).not.toHaveBeenCalled();
		expect(activatedApplication?.status).toBe("activated");
		expect(activatedApplication?.downstreamHandoffStatus).toBe("activated");
		expect(activatedApplication?.activatedBrokerId).toBe(broker?._id);
		expect(broker).toMatchObject({
			brokerOnboardingApplicationId: startResult.application._id,
			licenseId: "ON-HANDOFF-PRELINKED-RA",
			orgId: "org_handoff_prelinked_ra",
			userId: user?._id,
		});
		expect(user?.homePortalId).toBe(portal?._id);
	});

	it("reuses the canonical broker and portal when activation callbacks replay", async () => {
		const { startResult, t } = await submitActivationReadyApplication(
			"handoff-replay",
			{
				licenseNumber: "ON-HANDOFF-REPLAY",
				portalSlug: "handoff-replay",
			}
		);
		setWorkosProvisioningForTests(createProvisioningMock());

		await approveBrokerApplication(t, startResult.application._id);
		await runLinkedRequestRoleAssignment(t, startResult.application._id);
		const first = await getApplication(t, startResult.application._id);

		await t.mutation(
			internal.onboarding.brokerApplication.internal
				.completeActivationForDownstreamRequest,
			{
				onboardingRequestId: first!.downstreamOnboardingRequestId!,
				authorAuthId: "system",
				authorType: "system",
			}
		);

		const second = await getApplication(t, startResult.application._id);
		const brokers = await t.run(async (ctx) => ctx.db.query("brokers").collect());
		const portals = await t.run(async (ctx) =>
			ctx.db
				.query("portals")
				.withIndex("by_slug", (query) => query.eq("slug", "handoff-replay"))
				.collect()
		);

		expect(second?.status).toBe("activated");
		expect(second?.activatedBrokerId).toBe(first?.activatedBrokerId);
		expect(second?.activatedPortalId).toBe(first?.activatedPortalId);
		expect(brokers.filter((broker) => broker.licenseId === "ON-HANDOFF-REPLAY"))
			.toHaveLength(1);
		expect(portals).toHaveLength(1);
	});

	it("fails closed when requested portal slug is already claimed", async () => {
		const { startResult, t } = await submitActivationReadyApplication(
			"handoff-slug-conflict",
			{
				licenseNumber: "ON-HANDOFF-SLUG-CONFLICT",
				portalSlug: "claimed-slug",
			}
		);
		await createActivePortal(t, "claimed-slug");
		setWorkosProvisioningForTests(createProvisioningMock());

		await approveBrokerApplication(t, startResult.application._id);
		const { request } = await getLinkedRequest(t, startResult.application._id);
		const approveJournal = await getLatestAuditJournalRow(t, request._id);

		await expect(
			runAssignRoleAction(t, {
				entityId: request._id,
				journalEntryId: approveJournal!._id,
			})
		).rejects.toThrow("Portal slug");

		const application = await getApplication(t, startResult.application._id);
		expect(application?.status).toBe("approved");
		expect(application?.downstreamHandoffStatus).toBe("linked");
	});

	it("fails closed when the verified license is already linked to another user", async () => {
		const { startResult, t } = await submitActivationReadyApplication(
			"handoff-license-conflict",
			{
				licenseNumber: "ON-HANDOFF-LICENSE-CONFLICT",
				portalSlug: "license-conflict",
			}
		);
		const conflictingIdentity = buildVerifiedMemberIdentity(
			"handoff-license-existing"
		);
		await ensureSeededIdentity(t, conflictingIdentity);
		const conflictingUser = await getUserByAuthId(t, conflictingIdentity.subject);
		await t.run(async (ctx) => {
			await ctx.db.insert("brokers", {
				createdAt: Date.now(),
				licenseId: "ON-HANDOFF-LICENSE-CONFLICT",
				orgId: "org_conflicting_broker",
				status: "active",
				userId: conflictingUser!._id,
			});
		});
		setWorkosProvisioningForTests(createProvisioningMock());

		await approveBrokerApplication(t, startResult.application._id);
		const { request } = await getLinkedRequest(t, startResult.application._id);
		const approveJournal = await getLatestAuditJournalRow(t, request._id);

		await expect(
			runAssignRoleAction(t, {
				entityId: request._id,
				journalEntryId: approveJournal!._id,
			})
		).rejects.toThrow("different user");

		const application = await getApplication(t, startResult.application._id);
		expect(application?.status).toBe("approved");
		expect(application?.activatedBrokerId).toBeUndefined();
	});

	it("rejects reserved portal slugs during activation", async () => {
		const { startResult, t } = await submitActivationReadyApplication(
			"handoff-reserved-slug",
			{
				licenseNumber: "ON-HANDOFF-RESERVED",
				portalSlug: "admin",
			}
		);
		setWorkosProvisioningForTests(createProvisioningMock());

		await approveBrokerApplication(t, startResult.application._id);
		const { request } = await getLinkedRequest(t, startResult.application._id);
		const approveJournal = await getLatestAuditJournalRow(t, request._id);

		await expect(
			runAssignRoleAction(t, {
				entityId: request._id,
				journalEntryId: approveJournal!._id,
			})
		).rejects.toThrow("reserved");
	});
});
