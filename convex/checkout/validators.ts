import { v } from "convex/values";
import {
	type LsoLawyerMetadata,
	lsoLawyerMetadataValidator,
} from "../legalRepresentation/validators";
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
	lso: v.optional(lsoLawyerMetadataValidator),
});

export const checkoutGuestLawyerSnapshotValidator = v.object({
	type: v.literal("guest_lawyer"),
	source: v.union(v.literal("lso_search"), v.literal("manual")),
	name: v.string(),
	email: v.string(),
	firm: v.optional(v.string()),
	lso: v.optional(lsoLawyerMetadataValidator),
});

export const selectedLawyerSnapshotValidator = v.union(
	checkoutPlatformLawyerSnapshotValidator,
	checkoutGuestLawyerSnapshotValidator
);

export interface PlatformLawyerSnapshot {
	readonly email: string;
	readonly firm?: string;
	readonly lawyerId?: string;
	readonly lso?: LsoLawyerMetadata;
	readonly name: string;
	readonly type: "platform_lawyer";
}

export interface GuestLawyerSnapshot {
	readonly email: string;
	readonly firm?: string;
	readonly lso?: LsoLawyerMetadata;
	readonly name: string;
	readonly source: "lso_search" | "manual";
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

function readOptionalLsoMetadata(
	input: Record<string, unknown>
): LsoLawyerMetadata | undefined {
	const value = input.lso;
	if (value === undefined) {
		return undefined;
	}
	const lso = asRecord(value);
	if (!lso) {
		throw new Error("selectedLawyer.lso must be an object when present");
	}
	for (const fieldName of [
		"barNumber",
		"jurisdiction",
		"restrictionSummary",
		"source",
	] as const) {
		if (lso[fieldName] !== undefined && typeof lso[fieldName] !== "string") {
			throw new Error(`selectedLawyer.lso.${fieldName} must be a string`);
		}
	}
	if (
		lso.sourceFetchedAt !== undefined &&
		typeof lso.sourceFetchedAt !== "number"
	) {
		throw new Error("selectedLawyer.lso.sourceFetchedAt must be a number");
	}
	if (lso.lsoLawyerId !== undefined && typeof lso.lsoLawyerId !== "string") {
		throw new Error("selectedLawyer.lso.lsoLawyerId must be a string");
	}
	if (
		lso.licensingStatus !== undefined &&
		![
			"licensed",
			"administratively_suspended",
			"suspended",
			"revoked",
			"retired",
			"unknown",
		].includes(String(lso.licensingStatus))
	) {
		throw new Error("selectedLawyer.lso.licensingStatus is not supported");
	}
	if (
		lso.restrictionStatus !== undefined &&
		![
			"clear",
			"restricted",
			"suspended",
			"requires_review",
			"unknown",
		].includes(String(lso.restrictionStatus))
	) {
		throw new Error("selectedLawyer.lso.restrictionStatus is not supported");
	}
	return value as LsoLawyerMetadata;
}

function assertLsoSearchIdentity(lso: LsoLawyerMetadata | undefined): void {
	if (lso === undefined) {
		throw new Error("LSO-backed guest lawyer snapshots must include lso");
	}
	if (!(lso.lsoLawyerId && lso.barNumber && lso.jurisdiction)) {
		throw new Error(
			"LSO-backed guest lawyer snapshots must include lsoLawyerId, barNumber, and jurisdiction"
		);
	}
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
	const lso = readOptionalLsoMetadata(input);

	if (type === "platform_lawyer") {
		const lawyerId = readOptionalString(input, "lawyerId");
		return {
			type,
			...(lawyerId === undefined ? {} : { lawyerId }),
			name,
			email,
			...(firm === undefined ? {} : { firm }),
			...(lso === undefined ? {} : { lso }),
		};
	}

	if (input.lawyerId !== undefined) {
		throw new Error("guest lawyer snapshots must not include lawyerId");
	}
	const source = input.source;
	if (source !== "lso_search" && source !== "manual") {
		throw new Error("selectedLawyer.source must be lso_search or manual");
	}
	if (source === "lso_search") {
		assertLsoSearchIdentity(lso);
	}
	if (source === "manual" && lso !== undefined) {
		throw new Error("manual guest lawyer snapshots must not include lso");
	}

	return {
		type,
		source,
		name,
		email,
		...(firm === undefined ? {} : { firm }),
		...(lso === undefined ? {} : { lso }),
	};
}
