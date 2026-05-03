import { describe, expect, it } from "vitest";
import {
	CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
	CHECKOUT_LOCK_FEE_CURRENCY,
	isCheckoutStatusValue,
	parseSelectedLawyerSnapshot,
} from "../validators";

describe("checkout validators", () => {
	it("exports server-owned lock fee constants", () => {
		expect(CHECKOUT_LOCK_FEE_AMOUNT_CENTS).toBe(25_000);
		expect(CHECKOUT_LOCK_FEE_CURRENCY).toBe("CAD");
	});

	it("recognizes checkout status values", () => {
		expect(isCheckoutStatusValue("preparing_provider_session")).toBe(true);
		expect(isCheckoutStatusValue("initiated")).toBe(false);
	});
});

describe("parseSelectedLawyerSnapshot", () => {
	it("accepts a platform lawyer snapshot with lawyer id", () => {
		expect(
			parseSelectedLawyerSnapshot({
				type: "platform_lawyer",
				lawyerId: "lawyer_123",
				name: "Pat Lawyer",
				email: "pat@example.com",
				firm: "FairLend Legal",
			})
		).toEqual({
			type: "platform_lawyer",
			lawyerId: "lawyer_123",
			name: "Pat Lawyer",
			email: "pat@example.com",
			firm: "FairLend Legal",
		});
	});

	it("accepts a platform lawyer snapshot without lawyer id", () => {
		expect(
			parseSelectedLawyerSnapshot({
				type: "platform_lawyer",
				name: "Pat Lawyer",
				email: "pat@example.com",
			})
		).toEqual({
			type: "platform_lawyer",
			name: "Pat Lawyer",
			email: "pat@example.com",
		});
	});

	it("omits absent optional keys from parsed snapshots", () => {
		const parsed = parseSelectedLawyerSnapshot({
			type: "guest_lawyer",
			source: "manual",
			name: "Guest Counsel",
			email: "guest@example.com",
		});

		expect("firm" in parsed).toBe(false);
	});

	it("accepts a guest lawyer snapshot", () => {
		expect(
			parseSelectedLawyerSnapshot({
				type: "guest_lawyer",
				source: "manual",
				name: "Guest Counsel",
				email: "guest@example.com",
				firm: "Guest LLP",
			})
		).toEqual({
			type: "guest_lawyer",
			source: "manual",
			name: "Guest Counsel",
			email: "guest@example.com",
			firm: "Guest LLP",
		});
	});

	it("accepts an LSO-enriched guest lawyer snapshot", () => {
		expect(
			parseSelectedLawyerSnapshot({
				type: "guest_lawyer",
				source: "lso_search",
				name: "Guest Counsel",
				email: "guest@example.com",
				lso: {
					barNumber: "LSO123",
					jurisdiction: "ON",
					licensingStatus: "licensed",
					lsoLawyerId: "lsoLawyer_test",
					restrictionStatus: "clear",
					source: "test",
					sourceFetchedAt: 123,
				},
			})
		).toEqual({
			type: "guest_lawyer",
			source: "lso_search",
			name: "Guest Counsel",
			email: "guest@example.com",
			lso: {
				barNumber: "LSO123",
				jurisdiction: "ON",
				licensingStatus: "licensed",
				lsoLawyerId: "lsoLawyer_test",
				restrictionStatus: "clear",
				source: "test",
				sourceFetchedAt: 123,
			},
		});
	});

	it("rejects guest lawyer snapshots without an explicit source", () => {
		expect(() =>
			parseSelectedLawyerSnapshot({
				type: "guest_lawyer",
				name: "Guest Counsel",
				email: "guest@example.com",
			})
		).toThrow("selectedLawyer.source");
	});

	it("rejects LSO-backed guest lawyer snapshots without LSO metadata", () => {
		expect(() =>
			parseSelectedLawyerSnapshot({
				type: "guest_lawyer",
				source: "lso_search",
				name: "Guest Counsel",
				email: "guest@example.com",
			})
		).toThrow("LSO-backed guest lawyer snapshots must include lso");
	});

	it("rejects LSO-backed guest lawyer snapshots without registry identity fields", () => {
		expect(() =>
			parseSelectedLawyerSnapshot({
				type: "guest_lawyer",
				source: "lso_search",
				name: "Guest Counsel",
				email: "guest@example.com",
				lso: {
					barNumber: "LSO123",
					jurisdiction: "ON",
					licensingStatus: "licensed",
					restrictionStatus: "clear",
				},
			})
		).toThrow(
			"LSO-backed guest lawyer snapshots must include lsoLawyerId, barNumber, and jurisdiction"
		);
	});

	it("accepts an LSO-enriched platform lawyer snapshot", () => {
		expect(
			parseSelectedLawyerSnapshot({
				type: "platform_lawyer",
				lawyerId: "lawyer_123",
				name: "Pat Lawyer",
				email: "pat@example.com",
				lso: {
					barNumber: "LSO123",
					jurisdiction: "ON",
					licensingStatus: "licensed",
					restrictionStatus: "clear",
				},
			})
		).toMatchObject({
			type: "platform_lawyer",
			lawyerId: "lawyer_123",
			lso: {
				barNumber: "LSO123",
				jurisdiction: "ON",
			},
		});
	});

	it("rejects missing name or email", () => {
		expect(() =>
			parseSelectedLawyerSnapshot({
				type: "guest_lawyer",
				email: "guest@example.com",
			})
		).toThrow("selectedLawyer.name");

		expect(() =>
			parseSelectedLawyerSnapshot({
				type: "guest_lawyer",
				name: "Guest Counsel",
			})
		).toThrow("selectedLawyer.email");
	});

	it("rejects invalid lawyer type", () => {
		expect(() =>
			parseSelectedLawyerSnapshot({
				type: "broker_lawyer",
				name: "Pat Lawyer",
				email: "pat@example.com",
			})
		).toThrow("selectedLawyer.type");
	});

	it("rejects guest lawyer snapshots with lawyerId", () => {
		expect(() =>
			parseSelectedLawyerSnapshot({
				type: "guest_lawyer",
				lawyerId: "lawyer_123",
				name: "Guest Counsel",
				email: "guest@example.com",
			})
		).toThrow("guest lawyer snapshots must not include lawyerId");
	});
});
