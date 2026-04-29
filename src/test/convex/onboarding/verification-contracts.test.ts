import { describe, expect, it } from "vitest";
import {
	createBrokerOnboardingVerificationSnapshot,
	evaluateBrokerOnboardingRecommendation,
} from "../../../../shared/brokerOnboarding/contracts";
import {
	DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG,
	resolveBrokerOnboardingVerificationConfig,
} from "../../../../convex/onboarding/verification/config";
import { createBrokerOnboardingVerificationRegistry } from "../../../../convex/onboarding/verification/registry";

describe("broker onboarding verification contracts", () => {
	it("builds a normalized snapshot and computes an auto-approve candidate", () => {
		const snapshot = createBrokerOnboardingVerificationSnapshot({
			capturedAt: 1_700_000_000_000,
			policy: DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG,
			province: "on",
			selfReportedName: {
				fullName: "François A. Smith Jr.",
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
				evidenceReferences: [
					{
						provider: "mock_regulator",
						referenceId: "reg-1",
						referenceType: "regulator_record",
					},
				],
			},
			identityVerification: {
				provider: "mock_identity",
				status: "verified",
				legalName: {
					fullName: "Francois A Smith",
				},
				checkedAt: 1_700_000_000_000,
				completedAt: 1_700_000_000_000,
				fraudSignal: false,
				evidenceReferences: [
					{
						provider: "mock_identity",
						referenceId: "idv-1",
						referenceType: "identity_verification_review",
					},
				],
			},
			emailVerification: {
				provider: "workos_authkit",
				status: "verified",
				email: "broker@example.com",
				checkedAt: 1_700_000_000_000,
				verifiedAt: 1_700_000_000_000,
				evidenceReferences: [
					{
						provider: "workos_authkit",
						referenceId: "email-1",
						referenceType: "email_verification_event",
					},
				],
			},
			similarityScores: {
				selfReportedVsRegulator: 0.95,
				selfReportedVsIdentity: 0.96,
				regulatorVsIdentity: 0.94,
			},
		});

		expect(snapshot.province).toBe("ON");
		expect(snapshot.selfReportedName.fullName).toBe("francois a smith");
		expect(snapshot.similarityScores.effectiveScore).toBe(0.94);
		expect(snapshot.regulator.brokerageName).toBeNull();
		expect(snapshot.regulator.brokerageNumber).toBeNull();
		expect(snapshot.regulator.licenseType).toBeNull();
		expect(snapshot.recommendation).toBe("auto_approve_candidate");
		expect(snapshot.reasonCodes).toEqual([]);
		expect(snapshot.evidenceReferences).toHaveLength(3);
	});

	it("fails closed for unsupported provinces and stale regulator data", () => {
		const unsupportedProvince = evaluateBrokerOnboardingRecommendation({
			configAvailable: true,
			policy: DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG,
			province: "BC",
			emailVerificationStatus: "verified",
			regulatorStatus: "active",
			regulatorFreshness: "fresh",
			identityVerificationStatus: "verified",
			fraudSignal: false,
			effectiveScore: 0.98,
		});

		expect(unsupportedProvince).toEqual({
			recommendation: "unsupported_province",
			reasonCodes: ["unsupported_province"],
		});

		const staleRegulatorData = evaluateBrokerOnboardingRecommendation({
			configAvailable: true,
			policy: DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG,
			province: "ON",
			emailVerificationStatus: "verified",
			regulatorStatus: "active",
			regulatorFreshness: "stale",
			identityVerificationStatus: "verified",
			fraudSignal: false,
			effectiveScore: 0.98,
		});

		expect(staleRegulatorData).toEqual({
			recommendation: "stale_regulator_data",
			reasonCodes: ["stale_regulator_data"],
		});
	});

	it("fails closed for missing config and unavailable providers", () => {
		const missingConfig = evaluateBrokerOnboardingRecommendation({
			configAvailable: false,
			policy: DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG,
			province: "ON",
			emailVerificationStatus: "verified",
			regulatorStatus: "active",
			regulatorFreshness: "fresh",
			identityVerificationStatus: "verified",
			fraudSignal: false,
			effectiveScore: 0.98,
		});

		expect(missingConfig).toEqual({
			recommendation: "provider_unavailable",
			reasonCodes: ["missing_config"],
		});

		const unavailableProvider = evaluateBrokerOnboardingRecommendation({
			configAvailable: true,
			policy: DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG,
			province: "ON",
			emailVerificationStatus: "provider_unavailable",
			regulatorStatus: "active",
			regulatorFreshness: "fresh",
			identityVerificationStatus: "verified",
			fraudSignal: false,
			effectiveScore: 0.98,
		});

		expect(unavailableProvider).toEqual({
			recommendation: "provider_unavailable",
			reasonCodes: ["provider_unavailable"],
		});
	});

	it("resolves deterministic default providers through the registry", async () => {
		const registry = createBrokerOnboardingVerificationRegistry();

		expect(registry.config.providers).toEqual({
			regulatorDirectory: "mock",
			identityVerification: "mock",
			emailVerification: "workos",
		});

		const regulatorResult = await registry.regulatorDirectory.lookupLicense({
			licenseNumber: "ON-12345",
			province: "ON",
			requestedAt: 1_700_000_000_000,
			selfReportedName: { fullName: "Francois Smith" },
		});

		expect(regulatorResult.status).toBe("active");

		const session = await registry.identityVerification.startVerification({
			applicationId: "application-1",
			email: "verified@example.com",
			applicantName: { fullName: "Francois Smith" },
			province: "ON",
			requestedAt: 1_700_000_000_000,
		});

		expect(session.status).toBe("started");

		const review = await registry.identityVerification.getReview({
			applicationId: "application-1",
			sessionId: session.sessionId,
			applicantName: { fullName: "Francois Smith" },
			reviewedAt: 1_700_000_000_000,
		});

		expect(review.status).toBe("verified");

		const importedProvider =
			registry.resolveRegulatorDirectoryProvider("imported_fsra");
		const importedResult = await importedProvider.lookupLicense({
			licenseNumber: "ON-12345",
			province: "ON",
			requestedAt: 1_700_000_000_000,
			selfReportedName: { fullName: "Francois Smith" },
		});

		expect(importedResult.status).toBe("provider_unavailable");
	});

	it("supports config overrides without changing business-layer call sites", () => {
		const overriddenConfig = resolveBrokerOnboardingVerificationConfig({
			enabledProvinces: ["ON", "QC"],
			thresholds: { autoApproveMinimum: 0.95 },
			providers: { regulatorDirectory: "imported_fsra" },
		});

		expect(overriddenConfig.enabledProvinces).toEqual(["ON", "QC"]);
		expect(overriddenConfig.thresholds.autoApproveMinimum).toBe(0.95);
		expect(overriddenConfig.providers.regulatorDirectory).toBe(
			"imported_fsra"
		);
	});

	it("freezes the default config and nested defaults", () => {
		expect(
			Object.isFrozen(DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG)
		).toBe(true);
		expect(
			Object.isFrozen(DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG.thresholds)
		).toBe(true);
		expect(
			Object.isFrozen(DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG.providers)
		).toBe(true);
		expect(
			Object.isFrozen(
				DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG.failurePolicy
			)
		).toBe(true);
		expect(
			Object.isFrozen(
				DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG.enabledProvinces
			)
		).toBe(true);
	});

	it("preserves evidence for unavailable fallback providers", async () => {
		const registry = createBrokerOnboardingVerificationRegistry({
			configOverrides: {
				providers: {
					regulatorDirectory: "live",
					identityVerification: "sandbox",
				},
			},
		});

		const regulatorResult = await registry.regulatorDirectory.lookupLicense({
			licenseNumber: "ON-12345",
			province: "ON",
			requestedAt: 1_700_000_000_000,
			selfReportedName: { fullName: "Francois Smith" },
		});

		expect(regulatorResult.status).toBe("provider_unavailable");
		expect(regulatorResult.evidenceReferences).toEqual([
			expect.objectContaining({
				provider: "live_regulator",
				referenceType: "provider_snapshot",
			}),
		]);

		const session = await registry.identityVerification.startVerification({
			applicationId: "application-1",
			email: "verified@example.com",
			applicantName: { fullName: "Francois Smith" },
			province: "ON",
			requestedAt: 1_700_000_000_000,
		});
		const callbackResult = await registry.identityVerification.handleCallback({
			applicationId: "application-1",
			payload: {},
			receivedAt: 1_700_000_000_000,
			sessionId: session.sessionId,
		});

		expect(session.status).toBe("provider_unavailable");
		expect(callbackResult.status).toBe("provider_unavailable");
		expect(callbackResult.evidenceReferences).toEqual([
			expect.objectContaining({
				provider: "sandbox_identity",
				referenceType: "provider_snapshot",
			}),
		]);
	});

	it("maps malformed callbacks into explicit fail-closed outcomes", async () => {
		const registry = createBrokerOnboardingVerificationRegistry();
		const callbackResult = await registry.identityVerification.handleCallback({
			applicationId: "application-1",
			payload: { malformed: true },
			receivedAt: 1_700_000_000_000,
		});

		expect(callbackResult.status).toBe("callback_invalid");

		const malformedCallback = evaluateBrokerOnboardingRecommendation({
			configAvailable: true,
			policy: DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG,
			province: "ON",
			emailVerificationStatus: "verified",
			regulatorStatus: "active",
			regulatorFreshness: "fresh",
			identityVerificationStatus: callbackResult.status,
			fraudSignal: callbackResult.fraudSignal,
			effectiveScore: 0.98,
		});

		expect(malformedCallback).toEqual({
			recommendation: "provider_unavailable",
			reasonCodes: ["malformed_callback"],
		});
	});
});
