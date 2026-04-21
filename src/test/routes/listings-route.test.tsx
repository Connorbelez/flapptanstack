/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMatch, useNavigate } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketplaceListingsPage } from "#/components/listings/MarketplaceListingsPage";
import { marketplaceListingsQueryOptions } from "#/components/listings/query-options";
import {
	ListingsRouteComponent,
	Route,
} from "#/routes/listings";

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
		useMatch: vi.fn(),
		useNavigate: vi.fn(),
	};
});

vi.mock("#/components/listings/query-options", () => ({
	marketplaceListingsQueryOptions: vi.fn(),
}));

vi.mock("#/components/listings/MarketplaceListingsPage", () => ({
	MarketplaceListingsPage: vi.fn(() => <div>Marketplace Listings</div>),
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const LIST_QUERY_OPTIONS = { queryKey: ["marketplace-listings"] };

describe("public listings route", () => {
	it("renders the marketplace listings surface when no detail child route is active", () => {
		const search = { q: "toronto", sort: "featured" } as const;
		const navigate = vi.fn();

		vi.spyOn(Route, "useSearch").mockReturnValue(search as never);
		vi.mocked(useMatch).mockReturnValue(null);
		vi.mocked(useNavigate).mockReturnValue(navigate);
		vi.mocked(marketplaceListingsQueryOptions).mockReturnValue(
			LIST_QUERY_OPTIONS as never
		);
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: {
				continueCursor: null,
				isDone: true,
				page: [],
			},
		} as never);

		render(<ListingsRouteComponent />);

		expect(marketplaceListingsQueryOptions).toHaveBeenCalledWith(search);
		expect(useSuspenseQuery).toHaveBeenCalledWith(LIST_QUERY_OPTIONS);
		expect(MarketplaceListingsPage).toHaveBeenCalled();

		const props = vi.mocked(MarketplaceListingsPage).mock.calls[0]?.[0];
		props?.setSearch((current: { q?: string; sort?: string }) => ({
			...current,
			q: "hamilton",
		}));

		expect(navigate).toHaveBeenCalledWith({
			search: expect.any(Function),
			to: "/listings",
		});
	});

	it("renders the nested detail outlet when a listing child route is active", () => {
		vi.spyOn(Route, "useSearch").mockReturnValue({ sort: "featured" } as never);
		vi.mocked(useMatch).mockReturnValue("listing_1" as never);

		render(<ListingsRouteComponent />);

		expect(screen.getByTestId("listing-detail-outlet")).toBeTruthy();
		expect(useSuspenseQuery).not.toHaveBeenCalled();
		expect(MarketplaceListingsPage).not.toHaveBeenCalled();
	});
});
