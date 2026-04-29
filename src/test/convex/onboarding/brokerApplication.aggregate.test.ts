import { describe, expect, it, vi } from "vitest";
import { api } from "../../../../convex/_generated/api";
import { BROKER_ONBOARDING_RESUME_WINDOW_MS } from "../../../../convex/onboarding/brokerApplication/helpers";
import { createBrokerOnboardingVerificationSnapshot } from "../../../../shared/brokerOnboarding/contracts";
import { DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG } from "../../../../convex/onboarding/verification/config";
import { ensureSeededIdentity } from "../../auth/helpers";
import { createGovernedTestConvex, drainScheduledWork } from "./helpers";
import {
	appendBrokerNote,
	buildVerifiedMemberIdentity,
	countApplicationsForAuthUser,
	createActivePortal,
	getApplication,
	getReviewEntries,
	getUserByAuthId,
	requestBrokerApplicationChanges,
	recomputeBrokerVerification,
	saveBrokerApplicationDraft,
	startBrokerApplication,
	startBrokerIdentityVerification,
	submitBrokerApplication,
	upsertBrokerVerificationSnapshot,
} from "./brokerApplicationTestHelpers";

process.env.DISABLE_GT_HASHCHAIN = "true";
process.env.DISABLE_CASH_LEDGER_HASHCHAIN = "true";

describe("broker onboarding application aggregate", () => {
	it("starts a draft application with portal attribution and verified email lookup", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("aggregate-start");
		expect(await getUserByAuthId(t, identity.subject)).toBeNull();

		await ensureSeededIdentity(t, identity);
		const seededUser = await getUserByAuthId(t, identity.subject);
		expect(seededUser).not.toBeNull();

		const brokerPortalId = await createActivePortal(t, "aggregate-start");
		await t.run(async (ctx) => {
			await ctx.db.patch(seededUser!._id, { homePortalId: brokerPortalId });
		});

		const result = await startBrokerApplication(t, identity);

		expect(result.application.status).toBe("draft");
		expect(result.application.portalId).toBe(brokerPortalId);
		expect(result.application.verifiedEmail).toBe(identity.user_email);
		expect(result.application.downstreamHandoffStatus).toBe("not_started");
		expect(result.application.expiresAt - result.application.startedAt).toBe(
			BROKER_ONBOARDING_RESUME_WINDOW_MS
		);
		expect(result.canResume).toBe(true);
		expect(result.reviewEntries).toEqual([]);
	});

	it("rejects caller-supplied portal attribution that does not match the trusted home portal", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("aggregate-portal-spoof");
		await ensureSeededIdentity(t, identity);
		const seededUser = await getUserByAuthId(t, identity.subject);
		const homePortalId = await createActivePortal(t, "aggregate-home-portal");
		const otherPortalId = await createActivePortal(t, "aggregate-other-portal");
		await t.run(async (ctx) => {
			await ctx.db.patch(seededUser!._id, { homePortalId });
		});

		await expect(
			t.withIdentity(identity).mutation(
				api.onboarding.brokerApplication.mutations.startOrResume,
				{ portalId: otherPortalId }
			)
		).rejects.toThrow("trusted home portal");

		const noHomeIdentity = buildVerifiedMemberIdentity(
			"aggregate-portal-spoof-no-home"
		);
		await ensureSeededIdentity(t, noHomeIdentity);
		await expect(
			t.withIdentity(noHomeIdentity).mutation(
				api.onboarding.brokerApplication.mutations.startOrResume,
				{ portalId: otherPortalId }
			)
		).rejects.toThrow("trusted home portal");

		const result = await startBrokerApplication(t, identity, {
			portalId: homePortalId,
		});

		expect(result.application.portalId).toBe(homePortalId);
	});

	it("resumes the latest unexpired application instead of creating a duplicate", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("aggregate-resume");

		const firstResult = await startBrokerApplication(t, identity);
		const secondResult = await startBrokerApplication(t, identity);
		const applications = await countApplicationsForAuthUser(t, identity.subject);

		expect(secondResult.application._id).toBe(firstResult.application._id);
		expect(applications).toHaveLength(1);
	});

	it("expires stale applications explicitly before creating a new draft", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("aggregate-expiry");
		const firstResult = await startBrokerApplication(t, identity);

		await t.run(async (ctx) => {
			await ctx.db.patch(firstResult.application._id, {
				expiresAt: Date.now() - 1,
				lastActivityAt: Date.now() - BROKER_ONBOARDING_RESUME_WINDOW_MS,
			});
		});

		const secondResult = await startBrokerApplication(t, identity);
		const expiredApplication = await getApplication(t, firstResult.application._id);
		const expiredEntries = await getReviewEntries(t, firstResult.application._id);
		const applications = await countApplicationsForAuthUser(t, identity.subject);

		expect(secondResult.application._id).not.toBe(firstResult.application._id);
		expect(expiredApplication?.expiredAt).toBeTypeOf("number");
		expect(
			expiredEntries.some(
				(entry) => entry.systemEventType === "resume_window_expired"
			)
		).toBe(true);
		expect(applications).toHaveLength(2);
	});

	it("blocks identity verification on expired applications", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("aggregate-idv-expired");
		const startResult = await startBrokerApplication(t, identity);

		await t.run(async (ctx) => {
			const now = Date.now();
			await ctx.db.patch(startResult.application._id, {
				expiresAt: now - 1,
				lastActivityAt: now - BROKER_ONBOARDING_RESUME_WINDOW_MS,
			});
		});

		await expect(
			startBrokerIdentityVerification(t, identity, startResult.application._id)
		).rejects.toThrow("Broker onboarding application has expired");
	});

	it("blocks manual verification recompute on expired applications", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("aggregate-recompute-expired");
		const startResult = await startBrokerApplication(t, identity);

		await t.run(async (ctx) => {
			const now = Date.now();
			await ctx.db.patch(startResult.application._id, {
				expiresAt: now - 1,
				lastActivityAt: now - BROKER_ONBOARDING_RESUME_WINDOW_MS,
			});
		});

		await expect(
			recomputeBrokerVerification(t, identity, startResult.application._id)
		).rejects.toThrow("Broker onboarding application has expired");
	});

	it("expires stale non-terminal candidates even when a newer terminal application exists", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("aggregate-expiry-terminal");
		const firstResult = await startBrokerApplication(t, identity);
		const user = await getUserByAuthId(t, identity.subject);

		await t.run(async (ctx) => {
			const now = Date.now();
			await ctx.db.patch(firstResult.application._id, {
				expiresAt: now - 1,
				lastActivityAt: now - BROKER_ONBOARDING_RESUME_WINDOW_MS,
			});
			await ctx.db.insert("brokerOnboardingApplications", {
				authUserId: identity.subject,
				createdAt: now + 1,
				downstreamHandoffStatus: "not_started",
				draftData: {},
				expiresAt: now + BROKER_ONBOARDING_RESUME_WINDOW_MS,
				lastActivityAt: now + 1,
				lastTransitionAt: now + 1,
				machineContext: firstResult.application.machineContext,
				portalId: firstResult.application.portalId,
				rejectedAt: now + 1,
				reopenedFields: [],
				startedAt: now + 1,
				status: "rejected",
				updatedAt: now + 1,
				userId: user!._id,
				verifiedEmail: identity.user_email,
			});
		});

		const nextResult = await startBrokerApplication(t, identity);
		const expiredApplication = await getApplication(t, firstResult.application._id);
		const expiredEntries = await getReviewEntries(t, firstResult.application._id);
		const applications = await countApplicationsForAuthUser(t, identity.subject);

		expect(nextResult.application._id).not.toBe(firstResult.application._id);
		expect(expiredApplication?.expiredAt).toBeTypeOf("number");
		expect(
			expiredEntries.some(
				(entry) => entry.systemEventType === "resume_window_expired"
			)
		).toBe(true);
		expect(applications).toHaveLength(3);
	});

	it("saves draft state with normalized slug and province and persists broker notes", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("aggregate-draft");
		const startResult = await startBrokerApplication(t, identity);

		await saveBrokerApplicationDraft(t, identity, {
			applicationId: startResult.application._id,
			currentStep: "license-details",
			draftData: {
				brokerageName: "North Star Brokerage",
				licenseProvince: "on",
				requestedPortalSlug: "  North Star / Portal  ",
			},
		});
		await appendBrokerNote(t, identity, {
			applicationId: startResult.application._id,
			body: "Need to confirm my regulator number before submitting.",
		});

		const application = await getApplication(t, startResult.application._id);
		const entries = await getReviewEntries(t, startResult.application._id);

		expect(application?.draftData.brokerageName).toBe("North Star Brokerage");
		expect(application?.draftData.licenseProvince).toBe("ON");
		expect(application?.draftData.requestedPortalSlug).toBe(
			"north-star-portal"
		);
		expect(application?.machineContext.currentStep).toBe("license-details");
		expect(application?.machineContext.draftLastSavedAt).toBeTypeOf("number");
		expect(entries.at(-1)?.entryType).toBe("broker_note");
	});

	it("submits and resubmits after changes requested, resolving reopened fields", async () => {
		vi.useFakeTimers();
		const t = createGovernedTestConvex();
		try {
			const identity = buildVerifiedMemberIdentity("aggregate-submit");
			const startResult = await startBrokerApplication(t, identity);

			await submitBrokerApplication(t, identity, startResult.application._id);
			await drainScheduledWork(t);
			await requestBrokerApplicationChanges(t, {
				applicationId: startResult.application._id,
				body: "Please correct the requested broker portal slug.",
				reopenedFields: [{ fieldPath: "draftData.requestedPortalSlug" }],
			});
			const resubmitted = await submitBrokerApplication(
				t,
				identity,
				startResult.application._id
			);
			await drainScheduledWork(t);
			const entries = await getReviewEntries(t, startResult.application._id);

			expect(resubmitted.application.status).toBe("submitted");
			expect(resubmitted.application.reopenedFields[0]?.status).toBe(
				"resolved"
			);
			expect(
				entries.some(
					(entry) => entry.systemEventType === "application_submitted"
				)
			).toBe(true);
		} finally {
			vi.clearAllTimers();
			vi.useRealTimers();
		}
	});

	it("stores normalized verification snapshot metadata through the internal helper", async () => {
		const t = createGovernedTestConvex();
		const identity = buildVerifiedMemberIdentity("aggregate-verification");
		const startResult = await startBrokerApplication(t, identity);

		const snapshot = createBrokerOnboardingVerificationSnapshot({
			capturedAt: 1_700_000_000_000,
			policy: DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG,
			province: "on",
			selfReportedName: {
				fullName: "Francois Smith",
			},
			regulator: {
				provider: "mock_regulator",
				status: "active",
				freshness: "fresh",
				brokerageAssociation: {
					matched: true,
					requestedBrokerageName: "FairLend Brokerage",
					requestedBrokerageNumber: "BR-001",
				},
				brokerageName: "FairLend Brokerage",
				brokerageNumber: "BR-001",
				licenseNumber: "ON-12345",
				licenseProvince: "ON",
				legalName: {
					fullName: "Francois Smith",
				},
				licenseType: "broker",
				checkedAt: 1_700_000_000_000,
				dataAsOf: 1_700_000_000_000,
				evidenceReferences: [],
				sourceSnapshot: {
					brokerage_number: "BR-001",
					license_number: "ON-12345",
					optional_field: null,
				},
			},
			identityVerification: {
				provider: "mock_identity",
				status: "verified",
				legalName: {
					fullName: "Francois Smith",
				},
				checkedAt: 1_700_000_000_000,
				completedAt: 1_700_000_000_000,
				fraudSignal: false,
				evidenceReferences: [],
			},
			emailVerification: {
				provider: "workos_authkit",
				status: "verified",
				email: identity.user_email,
				checkedAt: 1_700_000_000_000,
				verifiedAt: 1_700_000_000_000,
				evidenceReferences: [],
			},
			similarityScores: {
				selfReportedVsRegulator: 0.95,
				selfReportedVsIdentity: 0.96,
				regulatorVsIdentity: 0.97,
			},
		});

		await upsertBrokerVerificationSnapshot(t, {
			applicationId: startResult.application._id,
			authorAuthId: "system_test",
			authorType: "system",
			snapshot,
		});

		const application = await getApplication(t, startResult.application._id);
		const entries = await getReviewEntries(t, startResult.application._id);

		expect(application?.verificationSnapshot?.recommendation).toBe(
			"auto_approve_candidate"
		);
		expect(application?.verificationRecommendation).toBe(
			"auto_approve_candidate"
		);
		expect(application?.verificationReasonCodes).toEqual([]);
		expect(
			application?.verificationSnapshot?.regulator.brokerageAssociation
		).toEqual({
			matched: true,
			requestedBrokerageName: "FairLend Brokerage",
			requestedBrokerageNumber: "BR-001",
		});
		expect(application?.verificationSnapshot?.regulator.licenseType).toBe(
			"broker"
		);
		expect(application?.verificationSnapshot?.regulator.sourceSnapshot).toEqual(
			{
				brokerage_number: "BR-001",
				license_number: "ON-12345",
				optional_field: null,
			}
		);
		expect(
			entries.some(
				(entry) => entry.systemEventType === "verification_snapshot_updated"
			)
		).toBe(true);
	});

	it("invalidates prior verification evidence when reviewer-reopened identity and license fields require reverification", async () => {
		vi.useFakeTimers();
		const t = createGovernedTestConvex();
		try {
			const identity = buildVerifiedMemberIdentity("aggregate-reverification");
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

			const approvedSnapshot = createBrokerOnboardingVerificationSnapshot({
				capturedAt: 1_700_000_000_000,
				policy: DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG,
				province: "on",
				selfReportedName: {
					fullName: "Francois Smith",
				},
				regulator: {
					provider: "mock_regulator",
					status: "active",
					freshness: "fresh",
					licenseNumber: "ON-12345",
					licenseProvince: "ON",
					legalName: {
						fullName: "Francois Smith",
					},
					checkedAt: 1_700_000_000_000,
					dataAsOf: 1_700_000_000_000,
					evidenceReferences: [],
				},
				identityVerification: {
					provider: "mock_identity",
					status: "verified",
					legalName: {
						fullName: "Francois Smith",
					},
					checkedAt: 1_700_000_000_000,
					completedAt: 1_700_000_000_000,
					fraudSignal: false,
					evidenceReferences: [],
				},
				emailVerification: {
					provider: "workos_authkit",
					status: "verified",
					email: identity.user_email,
					checkedAt: 1_700_000_000_000,
					verifiedAt: 1_700_000_000_000,
					evidenceReferences: [],
				},
				similarityScores: {
					selfReportedVsRegulator: 0.95,
					selfReportedVsIdentity: 0.96,
					regulatorVsIdentity: 0.97,
				},
			});
			await upsertBrokerVerificationSnapshot(t, {
				applicationId: startResult.application._id,
				authorAuthId: "system_test",
				authorType: "system",
				snapshot: approvedSnapshot,
				verificationState: {
					currentIdvLaunchUrl:
						"https://mock-idv.local/session/mock-idv:verified:application",
					currentIdvProviderKey: "mock_identity",
					currentIdvSessionId: "mock-idv:verified:application",
					idvCompletedAt: 1_700_000_000_000,
					idvStartedAt: 1_700_000_000_000,
					lastCallbackEventId: null,
					lastCallbackProcessedAt: null,
					lastCallbackReceivedAt: null,
					lastCallbackSignatureVerified: null,
					lastRecomputedAt: 1_700_000_000_000,
					requiresReverification: false,
					reverificationFieldPaths: [],
					reverificationRequiredAt: null,
				},
			});

			await requestBrokerApplicationChanges(t, {
				applicationId: startResult.application._id,
				body: "Please resubmit after correcting the legal name and license data.",
				reopenedFields: [
					{ fieldPath: "draftData.selfReportedName.fullName" },
					{ fieldPath: "draftData.licenseNumber" },
				],
			});

			const application = await getApplication(t, startResult.application._id);

			expect(application?.status).toBe("changes_requested");
			expect(application?.verificationState?.requiresReverification).toBe(
				true
			);
			expect(application?.verificationState?.reverificationFieldPaths).toEqual(
				[
					"draftData.selfReportedName.fullName",
					"draftData.licenseNumber",
				]
			);
			expect(application?.verificationState?.currentIdvSessionId).toBeNull();
			expect(
				application?.verificationSnapshot?.identityVerification.status
			).toBe("not_started");
			expect(application?.verificationSnapshot?.regulator.status).toBe(
				"incomplete"
			);
			expect(application?.verificationRecommendation).toBe("review_needed");
			expect(application?.verificationReasonCodes).toContain(
				"verification_sources_incomplete"
			);
		} finally {
			vi.clearAllTimers();
			vi.useRealTimers();
		}
	});
});
