import { type Infer, v } from "convex/values";

const MORTGAGE_DOCUMENT_SIGNATORY_ROLES = [
	"purchasing_lender",
	"selling_lender",
	"primary_borrower",
	"co_borrower_1",
	"co_borrower_2",
	"broker_of_record",
	"assigned_broker",
	"primary_lawyer",
] as const;

const SUPPORTED_DEAL_DOCUMENT_VARIABLE_KEYS = [
	"assigned_broker_email",
	"assigned_broker_full_name",
	"broker_of_record_email",
	"broker_of_record_full_name",
	"co_borrower_1_email",
	"co_borrower_1_full_name",
	"co_borrower_2_email",
	"co_borrower_2_full_name",
	"deal_investment_amount",
	"deal_selected_fraction_units",
	"listing_description",
	"listing_marketplace_copy",
	"listing_title",
	"mortgage_amortization_months",
	"mortgage_amount",
	"mortgage_first_payment_date",
	"mortgage_interest_rate",
	"mortgage_lien_position",
	"mortgage_maturity_date",
	"mortgage_payment_amount",
	"mortgage_payment_frequency",
	"mortgage_principal",
	"mortgage_rate_type",
	"mortgage_term_months",
	"mortgage_term_start_date",
	"primary_borrower_email",
	"primary_borrower_full_name",
	"primary_lawyer_email",
	"primary_lawyer_full_name",
	"property_city",
	"property_postal_code",
	"property_province",
	"property_street_address",
	"property_type",
	"property_unit",
	"purchasing_lender_email",
	"purchasing_lender_full_name",
	"purchasing_lender_system_id",
	"selling_lender_email",
	"selling_lender_full_name",
	"valuation_date",
	"valuation_value_as_is",
] as const;

export const LEGACY_MORTGAGE_SIGNATORY_ROLE_ALIASES = {
	borrower_co_1: "co_borrower_1",
	borrower_co_2: "co_borrower_2",
	borrower_primary: "primary_borrower",
	lawyer_primary: "primary_lawyer",
	lender_primary: "purchasing_lender",
} as const satisfies Record<
	string,
	(typeof MORTGAGE_DOCUMENT_SIGNATORY_ROLES)[number]
>;

export const LEGACY_MORTGAGE_DOCUMENT_VARIABLE_KEY_ALIASES = {
	borrower_co_1_email: "co_borrower_1_email",
	borrower_co_1_full_name: "co_borrower_1_full_name",
	borrower_co_2_email: "co_borrower_2_email",
	borrower_co_2_full_name: "co_borrower_2_full_name",
	borrower_primary_email: "primary_borrower_email",
	borrower_primary_full_name: "primary_borrower_full_name",
	lawyer_primary_email: "primary_lawyer_email",
	lawyer_primary_full_name: "primary_lawyer_full_name",
	lender_primary_email: "purchasing_lender_email",
	lender_primary_full_name: "purchasing_lender_full_name",
	lender_primary_system_id: "purchasing_lender_system_id",
} as const satisfies Record<
	string,
	(typeof SUPPORTED_DEAL_DOCUMENT_VARIABLE_KEYS)[number]
>;

export const mortgageDocumentBlueprintClassValidator = v.union(
	v.literal("public_static"),
	v.literal("private_static"),
	v.literal("private_templated_non_signable"),
	v.literal("private_templated_signable")
);

export const mortgageDocumentSourceKindValidator = v.union(
	v.literal("asset"),
	v.literal("template_version")
);

export const mortgageDocumentBlueprintStatusValidator = v.union(
	v.literal("active"),
	v.literal("archived")
);

export const mortgageDocumentTemplateSnapshotMetaValidator = v.object({
	containsSignableFields: v.boolean(),
	requiredPlatformRoles: v.array(v.string()),
	requiredVariableKeys: v.array(v.string()),
	sourceGroupId: v.optional(v.id("documentTemplateGroups")),
	sourceGroupName: v.optional(v.string()),
	templateName: v.string(),
});

export const mortgageDocumentValidationSummaryValidator = v.object({
	containsSignableFields: v.boolean(),
	requiredPlatformRoles: v.array(v.string()),
	requiredVariableKeys: v.array(v.string()),
	unsupportedPlatformRoles: v.array(v.string()),
	unsupportedVariableKeys: v.array(v.string()),
});

const supportedDealDocumentVariableKeyValidator = v.union(
	...SUPPORTED_DEAL_DOCUMENT_VARIABLE_KEYS.map((key) => v.literal(key))
);

const mortgageDocumentSignatoryRoleValidator = v.union(
	...MORTGAGE_DOCUMENT_SIGNATORY_ROLES.map((role) => v.literal(role))
);

export const mortgageDocumentVariableMappingOverrideValidator = v.object({
	dealVariableKey: supportedDealDocumentVariableKeyValidator,
	templateVariableKey: v.string(),
});

export const mortgageDocumentSignatoryMappingOverrideValidator = v.object({
	dealParticipantRole: mortgageDocumentSignatoryRoleValidator,
	templatePlatformRole: v.string(),
});

export const mortgageDocumentMappingOverridesValidator = v.object({
	signatories: v.array(mortgageDocumentSignatoryMappingOverrideValidator),
	variables: v.array(mortgageDocumentVariableMappingOverrideValidator),
});

export type MortgageDocumentBlueprintClass = Infer<
	typeof mortgageDocumentBlueprintClassValidator
>;

export type MortgageDocumentSourceKind = Infer<
	typeof mortgageDocumentSourceKindValidator
>;

export type MortgageDocumentBlueprintStatus = Infer<
	typeof mortgageDocumentBlueprintStatusValidator
>;

export type MortgageDocumentValidationSummary = Infer<
	typeof mortgageDocumentValidationSummaryValidator
>;

export type MortgageDocumentMappingOverrides = Infer<
	typeof mortgageDocumentMappingOverridesValidator
>;
export type MortgageDocumentVariableMappingOverride = Infer<
	typeof mortgageDocumentVariableMappingOverrideValidator
>;
export type MortgageDocumentSignatoryMappingOverride = Infer<
	typeof mortgageDocumentSignatoryMappingOverrideValidator
>;

export const dealDocumentPackageStatusValidator = v.union(
	v.literal("pending"),
	v.literal("ready"),
	v.literal("partial_failure"),
	v.literal("failed"),
	v.literal("archived")
);

export const signatureProviderCodeValidator = v.literal("documenso");

export const signatureProviderRoleValidator = v.union(
	v.literal("SIGNER"),
	v.literal("APPROVER"),
	v.literal("VIEWER")
);

export const signatureEnvelopeStatusValidator = v.union(
	v.literal("draft"),
	v.literal("sent"),
	v.literal("partially_signed"),
	v.literal("completed"),
	v.literal("declined"),
	v.literal("voided"),
	v.literal("provider_error")
);

export const signatureRecipientStatusValidator = v.union(
	v.literal("pending"),
	v.literal("opened"),
	v.literal("signed"),
	v.literal("declined")
);

export const generatedDocumentSigningStatusValidator = v.union(
	v.literal("not_applicable"),
	v.literal("draft"),
	v.literal("sent"),
	v.literal("partially_signed"),
	v.literal("completed"),
	v.literal("declined"),
	v.literal("voided"),
	v.literal("provider_error")
);

export const dealDocumentInstanceKindValidator = v.union(
	v.literal("static_reference"),
	v.literal("generated")
);

export const dealDocumentInstanceStatusValidator = v.union(
	v.literal("available"),
	v.literal("generation_failed"),
	v.literal("provider_error"),
	v.literal("signature_pending_recipient_resolution"),
	v.literal("signature_draft"),
	v.literal("signature_sent"),
	v.literal("signature_partially_signed"),
	v.literal("signature_declined"),
	v.literal("signature_voided"),
	v.literal("signed"),
	v.literal("archived")
);

export const dealDocumentStoredRemediationActionValidator = v.union(
	v.literal("waived_for_deal"),
	v.literal("retried_instance"),
	v.literal("refreshed_from_source_snapshot")
);

export const dealEnvelopeProviderValidator = v.literal("documenso");

export const dealEnvelopeAttemptStatusValidator = v.union(
	v.literal("draft"),
	v.literal("pending_recipient_resolution"),
	v.literal("sent"),
	v.literal("partially_signed"),
	v.literal("completed"),
	v.literal("declined"),
	v.literal("voided"),
	v.literal("expired"),
	v.literal("configuration_error"),
	v.literal("send_failed"),
	v.literal("reissue_required")
);

export const dealEnvelopeRecipientDocumensoRoleValidator = v.union(
	v.literal("SIGNER"),
	v.literal("APPROVER"),
	v.literal("VIEWER")
);

export const dealEnvelopeRecipientSendStatusValidator = v.union(
	v.literal("pending"),
	v.literal("sent"),
	v.literal("delivery_failed"),
	v.literal("cancelled")
);

export const dealEnvelopeRecipientReadStatusValidator = v.union(
	v.literal("not_available"),
	v.literal("available"),
	v.literal("opened")
);

export const dealEnvelopeRecipientSigningStatusValidator = v.union(
	v.literal("not_started"),
	v.literal("in_progress"),
	v.literal("completed"),
	v.literal("rejected"),
	v.literal("voided"),
	v.literal("expired")
);

export const dealEnvelopeProviderEventStatusValidator = v.union(
	v.literal("pending"),
	v.literal("processed"),
	v.literal("failed")
);

export const dealEnvelopeProviderEventTypeValidator = v.union(
	v.literal("document_created"),
	v.literal("document_sent"),
	v.literal("recipient_opened"),
	v.literal("recipient_signed"),
	v.literal("recipient_completed"),
	v.literal("document_completed"),
	v.literal("document_declined"),
	v.literal("document_voided"),
	v.literal("document_expired"),
	v.literal("reminder_sent"),
	v.literal("unknown")
);

export const dealSigningExceptionKindValidator = v.union(
	v.literal("pre_send_configuration_failure"),
	v.literal("send_failure"),
	v.literal("signing_stall"),
	v.literal("recipient_rejection"),
	v.literal("envelope_cancelled_or_voided"),
	v.literal("reconciliation_mismatch")
);

export const dealSigningExceptionStatusValidator = v.union(
	v.literal("open"),
	v.literal("resolved")
);

export const dealSigningExceptionSeverityValidator = v.union(
	v.literal("blocking"),
	v.literal("warning")
);

export const dealEnvelopeRecipientSnapshotValidator = v.object({
	authId: v.optional(v.string()),
	email: v.string(),
	name: v.string(),
	platformRole: v.string(),
	documensoRole: dealEnvelopeRecipientDocumensoRoleValidator,
	signingOrder: v.number(),
	required: v.boolean(),
	providerRecipientId: v.optional(v.string()),
	tokenAvailableAt: v.optional(v.number()),
	tokenExpiresAt: v.optional(v.number()),
	sendStatus: dealEnvelopeRecipientSendStatusValidator,
	readStatus: dealEnvelopeRecipientReadStatusValidator,
	signingStatus: dealEnvelopeRecipientSigningStatusValidator,
	rejectionReason: v.optional(v.string()),
	completedAt: v.optional(v.number()),
});

export const dealDocumentSourceBlueprintSnapshotValidator = v.object({
	category: v.optional(v.string()),
	class: mortgageDocumentBlueprintClassValidator,
	description: v.optional(v.string()),
	displayName: v.string(),
	displayOrder: v.number(),
	mappingOverrides: v.optional(mortgageDocumentMappingOverridesValidator),
	packageKey: v.optional(v.string()),
	packageLabel: v.optional(v.string()),
	packageItemKind: v.optional(
		v.union(
			v.literal("group"),
			v.literal("standalone_template"),
			v.literal("static_asset")
		)
	),
	packageVersionId: v.optional(v.id("documentPackageVersions")),
	envelopeBoundaryKey: v.optional(v.string()),
	templateId: v.optional(v.id("documentTemplates")),
	templateVersion: v.optional(v.number()),
});

export const dealPackageBlueprintSnapshotValidator = v.object({
	assetId: v.optional(v.id("documentAssets")),
	sourceBlueprintId: v.optional(v.id("mortgageDocumentBlueprints")),
	sourceBlueprintSnapshot: dealDocumentSourceBlueprintSnapshotValidator,
});

export type DealDocumentPackageStatus = Infer<
	typeof dealDocumentPackageStatusValidator
>;

export type SignatureProviderCode = Infer<
	typeof signatureProviderCodeValidator
>;

export type SignatureProviderRole = Infer<
	typeof signatureProviderRoleValidator
>;

export type SignatureEnvelopeStatus = Infer<
	typeof signatureEnvelopeStatusValidator
>;

export type SignatureRecipientStatus = Infer<
	typeof signatureRecipientStatusValidator
>;

export type GeneratedDocumentSigningStatus = Infer<
	typeof generatedDocumentSigningStatusValidator
>;

export type DealDocumentInstanceKind = Infer<
	typeof dealDocumentInstanceKindValidator
>;

export type DealDocumentInstanceStatus = Infer<
	typeof dealDocumentInstanceStatusValidator
>;

export type DealDocumentStoredRemediationAction = Infer<
	typeof dealDocumentStoredRemediationActionValidator
>;

export type DealEnvelopeProvider = Infer<typeof dealEnvelopeProviderValidator>;

export type DealEnvelopeAttemptStatus = Infer<
	typeof dealEnvelopeAttemptStatusValidator
>;

export type DealEnvelopeRecipientDocumensoRole = Infer<
	typeof dealEnvelopeRecipientDocumensoRoleValidator
>;

export type DealEnvelopeRecipientSendStatus = Infer<
	typeof dealEnvelopeRecipientSendStatusValidator
>;

export type DealEnvelopeRecipientReadStatus = Infer<
	typeof dealEnvelopeRecipientReadStatusValidator
>;

export type DealEnvelopeRecipientSigningStatus = Infer<
	typeof dealEnvelopeRecipientSigningStatusValidator
>;

export type DealEnvelopeProviderEventStatus = Infer<
	typeof dealEnvelopeProviderEventStatusValidator
>;

export type DealEnvelopeProviderEventType = Infer<
	typeof dealEnvelopeProviderEventTypeValidator
>;

export type DealSigningExceptionKind = Infer<
	typeof dealSigningExceptionKindValidator
>;

export type DealSigningExceptionStatus = Infer<
	typeof dealSigningExceptionStatusValidator
>;

export type DealSigningExceptionSeverity = Infer<
	typeof dealSigningExceptionSeverityValidator
>;

export type DealEnvelopeRecipientSnapshot = Infer<
	typeof dealEnvelopeRecipientSnapshotValidator
>;

export type DealDocumentSourceBlueprintSnapshot = Infer<
	typeof dealDocumentSourceBlueprintSnapshotValidator
>;

export type DealPackageBlueprintSnapshot = Infer<
	typeof dealPackageBlueprintSnapshotValidator
>;

export const ALLOWED_MORTGAGE_SIGNATORY_PLATFORM_ROLES =
	MORTGAGE_DOCUMENT_SIGNATORY_ROLES;

export const SUPPORTED_MORTGAGE_DOCUMENT_VARIABLE_KEYS =
	SUPPORTED_DEAL_DOCUMENT_VARIABLE_KEYS;

export function isAllowedMortgageSignatoryPlatformRole(role: string) {
	return (
		ALLOWED_MORTGAGE_SIGNATORY_PLATFORM_ROLES as readonly string[]
	).includes(role);
}

export function isSupportedMortgageDocumentVariableKey(key: string) {
	return (
		SUPPORTED_MORTGAGE_DOCUMENT_VARIABLE_KEYS as readonly string[]
	).includes(key);
}

export function isPublicMortgageDocumentClass(
	documentClass: MortgageDocumentBlueprintClass
) {
	return documentClass === "public_static";
}

export function isStaticMortgageDocumentClass(
	documentClass: MortgageDocumentBlueprintClass
) {
	return (
		documentClass === "public_static" || documentClass === "private_static"
	);
}

export function isTemplatedMortgageDocumentClass(
	documentClass: MortgageDocumentBlueprintClass
) {
	return !isStaticMortgageDocumentClass(documentClass);
}
