import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../../../../convex/_generated/api";
import { createGovernedTestConvex, drainScheduledWork } from "./helpers";
import {
	approveBrokerApplication,
	buildVerifiedMemberIdentity,
	createActivePortal,
	getApplication,
	getReviewEntries,
	getUserByAuthId,
	insertDownstreamOnboardingRequest,
	linkDownstreamOnboardingRequest,
	markBrokerApplicationActivated,
	markDownstreamRoleAssigned,
	startBrokerApplication,
	submitBrokerApplication,
} from "./brokerApplicationTestHelpers";

process.env.DISABLE_GT_HASHCHAIN = "true";
process.env.DISABLE_CASH_LEDGER_HASHCHAIN = "true";

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
});

async function submitBrokerApplicationAndDrain(
	...args: Parameters<typeof submitBrokerApplication>
) {
	const [t] = args;
	await submitBrokerApplication(...args);
	await drainScheduledWork(t);
}

describe("broker onboarding downstream handoff", () => {
	it("links an approved application to a downstream onboardingRequest and backfills the request link", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("handoff-link");
		const startResult = await startBrokerApplication(t, identity);
		await submitBrokerApplicationAndDrain(t, identity, startResult.application._id);
		await approveBrokerApplication(t, startResult.application._id);

		const user = await getUserByAuthId(t, identity.subject);
		const requestId = await insertDownstreamOnboardingRequest(t, {
			status: "pending_review",
			userId: user!._id,
		});

		await linkDownstreamOnboardingRequest(t, {
			applicationId: startResult.application._id,
			onboardingRequestId: requestId,
		});

		const application = await getApplication(t, startResult.application._id);
		const request = await t.run(async (ctx) => ctx.db.get(requestId));

		expect(application?.status).toBe("approved");
		expect(application?.downstreamOnboardingRequestId).toBe(requestId);
		expect(application?.downstreamHandoffStatus).toBe("linked");
		expect(request?.brokerOnboardingApplicationId).toBe(
			startResult.application._id
		);
		expect(request?.portalId).toBe(startResult.application.portalId);
	});

	it("records role-assigned handoff state once the linked onboarding request reaches role_assigned", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("handoff-role-assigned");
		const startResult = await startBrokerApplication(t, identity);
		await submitBrokerApplicationAndDrain(t, identity, startResult.application._id);
		await approveBrokerApplication(t, startResult.application._id);

		const user = await getUserByAuthId(t, identity.subject);
		const requestId = await insertDownstreamOnboardingRequest(t, {
			status: "role_assigned",
			userId: user!._id,
		});

		await linkDownstreamOnboardingRequest(t, {
			applicationId: startResult.application._id,
			onboardingRequestId: requestId,
		});
		await markDownstreamRoleAssigned(t, startResult.application._id);

		const application = await getApplication(t, startResult.application._id);
		const entries = await getReviewEntries(t, startResult.application._id);

		expect(application?.downstreamHandoffStatus).toBe("role_assigned");
		expect(application?.downstreamRoleAssignedAt).toBeTypeOf("number");
		expect(
			entries.some(
				(entry) => entry.systemEventType === "downstream_role_assigned"
			)
		).toBe(true);
	});

	it("activates only after role assignment and home-portal synchronization complete", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("handoff-activate");
		const startResult = await startBrokerApplication(t, identity);
		await submitBrokerApplicationAndDrain(t, identity, startResult.application._id);
		await approveBrokerApplication(t, startResult.application._id);

		const user = await getUserByAuthId(t, identity.subject);
		const activatedPortalId = await createActivePortal(t, "handoff-activate-portal");
		const requestId = await insertDownstreamOnboardingRequest(t, {
			portalId: startResult.application.portalId,
			status: "role_assigned",
			userId: user!._id,
		});

		await linkDownstreamOnboardingRequest(t, {
			applicationId: startResult.application._id,
			onboardingRequestId: requestId,
		});
		await t.run(async (ctx) => {
			await ctx.db.patch(user!._id, { homePortalId: activatedPortalId });
		});
		await markBrokerApplicationActivated(t, {
			activatedHomePortalId: activatedPortalId,
			activatedPortalId,
			applicationId: startResult.application._id,
		});

		const application = await getApplication(t, startResult.application._id);
		const entries = await getReviewEntries(t, startResult.application._id);

		expect(application?.status).toBe("activated");
		expect(application?.downstreamHandoffStatus).toBe("activated");
		expect(application?.activatedPortalId).toBe(activatedPortalId);
		expect(application?.activatedHomePortalId).toBe(activatedPortalId);
		expect(
			entries.some(
				(entry) => entry.systemEventType === "application_activated"
			)
		).toBe(true);
	});

	it("keeps activated handoff state stable when downstream callbacks replay", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("handoff-activation-replay");
		const startResult = await startBrokerApplication(t, identity);
		await submitBrokerApplicationAndDrain(t, identity, startResult.application._id);
		await approveBrokerApplication(t, startResult.application._id);

		const user = await getUserByAuthId(t, identity.subject);
		const activatedPortalId = await createActivePortal(
			t,
			"handoff-activation-replay-portal"
		);
		const requestId = await insertDownstreamOnboardingRequest(t, {
			portalId: startResult.application.portalId,
			status: "role_assigned",
			userId: user!._id,
		});

		await linkDownstreamOnboardingRequest(t, {
			applicationId: startResult.application._id,
			onboardingRequestId: requestId,
		});
		await t.run(async (ctx) => {
			await ctx.db.patch(user!._id, { homePortalId: activatedPortalId });
		});
		await markBrokerApplicationActivated(t, {
			activatedHomePortalId: activatedPortalId,
			activatedPortalId,
			applicationId: startResult.application._id,
		});

		await linkDownstreamOnboardingRequest(t, {
			applicationId: startResult.application._id,
			onboardingRequestId: requestId,
		});
		await markDownstreamRoleAssigned(t, startResult.application._id);

		const application = await getApplication(t, startResult.application._id);
		expect(application?.status).toBe("activated");
		expect(application?.downstreamHandoffStatus).toBe("activated");
		expect(application?.activatedPortalId).toBe(activatedPortalId);
	});

	it("rejects activation when portal evidence is not the synchronized active portal", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("handoff-activation-portal");
		const startResult = await startBrokerApplication(t, identity);
		await submitBrokerApplicationAndDrain(t, identity, startResult.application._id);
		await approveBrokerApplication(t, startResult.application._id);

		const user = await getUserByAuthId(t, identity.subject);
		const activatedPortalId = await createActivePortal(
			t,
			"handoff-activation-portal"
		);
		const mismatchedPortalId = await createActivePortal(
			t,
			"handoff-activation-mismatch"
		);
		const requestId = await insertDownstreamOnboardingRequest(t, {
			portalId: startResult.application.portalId,
			status: "role_assigned",
			userId: user!._id,
		});

		await linkDownstreamOnboardingRequest(t, {
			applicationId: startResult.application._id,
			onboardingRequestId: requestId,
		});
		await t.run(async (ctx) => {
			await ctx.db.patch(user!._id, { homePortalId: activatedPortalId });
		});

		await expect(
			t.mutation(internal.onboarding.brokerApplication.internal.markActivated, {
				activatedHomePortalId: activatedPortalId,
				activatedPortalId: mismatchedPortalId,
				applicationId: startResult.application._id,
				authorAuthId: "admin_test",
				authorType: "admin",
			})
		).rejects.toThrow("synchronized home portal");

		await t.run(async (ctx) => {
			await ctx.db.patch(activatedPortalId, { status: "suspended" });
		});
		await expect(
			t.mutation(internal.onboarding.brokerApplication.internal.markActivated, {
				activatedHomePortalId: activatedPortalId,
				activatedPortalId,
				applicationId: startResult.application._id,
				authorAuthId: "admin_test",
				authorType: "admin",
			})
		).rejects.toThrow("active and published");
	});

	it("rejects activation before the downstream onboarding request reaches role_assigned", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("handoff-reject-activation");
		const startResult = await startBrokerApplication(t, identity);
		await submitBrokerApplicationAndDrain(t, identity, startResult.application._id);
		await approveBrokerApplication(t, startResult.application._id);

		const user = await getUserByAuthId(t, identity.subject);
		const activatedPortalId = await createActivePortal(
			t,
			"handoff-reject-activation-portal"
		);
		const requestId = await insertDownstreamOnboardingRequest(t, {
			status: "pending_review",
			userId: user!._id,
		});

		await linkDownstreamOnboardingRequest(t, {
			applicationId: startResult.application._id,
			onboardingRequestId: requestId,
		});
		await t.run(async (ctx) => {
			await ctx.db.patch(user!._id, { homePortalId: activatedPortalId });
		});

		await expect(
			t.mutation(internal.onboarding.brokerApplication.internal.markActivated, {
				activatedHomePortalId: activatedPortalId,
				activatedPortalId,
				applicationId: startResult.application._id,
				authorAuthId: "admin_test",
				authorType: "admin",
			})
		).rejects.toThrow("role_assigned");
	});
});
