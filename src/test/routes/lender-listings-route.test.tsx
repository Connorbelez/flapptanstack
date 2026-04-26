/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { useMatch, useNavigate } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketplaceListingsPage } from "#/components/listings/MarketplaceListingsPage";
import { lenderPortalListingsQueryOptions } from "#/components/listings/portal-query-options";
import { Route as RootRoute } from "#/routes/__root";
import {
	LenderListingsRouteComponent,
	Route,
} from "#/routes/lender.listings";

vi.mock("@tanstack/react-query", () => ({
	useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
		"@tanstack/react-router"
	);

	return {
		...actual,
		useMatch: vi.fn(),
		useNavigate: vi.fn(),
	};
});

vi.mock("#/components/listings/portal-query-options", () => ({
	lenderPortalListingsQueryOptions: vi.fn(),
}));

vi.mock("#/components/listings/MarketplaceListingsPage", () => ({
	MarketplaceListingsPage: vi.fn(
		(props: { heading: string }) => <div>{props.heading}</div>
	),
}));

vi.mock("#/routes/__root", () => ({
	Route: {
		useRouteContext: vi.fn(),
	},
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const LIST_QUERY_OPTIONS = { queryKey: ["portal-lender-list"] };

const PORTAL_ROUTE_CONTEXT = {
	portalContext: {
		availability: "active",
		cacheKey: "portal:portal_meridian:active:local:meridian.localhost:3000",
		canonicalHost: "meridian.localhost:3000",
		kind: "portal",
		matchedHostType: "local",
		portal: {
			defaultPostAuthPath: "/",
			isPublished: true,
			landingPageId: undefined,
			localHost: "meridian.localhost:3000",
			orgId: "org_meridian",
			portalId: "portal_meridian",
			portalType: "broker",
			pricingPolicyId: "policy_meridian",
			productionHost: "meridian.fairlend.ca",
			publicTeaserEnabled: true,
			slug: "meridian",
			status: "active",
			teaserListingLimit: 12,
		},
		requestedHost: "meridian.localhost:3000",
	},
};

describe("lender listings route", () => {
	it("renders a portal-host-required state outside active portal hosts", () => {
		vi.spyOn(Route, "useSearch").mockReturnValue({} as never);
		vi.mocked(useMatch).mockReturnValue(null);
		vi.mocked(RootRoute.useRouteContext).mockReturnValue({
			portalContext: {
				cacheKey: "marketing:fairlend.ca",
				canonicalHost: "fairlend.ca",
				kind: "marketing",
				requestedHost: "fairlend.ca",
			},
		} as never);

		render(<LenderListingsRouteComponent />);

		expect(screen.getByText("Portal host required")).toBeTruthy();
		expect(vi.mocked(useQuery)).not.toHaveBeenCalled();
	});

	it("loads the lender listings surface from the explicit portal query contract", () => {
		const search = { q: "toronto", sort: "featured" };
		const navigate = vi.fn();

		vi.spyOn(Route, "useSearch").mockReturnValue(search as never);
		vi.mocked(useMatch).mockReturnValue(null);
		vi.mocked(useNavigate).mockReturnValue(navigate);
		vi.mocked(RootRoute.useRouteContext).mockReturnValue(
			PORTAL_ROUTE_CONTEXT as never
		);
		vi.mocked(lenderPortalListingsQueryOptions).mockReturnValue(
			LIST_QUERY_OPTIONS as never
		);
		vi.mocked(useQuery).mockReturnValue({
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
			error: null,
			isPending: false,
		} as never);

		render(<LenderListingsRouteComponent />);

		expect(lenderPortalListingsQueryOptions).toHaveBeenCalledWith(
			"portal_meridian",
			search
		);
		expect(vi.mocked(useQuery)).toHaveBeenCalledWith(LIST_QUERY_OPTIONS);
		expect(MarketplaceListingsPage).toHaveBeenCalled();

		const props = vi.mocked(MarketplaceListingsPage).mock.calls[0]?.[0];
		expect(props?.detailRoute).toBe("/lender/listings/$listingId");
		expect(props?.eyebrow).toBe("meridian portal");
		expect(props?.heading).toBe("Browse broker portal opportunities");
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
			propertyTypes: [],
			q: "hamilton",
			sort: current.sort ?? "featured",
		}));

		expect(navigate).toHaveBeenCalledWith({
			search: expect.any(Function),
			to: "/lender/listings",
		});
		const navigation = navigate.mock.calls[0]?.[0];
		expect(
			navigation?.search({
				propertyTypes: ["Detached Home"],
				q: "toronto",
				sort: "featured",
			})
		).toEqual({
			q: "hamilton",
			sort: "featured",
		});
	});
});
