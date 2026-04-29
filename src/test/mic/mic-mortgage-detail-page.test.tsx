/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { micMortgageDetailFixtures } from "#/components/mic/portal/fixtures";
import { MicMortgageDetailPage } from "#/components/mic/portal/MicMortgageDetailPage";

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("MicMortgageDetailPage", () => {
	it("renders the full-page MIC mortgage detail with history and disclosures", () => {
		const onBackToPortfolio = vi.fn();

		render(
			<MicMortgageDetailPage
				detail={micMortgageDetailFixtures.mortgage_king}
				onBackToPortfolio={onBackToPortfolio}
			/>
		);

		expect(screen.getByTestId("mic-mortgage-detail-page")).toBeTruthy();
		expect(screen.getByText("Mortgage lifecycle")).toBeTruthy();
		expect(screen.getByText("Disclosures")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: /Back to portfolio/i }));

		expect(onBackToPortfolio).toHaveBeenCalledTimes(1);
	});
});
