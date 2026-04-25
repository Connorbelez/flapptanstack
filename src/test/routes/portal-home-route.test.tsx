/**
 * @vitest-environment jsdom
 */

import { convexQuery } from "@convex-dev/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicPortalLandingPageContract } from "#/components/portal/landing/landing-types";
import { Route as RootRoute } from "#/routes/__root";
import { HomeContent } from "#/routes/index";

vi.mock("@tanstack/react-query", () => ({
	useQuery: vi.fn(),
}));

vi.mock("@convex-dev/react-query", () => ({
	convexQuery: vi.fn(),
}));

vi.mock("convex/react", () => ({
	Authenticated: () => null,
	Unauthenticated: ({ children }: { children: ReactNode }) => children,
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

const LANDING_QUERY_OPTIONS = { queryKey: ["portal-landing"] };

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

function buildLandingContract(
	overrides: Partial<PublicPortalLandingPageContract> = {}
): PublicPortalLandingPageContract {
	const base: PublicPortalLandingPageContract = {
		broker: {
			brokerageName: "Meridian Capital",
			license: {
				id: "12847",
				label: "FSRA Licensed #12847",
				province: "FSRA",
			},
		},
		featuredListings: {
			enabled: true,
			hasBlurredContinuation: true,
			items: [
				{
					amountLabel: "$450,000",
					heroImageUrl: null,
					id: "listing_1",
					ltvLabel: "65% LTV",
					mortgagePositionLabel: "1st",
					propertyTypeLabel: "Detached",
					rateLabel: "8.5%",
					statusLabel: "Active",
					termLabel: "24 mo",
					title: "Detached Home, North York",
				},
				{
					amountLabel: "$320,000",
					heroImageUrl: null,
					id: "listing_2",
					ltvLabel: "70% LTV",
					mortgagePositionLabel: "1st",
					propertyTypeLabel: "Condo",
					rateLabel: "9.25%",
					statusLabel: "Active",
					termLabel: "18 mo",
					title: "Condo, Scarborough",
				},
				{
					amountLabel: "$180,000",
					heroImageUrl: null,
					id: "listing_3",
					ltvLabel: "72% LTV",
					mortgagePositionLabel: "2nd",
					propertyTypeLabel: "Semi-Detached",
					rateLabel: "11%",
					statusLabel: "Filling",
					termLabel: "12 mo",
					title: "Semi-Detached, Vaughan",
				},
			],
			label: "Featured Listings",
			subcopy: "Currently available mortgage investment opportunities",
			viewAllAction: { href: "/listings", label: "View All" },
			visibleCardCount: 3,
		},
		financingStrip: {
			body: "Give Meridian just enough information to begin the conversation.",
			fields: [
				{ key: "fullName", label: "Full name" },
				{ key: "email", label: "Email" },
				{ key: "amountNeeded", label: "Amount needed" },
			],
			kicker: "Short inline start, then dedicated flow",
			submitAction: { href: "/financing/start", label: "Continue" },
			title: "Need to start quickly?",
		},
		hero: {
			body: "Meridian leads the public experience. FairLend is the operating layer behind it.",
			eyebrow: "Broker-led private mortgage access",
			headline: "A branded front door for lenders and mortgage seekers.",
			primaryAction: { href: "#contact", label: "Talk to Meridian" },
			secondaryAction: { href: "#how-it-works", label: "See how it works" },
		},
		navigation: {
			brandLabel: "Meridian Capital",
			items: [
				{ href: "#how-it-works", label: "How Meridian works" },
				{ href: "/listings", label: "Current opportunities" },
				{ href: "/financing/start", label: "Borrower start" },
				{ href: "#contact", label: "Contact" },
			],
			poweredByLabel: "Powered by FairLend",
			rightLabel: "Private mortgage brokerage",
		},
		portal: {
			defaultPostAuthPath: "/",
			localHost: "meridian.localhost:3000",
			portalId: "portal_meridian" as never,
			portalType: "broker",
			productionHost: "meridian.fairlend.ca",
			slug: "meridian",
		},
		switchboard: {
			borrower: {
				body: "Start financing with Meridian whether you are exploring a mortgage path or ready for pre-approval.",
				helper: "Pre-approval stays available, but nested under the broader borrower path.",
				label: "Borrower / Mortgage Applicant",
				nestedActions: [
					{ href: "/financing/start", label: "Borrower intake" },
					{ href: "/financing/pre-approval", label: "Jump to pre-approval" },
				],
				primaryAction: {
					href: "/financing/start",
					label: "Start financing intake",
				},
			},
			intro: {
				body: "One half for lender discovery, one half for financing starts.",
				kicker: "Choose your next step",
				title: "Two clear ways in.",
			},
			lender: {
				body: "Review live opportunities and continue into Meridian onboarding.",
				helper: "For accredited lenders and repeat deal-flow participants.",
				label: "Lender",
				primaryAction: { href: "/listings", label: "Browse current listings" },
			},
		},
		trustStrip: {
			items: [
				{ label: "FSRA Licensed #12847" },
				{ label: "12 Years Experience" },
				{ label: "$42M Funded to Date" },
				{ label: "180+ Investors" },
			],
		},
	};

	return { ...base, ...overrides };
}

function arrangePortalLandingQuery(data: PublicPortalLandingPageContract | null) {
	vi.mocked(RootRoute.useRouteContext).mockReturnValue(
		PORTAL_ROUTE_CONTEXT as never
	);
	vi.mocked(convexQuery).mockReturnValue(LANDING_QUERY_OPTIONS as never);
	vi.mocked(useQuery).mockReturnValue({
		data,
		error: null,
		isPending: false,
	} as never);
}

describe("portal home route", () => {
	it("loads the production landing contract and renders the approved IA", () => {
		arrangePortalLandingQuery(buildLandingContract());

		render(<HomeContent />);

		expect(convexQuery).toHaveBeenCalledWith(expect.anything(), {
			portalId: "portal_meridian",
		});
		expect(vi.mocked(useQuery)).toHaveBeenCalledWith(LANDING_QUERY_OPTIONS);
		expect(screen.getByLabelText("Portal landing navigation")).toBeTruthy();
		expect(
			screen.getByRole("heading", {
				name: "A branded front door for lenders and mortgage seekers.",
			})
		).toBeTruthy();
		expect(screen.getByLabelText("Broker trust indicators")).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "Two clear ways in." })
		).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "Featured Listings" })
		).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "Need to start quickly?" })
		).toBeTruthy();
		expect(screen.getByRole("link", { name: /Browse current listings/ }))
			.toBeTruthy();
		expect(screen.getByRole("link", { name: /Start financing intake/ }))
			.toBeTruthy();
		expect(screen.getByRole("link", { name: /Jump to pre-approval/ }))
			.toBeTruthy();
		expect(screen.getByText("Detached Home, North York")).toBeTruthy();
		expect(screen.queryByText("Resolved host context")).toBeNull();
		expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
	});

	it("renders the featured-listings disabled state from the landing contract", () => {
		arrangePortalLandingQuery(
			buildLandingContract({
				featuredListings: {
					...buildLandingContract().featuredListings,
					enabled: false,
					hasBlurredContinuation: false,
					items: [],
				},
			})
		);

		render(<HomeContent />);

		expect(
			screen.getByText(
				"Featured listings are not currently published for this portal."
			)
		).toBeTruthy();
		expect(screen.queryByText("Detached Home, North York")).toBeNull();
	});

	it("renders an unavailable state when the landing contract is missing", () => {
		arrangePortalLandingQuery(null);

		render(<HomeContent />);

		expect(screen.getByText("Portal landing page unavailable")).toBeTruthy();
	});
});
