import process from "node:process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../../../../convex/_generated/api";
import { createDefaultBrokerOnboardingVerificationState } from "../../../../convex/onboarding/brokerApplication/helpers";
import { buildDefaultFsraSourceRecords } from "../../../../convex/onboarding/verification/fsraFixtures";
import {
	buildMockIdentityWebhookSignature,
} from "../../../../convex/onboarding/verification/callbackVerification";
import {
	BROKER_ONBOARDING_IDV_WEBHOOK_PATH,
	MOCK_IDENTITY_SIGNATURE_HEADER,
} from "../../../../convex/onboarding/verification/idvWebhook";
import { createMockIdentity } from "../../auth/helpers";
import { createGovernedTestConvex, drainScheduledWork } from "./helpers";
import {
	buildVerifiedMemberIdentity,
	getApplication,
	recomputeBrokerVerification,
	saveBrokerApplicationDraft,
	startBrokerApplication,
	startBrokerIdentityVerification,
	submitBrokerApplication,
} from "./brokerApplicationTestHelpers";

const TEST_WEBHOOK_SECRET = "eng-319-mock-webhook-secret";

process.env.DISABLE_GT_HASHCHAIN = "true";
process.env.DISABLE_CASH_LEDGER_HASHCHAIN = "true";

beforeEach(() => {
	vi.useFakeTimers();
	process.env.BROKER_ONBOARDING_MOCK_IDV_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
});

afterEach(() => {
	delete process.env.BROKER_ONBOARDING_MOCK_IDV_WEBHOOK_SECRET;
	vi.clearAllTimers();
	vi.useRealTimers();
});

async function seedImportedFsraFixtures(t: ReturnType<typeof createGovernedTestConvex>) {
	await t.action(internal.onboarding.verification.fsraImport.runFsraImportRefresh, {
		records: buildDefaultFsraSourceRecords(Date.now()),
		trigger: "manual",
	});
}

describe("broker onboarding identity callback pipeline", () => {
	it("auto-approves a matching signed callback and stays idempotent on duplicate delivery", async () => {
		const t = createGovernedTestConvex();
		await seedImportedFsraFixtures(t);
		const identity = buildVerifiedMemberIdentity("idv-callback-autoapprove");
		const startResult = await startBrokerApplication(t, identity);

		await saveBrokerApplicationDraft(t, identity, {
			applicationId: startResult.application._id,
			draftData: {
				brokerageName: "FairLend Brokerage",
				brokerageNumber: "BR-001",
				licenseNumber: "ON-12345",
				licenseProvince: "ON",
				selfReportedName: {
					fullName: "Francois Smith",
				},
			},
		});
		await submitBrokerApplication(t, identity, startResult.application._id);

		const idvStart = await startBrokerIdentityVerification(
			t,
			identity,
			startResult.application._id
		);
		expect(idvStart.ok).toBe(true);
		if (!idvStart.ok) {
			throw new Error("Expected identity verification to start");
		}

		const body = JSON.stringify({
			applicationId: String(startResult.application._id),
			eventId: "evt_idv_callback_autoapprove_001",
			sessionId: idvStart.session.sessionId,
		});
		const signature = await buildMockIdentityWebhookSignature(
			body,
			TEST_WEBHOOK_SECRET
		);

		const firstResponse = await t.fetch(BROKER_ONBOARDING_IDV_WEBHOOK_PATH, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				[MOCK_IDENTITY_SIGNATURE_HEADER]: signature,
			},
			body,
		});
		const secondResponse = await t.fetch(BROKER_ONBOARDING_IDV_WEBHOOK_PATH, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				[MOCK_IDENTITY_SIGNATURE_HEADER]: signature,
			},
			body,
		});

		expect(firstResponse.status).toBe(200);
		expect(secondResponse.status).toBe(200);

		await t.finishAllScheduledFunctions(() => vi.runAllTimers());

		const application = await getApplication(t, startResult.application._id);
		const callbackEvent = await t.run(async (ctx) =>
			ctx.db
				.query("brokerOnboardingVerificationCallbackEvents")
				.withIndex("by_provider_event", (query) =>
					query
						.eq("provider", "mock_identity")
						.eq("providerEventId", "evt_idv_callback_autoapprove_001")
				)
				.unique()
		);

		expect(application?.status).toBe("approved");
		expect(application?.verificationSnapshot?.recommendation).toBe(
			"auto_approve_candidate"
		);
		expect(
			application?.verificationState?.lastCallbackSignatureVerified
		).toBe(true);
		expect(callbackEvent).not.toBeNull();
		expect(callbackEvent?.status).toBe("processed");
		expect(callbackEvent?.attempts).toBe(1);
		expect(callbackEvent?.signatureVerified).toBe(true);
		await drainScheduledWork(t);
	});

	it("fails closed when the webhook secret is not configured", async () => {
		const t = createGovernedTestConvex();
		delete process.env.BROKER_ONBOARDING_MOCK_IDV_WEBHOOK_SECRET;

		const body = JSON.stringify({
			applicationId: "untrusted-application",
			eventId: "evt_idv_callback_missing_secret_001",
			sessionId: "mock-idv:verified:untrusted-application",
		});
		const response = await t.fetch(BROKER_ONBOARDING_IDV_WEBHOOK_PATH, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				[MOCK_IDENTITY_SIGNATURE_HEADER]: "irrelevant",
			},
			body,
		});

		expect(response.status).toBe(500);
		await drainScheduledWork(t);
	});

	it("fails closed when a signed callback does not match the active IDV session", async () => {
		const t = createGovernedTestConvex();
		await seedImportedFsraFixtures(t);
		const identity = buildVerifiedMemberIdentity("idv-callback-session-mismatch");
		const startResult = await startBrokerApplication(t, identity);

		await saveBrokerApplicationDraft(t, identity, {
			applicationId: startResult.application._id,
			draftData: {
				brokerageName: "FairLend Brokerage",
				brokerageNumber: "BR-001",
				licenseNumber: "ON-STALE-1",
				licenseProvince: "ON",
				selfReportedName: {
					fullName: "Stale Broker",
				},
			},
		});
		await submitBrokerApplication(t, identity, startResult.application._id);
		const idvStart = await startBrokerIdentityVerification(
			t,
			identity,
			startResult.application._id
		);
		expect(idvStart.ok).toBe(true);
		if (!idvStart.ok) {
			throw new Error("Expected identity verification to start");
		}

		const mismatchedSessionId = "mock-idv:verified:other-application";
		const body = JSON.stringify({
			applicationId: String(startResult.application._id),
			eventId: "evt_idv_callback_session_mismatch_001",
			sessionId: mismatchedSessionId,
		});
		const signature = await buildMockIdentityWebhookSignature(
			body,
			TEST_WEBHOOK_SECRET
		);

		const response = await t.fetch(BROKER_ONBOARDING_IDV_WEBHOOK_PATH, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				[MOCK_IDENTITY_SIGNATURE_HEADER]: signature,
			},
			body,
		});

		expect(response.status).toBe(200);
		await t.finishAllScheduledFunctions(() => vi.runAllTimers());

		const application = await getApplication(t, startResult.application._id);
		const callbackEvent = await t.run(async (ctx) =>
			ctx.db
				.query("brokerOnboardingVerificationCallbackEvents")
				.withIndex("by_provider_event", (query) =>
					query
						.eq("provider", "mock_identity")
						.eq("providerEventId", "evt_idv_callback_session_mismatch_001")
				)
				.unique()
		);

		expect(application?.status).toBe("submitted");
		expect(application?.verificationState?.currentIdvSessionId).toBe(
			idvStart.session.sessionId
		);
		expect(callbackEvent?.status).toBe("failed");
		expect(callbackEvent?.errorMessage).toBe("identity_session_mismatch");
		expect(callbackEvent?.identityVerificationSessionId).toBe(
			mismatchedSessionId
		);
		await drainScheduledWork(t);
	});

	it("accepts a callback for a current IDV session started after email verification", async () => {
		const t = createGovernedTestConvex();
		await seedImportedFsraFixtures(t);
		const unverifiedIdentity = createMockIdentity({
			subject: "user_broker_application_idv_callback_late_email",
			user_email: "idv-callback-late-email@fairlend.test",
			user_email_verified: "false",
		});
		const verifiedIdentity = {
			...unverifiedIdentity,
			user_email_verified: "true",
		};
		const startResult = await startBrokerApplication(t, unverifiedIdentity);

		await saveBrokerApplicationDraft(t, unverifiedIdentity, {
			applicationId: startResult.application._id,
			draftData: {
				brokerageName: "FairLend Brokerage",
				brokerageNumber: "BR-001",
				licenseNumber: "ON-12345",
				licenseProvince: "ON",
				selfReportedName: {
					fullName: "Francois Smith",
				},
			},
		});
		await submitBrokerApplication(
			t,
			unverifiedIdentity,
			startResult.application._id
		);
		expect(
			(await getApplication(t, startResult.application._id))?.verifiedEmail
		).toBeUndefined();

		const idvStart = await startBrokerIdentityVerification(
			t,
			verifiedIdentity,
			startResult.application._id
		);
		expect(idvStart.ok).toBe(true);
		if (!idvStart.ok) {
			throw new Error("Expected identity verification to start");
		}
		expect(
			(await getApplication(t, startResult.application._id))?.verifiedEmail
		).toBeUndefined();

		const body = JSON.stringify({
			applicationId: String(startResult.application._id),
			eventId: "evt_idv_callback_late_email_001",
			sessionId: idvStart.session.sessionId,
		});
		const signature = await buildMockIdentityWebhookSignature(
			body,
			TEST_WEBHOOK_SECRET
		);

		const response = await t.fetch(BROKER_ONBOARDING_IDV_WEBHOOK_PATH, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				[MOCK_IDENTITY_SIGNATURE_HEADER]: signature,
			},
			body,
		});

		expect(response.status).toBe(200);
		await t.finishAllScheduledFunctions(() => vi.runAllTimers());

		const application = await getApplication(t, startResult.application._id);
		const callbackEvent = await t.run(async (ctx) =>
			ctx.db
				.query("brokerOnboardingVerificationCallbackEvents")
				.withIndex("by_provider_event", (query) =>
					query
						.eq("provider", "mock_identity")
						.eq("providerEventId", "evt_idv_callback_late_email_001")
				)
				.unique()
		);

		expect(application?.status).toBe("approved");
		expect(application?.verificationSnapshot?.emailVerification.status).toBe(
			"verified"
		);
		expect(application?.verificationSnapshot?.emailVerification.email).toBeNull();
		expect(callbackEvent?.status).toBe("processed");
		expect(callbackEvent?.errorMessage).toBeUndefined();
		await drainScheduledWork(t);
	});

	it("rate limits repeated IDV start attempts on the same application", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("idv-rate-limit-start");
		const startResult = await startBrokerApplication(t, identity);

		for (let attempt = 0; attempt < 3; attempt += 1) {
			const result = await startBrokerIdentityVerification(
				t,
				identity,
				startResult.application._id
			);
			expect(result.ok).toBe(true);
			await t.run(async (ctx) => {
				await ctx.db.patch(startResult.application._id, {
					verificationState: createDefaultBrokerOnboardingVerificationState(),
				});
			});
		}

		const blocked = await startBrokerIdentityVerification(
			t,
			identity,
			startResult.application._id
		);

		expect(blocked.ok).toBe(false);
		if (blocked.ok) {
			throw new Error("Expected the fourth IDV start attempt to be rate limited");
		}
		expect(blocked.error).toBe("rate_limited");
		expect(blocked.retryAfter).toBeGreaterThan(0);
		await drainScheduledWork(t);
	});

	it("fails closed and persists callback metadata when the signature is invalid", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("idv-callback-invalid-signature");
		const startResult = await startBrokerApplication(t, identity);

		const body = JSON.stringify({
			applicationId: String(startResult.application._id),
			eventId: "evt_idv_callback_invalid_001",
			sessionId: "mock-idv:verified:invalid-signature",
		});

		const response = await t.fetch(BROKER_ONBOARDING_IDV_WEBHOOK_PATH, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				[MOCK_IDENTITY_SIGNATURE_HEADER]: "bad-signature",
			},
			body,
		});

		const callbackEvent = await t.run(async (ctx) =>
			ctx.db
				.query("brokerOnboardingVerificationCallbackEvents")
				.withIndex("by_provider_event", (query) =>
					query
						.eq("provider", "mock_identity")
						.eq("providerEventId", "evt_idv_callback_invalid_001")
				)
				.unique()
		);

		expect(response.status).toBe(401);
		expect(callbackEvent).not.toBeNull();
		expect(callbackEvent?.signatureVerified).toBe(false);
		expect(callbackEvent?.status).toBe("failed");
		expect(callbackEvent?.attempts).toBe(1);
		expect(callbackEvent?.errorMessage).toBe("invalid_signature");
		expect(callbackEvent?.applicationId).toBeUndefined();
		expect(callbackEvent?.identityVerificationSessionId).toBeUndefined();
		await drainScheduledWork(t);
	});

	it("does not let an invalid signature poison a later valid provider retry", async () => {
		const t = createGovernedTestConvex();
		await seedImportedFsraFixtures(t);
		const identity = buildVerifiedMemberIdentity("idv-callback-valid-retry");
		const startResult = await startBrokerApplication(t, identity);

		await saveBrokerApplicationDraft(t, identity, {
			applicationId: startResult.application._id,
			draftData: {
				brokerageName: "FairLend Brokerage",
				brokerageNumber: "BR-001",
				licenseNumber: "ON-12345",
				licenseProvince: "ON",
				selfReportedName: {
					fullName: "Francois Smith",
				},
			},
		});
		await submitBrokerApplication(t, identity, startResult.application._id);

		const idvStart = await startBrokerIdentityVerification(
			t,
			identity,
			startResult.application._id
		);
		expect(idvStart.ok).toBe(true);
		if (!idvStart.ok) {
			throw new Error("Expected identity verification to start");
		}

		const body = JSON.stringify({
			applicationId: String(startResult.application._id),
			eventId: "evt_idv_callback_retry_001",
			sessionId: idvStart.session.sessionId,
		});
		const signature = await buildMockIdentityWebhookSignature(
			body,
			TEST_WEBHOOK_SECRET
		);

		const invalidResponse = await t.fetch(BROKER_ONBOARDING_IDV_WEBHOOK_PATH, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				[MOCK_IDENTITY_SIGNATURE_HEADER]: "bad-signature",
			},
			body,
		});
		expect(invalidResponse.status).toBe(401);

		const validRetryResponse = await t.fetch(BROKER_ONBOARDING_IDV_WEBHOOK_PATH, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				[MOCK_IDENTITY_SIGNATURE_HEADER]: signature,
			},
			body,
		});
		expect(validRetryResponse.status).toBe(200);

		await t.finishAllScheduledFunctions(() => vi.runAllTimers());

		const application = await getApplication(t, startResult.application._id);
		const callbackEvent = await t.run(async (ctx) =>
			ctx.db
				.query("brokerOnboardingVerificationCallbackEvents")
				.withIndex("by_provider_event", (query) =>
					query
						.eq("provider", "mock_identity")
						.eq("providerEventId", "evt_idv_callback_retry_001")
				)
				.unique()
		);

		expect(application?.status).toBe("approved");
		expect(callbackEvent?.status).toBe("processed");
		expect(callbackEvent?.signatureVerified).toBe(true);
		expect(callbackEvent?.attempts).toBe(2);
		expect(callbackEvent?.applicationId).toBe(startResult.application._id);
		expect(callbackEvent?.identityVerificationSessionId).toBe(
			idvStart.session.sessionId
		);
		await drainScheduledWork(t);
	});

	it("runs submit-triggered recompute even when manual recompute is rate limited", async () => {
		const t = createGovernedTestConvex();
		await seedImportedFsraFixtures(t);
		const identity = buildVerifiedMemberIdentity("idv-submit-recompute-limit");
		const startResult = await startBrokerApplication(t, identity);

		await saveBrokerApplicationDraft(t, identity, {
			applicationId: startResult.application._id,
			draftData: {
				brokerageName: "FairLend Brokerage",
				brokerageNumber: "BR-001",
				licenseNumber: "ON-12345",
				licenseProvince: "ON",
				selfReportedName: {
					fullName: "Francois Smith",
				},
			},
		});

		for (let attempt = 0; attempt < 6; attempt += 1) {
			const result = await recomputeBrokerVerification(
				t,
				identity,
				startResult.application._id
			);
			expect(result.ok).toBe(true);
		}
		const rateLimited = await recomputeBrokerVerification(
			t,
			identity,
			startResult.application._id
		);
		expect(rateLimited.ok).toBe(false);

		await submitBrokerApplication(t, identity, startResult.application._id);
		await t.finishAllScheduledFunctions(() => vi.runAllTimers());

		const application = await getApplication(t, startResult.application._id);
		expect(application?.verificationSnapshot).toBeDefined();
		expect(application?.verificationSnapshot?.regulator.provider).toBe(
			"imported_fsra"
		);
		expect(application?.verificationState?.lastRecomputedAt).not.toBeNull();
		await drainScheduledWork(t);
	});
});
