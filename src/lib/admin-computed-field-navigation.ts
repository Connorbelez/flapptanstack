import type { Doc } from "../../convex/_generated/dataModel";
import type { UnifiedRecord } from "../../convex/crm/types";
import type { AdminRelationNavigationTarget } from "./admin-relation-navigation";

type ObjectDefRow = Pick<Doc<"objectDefs">, "_id" | "nativeTable">;

const COMPUTED_FIELD_NAVIGATION_RULES = [
	{
		fieldName: "propertySummary",
		sourceFieldName: "propertyId",
		sourceNativeTables: ["mortgages", "listings"],
		targetNativeTable: "properties",
	},
	{
		fieldName: "mortgageSummary",
		sourceFieldName: "mortgageId",
		sourceNativeTables: ["listings", "obligations", "deals"],
		targetNativeTable: "mortgages",
	},
	{
		fieldName: "borrowerSummary",
		sourceFieldName: "borrowerId",
		sourceNativeTables: ["obligations", "deals"],
		targetNativeTable: "borrowers",
	},
	{
		fieldName: "lenderSummary",
		sourceFieldName: "lenderId",
		sourceNativeTables: ["deals"],
		targetNativeTable: "lenders",
	},
	{
		fieldName: "brokerSummary",
		sourceFieldName: "brokerId",
		sourceNativeTables: ["deals"],
		targetNativeTable: "brokers",
	},
] as const;

function findObjectDefIdForNativeTable(
	objectDefs: readonly ObjectDefRow[] | undefined,
	nativeTable: string
): string | undefined {
	const match = objectDefs?.find((row) => row.nativeTable === nativeTable);
	return match ? String(match._id) : undefined;
}

function nonEmptyId(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

/**
 * Maps hydrated "computed" summary fields on native admin rows to a CRM peer
 * record the user can open (property, mortgage, borrower).
 */
export function resolveAdminComputedFieldNavigationTarget(args: {
	fieldName: string;
	objectDefs: readonly ObjectDefRow[] | undefined;
	record: Pick<UnifiedRecord, "_kind" | "nativeTable"> & {
		fields: Record<string, unknown>;
	};
}): AdminRelationNavigationTarget | null {
	if (args.record._kind !== "native" || !args.record.nativeTable) {
		return null;
	}

	const { fields, nativeTable } = args.record;
	const { fieldName } = args;
	const rule = COMPUTED_FIELD_NAVIGATION_RULES.find(
		(candidate) =>
			candidate.fieldName === fieldName &&
			candidate.sourceNativeTables.some(
				(sourceNativeTable) => sourceNativeTable === nativeTable
			)
	);
	const sourceValue = rule ? fields[rule.sourceFieldName] : undefined;
	const foreignId = nonEmptyId(sourceValue) ? sourceValue : undefined;

	if (!(rule && foreignId)) {
		return null;
	}

	const objectDefId = findObjectDefIdForNativeTable(
		args.objectDefs,
		rule.targetNativeTable
	);
	if (!objectDefId) {
		return null;
	}

	return {
		objectDefId,
		recordId: foreignId,
		recordKind: "native",
	};
}
