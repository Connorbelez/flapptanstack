import type { Infer } from "convex/values";
import { v } from "convex/values";
import { variableTypeValidator } from "./validators";

export const canonicalVariableAvailabilityValidator = v.union(
	v.literal("guaranteed"),
	v.literal("nullable_until_lock"),
	v.literal("computed_at_lock")
);

export const canonicalDocumentVariableValidator = v.object({
	availability: canonicalVariableAvailabilityValidator,
	description: v.string(),
	key: v.string(),
	label: v.string(),
	readOnly: v.literal(true),
	sampleValue: v.string(),
	sourcePath: v.string(),
	type: variableTypeValidator,
});

export type CanonicalDocumentVariable = Infer<
	typeof canonicalDocumentVariableValidator
>;

function canonicalVariable<const T extends CanonicalDocumentVariable>(
	variable: T
): T {
	return variable;
}

export const CANONICAL_DOCUMENT_VARIABLES = [
	canonicalVariable({
		availability: "nullable_until_lock",
		description: "Email address for the FairLend broker assigned to the deal.",
		key: "assigned_broker_email",
		label: "Assigned Broker Email",
		readOnly: true,
		sampleValue: "broker@fairlend.ca",
		sourcePath: "mortgage.assignedBroker.email",
		type: "string",
	}),
	canonicalVariable({
		availability: "nullable_until_lock",
		description: "Full name for the FairLend broker assigned to the deal.",
		key: "assigned_broker_full_name",
		label: "Assigned Broker Full Name",
		readOnly: true,
		sampleValue: "Alex Broker",
		sourcePath: "mortgage.assignedBroker.fullName",
		type: "string",
	}),
	canonicalVariable({
		availability: "nullable_until_lock",
		description: "Email address for the first co-borrower, when present.",
		key: "co_borrower_1_email",
		label: "Co-borrower 1 Email",
		readOnly: true,
		sampleValue: "co.borrower1@example.com",
		sourcePath: "mortgage.borrowers[role=co_borrower][0].email",
		type: "string",
	}),
	canonicalVariable({
		availability: "nullable_until_lock",
		description: "Full name for the first co-borrower, when present.",
		key: "co_borrower_1_full_name",
		label: "Co-borrower 1 Full Name",
		readOnly: true,
		sampleValue: "Casey Borrower",
		sourcePath: "mortgage.borrowers[role=co_borrower][0].fullName",
		type: "string",
	}),
	canonicalVariable({
		availability: "nullable_until_lock",
		description: "Email address for the second co-borrower, when present.",
		key: "co_borrower_2_email",
		label: "Co-borrower 2 Email",
		readOnly: true,
		sampleValue: "co.borrower2@example.com",
		sourcePath: "mortgage.borrowers[role=co_borrower][1].email",
		type: "string",
	}),
	canonicalVariable({
		availability: "nullable_until_lock",
		description: "Full name for the second co-borrower, when present.",
		key: "co_borrower_2_full_name",
		label: "Co-borrower 2 Full Name",
		readOnly: true,
		sampleValue: "Jordan Borrower",
		sourcePath: "mortgage.borrowers[role=co_borrower][1].fullName",
		type: "string",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Email address for the primary borrower on the mortgage.",
		key: "primary_borrower_email",
		label: "Primary Borrower Email",
		readOnly: true,
		sampleValue: "borrower@example.com",
		sourcePath: "deal.participants.primary_borrower.email",
		type: "string",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Full name for the primary borrower on the mortgage.",
		key: "primary_borrower_full_name",
		label: "Primary Borrower Full Name",
		readOnly: true,
		sampleValue: "Taylor Borrower",
		sourcePath: "deal.participants.primary_borrower.displayName",
		type: "string",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Email address for the broker of record.",
		key: "broker_of_record_email",
		label: "Broker of Record Email",
		readOnly: true,
		sampleValue: "record.broker@example.com",
		sourcePath: "mortgage.brokerOfRecord.email",
		type: "string",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Full name for the broker of record.",
		key: "broker_of_record_full_name",
		label: "Broker of Record Full Name",
		readOnly: true,
		sampleValue: "Morgan Broker",
		sourcePath: "mortgage.brokerOfRecord.fullName",
		type: "string",
	}),
	canonicalVariable({
		availability: "computed_at_lock",
		description:
			"Amount this lender is investing, computed from selected fractions and mortgage principal.",
		key: "deal_investment_amount",
		label: "Deal Investment Amount",
		readOnly: true,
		sampleValue: "62500",
		sourcePath: "deal.fractionalShare * mortgage.principal",
		type: "currency",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "The lender selected fraction units stored on the deal.",
		key: "deal_selected_fraction_units",
		label: "Selected Fraction Units",
		readOnly: true,
		sampleValue: "2500",
		sourcePath: "deal.fractionalShare",
		type: "integer",
	}),
	canonicalVariable({
		availability: "nullable_until_lock",
		description: "Email address for the selected lawyer on the locked deal.",
		key: "primary_lawyer_email",
		label: "Primary Lawyer Email",
		readOnly: true,
		sampleValue: "lawyer@example.com",
		sourcePath: "deal.participants.primary_lawyer.email",
		type: "string",
	}),
	canonicalVariable({
		availability: "nullable_until_lock",
		description: "Selected lawyer for the locked deal.",
		key: "primary_lawyer_full_name",
		label: "Primary Lawyer Full Name",
		readOnly: true,
		sampleValue: "Morgan Patel",
		sourcePath: "deal.participants.primary_lawyer.displayName",
		type: "string",
	}),
	canonicalVariable({
		availability: "nullable_until_lock",
		description: "Public listing description attached to the locked listing.",
		key: "listing_description",
		label: "Listing Description",
		readOnly: true,
		sampleValue: "Detached home secured by a first-position mortgage.",
		sourcePath: "listing.description",
		type: "string",
	}),
	canonicalVariable({
		availability: "nullable_until_lock",
		description: "Marketplace copy attached to the locked listing.",
		key: "listing_marketplace_copy",
		label: "Listing Marketplace Copy",
		readOnly: true,
		sampleValue: "Stable residential mortgage opportunity.",
		sourcePath: "listing.marketplaceCopy",
		type: "string",
	}),
	canonicalVariable({
		availability: "nullable_until_lock",
		description: "Title of the listing locked by the lender.",
		key: "listing_title",
		label: "Listing Title",
		readOnly: true,
		sampleValue: "Toronto Residential Mortgage",
		sourcePath: "listing.title",
		type: "string",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Email address for the lender who locked the listing.",
		key: "purchasing_lender_email",
		label: "Purchasing Lender Email",
		readOnly: true,
		sampleValue: "lender@example.com",
		sourcePath: "deal.participants.purchasing_lender.email",
		type: "string",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Name of the lender who locked the listing.",
		key: "purchasing_lender_full_name",
		label: "Purchasing Lender Full Name",
		readOnly: true,
		sampleValue: "Avery Chen",
		sourcePath: "deal.participants.purchasing_lender.displayName",
		type: "string",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Internal user id for the lender who locked the listing.",
		key: "purchasing_lender_system_id",
		label: "Purchasing Lender System ID",
		readOnly: true,
		sampleValue: "user_01KLOCKEDLENDER",
		sourcePath: "deal.participants.purchasing_lender.userId",
		type: "string",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Email address for the selling lender on the deal.",
		key: "selling_lender_email",
		label: "Selling Lender Email",
		readOnly: true,
		sampleValue: "seller.lender@example.com",
		sourcePath: "deal.participants.selling_lender.email",
		type: "string",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Name of the selling lender on the deal.",
		key: "selling_lender_full_name",
		label: "Selling Lender Full Name",
		readOnly: true,
		sampleValue: "Sam Seller",
		sourcePath: "deal.participants.selling_lender.displayName",
		type: "string",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Mortgage amortization period in months.",
		key: "mortgage_amortization_months",
		label: "Mortgage Amortization Months",
		readOnly: true,
		sampleValue: "300",
		sourcePath: "mortgage.amortizationMonths",
		type: "integer",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Mortgage amount used for document interpolation.",
		key: "mortgage_amount",
		label: "Mortgage Amount",
		readOnly: true,
		sampleValue: "250000",
		sourcePath: "mortgage.principal",
		type: "currency",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "First scheduled payment date for the mortgage.",
		key: "mortgage_first_payment_date",
		label: "Mortgage First Payment Date",
		readOnly: true,
		sampleValue: "2026-06-01",
		sourcePath: "mortgage.firstPaymentDate",
		type: "date",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Mortgage interest rate.",
		key: "mortgage_interest_rate",
		label: "Mortgage Interest Rate",
		readOnly: true,
		sampleValue: "9.25",
		sourcePath: "mortgage.interestRate",
		type: "percentage",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Lien position for the mortgage.",
		key: "mortgage_lien_position",
		label: "Mortgage Lien Position",
		readOnly: true,
		sampleValue: "1",
		sourcePath: "mortgage.lienPosition",
		type: "integer",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Mortgage maturity date.",
		key: "mortgage_maturity_date",
		label: "Mortgage Maturity Date",
		readOnly: true,
		sampleValue: "2027-05-31",
		sourcePath: "mortgage.maturityDate",
		type: "date",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Scheduled payment amount for the mortgage.",
		key: "mortgage_payment_amount",
		label: "Mortgage Payment Amount",
		readOnly: true,
		sampleValue: "2145.83",
		sourcePath: "mortgage.paymentAmount",
		type: "currency",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Payment frequency for the mortgage.",
		key: "mortgage_payment_frequency",
		label: "Mortgage Payment Frequency",
		readOnly: true,
		sampleValue: "monthly",
		sourcePath: "mortgage.paymentFrequency",
		type: "string",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Full principal amount on the mortgage record.",
		key: "mortgage_principal",
		label: "Mortgage Principal",
		readOnly: true,
		sampleValue: "250000",
		sourcePath: "mortgage.principal",
		type: "currency",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Mortgage rate type.",
		key: "mortgage_rate_type",
		label: "Mortgage Rate Type",
		readOnly: true,
		sampleValue: "fixed",
		sourcePath: "mortgage.rateType",
		type: "string",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Mortgage term length in months.",
		key: "mortgage_term_months",
		label: "Mortgage Term Months",
		readOnly: true,
		sampleValue: "12",
		sourcePath: "mortgage.termMonths",
		type: "integer",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Mortgage term start date.",
		key: "mortgage_term_start_date",
		label: "Mortgage Term Start Date",
		readOnly: true,
		sampleValue: "2026-06-01",
		sourcePath: "mortgage.termStartDate",
		type: "date",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Property city.",
		key: "property_city",
		label: "Property City",
		readOnly: true,
		sampleValue: "Toronto",
		sourcePath: "property.city",
		type: "string",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Property postal code.",
		key: "property_postal_code",
		label: "Property Postal Code",
		readOnly: true,
		sampleValue: "M5V 2T6",
		sourcePath: "property.postalCode",
		type: "string",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Property province.",
		key: "property_province",
		label: "Property Province",
		readOnly: true,
		sampleValue: "ON",
		sourcePath: "property.province",
		type: "string",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Street address for the mortgaged property.",
		key: "property_street_address",
		label: "Property Street Address",
		readOnly: true,
		sampleValue: "123 King St W",
		sourcePath: "property.streetAddress",
		type: "string",
	}),
	canonicalVariable({
		availability: "guaranteed",
		description: "Property type.",
		key: "property_type",
		label: "Property Type",
		readOnly: true,
		sampleValue: "detached",
		sourcePath: "property.propertyType",
		type: "string",
	}),
	canonicalVariable({
		availability: "nullable_until_lock",
		description: "Property unit or suite, when present.",
		key: "property_unit",
		label: "Property Unit",
		readOnly: true,
		sampleValue: "Unit 1201",
		sourcePath: "property.unit",
		type: "string",
	}),
	canonicalVariable({
		availability: "nullable_until_lock",
		description: "Date of the latest valuation snapshot.",
		key: "valuation_date",
		label: "Valuation Date",
		readOnly: true,
		sampleValue: "2026-04-01",
		sourcePath: "latestValuationSnapshot.valuationDate",
		type: "date",
	}),
	canonicalVariable({
		availability: "nullable_until_lock",
		description: "As-is value from the latest valuation snapshot.",
		key: "valuation_value_as_is",
		label: "Valuation Value As-Is",
		readOnly: true,
		sampleValue: "400000",
		sourcePath: "latestValuationSnapshot.valueAsIs",
		type: "currency",
	}),
] as const satisfies readonly CanonicalDocumentVariable[];

const CANONICAL_VARIABLES_BY_KEY: ReadonlyMap<
	string,
	CanonicalDocumentVariable
> = new Map(
	CANONICAL_DOCUMENT_VARIABLES.map((variable) => [variable.key, variable])
);

export interface LegacyDocumentVariableAlias {
	canonicalKey: string;
	legacyKey: string;
	removal: string;
}

export const LEGACY_DOCUMENT_VARIABLE_ALIASES = [
	{
		canonicalKey: "co_borrower_1_email",
		legacyKey: "borrower_co_1_email",
		removal: "Migrate published templates to co_borrower_1_email.",
	},
	{
		canonicalKey: "co_borrower_1_full_name",
		legacyKey: "borrower_co_1_full_name",
		removal: "Migrate published templates to co_borrower_1_full_name.",
	},
	{
		canonicalKey: "co_borrower_2_email",
		legacyKey: "borrower_co_2_email",
		removal: "Migrate published templates to co_borrower_2_email.",
	},
	{
		canonicalKey: "co_borrower_2_full_name",
		legacyKey: "borrower_co_2_full_name",
		removal: "Migrate published templates to co_borrower_2_full_name.",
	},
	{
		canonicalKey: "purchasing_lender_email",
		legacyKey: "lender_primary_email",
		removal: "Migrate published templates to purchasing_lender_email.",
	},
	{
		canonicalKey: "purchasing_lender_full_name",
		legacyKey: "lender_primary_full_name",
		removal: "Migrate published templates to purchasing_lender_full_name.",
	},
	{
		canonicalKey: "purchasing_lender_system_id",
		legacyKey: "lender_primary_system_id",
		removal: "Migrate published templates to purchasing_lender_system_id.",
	},
	{
		canonicalKey: "primary_borrower_email",
		legacyKey: "borrower_primary_email",
		removal: "Migrate published templates to primary_borrower_email.",
	},
	{
		canonicalKey: "primary_borrower_full_name",
		legacyKey: "borrower_primary_full_name",
		removal: "Migrate published templates to primary_borrower_full_name.",
	},
	{
		canonicalKey: "primary_lawyer_email",
		legacyKey: "lawyer_primary_email",
		removal: "Migrate published templates to primary_lawyer_email.",
	},
	{
		canonicalKey: "primary_lawyer_full_name",
		legacyKey: "lawyer_primary_full_name",
		removal: "Migrate published templates to primary_lawyer_full_name.",
	},
] as const satisfies readonly LegacyDocumentVariableAlias[];

const LEGACY_DOCUMENT_VARIABLE_ALIASES_BY_KEY: ReadonlyMap<
	string,
	LegacyDocumentVariableAlias
> = new Map(
	LEGACY_DOCUMENT_VARIABLE_ALIASES.map((alias) => [alias.legacyKey, alias])
);

export function isCanonicalDocumentVariableKey(key: string): boolean {
	return CANONICAL_VARIABLES_BY_KEY.has(key);
}

export function getCanonicalDocumentVariable(key: string) {
	return CANONICAL_VARIABLES_BY_KEY.get(key) ?? null;
}

export function getLegacyDocumentVariableAlias(key: string) {
	return LEGACY_DOCUMENT_VARIABLE_ALIASES_BY_KEY.get(key) ?? null;
}
