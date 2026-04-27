/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MicPortalIndexRoutePage } from "#/routes/portal/index";
import { Route as RootRoute } from "#/routes/__root";

vi.mock("@tanstack/react-query", () => ({
	useSuspenseQuery: vi.fn(),
}));

vi.mock("#/routes/__root", () => ({
	Route: {
		useRouteContext: vi.fn(),
	},
}));

vi.mock("#/components/mic/query-options", () => ({
	micDashboardSnapshotQueryOptions: vi.fn(() => ({
		queryKey: ["mic-dashboard"],
	})),
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

const mockMetrics = {
	activePositionCount: 3,
	arrearsExposure: 0,
	delinquencyExposure: 0,
	outstandingPrincipal: 1500000,
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
};

const mockSnapshot = {
	generatedAt: Date.now(),
	sourceOfTruth: "mortgage_ledger_lender_participation" as const,
	dataCompleteness: "partial" as const,
	warnings: ["MIC treasury metrics are intentionally omitted."],
	metrics: mockMetrics,
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

describe("MIC dashboard", () => {
	beforeEach(() => {
		vi.mocked(RootRoute.useRouteContext).mockReturnValue(
			MIC_PORTAL_CONTEXT as never
		);
	});

	it("renders dashboard metrics with correct formatted values", () => {
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: mockSnapshot,
		} as never);

		render(<MicPortalIndexRoutePage />);

		expect(screen.getByText("Outstanding Principal")).toBeTruthy();
		expect(screen.getByText("$1,500,000.00")).toBeTruthy();
		expect(screen.getByText("Active Positions")).toBeTruthy();
		expect(screen.getByText("3")).toBeTruthy();
		expect(screen.getByText("Weighted Average Yield")).toBeTruthy();
		expect(screen.getByText("8.25%")).toBeTruthy();
		expect(screen.getByText("Weighted Average LTV")).toBeTruthy();
		expect(screen.getByText("72.50%")).toBeTruthy();
		expect(screen.getByText("Arrears Exposure")).toBeTruthy();
		expect(screen.getByText("$0.00")).toBeTruthy();
		expect(screen.getByText("Delinquency Exposure")).toBeTruthy();
		expect(screen.getByText("$0.00")).toBeTruthy();
	});

	it("renders positions table with correct rows", () => {
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: mockSnapshot,
		} as never);

		render(<MicPortalIndexRoutePage />);

		expect(screen.getByText("123 Main St, Toronto")).toBeTruthy();
		expect(screen.getByText("Test Borrower")).toBeTruthy();
		expect(screen.getByText("$500,000.00")).toBeTruthy();
		expect(screen.getByText("8.50%")).toBeTruthy();
		expect(screen.getByText("70.00%")).toBeTruthy();
		expect(screen.getByText("2027-06-15")).toBeTruthy();
	});

	it("renders warnings banner when data completeness is partial", () => {
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: mockSnapshot,
		} as never);

		render(<MicPortalIndexRoutePage />);

		expect(
			screen.getByText(/Portfolio data is partially complete/i)
		).toBeTruthy();
		expect(
			screen.getByText(/MIC treasury metrics are intentionally omitted/i)
		).toBeTruthy();
	});

	it("renders empty state when positions array is empty", () => {
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: { ...mockSnapshot, positions: [] },
		} as never);

		render(<MicPortalIndexRoutePage />);

		expect(screen.getByText("No active MIC positions found.")).toBeTruthy();
	});

	it("renders concentration breakdowns", () => {
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: mockSnapshot,
		} as never);

		render(<MicPortalIndexRoutePage />);

		expect(screen.getByText("Concentration Exposure")).toBeTruthy();
		expect(screen.getByText("By Borrower")).toBeTruthy();
		expect(screen.getByText("By Geography")).toBeTruthy();
		expect(screen.getByText("By Property Type")).toBeTruthy();
		expect(screen.getByText("By Status")).toBeTruthy();
		expect(screen.getByText("Test Borrower")).toBeTruthy();
		expect(screen.getByText("ON")).toBeTruthy();
		expect(screen.getByText("Single Family")).toBeTruthy();
		expect(screen.getByText("active")).toBeTruthy();
	});

	it("renders maturity ladder", () => {
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: mockSnapshot,
		} as never);

		render(<MicPortalIndexRoutePage />);

		expect(screen.getByText("Maturity Ladder")).toBeTruthy();
		expect(screen.getByText("6–12 Months")).toBeTruthy();
		expect(screen.getByText("$500,000.00")).toBeTruthy();
	});

	it("opens drawer on position table row click", () => {
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: mockSnapshot,
		} as never);

		render(<MicPortalIndexRoutePage />);

		const row = screen.getByText("123 Main St, Toronto").closest("tr");
		expect(row).toBeTruthy();
		if (row) fireEvent.click(row);

		expect(
			screen.getByTestId("position-drawer").getAttribute("data-open")
		).toBe("true");
		expect(screen.getByText("drawer-content")).toBeTruthy();
	});
});
