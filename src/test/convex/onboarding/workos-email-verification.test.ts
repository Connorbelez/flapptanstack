import { describe, expect, it } from "vitest";
import { createWorkosEmailVerificationContract } from "../../../../convex/onboarding/verification/workosEmailVerification";

describe("WorkOS email verification contract", () => {
	const contract = createWorkosEmailVerificationContract();

	it("normalizes verified WorkOS auth state", () => {
		const normalized = contract.normalize({
			authUserId: "user_123",
			checkedAt: 1_700_000_000_000,
			email: "broker@example.com",
			emailVerified: true,
			source: "workos_session_claim",
		});

		expect(normalized.status).toBe("verified");
		expect(normalized.verifiedAt).toBe(1_700_000_000_000);
		expect(normalized.evidenceReferences).toEqual([
			expect.objectContaining({
				provider: "workos_authkit",
				referenceType: "email_verification_event",
			}),
		]);
	});

	it("blocks trusted IDV when email is not verified", () => {
		const decision = contract.gateTrustedIdentityVerification({
			authUserId: "user_123",
			checkedAt: 1_700_000_000_000,
			email: "broker@example.com",
			emailVerified: false,
			source: "workos_auth_state",
		});

		expect(decision.isSatisfied).toBe(false);
		expect(decision.blockedRecommendation).toBe("review_needed");
		expect(decision.blockedReasonCodes).toEqual(["email_unverified"]);
		expect(decision.normalizedEmailVerification.status).toBe("unverified");
	});

	it("fails closed when WorkOS email verification state is unavailable", () => {
		const decision = contract.gateTrustedIdentityVerification({
			authUserId: "user_123",
			checkedAt: 1_700_000_000_000,
			email: "broker@example.com",
			emailVerified: null,
			source: "workos_event",
			sourceAvailable: false,
		});

		expect(decision.isSatisfied).toBe(false);
		expect(decision.blockedRecommendation).toBe("provider_unavailable");
		expect(decision.blockedReasonCodes).toEqual(["provider_unavailable"]);
		expect(decision.normalizedEmailVerification.status).toBe(
			"provider_unavailable"
		);
	});
});
