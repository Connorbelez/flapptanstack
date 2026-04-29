const DIACRITIC_REGEX = /\p{Diacritic}/gu;
const TOKEN_SEPARATOR_REGEX = /[\s\p{P}\p{S}]+/gu;
const NAME_SUFFIX_TOKENS = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

export const BROKER_ONBOARDING_SUPPORTED_PROVINCES = ["ON"] as const;
export type BrokerOnboardingSupportedProvinceCode =
	(typeof BROKER_ONBOARDING_SUPPORTED_PROVINCES)[number];

export const BROKER_ONBOARDING_APPROVAL_RECOMMENDATIONS = [
	"auto_approve_candidate",
	"review_needed",
	"rejected",
	"provider_unavailable",
	"stale_regulator_data",
	"unsupported_province",
] as const;

export type BrokerOnboardingApprovalRecommendation =
	(typeof BROKER_ONBOARDING_APPROVAL_RECOMMENDATIONS)[number];

export const BROKER_ONBOARDING_REASON_CODES = [
	"unsupported_province",
	"missing_config",
	"provider_unavailable",
	"malformed_callback",
	"stale_regulator_data",
	"email_unverified",
	"regulator_inactive",
	"regulator_revoked",
	"regulator_suspended",
	"regulator_not_found",
	"idv_fraud_signal",
	"idv_rejected",
	"identity_review_required",
	"verification_sources_incomplete",
	"effective_score_below_review_threshold",
	"effective_score_requires_review",
] as const;

export type BrokerOnboardingVerificationReasonCode =
	(typeof BROKER_ONBOARDING_REASON_CODES)[number];

export const REGULATOR_DIRECTORY_STATUSES = [
	"active",
	"inactive",
	"suspended",
	"revoked",
	"not_found",
	"provider_unavailable",
] as const;

export type BrokerOnboardingRegulatorStatus =
	(typeof REGULATOR_DIRECTORY_STATUSES)[number];

export const REGULATOR_LICENSE_TYPES = [
	"agent",
	"broker",
	"principal_broker",
	"brokerage",
] as const;

export type BrokerOnboardingRegulatorLicenseType =
	(typeof REGULATOR_LICENSE_TYPES)[number];

export const REGULATOR_FRESHNESS_STATES = [
	"fresh",
	"stale",
	"unknown",
] as const;

export type BrokerOnboardingRegulatorFreshness =
	(typeof REGULATOR_FRESHNESS_STATES)[number];

export const IDENTITY_VERIFICATION_STATUSES = [
	"not_started",
	"in_progress",
	"verified",
	"review_needed",
	"rejected",
	"fraud",
	"provider_unavailable",
	"callback_invalid",
] as const;

export type BrokerOnboardingIdentityVerificationStatus =
	(typeof IDENTITY_VERIFICATION_STATUSES)[number];

export const EMAIL_VERIFICATION_STATUSES = [
	"verified",
	"unverified",
	"provider_unavailable",
] as const;

export type BrokerOnboardingEmailVerificationStatus =
	(typeof EMAIL_VERIFICATION_STATUSES)[number];

export const VERIFICATION_EVIDENCE_REFERENCE_TYPES = [
	"regulator_record",
	"identity_verification_session",
	"identity_verification_review",
	"email_verification_event",
	"provider_snapshot",
] as const;

export type VerificationEvidenceReferenceType =
	(typeof VERIFICATION_EVIDENCE_REFERENCE_TYPES)[number];

export interface VerificationEvidenceReference {
	capturedAt?: number;
	label?: string;
	provider: string;
	referenceId: string;
	referenceType: VerificationEvidenceReferenceType;
	uri?: string;
}

export interface BrokerOnboardingPersonNameInput {
	firstName?: string | null;
	fullName?: string | null;
	lastName?: string | null;
	middleName?: string | null;
}

export interface NormalizedBrokerOnboardingPersonName {
	firstName: string | null;
	fullName: string | null;
	lastName: string | null;
	middleName: string | null;
}

export interface VerificationNameSimilarityScores {
	effectiveScore: number | null;
	regulatorVsIdentity: number | null;
	selfReportedVsIdentity: number | null;
	selfReportedVsRegulator: number | null;
}

export interface BrokerOnboardingRecommendationThresholds {
	autoApproveMinimum: number;
	reviewMinimum: number;
}

export interface BrokerOnboardingRecommendationPolicy {
	enabledProvinces: readonly string[];
	thresholds: BrokerOnboardingRecommendationThresholds;
}

export type BrokerOnboardingRegulatorSourceSnapshot = Readonly<
	Record<string, string | null>
>;

export interface BrokerOnboardingBrokerageAssociation {
	matched: boolean | null;
	requestedBrokerageName: string | null;
	requestedBrokerageNumber: string | null;
}

export interface BrokerOnboardingRegulatorCheck {
	brokerageAssociation: BrokerOnboardingBrokerageAssociation | null;
	brokerageName: string | null;
	brokerageNumber: string | null;
	checkedAt: number | null;
	dataAsOf: number | null;
	evidenceReferences: VerificationEvidenceReference[];
	freshness: BrokerOnboardingRegulatorFreshness;
	legalName: NormalizedBrokerOnboardingPersonName | null;
	licenseNumber: string | null;
	licenseProvince: string | null;
	licenseType: BrokerOnboardingRegulatorLicenseType | null;
	provider: string;
	sourceSnapshot: BrokerOnboardingRegulatorSourceSnapshot | null;
	status: BrokerOnboardingRegulatorStatus;
}

export interface BrokerOnboardingBrokerageCheck {
	brokerageName: string | null;
	brokerageNumber: string | null;
	checkedAt: number | null;
	dataAsOf: number | null;
	evidenceReferences: VerificationEvidenceReference[];
	freshness: BrokerOnboardingRegulatorFreshness;
	licenseProvince: string | null;
	provider: string;
	sourceSnapshot: BrokerOnboardingRegulatorSourceSnapshot | null;
	status: BrokerOnboardingRegulatorStatus;
}

export interface BrokerOnboardingIdentityVerificationCheck {
	checkedAt: number | null;
	completedAt: number | null;
	evidenceReferences: VerificationEvidenceReference[];
	fraudSignal: boolean;
	legalName: NormalizedBrokerOnboardingPersonName | null;
	provider: string;
	status: BrokerOnboardingIdentityVerificationStatus;
}

export interface BrokerOnboardingEmailVerificationCheck {
	checkedAt: number | null;
	email: string | null;
	evidenceReferences: VerificationEvidenceReference[];
	provider: string;
	status: BrokerOnboardingEmailVerificationStatus;
	verifiedAt: number | null;
}

export interface BrokerOnboardingVerificationSnapshot {
	capturedAt: number;
	emailVerification: BrokerOnboardingEmailVerificationCheck;
	evidenceReferences: VerificationEvidenceReference[];
	identityVerification: BrokerOnboardingIdentityVerificationCheck;
	province: string;
	reasonCodes: BrokerOnboardingVerificationReasonCode[];
	recommendation: BrokerOnboardingApprovalRecommendation;
	regulator: BrokerOnboardingRegulatorCheck;
	selfReportedName: NormalizedBrokerOnboardingPersonName;
	similarityScores: VerificationNameSimilarityScores;
}

export interface BrokerOnboardingRecommendationInput {
	configAvailable?: boolean;
	effectiveScore: number | null;
	emailVerificationStatus: BrokerOnboardingEmailVerificationStatus;
	fraudSignal: boolean;
	identityVerificationStatus: BrokerOnboardingIdentityVerificationStatus;
	policy: BrokerOnboardingRecommendationPolicy;
	province: string;
	regulatorFreshness: BrokerOnboardingRegulatorFreshness;
	regulatorStatus: BrokerOnboardingRegulatorStatus;
}

export interface BrokerOnboardingRecommendationResult {
	reasonCodes: BrokerOnboardingVerificationReasonCode[];
	recommendation: BrokerOnboardingApprovalRecommendation;
}

export interface CreateBrokerOnboardingVerificationSnapshotInput {
	capturedAt: number;
	emailVerification: Omit<
		BrokerOnboardingEmailVerificationCheck,
		"evidenceReferences"
	> & { evidenceReferences?: readonly VerificationEvidenceReference[] };
	identityVerification: Omit<
		BrokerOnboardingIdentityVerificationCheck,
		"evidenceReferences" | "legalName"
	> & {
		evidenceReferences?: readonly VerificationEvidenceReference[];
		legalName?: BrokerOnboardingPersonNameInput | null;
	};
	policy: BrokerOnboardingRecommendationPolicy;
	province: string;
	regulator: Omit<
		BrokerOnboardingRegulatorCheck,
		| "brokerageAssociation"
		| "brokerageName"
		| "brokerageNumber"
		| "evidenceReferences"
		| "legalName"
		| "licenseType"
		| "sourceSnapshot"
	> & {
		brokerageAssociation?: BrokerOnboardingBrokerageAssociation | null;
		brokerageName?: string | null;
		brokerageNumber?: string | null;
		evidenceReferences?: readonly VerificationEvidenceReference[];
		legalName?: BrokerOnboardingPersonNameInput | null;
		licenseType?: BrokerOnboardingRegulatorLicenseType | null;
		sourceSnapshot?: BrokerOnboardingRegulatorSourceSnapshot | null;
	};
	selfReportedName: BrokerOnboardingPersonNameInput;
	similarityScores: Omit<VerificationNameSimilarityScores, "effectiveScore"> & {
		effectiveScore?: number | null;
	};
}

function normalizeToken(value: string | null | undefined): string | null {
	if (!value) {
		return null;
	}

	const normalized = value
		.normalize("NFKD")
		.replace(DIACRITIC_REGEX, "")
		.toLowerCase()
		.replace(TOKEN_SEPARATOR_REGEX, " ")
		.trim();

	return normalized || null;
}

function stripTrailingSuffixTokens(tokens: readonly string[]): string[] {
	const stripped = [...tokens];

	while (stripped.length > 0) {
		const lastToken = stripped.at(-1);
		if (!(lastToken && NAME_SUFFIX_TOKENS.has(lastToken))) {
			break;
		}
		stripped.pop();
	}

	return stripped;
}

function normalizeFullName(value: string | null | undefined): string[] {
	const normalized = normalizeToken(value);
	if (!normalized) {
		return [];
	}

	return stripTrailingSuffixTokens(normalized.split(" ").filter(Boolean));
}

function dedupeReasonCodes(
	reasonCodes: readonly BrokerOnboardingVerificationReasonCode[]
): BrokerOnboardingVerificationReasonCode[] {
	return [...new Set(reasonCodes)];
}

export function normalizeBrokerOnboardingProvince(province: string): string {
	return province.trim().toUpperCase();
}

export function normalizeBrokerOnboardingPersonName(
	input: BrokerOnboardingPersonNameInput | null | undefined
): NormalizedBrokerOnboardingPersonName {
	const firstName = normalizeToken(input?.firstName);
	const middleName = normalizeToken(input?.middleName);
	const lastName = normalizeToken(input?.lastName);
	const fullNameTokens = normalizeFullName(input?.fullName);

	const resolvedFirstName = firstName ?? fullNameTokens[0] ?? null;
	const resolvedLastName =
		lastName ??
		(fullNameTokens.length > 1
			? (fullNameTokens.at(-1) ?? null)
			: (fullNameTokens[0] ?? null));
	const resolvedMiddleName =
		middleName ??
		(fullNameTokens.length > 2 ? fullNameTokens.slice(1, -1).join(" ") : null);

	const fullName =
		stripTrailingSuffixTokens(
			[resolvedFirstName, resolvedMiddleName, resolvedLastName].flatMap(
				(token) => (token ? token.split(" ").filter(Boolean) : [])
			)
		).join(" ") || null;

	return {
		firstName: resolvedFirstName,
		middleName: resolvedMiddleName,
		lastName: resolvedLastName,
		fullName,
	};
}

export function calculateEffectiveSimilarityScore(
	scores: Omit<VerificationNameSimilarityScores, "effectiveScore"> &
		Partial<Pick<VerificationNameSimilarityScores, "effectiveScore">>
): number | null {
	if (typeof scores.effectiveScore === "number") {
		return scores.effectiveScore;
	}

	const presentScores = [
		scores.selfReportedVsRegulator,
		scores.selfReportedVsIdentity,
		scores.regulatorVsIdentity,
	].filter((value): value is number => typeof value === "number");

	if (presentScores.length === 0) {
		return null;
	}

	return Math.min(...presentScores);
}

export function coalesceEvidenceReferences(
	...groups: ReadonlyArray<readonly VerificationEvidenceReference[] | undefined>
): VerificationEvidenceReference[] {
	const unique = new Map<string, VerificationEvidenceReference>();

	for (const group of groups) {
		for (const reference of group ?? []) {
			const key = [
				reference.provider,
				reference.referenceType,
				reference.referenceId,
			].join("::");
			if (!unique.has(key)) {
				unique.set(key, { ...reference });
			}
		}
	}

	return [...unique.values()];
}

export function evaluateBrokerOnboardingRecommendation(
	input: BrokerOnboardingRecommendationInput
): BrokerOnboardingRecommendationResult {
	const normalizedProvince = normalizeBrokerOnboardingProvince(input.province);
	const enabledProvinces = new Set(
		input.policy.enabledProvinces.map(normalizeBrokerOnboardingProvince)
	);

	if (input.configAvailable === false) {
		return {
			recommendation: "provider_unavailable",
			reasonCodes: ["missing_config"],
		};
	}

	if (!enabledProvinces.has(normalizedProvince)) {
		return {
			recommendation: "unsupported_province",
			reasonCodes: ["unsupported_province"],
		};
	}

	if (
		input.emailVerificationStatus === "provider_unavailable" ||
		input.regulatorStatus === "provider_unavailable" ||
		input.identityVerificationStatus === "provider_unavailable"
	) {
		return {
			recommendation: "provider_unavailable",
			reasonCodes: ["provider_unavailable"],
		};
	}

	if (input.identityVerificationStatus === "callback_invalid") {
		return {
			recommendation: "provider_unavailable",
			reasonCodes: ["malformed_callback"],
		};
	}

	if (input.regulatorFreshness === "stale") {
		return {
			recommendation: "stale_regulator_data",
			reasonCodes: ["stale_regulator_data"],
		};
	}

	switch (input.regulatorStatus) {
		case "inactive":
			return {
				recommendation: "rejected",
				reasonCodes: ["regulator_inactive"],
			};
		case "revoked":
			return {
				recommendation: "rejected",
				reasonCodes: ["regulator_revoked"],
			};
		case "suspended":
			return {
				recommendation: "rejected",
				reasonCodes: ["regulator_suspended"],
			};
		case "not_found":
			return {
				recommendation: "rejected",
				reasonCodes: ["regulator_not_found"],
			};
		default:
			break;
	}

	if (input.fraudSignal || input.identityVerificationStatus === "fraud") {
		return {
			recommendation: "rejected",
			reasonCodes: ["idv_fraud_signal"],
		};
	}

	if (input.identityVerificationStatus === "rejected") {
		return {
			recommendation: "rejected",
			reasonCodes: ["idv_rejected"],
		};
	}

	if (input.emailVerificationStatus !== "verified") {
		return {
			recommendation: "review_needed",
			reasonCodes: ["email_unverified"],
		};
	}

	if (input.identityVerificationStatus === "review_needed") {
		return {
			recommendation: "review_needed",
			reasonCodes: ["identity_review_required"],
		};
	}

	if (
		input.identityVerificationStatus === "not_started" ||
		input.identityVerificationStatus === "in_progress" ||
		input.regulatorFreshness === "unknown" ||
		input.effectiveScore === null
	) {
		return {
			recommendation: "review_needed",
			reasonCodes: ["verification_sources_incomplete"],
		};
	}

	if (input.effectiveScore < input.policy.thresholds.reviewMinimum) {
		return {
			recommendation: "rejected",
			reasonCodes: ["effective_score_below_review_threshold"],
		};
	}

	if (input.effectiveScore < input.policy.thresholds.autoApproveMinimum) {
		return {
			recommendation: "review_needed",
			reasonCodes: ["effective_score_requires_review"],
		};
	}

	return {
		recommendation: "auto_approve_candidate",
		reasonCodes: [],
	};
}

export function createBrokerOnboardingVerificationSnapshot(
	input: CreateBrokerOnboardingVerificationSnapshotInput
): BrokerOnboardingVerificationSnapshot {
	const similarityScores: VerificationNameSimilarityScores = {
		selfReportedVsRegulator: input.similarityScores.selfReportedVsRegulator,
		selfReportedVsIdentity: input.similarityScores.selfReportedVsIdentity,
		regulatorVsIdentity: input.similarityScores.regulatorVsIdentity,
		effectiveScore: calculateEffectiveSimilarityScore(input.similarityScores),
	};

	const regulator: BrokerOnboardingRegulatorCheck = {
		...input.regulator,
		brokerageAssociation: input.regulator.brokerageAssociation ?? null,
		brokerageName: input.regulator.brokerageName ?? null,
		brokerageNumber: input.regulator.brokerageNumber ?? null,
		legalName: input.regulator.legalName
			? normalizeBrokerOnboardingPersonName(input.regulator.legalName)
			: null,
		licenseType: input.regulator.licenseType ?? null,
		evidenceReferences: [...(input.regulator.evidenceReferences ?? [])],
		sourceSnapshot: input.regulator.sourceSnapshot
			? { ...input.regulator.sourceSnapshot }
			: null,
	};

	const identityVerification: BrokerOnboardingIdentityVerificationCheck = {
		...input.identityVerification,
		legalName: input.identityVerification.legalName
			? normalizeBrokerOnboardingPersonName(
					input.identityVerification.legalName
				)
			: null,
		evidenceReferences: [
			...(input.identityVerification.evidenceReferences ?? []),
		],
	};

	const emailVerification: BrokerOnboardingEmailVerificationCheck = {
		...input.emailVerification,
		evidenceReferences: [...(input.emailVerification.evidenceReferences ?? [])],
	};

	const recommendation = evaluateBrokerOnboardingRecommendation({
		configAvailable: true,
		policy: input.policy,
		province: input.province,
		emailVerificationStatus: emailVerification.status,
		regulatorStatus: regulator.status,
		regulatorFreshness: regulator.freshness,
		identityVerificationStatus: identityVerification.status,
		fraudSignal: identityVerification.fraudSignal,
		effectiveScore: similarityScores.effectiveScore,
	});

	return {
		capturedAt: input.capturedAt,
		province: normalizeBrokerOnboardingProvince(input.province),
		selfReportedName: normalizeBrokerOnboardingPersonName(
			input.selfReportedName
		),
		regulator,
		identityVerification,
		emailVerification,
		similarityScores,
		recommendation: recommendation.recommendation,
		reasonCodes: dedupeReasonCodes(recommendation.reasonCodes),
		evidenceReferences: coalesceEvidenceReferences(
			regulator.evidenceReferences,
			identityVerification.evidenceReferences,
			emailVerification.evidenceReferences
		),
	};
}
