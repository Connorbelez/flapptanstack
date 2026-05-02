/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	buildReturnAnalytics,
	buildReturnChartSeries,
} from "#/components/mic/MicPortfolioCharts";
import { MicPortalIndexRoutePage } from "#/routes/portal/index";
import { Route as RootRoute } from "#/routes/__root";

vi.mock("@tanstack/react-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-query")>();
	return {
		...actual,
		useSuspenseQuery: vi.fn(),
	};
});

vi.mock("#/routes/__root", () => ({
	Route: {
		useRouteContext: vi.fn(),
	},
}));

vi.mock("#/components/mic/query-options", () => ({
	micDashboardSnapshotQueryOptions: vi.fn(() => ({
		queryKey: ["mic-dashboard"],
	})),
	micPaymentsHistoryQueryOptions: vi.fn(() => ({
		queryKey: ["mic-payments"],
	})),
}));

vi.mock("#/components/mic/MicMaturityLadder", () => ({
	MicMaturityLadder: () =>
		React.createElement(
			"div",
			{ "data-testid": "mock-maturity-ladder" },
			React.createElement("h2", null, "Maturity ladder"),
			React.createElement("span", null, "6–12 mo")
		),
}));

vi.mock("#/components/mic/MicPositionDetailDrawer", () => ({
	MicPositionDetailDrawer: ({
		open,
		position,
	}: {
		open: boolean;
		onOpenChange: (o: boolean) => void;
		portalId: string;
		position: unknown;
	}) => (
		<div data-testid="position-drawer" data-open={open}>
			{position ? "drawer-content" : "drawer-empty"}
		</div>
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

const mockMetrics = {
	activePositionCount: 3,
	arrearsExposure: 0,
	delinquencyExposure: 0,
	inferredLendingFeeIncome: 25,
	lendingFeeIncomeSharePercent: 100,
	outstandingPrincipal: 1500000,
	totalReturnIncome: 25,
	weightedAverageLtv: 72.5,
	weightedAverageYield: 8.25,
};

const mockPosition = {
	arrearsSignal: { overdueAmount: 0, overdueCount: 0, status: "current" },
	borrowerLabel: "Test Borrower",
	drilldownIds: {
		listingId: "listing_123",
		mortgageId: "mortgage_123",
		positionAccountId: "pos_123",
		propertyId: "prop_123",
	},
	ltv: 70,
	maturityDate: "2027-06-15",
	mortgageId: "mortgage_123",
	outstandingPrincipal: 500000,
	positionAccountId: "pos_123",
	positionUnits: 250000,
	principal: 600000,
	currentPayment: {
		amount: 2500,
		dueDate: "2026-05-01",
		status: "due",
	},
	propertyLabel: "123 Main St, Toronto",
	propertySummary: {
		city: "Toronto",
		propertyType: "Single Family",
		province: "ON",
		streetAddress: "123 Main St",
		unit: null,
	},
	rateYield: 8.5,
	status: "active",
	thumbnailUrl: "https://example.com/property.jpg",
};

const mockPayments = {
	dataCompleteness: "partial" as const,
	generatedAt: Date.now(),
	mortgageId: null,
	rows: [
		{
			amountSettled: 0,
			dueDate: "2026-05-01",
			grossAmount: 5000,
			latestCollectionStatus: "pending",
			latestTransferStatus: null,
			micShareAmount: 2500,
			micSharePercentOfGross: 50,
			mortgageId: "mortgage_123",
			obligationId: "obligation_123",
			paymentNumber: 1,
			propertyLabel: "123 Main St, Toronto",
			rowStatus: "due",
			type: "regular_interest",
		},
	],
	sourceOfTruth: "mortgage_ledger_lender_participation" as const,
	warnings: ["MIC treasury metrics are intentionally omitted."],
};

const mockSnapshot = {
	generatedAt: Date.now(),
	sourceOfTruth: "mortgage_ledger_lender_participation" as const,
	dataCompleteness: "partial" as const,
	warnings: ["MIC treasury metrics are intentionally omitted."],
	metrics: mockMetrics,
	lendingFeeMetrics: {
		feeBasisPoints: 100,
		inferredLendingFeeIncome: 25,
		lendingFeeIncomeSharePercent: 100,
		mortgageOriginatedCount: 1,
		originatedPrincipal: 2500,
		totalInterestIncome: 0,
		totalReturnIncome: 25,
	},
	returnSeries: [
		{
			cumulativeFeeIncome: 25,
			cumulativeInterestIncome: 0,
			cumulativeTotalReturn: 25,
			feeIncome: 25,
			feeIncomeSharePercent: 100,
			interestIncome: 0,
			originatedPrincipal: 2500,
			period: "2026-01",
			totalReturn: 25,
		},
	],
	positions: [mockPosition],
	concentration: {
		byBorrower: [
			{
				count: 1,
				key: "Test Borrower",
				label: "Test Borrower",
				outstandingPrincipal: 500000,
				sharePercent: 33.33,
			},
		],
		byGeography: [
			{
				count: 1,
				key: "ON",
				label: "ON",
				outstandingPrincipal: 500000,
				sharePercent: 33.33,
			},
		],
		byPropertyType: [
			{
				count: 1,
				key: "Single Family",
				label: "Single Family",
				outstandingPrincipal: 500000,
				sharePercent: 33.33,
			},
		],
		byStatus: [
			{
				count: 1,
				key: "active",
				label: "active",
				outstandingPrincipal: 500000,
				sharePercent: 33.33,
			},
		],
	},
	maturityLadder: [
		{ bucket: "6_12_months" as const, count: 1, outstandingPrincipal: 500000 },
	],
};

const realisticMicSnapshot = {
	...mockSnapshot,
	warnings: [
		"MIC treasury, reserve, cash-on-hand, NAV, and personalized investor metrics are intentionally omitted until complete cash-ledger coverage exists.",
	],
	metrics: {
		activePositionCount: 2,
		arrearsExposure: 320000,
		delinquencyExposure: 320000,
		outstandingPrincipal: 470000,
		weightedAverageLtv: 66.09,
		weightedAverageYield: 11.01,
	},
	positions: [
		{
			...mockPosition,
			arrearsSignal: {
				overdueAmount: 800,
				overdueCount: 1,
				status: "exception" as const,
			},
			borrowerLabel: "Riley River",
			drilldownIds: {
				listingId: "listing_riverfront",
				mortgageId: "mortgage_riverfront",
				positionAccountId: "position_riverfront",
				propertyId: "property_riverfront",
			},
			ltv: 68,
			maturityDate: "2027-03-31",
			mortgageId: "mortgage_riverfront",
			outstandingPrincipal: 320000,
			positionAccountId: "position_riverfront",
			positionUnits: 4000,
			principal: 800000,
			propertyLabel: "101 Riverfront Ave, Ottawa",
			propertySummary: {
				city: "Ottawa",
				propertyType: "multi_unit",
				province: "ON",
				streetAddress: "101 Riverfront Ave",
				unit: null,
			},
			rateYield: 11.25,
			status: "active",
		},
		{
			...mockPosition,
			borrowerLabel: "Casey Maple",
			drilldownIds: {
				listingId: "listing_maple",
				mortgageId: "mortgage_maple",
				positionAccountId: "position_maple",
				propertyId: "property_maple",
			},
			ltv: 62,
			maturityDate: "2028-06-30",
			mortgageId: "mortgage_maple",
			outstandingPrincipal: 150000,
			positionAccountId: "position_maple",
			positionUnits: 2500,
			principal: 600000,
			propertyLabel: "88 Maple Ridge Rd, Kingston",
			propertySummary: {
				city: "Kingston",
				propertyType: "residential",
				province: "ON",
				streetAddress: "88 Maple Ridge Rd",
				unit: null,
			},
			rateYield: 10.5,
			status: "funded",
		},
	],
	concentration: {
		...mockSnapshot.concentration,
		byPropertyType: [
			{
				count: 1,
				key: "multi_unit",
				label: "multi_unit",
				outstandingPrincipal: 320000,
				sharePercent: 68.09,
			},
			{
				count: 1,
				key: "residential",
				label: "residential",
				outstandingPrincipal: 150000,
				sharePercent: 31.91,
			},
		],
	},
	maturityLadder: [
		{ bucket: "12_24_months" as const, count: 1, outstandingPrincipal: 320000 },
		{ bucket: "24_plus_months" as const, count: 1, outstandingPrincipal: 150000 },
	],
};

const MIC_PORTAL_CONTEXT = {
	portalContext: {
		availability: "active",
		cacheKey: "portal:portal_mic:active:local:mic.localhost:3000",
		canonicalHost: "mic.localhost:3000",
		kind: "portal",
		matchedHostType: "local",
		portal: {
			defaultPostAuthPath: "/portal",
			isPublished: true,
			localHost: "mic.localhost:3000",
			orgId: "org_mic",
			portalId: "portal_mic",
			portalType: "mic",
			productionHost: "mic.fairlend.ca",
			publicTeaserEnabled: true,
			slug: "mic",
			status: "active",
			teaserListingLimit: 0,
		},
		requestedHost: "mic.localhost:3000",
	},
};

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

function mockMicQueries(dashboard = mockSnapshot, payments = mockPayments) {
	(
		useSuspenseQuery as unknown as {
			mockImplementation: (implementation: (options: unknown) => unknown) => void;
		}
	).mockImplementation((options: unknown) => {
		const queryKey = (options as { queryKey?: string[] }).queryKey;
		if (queryKey?.[0] === "mic-payments") {
			return { data: payments };
		}
		return { data: dashboard };
	});
}

describe("MIC dashboard", () => {
	beforeEach(() => {
		(
			RootRoute.useRouteContext as unknown as {
				mockReturnValue: (value: unknown) => void;
			}
		).mockReturnValue(MIC_PORTAL_CONTEXT);
	});

	it("renders dashboard metrics with correct formatted values", () => {
		mockMicQueries();

		render(<MicPortalIndexRoutePage />);

		expect(screen.getByText("Outstanding principal")).toBeTruthy();
		expect(screen.getByText("$1,500,000.00")).toBeTruthy();
		expect(screen.getByText("Active positions")).toBeTruthy();
		expect(screen.getByText("3")).toBeTruthy();
		expect(screen.getByText("Weighted avg yield")).toBeTruthy();
		expect(screen.getByText("8.25%")).toBeTruthy();
		expect(screen.getByText("Weighted avg LTV")).toBeTruthy();
		expect(screen.getByText("72.50%")).toBeTruthy();
		expect(screen.getByText("Arrears exposure")).toBeTruthy();
		expect(screen.getAllByText("$0.00").length).toBeGreaterThanOrEqual(2);
		expect(screen.getByText("Delinquency exposure")).toBeTruthy();
		expect(screen.getByText("Total return over time")).toBeTruthy();
		expect(screen.getByText("Inferred lending fees")).toBeTruthy();
		expect(screen.getAllByText("$25.00").length).toBeGreaterThan(0);
		expect(screen.getByText("Fee share of income")).toBeTruthy();
		expect(screen.getAllByText("100.00%").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Projected yield earned").length).toBeGreaterThan(0);
		expect(
			screen.getByText("0.02% over $1,527,500.00 projected MIC investment")
		).toBeTruthy();
		expect(screen.getAllByText("$300.00").length).toBeGreaterThan(0);
	});

	it("starts a single-point return graph from the prior month at zero and projects the next month", () => {
		expect(buildReturnChartSeries(mockSnapshot.returnSeries)).toEqual([
			expect.objectContaining({
				cumulativeFeeIncome: 0,
				cumulativeInterestIncome: 0,
				cumulativeTotalReturn: 0,
				period: "2025-12",
			}),
			mockSnapshot.returnSeries[0],
			expect.objectContaining({
				cumulativeFeeIncome: 50,
				cumulativeInterestIncome: 0,
				cumulativeTotalReturn: 50,
				feeIncome: 25,
				interestIncome: 0,
				isProjected: true,
				period: "2026-02",
				totalReturn: 25,
			}),
		]);
	});

	it("projects the next month with recurring interest plus another same-sized origination fee", () => {
		const chartSeries = buildReturnChartSeries([
			{
				cumulativeFeeIncome: 4650,
				cumulativeInterestIncome: 3460.75,
				cumulativeTotalReturn: 8110.75,
				feeIncome: 4650,
				feeIncomeSharePercent: 57.33,
				interestIncome: 3460.75,
				originatedPrincipal: 465_000,
				period: "2027-03",
				totalReturn: 8110.75,
			},
		]);

		expect(chartSeries.at(-1)).toEqual(
			expect.objectContaining({
				cumulativeFeeIncome: 9300,
				cumulativeInterestIncome: 10_382.25,
				cumulativeTotalReturn: 19_682.25,
				feeIncome: 4650,
				interestIncome: 6921.5,
				isProjected: true,
				period: "2027-04",
				totalReturn: 11_571.5,
			})
		);
	});

	it("projects another month of growth using the last originated principal against the existing book", () => {
		const chartSeries = buildReturnChartSeries([
			{
				cumulativeFeeIncome: 1000,
				cumulativeInterestIncome: 100,
				cumulativeTotalReturn: 1100,
				feeIncome: 1000,
				feeIncomeSharePercent: 90.91,
				interestIncome: 100,
				originatedPrincipal: 100_000,
				period: "2027-01",
				totalReturn: 1100,
			},
			{
				cumulativeFeeIncome: 2000,
				cumulativeInterestIncome: 300,
				cumulativeTotalReturn: 2300,
				feeIncome: 1000,
				feeIncomeSharePercent: 86.96,
				interestIncome: 200,
				originatedPrincipal: 100_000,
				period: "2027-02",
				totalReturn: 1200,
			},
		]);

		expect(chartSeries.at(-1)).toEqual(
			expect.objectContaining({
				cumulativeFeeIncome: 3000,
				cumulativeInterestIncome: 600,
				cumulativeTotalReturn: 3600,
				feeIncome: 1000,
				interestIncome: 300,
				isProjected: true,
				period: "2027-03",
				totalReturn: 1300,
			})
		);
	});

	it("reports projected yield earned on a 12-month rolling basis", () => {
		const analytics = buildReturnAnalytics({
			metrics: {
				...mockMetrics,
				outstandingPrincipal: 465_000,
			},
			returnSeries: [
				{
					cumulativeFeeIncome: 4650,
					cumulativeInterestIncome: 3158.13,
					cumulativeTotalReturn: 7808.13,
					feeIncome: 4650,
					feeIncomeSharePercent: 59.55,
					interestIncome: 3158.13,
					originatedPrincipal: 465_000,
					period: "2027-03",
					totalReturn: 7808.13,
				},
			],
		});

		expect(analytics.projectedYieldEarned).toBe(5.41);
		expect(analytics.projectedYieldInvestment).toBe(5_580_000);
		expect(analytics.projectedYieldReturn).toBe(302_134.14);
	});

	it("does not crash when cached dashboard data is missing return metrics", () => {
		const {
			lendingFeeMetrics: _lendingFeeMetrics,
			returnSeries: _returnSeries,
			...staleSnapshot
		} = mockSnapshot;
		mockMicQueries(staleSnapshot);

		render(<MicPortalIndexRoutePage />);

		expect(screen.getByText("Total return over time")).toBeTruthy();
		expect(
			screen.getByText(/Return history appears once MIC-held mortgages/i)
		).toBeTruthy();
	});

	it("renders positions table with correct rows", () => {
		mockMicQueries();

		render(<MicPortalIndexRoutePage />);

		const positionsWrap = screen.getByTestId("mic-positions-table");
		const posTable = within(positionsWrap).getByRole("table");
		expect(within(posTable).getByText("123 Main St, Toronto")).toBeTruthy();
		expect(within(posTable).getByText("Test Borrower")).toBeTruthy();
		expect(within(posTable).getByAltText("123 Main St, Toronto")).toBeTruthy();
		expect(within(posTable).getByText("Due 2026-05-01")).toBeTruthy();
		expect(within(posTable).getByText("$500,000.00")).toBeTruthy();
		expect(within(posTable).getAllByText("8.50%").length).toBeGreaterThan(0);
		expect(within(posTable).getByText("70.00%")).toBeTruthy();
		expect(within(posTable).getByText("2027-06-15")).toBeTruthy();
	});

	it("renders all payments for MIC-held positions", () => {
		mockMicQueries();

		render(<MicPortalIndexRoutePage />);

		expect(screen.getByText("All position payments")).toBeTruthy();
		expect(screen.getByText("Payment Date")).toBeTruthy();
		expect(screen.getByText("mortgage_123")).toBeTruthy();
		expect(screen.getAllByText("$2,500.00").length).toBeGreaterThan(0);
		expect(screen.getByText("pending")).toBeTruthy();
	});

	it("renders realistic MIC scenario rows without unsupported investor metrics", () => {
		mockMicQueries(realisticMicSnapshot);

		render(<MicPortalIndexRoutePage />);

		expect(screen.getByText("$470,000.00")).toBeTruthy();
		const positionsWrap = screen.getByTestId("mic-positions-table");
		const posTable = within(positionsWrap).getByRole("table");
		expect(within(posTable).getByText("101 Riverfront Ave, Ottawa")).toBeTruthy();
		expect(within(posTable).getByText("88 Maple Ridge Rd, Kingston")).toBeTruthy();
		expect(within(posTable).getByText("Riley River")).toBeTruthy();
		expect(within(posTable).getByText("Casey Maple")).toBeTruthy();
		expect(within(posTable).queryByText("5 Oak Lane, London")).toBeNull();
		expect(screen.queryByText(/Cap table/i)).toBeNull();
		expect(screen.queryByText(/Personalized holdings/i)).toBeNull();
	});

	it("renders warnings banner when data completeness is partial", () => {
		mockMicQueries();

		render(<MicPortalIndexRoutePage />);

		expect(
			screen.getByText(/Portfolio data is partially complete/i)
		).toBeTruthy();
		expect(
			screen.getByText(/MIC treasury metrics are intentionally omitted/i)
		).toBeTruthy();
	});

	it("renders empty state when positions array is empty", () => {
		mockMicQueries({ ...mockSnapshot, positions: [] });

		render(<MicPortalIndexRoutePage />);

		expect(screen.getByText("No active MIC positions found.")).toBeTruthy();
	});

	it("renders concentration breakdowns", () => {
		mockMicQueries();

		render(<MicPortalIndexRoutePage />);

		const conc = screen.getByTestId("mic-concentration");
		expect(within(conc).getByText("Concentration exposure")).toBeTruthy();
		expect(within(conc).getByRole("tab", { name: "Borrower" })).toBeTruthy();
		expect(within(conc).getByRole("tab", { name: "Geography" })).toBeTruthy();
		expect(within(conc).getByRole("tab", { name: "Property type" })).toBeTruthy();
		expect(within(conc).getByRole("tab", { name: "Status" })).toBeTruthy();
		const concTable = within(conc).getByRole("table");
		expect(within(concTable).getByText("Test Borrower")).toBeTruthy();
	});

	it("renders maturity ladder", () => {
		mockMicQueries();

		render(<MicPortalIndexRoutePage />);

		expect(screen.getByText("Maturity ladder")).toBeTruthy();
		expect(screen.getByText("6–12 mo")).toBeTruthy();
		expect(screen.getByTestId("mock-maturity-ladder")).toBeTruthy();
	});

	it("opens drawer on position table row click", () => {
		mockMicQueries();

		render(<MicPortalIndexRoutePage />);

		const positionsWrap = screen.getByTestId("mic-positions-table");
		const posTable = within(positionsWrap).getByRole("table");
		const label = within(posTable).getByText("123 Main St, Toronto");
		const row = label.closest("tr");
		expect(row).toBeTruthy();
		if (row) fireEvent.click(row);

		expect(
			screen.getByTestId("position-drawer").getAttribute("data-open")
		).toBe("true");
		expect(screen.getByText("drawer-content")).toBeTruthy();
	});
});
