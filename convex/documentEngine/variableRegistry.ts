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

export const CANONICAL_DOCUMENT_VARIABLES = [
	{
		availability: "guaranteed",
		description: "Full principal amount on the mortgage record.",
		key: "mortgage_principal",
		label: "Mortgage Principal",
		readOnly: true,
		sampleValue: "250000",
		sourcePath: "mortgage.principal",
		type: "currency",
	},
	{
		availability: "guaranteed",
		description: "Name of the lender who locked the listing.",
		key: "lender_primary_full_name",
		label: "Primary Lender Full Name",
		readOnly: true,
		sampleValue: "Avery Chen",
		sourcePath: "deal.participants.buyer.displayName",
		type: "string",
	},
	{
		availability: "guaranteed",
		description: "Internal user id for the lender who locked the listing.",
		key: "lender_primary_system_id",
		label: "Primary Lender System ID",
		readOnly: true,
		sampleValue: "user_01KLOCKEDLENDER",
		sourcePath: "deal.participants.buyer.userId",
		type: "string",
	},
	{
		availability: "nullable_until_lock",
		description: "Selected lawyer for the locked deal.",
		key: "lawyer_primary_full_name",
		label: "Primary Lawyer Full Name",
		readOnly: true,
		sampleValue: "Morgan Patel",
		sourcePath: "deal.participants.lawyer.displayName",
		type: "string",
	},
	{
		availability: "guaranteed",
		description: "The lender selected fraction units stored on the deal.",
		key: "deal_selected_fraction_units",
		label: "Selected Fraction Units",
		readOnly: true,
		sampleValue: "2500",
		sourcePath: "deal.fractionalShare",
		type: "integer",
	},
	{
		availability: "computed_at_lock",
		description:
			"Amount this lender is investing, computed from selected fractions and mortgage principal.",
		key: "deal_investment_amount",
		label: "Deal Investment Amount",
		readOnly: true,
		sampleValue: "62500",
		sourcePath: "deal.fractionalShare * mortgage.principal",
		type: "currency",
	},
] as const satisfies readonly CanonicalDocumentVariable[];

const CANONICAL_VARIABLES_BY_KEY: ReadonlyMap<
	string,
	CanonicalDocumentVariable
> = new Map(
	CANONICAL_DOCUMENT_VARIABLES.map((variable) => [variable.key, variable])
);

export function isCanonicalDocumentVariableKey(
	key: string
): key is (typeof CANONICAL_DOCUMENT_VARIABLES)[number]["key"] {
	return CANONICAL_VARIABLES_BY_KEY.has(key);
}

export function getCanonicalDocumentVariable(key: string) {
	return CANONICAL_VARIABLES_BY_KEY.get(key) ?? null;
}
