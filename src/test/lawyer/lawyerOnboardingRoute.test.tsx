/**
 * @vitest-environment jsdom
 */

import { cleanup, render } from "@testing-library/react";
import { useMutation } from "convex/react";
import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LawyerOnboardingPage } from "#/components/legal-representation/LawyerOnboardingPage";

vi.mock("convex/react", () => ({
	useMutation: vi.fn(),
}));

function mockUseMutation() {
	(useMutation as unknown as { mockReturnValue: (value: unknown) => void })
		.mockReturnValue(vi.fn());
}

let testWindow: Window | null = null;

beforeEach(() => {
	testWindow = new Window({
		url: "http://admin.localhost:3000/lawyer/onboarding/session_123",
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

const identityPendingFixture = {
	_creationTime: 1_777_800_000_000,
	_id: "session_123",
	createdAt: 1_777_800_000_000,
	currentStep: "auth",
	dealId: "deal_123",
	nextRoute: "/lawyer/onboarding/session_123",
	normalizedTargetEmail: "guest@example.test",
	path: "guest_invited",
	returnPath: "/deals/deal_123",
	status: "identity_pending",
	updatedAt: 1_777_800_000_000,
	workosUserId: "user_123",
} as const;

const platformAgreementPendingFixture = {
	_creationTime: 1_777_800_000_000,
	_id: "session_platform_123",
	createdAt: 1_777_800_000_000,
	currentStep: "engagement",
	nextRoute: "/lawyer/onboarding/session_platform_123",
	normalizedTargetEmail: "platform@example.test",
	path: "platform_application",
	platformLawyerInvitationId: "platform_invitation_123",
	returnPath: "/lawyer",
	status: "engagement_pending",
	updatedAt: 1_777_800_000_000,
	workosUserId: "user_platform_123",
} as const;

const guestCompleteFixture = {
	...identityPendingFixture,
	completedAt: 1_777_800_010_000,
	currentStep: "complete",
	nextRoute: "/deals/deal_123",
	status: "complete",
	updatedAt: 1_777_800_010_000,
} as const;

describe("lawyer onboarding route UI", () => {
	it("renders the current onboarding checkpoint", async () => {
		mockUseMutation();

		const view = render(
			<LawyerOnboardingPage session={identityPendingFixture} />
		);

		expect(
			view.getByRole("heading", { name: /Confirm your identity/i })
		).toBeTruthy();
		expect(
			view.getByRole("button", { name: /Confirm your identity/i })
		).toBeTruthy();
	});

	it("links completed guest lawyers back to the deal workspace", async () => {
		mockUseMutation();

		const view = render(<LawyerOnboardingPage session={guestCompleteFixture} />);

		const link = view.getByRole("link", { name: /Go to deal workspace/i });
		expect(link.getAttribute("href")).toBe("/deals/deal_123");
	});

	it("renders platform onboarding without a deal context", async () => {
		mockUseMutation();

		const view = render(
			<LawyerOnboardingPage session={platformAgreementPendingFixture} />
		);

		expect(
			view.getByRole("heading", { name: /Accept platform agreement/i })
		).toBeTruthy();
		expect(
			view.getByRole("button", { name: /Accept platform agreement/i })
		).toBeTruthy();
	});
});
