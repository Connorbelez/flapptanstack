import { describe, expect, it } from "vitest";
import {
	buildLawyerWorkosInvitationPath,
} from "#/routes/lawyer/invitation";
import {
	buildLawyerOnboardingPath,
	buildLawyerVerifyRedirectPath,
	buildVerifiedLawyerReturnPath,
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

	it("links verified invitations back to the shared deal portal", () => {
		expect(buildVerifiedLawyerReturnPath("deal_123")).toBe("/deals/deal_123");
		expect(buildVerifiedLawyerReturnPath("deal with spaces")).toBe(
			"/deals/deal%20with%20spaces"
		);
	});

	it("preserves deal portal return through lawyer onboarding", () => {
		expect(buildLawyerOnboardingPath("deal_123")).toBe(
			"/onboard?context=deal-representation&redirect=%2Fdeals%2Fdeal_123"
		);
	});

	it("builds the WorkOS invitation landing path with invitation_token", () => {
		expect(buildLawyerWorkosInvitationPath("workos token")).toBe(
			"/lawyer/invitation?invitation_token=workos+token"
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
