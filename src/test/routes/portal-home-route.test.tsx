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
		brand: {
			logoAlt: "Meridian Capital logo",
			logoUrl: null,
		},
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
					action: {
						href: "/start-lending?source=featured-listing&listingId=listing_1",
						label: "Continue with Detached Home, North York",
					},
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
					action: {
						href: "/start-lending?source=featured-listing&listingId=listing_2",
						label: "Continue with Condo, Scarborough",
					},
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
					action: {
						href: "/start-lending?source=featured-listing&listingId=listing_3",
						label: "Continue with Semi-Detached, Vaughan",
					},
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
				{
					amountLabel: "$510,000",
					action: {
						href: "/start-lending?source=featured-listing&listingId=listing_4",
						label: "Continue with Townhome, Mississauga",
					},
					heroImageUrl: null,
					id: "listing_4",
					ltvLabel: "60% LTV",
					mortgagePositionLabel: "1st",
					propertyTypeLabel: "Townhome",
					rateLabel: "8.9%",
					statusLabel: "Active",
					termLabel: "30 mo",
					title: "Townhome, Mississauga",
				},
			],
			label: "Featured Listings",
			subcopy: "Currently available mortgage investment opportunities",
			viewAllAction: { href: "/contract/listings", label: "View All" },
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
			submitAction: { href: "/contract/financing-submit", label: "Continue" },
			title: "Need to start quickly?",
		},
		hero: {
			body: "Meridian leads the public experience. FairLend is the operating layer behind it.",
			eyebrow: "Broker-led private mortgage access",
			headline: "A branded front door for lenders and mortgage seekers.",
			primaryAction: { href: "/contract/hero-primary", label: "Talk to Meridian" },
			secondaryAction: { href: "/contract/hero-secondary", label: "See how it works" },
		},
		navigation: {
			brandLabel: "Meridian Capital",
			items: [
				{ href: "/contract/how-it-works", label: "How Meridian works" },
				{ href: "/contract/nav-listings", label: "Current opportunities" },
				{ href: "/contract/nav-borrower-start", label: "Borrower start" },
				{ href: "/contract/contact", label: "Contact" },
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
					{ href: "/contract/borrower-intake", label: "Borrower intake" },
					{ href: "/contract/pre-approval", label: "Jump to pre-approval" },
				],
				primaryAction: {
					href: "/contract/borrower-primary",
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
				primaryAction: {
					href: "/start-lending?source=switchboard",
					label: "Browse current listings",
				},
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
		theme: {
			accentColor: "#047857",
			backgroundColor: "#f7f5ef",
			borderColor: "#e7e5e4",
			mutedTextColor: "#57534e",
			primaryColor: "#064e3b",
			primaryHoverColor: "#065f46",
			surfaceColor: "#ffffff",
			textColor: "#1c1917",
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
		expect(
			screen
				.getByRole("link", { name: /Talk to Meridian/ })
				.getAttribute("href")
		).toBe("/contract/hero-primary");
		expect(
			screen
				.getByRole("link", { name: "How Meridian works" })
				.getAttribute("href")
		).toBe("/contract/how-it-works");
		expect(
			screen
				.getByRole("link", { name: /Browse current listings/ })
				.getAttribute("href")
		).toBe("/start-lending?source=switchboard");
		expect(
			screen
				.getByRole("link", { name: "Continue with Detached Home, North York" })
				.getAttribute("href")
		).toBe("/start-lending?source=featured-listing&listingId=listing_1");
		expect(
			screen
				.getByRole("link", { name: /Start financing intake/ })
				.getAttribute("href")
		).toBe("/contract/borrower-primary");
		expect(
			screen
				.getByRole("link", { name: /Jump to pre-approval/ })
				.getAttribute("href")
		).toBe("/contract/pre-approval");
		expect(
			screen.getByRole("link", { name: "How Meridian works" }).parentElement
				?.className
		).not.toContain("hidden");
		expect(screen.getByRole("button", { name: /Continue/ })).toBeTruthy();
		expect(screen.getByLabelText("Full name").getAttribute("name")).toBe(
			"fullName"
		);
		expect(screen.getByText("Detached Home, North York")).toBeTruthy();
		expect(screen.getByText("Condo, Scarborough")).toBeTruthy();
		expect(screen.getByText("Semi-Detached, Vaughan")).toBeTruthy();
		expect(screen.queryByText("Townhome, Mississauga")).toBeNull();
		expect(
			screen.getAllByRole("article", { name: /Featured listing:/ })
		).toHaveLength(3);
		expect(screen.getByTestId("featured-listings-continuation")).toBeTruthy();
		expect(screen.queryByText("Resolved host context")).toBeNull();
		expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
	});

	it("applies constrained brand and theme tokens without changing the IA", () => {
		arrangePortalLandingQuery(
			buildLandingContract({
				brand: {
					logoAlt: "Meridian crest",
					logoUrl: "/logos/meridian.svg",
				},
				theme: {
					accentColor: "#0f766e",
					backgroundColor: "#f8fafc",
					borderColor: "#cbd5e1",
					mutedTextColor: "#334155",
					primaryColor: "#1d4ed8",
					primaryHoverColor: "#1e40af",
					surfaceColor: "#ffffff",
					textColor: "#111827",
				},
			})
		);

		render(<HomeContent />);

		const page = screen.getByTestId("portal-landing-page");
		expect(page.style.getPropertyValue("--portal-landing-bg")).toBe(
			"#f8fafc"
		);
		expect(page.style.getPropertyValue("--portal-landing-primary")).toBe(
			"#1d4ed8"
		);
		expect(screen.getByAltText("Meridian crest").getAttribute("src")).toBe(
			"/logos/meridian.svg"
		);
		expect(
			screen.getByRole("heading", { name: "Two clear ways in." })
		).toBeTruthy();
		expect(
			screen.getByRole("link", { name: /Browse current listings/ })
		).toBeTruthy();
		expect(
			screen.getByRole("link", { name: /Start financing intake/ })
		).toBeTruthy();
		expect(
			screen.getByRole("link", { name: /Jump to pre-approval/ })
		).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "Featured Listings" })
		).toBeTruthy();
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
		expect(screen.queryByRole("link", { name: "View All" })).toBeNull();
	});

	it("renders an unavailable state when the landing contract is missing", () => {
		arrangePortalLandingQuery(null);

		render(<HomeContent />);

		expect(screen.getByText("Portal landing page unavailable")).toBeTruthy();
	});
});
