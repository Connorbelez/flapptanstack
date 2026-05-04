import { type Infer, v } from "convex/values";

export const legalRepresentationProfileKindValidator = v.union(
	v.literal("platform"),
	v.literal("guest"),
	v.literal("both")
);

export const legalRepresentationPlatformStatusValidator = v.union(
	v.literal("invited"),
	v.literal("active"),
	v.literal("suspended"),
	v.literal("offboarded")
);

export const lsoLicensingStatusValidator = v.union(
	v.literal("licensed"),
	v.literal("administratively_suspended"),
	v.literal("suspended"),
	v.literal("revoked"),
	v.literal("retired"),
	v.literal("unknown")
);

export const lsoRestrictionStatusValidator = v.union(
	v.literal("clear"),
	v.literal("restricted"),
	v.literal("suspended"),
	v.literal("requires_review"),
	v.literal("unknown")
);

export const lawyerVerificationCheckTypeValidator = v.union(
	v.literal("initial_lso"),
	v.literal("fresh_restriction"),
	v.literal("platform_periodic"),
	v.literal("idv"),
	v.literal("manual_admin")
);

export const lawyerVerificationOutcomeValidator = v.union(
	v.literal("eligible"),
	v.literal("ineligible"),
	v.literal("requires_review"),
	v.literal("failed")
);

export const lawyerVerificationProviderValidator = v.union(
	v.literal("manual_admin"),
	v.literal("test"),
	v.literal("lso"),
	v.literal("idv")
);

export const lawyerVerificationReasonCodeValidator = v.union(
	v.literal("active_license"),
	v.literal("license_not_found"),
	v.literal("license_restricted"),
	v.literal("license_suspended"),
	v.literal("restriction_current"),
	v.literal("restriction_stale"),
	v.literal("identity_mismatch"),
	v.literal("provider_unavailable"),
	v.literal("manual_override"),
	v.literal("requires_admin_review"),
	v.literal("engagement_missing"),
	v.literal("engagement_signed"),
	v.literal("profile_suspended"),
	v.literal("profile_offboarded"),
	v.literal("evidence_expired")
);

export const lawyerInvitationStatusValidator = v.union(
	v.literal("pending"),
	v.literal("accepted"),
	v.literal("verified"),
	v.literal("expired"),
	v.literal("revoked"),
	v.literal("failed")
);

export const representationEngagementStatusValidator = v.union(
	v.literal("pending"),
	v.literal("signed"),
	v.literal("voided"),
	v.literal("failed")
);

export const representationEngagementProviderValidator = v.union(
	v.literal("documenso"),
	v.literal("manual_admin")
);

export const legalCheckpointValidator = v.union(
	v.literal("selection"),
	v.literal("LAWYER_VERIFIED"),
	v.literal("REPRESENTATION_CONFIRMED"),
	v.literal("platform_activation")
);

export const legalCheckpointDecisionValidator = v.union(
	v.literal("allow"),
	v.literal("block"),
	v.literal("requires_review")
);

export const legalSourceSnapshotValidator = v.record(v.string(), v.string());

export const lsoLawyerMetadataValidator = v.object({
	barNumber: v.optional(v.string()),
	jurisdiction: v.optional(v.string()),
	licensingStatus: v.optional(lsoLicensingStatusValidator),
	restrictionStatus: v.optional(lsoRestrictionStatusValidator),
	restrictionSummary: v.optional(v.string()),
	source: v.optional(v.string()),
	sourceFetchedAt: v.optional(v.number()),
	lsoLawyerId: v.optional(v.id("lsoLawyers")),
});

export const legalCheckpointResultValidator = v.object({
	checkpoint: legalCheckpointValidator,
	decision: legalCheckpointDecisionValidator,
	reasonCodes: v.array(lawyerVerificationReasonCodeValidator),
	verificationId: v.optional(v.id("lawyerVerifications")),
	engagementId: v.optional(v.id("representationEngagements")),
	expiresAt: v.optional(v.number()),
});

export type LegalRepresentationProfileKind = Infer<
	typeof legalRepresentationProfileKindValidator
>;
export type LegalRepresentationPlatformStatus = Infer<
	typeof legalRepresentationPlatformStatusValidator
>;
export type LsoLicensingStatus = Infer<typeof lsoLicensingStatusValidator>;
export type LsoRestrictionStatus = Infer<typeof lsoRestrictionStatusValidator>;
export type LawyerVerificationCheckType = Infer<
	typeof lawyerVerificationCheckTypeValidator
>;
export type LawyerVerificationOutcome = Infer<
	typeof lawyerVerificationOutcomeValidator
>;
export type LawyerVerificationProvider = Infer<
	typeof lawyerVerificationProviderValidator
>;
export type LawyerVerificationReasonCode = Infer<
	typeof lawyerVerificationReasonCodeValidator
>;
export type LawyerInvitationStatus = Infer<
	typeof lawyerInvitationStatusValidator
>;
export type RepresentationEngagementStatus = Infer<
	typeof representationEngagementStatusValidator
>;
export type RepresentationEngagementProvider = Infer<
	typeof representationEngagementProviderValidator
>;
export type LegalCheckpoint = Infer<typeof legalCheckpointValidator>;
export type LegalCheckpointDecision = Infer<
	typeof legalCheckpointDecisionValidator
>;
export type LegalSourceSnapshot = Infer<typeof legalSourceSnapshotValidator>;
export type LsoLawyerMetadata = Infer<typeof lsoLawyerMetadataValidator>;
export type LegalCheckpointResult = Infer<
	typeof legalCheckpointResultValidator
>;
