/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lenderPortalListingDetailQueryOptions } from "#/components/listings/portal-query-options";
import { LenderListingDetailPage } from "#/components/lender/listings/LenderListingDetailPage";
import { Route as RootRoute } from "#/routes/__root";

vi.mock("@tanstack/react-query", () => ({
	useQuery: vi.fn(),
}));

vi.mock("#/components/listings/portal-query-options", () => ({
	lenderPortalListingDetailQueryOptions: vi.fn(),
}));

vi.mock("#/routes/__root", () => ({
	Route: {
		useRouteContext: vi.fn(() => ({
			portalContext: {
				cacheKey: "marketing:fairlend.ca",
				canonicalHost: "fairlend.ca",
				kind: "marketing",
				requestedHost: "fairlend.ca",
			},
		})),
	},
}));

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
		"@tanstack/react-router"
	);

	return {
		...actual,
		Link: (props: {
			children: ReactNode;
			className?: string;
			to: string;
		}) => (
			<a className={props.className} href={props.to}>
				{props.children}
			</a>
		),
	};
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const DETAIL_QUERY_OPTIONS = { queryKey: ["portal-detail"] };
const PORTAL_CONTEXT = {
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

const DETAIL_SNAPSHOT = {
	availability: { availableFractions: 42 },
	documents: [
		{
			assetId: "asset_public_1",
			blueprintId: "blueprint_public_1",
			class: "public_static",
			description: "Visible to authenticated lenders.",
			displayName: "Investor Summary",
			url: "https://example.com/investor-summary.pdf",
		},
	],
	listing: {
		city: "Toronto",
		description: "Projected lender-facing mortgage listing.",
		interestRate: 9.5,
		lienPosition: 1,
		listingId: "listing_1",
		loanType: "conventional",
		ltvRatio: 62,
		maturityDate: "2027-04-30",
		monthlyPayment: 2450,
		paymentFrequency: "monthly",
		principal: 250000,
		propertyType: "residential",
		province: "ON",
		status: "active",
		title: "King West bridge opportunity",
	},
};

function mockSuccessfulPortalQueries(options?: {
	documents?: typeof DETAIL_SNAPSHOT.documents;
}) {
	vi.mocked(lenderPortalListingDetailQueryOptions).mockReturnValue(
		DETAIL_QUERY_OPTIONS as never
	);
	vi.mocked(useQuery).mockReturnValue({
		data: {
			...DETAIL_SNAPSHOT,
			documents: options?.documents ?? DETAIL_SNAPSHOT.documents,
		},
		error: null,
		isPending: false,
	} as never);
}

describe("lender listing detail page", () => {
	it("renders a portal-host-required state when the current host is not a portal", () => {
		render(<LenderListingDetailPage listingId="listing_1" />);

		expect(screen.getByText("Portal host required")).toBeTruthy();
		expect(vi.mocked(useQuery)).not.toHaveBeenCalled();
		expect(vi.mocked(lenderPortalListingDetailQueryOptions)).not.toHaveBeenCalled();
	});

	it("renders the canonical listing snapshot and public documents on portal hosts", () => {
		vi.mocked(RootRoute.useRouteContext).mockReturnValue(PORTAL_CONTEXT as never);
		mockSuccessfulPortalQueries();

		render(<LenderListingDetailPage listingId="listing_1" />);

		expect(lenderPortalListingDetailQueryOptions).toHaveBeenCalledWith(
			"portal_meridian",
			"listing_1"
		);
		expect(vi.mocked(useQuery)).toHaveBeenCalledWith(DETAIL_QUERY_OPTIONS);
		expect(screen.getByText("King West bridge opportunity")).toBeTruthy();
		expect(screen.getByText("Public Documents")).toBeTruthy();
		expect(screen.getByText("Investor Summary")).toBeTruthy();
		expect(screen.getByText("Visible to authenticated lenders.")).toBeTruthy();
		expect(
			screen.getByRole("link", { name: "Open PDF" }).getAttribute("href")
		).toBe("https://example.com/investor-summary.pdf");
		expect(
			screen.getByRole("link", { name: "Back to lender workspace" }).getAttribute(
				"href"
			)
		).toBe("/lender");
	});

	it("renders a disabled document action when the public document URL is missing", () => {
		vi.mocked(RootRoute.useRouteContext).mockReturnValue(PORTAL_CONTEXT as never);
		mockSuccessfulPortalQueries({
			documents: [
				{
					assetId: "asset_public_1",
					blueprintId: "blueprint_public_1",
					class: "public_static",
					description: "Visible to authenticated lenders.",
					displayName: "Investor Summary",
					url: null,
				},
			],
		});

		render(<LenderListingDetailPage listingId="listing_1" />);

		expect(screen.queryByRole("link", { name: "Open PDF" })).toBeNull();
	expect(
		screen.getByRole("button", { name: "Open PDF" }).getAttribute("disabled")
	).not.toBeNull();
});

	it("renders the unavailable state when the portal detail query fails", () => {
		vi.mocked(RootRoute.useRouteContext).mockReturnValue(PORTAL_CONTEXT as never);
		vi.mocked(lenderPortalListingDetailQueryOptions).mockReturnValue(
			DETAIL_QUERY_OPTIONS as never
		);
		vi.mocked(useQuery).mockReturnValue({
			data: undefined,
			error: new Error("failed"),
			isPending: false,
		} as never);

		render(<LenderListingDetailPage listingId="listing_1" />);

		expect(screen.getByText("Listing unavailable")).toBeTruthy();
	});
});
