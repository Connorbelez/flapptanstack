/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { micMortgageDetailFixtures, micPortfolioSnapshotFixture } from "#/components/mic/portal/fixtures";
import { MicPortfolioPage } from "#/components/mic/portal/MicPortfolioPage";
import {
	DEFAULT_MIC_PORTFOLIO_FILTER_STATE,
	type MicPortfolioFilterState,
} from "#/components/mic/portal/types";

vi.mock("#/hooks/use-mobile", () => ({
	useIsMobile: () => false,
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

function renderPage({
	onOpenMortgagePage,
}: {
	onOpenMortgagePage?: (mortgageId: string) => void;
}) {
	let filters: MicPortfolioFilterState = DEFAULT_MIC_PORTFOLIO_FILTER_STATE;
	let view!: ReturnType<typeof render>;

	const renderNode = () => (
		<MicPortfolioPage
			filters={filters}
			onFiltersChange={(updater) => {
				filters = updater(filters);
				view.rerender(renderNode());
			}}
			onOpenMortgagePage={onOpenMortgagePage}
			selectedMortgageDetail={
				filters.detailMortgageId
					? micMortgageDetailFixtures[filters.detailMortgageId]
					: null
			}
			snapshot={micPortfolioSnapshotFixture}
		/>
	);

	view = render(renderNode());

	return view;
}

describe("MicPortfolioPage", () => {
	it("renders MIC dashboard framing and filters positions by search", () => {
		renderPage({});

		expect(
			screen.getByRole("heading", { name: "FairLend MIC" })
		).toBeTruthy();
		expect(screen.getByText("Outstanding principal")).toBeTruthy();

		fireEvent.change(screen.getByLabelText("Search MIC mortgages"), {
			target: { value: "Queen" },
		});

		expect(screen.getByTestId("mic-position-row-mortgage_queen")).toBeTruthy();
		expect(
			screen.queryByTestId("mic-position-row-mortgage_king")
		).toBeNull();
	});

	it("opens the mortgage detail panel and triggers the full-detail callback", () => {
		const onOpenMortgagePage = vi.fn();
		renderPage({ onOpenMortgagePage });

		fireEvent.click(
			within(
				screen.getByTestId("mic-position-row-mortgage_queen")
			).getByRole("button", {
				name: /Open MIC mortgage details for 88 Queen St W/i,
			})
		);

		expect(screen.getByTestId("mic-mortgage-detail-panel")).toBeTruthy();
		expect(screen.getByText("Retail collateral with an active payment exception and near-term maturity.")).toBeTruthy();

		fireEvent.click(
			screen.getByRole("button", { name: /Open full mortgage detail/i })
		);

		expect(onOpenMortgagePage).toHaveBeenCalledWith("mortgage_queen");
	});
});
