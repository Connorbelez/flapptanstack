/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publicPortalListingsQueryOptions } from "#/components/listings/portal-query-options";
import { Route as RootRoute } from "#/routes/__root";
import { HomeContent } from "#/routes/index";

vi.mock("@tanstack/react-query", () => ({
	useQuery: vi.fn(),
}));

vi.mock("convex/react", () => ({
	Authenticated: ({ children }: { children: ReactNode }) => children,
	Unauthenticated: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("#/components/mic/landing/MicRequestForm", () => ({
	MicRequestForm: () => <button type="button">Request offering memorandum / prospectus</button>,
}));

vi.mock("#/components/listings/portal-query-options", () => ({
	publicPortalListingsQueryOptions: vi.fn(),
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

describe("MIC landing page route", () => {
	it("renders the MIC landing page and skips teaser listing queries", () => {
		vi.mocked(RootRoute.useRouteContext).mockReturnValue({
			portalCacheKey: "portal:portal_mic:active:local:mic.localhost:3000",
			portalContext: {
				availability: "active",
				cacheKey: "portal:portal_mic:active:local:mic.localhost:3000",
				canonicalHost: "mic.localhost:3000",
				kind: "portal",
				matchedHostType: "local",
				portal: {
					defaultPostAuthPath: "/portal",
					isPublished: true,
					landingPageId: undefined,
					lenderId: "lender_mic",
					localHost: "mic.localhost:3000",
					orgId: "org_mic",
					portalId: "portal_mic",
					portalType: "mic",
					pricingPolicyId: undefined,
					productionHost: "mic.fairlend.ca",
					publicTeaserEnabled: false,
					slug: "mic",
					status: "active",
					teaserListingLimit: 0,
				},
				requestedHost: "mic.localhost:3000",
			},
			requestHost: "mic.localhost:3000",
		} as never);
		vi.mocked(useQuery).mockReturnValue({ data: null, error: null, isPending: false } as never);

		render(<HomeContent />);

		expect(
			screen.getByRole("heading", { name: /MIC Investors Portal/i })
		).toBeTruthy();
		expect(
			screen.getByRole("link", { name: /Sign in to the portal/i })
		).toBeTruthy();
		expect(
			screen.getByRole("button", {
				name: /Request offering memorandum/i,
			})
		).toBeTruthy();
		expect(publicPortalListingsQueryOptions).not.toHaveBeenCalled();
	});
});
