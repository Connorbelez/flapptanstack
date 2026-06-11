import { v } from "convex/values";

export const feeCodeValidator = v.union(
	v.literal("servicing"),
	v.literal("late_fee"),
	v.literal("nsf"),
	v.literal("admin_fee"),
	v.literal("custom_fee")
);

export const feeSurfaceValidator = v.union(
	v.literal("waterfall_deduction"),
	v.literal("borrower_charge")
);

export const feeBehaviorValidator = v.union(
	v.literal("borrower_one_time_charge"),
	v.literal("borrower_recurring_charge"),
	v.literal("payment_waterfall_deduction")
);

export const feeRecurrenceValidator = v.union(
	v.literal("one_time"),
	v.literal("monthly"),
	v.literal("quarterly"),
	v.literal("annual")
);

export const feeDefaultApplicationValidator = v.union(
	v.literal("platform_default"),
	v.literal("mortgage_override"),
	v.literal("mortgage_specific")
);

export const feePaymentRailValidator = v.union(
	v.literal("manual"),
	v.literal("manual_review"),
	v.literal("mock_pad"),
	v.literal("mock_eft"),
	v.literal("pad_vopay"),
	v.literal("pad_rotessa"),
	v.literal("eft_vopay"),
	v.literal("e_transfer"),
	v.literal("wire"),
	v.literal("plaid_transfer"),
	v.literal("stripe")
);

export const feeRevenueDestinationValidator = v.union(
	v.literal("platform_revenue"),
	v.literal("investor_distribution"),
	v.literal("outside_dispersal")
);

export const feeCalculationTypeValidator = v.union(
	v.literal("annual_rate_principal"),
	v.literal("fixed_amount_cents")
);

export const feeStatusValidator = v.union(
	v.literal("active"),
	v.literal("inactive")
);

export const feeAssessmentStatusValidator = v.union(
	v.literal("assessed"),
	v.literal("invoiced"),
	v.literal("partially_settled"),
	v.literal("settled"),
	v.literal("reversed")
);

export const feeAssessmentStoredStatusValidator = v.union(
	v.literal("draft"),
	v.literal("assessed"),
	v.literal("invoiced"),
	v.literal("partially_settled"),
	v.literal("settled"),
	v.literal("reversed")
);

export const feeAssessmentSourceValidator = v.union(
	v.literal("admin_manual"),
	v.literal("bulk_apply"),
	v.literal("origination_default"),
	v.literal("velocity_default"),
	v.literal("late_fee_rule"),
	v.literal("recurring_fee_schedule"),
	v.literal("payment_waterfall")
);

export const feeCalculationParametersValidator = v.object({
	annualRate: v.optional(v.number()),
	fixedAmountCents: v.optional(v.number()),
	dueDays: v.optional(v.number()),
	graceDays: v.optional(v.number()),
});
