import { describe, expect, it } from "vitest";
import {
	assertBehaviorMatchesDefinition,
	calculateFeeAmountCents,
	formatFeeValue,
} from "../behavior";

describe("fee behavior model", () => {
	it("accepts a named waterfall deduction percentage fee", () => {
		expect(() =>
			assertBehaviorMatchesDefinition({
				behavior: "payment_waterfall_deduction",
				calculationType: "annual_rate_principal",
				parameters: { annualRate: 0.0125 },
				paymentRail: undefined,
				recurrence: undefined,
				surface: "waterfall_deduction",
			})
		).not.toThrow();
	});

	it("rejects borrower-only metadata on waterfall deductions", () => {
		expect(() =>
			assertBehaviorMatchesDefinition({
				behavior: "payment_waterfall_deduction",
				calculationType: "annual_rate_principal",
				parameters: { annualRate: 0.0125 },
				paymentRail: "manual",
				recurrence: undefined,
				surface: "waterfall_deduction",
			})
		).toThrow("payment waterfall deduction fees cannot define paymentRail");

		expect(() =>
			assertBehaviorMatchesDefinition({
				behavior: "payment_waterfall_deduction",
				calculationType: "annual_rate_principal",
				parameters: { annualRate: 0.0125 },
				paymentRail: undefined,
				recurrence: "monthly",
				surface: "waterfall_deduction",
			})
		).toThrow("payment waterfall deduction fees cannot define recurrence");
	});

	it("requires a payment rail for borrower one-time charges", () => {
		expect(() =>
			assertBehaviorMatchesDefinition({
				behavior: "borrower_one_time_charge",
				calculationType: "fixed_amount_cents",
				parameters: { fixedAmountCents: 2500, dueDays: 10, graceDays: 15 },
				paymentRail: undefined,
				recurrence: undefined,
				surface: "borrower_charge",
			})
		).toThrow("borrower payable fees require paymentRail");
	});

	it("requires fixed amount calculations for borrower payable fees", () => {
		expect(() =>
			assertBehaviorMatchesDefinition({
				behavior: "borrower_one_time_charge",
				calculationType: "annual_rate_principal",
				parameters: { annualRate: 0.01 },
				paymentRail: "manual",
				recurrence: "one_time",
				surface: "borrower_charge",
			})
		).toThrow(
			"borrower payable fees require fixed_amount_cents calculationType"
		);
	});

	it("rejects behavior and definition mismatches", () => {
		expect(() =>
			assertBehaviorMatchesDefinition({
				behavior: "payment_waterfall_deduction",
				calculationType: "annual_rate_principal",
				parameters: { annualRate: 0.01 },
				surface: "borrower_charge",
			})
		).toThrow(
			"payment waterfall deduction fees require waterfall_deduction surface"
		);

		expect(() =>
			assertBehaviorMatchesDefinition({
				behavior: "payment_waterfall_deduction",
				calculationType: "fixed_amount_cents",
				parameters: { fixedAmountCents: 5000 },
				surface: "waterfall_deduction",
			})
		).toThrow(
			"payment waterfall deduction fees require annual_rate_principal calculationType"
		);

		expect(() =>
			assertBehaviorMatchesDefinition({
				behavior: "borrower_recurring_charge",
				calculationType: "fixed_amount_cents",
				parameters: { fixedAmountCents: 5000 },
				paymentRail: "manual",
				recurrence: "one_time",
				surface: "borrower_charge",
			})
		).toThrow("borrower recurring fees require recurring recurrence");
	});

	it("formats the fee value visible in admin lists", () => {
		expect(
			formatFeeValue({
				calculationType: "annual_rate_principal",
				parameters: { annualRate: 0.01 },
				recurrence: undefined,
			})
		).toBe("1.00% annually");

		expect(
			formatFeeValue({
				calculationType: "fixed_amount_cents",
				parameters: { fixedAmountCents: 5000 },
				recurrence: "one_time",
			})
		).toBe("$50.00 one time");
	});

	it("requires calculation parameters before formatting or calculating", () => {
		expect(() =>
			formatFeeValue({
				calculationType: "annual_rate_principal",
				parameters: {},
			})
		).toThrow("fee parameter annualRate is required");

		expect(() =>
			calculateFeeAmountCents({
				calculationType: "fixed_amount_cents",
				parameters: {},
			})
		).toThrow("fee parameter fixedAmountCents is required");

		expect(() =>
			calculateFeeAmountCents({
				calculationType: "annual_rate_principal",
				parameters: { annualRate: 0.01 },
			})
		).toThrow("fee parameter principalCents is required");
	});

	it("calculates a waterfall deduction against principal and frequency", () => {
		expect(
			calculateFeeAmountCents({
				calculationType: "annual_rate_principal",
				parameters: { annualRate: 0.01 },
				principalCents: 120_000_000,
				paymentFrequency: "monthly",
			})
		).toBe(100_000);
	});

	it("supports internal and plan spelling for bi-weekly annual-rate fees", () => {
		const input = {
			calculationType: "annual_rate_principal" as const,
			parameters: { annualRate: 0.013 },
			principalCents: 200_000_000,
		};

		expect(
			calculateFeeAmountCents({ ...input, paymentFrequency: "bi_weekly" })
		).toBe(100_000);
		expect(
			calculateFeeAmountCents({ ...input, paymentFrequency: "bi-weekly" })
		).toBe(100_000);
	});

	it("calculates annual-rate fees for weekly and default monthly frequencies", () => {
		const input = {
			calculationType: "annual_rate_principal" as const,
			parameters: { annualRate: 0.012 },
			principalCents: 100_000_000,
		};

		expect(calculateFeeAmountCents(input)).toBe(100_000);
		expect(
			calculateFeeAmountCents({ ...input, paymentFrequency: "weekly" })
		).toBe(23_077);
		expect(
			calculateFeeAmountCents({
				...input,
				paymentFrequency: "accelerated_bi_weekly",
			})
		).toBe(46_154);
	});
});
