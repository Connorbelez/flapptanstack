import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { roundToTwoDecimals } from "../math";

describe("roundToTwoDecimals", () => {
	it("throws for non-finite values", () => {
		expect(() => roundToTwoDecimals(Number.NaN)).toThrow(ConvexError);
		expect(() => roundToTwoDecimals(Number.POSITIVE_INFINITY)).toThrow(
			ConvexError
		);
	});

	it("corrects common floating-point two-decimal edge cases", () => {
		expect(roundToTwoDecimals(1.005)).toBe(1.01);
		expect(roundToTwoDecimals(10.075)).toBe(10.08);
		expect(roundToTwoDecimals(-1.005)).toBe(-1.01);
	});

	it("normalizes negative zero", () => {
		expect(Object.is(roundToTwoDecimals(-0), -0)).toBe(false);
		expect(roundToTwoDecimals(-0)).toBe(0);
	});
});
