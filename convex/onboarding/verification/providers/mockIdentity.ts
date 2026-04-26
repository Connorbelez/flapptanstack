import {
	normalizeBrokerOnboardingPersonName,
	type VerificationEvidenceReference,
} from "../../../../shared/brokerOnboarding/contracts";
import type {
	IdentityVerificationCallbackRequest,
	IdentityVerificationProvider,
	IdentityVerificationReviewRequest,
	IdentityVerificationSession,
	IdentityVerificationStartRequest,
} from "../interface";

type MockIdentityScenario =
	| "verified"
	| "review_needed"
	| "rejected"
	| "fraud"
	| "provider_unavailable";

export interface MockIdentityVerificationProviderOptions {
	now?: () => number;
}

function inferScenario(
	startRequest: IdentityVerificationStartRequest
): MockIdentityScenario {
	const email = startRequest.email.trim().toLowerCase();

	if (email.includes("unavailable")) {
		return "provider_unavailable";
	}
	if (email.includes("fraud")) {
		return "fraud";
	}
	if (email.includes("reject")) {
		return "rejected";
	}
	if (email.includes("review")) {
		return "review_needed";
	}

	return "verified";
}

function buildSessionId(
	applicationId: string,
	scenario: MockIdentityScenario
): string {
	return `mock-idv:${scenario}:${applicationId}`;
}

function parseSessionId(sessionId: string): MockIdentityScenario | null {
	const parts = sessionId.split(":");
	if (parts.length < 3 || parts[0] !== "mock-idv") {
		return null;
	}

	const scenario = parts[1];
	switch (scenario) {
		case "verified":
		case "review_needed":
		case "rejected":
		case "fraud":
		case "provider_unavailable":
			return scenario;
		default:
			return null;
	}
}

function buildEvidenceReference(
	sessionId: string,
	capturedAt: number,
	referenceType: VerificationEvidenceReference["referenceType"],
	label = "Mock identity verification"
): VerificationEvidenceReference {
	return {
		provider: "mock_identity",
		referenceId: sessionId,
		referenceType,
		capturedAt,
		label,
	};
}

function buildIdentityResult(
	scenario: MockIdentityScenario,
	args: {
		applicantName?: IdentityVerificationReviewRequest["applicantName"];
		capturedAt: number;
		sessionId: string;
	}
) {
	const reviewEvidenceReference = buildEvidenceReference(
		args.sessionId,
		args.capturedAt,
		"identity_verification_review"
	);

	switch (scenario) {
		case "provider_unavailable":
			return {
				provider: "mock_identity",
				status: "provider_unavailable" as const,
				legalName: null,
				checkedAt: args.capturedAt,
				completedAt: null,
				fraudSignal: false,
				evidenceReferences: [
					buildEvidenceReference(
						args.sessionId,
						args.capturedAt,
						"provider_snapshot",
						"Mock identity provider unavailable"
					),
				],
			};
		case "fraud":
			return {
				provider: "mock_identity",
				status: "fraud" as const,
				legalName: args.applicantName
					? normalizeBrokerOnboardingPersonName(args.applicantName)
					: null,
				checkedAt: args.capturedAt,
				completedAt: args.capturedAt,
				fraudSignal: true,
				evidenceReferences: [reviewEvidenceReference],
			};
		case "rejected":
			return {
				provider: "mock_identity",
				status: "rejected" as const,
				legalName: args.applicantName
					? normalizeBrokerOnboardingPersonName(args.applicantName)
					: null,
				checkedAt: args.capturedAt,
				completedAt: args.capturedAt,
				fraudSignal: false,
				evidenceReferences: [reviewEvidenceReference],
			};
		case "review_needed":
			return {
				provider: "mock_identity",
				status: "review_needed" as const,
				legalName: args.applicantName
					? normalizeBrokerOnboardingPersonName(args.applicantName)
					: null,
				checkedAt: args.capturedAt,
				completedAt: args.capturedAt,
				fraudSignal: false,
				evidenceReferences: [reviewEvidenceReference],
			};
		case "verified":
			return {
				provider: "mock_identity",
				status: "verified" as const,
				legalName: args.applicantName
					? normalizeBrokerOnboardingPersonName(args.applicantName)
					: null,
				checkedAt: args.capturedAt,
				completedAt: args.capturedAt,
				fraudSignal: false,
				evidenceReferences: [reviewEvidenceReference],
			};
		default:
			return buildInvalidCallbackResult(args.capturedAt);
	}
}

function buildInvalidCallbackResult(capturedAt: number) {
	return {
		provider: "mock_identity",
		status: "callback_invalid" as const,
		legalName: null,
		checkedAt: capturedAt,
		completedAt: null,
		fraudSignal: false,
		evidenceReferences: [
			{
				provider: "mock_identity",
				referenceId: `invalid-callback:${capturedAt}`,
				referenceType: "provider_snapshot" as const,
				capturedAt,
				label: "Mock identity callback parse failure",
			},
		],
	};
}

export function createMockIdentityVerificationProvider(
	options: MockIdentityVerificationProviderOptions = {}
): IdentityVerificationProvider {
	const now = options.now ?? Date.now;

	return {
		mode: "mock",
		providerKey: "mock_identity",
		async getReview(request: IdentityVerificationReviewRequest) {
			const capturedAt = now();
			const scenario = parseSessionId(request.sessionId);
			if (!scenario) {
				return buildInvalidCallbackResult(capturedAt);
			}

			return buildIdentityResult(scenario, {
				applicantName: request.applicantName,
				capturedAt,
				sessionId: request.sessionId,
			});
		},
		async handleCallback(request: IdentityVerificationCallbackRequest) {
			const capturedAt = now();
			const sessionId =
				request.sessionId ??
				(typeof request.payload === "object" &&
				request.payload !== null &&
				"sessionId" in request.payload &&
				typeof request.payload.sessionId === "string"
					? request.payload.sessionId
					: undefined);

			if (!sessionId) {
				return buildInvalidCallbackResult(capturedAt);
			}

			const scenario = parseSessionId(sessionId);
			if (!scenario) {
				return buildInvalidCallbackResult(capturedAt);
			}

			return buildIdentityResult(scenario, {
				applicantName: request.applicantName,
				capturedAt,
				sessionId,
			});
		},
		async startVerification(
			request: IdentityVerificationStartRequest
		): Promise<IdentityVerificationSession> {
			const scenario = inferScenario(request);
			const sessionId = buildSessionId(request.applicationId, scenario);

			if (scenario === "provider_unavailable") {
				return {
					providerKey: "mock_identity",
					sessionId,
					status: "provider_unavailable",
				};
			}

			return {
				providerKey: "mock_identity",
				sessionId,
				status: "started",
				launchUrl: `https://mock-idv.local/session/${encodeURIComponent(sessionId)}`,
			};
		},
	};
}
