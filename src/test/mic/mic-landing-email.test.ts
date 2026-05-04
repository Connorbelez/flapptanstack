import { describe, expect, it } from "vitest";
import { isValidMicAccessEmail } from "#/components/mic/micLandingEmail";

describe("MIC landing email validation", () => {
	it("accepts typical addresses", () => {
		expect(isValidMicAccessEmail("a@b.co")).toBe(true);
		expect(isValidMicAccessEmail("  test@example.com  ")).toBe(true);
	});

	it("rejects invalid addresses", () => {
		expect(isValidMicAccessEmail("")).toBe(false);
		expect(isValidMicAccessEmail("not-an-email")).toBe(false);
		expect(isValidMicAccessEmail("@nodomain.com")).toBe(false);
	});
});
