import type { Validator } from "convex/values";
import { v } from "convex/values";
import {
	BROKER_ONBOARDING_APPROVAL_RECOMMENDATIONS,
	BROKER_ONBOARDING_REASON_CODES,
	EMAIL_VERIFICATION_STATUSES,
	IDENTITY_VERIFICATION_STATUSES,
	REGULATOR_DIRECTORY_STATUSES,
	REGULATOR_FRESHNESS_STATES,
	REGULATOR_LICENSE_TYPES,
	VERIFICATION_EVIDENCE_REFERENCE_TYPES,
} from "../../../shared/brokerOnboarding/contracts";
import { actorTypeValidator } from "../../engine/validators";

function literalUnion<T extends string>(values: readonly T[]) {
	return v.union(
		...(values.map((value) => v.literal(value)) as [
			Validator<T>,
			Validator<T>,
			...Validator<T>[],
		])
	);
}

export const brokerOnboardingApplicationStatusValidator = v.union(
	v.literal("draft"),
	v.literal("submitted"),
	v.literal("changes_requested"),
	v.literal("approved"),
	v.literal("rejected"),
	v.literal("activated")
);

export const brokerOnboardingReviewEntryTypeValidator = v.union(
	v.literal("reviewer_note"),
	v.literal("broker_note"),
	v.literal("system_event")
);

export const brokerOnboardingReviewQueueViewValidator = v.union(
	v.literal("submitted"),
	v.literal("changes_requested"),
	v.literal("recently_updated"),
	v.literal("rejected")
);

export const brokerOnboardingDownstreamHandoffStatusValidator = v.union(
	v.literal("not_started"),
	v.literal("linked"),
	v.literal("role_assigned"),
	v.literal("activated")
);

export const brokerOnboardingReopenedFieldStatusValidator = v.union(
	v.literal("open"),
	v.literal("resolved")
);

export const brokerOnboardingApprovalRecommendationValidator = literalUnion(
	BROKER_ONBOARDING_APPROVAL_RECOMMENDATIONS
);

export const brokerOnboardingVerificationReasonCodeValidator = literalUnion(
	BROKER_ONBOARDING_REASON_CODES
);

export const brokerOnboardingRegulatorStatusValidator = literalUnion(
	REGULATOR_DIRECTORY_STATUSES
);

export const brokerOnboardingRegulatorFreshnessValidator = literalUnion(
	REGULATOR_FRESHNESS_STATES
);

export const brokerOnboardingRegulatorLicenseTypeValidator = literalUnion(
	REGULATOR_LICENSE_TYPES
);

export const brokerOnboardingIdentityVerificationStatusValidator = literalUnion(
	IDENTITY_VERIFICATION_STATUSES
);

export const brokerOnboardingEmailVerificationStatusValidator = literalUnion(
	EMAIL_VERIFICATION_STATUSES
);

export const verificationEvidenceReferenceTypeValidator = literalUnion(
	VERIFICATION_EVIDENCE_REFERENCE_TYPES
);

export const brokerOnboardingPersonNameInputValidator = v.object({
	firstName: v.optional(v.string()),
	fullName: v.optional(v.string()),
	lastName: v.optional(v.string()),
	middleName: v.optional(v.string()),
});

export const normalizedBrokerOnboardingPersonNameValidator = v.object({
	firstName: v.union(v.string(), v.null()),
	fullName: v.union(v.string(), v.null()),
	lastName: v.union(v.string(), v.null()),
	middleName: v.union(v.string(), v.null()),
});

export const verificationEvidenceReferenceValidator = v.object({
	capturedAt: v.optional(v.number()),
	label: v.optional(v.string()),
	provider: v.string(),
	referenceId: v.string(),
	referenceType: verificationEvidenceReferenceTypeValidator,
	uri: v.optional(v.string()),
});

export const verificationNameSimilarityScoresValidator = v.object({
	effectiveScore: v.union(v.number(), v.null()),
	regulatorVsIdentity: v.union(v.number(), v.null()),
	selfReportedVsIdentity: v.union(v.number(), v.null()),
	selfReportedVsRegulator: v.union(v.number(), v.null()),
});

export const brokerOnboardingBrokerageAssociationValidator = v.object({
	matched: v.union(v.boolean(), v.null()),
	requestedBrokerageName: v.union(v.string(), v.null()),
	requestedBrokerageNumber: v.union(v.string(), v.null()),
});

export const brokerOnboardingRegulatorSourceSnapshotValidator = v.record(
	v.string(),
	v.union(v.string(), v.null())
);

export const brokerOnboardingRegulatorCheckValidator = v.object({
	brokerageAssociation: v.union(
		brokerOnboardingBrokerageAssociationValidator,
		v.null()
	),
	brokerageName: v.union(v.string(), v.null()),
	brokerageNumber: v.union(v.string(), v.null()),
	checkedAt: v.union(v.number(), v.null()),
	dataAsOf: v.union(v.number(), v.null()),
	evidenceReferences: v.array(verificationEvidenceReferenceValidator),
	freshness: brokerOnboardingRegulatorFreshnessValidator,
	legalName: v.union(normalizedBrokerOnboardingPersonNameValidator, v.null()),
	licenseNumber: v.union(v.string(), v.null()),
	licenseProvince: v.union(v.string(), v.null()),
	licenseType: v.union(brokerOnboardingRegulatorLicenseTypeValidator, v.null()),
	provider: v.string(),
	sourceSnapshot: v.union(
		brokerOnboardingRegulatorSourceSnapshotValidator,
		v.null()
	),
	status: brokerOnboardingRegulatorStatusValidator,
});

export const brokerOnboardingIdentityVerificationCheckValidator = v.object({
	checkedAt: v.union(v.number(), v.null()),
	completedAt: v.union(v.number(), v.null()),
	evidenceReferences: v.array(verificationEvidenceReferenceValidator),
	fraudSignal: v.boolean(),
	legalName: v.union(normalizedBrokerOnboardingPersonNameValidator, v.null()),
	provider: v.string(),
	status: brokerOnboardingIdentityVerificationStatusValidator,
});

export const brokerOnboardingEmailVerificationCheckValidator = v.object({
	checkedAt: v.union(v.number(), v.null()),
	email: v.union(v.string(), v.null()),
	evidenceReferences: v.array(verificationEvidenceReferenceValidator),
	provider: v.string(),
	status: brokerOnboardingEmailVerificationStatusValidator,
	verifiedAt: v.union(v.number(), v.null()),
});

export const brokerOnboardingVerificationSnapshotValidator = v.object({
	capturedAt: v.number(),
	emailVerification: brokerOnboardingEmailVerificationCheckValidator,
	evidenceReferences: v.array(verificationEvidenceReferenceValidator),
	identityVerification: brokerOnboardingIdentityVerificationCheckValidator,
	province: v.string(),
	reasonCodes: v.array(brokerOnboardingVerificationReasonCodeValidator),
	recommendation: brokerOnboardingApprovalRecommendationValidator,
	regulator: brokerOnboardingRegulatorCheckValidator,
	selfReportedName: normalizedBrokerOnboardingPersonNameValidator,
	similarityScores: verificationNameSimilarityScoresValidator,
});

export const brokerOnboardingVerificationStateValidator = v.object({
	currentIdvLaunchUrl: v.union(v.string(), v.null()),
	currentIdvProviderKey: v.union(v.string(), v.null()),
	currentIdvSessionId: v.union(v.string(), v.null()),
	idvCompletedAt: v.union(v.number(), v.null()),
	idvStartedAt: v.union(v.number(), v.null()),
	lastCallbackEventId: v.union(
		v.id("brokerOnboardingVerificationCallbackEvents"),
		v.null()
	),
	lastCallbackProcessedAt: v.union(v.number(), v.null()),
	lastCallbackReceivedAt: v.union(v.number(), v.null()),
	lastCallbackSignatureVerified: v.union(v.boolean(), v.null()),
	lastRecomputedAt: v.union(v.number(), v.null()),
	requiresReverification: v.boolean(),
	reverificationFieldPaths: v.array(v.string()),
	reverificationRequiredAt: v.union(v.number(), v.null()),
});

export const brokerOnboardingReopenedFieldValidator = v.object({
	fieldPath: v.string(),
	reason: v.optional(v.string()),
	requestedAt: v.number(),
	requestedByAuthId: v.optional(v.string()),
	resolutionNote: v.optional(v.string()),
	resolvedAt: v.optional(v.number()),
	resolvedByAuthId: v.optional(v.string()),
	status: brokerOnboardingReopenedFieldStatusValidator,
});

export const brokerOnboardingReverificationFlagsValidator = v.object({
	identityVerification: v.boolean(),
	regulatorLookup: v.boolean(),
});

export const brokerOnboardingReviewReopenedFieldInputValidator = v.object({
	fieldPath: v.string(),
	reason: v.optional(v.string()),
});

export const brokerOnboardingDraftDataValidator = v.object({
	brokerageName: v.optional(v.string()),
	brokerageNumber: v.optional(v.string()),
	businessPhone: v.optional(v.string()),
	licenseNumber: v.optional(v.string()),
	licenseProvince: v.optional(v.string()),
	requestedPortalSlug: v.optional(v.string()),
	selfReportedName: v.optional(brokerOnboardingPersonNameInputValidator),
});

export const brokerOnboardingApplicationMachineContextValidator = v.object({
	activationCompletedAt: v.union(v.number(), v.null()),
	approvedAt: v.union(v.number(), v.null()),
	changesRequestedAt: v.union(v.number(), v.null()),
	currentStep: v.union(v.string(), v.null()),
	draftLastSavedAt: v.union(v.number(), v.null()),
	rejectedAt: v.union(v.number(), v.null()),
	submittedAt: v.union(v.number(), v.null()),
	submitCount: v.number(),
});

export const brokerOnboardingReviewEntryValidator = v.object({
	applicationId: v.id("brokerOnboardingApplications"),
	authorAuthId: v.optional(v.string()),
	authorType: v.optional(actorTypeValidator),
	body: v.string(),
	createdAt: v.number(),
	entryType: brokerOnboardingReviewEntryTypeValidator,
	metadata: v.optional(v.record(v.string(), v.any())),
	reopenedFields: v.optional(v.array(brokerOnboardingReopenedFieldValidator)),
	systemEventType: v.optional(v.string()),
});
