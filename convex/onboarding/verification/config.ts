import {
	BROKER_ONBOARDING_SUPPORTED_PROVINCES,
	type BrokerOnboardingApprovalRecommendation,
	type BrokerOnboardingRecommendationPolicy,
	type BrokerOnboardingRecommendationThresholds,
	normalizeBrokerOnboardingProvince,
} from "../../../shared/brokerOnboarding/contracts";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const REGULATOR_DIRECTORY_PROVIDER_MODES = [
	"mock",
	"imported_fsra",
	"live",
] as const;

export type RegulatorDirectoryProviderMode =
	(typeof REGULATOR_DIRECTORY_PROVIDER_MODES)[number];

export const IDENTITY_VERIFICATION_PROVIDER_MODES = [
	"mock",
	"sandbox",
	"live",
] as const;

export type IdentityVerificationProviderMode =
	(typeof IDENTITY_VERIFICATION_PROVIDER_MODES)[number];

export const EMAIL_VERIFICATION_PROVIDER_MODES = ["workos"] as const;

export type EmailVerificationProviderMode =
	(typeof EMAIL_VERIFICATION_PROVIDER_MODES)[number];

export interface BrokerOnboardingVerificationProviderSelection {
	readonly emailVerification: EmailVerificationProviderMode;
	readonly identityVerification: IdentityVerificationProviderMode;
	readonly regulatorDirectory: RegulatorDirectoryProviderMode;
}

export interface BrokerOnboardingVerificationFailurePolicy {
	readonly malformedCallback: Extract<
		BrokerOnboardingApprovalRecommendation,
		"provider_unavailable"
	>;
	readonly missingConfig: Extract<
		BrokerOnboardingApprovalRecommendation,
		"provider_unavailable"
	>;
	readonly staleRegulatorData: Extract<
		BrokerOnboardingApprovalRecommendation,
		"stale_regulator_data"
	>;
	readonly unavailableProvider: Extract<
		BrokerOnboardingApprovalRecommendation,
		"provider_unavailable"
	>;
	readonly unsupportedProvince: Extract<
		BrokerOnboardingApprovalRecommendation,
		"unsupported_province"
	>;
}

export interface BrokerOnboardingVerificationConfig
	extends BrokerOnboardingRecommendationPolicy {
	readonly failurePolicy: BrokerOnboardingVerificationFailurePolicy;
	readonly providers: BrokerOnboardingVerificationProviderSelection;
	readonly regulatorFreshnessWindowMs: number;
	readonly thresholds: Readonly<BrokerOnboardingRecommendationThresholds>;
}

export interface BrokerOnboardingVerificationConfigOverrides {
	enabledProvinces?: readonly string[];
	failurePolicy?: Partial<BrokerOnboardingVerificationFailurePolicy>;
	providers?: Partial<BrokerOnboardingVerificationProviderSelection>;
	regulatorFreshnessWindowMs?: number;
	thresholds?: Partial<BrokerOnboardingRecommendationThresholds>;
}

const DEFAULT_ENABLED_PROVINCES = Object.freeze([
	...BROKER_ONBOARDING_SUPPORTED_PROVINCES,
]);

const DEFAULT_THRESHOLDS = Object.freeze({
	autoApproveMinimum: 0.92,
	reviewMinimum: 0.78,
} as const satisfies BrokerOnboardingRecommendationThresholds);

const DEFAULT_PROVIDERS = Object.freeze({
	regulatorDirectory: "mock",
	identityVerification: "mock",
	emailVerification: "workos",
} as const satisfies BrokerOnboardingVerificationProviderSelection);

const DEFAULT_FAILURE_POLICY = Object.freeze({
	missingConfig: "provider_unavailable",
	unavailableProvider: "provider_unavailable",
	malformedCallback: "provider_unavailable",
	staleRegulatorData: "stale_regulator_data",
	unsupportedProvince: "unsupported_province",
} as const satisfies BrokerOnboardingVerificationFailurePolicy);

export const DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG = Object.freeze({
	enabledProvinces: DEFAULT_ENABLED_PROVINCES,
	thresholds: DEFAULT_THRESHOLDS,
	providers: DEFAULT_PROVIDERS,
	regulatorFreshnessWindowMs: SEVEN_DAYS_MS,
	failurePolicy: DEFAULT_FAILURE_POLICY,
} as const satisfies BrokerOnboardingVerificationConfig);

export function isBrokerOnboardingProvinceEnabled(
	province: string,
	config: BrokerOnboardingVerificationConfig = DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG
): boolean {
	const enabledProvinces = new Set(
		config.enabledProvinces.map(normalizeBrokerOnboardingProvince)
	);
	return enabledProvinces.has(normalizeBrokerOnboardingProvince(province));
}

export function resolveBrokerOnboardingVerificationConfig(
	overrides: BrokerOnboardingVerificationConfigOverrides = {}
): BrokerOnboardingVerificationConfig {
	return {
		enabledProvinces: overrides.enabledProvinces?.map(
			normalizeBrokerOnboardingProvince
		) ?? [...DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG.enabledProvinces],
		thresholds: {
			...DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG.thresholds,
			...overrides.thresholds,
		},
		providers: {
			...DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG.providers,
			...overrides.providers,
		},
		regulatorFreshnessWindowMs:
			overrides.regulatorFreshnessWindowMs ??
			DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG.regulatorFreshnessWindowMs,
		failurePolicy: {
			...DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG.failurePolicy,
			...overrides.failurePolicy,
		},
	};
}
