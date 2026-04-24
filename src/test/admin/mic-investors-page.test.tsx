/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminMicInvestorRequestsPage } from "#/components/admin/mic-investors/AdminMicInvestorRequestsPage";

vi.mock("convex/react", () => ({
	useMutation: vi.fn(() => vi.fn()),
	useQuery: vi.fn(),
}));

describe("AdminMicInvestorRequestsPage", () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it("renders pending MIC requests with approve and reject actions", async () => {
		const { useQuery } = await import("convex/react");
		vi.mocked(useQuery).mockReturnValue([
			{
				portal: { slug: "mic" },
				request: {
					_id: "mic_req_1",
					email: "investor@example.com",
					provisioningState: "pending",
					status: "pending_review",
				},
			},
		] as never);

		render(<AdminMicInvestorRequestsPage />);

		expect(screen.getByText("investor@example.com")).toBeTruthy();
		expect(screen.getByText("mic")).toBeTruthy();
		expect(screen.getByRole("button", { name: /Approve/i })).toBeTruthy();
		expect(screen.getByRole("button", { name: /Reject/i })).toBeTruthy();
	});
});
