import type { GenericDatabaseWriter } from "convex/server";
import type { DataModel, Doc } from "../_generated/dataModel";

export type CompatibleFeeTemplate = Omit<
	Doc<"feeTemplates">,
	"behavior" | "displayCode" | "paymentRail" | "recurrence"
> & {
	behavior: NonNullable<Doc<"feeTemplates">["behavior"]>;
	displayCode: string;
	paymentRail?: NonNullable<Doc<"feeTemplates">["paymentRail"]>;
	recurrence?: NonNullable<Doc<"feeTemplates">["recurrence"]>;
};

type FeeTemplatePatch = Partial<
	Pick<
		CompatibleFeeTemplate,
		"behavior" | "displayCode" | "paymentRail" | "recurrence"
	>
> & { updatedAt: number };

export function normalizeFeeTemplate(
	template: Doc<"feeTemplates">
): CompatibleFeeTemplate {
	const behavior = template.behavior ?? inferLegacyFeeBehavior(template);
	const displayCode = template.displayCode ?? template.code;
	const paymentRail =
		template.paymentRail ??
		(behavior === "payment_waterfall_deduction" ? undefined : "manual");
	const recurrence =
		template.recurrence ??
		(behavior === "borrower_one_time_charge" ? "one_time" : undefined);

	return {
		...template,
		behavior,
		displayCode,
		paymentRail,
		recurrence,
	};
}

export async function repairFeeTemplateIfNeeded(
	db: GenericDatabaseWriter<DataModel>,
	template: Doc<"feeTemplates">
): Promise<CompatibleFeeTemplate> {
	const normalized = normalizeFeeTemplate(template);
	const patch: FeeTemplatePatch = { updatedAt: Date.now() };

	if (template.behavior === undefined) {
		patch.behavior = normalized.behavior;
	}
	if (template.displayCode === undefined) {
		patch.displayCode = normalized.displayCode;
	}
	if (
		template.paymentRail === undefined &&
		normalized.paymentRail !== undefined
	) {
		patch.paymentRail = normalized.paymentRail;
	}
	if (
		template.recurrence === undefined &&
		normalized.recurrence !== undefined
	) {
		patch.recurrence = normalized.recurrence;
	}

	if (Object.keys(patch).length > 1) {
		await db.patch(template._id, patch);
	}

	return normalized;
}

function inferLegacyFeeBehavior(
	template: Doc<"feeTemplates">
): CompatibleFeeTemplate["behavior"] {
	if (
		template.surface === "waterfall_deduction" ||
		template.code === "servicing"
	) {
		return "payment_waterfall_deduction";
	}

	if (template.recurrence !== undefined && template.recurrence !== "one_time") {
		return "borrower_recurring_charge";
	}

	return "borrower_one_time_charge";
}
