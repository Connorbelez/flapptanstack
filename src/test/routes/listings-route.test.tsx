/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketplaceListingsPage } from "#/components/listings/MarketplaceListingsPage";
import { marketplaceListingsQueryOptions } from "#/components/listings/query-options";
import {
	ListingsIndexRoutePage,
	Route,
} from "#/routes/listings/index";
import { parseListingCheckoutReturnState } from "#/routes/listings/$listingId";
import { ListingsLayout } from "#/routes/listings/route";
import { Route as RootRoute } from "#/routes/__root";

vi.mock("@tanstack/react-query", () => ({
	useSuspenseQuery: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
		"@tanstack/react-router"
	);

	return {
		...actual,
		Outlet: () => <div data-testid="listing-detail-outlet" />,
		useNavigate: vi.fn(),
	};
});

vi.mock("convex/react", () => ({
	Authenticated: ({ children }: { children: ReactNode }) => (
		<div data-testid="authenticated-shell">{children}</div>
	),
	AuthLoading: ({ children }: { children: ReactNode }) => (
		<div data-testid="auth-loading-shell">{children}</div>
	),
}));

vi.mock("#/components/listings/query-options", () => ({
	marketplaceListingsQueryOptions: vi.fn(),
}));

vi.mock("#/components/listings/MarketplaceListingsPage", () => ({
	MarketplaceListingsPage: vi.fn(() => <div>Marketplace Listings</div>),
}));

vi.mock("#/components/listings/ListingPdfViewer", () => ({
	ListingPdfViewer: () => <div data-testid="listing-pdf-viewer" />,
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const LIST_QUERY_OPTIONS = { queryKey: ["marketplace-listings"] };
const PORTAL_ID = "portal_meridian" as never;

describe("public listings route", () => {
	it("normalizes listing checkout return search state", () => {
		expect(
			parseListingCheckoutReturnState({ checkout: "success_pending" })
		).toBe("success_pending");
		expect(parseListingCheckoutReturnState({ checkout: "expired" })).toBe(
			"expired"
		);
		expect(parseListingCheckoutReturnState({ checkout: "invalid" })).toBe(
			undefined
		);
		expect(parseListingCheckoutReturnState({ checkout: ["expired"] })).toBe(
			undefined
		);
	});

	it("renders the marketplace listings surface from the index route", () => {
		const search = { q: "toronto", sort: "featured" } as const;
		const navigate = vi.fn();

		vi.spyOn(Route, "useSearch").mockReturnValue(search as never);
		vi.spyOn(RootRoute, "useRouteContext").mockReturnValue({
			portalContext: {
				availability: "active",
				cacheKey: "portal:portal_meridian:active:local:meridian.localhost:3000",
				canonicalHost: "meridian.localhost:3000",
				kind: "portal",
				matchedHostType: "local",
				portal: {
					portalId: PORTAL_ID,
				},
				requestedHost: "meridian.localhost:3000",
			},
		} as never);
		vi.mocked(useNavigate).mockReturnValue(navigate);
		vi.mocked(marketplaceListingsQueryOptions).mockReturnValue(
			LIST_QUERY_OPTIONS as never
		);
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: {
				continueCursor: null,
				effectiveFilters: {
					ltv: { max: 0.65, min: 0.55 },
					maturityDate: { end: "2026-12-31" },
					mortgageTypes: ["First"],
					principalAmount: { max: 300000, min: 200000 },
					propertyTypes: ["Detached Home"],
					searchQuery: undefined,
				},
				isDone: true,
				page: [],
			},
		} as never);

		render(<ListingsIndexRoutePage />);

		expect(marketplaceListingsQueryOptions).toHaveBeenCalledWith(
			PORTAL_ID,
			search
		);
		expect(useSuspenseQuery).toHaveBeenCalledWith(LIST_QUERY_OPTIONS);
		expect(MarketplaceListingsPage).toHaveBeenCalled();

		const props = vi.mocked(MarketplaceListingsPage).mock.calls[0]?.[0];
		expect(props?.search).toEqual({
			maturityBefore: "2026-12-31",
			mortgageTypes: ["First"],
			principalMax: 300000,
			principalMin: 200000,
			propertyTypes: ["Detached Home"],
			q: undefined,
			rateMax: undefined,
			rateMin: undefined,
			sort: "featured",
			ltvMax: 0.65,
			ltvMin: 0.55,
		});
		props?.setSearch((current: { q?: string; sort?: string }) => ({
			...current,
			q: "hamilton",
		}));

		expect(navigate).toHaveBeenCalledWith({
			search: expect.any(Function),
			to: "/listings",
		});
	});

	it("renders a nested auth-aware listings layout", () => {
		render(<ListingsLayout />);

		expect(screen.getByTestId("authenticated-shell")).toBeTruthy();
		expect(screen.getByTestId("auth-loading-shell")).toBeTruthy();
		expect(screen.getByTestId("listing-detail-outlet")).toBeTruthy();
	});
});
