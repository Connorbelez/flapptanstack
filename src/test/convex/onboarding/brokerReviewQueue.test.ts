import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../../convex/_generated/api";
import { FAIRLEND_ADMIN } from "../../auth/identities";
import { createGovernedTestConvex, drainScheduledWork } from "./helpers";
import {
	appendBrokerNote,
	buildVerifiedMemberIdentity,
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

describe("broker onboarding review queue", () => {
	it("lists submitted applications with normalized triage fields", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("review-queue-submitted");
		const startResult = await startBrokerApplication(t, identity);
		await prepareActivationReadyBrokerApplication(t, identity, {
			applicationId: startResult.application._id,
			brokerageName: "North Star Review Brokerage",
			licenseNumber: "ON-REVIEW-QUEUE",
			portalSlug: "review-queue",
		});
		await submitBrokerApplication(t, identity, startResult.application._id);
		await appendBrokerNote(t, identity, {
			applicationId: startResult.application._id,
			body: "I can provide extra context if needed.",
		});

		const queue = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(api.onboarding.brokerApplication.queries.listReviewQueue, {
				view: "submitted",
			});

		const queueItem = queue.find(
			(item) => item.applicationId === startResult.application._id
		);
		expect(queueItem).toMatchObject({
			draftSummary: {
				brokerageName: "North Star Review Brokerage",
				licenseNumber: "ON-REVIEW-QUEUE",
			},
			freshness: "fresh",
			identityVerificationStatus: "verified",
			regulatorStatus: "active",
			status: "submitted",
			verifiedEmail: identity.user_email,
			verificationRecommendation: "auto_approve_candidate",
		});
		expect(queueItem?.latestReviewEntry?.entryType).toBe("broker_note");
		await drainScheduledWork(t);
	});

	it("returns a dossier with normalized evidence, thread, audit history, and handoff visibility", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("review-dossier");
		const startResult = await startBrokerApplication(t, identity);
		await prepareActivationReadyBrokerApplication(t, identity, {
			applicationId: startResult.application._id,
			licenseNumber: "ON-REVIEW-DOSSIER",
			portalSlug: "review-dossier",
		});
		await submitBrokerApplication(t, identity, startResult.application._id);
		await appendBrokerNote(t, identity, {
			applicationId: startResult.application._id,
			body: "Broker-visible note for reviewer context.",
		});

		const dossier = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(api.onboarding.brokerApplication.queries.getReviewDossier, {
				applicationId: startResult.application._id,
			});

		expect(dossier?.application.verificationSnapshot?.regulator.status).toBe(
			"active"
		);
		expect(dossier?.application.verificationSnapshot?.identityVerification.status).toBe(
			"verified"
		);
		expect(dossier?.downstreamOnboardingRequest).toBeNull();
		expect(dossier?.application.downstreamHandoffStatus).toBe("not_started");
		expect(
			dossier?.reviewEntries.some((entry) => entry.entryType === "broker_note")
		).toBe(true);
		expect(
			dossier?.auditHistory.some((entry) => entry.eventType === "SUBMIT")
		).toBe(true);
		await drainScheduledWork(t);
	});
});
