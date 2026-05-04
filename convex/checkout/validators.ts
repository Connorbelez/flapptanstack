import { v } from "convex/values";
import type { CheckoutStatus } from "./status";
import { CHECKOUT_STATUSES } from "./status";

export const checkoutStatusValidator = v.union(
	v.literal("preparing_provider_session"),
	v.literal("hosted_checkout_open"),
	v.literal("payment_failed_retryable"),
	v.literal("completed"),
	v.literal("expired"),
	v.literal("abandoned"),
	v.literal("provider_start_failed"),
	v.literal("refunded_late_success")
);

export const CHECKOUT_LOCK_FEE_AMOUNT_CENTS = 25_000;
export const CHECKOUT_LOCK_FEE_CURRENCY = "CAD";

export const checkoutLockFeeAmountValidator = v.literal(
	CHECKOUT_LOCK_FEE_AMOUNT_CENTS
);
export const checkoutLockFeeCurrencyValidator = v.literal(
	CHECKOUT_LOCK_FEE_CURRENCY
);

export const checkoutPlatformLawyerSnapshotValidator = v.object({
	type: v.literal("platform_lawyer"),
	lawyerId: v.optional(v.string()),
	name: v.string(),
	email: v.string(),
	firm: v.optional(v.string()),
});

export const checkoutGuestLawyerSnapshotValidator = v.object({
	type: v.literal("guest_lawyer"),
	name: v.string(),
	email: v.string(),
	firm: v.optional(v.string()),
});

export const selectedLawyerSnapshotValidator = v.union(
	checkoutPlatformLawyerSnapshotValidator,
	checkoutGuestLawyerSnapshotValidator
);

export interface PlatformLawyerSnapshot {
	readonly email: string;
	readonly firm?: string;
	readonly lawyerId?: string;
	readonly name: string;
	readonly type: "platform_lawyer";
}

export interface GuestLawyerSnapshot {
	readonly email: string;
	readonly firm?: string;
	readonly name: string;
	readonly type: "guest_lawyer";
}

export type SelectedLawyerSnapshot =
	| PlatformLawyerSnapshot
	| GuestLawyerSnapshot;

function asRecord(value: unknown): Record<string, unknown> | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function readRequiredString(
	input: Record<string, unknown>,
	fieldName: string
): string {
	const value = input[fieldName];
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`selectedLawyer.${fieldName} must be a non-empty string`);
	}
	return value;
}

function readOptionalString(
	input: Record<string, unknown>,
	fieldName: string
): string | undefined {
	const value = input[fieldName];
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(
			`selectedLawyer.${fieldName} must be a non-empty string when present`
		);
	}
	return value;
}

export function isCheckoutStatusValue(value: string): value is CheckoutStatus {
	return (CHECKOUT_STATUSES as readonly string[]).includes(value);
}

export function parseSelectedLawyerSnapshot(
	value: unknown
): SelectedLawyerSnapshot {
	const input = asRecord(value);
	if (!input) {
		throw new Error("selectedLawyer must be an object");
	}

	const type = input.type;
	if (type !== "platform_lawyer" && type !== "guest_lawyer") {
		throw new Error(
			"selectedLawyer.type must be platform_lawyer or guest_lawyer"
		);
	}

	const name = readRequiredString(input, "name");
	const email = readRequiredString(input, "email");
	const firm = readOptionalString(input, "firm");

	if (type === "platform_lawyer") {
		const lawyerId = readOptionalString(input, "lawyerId");
		return {
			type,
			...(lawyerId === undefined ? {} : { lawyerId }),
			name,
			email,
			...(firm === undefined ? {} : { firm }),
		};
	}

	if (input.lawyerId !== undefined) {
		throw new Error("guest lawyer snapshots must not include lawyerId");
	}

	return {
		type,
		name,
		email,
		...(firm === undefined ? {} : { firm }),
	};
}
