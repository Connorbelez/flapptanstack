/**
 * @vitest-environment jsdom
 */

import { cleanup, render, waitFor } from "@testing-library/react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useAction, useMutation, useQuery } from "convex/react";
import { Window } from "happy-dom";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LawyerWorkosInvitationRouteContent } from "#/routes/lawyer/invitation";
import {
	buildLawyerWorkosInvitationPath,
} from "#/routes/lawyer/invitation";
import {
	buildLawyerOnboardingSessionPath,
	buildLawyerVerifyRedirectPath,
	buildVerifiedLawyerReturnPath,
	LawyerVerifyRouteContent,
	getLawyerVerifyTerminalCopy,
} from "#/routes/lawyer/verify.$token";

vi.mock("@tanstack/react-router", () => {
	return {
		createFileRoute: () => (config: unknown) => config,
		Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
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

const useActionMock = useAction as unknown as ReturnType<typeof vi.fn>;
const useAuthMock = useAuth as unknown as ReturnType<typeof vi.fn>;
const useNavigateMock = useNavigate as unknown as ReturnType<typeof vi.fn>;
let testWindow: Window | null = null;

beforeEach(() => {
	testWindow = new Window({
		url: "http://admin.localhost:3000/lawyer/invitation",
	});
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: testWindow,
	});
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: testWindow.document,
	});
	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: testWindow.navigator,
	});
	Object.defineProperty(globalThis, "HTMLElement", {
		configurable: true,
		value: testWindow.HTMLElement,
	});
	Object.defineProperty(globalThis, "Element", {
		configurable: true,
		value: testWindow.Element,
	});
	Object.defineProperty(globalThis, "Node", {
		configurable: true,
		value: testWindow.Node,
	});
	Object.defineProperty(testWindow, "SyntaxError", {
		configurable: true,
		value: SyntaxError,
	});
});

afterEach(() => {
	cleanup();
	void testWindow?.happyDOM.abort();
	testWindow = null;
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

	it("links legacy verification fallback to the orchestrator session route", () => {
		expect(buildLawyerOnboardingSessionPath("session_123")).toBe(
			"/lawyer/onboarding/session_123"
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

		useNavigateMock.mockReturnValue(mockNavigate);
		useAuthMock.mockReturnValue({
			loading: false,
			user: { id: "user_123" },
		} as never);
		let actionCallIndex = 0;
		useActionMock.mockImplementation(() => {
			actionCallIndex += 1;
			return actionCallIndex % 2 === 1 ? completeInvitation : resolveInvitation;
		});

		const view = render(
			<LawyerWorkosInvitationRouteContent invitationToken="workos_token" />
		);

		await view.findByText(/Preparing invitation/i);
		await waitFor(() =>
			expect(mockNavigate).toHaveBeenCalledWith({
				href: "/lawyer/onboarding/session_123",
			})
		);
	});
});

describe("lawyer legacy verification route", () => {
	it("routes authenticated selected targets without lawyer role into deal onboarding session", async () => {
		const mockNavigate = vi.fn().mockResolvedValue(undefined);
		const acceptInvitation = vi.fn();
		const startOrResumeForDeal = vi.fn().mockResolvedValue({
			session: {
				_id: "session_from_deal",
				nextRoute: "/lawyer/onboarding/session_from_deal",
			},
		});

		useNavigateMock.mockReturnValue(mockNavigate);
		useAuthMock.mockReturnValue({
			loading: false,
			permissions: [],
			role: "member",
			roles: ["member"],
			user: { id: "user_123" },
		} as never);
		const useQueryMock = useQuery as unknown as ReturnType<typeof vi.fn>;
		const useMutationMock = useMutation as unknown as ReturnType<typeof vi.fn>;
		useQueryMock.mockReturnValue({
			dealId: "deal_123",
			status: "pending",
		} as never);
		let mutationCallIndex = 0;
		useMutationMock.mockImplementation(() => {
			mutationCallIndex += 1;
			return mutationCallIndex % 2 === 1
				? acceptInvitation
				: startOrResumeForDeal;
		});

		render(<LawyerVerifyRouteContent token="manual_token" />);

		await waitFor(() =>
			expect(startOrResumeForDeal).toHaveBeenCalledWith({ dealId: "deal_123" })
		);
		expect(acceptInvitation).not.toHaveBeenCalled();
		await waitFor(() =>
			expect(mockNavigate).toHaveBeenCalledWith({
				href: "/lawyer/onboarding/session_from_deal",
			})
		);
	});
});
