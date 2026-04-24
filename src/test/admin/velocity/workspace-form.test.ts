import { describe, expect, it } from "vitest";
import {
	buildFairLendFieldsPatch,
	buildInitialForm,
	type FairLendFormState,
} from "#/components/admin/velocity/VelocityWorkspaceForm";

function baseForm(overrides: Partial<FairLendFormState> = {}): FairLendFormState {
	return {
		accountHolderName: "Borrower One",
		accountNumber: "123456789",
		institutionNumber: "001",
		lienPosition: "2",
		listingAdminNotes: "internal note",
		listingDescription: "Listing description",
		listingMarketplaceCopy: "Marketplace copy",
		listingSeoSlug: "velocity-123",
		listingTitle: "Velocity package",
		loanType: "insured",
		remediationNotes: "Ready",
		staffNotes: "Staff note",
		transitNumber: "00011",
		valuationDate: "2026-04-24",
		valueAsIs: "500000",
		...overrides,
	};
}

describe("Velocity workspace FairLend form", () => {
	it("builds the save patch with numeric FairLend fields preserved", () => {
		const result = buildFairLendFieldsPatch(baseForm());

		expect(result).toMatchObject({
			ok: true,
			patch: {
				activationRemediation: {
					lienPosition: 2,
					loanType: "insured",
					notes: "Ready",
				},
				bankInput: {
					accountHolderName: "Borrower One",
					accountNumber: "123456789",
					country: "CA",
					currency: "CAD",
					institutionNumber: "001",
					transitNumber: "00011",
				},
				valuation: {
					valuationDate: "2026-04-24",
					valueAsIs: 500_000,
				},
			},
		});
	});

	it("uses explicit nulls when optional FairLend-owned fields are cleared", () => {
		const result = buildFairLendFieldsPatch(
			baseForm({
				lienPosition: "",
				loanType: "none",
				valueAsIs: " ",
			})
		);

		expect(result).toMatchObject({
			ok: true,
			patch: {
				activationRemediation: {
					lienPosition: null,
					loanType: null,
				},
				valuation: {
					valueAsIs: null,
				},
			},
		});
	});

	it("blocks invalid numeric input instead of omitting it", () => {
		const lienResult = buildFairLendFieldsPatch(
			baseForm({ lienPosition: "first" })
		);
		const valueResult = buildFairLendFieldsPatch(
			baseForm({ valueAsIs: "not money" })
		);

		expect(lienResult).toEqual({
			message: "Lien position must be a valid number.",
			ok: false,
		});
		expect(valueResult).toEqual({
			message: "Value as-is must be a valid number.",
			ok: false,
		});
	});

	it("hydrates cleared optional values as blank form controls", () => {
		expect(buildInitialForm(null)).toMatchObject({
			lienPosition: "",
			loanType: "none",
			valueAsIs: "",
		});
	});
});
