/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	emptyPortfolioHistoricalSeriesFixture,
	portfolioCommandCenterFixture,
	portfolioHistoricalSeriesFixture,
	portfolioTaxExportFixture,
	unavailablePortfolioTaxExportFixture,
} from "#/components/lender/portfolio/fixtures";
import {
	LenderPortfolioPage,
	type LenderPortfolioPageLeafStateOverrides,
} from "#/components/lender/portfolio/LenderPortfolioPage";

vi.mock("#/components/admin/financial-ledger/csv", () => ({
	downloadCsv: vi.fn(),
}));

vi.mock("#/components/lender/portfolio/renewals/renewal-actions", () => ({
	RenewalActionSurface: ({
		mortgageId,
		variant,
	}: {
		mortgageId: string;
		variant: string;
	}) => (
		<div data-testid={`renewal-action-surface-mock-${variant}-${mortgageId}`} />
	),
}));

const TEST_CHART_RECT = {
	bottom: 320,
	height: 320,
	left: 0,
	right: 960,
	toJSON: () => undefined,
	top: 0,
	width: 960,
	x: 0,
	y: 0,
} satisfies DOMRectReadOnly;

class ResizeObserverMock {
	constructor(private readonly callback: ResizeObserverCallback) {}

	disconnect() {}
	observe(target: Element) {
		this.callback(
			[
				{
					borderBoxSize: [],
					contentBoxSize: [],
					contentRect: TEST_CHART_RECT,
					devicePixelContentBoxSize: [],
					target,
				} as ResizeObserverEntry,
			],
			this as never
		);
	}
	unobserve() {}
}

const originalClientHeightDescriptor = Object.getOwnPropertyDescriptor(
	HTMLElement.prototype,
	"clientHeight"
);
const originalClientWidthDescriptor = Object.getOwnPropertyDescriptor(
	HTMLElement.prototype,
	"clientWidth"
);

function restoreHTMLElementDescriptor(
	propertyName: "clientHeight" | "clientWidth",
	descriptor: PropertyDescriptor | undefined
) {
	if (descriptor) {
		Object.defineProperty(HTMLElement.prototype, propertyName, descriptor);
		return;
	}

	delete HTMLElement.prototype[propertyName];
}

beforeEach(() => {
	vi.stubGlobal("ResizeObserver", ResizeObserverMock);
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
		() => TEST_CHART_RECT
	);
	Object.defineProperty(HTMLElement.prototype, "clientHeight", {
		configurable: true,
		get: () => TEST_CHART_RECT.height,
	});
	Object.defineProperty(HTMLElement.prototype, "clientWidth", {
		configurable: true,
		get: () => TEST_CHART_RECT.width,
	});
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	restoreHTMLElementDescriptor(
		"clientHeight",
		originalClientHeightDescriptor
	);
	restoreHTMLElementDescriptor("clientWidth", originalClientWidthDescriptor);
});

function buildLeafStateOverrides(
	overrides?: Partial<LenderPortfolioPageLeafStateOverrides>
): LenderPortfolioPageLeafStateOverrides {
	return {
		cockpit: {
			historySeries: portfolioHistoricalSeriesFixture,
			historyState: "ready",
			...overrides?.cockpit,
		},
		exportStrip: {
			canExportTax: true,
			exportContract: portfolioTaxExportFixture,
			exportState: "ready",
			...overrides?.exportStrip,
		},
	};
}

function renderPage(overrides?: Partial<LenderPortfolioPageLeafStateOverrides>) {
	return render(
		<LenderPortfolioPage
			leafStateOverrides={buildLeafStateOverrides(overrides)}
			portalId={"portal_meridian" as never}
			search={{
				paymentSort: "due-desc",
				positionSort: "next-payment-soonest",
			}}
			setSearch={() => undefined}
			snapshot={portfolioCommandCenterFixture}
		/>
	);
}

describe("lender portfolio cockpit and export strip", () => {
	it("renders cockpit metrics, completeness labels, and the CSV export CTA", () => {
		renderPage();

		expect(screen.getByTestId("portfolio-cockpit")).toBeTruthy();
		expect(screen.getByText("YTD accrued")).toBeTruthy();
		expect(screen.getByText("$9,000")).toBeTruthy();
		expect(screen.getByText("Live period Apr 2026")).toBeTruthy();
		expect(screen.getByText("Projected aggregate earnings")).toBeTruthy();
		expect(screen.getByTestId("portfolio-export-strip")).toBeTruthy();
		expect(screen.getAllByText("2026 year-to-date").length).toBeGreaterThan(0);
		expect(
			(screen.getByRole("button", {
				name: /download csv/i,
			}) as HTMLButtonElement).disabled
		).toBe(false);
	});

	it("keeps the cockpit layout stable when no historical points are available", () => {
		renderPage({
			cockpit: {
				historySeries: emptyPortfolioHistoricalSeriesFixture,
				historyState: "ready",
			},
		});

		expect(screen.getAllByText("No historical trend data yet")).toHaveLength(2);
		expect(screen.getByText("Portfolio breakdown visuals")).toBeTruthy();
	});

	it("shows a layout-safe cockpit error state when the history contract fails", () => {
		renderPage({
			cockpit: {
				historyErrorMessage: "History contract timed out.",
				historySeries: null,
				historyState: "error",
			},
		});

		expect(screen.getAllByText("Trend data unavailable").length).toBeGreaterThan(
			0
		);
		expect(screen.getByText("History contract timed out.")).toBeTruthy();
		expect(screen.getByText("Portfolio breakdown visuals")).toBeTruthy();
	});

	it("disables export with the server-provided unavailable reason", () => {
		renderPage({
			exportStrip: {
				canExportTax: true,
				exportContract: unavailablePortfolioTaxExportFixture,
				exportState: "ready",
			},
		});

		expect(
			(screen.getByRole("button", {
				name: /download csv/i,
			}) as HTMLButtonElement).disabled
		).toBe(true);
		expect(
			screen.getByText(
				"No lender interest income is available for 2026 year-to-date."
			)
		).toBeTruthy();
	});

	it("shows a clear disabled reason when the viewer lacks export permission", () => {
		renderPage({
			exportStrip: {
				canExportTax: false,
				exportContract: null,
				exportState: "forbidden",
			},
		});

		expect(
			(screen.getByRole("button", {
				name: /download csv/i,
			}) as HTMLButtonElement).disabled
		).toBe(true);
		expect(
			screen.getByText(
				"Your current lender access does not include the tax CSV export permission, so the action remains visible but disabled with a clear reason."
			)
		).toBeTruthy();
	});

	it("reuses the shared browser CSV download helper when export is ready", async () => {
		const { downloadCsv } = await import(
			"#/components/admin/financial-ledger/csv"
		);

		renderPage();
		fireEvent.click(screen.getByRole("button", { name: /download csv/i }));

		expect(downloadCsv).toHaveBeenCalledWith(
			"lender-portfolio-tax-export-2026-ytd.csv",
			"period_label,snapshot_date,mortgage_id,mortgage_status,period_income,cumulative_income,projected_aggregate_earnings,ending_balance_units,ending_estimated_value,data_completeness\n2026 year-to-date,2026-04-21,mortgage_king,active,9000,18100,45400,10,360000,live_fallback"
		);
	});
});
