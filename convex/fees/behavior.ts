import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";

export type FeeBehavior = NonNullable<Doc<"feeTemplates">["behavior"]>;
export type FeeRecurrence = Doc<"feeTemplates">["recurrence"];
export type FeeParameters = Doc<"feeTemplates">["parameters"];

type FeeCalculationType = Doc<"feeTemplates">["calculationType"];
type FeeSurface = Doc<"feeTemplates">["surface"];
type FeePaymentRail = Doc<"feeTemplates">["paymentRail"];
type PaymentFrequency = Doc<"mortgages">["paymentFrequency"] | "bi-weekly";

export interface BehaviorDefinitionInput {
	behavior: FeeBehavior;
	calculationType: FeeCalculationType;
	parameters: FeeParameters;
	paymentRail?: FeePaymentRail;
	recurrence?: FeeRecurrence;
	surface: FeeSurface;
}

export function assertBehaviorMatchesDefinition(
	input: BehaviorDefinitionInput
): void {
	if (
		input.behavior === "payment_waterfall_deduction" &&
		input.surface !== "waterfall_deduction"
	) {
		throw new ConvexError(
			"payment waterfall deduction fees require waterfall_deduction surface"
		);
	}

	if (
		input.behavior !== "payment_waterfall_deduction" &&
		input.surface !== "borrower_charge"
	) {
		throw new ConvexError(
			"borrower payable fees require borrower_charge surface"
		);
	}

	if (
		input.behavior === "payment_waterfall_deduction" &&
		input.calculationType !== "annual_rate_principal"
	) {
		throw new ConvexError(
			"payment waterfall deduction fees require annual_rate_principal calculationType"
		);
	}

	if (
		input.behavior === "payment_waterfall_deduction" &&
		input.paymentRail !== undefined
	) {
		throw new ConvexError(
			"payment waterfall deduction fees cannot define paymentRail"
		);
	}

	if (
		input.behavior === "payment_waterfall_deduction" &&
		input.recurrence !== undefined
	) {
		throw new ConvexError(
			"payment waterfall deduction fees cannot define recurrence"
		);
	}

	if (input.behavior !== "payment_waterfall_deduction" && !input.paymentRail) {
		throw new ConvexError("borrower payable fees require paymentRail");
	}

	if (
		input.behavior !== "payment_waterfall_deduction" &&
		input.calculationType !== "fixed_amount_cents"
	) {
		throw new ConvexError(
			"borrower payable fees require fixed_amount_cents calculationType"
		);
	}

	if (
		input.behavior === "borrower_one_time_charge" &&
		input.recurrence !== "one_time"
	) {
		throw new ConvexError("borrower one-time fees require one_time recurrence");
	}

	if (
		input.behavior === "borrower_recurring_charge" &&
		(!input.recurrence || input.recurrence === "one_time")
	) {
		throw new ConvexError(
			"borrower recurring fees require recurring recurrence"
		);
	}
}

export function formatFeeValue(input: {
	calculationType: FeeCalculationType;
	parameters: FeeParameters;
	recurrence?: FeeRecurrence;
}): string {
	if (input.calculationType === "annual_rate_principal") {
		const annualRate = requireNumberParameter(
			input.parameters.annualRate,
			"annualRate"
		);
		return `${(annualRate * 100).toFixed(2)}% annually`;
	}

	const amount = formatUsdCents(
		requireNumberParameter(
			input.parameters.fixedAmountCents,
			"fixedAmountCents"
		)
	);
	const suffix = formatRecurrenceSuffix(input.recurrence);

	return suffix ? `${amount} ${suffix}` : amount;
}

export function calculateFeeAmountCents(input: {
	calculationType: FeeCalculationType;
	parameters: FeeParameters;
	principalCents?: number;
	paymentFrequency?: PaymentFrequency;
}): number {
	if (input.calculationType === "fixed_amount_cents") {
		return requireNumberParameter(
			input.parameters.fixedAmountCents,
			"fixedAmountCents"
		);
	}

	const annualRate = requireNumberParameter(
		input.parameters.annualRate,
		"annualRate"
	);
	const principalCents = requireNumberParameter(
		input.principalCents,
		"principalCents"
	);
	const periodsPerYear = getAnnualRatePeriods(input.paymentFrequency);

	return Math.round((principalCents * annualRate) / periodsPerYear);
}

function requireNumberParameter(
	value: number | undefined,
	name: keyof FeeParameters | "principalCents"
): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new ConvexError(`fee parameter ${name} is required`);
	}

	return value;
}

function formatUsdCents(amountCents: number): string {
	return new Intl.NumberFormat("en-US", {
		currency: "USD",
		style: "currency",
	}).format(amountCents / 100);
}

function formatRecurrenceSuffix(recurrence: FeeRecurrence): string | undefined {
	switch (recurrence) {
		case "monthly":
			return "monthly";
		case "quarterly":
			return "quarterly";
		case "annual":
			return "annually";
		case "one_time":
			return "one time";
		default:
			return undefined;
	}
}

function getAnnualRatePeriods(paymentFrequency?: PaymentFrequency): number {
	switch (paymentFrequency) {
		case "weekly":
			return 52;
		case "bi_weekly":
		case "bi-weekly":
		case "accelerated_bi_weekly":
			return 26;
		case "monthly":
		case undefined:
			return 12;
		default:
			return 12;
	}
}
