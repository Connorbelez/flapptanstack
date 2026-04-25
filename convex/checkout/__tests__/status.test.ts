import { describe, expect, it } from "vitest";
import {
	assertCheckoutTransitionAllowed,
	CHECKOUT_ACTIVE_STATUSES,
	CHECKOUT_ALLOWED_TRANSITIONS,
	CHECKOUT_STATUSES,
	CHECKOUT_TERMINAL_STATUSES,
	type CheckoutStatus,
	canTransitionCheckoutStatus,
	isActiveCheckoutStatus,
	isCheckoutReopenTransition,
	isCheckoutStatus,
	isTerminalCheckoutStatus,
} from "../status";

describe("checkout status contract", () => {
	it("exports the canonical checkout statuses", () => {
		expect(CHECKOUT_STATUSES).toEqual([
			"preparing_provider_session",
			"hosted_checkout_open",
			"payment_failed_retryable",
			"completed",
			"expired",
			"abandoned",
			"provider_start_failed",
			"refunded_late_success",
		]);
	});

	it("classifies terminal and active states", () => {
		expect(CHECKOUT_TERMINAL_STATUSES).toEqual([
			"completed",
			"expired",
			"abandoned",
			"provider_start_failed",
			"refunded_late_success",
		]);
		expect(CHECKOUT_ACTIVE_STATUSES).toEqual([
			"preparing_provider_session",
			"hosted_checkout_open",
			"payment_failed_retryable",
		]);

		for (const status of CHECKOUT_TERMINAL_STATUSES) {
			expect(isTerminalCheckoutStatus(status)).toBe(true);
			expect(isActiveCheckoutStatus(status)).toBe(false);
		}
		for (const status of CHECKOUT_ACTIVE_STATUSES) {
			expect(isActiveCheckoutStatus(status)).toBe(true);
			expect(isTerminalCheckoutStatus(status)).toBe(false);
		}
	});

	it("recognizes valid status strings", () => {
		expect(isCheckoutStatus("hosted_checkout_open")).toBe(true);
		expect(isCheckoutStatus("deposit_pending")).toBe(false);
	});
});

describe("checkout transition contract", () => {
	it("allows preparing provider session transitions", () => {
		expect(CHECKOUT_ALLOWED_TRANSITIONS.preparing_provider_session).toEqual([
			"hosted_checkout_open",
			"provider_start_failed",
		]);
		expect(
			canTransitionCheckoutStatus(
				"preparing_provider_session",
				"hosted_checkout_open"
			)
		).toBe(true);
		expect(
			canTransitionCheckoutStatus("preparing_provider_session", "completed")
		).toBe(false);
	});

	it("allows hosted checkout outcome transitions", () => {
		for (const target of [
			"payment_failed_retryable",
			"completed",
			"expired",
			"abandoned",
			"refunded_late_success",
		] as const satisfies readonly CheckoutStatus[]) {
			expect(canTransitionCheckoutStatus("hosted_checkout_open", target)).toBe(
				true
			);
		}
	});

	it("allows retryable checkout to reopen provider checkout or resolve inactive", () => {
		expect(CHECKOUT_ALLOWED_TRANSITIONS.payment_failed_retryable).toEqual([
			"hosted_checkout_open",
			"expired",
			"abandoned",
			"refunded_late_success",
		]);
		expect(
			canTransitionCheckoutStatus(
				"payment_failed_retryable",
				"hosted_checkout_open"
			)
		).toBe(true);
		expect(
			canTransitionCheckoutStatus("payment_failed_retryable", "completed")
		).toBe(false);
	});

	it("allows late success to resolve terminal invalid sessions as refunded", () => {
		expect(
			canTransitionCheckoutStatus("expired", "refunded_late_success")
		).toBe(true);
		expect(
			canTransitionCheckoutStatus("abandoned", "refunded_late_success")
		).toBe(true);
		expect(
			canTransitionCheckoutStatus(
				"provider_start_failed",
				"refunded_late_success"
			)
		).toBe(true);
		expect(canTransitionCheckoutStatus("expired", "completed")).toBe(false);
		expect(canTransitionCheckoutStatus("expired", "hosted_checkout_open")).toBe(
			false
		);
	});

	it("does not allow terminal states to transition back to active states", () => {
		for (const terminalStatus of CHECKOUT_TERMINAL_STATUSES) {
			for (const activeStatus of CHECKOUT_ACTIVE_STATUSES) {
				expect(isCheckoutReopenTransition(terminalStatus, activeStatus)).toBe(
					true
				);
				expect(canTransitionCheckoutStatus(terminalStatus, activeStatus)).toBe(
					false
				);
			}
		}
	});

	it("throws on invalid transitions", () => {
		expect(() =>
			assertCheckoutTransitionAllowed("completed", "hosted_checkout_open")
		).toThrow("Invalid checkout status transition");
		expect(() =>
			assertCheckoutTransitionAllowed("hosted_checkout_open", "completed")
		).not.toThrow();
	});
});
