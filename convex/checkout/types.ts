import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
	CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
	CHECKOUT_LOCK_FEE_CURRENCY,
	type SelectedLawyerSnapshot,
	selectedLawyerSnapshotValidator,
} from "./validators";

export const CHECKOUT_SESSION_TTL_MS = 15 * 60 * 1000;

export const startMarketplaceCheckoutErrorCodes = [
	"unauthorized",
	"listing_unavailable",
	"insufficient_fractions",
	"invalid_lawyer",
	"provider_start_failed",
	"demo_listing_not_supported",
] as const;

export type StartMarketplaceCheckoutErrorCode =
	(typeof startMarketplaceCheckoutErrorCodes)[number];

export const startMarketplaceCheckoutErrorCodeValidator = v.union(
	v.literal("unauthorized"),
	v.literal("listing_unavailable"),
	v.literal("insufficient_fractions"),
	v.literal("invalid_lawyer"),
	v.literal("provider_start_failed"),
	v.literal("demo_listing_not_supported")
);

export const startMarketplaceCheckoutArgsValidator = {
	listingId: v.id("listings"),
	portalId: v.id("portals"),
	requestedFractions: v.number(),
	selectedLawyer: selectedLawyerSnapshotValidator,
};

export const startMarketplaceCheckoutResultValidator = v.union(
	v.object({
		ok: v.literal(true),
		checkoutSessionId: v.id("checkoutSessions"),
		stripeCheckoutUrl: v.string(),
		expiresAt: v.number(),
	}),
	v.object({
		ok: v.literal(false),
		code: startMarketplaceCheckoutErrorCodeValidator,
		message: v.string(),
	})
);

export interface StartMarketplaceCheckoutArgs {
	readonly listingId: Id<"listings">;
	readonly portalId: Id<"portals">;
	readonly requestedFractions: number;
	readonly selectedLawyer: SelectedLawyerSnapshot;
}

export type StartMarketplaceCheckoutResult =
	| {
			readonly ok: true;
			readonly checkoutSessionId: Id<"checkoutSessions">;
			readonly stripeCheckoutUrl: string;
			readonly expiresAt: number;
	  }
	| {
			readonly ok: false;
			readonly code: StartMarketplaceCheckoutErrorCode;
			readonly message: string;
	  };

export function checkoutFailure(
	code: StartMarketplaceCheckoutErrorCode,
	message: string
): Extract<StartMarketplaceCheckoutResult, { ok: false }> {
	return { ok: false, code, message };
}

export function assertPositiveWholeFractions(value: number): number {
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error("requestedFractions must be a positive whole number");
	}
	if (!Number.isSafeInteger(value)) {
		throw new Error("requestedFractions must be a safe integer");
	}
	return value;
}

export function buildCheckoutIdempotencyKey(
	checkoutSessionId: Id<"checkoutSessions">
): string {
	return `marketplace-checkout:${String(checkoutSessionId)}`;
}

export function buildCheckoutReleaseIdempotencyKey(
	checkoutSessionId: Id<"checkoutSessions">,
	status: "abandoned" | "expired"
): string {
	return `marketplace-checkout-${status}:${String(checkoutSessionId)}`;
}

export const CHECKOUT_LOCK_FEE = {
	amount: CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
	currency: CHECKOUT_LOCK_FEE_CURRENCY,
} as const;
