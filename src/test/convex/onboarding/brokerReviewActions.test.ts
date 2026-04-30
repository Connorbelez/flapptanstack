import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../../convex/_generated/api";
import { FAIRLEND_ADMIN, MEMBER } from "../../auth/identities";
import { createGovernedTestConvex, drainScheduledWork } from "./helpers";
import {
	buildVerifiedMemberIdentity,
	getApplication,
	getReviewEntries,
	prepareActivationReadyBrokerApplication,
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

async function createSubmittedApplication(label: string) {
	const t = createGovernedTestConvex();
	const identity = buildVerifiedMemberIdentity(label);
	const startResult = await startBrokerApplication(t, identity);
	await prepareActivationReadyBrokerApplication(t, identity, {
		applicationId: startResult.application._id,
		licenseNumber: `ON-${label.toUpperCase()}`,
		portalSlug: label,
	});
	await submitBrokerApplication(t, identity, startResult.application._id);
	return { applicationId: startResult.application._id, t };
}

describe("broker onboarding review actions", () => {
	it("structurally denies non-reviewers", async () => {
		const { applicationId, t } = await createSubmittedApplication(
			"review-action-unauthorized"
		);

		await expect(
			t.withIdentity(MEMBER).action(
				api.onboarding.brokerApplication.mutations.approveForReview,
				{
					applicationId,
					reviewerNote: "Looks ready.",
				}
			)
		).rejects.toThrow("fair lend admin role required");
		await drainScheduledWork(t);
	});

	it("requires reviewer notes for approve and reject", async () => {
		const { applicationId, t } = await createSubmittedApplication(
			"review-action-note"
		);

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(
				api.onboarding.brokerApplication.mutations.approveForReview,
				{
					applicationId,
					reviewerNote: "   ",
				}
			)
		).rejects.toThrow("Approval note cannot be empty");

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(
				api.onboarding.brokerApplication.mutations.rejectForReview,
				{
					applicationId,
					reviewerNote: "",
				}
			)
		).rejects.toThrow("Rejection note cannot be empty");
		await drainScheduledWork(t);
	});

	it("requires request-changes field scope and persists reverification flags", async () => {
		const { applicationId, t } = await createSubmittedApplication(
			"review-action-request"
		);

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(
				api.onboarding.brokerApplication.mutations.requestChangesForReview,
				{
					applicationId,
					reopenedFields: [],
					reverificationFlags: {
						identityVerification: false,
						regulatorLookup: false,
					},
					reviewerNote: "Please correct the license number.",
				}
			)
		).rejects.toThrow("at least one reopened field");

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(
				api.onboarding.brokerApplication.mutations.requestChangesForReview,
				{
					applicationId,
					reopenedFields: [
						{ fieldPath: "draftData.businessPhone" as never },
					],
					reverificationFlags: {
						identityVerification: false,
						regulatorLookup: false,
					},
					reviewerNote: "Please correct the business phone.",
				}
			)
		).rejects.toThrow();

		await t.withIdentity(FAIRLEND_ADMIN).action(
			api.onboarding.brokerApplication.mutations.requestChangesForReview,
			{
				applicationId,
				reopenedFields: [{ fieldPath: "draftData.licenseNumber" }],
				reverificationFlags: {
					identityVerification: false,
					regulatorLookup: true,
				},
				reviewerNote: "License number needs regulator reverification.",
			}
		);

		const application = await getApplication(t, applicationId);
		const entries = await getReviewEntries(t, applicationId);

		expect(application?.status).toBe("changes_requested");
		expect(application?.reopenedFields[0]).toMatchObject({
			fieldPath: "draftData.licenseNumber",
			status: "open",
		});
		expect(application?.verificationState?.requiresReverification).toBe(true);
		expect(application?.verificationState?.reverificationFieldPaths).toContain(
			"draftData.licenseNumber"
		);
		expect(entries.at(-1)).toMatchObject({
			body: "License number needs regulator reverification.",
			entryType: "reviewer_note",
		});
		await drainScheduledWork(t);
	});

	it("rejects approval for expired submitted applications", async () => {
		const { applicationId, t } = await createSubmittedApplication(
			"review-action-expired-approve"
		);

		await t.run(async (ctx) => {
			await ctx.db.patch(applicationId, {
				expiresAt: Date.now() - 1,
			});
		});

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(
				api.onboarding.brokerApplication.mutations.approveForReview,
				{
					applicationId,
					reviewerNote: "Evidence is stale and should not approve.",
				}
			)
		).rejects.toThrow("Broker onboarding application has expired");

		const application = await getApplication(t, applicationId);
		expect(application?.status).toBe("submitted");
		await drainScheduledWork(t);
	});

	it("approves with reviewer reasoning and exposes downstream handoff state", async () => {
		const { applicationId, t } = await createSubmittedApplication(
			"review-action-approve"
		);

		await t.withIdentity(FAIRLEND_ADMIN).action(
			api.onboarding.brokerApplication.mutations.approveForReview,
			{
				applicationId,
				reviewerNote: "Verified evidence is sufficient to approve.",
			}
		);

		const application = await getApplication(t, applicationId);
		const entries = await getReviewEntries(t, applicationId);

		expect(application?.status).toBe("approved");
		expect(application?.downstreamOnboardingRequestId).toBeDefined();
		expect(application?.downstreamHandoffStatus).toBe("linked");
		expect(
			entries.some(
				(entry) =>
					entry.entryType === "reviewer_note" &&
					entry.body === "Verified evidence is sufficient to approve."
			)
		).toBe(true);
		await drainScheduledWork(t);
	});
});
