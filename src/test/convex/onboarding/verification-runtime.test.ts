import { describe, expect, it } from "vitest";
import {
	createBrokerOnboardingVerificationRuntimeSnapshot,
	buildStoredEmailVerificationInput,
	buildWorkosSessionEmailVerificationInput,
} from "../../../../convex/onboarding/verification/runtime";
import { createWorkosEmailVerificationContract } from "../../../../convex/onboarding/verification/workosEmailVerification";
import { DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG } from "../../../../convex/onboarding/verification/config";

describe("broker onboarding verification runtime", () => {
	it("builds an auto-approve candidate snapshot when all evidence is present and aligned", async () => {
		const emailContract = createWorkosEmailVerificationContract();
		const emailVerification = emailContract.normalize(
			buildWorkosSessionEmailVerificationInput({
				authUserId: "user_123",
				checkedAt: 1_700_000_000_000,
				email: "broker@example.com",
				emailVerified: true,
			})
		);

		const snapshot = await createBrokerOnboardingVerificationRuntimeSnapshot({
			capturedAt: 1_700_000_000_000,
			emailVerification,
			licenseNumber: "ON-12345",
			policy: DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG,
			province: "ON",
			regulatorProviderKey: "mock_regulator",
			regulatorLookup: async () => ({
				provider: "mock_regulator",
				status: "active",
				freshness: "fresh",
				brokerageAssociation: null,
				brokerageName: "North Star Brokerage",
				brokerageNumber: "BR-123",
				licenseNumber: "ON-12345",
				licenseProvince: "ON",
				licenseType: "broker",
				legalName: {
					firstName: "francois",
					middleName: "a",
					lastName: "smith",
					fullName: "francois a smith",
				},
				checkedAt: 1_700_000_000_000,
				dataAsOf: 1_700_000_000_000,
				evidenceReferences: [],
				sourceSnapshot: null,
			}),
			selfReportedName: { fullName: "Francois A. Smith" },
			identityVerification: {
				provider: "mock_identity",
				status: "verified",
				legalName: {
					firstName: "francois",
					middleName: "a",
					lastName: "smith",
					fullName: "francois a smith",
				},
				checkedAt: 1_700_000_000_000,
				completedAt: 1_700_000_000_000,
				fraudSignal: false,
				evidenceReferences: [],
			},
		});

		expect(snapshot.recommendation).toBe("auto_approve_candidate");
		expect(snapshot.reasonCodes).toEqual([]);
		expect(snapshot.similarityScores.effectiveScore).toBe(1);
		expect(snapshot.regulator.status).toBe("active");
	});

	it("routes to review-needed when regulator evidence is incomplete", async () => {
		const emailContract = createWorkosEmailVerificationContract();
		const emailVerification = emailContract.normalize(
			buildStoredEmailVerificationInput({
				application: {
					authUserId: "auth_user_123",
					verifiedEmail: "broker@example.com",
				},
				checkedAt: 1_700_000_000_000,
			})
		);

		const snapshot = await createBrokerOnboardingVerificationRuntimeSnapshot({
			capturedAt: 1_700_000_000_000,
			emailVerification,
			policy: DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG,
			province: "ON",
			selfReportedName: { fullName: "Francois Smith" },
			identityVerification: {
				provider: "mock_identity",
				status: "verified",
				legalName: {
					firstName: "francois",
					middleName: null,
					lastName: "smith",
					fullName: "francois smith",
				},
				checkedAt: 1_700_000_000_000,
				completedAt: 1_700_000_000_000,
				fraudSignal: false,
				evidenceReferences: [],
			},
		});

		expect(snapshot.regulator.status).toBe("incomplete");
		expect(snapshot.recommendation).toBe("review_needed");
		expect(snapshot.reasonCodes).toEqual(["verification_sources_incomplete"]);
		expect(snapshot.similarityScores.effectiveScore).toBeNull();
	});

	it("routes stale regulator evidence to review-needed even when the names match", async () => {
		const emailContract = createWorkosEmailVerificationContract();
		const emailVerification = emailContract.normalize(
			buildWorkosSessionEmailVerificationInput({
				authUserId: "user_123",
				checkedAt: 1_700_000_000_000,
				email: "broker@example.com",
				emailVerified: true,
			})
		);

		const snapshot = await createBrokerOnboardingVerificationRuntimeSnapshot({
			capturedAt: 1_700_000_000_000,
			emailVerification,
			licenseNumber: "ON-12345",
			policy: DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG,
			province: "ON",
			regulatorProviderKey: "imported_fsra",
			regulatorLookup: async () => ({
				provider: "imported_fsra",
				status: "active",
				freshness: "stale",
				brokerageAssociation: null,
				brokerageName: "North Star Brokerage",
				brokerageNumber: "BR-123",
				licenseNumber: "ON-12345",
				licenseProvince: "ON",
				licenseType: "broker",
				legalName: {
					firstName: "francois",
					middleName: null,
					lastName: "smith",
					fullName: "francois smith",
				},
				checkedAt: 1_700_000_000_000,
				dataAsOf: 1_699_000_000_000,
				evidenceReferences: [],
				sourceSnapshot: null,
			}),
			selfReportedName: { fullName: "Francois Smith" },
			identityVerification: {
				provider: "mock_identity",
				status: "verified",
				legalName: {
					firstName: "francois",
					middleName: null,
					lastName: "smith",
					fullName: "francois smith",
				},
				checkedAt: 1_700_000_000_000,
				completedAt: 1_700_000_000_000,
				fraudSignal: false,
				evidenceReferences: [],
			},
		});

		expect(snapshot.similarityScores.effectiveScore).toBe(1);
		expect(snapshot.recommendation).toBe("review_needed");
		expect(snapshot.reasonCodes).toEqual(["stale_regulator_data"]);
	});
});
