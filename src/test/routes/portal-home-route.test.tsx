/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMarketplaceListingCardItems } from "#/components/listings/marketplace-adapters";
import { publicPortalListingsQueryOptions } from "#/components/listings/portal-query-options";
import { Route as RootRoute } from "#/routes/__root";
import { HomeContent } from "#/routes/index";

vi.mock("@tanstack/react-query", () => ({
	useQuery: vi.fn(),
}));

vi.mock("convex/react", () => ({
	Authenticated: () => null,
	Unauthenticated: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("#/components/listings/portal-query-options", () => ({
	publicPortalListingsQueryOptions: vi.fn(),
}));

vi.mock("#/components/listings/marketplace-adapters", () => ({
	buildMarketplaceListingCardItems: vi.fn(),
}));

vi.mock("#/components/listings/listing-card-horizontal", () => ({
	Horizontal: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("#/routes/__root", () => ({
	Route: {
		useRouteContext: vi.fn(),
	},
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const TEASER_QUERY_OPTIONS = { queryKey: ["portal-teaser"] };

const PORTAL_ROUTE_CONTEXT = {
	portalCacheKey: "portal:portal_meridian:active:local:meridian.localhost:3000",
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
	requestHost: "meridian.localhost:3000",
};

describe("portal home route", () => {
	it("loads teaser listings from the explicit portal query contract", () => {
		vi.mocked(RootRoute.useRouteContext).mockReturnValue(
			PORTAL_ROUTE_CONTEXT as never
		);
		vi.mocked(publicPortalListingsQueryOptions).mockReturnValue(
			TEASER_QUERY_OPTIONS as never
		);
		vi.mocked(buildMarketplaceListingCardItems).mockReturnValue([
			{
				address: "Toronto, ON",
				apr: 7.66,
				availablePercent: 42,
				id: "listing_1",
				imageSrc: undefined,
				lat: 43.6532,
				lng: -79.3832,
				lockedPercent: 18,
				ltv: 0.62,
				maturityDate: new Date("2027-04-30"),
				mortgageType: "First",
				principal: 250000,
				propertyType: "Detached Home",
				soldPercent: 40,
				title: "King West bridge opportunity",
			},
		]);
		vi.mocked(useQuery).mockReturnValue({
			data: {
				continueCursor: null,
				isDone: true,
				page: [
					{
						id: "listing_1",
					},
				],
				teaserEnabled: true,
				teaserListingLimit: 12,
			},
			error: null,
			isPending: false,
		} as never);

		render(<HomeContent />);

		expect(publicPortalListingsQueryOptions).toHaveBeenCalledWith(
			"portal_meridian",
			{ numItems: 12 }
		);
		expect(vi.mocked(useQuery)).toHaveBeenCalledWith(TEASER_QUERY_OPTIONS);
		expect(screen.getByText("Featured mortgage opportunities")).toBeTruthy();
		expect(screen.getByText("King West bridge opportunity")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
	});

	it("renders the teaser-disabled state when the portal hides public listings", () => {
		vi.mocked(RootRoute.useRouteContext).mockReturnValue(
			PORTAL_ROUTE_CONTEXT as never
		);
		vi.mocked(publicPortalListingsQueryOptions).mockReturnValue(
			TEASER_QUERY_OPTIONS as never
		);
		vi.mocked(buildMarketplaceListingCardItems).mockReturnValue([]);
		vi.mocked(useQuery).mockReturnValue({
			data: {
				continueCursor: null,
				isDone: true,
				page: [],
				teaserEnabled: false,
				teaserListingLimit: 12,
			},
			error: null,
			isPending: false,
		} as never);

		render(<HomeContent />);

		expect(screen.getByText("Teaser listings unavailable")).toBeTruthy();
	});
});
