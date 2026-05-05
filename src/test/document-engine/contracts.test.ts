import { describe, expect, it } from "vitest";
import {
	MORTGAGE_DOCUMENT_SIGNATORY_ROLE_OPTIONS,
	SUPPORTED_DEAL_DOCUMENT_VARIABLE_KEYS,
} from "#/lib/document-engine/contracts";

describe("document engine canonical persona contracts", () => {
	it("surfaces canonical deal personas as new-template signatory options", () => {
		const values = MORTGAGE_DOCUMENT_SIGNATORY_ROLE_OPTIONS.map(
			(option) => option.value
		);

		expect(values).toEqual(
			expect.arrayContaining([
				"purchasing_lender",
				"selling_lender",
				"primary_borrower",
				"co_borrower_1",
				"co_borrower_2",
				"broker_of_record",
				"assigned_broker",
				"primary_lawyer",
			])
		);
		expect(values).not.toContain("lender_primary");
		expect(values).not.toContain("borrower_primary");
		expect(values).not.toContain("lawyer_primary");
	});

	it("surfaces canonical deal persona variables as new-template variable options", () => {
		expect(SUPPORTED_DEAL_DOCUMENT_VARIABLE_KEYS).toEqual(
			expect.arrayContaining([
				"purchasing_lender_email",
				"purchasing_lender_full_name",
				"selling_lender_email",
				"selling_lender_full_name",
				"primary_borrower_email",
				"primary_borrower_full_name",
				"co_borrower_1_email",
				"co_borrower_1_full_name",
				"co_borrower_2_email",
				"co_borrower_2_full_name",
				"primary_lawyer_email",
				"primary_lawyer_full_name",
			])
		);
		expect(SUPPORTED_DEAL_DOCUMENT_VARIABLE_KEYS).not.toContain(
			"lender_primary_email"
		);
		expect(SUPPORTED_DEAL_DOCUMENT_VARIABLE_KEYS).not.toContain(
			"borrower_primary_email"
		);
		expect(SUPPORTED_DEAL_DOCUMENT_VARIABLE_KEYS).not.toContain(
			"lawyer_primary_email"
		);
	});
});
