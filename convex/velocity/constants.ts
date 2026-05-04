export const VELOCITY_PROVIDER = "velocity" as const;
export const VELOCITY_CORE_SOURCE_VERSION = "velocity_core_v1" as const;

export const VELOCITY_WORKFLOW_SOURCE_TYPE = "velocity_package" as const;
export const VELOCITY_CREATION_SOURCE = "velocity_package" as const;
export const VELOCITY_ORIGINATION_PATH = "velocity" as const;

export const VELOCITY_PACKAGE_WORKSPACE_STATES = [
	"in_progress",
	"needs_fairlend_data",
	"ready_for_review",
	"final_review_required",
	"ready_to_activate",
	"activating",
	"activation_failed_remediation",
	"activated",
] as const;

export type VelocityPackageWorkspaceState =
	(typeof VELOCITY_PACKAGE_WORKSPACE_STATES)[number];

export const VELOCITY_PACKAGE_EXCEPTION_KINDS = [
	"identity_exception",
	"upstream_sync_exception",
	"unsupported_mapping_exception",
	"upstream_changed_after_review",
	"activation_exception",
	"live_drift_exception",
] as const;

export type VelocityPackageExceptionKind =
	(typeof VELOCITY_PACKAGE_EXCEPTION_KINDS)[number];

export const VELOCITY_PACKAGE_EXCEPTION_STATUSES = [
	"open",
	"resolved",
	"superseded",
] as const;

export type VelocityPackageExceptionStatus =
	(typeof VELOCITY_PACKAGE_EXCEPTION_STATUSES)[number];

export const VELOCITY_PACKAGE_EXCEPTION_SEVERITIES = [
	"info",
	"warning",
	"blocking",
	"critical",
] as const;

export type VelocityPackageExceptionSeverity =
	(typeof VELOCITY_PACKAGE_EXCEPTION_SEVERITIES)[number];

export const VELOCITY_SYNC_TRIGGERS = [
	"webhook",
	"manual_sync_now",
	"mock_scenario",
	"retry",
] as const;

export type VelocitySyncTrigger = (typeof VELOCITY_SYNC_TRIGGERS)[number];

export const VELOCITY_SYNC_RESULTS = [
	"succeeded",
	"failed",
	"duplicate_noop",
	"exception",
] as const;

export type VelocitySyncResult = (typeof VELOCITY_SYNC_RESULTS)[number];

export const VELOCITY_WEBHOOK_EVENT_STATUSES = [
	"pending",
	"processed",
	"failed",
	"ignored_duplicate",
] as const;

export type VelocityWebhookEventStatus =
	(typeof VELOCITY_WEBHOOK_EVENT_STATUSES)[number];

export const VELOCITY_ACTIVATION_ATTEMPT_STATUSES = [
	"queued",
	"validating",
	"creating_rotessa_customer",
	"creating_rotessa_schedule",
	"creating_canonical_mortgage",
	"succeeded",
	"failed",
] as const;

export type VelocityActivationAttemptStatus =
	(typeof VELOCITY_ACTIVATION_ATTEMPT_STATUSES)[number];

export const VELOCITY_SNAPSHOT_TYPES = [
	"upstream_core",
	"final_review",
	"activation_input",
	"post_live_drift",
] as const;

export type VelocitySnapshotType = (typeof VELOCITY_SNAPSHOT_TYPES)[number];

export const VELOCITY_SNAPSHOT_CREATORS = [
	"webhook",
	"manual_sync_now",
	"activation",
	"system",
] as const;

export type VelocitySnapshotCreator =
	(typeof VELOCITY_SNAPSHOT_CREATORS)[number];

export const VELOCITY_PACKAGE_DOCUMENT_ROLES = [
	"pad_evidence",
	"supporting_document",
	"valuation",
	"property_image",
] as const;

export type VelocityPackageDocumentRole =
	(typeof VELOCITY_PACKAGE_DOCUMENT_ROLES)[number];

export const VELOCITY_DEAL_STATUS = {
	0: "Lead",
	1: "New",
	2: "Submitted",
	3: "Approved",
	4: "Accepted",
	5: "Waiting To Close",
	6: "Funded",
	7: "Complete",
	8: "Parked",
	9: "Cancelled",
	10: "Declined",
} as const;

export type VelocityDealStatusCode = keyof typeof VELOCITY_DEAL_STATUS;

export const VELOCITY_ACTIVATION_STATUS_CODE = 6 as const;
export const VELOCITY_COMPLETE_STATUS_CODE = 7 as const;
export const VELOCITY_NON_ACTIONABLE_STATUS_CODES = [8, 9, 10] as const;

export const VELOCITY_PAYMENT_FREQUENCY = {
	1: "Bi Weekly",
	2: "Bi Weekly Acc",
	3: "Monthly",
	4: "Semi Monthly",
	5: "Weekly",
	6: "Weekly Acc",
} as const;

export type VelocityPropertyMortgagePaymentFrequencyCode =
	keyof typeof VELOCITY_PAYMENT_FREQUENCY;

export const VELOCITY_TO_FAIRLEND_PAYMENT_FREQUENCY = {
	1: "bi_weekly",
	2: "accelerated_bi_weekly",
	3: "monthly",
	5: "weekly",
} as const;

export const UNSUPPORTED_VELOCITY_PAYMENT_FREQUENCIES = {
	4: "Semi Monthly",
	6: "Weekly Acc",
} as const;

export type FairLendPaymentFrequency =
	(typeof VELOCITY_TO_FAIRLEND_PAYMENT_FREQUENCY)[keyof typeof VELOCITY_TO_FAIRLEND_PAYMENT_FREQUENCY];

export const VELOCITY_RATE_TYPE = {
	1: "Adjustable",
	2: "Buydown",
	3: "Capped Variable",
	4: "Fixed",
	5: "Variable",
} as const;

export type VelocityPropertyMortgageRateTypeCode =
	keyof typeof VELOCITY_RATE_TYPE;

export const VELOCITY_TO_FAIRLEND_RATE_TYPE = {
	1: "variable",
	2: "variable",
	3: "variable",
	4: "fixed",
	5: "variable",
} as const;

export type FairLendRateType =
	(typeof VELOCITY_TO_FAIRLEND_RATE_TYPE)[keyof typeof VELOCITY_TO_FAIRLEND_RATE_TYPE];

export const VELOCITY_MORTGAGE_REQUEST_PURPOSE = {
	10: "Purchase",
	20: "Refinance",
	30: "Renew",
} as const;

export type VelocityMortgageRequestPurposeCode =
	keyof typeof VELOCITY_MORTGAGE_REQUEST_PURPOSE;

export const VELOCITY_DATE_TYPE = {
	1: "Closing Date",
	2: "Entry Date",
} as const;

export type VelocityDateTypeCode = keyof typeof VELOCITY_DATE_TYPE;

export const VELOCITY_PROPERTY_INTENDED_USE = {
	1: "Owner Occupied",
	2: "Owner Occupied And Rental",
	3: "Rental",
	4: "Second Home",
} as const;

export type VelocityPropertyIntendedUseCode =
	keyof typeof VELOCITY_PROPERTY_INTENDED_USE;

export const VELOCITY_PROPERTY_OCCUPANCY = {
	1: "Owner Occupied",
	2: "Owner Occupied And Rental",
	3: "Rental",
	4: "Second Home",
} as const;

export type VelocityPropertyOccupancyCode =
	keyof typeof VELOCITY_PROPERTY_OCCUPANCY;

export const VELOCITY_PROPERTY_FUTURE_STATUS = {
	1: "Selling",
	2: "Not Selling",
	3: "Renting",
} as const;

export type VelocityPropertyFutureStatusCode =
	keyof typeof VELOCITY_PROPERTY_FUTURE_STATUS;

export const VELOCITY_COUNTRY = {
	1: "Canada",
	2: "United States",
} as const;

export type VelocityCountryCode = keyof typeof VELOCITY_COUNTRY;

export const VELOCITY_STREET_DIRECTION = {
	1: "North",
	2: "North East",
	3: "East",
	4: "South East",
	5: "South",
	6: "South West",
	7: "West",
	8: "North West",
} as const;

export type VelocityStreetDirectionCode =
	keyof typeof VELOCITY_STREET_DIRECTION;

export const VELOCITY_CANADIAN_PROVINCE_CODES = {
	1: "AB",
	2: "BC",
	3: "MB",
	4: "NB",
	5: "NL",
	6: "NT",
	7: "NS",
	8: "NU",
	9: "ON",
	10: "PE",
	11: "QC",
	12: "SK",
	13: "YT",
} as const;

export type VelocityCanadianProvinceCode =
	keyof typeof VELOCITY_CANADIAN_PROVINCE_CODES;

export const VELOCITY_READINESS_BLOCKER_CODES = [
	"missing_link_application_id",
	"identity_collision",
	"velocity_not_funded",
	"velocity_complete_before_activation",
	"unsupported_velocity_status",
	"unsupported_payment_frequency",
	"missing_required_core_field",
	"missing_fairlend_owned_field",
	"missing_bank_data",
	"missing_pad_pdf",
	"upstream_changed_after_review",
	"activation_in_progress",
	"live_mortgage_exists",
] as const;

export type VelocityReadinessBlockerCode =
	(typeof VELOCITY_READINESS_BLOCKER_CODES)[number];

export type VelocityStatusActivationDisposition =
	| "activation_eligible"
	| "already_activated"
	| "pre_activation"
	| "complete_before_activation_remediation"
	| "non_actionable"
	| "unsupported_status"
	| "missing_status";

export interface VelocityStatusSemantics {
	blockerCode?: VelocityReadinessBlockerCode;
	canActivate: boolean;
	disposition: VelocityStatusActivationDisposition;
	statusCode: number | null;
	statusLabel: string | null;
}

function lookupNumberMapLabel<TMap extends Readonly<Record<number, string>>>(
	map: TMap,
	code: number | null | undefined
): string | null {
	if (code == null) {
		return null;
	}

	return map[code] ?? null;
}

export function getVelocityDealStatusLabel(
	statusCode: number | null | undefined
) {
	return lookupNumberMapLabel(VELOCITY_DEAL_STATUS, statusCode);
}

export function getVelocityPaymentFrequencyLabel(
	paymentFrequencyCode: number | null | undefined
) {
	return lookupNumberMapLabel(VELOCITY_PAYMENT_FREQUENCY, paymentFrequencyCode);
}

export function mapVelocityPaymentFrequencyToFairLend(
	paymentFrequencyCode: number | null | undefined
): FairLendPaymentFrequency | null {
	if (paymentFrequencyCode == null) {
		return null;
	}

	return (
		VELOCITY_TO_FAIRLEND_PAYMENT_FREQUENCY[
			paymentFrequencyCode as keyof typeof VELOCITY_TO_FAIRLEND_PAYMENT_FREQUENCY
		] ?? null
	);
}

export function isUnsupportedVelocityPaymentFrequency(
	paymentFrequencyCode: number | null | undefined
) {
	if (paymentFrequencyCode == null) {
		return false;
	}

	return paymentFrequencyCode in UNSUPPORTED_VELOCITY_PAYMENT_FREQUENCIES;
}

export function mapVelocityRateTypeToFairLend(
	rateTypeCode: number | null | undefined
): FairLendRateType | null {
	if (rateTypeCode == null) {
		return null;
	}

	return (
		VELOCITY_TO_FAIRLEND_RATE_TYPE[
			rateTypeCode as keyof typeof VELOCITY_TO_FAIRLEND_RATE_TYPE
		] ?? null
	);
}

export function getVelocityCanadianProvince(
	provinceCode: number | null | undefined
) {
	return lookupNumberMapLabel(VELOCITY_CANADIAN_PROVINCE_CODES, provinceCode);
}

export function resolveVelocityStatusSemantics(args: {
	fairlendActivated?: boolean;
	statusCode: number | null | undefined;
}): VelocityStatusSemantics {
	const statusCode = args.statusCode ?? null;
	const statusLabel = getVelocityDealStatusLabel(statusCode);

	if (statusCode == null) {
		return {
			blockerCode: "missing_required_core_field",
			canActivate: false,
			disposition: "missing_status",
			statusCode,
			statusLabel,
		};
	}

	if (args.fairlendActivated) {
		return {
			canActivate: false,
			disposition: "already_activated",
			statusCode,
			statusLabel,
		};
	}

	if (statusCode === VELOCITY_ACTIVATION_STATUS_CODE) {
		return {
			canActivate: true,
			disposition: "activation_eligible",
			statusCode,
			statusLabel,
		};
	}

	if (statusCode === VELOCITY_COMPLETE_STATUS_CODE) {
		return {
			blockerCode: "velocity_complete_before_activation",
			canActivate: false,
			disposition: "complete_before_activation_remediation",
			statusCode,
			statusLabel,
		};
	}

	if (
		VELOCITY_NON_ACTIONABLE_STATUS_CODES.includes(
			statusCode as (typeof VELOCITY_NON_ACTIONABLE_STATUS_CODES)[number]
		)
	) {
		return {
			blockerCode: "unsupported_velocity_status",
			canActivate: false,
			disposition: "non_actionable",
			statusCode,
			statusLabel,
		};
	}

	if (statusLabel == null) {
		return {
			blockerCode: "unsupported_velocity_status",
			canActivate: false,
			disposition: "unsupported_status",
			statusCode,
			statusLabel,
		};
	}

	return {
		blockerCode: "velocity_not_funded",
		canActivate: false,
		disposition: "pre_activation",
		statusCode,
		statusLabel,
	};
}

export function normalizeVelocityKeyPart(
	value: number | string | null | undefined
) {
	if (value == null || value === "") {
		return "unknown";
	}

	return encodeURIComponent(String(value));
}

export function normalizeRequiredVelocityKeyPart(
	value: number | string | null | undefined,
	fieldName: string
) {
	if (value == null || String(value).trim() === "") {
		throw new Error(`Velocity ${fieldName} is required for key generation`);
	}

	return encodeURIComponent(String(value));
}

export function buildVelocityMortgageWorkflowSourceKey(
	linkApplicationId: string
) {
	return `${VELOCITY_WORKFLOW_SOURCE_TYPE}:mortgage:${normalizeRequiredVelocityKeyPart(
		linkApplicationId,
		"linkApplicationId"
	)}` as const;
}

export function buildVelocityWebhookEventIdempotencyKey(args: {
	eventTimestamp: string;
	eventType?: number | string | null;
	loanCode: string;
	status?: number | string | null;
}) {
	return `velocity:webhook:${normalizeVelocityKeyPart(
		args.loanCode
	)}:${normalizeVelocityKeyPart(args.eventTimestamp)}:${normalizeVelocityKeyPart(
		args.eventType
	)}:${normalizeVelocityKeyPart(args.status)}` as const;
}

export function buildVelocitySyncIdempotencyKey(args: {
	linkApplicationId: string;
	rawDealHash: string;
}) {
	return `velocity:sync:${normalizeRequiredVelocityKeyPart(
		args.linkApplicationId,
		"linkApplicationId"
	)}:${normalizeRequiredVelocityKeyPart(args.rawDealHash, "rawDealHash")}` as const;
}

export function buildVelocityActivationIdempotencyKey(args: {
	reviewedSnapshotHash: string;
	workspaceId: string;
}) {
	return `velocity:activation:${normalizeVelocityKeyPart(
		args.workspaceId
	)}:${normalizeVelocityKeyPart(args.reviewedSnapshotHash)}` as const;
}
