import type { Id } from "../_generated/dataModel";
import type { SelectedLawyerSnapshot } from "./validators";
import {
	CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
	CHECKOUT_LOCK_FEE_CURRENCY,
} from "./validators";

export const CHECKOUT_STRIPE_METADATA_KEYS = [
	"checkoutSessionId",
	"reservationId",
	"listingId",
	"mortgageId",
	"portalId",
	"lenderId",
	"lenderAuthId",
	"selectedLawyerType",
	"selectedLawyerId",
	"requestedFractions",
	"lockFeeAmount",
	"lockFeeCurrency",
	"idempotencyKey",
] as const;

export type CheckoutStripeMetadataKey =
	(typeof CHECKOUT_STRIPE_METADATA_KEYS)[number];

const POSITIVE_INTEGER_RE = /^[1-9]\d*$/;

export type CheckoutStripeMetadata = Record<CheckoutStripeMetadataKey, string>;

export interface BuildCheckoutStripeMetadataInput {
	readonly checkoutSessionId: string;
	readonly idempotencyKey: string;
	readonly lenderAuthId: string;
	readonly lenderId: Id<"lenders">;
	readonly listingId: Id<"listings">;
	readonly mortgageId: Id<"mortgages">;
	readonly portalId: Id<"portals">;
	readonly requestedFractions: number;
	readonly reservationId: Id<"ledger_reservations">;
	readonly selectedLawyer: SelectedLawyerSnapshot;
}

export interface ParsedCheckoutStripeMetadata {
	readonly checkoutSessionId: string;
	readonly idempotencyKey: string;
	readonly lenderAuthId: string;
	readonly lenderId: Id<"lenders">;
	readonly listingId: Id<"listings">;
	readonly lockFeeAmount: typeof CHECKOUT_LOCK_FEE_AMOUNT_CENTS;
	readonly lockFeeCurrency: typeof CHECKOUT_LOCK_FEE_CURRENCY;
	readonly mortgageId: Id<"mortgages">;
	readonly portalId: Id<"portals">;
	readonly requestedFractions: number;
	readonly reservationId: Id<"ledger_reservations">;
	readonly selectedLawyerId?: string;
	readonly selectedLawyerType: SelectedLawyerSnapshot["type"];
}

function assertNonEmptyString(value: string, fieldName: string): void {
	if (value.trim().length === 0) {
		throw new Error(`Stripe checkout metadata ${fieldName} must be non-empty`);
	}
}

function stringifyPositiveInteger(value: number, fieldName: string): string {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${fieldName} must be a positive integer`);
	}
	return String(value);
}

function readRequiredMetadataString(
	metadata: Record<string, string | undefined>,
	key: CheckoutStripeMetadataKey
): string {
	const value = metadata[key];
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`Stripe checkout metadata ${key} is required`);
	}
	return value;
}

function parsePositiveInteger(value: string, fieldName: string): number {
	if (!POSITIVE_INTEGER_RE.test(value)) {
		throw new Error(
			`Stripe checkout metadata ${fieldName} must be a positive integer`
		);
	}
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed)) {
		throw new Error(
			`Stripe checkout metadata ${fieldName} must be a safe positive integer`
		);
	}
	return parsed;
}

function readMetadataStringAllowingEmpty(
	metadata: Record<string, string | undefined>,
	key: CheckoutStripeMetadataKey
): string {
	const value = metadata[key];
	if (typeof value !== "string") {
		throw new Error(`Stripe checkout metadata ${key} is required`);
	}
	return value;
}

function parseLockFeeAmount(
	value: string
): typeof CHECKOUT_LOCK_FEE_AMOUNT_CENTS {
	const parsed = parsePositiveInteger(value, "lockFeeAmount");
	if (parsed !== CHECKOUT_LOCK_FEE_AMOUNT_CENTS) {
		throw new Error(
			`Stripe checkout metadata lockFeeAmount must be ${CHECKOUT_LOCK_FEE_AMOUNT_CENTS}`
		);
	}
	return CHECKOUT_LOCK_FEE_AMOUNT_CENTS;
}

function parseLockFeeCurrency(
	value: string
): typeof CHECKOUT_LOCK_FEE_CURRENCY {
	if (value !== CHECKOUT_LOCK_FEE_CURRENCY) {
		throw new Error(
			`Stripe checkout metadata lockFeeCurrency must be ${CHECKOUT_LOCK_FEE_CURRENCY}`
		);
	}
	return CHECKOUT_LOCK_FEE_CURRENCY;
}

function parseSelectedLawyerType(
	value: string
): SelectedLawyerSnapshot["type"] {
	if (value === "platform_lawyer" || value === "guest_lawyer") {
		return value;
	}
	throw new Error(
		"Stripe checkout metadata selectedLawyerType must be platform_lawyer or guest_lawyer"
	);
}

export function buildCheckoutStripeMetadata(
	input: BuildCheckoutStripeMetadataInput
): CheckoutStripeMetadata {
	const ids = {
		checkoutSessionId: input.checkoutSessionId,
		reservationId: input.reservationId,
		listingId: input.listingId,
		mortgageId: input.mortgageId,
		portalId: input.portalId,
		lenderId: input.lenderId,
		lenderAuthId: input.lenderAuthId,
		idempotencyKey: input.idempotencyKey,
	};

	for (const [fieldName, value] of Object.entries(ids)) {
		assertNonEmptyString(value, fieldName);
	}

	return {
		checkoutSessionId: input.checkoutSessionId,
		reservationId: input.reservationId,
		listingId: input.listingId,
		mortgageId: input.mortgageId,
		portalId: input.portalId,
		lenderId: input.lenderId,
		lenderAuthId: input.lenderAuthId,
		selectedLawyerType: input.selectedLawyer.type,
		selectedLawyerId:
			input.selectedLawyer.type === "platform_lawyer"
				? (input.selectedLawyer.lawyerId ?? "")
				: "",
		requestedFractions: stringifyPositiveInteger(
			input.requestedFractions,
			"requestedFractions"
		),
		lockFeeAmount: String(CHECKOUT_LOCK_FEE_AMOUNT_CENTS),
		lockFeeCurrency: CHECKOUT_LOCK_FEE_CURRENCY,
		idempotencyKey: input.idempotencyKey,
	};
}

export function parseCheckoutStripeMetadata(
	metadata: Record<string, string | undefined>
): ParsedCheckoutStripeMetadata {
	const selectedLawyerType = parseSelectedLawyerType(
		readRequiredMetadataString(metadata, "selectedLawyerType")
	);
	const selectedLawyerId = readMetadataStringAllowingEmpty(
		metadata,
		"selectedLawyerId"
	).trim();
	if (selectedLawyerType === "guest_lawyer" && selectedLawyerId.length > 0) {
		throw new Error(
			"Stripe checkout metadata selectedLawyerId must be empty for guest lawyers"
		);
	}

	return {
		checkoutSessionId: readRequiredMetadataString(
			metadata,
			"checkoutSessionId"
		),
		reservationId: readRequiredMetadataString(
			metadata,
			"reservationId"
		) as Id<"ledger_reservations">,
		listingId: readRequiredMetadataString(
			metadata,
			"listingId"
		) as Id<"listings">,
		mortgageId: readRequiredMetadataString(
			metadata,
			"mortgageId"
		) as Id<"mortgages">,
		portalId: readRequiredMetadataString(metadata, "portalId") as Id<"portals">,
		lenderId: readRequiredMetadataString(metadata, "lenderId") as Id<"lenders">,
		lenderAuthId: readRequiredMetadataString(metadata, "lenderAuthId"),
		selectedLawyerType,
		selectedLawyerId:
			selectedLawyerId.length > 0 ? selectedLawyerId : undefined,
		requestedFractions: parsePositiveInteger(
			readRequiredMetadataString(metadata, "requestedFractions"),
			"requestedFractions"
		),
		lockFeeAmount: parseLockFeeAmount(
			readRequiredMetadataString(metadata, "lockFeeAmount")
		),
		lockFeeCurrency: parseLockFeeCurrency(
			readRequiredMetadataString(metadata, "lockFeeCurrency")
		),
		idempotencyKey: readRequiredMetadataString(metadata, "idempotencyKey"),
	};
}
