/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useAction } from "convex/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LawyerWorkosInvitationRouteContent } from "#/routes/lawyer/invitation";
import {
	buildLawyerWorkosInvitationPath,
} from "#/routes/lawyer/invitation";
import {
	buildLawyerOnboardingPath,
	buildLawyerVerifyRedirectPath,
	buildVerifiedLawyerReturnPath,
	getLawyerVerifyTerminalCopy,
} from "#/routes/lawyer/verify.$token";

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
		"@tanstack/react-router"
	);

	return {
		...actual,
		useNavigate: vi.fn(),
	};
});

vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
	useAuth: vi.fn(),
}));

vi.mock("convex/react", () => ({
	Authenticated: ({ children }: { children: ReactNode }) => <>{children}</>,
	AuthLoading: ({ children }: { children: ReactNode }) => <>{children}</>,
	useAction: vi.fn(),
	useMutation: vi.fn(),
	useQuery: vi.fn(),
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

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

describe("lawyer WorkOS invitation route", () => {
	it("routes WorkOS invitation completion into lawyer onboarding", async () => {
		const mockNavigate = vi.fn().mockResolvedValue(undefined);
		const completeInvitation = vi.fn().mockResolvedValue({
			dealId: "deal_123",
			invitationId: "invitation_123",
			onboardingSessionId: "session_123",
			returnPath: "/deals/deal_123",
			status: "onboarding_required",
			targetEmail: "guest@example.test",
		});
		const resolveInvitation = vi.fn().mockResolvedValue({
			dealId: "deal_123",
			emailMatches: true,
			onboardingSessionId: "session_123",
			status: "pending",
			targetEmail: "guest@example.test",
		});

		vi.mocked(useNavigate).mockReturnValue(mockNavigate);
		vi.mocked(useAuth).mockReturnValue({
			loading: false,
			user: { id: "user_123" },
		} as never);
		let actionCallIndex = 0;
		vi.mocked(useAction).mockImplementation(() => {
			actionCallIndex += 1;
			return actionCallIndex % 2 === 1 ? completeInvitation : resolveInvitation;
		});

		render(
			<LawyerWorkosInvitationRouteContent invitationToken="workos_token" />
		);

		await screen.findByText(/Preparing invitation/i);
		await waitFor(() =>
			expect(mockNavigate).toHaveBeenCalledWith({
				href: "/lawyer/onboarding/session_123",
			})
		);
	});
});
