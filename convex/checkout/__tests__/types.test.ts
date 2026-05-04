import { describe, expect, it } from "vitest";
import type { Id } from "../../_generated/dataModel";
import {
	assertPositiveWholeFractions,
	buildCheckoutIdempotencyKey,
	CHECKOUT_LOCK_FEE,
	CHECKOUT_SESSION_TTL_MS,
	checkoutFailure,
	startMarketplaceCheckoutErrorCodes,
} from "../types";

describe("checkout start types", () => {
	it("declares the public checkout-start failure codes", () => {
		expect(startMarketplaceCheckoutErrorCodes).toEqual([
			"unauthorized",
			"listing_unavailable",
			"insufficient_fractions",
			"invalid_lawyer",
			"provider_start_failed",
			"demo_listing_not_supported",
		]);
	});

	it("keeps TTL and lock fee server-owned", () => {
		expect(CHECKOUT_SESSION_TTL_MS).toBe(15 * 60 * 1000);
		expect(CHECKOUT_LOCK_FEE).toEqual({ amount: 25_000, currency: "CAD" });
	});

	it("builds idempotency keys from internal checkout session ids", () => {
		expect(
			buildCheckoutIdempotencyKey("checkout_123" as Id<"checkoutSessions">)
		).toBe("marketplace-checkout:checkout_123");
	});

	it("returns typed checkout failures", () => {
		expect(
			checkoutFailure("listing_unavailable", "Listing is unavailable")
		).toEqual({
			ok: false,
			code: "listing_unavailable",
			message: "Listing is unavailable",
		});
	});

	it("accepts only positive whole fraction requests", () => {
		expect(assertPositiveWholeFractions(1)).toBe(1);
		expect(assertPositiveWholeFractions(12)).toBe(12);
		expect(() => assertPositiveWholeFractions(0)).toThrow(
			"positive whole number"
		);
		expect(() => assertPositiveWholeFractions(-1)).toThrow(
			"positive whole number"
		);
		expect(() => assertPositiveWholeFractions(1.2)).toThrow(
			"positive whole number"
		);
		expect(() =>
			assertPositiveWholeFractions(Number.MAX_SAFE_INTEGER + 1)
		).toThrow("safe integer");
	});
});
