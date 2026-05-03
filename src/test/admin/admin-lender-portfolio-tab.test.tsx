/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminLenderPortfolioTab } from "#/components/admin/lenders/AdminLenderPortfolioTab";
import { resolveRecordSidebarEntityAdapter } from "#/components/admin/shell/entity-view-adapters";
import { portfolioCommandCenterFixture } from "#/components/lender/portfolio/fixtures";

vi.mock("@tanstack/react-query", () => ({
	useSuspenseQuery: vi.fn(),
}));

vi.mock("#/components/lender/portfolio/LenderPortfolioPage", () => ({
	LenderPortfolioPage: ({
		queryMode,
		snapshot,
	}: {
		queryMode: { targetLenderId: string };
		snapshot: typeof portfolioCommandCenterFixture;
	}) => (
		<div data-testid="portfolio-page">
			<span>{queryMode.targetLenderId}</span>
			<span>{snapshot.cockpit.metrics.activePositionCount}</span>
		</div>
	),
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("AdminLenderPortfolioTab", () => {
	it("renders admin audit context and the shared portfolio page", () => {
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: portfolioCommandCenterFixture,
		} as never);

		render(
			<AdminLenderPortfolioTab
				brokerLabel="Meridian Brokerage"
				lenderLabel="Meridian Capital"
				targetLenderId={"lender_123" as never}
			/>
		);

		expect(screen.getByText(/Viewing lender portfolio as admin/i)).toBeTruthy();
		expect(screen.getByText(/Meridian Capital/)).toBeTruthy();
		expect(screen.getByText(/Meridian Brokerage/)).toBeTruthy();
		expect(screen.getByTestId("portfolio-page")).toBeTruthy();
		expect(screen.getByText("lender_123")).toBeTruthy();
	});

	it("marks the MIC lender without changing the shared portfolio body", () => {
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: portfolioCommandCenterFixture,
		} as never);

		render(
			<AdminLenderPortfolioTab
				isMicLender
				lenderLabel="FairLend MIC"
				targetLenderId={"lender_mic" as never}
			/>
		);

		expect(screen.getAllByText("FairLend MIC").length).toBeGreaterThan(0);
		expect(screen.getByTestId("portfolio-page")).toBeTruthy();
	});

	it("exposes a Portfolio tab renderer for lender records only", () => {
		const lenderAdapter = resolveRecordSidebarEntityAdapter({
			entityType: "lenders",
			objectDef: undefined,
		});
		const borrowerAdapter = resolveRecordSidebarEntityAdapter({
			entityType: "borrowers",
			objectDef: undefined,
		});

		expect(lenderAdapter?.renderPortfolioTab).toBeTypeOf("function");
		expect(borrowerAdapter?.renderPortfolioTab).toBeUndefined();
	});
});
