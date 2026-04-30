import { describe, expect, it } from "vitest";
import {
	buildLawyerVerifyRedirectPath,
	getLawyerVerifyTerminalCopy,
} from "#/routes/lawyer/verify.$token";

describe("lawyer verification route helpers", () => {
	it("builds safe verification redirect paths for AuthKit resume", () => {
		expect(buildLawyerVerifyRedirectPath("token_123")).toBe(
			"/lawyer/verify/token_123"
		);
		expect(buildLawyerVerifyRedirectPath("token with spaces")).toBe(
			"/lawyer/verify/token%20with%20spaces"
		);
	});

	it("defines fail-closed copy for invalid invitation states", () => {
		expect(getLawyerVerifyTerminalCopy("not_found")).toMatchObject({
			title: "Invitation not found",
		});
		expect(getLawyerVerifyTerminalCopy("expired")).toMatchObject({
			title: "Invitation expired",
		});
		expect(getLawyerVerifyTerminalCopy("revoked")).toMatchObject({
			title: "Invitation revoked",
		});
	});

	it("separates verified and used invitation states", () => {
		expect(getLawyerVerifyTerminalCopy("verified")).toMatchObject({
			title: "Invitation already verified",
		});
		expect(getLawyerVerifyTerminalCopy("used")).toMatchObject({
			title: "Invitation already used",
		});
	});
});
