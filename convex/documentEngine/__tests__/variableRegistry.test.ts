import { describe, expect, it } from "vitest";
import {
	CANONICAL_DOCUMENT_VARIABLES,
	getCanonicalDocumentVariable,
	getLegacyDocumentVariableAlias,
	isCanonicalDocumentVariableKey,
} from "../variableRegistry";

describe("canonical document variable registry", () => {
	it("includes canonical deal persona variables for lenders, lawyer, fraction, and investment values", () => {
		expect(isCanonicalDocumentVariableKey("purchasing_lender_full_name")).toBe(
			true
		);
		expect(isCanonicalDocumentVariableKey("purchasing_lender_email")).toBe(
			true
		);
		expect(isCanonicalDocumentVariableKey("purchasing_lender_system_id")).toBe(
			true
		);
		expect(isCanonicalDocumentVariableKey("selling_lender_full_name")).toBe(
			true
		);
		expect(isCanonicalDocumentVariableKey("selling_lender_email")).toBe(true);
		expect(isCanonicalDocumentVariableKey("primary_lawyer_full_name")).toBe(
			true
		);
		expect(isCanonicalDocumentVariableKey("primary_lawyer_email")).toBe(true);
		expect(isCanonicalDocumentVariableKey("deal_selected_fraction_units")).toBe(
			true
		);
		expect(isCanonicalDocumentVariableKey("deal_investment_amount")).toBe(true);
	});

	it("includes the mortgage attachment variable surface as canonical variables", () => {
		const expectedMortgageAttachmentKeys = [
			"assigned_broker_email",
			"assigned_broker_full_name",
			"co_borrower_1_email",
			"co_borrower_1_full_name",
			"co_borrower_2_email",
			"co_borrower_2_full_name",
			"primary_borrower_email",
			"primary_borrower_full_name",
			"broker_of_record_email",
			"broker_of_record_full_name",
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
			"property_city",
			"property_postal_code",
			"property_province",
			"property_street_address",
			"property_type",
			"property_unit",
			"valuation_date",
			"valuation_value_as_is",
		];

		for (const key of expectedMortgageAttachmentKeys) {
			expect(isCanonicalDocumentVariableKey(key), key).toBe(true);
		}
	});

	it("marks canonical variables read-only with source paths and availability", () => {
		const variable = getCanonicalDocumentVariable("deal_investment_amount");

		expect(variable).toMatchObject({
			availability: "computed_at_lock",
			key: "deal_investment_amount",
			readOnly: true,
			sourcePath: "deal.fractionalShare * mortgage.principal",
			type: "currency",
		});
	});

	it("keeps legacy broad variables as explicit aliases, not canonical authoring variables", () => {
		expect(isCanonicalDocumentVariableKey("lender_primary_email")).toBe(false);
		expect(isCanonicalDocumentVariableKey("borrower_co_1_email")).toBe(false);
		expect(isCanonicalDocumentVariableKey("borrower_primary_email")).toBe(
			false
		);
		expect(isCanonicalDocumentVariableKey("lawyer_primary_email")).toBe(false);

		expect(getLegacyDocumentVariableAlias("lender_primary_email")).toEqual({
			canonicalKey: "purchasing_lender_email",
			legacyKey: "lender_primary_email",
			removal: "Migrate published templates to purchasing_lender_email.",
		});
		expect(getLegacyDocumentVariableAlias("borrower_primary_email")).toEqual({
			canonicalKey: "primary_borrower_email",
			legacyKey: "borrower_primary_email",
			removal: "Migrate published templates to primary_borrower_email.",
		});
		expect(getLegacyDocumentVariableAlias("lawyer_primary_email")).toEqual({
			canonicalKey: "primary_lawyer_email",
			legacyKey: "lawyer_primary_email",
			removal: "Migrate published templates to primary_lawyer_email.",
		});
		expect(getLegacyDocumentVariableAlias("borrower_co_1_email")).toEqual({
			canonicalKey: "co_borrower_1_email",
			legacyKey: "borrower_co_1_email",
			removal: "Migrate published templates to co_borrower_1_email.",
		});
	});

	it("does not duplicate canonical keys", () => {
		const keys = CANONICAL_DOCUMENT_VARIABLES.map((variable) => variable.key);

		expect(new Set(keys).size).toBe(keys.length);
	});
});
