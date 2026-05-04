import { describe, expect, it } from "vitest";
import {
	CANONICAL_DOCUMENT_VARIABLES,
	getCanonicalDocumentVariable,
	isCanonicalDocumentVariableKey,
} from "../variableRegistry";

describe("canonical document variable registry", () => {
	it("includes deal-lock lender, lawyer, fraction, and investment variables", () => {
		expect(isCanonicalDocumentVariableKey("lender_primary_full_name")).toBe(
			true
		);
		expect(isCanonicalDocumentVariableKey("lender_primary_email")).toBe(true);
		expect(isCanonicalDocumentVariableKey("lender_primary_system_id")).toBe(
			true
		);
		expect(isCanonicalDocumentVariableKey("lawyer_primary_full_name")).toBe(
			true
		);
		expect(isCanonicalDocumentVariableKey("lawyer_primary_email")).toBe(true);
		expect(isCanonicalDocumentVariableKey("deal_selected_fraction_units")).toBe(
			true
		);
		expect(isCanonicalDocumentVariableKey("deal_investment_amount")).toBe(true);
	});

	it("includes the mortgage attachment variable surface as canonical variables", () => {
		const expectedMortgageAttachmentKeys = [
			"assigned_broker_email",
			"assigned_broker_full_name",
			"borrower_co_1_email",
			"borrower_co_1_full_name",
			"borrower_co_2_email",
			"borrower_co_2_full_name",
			"borrower_primary_email",
			"borrower_primary_full_name",
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

	it("does not duplicate canonical keys", () => {
		const keys = CANONICAL_DOCUMENT_VARIABLES.map((variable) => variable.key);

		expect(new Set(keys).size).toBe(keys.length);
	});
});
