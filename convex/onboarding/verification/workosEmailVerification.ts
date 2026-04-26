import type {
	BrokerOnboardingApprovalRecommendation,
	BrokerOnboardingVerificationReasonCode,
	VerificationEvidenceReference,
} from "../../../shared/brokerOnboarding/contracts";
import type {
	EmailVerificationContract,
	EmailVerificationNormalizationInput,
} from "./interface";

function buildEvidenceReferences(
	input: EmailVerificationNormalizationInput
): VerificationEvidenceReference[] {
	const isUnavailable =
		input.sourceAvailable === false || input.emailVerified == null;
	const referenceId =
		input.evidenceReferenceId ??
		[
			input.source,
			isUnavailable ? "unavailable" : "state",
			input.authUserId ?? input.email ?? "anonymous",
		].join(":");

	return [
		{
			provider: "workos_authkit",
			referenceId,
			referenceType: isUnavailable
				? "provider_snapshot"
				: "email_verification_event",
			capturedAt: input.checkedAt,
			label: isUnavailable
				? "WorkOS email verification state unavailable"
				: "WorkOS email verification state",
		},
	];
}

function resolveBlockedOutcome(status: "provider_unavailable" | "unverified"): {
	reasonCodes: BrokerOnboardingVerificationReasonCode[];
	recommendation: BrokerOnboardingApprovalRecommendation;
} {
	if (status === "provider_unavailable") {
		return {
			reasonCodes: ["provider_unavailable"],
			recommendation: "provider_unavailable",
		};
	}

	return {
		reasonCodes: ["email_unverified"],
		recommendation: "review_needed",
	};
}

export function createWorkosEmailVerificationContract(): EmailVerificationContract {
	const normalize = (input: EmailVerificationNormalizationInput) => {
		const evidenceReferences = buildEvidenceReferences(input);

		if (input.sourceAvailable === false) {
			return {
				provider: "workos_authkit",
				status: "provider_unavailable" as const,
				email: input.email ?? null,
				checkedAt: input.checkedAt,
				verifiedAt: null,
				evidenceReferences,
			};
		}

		if (input.emailVerified == null) {
			return {
				provider: "workos_authkit",
				status: "provider_unavailable" as const,
				email: input.email ?? null,
				checkedAt: input.checkedAt,
				verifiedAt: null,
				evidenceReferences,
			};
		}

		if (input.emailVerified) {
			return {
				provider: "workos_authkit",
				status: "verified" as const,
				email: input.email ?? null,
				checkedAt: input.checkedAt,
				verifiedAt: input.verifiedAt ?? input.checkedAt,
				evidenceReferences,
			};
		}

		return {
			provider: "workos_authkit",
			status: "unverified" as const,
			email: input.email ?? null,
			checkedAt: input.checkedAt,
			verifiedAt: null,
			evidenceReferences,
		};
	};

	return {
		mode: "workos",
		providerKey: "workos_authkit",
		normalize,
		gateTrustedIdentityVerification(input) {
			const normalizedEmailVerification = normalize(input);

			if (normalizedEmailVerification.status === "verified") {
				return {
					isSatisfied: true,
					normalizedEmailVerification,
					blockedReasonCodes: [],
					blockedRecommendation: "auto_approve_candidate",
				};
			}

			const blockedOutcome = resolveBlockedOutcome(
				normalizedEmailVerification.status
			);

			return {
				isSatisfied: false,
				normalizedEmailVerification,
				blockedReasonCodes: blockedOutcome.reasonCodes,
				blockedRecommendation: blockedOutcome.recommendation,
			};
		},
	};
}
