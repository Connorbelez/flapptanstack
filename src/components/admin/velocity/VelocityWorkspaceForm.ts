import type { FunctionArgs } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import type { VelocityWorkspaceDetail } from "./types";

export type LoanType = "conventional" | "high_ratio" | "insured";
export type LoanTypeSelectValue = LoanType | "none";

export interface FairLendFormState {
	accountHolderName: string;
	accountNumber: string;
	institutionNumber: string;
	lienPosition: string;
	listingAdminNotes: string;
	listingDescription: string;
	listingMarketplaceCopy: string;
	listingSeoSlug: string;
	listingTitle: string;
	loanType: LoanTypeSelectValue;
	remediationNotes: string;
	staffNotes: string;
	transitNumber: string;
	valuationDate: string;
	valueAsIs: string;
}

type FairLendFieldsPatch = FunctionArgs<
	typeof api.velocity.workspaces.updateVelocityPackageFairLendFields
>["patch"];

export type FairLendFieldsPatchResult =
	| { readonly ok: true; readonly patch: FairLendFieldsPatch }
	| { readonly message: string; readonly ok: false };

type OptionalNumberInputResult =
	| { readonly kind: "clear" }
	| { readonly kind: "invalid"; readonly message: string }
	| { readonly kind: "value"; readonly value: number };

export function buildInitialForm(
	workspace: VelocityWorkspaceDetail | undefined | null
): FairLendFormState {
	const enrichment = workspace?.fairlendOwned.enrichment;
	const remediation = enrichment?.activationRemediation;
	return {
		accountHolderName: enrichment?.bankInput?.accountHolderName ?? "",
		accountNumber: enrichment?.bankInput?.accountNumber ?? "",
		institutionNumber: enrichment?.bankInput?.institutionNumber ?? "",
		lienPosition:
			remediation?.lienPosition == null ? "" : String(remediation.lienPosition),
		listingAdminNotes: enrichment?.listingOverrides?.adminNotes ?? "",
		listingDescription: enrichment?.listingOverrides?.description ?? "",
		listingMarketplaceCopy: enrichment?.listingOverrides?.marketplaceCopy ?? "",
		listingSeoSlug: enrichment?.listingOverrides?.seoSlug ?? "",
		listingTitle: enrichment?.listingOverrides?.title ?? "",
		loanType: remediation?.loanType ?? "none",
		remediationNotes: remediation?.notes ?? "",
		staffNotes: enrichment?.staffNotes ?? "",
		transitNumber: enrichment?.bankInput?.transitNumber ?? "",
		valuationDate: enrichment?.valuation?.valuationDate ?? "",
		valueAsIs:
			enrichment?.valuation?.valueAsIs == null
				? ""
				: String(enrichment.valuation.valueAsIs),
	};
}

function parseOptionalNumberInput(
	value: string,
	label: string
): OptionalNumberInputResult {
	const trimmed = value.trim();
	if (!trimmed) {
		return { kind: "clear" };
	}

	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed)) {
		return {
			kind: "invalid",
			message: `${label} must be a valid number.`,
		};
	}

	return { kind: "value", value: parsed };
}

export function buildFairLendFieldsPatch(
	form: FairLendFormState
): FairLendFieldsPatchResult {
	const lienPosition = parseOptionalNumberInput(
		form.lienPosition,
		"Lien position"
	);
	if (lienPosition.kind === "invalid") {
		return { message: lienPosition.message, ok: false };
	}

	const valueAsIs = parseOptionalNumberInput(form.valueAsIs, "Value as-is");
	if (valueAsIs.kind === "invalid") {
		return { message: valueAsIs.message, ok: false };
	}

	return {
		ok: true,
		patch: {
			activationRemediation: {
				lienPosition: lienPosition.kind === "clear" ? null : lienPosition.value,
				loanType: form.loanType === "none" ? null : form.loanType,
				notes: form.remediationNotes,
			},
			bankInput: {
				accountHolderName: form.accountHolderName,
				accountNumber: form.accountNumber,
				country: "CA",
				currency: "CAD",
				institutionNumber: form.institutionNumber,
				transitNumber: form.transitNumber,
			},
			listingOverrides: {
				adminNotes: form.listingAdminNotes,
				description: form.listingDescription,
				marketplaceCopy: form.listingMarketplaceCopy,
				seoSlug: form.listingSeoSlug,
				title: form.listingTitle,
			},
			staffNotes: form.staffNotes,
			valuation: {
				valuationDate: form.valuationDate,
				valueAsIs: valueAsIs.kind === "clear" ? null : valueAsIs.value,
			},
		},
	};
}
