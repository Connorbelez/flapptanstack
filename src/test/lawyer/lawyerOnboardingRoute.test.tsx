/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { useMutation } from "convex/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LawyerOnboardingPage } from "#/components/legal-representation/LawyerOnboardingPage";

vi.mock("convex/react", () => ({
	useMutation: vi.fn(),
}));

afterEach(() => {
	cleanup();
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

describe("lawyer onboarding route UI", () => {
	it("renders the current onboarding checkpoint", async () => {
		vi.mocked(useMutation).mockReturnValue(vi.fn());

		render(<LawyerOnboardingPage session={identityPendingFixture} />);

		expect(
			screen.getByRole("heading", { name: /Confirm identity/i })
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: /Confirm identity/i })
		).toBeTruthy();
	});
});
