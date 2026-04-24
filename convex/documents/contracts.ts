import { type Infer, v } from "convex/values";

const MORTGAGE_DOCUMENT_SIGNATORY_ROLES = [
	"lender_primary",
	"borrower_primary",
	"borrower_co_1",
	"borrower_co_2",
	"broker_of_record",
	"assigned_broker",
	"lawyer_primary",
] as const;

const SUPPORTED_DEAL_DOCUMENT_VARIABLE_KEYS = [
	"assigned_broker_full_name",
	"borrower_co_1_full_name",
	"borrower_co_2_full_name",
	"borrower_primary_email",
	"borrower_primary_full_name",
	"broker_of_record_full_name",
	"lawyer_primary_full_name",
	"listing_description",
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
	"property_city",
	"property_postal_code",
	"property_province",
	"property_street_address",
	"property_type",
	"property_unit",
	"valuation_date",
	"valuation_value_as_is",
] as const;

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
