import { describe, expect, it } from "vitest";
import type { Id } from "../../_generated/dataModel";
import {
	buildCheckoutStripeMetadata,
	CHECKOUT_STRIPE_METADATA_KEYS,
	parseCheckoutStripeMetadata,
} from "../metadata";

const baseInput = {
	checkoutSessionId: "checkout_123",
	reservationId: "reservation_123" as Id<"ledger_reservations">,
	listingId: "listing_123" as Id<"listings">,
	mortgageId: "mortgage_123" as Id<"mortgages">,
	portalId: "portal_123" as Id<"portals">,
	lenderId: "lender_123" as Id<"lenders">,
	lenderAuthId: "user_01KKFF8EA41DV152KVHD8VJB48",
	selectedLawyer: {
		type: "platform_lawyer" as const,
		lawyerId: "lawyer_123",
		name: "Pat Lawyer",
		email: "pat@example.com",
	},
	requestedFractions: 12,
	idempotencyKey: "checkout:listing_123:lender_123:12",
};

describe("checkout Stripe metadata contract", () => {
	it("declares every required Stripe metadata key", () => {
		expect(CHECKOUT_STRIPE_METADATA_KEYS).toEqual([
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
		]);
	});

	it("builds string-only metadata with server-owned lock fee fields", () => {
		const metadata = buildCheckoutStripeMetadata(baseInput);

		expect(metadata).toEqual({
			checkoutSessionId: "checkout_123",
			reservationId: "reservation_123",
			listingId: "listing_123",
			mortgageId: "mortgage_123",
			portalId: "portal_123",
			lenderId: "lender_123",
			lenderAuthId: "user_01KKFF8EA41DV152KVHD8VJB48",
			selectedLawyerType: "platform_lawyer",
			selectedLawyerId: "lawyer_123",
			requestedFractions: "12",
			lockFeeAmount: "25000",
			lockFeeCurrency: "CAD",
			idempotencyKey: "checkout:listing_123:lender_123:12",
		});

		for (const value of Object.values(metadata)) {
			expect(typeof value).toBe("string");
		}
	});

	it("builds guest-lawyer metadata without a lawyer id", () => {
		const metadata = buildCheckoutStripeMetadata({
			...baseInput,
			selectedLawyer: {
				type: "guest_lawyer",
				name: "Guest Counsel",
				email: "guest@example.com",
			},
		});

		expect(metadata.selectedLawyerType).toBe("guest_lawyer");
		expect(metadata.selectedLawyerId).toBe("");
	});

	it("round-trips platform-lawyer metadata without a lawyer id", () => {
		const parsed = parseCheckoutStripeMetadata(
			buildCheckoutStripeMetadata({
				...baseInput,
				selectedLawyer: {
					type: "platform_lawyer",
					name: "Pat Lawyer",
					email: "pat@example.com",
				},
			})
		);

		expect(parsed.selectedLawyerType).toBe("platform_lawyer");
		expect(parsed.selectedLawyerId).toBeUndefined();
	});

	it("parses metadata into typed values", () => {
		const parsed = parseCheckoutStripeMetadata(
			buildCheckoutStripeMetadata(baseInput)
		);

		expect(parsed).toEqual({
			checkoutSessionId: "checkout_123",
			reservationId: "reservation_123",
			listingId: "listing_123",
			mortgageId: "mortgage_123",
			portalId: "portal_123",
			lenderId: "lender_123",
			lenderAuthId: "user_01KKFF8EA41DV152KVHD8VJB48",
			selectedLawyerType: "platform_lawyer",
			selectedLawyerId: "lawyer_123",
			requestedFractions: 12,
			lockFeeAmount: 25_000,
			lockFeeCurrency: "CAD",
			idempotencyKey: "checkout:listing_123:lender_123:12",
		});
	});

	it("rejects mutable or tampered fee metadata", () => {
		const metadata = buildCheckoutStripeMetadata(baseInput);

		expect(() =>
			parseCheckoutStripeMetadata({ ...metadata, lockFeeAmount: "999" })
		).toThrow("lockFeeAmount must be 25000");
		expect(() =>
			parseCheckoutStripeMetadata({ ...metadata, lockFeeCurrency: "USD" })
		).toThrow("lockFeeCurrency must be CAD");
	});

	it("rejects missing required metadata", () => {
		const metadata = buildCheckoutStripeMetadata(baseInput);
		expect(() =>
			parseCheckoutStripeMetadata({ ...metadata, reservationId: undefined })
		).toThrow("reservationId is required");
	});

	it("rejects invalid requested fractions", () => {
		const metadata = buildCheckoutStripeMetadata(baseInput);

		expect(() =>
			parseCheckoutStripeMetadata({ ...metadata, requestedFractions: "0" })
		).toThrow("requestedFractions must be a positive integer");
		expect(() =>
			parseCheckoutStripeMetadata({
				...metadata,
				requestedFractions: `${Number.MAX_SAFE_INTEGER}0`,
			})
		).toThrow("requestedFractions must be a safe positive integer");
		expect(() =>
			buildCheckoutStripeMetadata({ ...baseInput, requestedFractions: 0 })
		).toThrow("requestedFractions must be a positive integer");
	});

	it("rejects guest metadata carrying a selected lawyer id", () => {
		const metadata = buildCheckoutStripeMetadata({
			...baseInput,
			selectedLawyer: {
				type: "guest_lawyer",
				name: "Guest Counsel",
				email: "guest@example.com",
			},
		});

		expect(() =>
			parseCheckoutStripeMetadata({
				...metadata,
				selectedLawyerId: "lawyer_123",
			})
		).toThrow("selectedLawyerId must be empty for guest lawyers");
	});
});
