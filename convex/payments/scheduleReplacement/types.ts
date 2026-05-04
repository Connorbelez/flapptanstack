import type { Id } from "../../_generated/dataModel";

export const PAYMENT_SCHEDULE_REPLACEMENT_STATUSES = [
	"draft",
	"ready",
	"activating",
	"activated",
	"activation_failed",
	"cancelled",
] as const;

export type PaymentScheduleReplacementStatus =
	(typeof PAYMENT_SCHEDULE_REPLACEMENT_STATUSES)[number];

export const PAYMENT_SCHEDULE_REPLACEMENT_RAILS = [
	"app_managed_manual",
	"provider_managed_rotessa",
] as const;

export type PaymentScheduleReplacementRail =
	(typeof PAYMENT_SCHEDULE_REPLACEMENT_RAILS)[number];

export const PAYMENT_SCHEDULE_REPLACEMENT_FREQUENCIES = [
	"monthly",
	"bi_weekly",
	"accelerated_bi_weekly",
	"weekly",
] as const;

export type PaymentScheduleReplacementFrequency =
	(typeof PAYMENT_SCHEDULE_REPLACEMENT_FREQUENCIES)[number];

export const PAYMENT_SCHEDULE_REPLACEMENT_VALIDATION_CODES = [
	"mortgage_not_found",
	"deadline_elapsed",
	"invalid_start_date",
	"invalid_frequency",
	"invalid_interest_amount",
	"insufficient_cadence_slots",
	"unsafe_existing_execution_state",
	"stale_draft",
	"provider_bank_account_required",
	"provider_pad_required",
	"provider_interest_required",
	"provider_uniform_interest_amount_required",
	"provider_date_overrides_not_allowed",
	"date_override_out_of_order",
	"date_override_after_deadline",
	"already_activated",
] as const;

export type PaymentScheduleReplacementValidationCode =
	(typeof PAYMENT_SCHEDULE_REPLACEMENT_VALIDATION_CODES)[number];

export interface PaymentScheduleReplacementValidationIssue {
	code: PaymentScheduleReplacementValidationCode;
	message: string;
	rowKey?: string;
}

export interface PaymentScheduleReplacementSliderBounds {
	maxInterestPaymentAmount: number;
	maxInterestRows: number;
	minInterestPaymentAmount: number;
	step: number;
}

export type ScheduleReplacementPreviewRowKind =
	| "historical_settled"
	| "archived_candidate"
	| "replacement_interest"
	| "replacement_principal";

export interface ScheduleReplacementPreviewRow {
	amount: number;
	collectionPlanEntryId?: Id<"collectionPlanEntries">;
	dueDate: number;
	editableDate: boolean;
	executionMode: "app_owned" | "provider_managed";
	externalCollectionScheduleId?: Id<"externalCollectionSchedules">;
	kind: ScheduleReplacementPreviewRowKind;
	obligationId?: Id<"obligations">;
	obligationType: "regular_interest" | "principal_repayment";
	paymentNumber: number;
	rowKey: string;
	scheduledDate: number;
	status: "context" | "will_archive" | "generated";
}

export interface PaymentScheduleReplacementDateOverride {
	dueDate: number;
	rowKey: string;
	scheduledDate: number;
}

export interface ScheduleReplacementDraftResult {
	draftId: Id<"paymentScheduleReplacementDrafts">;
	issues: PaymentScheduleReplacementValidationIssue[];
	status: PaymentScheduleReplacementStatus;
}
