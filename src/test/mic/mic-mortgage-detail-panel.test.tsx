/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { micMortgageDetailFixtures } from "#/components/mic/portal/fixtures";
import { MicMortgageDetailPanel } from "#/components/mic/portal/MicMortgageDetailPanel";

vi.mock("#/hooks/use-mobile", () => ({
	useIsMobile: vi.fn(),
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("MicMortgageDetailPanel", () => {
	it("renders the desktop sheet host for mortgage drilldown", async () => {
		const { useIsMobile } = await import("#/hooks/use-mobile");
		vi.mocked(useIsMobile).mockReturnValue(false);

		render(
			<MicMortgageDetailPanel
				detail={micMortgageDetailFixtures.mortgage_king}
				mortgageId="mortgage_king"
				onOpenChange={() => undefined}
				open
			/>
		);

		expect(
			screen
				.getByTestId("mic-mortgage-detail-panel")
				.className.includes("sm:max-w-[72rem]")
		).toBe(true);
		expect(screen.getByText("Read-only operational transparency")).toBeTruthy();
	});

	it("renders the mobile drawer host for mortgage drilldown", async () => {
		const { useIsMobile } = await import("#/hooks/use-mobile");
		vi.mocked(useIsMobile).mockReturnValue(true);

		render(
			<MicMortgageDetailPanel
				detail={micMortgageDetailFixtures.mortgage_queen}
				mortgageId="mortgage_queen"
				onOpenChange={() => undefined}
				open
			/>
		);

		expect(
			screen
				.getByTestId("mic-mortgage-detail-panel")
				.className.includes("h-[92vh]")
		).toBe(true);
		expect(screen.getByText("Mortgage views")).toBeTruthy();
		expect(screen.getByRole("tab", { name: "History" })).toBeTruthy();
	});
});
