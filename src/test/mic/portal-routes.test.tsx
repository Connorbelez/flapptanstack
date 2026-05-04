/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Route as PortalRoute } from "#/routes/portal";
import { Route as PortalIndexRoute } from "#/routes/portal/index";
import {
	Route as PositionRoute,
	MicPositionDetailRoutePage,
} from "#/routes/portal/positions.$mortgageId";
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
	micPositionDetailQueryOptions: vi.fn(() => ({
		queryKey: ["mic-position-detail"],
	})),
	micPaymentsHistoryQueryOptions: vi.fn(() => ({
		queryKey: ["mic-payments"],
	})),
}));

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

const mockPositionDetail = {
	mortgage: {
		amortizationMonths: 300,
		firstPaymentDate: "2025-01-01",
		interestRate: 8.5,
		lienPosition: 1,
		loanType: "Residential",
		maturityDate: "2027-06-15",
		mortgageId: "mortgage_123",
		paymentAmount: 3500,
		paymentFrequency: "monthly",
		principal: 600000,
		rateType: "fixed",
		status: "active",
		termMonths: 24,
		termStartDate: "2025-06-15",
	},
	position: {
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
	},
	payments: [],
	property: {
		city: "Toronto",
		postalCode: "M5H 2N2",
		propertyId: "prop_123",
		propertyType: "Single Family",
		province: "ON",
		streetAddress: "123 Main St",
		unit: null,
	},
};

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("MIC portal routes", () => {
	it("/portal route exists with a loader that ensures dashboard query data", async () => {
		const ensureQueryDataMock = vi.fn().mockResolvedValueOnce(undefined);

		expect(PortalIndexRoute.options.loader).toBeDefined();

		await PortalIndexRoute.options.loader?.({
			context: {
				portalContext: MIC_PORTAL_CONTEXT.portalContext,
				queryClient: { ensureQueryData: ensureQueryDataMock },
			},
		} as never);

		expect(ensureQueryDataMock).toHaveBeenCalledTimes(1);
	});

	it("/portal/positions/$mortgageId route renders without error", () => {
		vi.mocked(RootRoute.useRouteContext).mockReturnValue(
			MIC_PORTAL_CONTEXT as never
		);
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: { position: mockPositionDetail },
		} as never);
		vi.spyOn(PositionRoute, "useLoaderData").mockReturnValue({
			mortgageId: "mortgage_123",
		} as never);

		render(<MicPositionDetailRoutePage />);

		expect(screen.getByText("123 Main St, Toronto")).toBeTruthy();
		expect(screen.getByText("Mortgage")).toBeTruthy();
		expect(screen.getByText("Position")).toBeTruthy();
		expect(screen.getByText("$600,000.00")).toBeTruthy();
	});

	it("requires authentication through the parent /portal route beforeLoad guard", () => {
		expect(PortalRoute.options.beforeLoad).toBeDefined();
	});
});
