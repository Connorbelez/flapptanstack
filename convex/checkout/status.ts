export const CHECKOUT_STATUSES = [
	"preparing_provider_session",
	"hosted_checkout_open",
	"payment_failed_retryable",
	"completed",
	"expired",
	"abandoned",
	"provider_start_failed",
	"refunded_late_success",
] as const;

export type CheckoutStatus = (typeof CHECKOUT_STATUSES)[number];

export const CHECKOUT_TERMINAL_STATUSES = [
	"completed",
	"expired",
	"abandoned",
	"provider_start_failed",
	"refunded_late_success",
] as const satisfies readonly CheckoutStatus[];

export type CheckoutTerminalStatus =
	(typeof CHECKOUT_TERMINAL_STATUSES)[number];

export const CHECKOUT_ACTIVE_STATUSES = [
	"preparing_provider_session",
	"hosted_checkout_open",
	"payment_failed_retryable",
] as const satisfies readonly CheckoutStatus[];

export type CheckoutActiveStatus = (typeof CHECKOUT_ACTIVE_STATUSES)[number];

const STATUS_SET: ReadonlySet<string> = new Set(CHECKOUT_STATUSES);
const TERMINAL_STATUS_SET: ReadonlySet<CheckoutStatus> = new Set(
	CHECKOUT_TERMINAL_STATUSES
);
const ACTIVE_STATUS_SET: ReadonlySet<CheckoutStatus> = new Set(
	CHECKOUT_ACTIVE_STATUSES
);

export const CHECKOUT_ALLOWED_TRANSITIONS = {
	preparing_provider_session: ["hosted_checkout_open", "provider_start_failed"],
	hosted_checkout_open: [
		"payment_failed_retryable",
		"completed",
		"expired",
		"abandoned",
		"refunded_late_success",
	],
	payment_failed_retryable: ["hosted_checkout_open", "expired", "abandoned"],
	completed: [],
	expired: ["refunded_late_success"],
	abandoned: [],
	provider_start_failed: [],
	refunded_late_success: [],
} as const satisfies Record<CheckoutStatus, readonly CheckoutStatus[]>;

export function isCheckoutStatus(value: string): value is CheckoutStatus {
	return STATUS_SET.has(value);
}

export function isTerminalCheckoutStatus(
	status: CheckoutStatus
): status is CheckoutTerminalStatus {
	return TERMINAL_STATUS_SET.has(status);
}

export function isActiveCheckoutStatus(
	status: CheckoutStatus
): status is CheckoutActiveStatus {
	return ACTIVE_STATUS_SET.has(status);
}

export function canTransitionCheckoutStatus(
	from: CheckoutStatus,
	to: CheckoutStatus
): boolean {
	const allowedTargets = CHECKOUT_ALLOWED_TRANSITIONS[
		from
	] as readonly CheckoutStatus[];
	return allowedTargets.includes(to);
}

export function isCheckoutReopenTransition(
	from: CheckoutStatus,
	to: CheckoutStatus
): boolean {
	return isTerminalCheckoutStatus(from) && isActiveCheckoutStatus(to);
}

export function assertCheckoutTransitionAllowed(
	from: CheckoutStatus,
	to: CheckoutStatus
): void {
	if (!canTransitionCheckoutStatus(from, to)) {
		throw new Error(`Invalid checkout status transition: ${from} -> ${to}`);
	}
}
