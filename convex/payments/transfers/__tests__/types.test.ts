/**
 * Transfer types tests — validates that the TRANSFER_TYPE_TO_OBLIGATION_TYPE
 * mapping is exhaustive over ALL_TRANSFER_TYPES and maps obligation-backed
 * transfers to the expected obligation-type literals.
 */

import { describe, expect, it } from "vitest";
import type { ObligationType, ProviderCode, TransferType } from "../types";
import {
	ALL_TRANSFER_TYPES,
	CHECKOUT_LOCK_FEE_PROVIDER_CODES,
	DEFAULT_OBLIGATION_TRANSFER_TYPE,
	INBOUND_TRANSFER_TYPES,
	isCheckoutLockFeeProviderUse,
	NON_CHECKOUT_TRANSFER_PROVIDER_CODES,
	OBLIGATION_TYPE_TO_TRANSFER_TYPE,
	obligationTypeToTransferType,
	PROVIDER_CODES,
	TRANSFER_TYPE_TO_OBLIGATION_TYPE,
} from "../types";

// Known obligation type literals — derived from the mapping at the time of writing.
const KNOWN_OBLIGATION_TYPES: readonly string[] = [
	"regular_interest",
	"principal_repayment",
	"late_fee",
	"arrears_cure",
] as const;

describe("TRANSFER_TYPE_TO_OBLIGATION_TYPE", () => {
	it("has a key for every entry in ALL_TRANSFER_TYPES (exhaustiveness)", () => {
		const mappingKeys = Object.keys(TRANSFER_TYPE_TO_OBLIGATION_TYPE);
		for (const transferType of ALL_TRANSFER_TYPES) {
			expect(mappingKeys).toContain(transferType);
		}
	});

	it("has no extra keys beyond ALL_TRANSFER_TYPES", () => {
		const allTypes = new Set<string>(ALL_TRANSFER_TYPES);
		for (const key of Object.keys(TRANSFER_TYPE_TO_OBLIGATION_TYPE)) {
			expect(allTypes.has(key)).toBe(true);
		}
	});

	it("every non-null value is a known obligation type literal", () => {
		for (const [key, value] of Object.entries(
			TRANSFER_TYPE_TO_OBLIGATION_TYPE
		)) {
			if (value !== null) {
				expect(
					KNOWN_OBLIGATION_TYPES,
					`Unexpected obligation type "${value}" for transfer type "${key}"`
				).toContain(value);
			}
		}
	});

	it("obligation-backed transfer types map to expected obligation types (snapshot)", () => {
		const expected: Record<string, ObligationType> = {
			borrower_interest_collection: "regular_interest",
			borrower_principal_collection: "principal_repayment",
			borrower_late_fee_collection: "late_fee",
			borrower_one_time_fee_collection: "late_fee",
			borrower_recurring_fee_collection: "late_fee",
			borrower_arrears_cure: "arrears_cure",
		};

		for (const [transferType, obligationType] of Object.entries(expected)) {
			expect(
				TRANSFER_TYPE_TO_OBLIGATION_TYPE[transferType as TransferType]
			).toBe(obligationType);
		}
	});

	it("non-obligation-backed transfer types map to null", () => {
		const expectedNull: TransferType[] = [
			"locking_fee_collection",
			"commitment_deposit_collection",
			"deal_principal_transfer",
			"lender_dispersal_payout",
			"lender_principal_return",
			"deal_seller_payout",
		];

		for (const transferType of expectedNull) {
			expect(
				TRANSFER_TYPE_TO_OBLIGATION_TYPE[transferType],
				`Expected "${transferType}" to map to null`
			).toBeNull();
		}
	});
});

describe("OBLIGATION_TYPE_TO_TRANSFER_TYPE", () => {
	it("has a key for every known obligation type", () => {
		const mappingKeys = Object.keys(OBLIGATION_TYPE_TO_TRANSFER_TYPE);
		for (const obligationType of KNOWN_OBLIGATION_TYPES) {
			expect(mappingKeys).toContain(obligationType);
		}
	});

	it("maps every obligation-backed type back to its inbound transfer type", () => {
		const expected = {
			regular_interest: "borrower_interest_collection",
			principal_repayment: "borrower_principal_collection",
			late_fee: "borrower_late_fee_collection",
			arrears_cure: "borrower_arrears_cure",
		} as const satisfies Record<ObligationType, TransferType>;

		for (const [obligationType, transferType] of Object.entries(expected)) {
			expect(
				OBLIGATION_TYPE_TO_TRANSFER_TYPE[obligationType as ObligationType]
			).toBe(transferType);
		}
	});
});

describe("obligationTypeToTransferType", () => {
	it("returns the mapped inbound transfer type for known obligation types", () => {
		expect(obligationTypeToTransferType("regular_interest")).toBe(
			"borrower_interest_collection"
		);
		expect(obligationTypeToTransferType("principal_repayment")).toBe(
			"borrower_principal_collection"
		);
		expect(obligationTypeToTransferType("late_fee")).toBe(
			"borrower_late_fee_collection"
		);
		expect(obligationTypeToTransferType("arrears_cure")).toBe(
			"borrower_arrears_cure"
		);
	});

	it("maps borrower fee obligations by fee behavior without changing late fees", () => {
		expect(
			obligationTypeToTransferType("late_fee", {
				feeCode: "late_fee",
				feeBehavior: "borrower_one_time_charge",
			})
		).toBe("borrower_late_fee_collection");
		expect(
			obligationTypeToTransferType("late_fee", {
				feeCode: "admin_fee",
				feeBehavior: "borrower_one_time_charge",
			})
		).toBe("borrower_one_time_fee_collection");
		expect(
			obligationTypeToTransferType("late_fee", {
				feeCode: "custom_fee",
				feeBehavior: "borrower_recurring_charge",
			})
		).toBe("borrower_recurring_fee_collection");
	});

	it("falls back safely for undefined obligation types", () => {
		expect(obligationTypeToTransferType(undefined)).toBe(
			DEFAULT_OBLIGATION_TRANSFER_TYPE
		);
	});

	it("falls back safely for unmapped obligation types", () => {
		expect(obligationTypeToTransferType("servicing")).toBe(
			DEFAULT_OBLIGATION_TRANSFER_TYPE
		);
	});
});

describe("locking fee Stripe provider contract", () => {
	it("keeps locking_fee_collection as an inbound transfer type", () => {
		expect(INBOUND_TRANSFER_TYPES).toContain("locking_fee_collection");
		expect(TRANSFER_TYPE_TO_OBLIGATION_TYPE.locking_fee_collection).toBeNull();
	});

	it("includes stripe as a typed provider code", () => {
		const providerCode = "stripe" satisfies ProviderCode;

		expect(PROVIDER_CODES).toContain(providerCode);
	});

	it("scopes stripe to checkout locking fee provider capability", () => {
		expect(CHECKOUT_LOCK_FEE_PROVIDER_CODES).toEqual(["stripe"]);
		expect(NON_CHECKOUT_TRANSFER_PROVIDER_CODES).not.toContain("stripe");
		expect(
			isCheckoutLockFeeProviderUse({
				direction: "inbound",
				transferType: "locking_fee_collection",
				providerCode: "stripe",
				metadata: {
					checkoutSessionId: "checkout_123",
					idempotencyKey: "checkout:idempotency",
					providerEventId: "evt_checkout_123",
					reservationId: "reservation_123",
					stripeCheckoutSessionId: "cs_test_123",
				},
			})
		).toBe(true);
	});

	it("requires full checkout linkage metadata for stripe provider use", () => {
		expect(
			isCheckoutLockFeeProviderUse({
				direction: "inbound",
				transferType: "locking_fee_collection",
				providerCode: "stripe",
				metadata: {
					checkoutSessionId: "checkout_123",
					idempotencyKey: "checkout:idempotency",
					providerEventId: "evt_checkout_123",
					reservationId: "reservation_123",
				},
			})
		).toBe(false);

		expect(
			isCheckoutLockFeeProviderUse({
				direction: "inbound",
				transferType: "locking_fee_collection",
				providerCode: "stripe",
				metadata: {
					checkoutSessionId: "checkout_123",
					idempotencyKey: "checkout:idempotency",
					providerEventId: "evt_checkout_123",
					reservationId: "reservation_123",
					stripeCheckoutSessionId: "cs_test_123",
					stripePaymentIntentId: "",
				},
			})
		).toBe(false);
	});

	it("rejects stripe for non-checkout transfer capabilities", () => {
		for (const transferType of [
			"commitment_deposit_collection",
			"deal_principal_transfer",
			"deal_seller_payout",
			"lender_principal_return",
		] as const satisfies readonly TransferType[]) {
			expect(
				isCheckoutLockFeeProviderUse({
					direction:
						transferType === "deal_seller_payout" ||
						transferType === "lender_principal_return"
							? "outbound"
							: "inbound",
					transferType,
					providerCode: "stripe",
					metadata: {
						checkoutSessionId: "checkout_123",
						idempotencyKey: "checkout:idempotency",
						providerEventId: "evt_checkout_123",
						reservationId: "reservation_123",
						stripeCheckoutSessionId: "cs_test_123",
					},
				})
			).toBe(false);
		}

		expect(
			isCheckoutLockFeeProviderUse({
				direction: "inbound",
				transferType: "locking_fee_collection",
				providerCode: "stripe",
			})
		).toBe(false);
	});
});
