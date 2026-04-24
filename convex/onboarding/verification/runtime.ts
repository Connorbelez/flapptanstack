import type {
	BrokerOnboardingEmailVerificationCheck,
	BrokerOnboardingIdentityVerificationCheck,
	BrokerOnboardingPersonNameInput,
	BrokerOnboardingRecommendationPolicy,
	BrokerOnboardingRegulatorCheck,
	BrokerOnboardingVerificationSnapshot,
} from "../../../shared/brokerOnboarding/contracts";
import {
	createBrokerOnboardingVerificationSnapshot,
	normalizeBrokerOnboardingProvince,
} from "../../../shared/brokerOnboarding/contracts";
import type { BrokerOnboardingApplicationDoc } from "../brokerApplication/helpers";
import { DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG } from "./config";
import { computeBrokerOnboardingNameSimilarityScores } from "./nameMatching";

export function buildWorkosSessionEmailVerificationInput(args: {
	authUserId?: string;
	checkedAt: number;
	email?: string | null;
	emailVerified?: boolean | null;
	verifiedAt?: number | null;
}) {
	return {
		authUserId: args.authUserId,
		checkedAt: args.checkedAt,
		email: args.email ?? null,
		emailVerified: args.emailVerified ?? null,
		source: "workos_session_claim" as const,
		verifiedAt: args.verifiedAt ?? null,
	};
}

export function buildStoredEmailVerificationInput(args: {
	application: Pick<
		BrokerOnboardingApplicationDoc,
		"authUserId" | "verifiedEmail"
	>;
	checkedAt: number;
}) {
	return {
		authUserId: args.application.authUserId,
		checkedAt: args.checkedAt,
		email: args.application.verifiedEmail ?? null,
		emailVerified: Boolean(args.application.verifiedEmail),
		evidenceReferenceId: `broker-onboarding:${args.application.authUserId}:verified-email`,
		source: "workos_auth_state" as const,
		verifiedAt: args.application.verifiedEmail ? args.checkedAt : null,
	};
}

export function createIncompleteRegulatorCheck(args: {
	checkedAt: number;
	expectedBrokerageName?: string | null;
	expectedBrokerageNumber?: string | null;
	licenseNumber?: string | null;
	province: string;
	provider: string;
}): BrokerOnboardingRegulatorCheck {
	return {
		brokerageAssociation:
			args.expectedBrokerageName || args.expectedBrokerageNumber
				? {
						matched: null,
						requestedBrokerageName: args.expectedBrokerageName ?? null,
						requestedBrokerageNumber: args.expectedBrokerageNumber ?? null,
					}
				: null,
		brokerageName: null,
		brokerageNumber: null,
		checkedAt: args.checkedAt,
		dataAsOf: null,
		evidenceReferences: [],
		freshness: "unknown",
		legalName: null,
		licenseNumber: args.licenseNumber ?? null,
		licenseProvince: normalizeBrokerOnboardingProvince(args.province),
		licenseType: null,
		provider: args.provider,
		sourceSnapshot: null,
		status: "incomplete",
	};
}

export function createNotStartedIdentityVerificationCheck(args: {
	checkedAt: number;
	provider: string;
}): BrokerOnboardingIdentityVerificationCheck {
	return {
		provider: args.provider,
		status: "not_started",
		legalName: null,
		checkedAt: args.checkedAt,
		completedAt: null,
		fraudSignal: false,
		evidenceReferences: [],
	};
}

export async function createBrokerOnboardingVerificationRuntimeSnapshot(args: {
	capturedAt: number;
	emailVerification: BrokerOnboardingEmailVerificationCheck;
	identityVerification?: BrokerOnboardingIdentityVerificationCheck | null;
	policy?: BrokerOnboardingRecommendationPolicy;
	province?: string | null;
	regulatorProviderKey?: string;
	regulatorLookup?: (() => Promise<BrokerOnboardingRegulatorCheck>) | null;
	requestedBrokerageName?: string | null;
	requestedBrokerageNumber?: string | null;
	licenseNumber?: string | null;
	selfReportedName?: BrokerOnboardingPersonNameInput | null;
}): Promise<BrokerOnboardingVerificationSnapshot> {
	const policy = args.policy ?? DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG;
	const normalizedProvince =
		args.province?.trim() ||
		DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG.enabledProvinces[0] ||
		"ON";
	const regulator =
		args.regulatorLookup && args.licenseNumber && args.province
			? await args.regulatorLookup()
			: createIncompleteRegulatorCheck({
					checkedAt: args.capturedAt,
					expectedBrokerageName: args.requestedBrokerageName,
					expectedBrokerageNumber: args.requestedBrokerageNumber,
					licenseNumber: args.licenseNumber,
					province: normalizedProvince,
					provider: args.regulatorProviderKey ?? "verification_runtime",
				});
	const identityVerification =
		args.identityVerification ??
		createNotStartedIdentityVerificationCheck({
			checkedAt: args.capturedAt,
			provider: "verification_runtime",
		});
	const selfReportedName = args.selfReportedName ?? null;
	const similarityScores = computeBrokerOnboardingNameSimilarityScores({
		selfReportedName,
		regulatorName: regulator.legalName,
		identityName: identityVerification.legalName,
	});

	return createBrokerOnboardingVerificationSnapshot({
		capturedAt: args.capturedAt,
		policy,
		province: normalizedProvince,
		selfReportedName: selfReportedName ?? {},
		regulator,
		identityVerification,
		emailVerification: args.emailVerification,
		similarityScores,
	});
}
