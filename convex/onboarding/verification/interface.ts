import type {
	BrokerOnboardingApprovalRecommendation,
	BrokerOnboardingEmailVerificationCheck,
	BrokerOnboardingIdentityVerificationCheck,
	BrokerOnboardingPersonNameInput,
	BrokerOnboardingRegulatorCheck,
	BrokerOnboardingVerificationReasonCode,
} from "../../../shared/brokerOnboarding/contracts";
import type {
	BrokerOnboardingVerificationConfig,
	EmailVerificationProviderMode,
	IdentityVerificationProviderMode,
	RegulatorDirectoryProviderMode,
} from "./config";

export interface RegulatorDirectoryLookupRequest {
	licenseNumber: string;
	province: string;
	requestedAt: number;
	selfReportedName: BrokerOnboardingPersonNameInput;
}

export type RegulatorDirectoryLookupResult = BrokerOnboardingRegulatorCheck;

export interface IdentityVerificationStartRequest {
	applicantName: BrokerOnboardingPersonNameInput;
	applicationId: string;
	email: string;
	province: string;
	requestedAt: number;
}

export interface IdentityVerificationSession {
	launchUrl?: string;
	providerKey: string;
	sessionId: string;
	status: "started" | "reused" | "provider_unavailable";
}

export interface IdentityVerificationCallbackRequest {
	applicantName?: BrokerOnboardingPersonNameInput;
	applicationId: string;
	headers?: Readonly<Record<string, string | undefined>>;
	payload: unknown;
	receivedAt: number;
	sessionId?: string;
}

export type IdentityVerificationCallbackResult =
	BrokerOnboardingIdentityVerificationCheck;

export interface IdentityVerificationReviewRequest {
	applicantName?: BrokerOnboardingPersonNameInput;
	applicationId: string;
	reviewedAt: number;
	sessionId: string;
}

export type IdentityVerificationReviewResult =
	BrokerOnboardingIdentityVerificationCheck;

export interface EmailVerificationNormalizationInput {
	authUserId?: string;
	checkedAt: number;
	email?: string | null;
	emailVerified?: boolean | null;
	evidenceReferenceId?: string;
	source: "workos_auth_state" | "workos_event" | "workos_session_claim";
	sourceAvailable?: boolean;
	verifiedAt?: number | null;
}

export type EmailVerificationResult = BrokerOnboardingEmailVerificationCheck;

export interface TrustedIdentityVerificationGateDecision {
	blockedReasonCodes: BrokerOnboardingVerificationReasonCode[];
	blockedRecommendation: BrokerOnboardingApprovalRecommendation;
	isSatisfied: boolean;
	normalizedEmailVerification: EmailVerificationResult;
}

export interface RegulatorDirectoryProvider {
	lookupLicense(
		request: RegulatorDirectoryLookupRequest
	): Promise<RegulatorDirectoryLookupResult>;
	readonly mode: RegulatorDirectoryProviderMode;
	readonly providerKey: string;
}

export interface IdentityVerificationProvider {
	getReview(
		request: IdentityVerificationReviewRequest
	): Promise<IdentityVerificationReviewResult>;
	handleCallback(
		request: IdentityVerificationCallbackRequest
	): Promise<IdentityVerificationCallbackResult>;
	readonly mode: IdentityVerificationProviderMode;
	readonly providerKey: string;
	startVerification(
		request: IdentityVerificationStartRequest
	): Promise<IdentityVerificationSession>;
}

export interface EmailVerificationContract {
	gateTrustedIdentityVerification(
		input: EmailVerificationNormalizationInput
	): TrustedIdentityVerificationGateDecision;
	readonly mode: EmailVerificationProviderMode;
	normalize(
		input: EmailVerificationNormalizationInput
	): EmailVerificationResult;
	readonly providerKey: string;
}

export interface BrokerOnboardingVerificationServices {
	config: BrokerOnboardingVerificationConfig;
	emailVerification: EmailVerificationContract;
	identityVerification: IdentityVerificationProvider;
	regulatorDirectory: RegulatorDirectoryProvider;
}
