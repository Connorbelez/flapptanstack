import { v } from "convex/values";

export const paymentScheduleReplacementStatusValidator = v.union(
	v.literal("draft"),
	v.literal("ready"),
	v.literal("activating"),
	v.literal("activated"),
	v.literal("activation_failed"),
	v.literal("cancelled")
);

export const paymentScheduleReplacementRailValidator = v.union(
	v.literal("app_managed_manual"),
	v.literal("provider_managed_rotessa")
);

export const paymentScheduleReplacementFrequencyValidator = v.union(
	v.literal("monthly"),
	v.literal("bi_weekly"),
	v.literal("accelerated_bi_weekly"),
	v.literal("weekly")
);

export const paymentScheduleReplacementValidationCodeValidator = v.union(
	v.literal("mortgage_not_found"),
	v.literal("deadline_elapsed"),
	v.literal("invalid_start_date"),
	v.literal("invalid_frequency"),
	v.literal("invalid_interest_amount"),
	v.literal("insufficient_cadence_slots"),
	v.literal("unsafe_existing_execution_state"),
	v.literal("stale_draft"),
	v.literal("provider_bank_account_required"),
	v.literal("provider_pad_required"),
	v.literal("provider_interest_required"),
	v.literal("provider_uniform_interest_amount_required"),
	v.literal("provider_date_overrides_not_allowed"),
	v.literal("date_override_out_of_order"),
	v.literal("date_override_after_deadline"),
	v.literal("already_activated")
);

export const paymentScheduleReplacementValidationIssueValidator = v.object({
	code: paymentScheduleReplacementValidationCodeValidator,
	message: v.string(),
	rowKey: v.optional(v.string()),
});

export const paymentScheduleReplacementSliderBoundsValidator = v.object({
	maxInterestRows: v.number(),
	minInterestPaymentAmount: v.number(),
	maxInterestPaymentAmount: v.number(),
	step: v.number(),
});

export const scheduleReplacementPreviewRowKindValidator = v.union(
	v.literal("historical_settled"),
	v.literal("archived_candidate"),
	v.literal("replacement_interest"),
	v.literal("replacement_principal")
);

export const scheduleReplacementPreviewRowValidator = v.object({
	amount: v.number(),
	collectionPlanEntryId: v.optional(v.id("collectionPlanEntries")),
	dueDate: v.number(),
	editableDate: v.boolean(),
	executionMode: v.union(v.literal("app_owned"), v.literal("provider_managed")),
	externalCollectionScheduleId: v.optional(v.id("externalCollectionSchedules")),
	kind: scheduleReplacementPreviewRowKindValidator,
	obligationId: v.optional(v.id("obligations")),
	obligationType: v.union(
		v.literal("regular_interest"),
		v.literal("principal_repayment")
	),
	paymentNumber: v.number(),
	rowKey: v.string(),
	scheduledDate: v.number(),
	status: v.union(
		v.literal("context"),
		v.literal("will_archive"),
		v.literal("generated")
	),
});

export const paymentScheduleReplacementDateOverrideValidator = v.object({
	dueDate: v.number(),
	rowKey: v.string(),
	scheduledDate: v.number(),
});

export const scheduleReplacementDraftResultValidator = v.object({
	draftId: v.id("paymentScheduleReplacementDrafts"),
	issues: v.array(paymentScheduleReplacementValidationIssueValidator),
	status: paymentScheduleReplacementStatusValidator,
});
