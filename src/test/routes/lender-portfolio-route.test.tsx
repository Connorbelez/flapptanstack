/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	emptyPortfolioHistoricalSeriesFixture,
	emptyPortfolioCommandCenterFixture,
	portfolioCommandCenterFixture,
	portfolioHistoricalSeriesFixture,
	portfolioPaymentDetailFixture,
	portfolioPositionDetailFixture,
	portfolioTaxExportFixture,
	unavailableSuggestedOpportunitiesFixture,
} from "#/components/lender/portfolio/fixtures";
import { LenderPortfolioPage } from "#/components/lender/portfolio/LenderPortfolioPage";
import {
	DEFAULT_LENDER_PORTFOLIO_SEARCH,
	type LenderPortfolioSearchState,
} from "#/components/lender/portfolio/portfolio-types";
import {
	lenderPortfolioCommandCenterQueryOptions,
	lenderPortfolioPaymentDetailQueryOptions,
	lenderPortfolioPositionDetailQueryOptions,
} from "#/components/lender/portfolio/query-options";
import { useIsMobile } from "#/hooks/use-mobile";
import {
	LenderPortfolioRouteComponent,
	Route,
} from "#/routes/lender.portfolio";
import { Route as RootRoute } from "#/routes/__root";

vi.mock("@tanstack/react-query", () => ({
	useQuery: vi.fn(),
	useSuspenseQuery: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
		"@tanstack/react-router"
	);

	return {
		...actual,
		Link: ({
			children,
			params,
			to,
		}: {
			children: ReactNode;
			params?: { listingId?: string };
			to: string;
		}) => (
			<a href={to.replace("$listingId", params?.listingId ?? "")}>
				{children}
			</a>
		),
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

vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
	useAuth: vi.fn(),
}));

vi.mock("#/components/lender/portfolio/query-options", () => ({
	lenderPortfolioCommandCenterQueryOptions: vi.fn(),
	lenderPortfolioPaymentDetailQueryOptions: vi.fn(),
	lenderPortfolioPositionDetailQueryOptions: vi.fn(),
}));

vi.mock("#/hooks/use-mobile", () => ({
	useIsMobile: vi.fn(),
}));

const TEST_CHART_RECT = {
	bottom: 320,
	height: 320,
	left: 0,
	right: 960,
	toJSON: () => undefined,
	top: 0,
	width: 960,
	x: 0,
	y: 0,
} satisfies DOMRectReadOnly;

class ResizeObserverMock {
	constructor(private readonly callback: ResizeObserverCallback) {}

	disconnect() {}
	observe(target: Element) {
		this.callback(
			[
				{
					borderBoxSize: [],
					contentBoxSize: [],
					contentRect: TEST_CHART_RECT,
					devicePixelContentBoxSize: [],
					target,
				} as ResizeObserverEntry,
			],
			this as never
		);
	}
	unobserve() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
	() => TEST_CHART_RECT
);
Object.defineProperty(HTMLElement.prototype, "clientHeight", {
	configurable: true,
	get: () => TEST_CHART_RECT.height,
});
Object.defineProperty(HTMLElement.prototype, "clientWidth", {
	configurable: true,
	get: () => TEST_CHART_RECT.width,
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const COMMAND_CENTER_QUERY_OPTIONS = {
	queryKey: ["portfolio-command-center"],
};
const POSITION_DETAIL_QUERY_OPTIONS = {
	queryKey: ["portfolio-position-detail", "mortgage_king"],
};
const PAYMENT_DETAIL_QUERY_OPTIONS = {
	queryKey: ["portfolio-payment-detail", "obligation_overdue"],
};
const PORTAL_ID = "portal_meridian" as never;

const ROOT_ROUTE_CONTEXT = {
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
};

function renderPage({
	initialSearch = DEFAULT_LENDER_PORTFOLIO_SEARCH,
	leafStateOverrides = {
		cockpit: {
			historySeries: portfolioHistoricalSeriesFixture,
			historyState: "ready" as const,
		},
		exportStrip: {
			canExportTax: true,
			exportContract: portfolioTaxExportFixture,
			exportState: "ready" as const,
		},
	},
	snapshot = portfolioCommandCenterFixture,
}: {
	initialSearch?: LenderPortfolioSearchState;
	leafStateOverrides?: Parameters<typeof LenderPortfolioPage>[0]["leafStateOverrides"];
	snapshot?: typeof portfolioCommandCenterFixture;
}) {
	let search = initialSearch;
	let view!: ReturnType<typeof render>;

	const renderPageNode = () => (
		<LenderPortfolioPage
			leafStateOverrides={leafStateOverrides}
			portalId={PORTAL_ID}
			search={search}
			setSearch={(updater) => {
				search = updater(search);
				view.rerender(renderPageNode());
			}}
			snapshot={snapshot}
		/>
	);

	view = render(renderPageNode());

	return view;
}

describe("lender portfolio route", () => {
	it("prefetches the shared command-center query in the loader", async () => {
		const ensureQueryData = vi
			.fn()
			.mockResolvedValue(portfolioCommandCenterFixture);

		vi.mocked(lenderPortfolioCommandCenterQueryOptions).mockReturnValue(
			COMMAND_CENTER_QUERY_OPTIONS as never
		);

		await Route.options.loader?.({
			context: {
				portalContext: ROOT_ROUTE_CONTEXT.portalContext,
				queryClient: { ensureQueryData },
			},
		} as never);

		expect(lenderPortfolioCommandCenterQueryOptions).toHaveBeenCalledWith(
			PORTAL_ID
		);
		expect(ensureQueryData).toHaveBeenCalledWith(COMMAND_CENTER_QUERY_OPTIONS);
	});

	it("redirects unauthorized users before the portfolio route loads", () => {
		let thrown: unknown = null;

		try {
			Route.options.beforeLoad?.({
				context: {
					orgId: "org_lender",
					permissions: [],
					role: "lender",
					roles: ["lender"],
					token: "token",
					userId: "user_lender",
				},
				location: {
					href: "/lender/portfolio",
					pathname: "/lender/portfolio",
				},
			} as never);
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toMatchObject({
			options: {
				statusCode: 307,
				to: "/unauthorized",
			},
		});
	});

	it("renders an auth-aware command-center route from the shared query seam", () => {
		const navigate = vi.fn();

		vi.spyOn(Route, "useSearch").mockReturnValue(
			DEFAULT_LENDER_PORTFOLIO_SEARCH as never
		);
		vi.spyOn(RootRoute, "useRouteContext").mockReturnValue(
			ROOT_ROUTE_CONTEXT as never
		);
		vi.mocked(useNavigate).mockReturnValue(navigate);
		vi.mocked(useIsMobile).mockReturnValue(false);
		vi.mocked(useAuth).mockReturnValue({
			loading: false,
			permissions: ["portfolio:export_tax", "portfolio:view"],
		} as never);
		vi.mocked(lenderPortfolioCommandCenterQueryOptions).mockReturnValue(
			COMMAND_CENTER_QUERY_OPTIONS as never
		);
		vi.mocked(useQuery).mockReturnValue({
			data: portfolioHistoricalSeriesFixture,
			error: null,
			isError: false,
			isPending: false,
		} as never);
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: portfolioCommandCenterFixture,
			isFetching: false,
		} as never);
		render(<LenderPortfolioRouteComponent />);

		expect(screen.getByTestId("authenticated-shell")).toBeTruthy();
		expect(screen.getByTestId("auth-loading-shell")).toBeTruthy();
		expect(screen.getByTestId("lender-portfolio-shell")).toBeTruthy();
		expect(screen.getByTestId("portfolio-cockpit")).toBeTruthy();
		expect(screen.getAllByTestId("sticky-rail-slot-host")).toHaveLength(2);
		expect(screen.getByTestId("positions-ledger")).toBeTruthy();
		expect(screen.getByTestId("payment-activity-ledger")).toBeTruthy();
		expect(lenderPortfolioCommandCenterQueryOptions).toHaveBeenCalledWith(
			PORTAL_ID
		);
		expect(useSuspenseQuery).toHaveBeenCalledWith(COMMAND_CENTER_QUERY_OPTIONS);
	});

	it("hides cached export metadata when the viewer loses export permission", () => {
		vi.mocked(useAuth).mockReturnValue({
			loading: false,
			permissions: ["portfolio:view"],
		} as never);
		vi.mocked(useQuery)
			.mockReturnValueOnce({
				data: portfolioHistoricalSeriesFixture,
				error: null,
				isError: false,
				isPending: false,
			} as never)
			.mockReturnValueOnce({
				data: portfolioTaxExportFixture,
				error: null,
				isError: false,
				isPending: false,
			} as never);

		render(
			<LenderPortfolioPage
				portalId={PORTAL_ID}
				search={DEFAULT_LENDER_PORTFOLIO_SEARCH}
				setSearch={() => undefined}
				snapshot={portfolioCommandCenterFixture}
			/>
		);

		expect(screen.getByText("CSV export unavailable for this role")).toBeTruthy();
		expect(screen.queryByText("2026 year-to-date")).toBeNull();
		expect(
			screen.queryByText("lender-portfolio-tax-export-2026-ytd.csv")
		).toBeNull();
		expect(
			(screen.getByRole("button", {
				name: /download csv/i,
			}) as HTMLButtonElement).disabled
		).toBe(true);
	});

	it("keeps valid empty suggestions visible during command-center refresh", () => {
		const navigate = vi.fn();

		vi.spyOn(Route, "useSearch").mockReturnValue(
			DEFAULT_LENDER_PORTFOLIO_SEARCH as never
		);
		vi.spyOn(RootRoute, "useRouteContext").mockReturnValue(
			ROOT_ROUTE_CONTEXT as never
		);
		vi.mocked(useNavigate).mockReturnValue(navigate);
		vi.mocked(useIsMobile).mockReturnValue(false);
		vi.mocked(useAuth).mockReturnValue({
			loading: false,
			permissions: ["portfolio:view"],
		} as never);
		vi.mocked(lenderPortfolioCommandCenterQueryOptions).mockReturnValue(
			COMMAND_CENTER_QUERY_OPTIONS as never
		);
		vi.mocked(useQuery).mockReturnValue({
			data: portfolioHistoricalSeriesFixture,
			error: null,
			isError: false,
			isPending: false,
		} as never);
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: emptyPortfolioCommandCenterFixture,
			isFetching: true,
		} as never);

		render(<LenderPortfolioRouteComponent />);

		expect(screen.getByTestId("suggested-opportunities-empty")).toBeTruthy();
		expect(screen.queryByTestId("suggested-opportunities-loading")).toBeNull();
	});

	it("routes backend unavailable suggestions into the unavailable state", () => {
		const navigate = vi.fn();

		vi.spyOn(Route, "useSearch").mockReturnValue(
			DEFAULT_LENDER_PORTFOLIO_SEARCH as never
		);
		vi.spyOn(RootRoute, "useRouteContext").mockReturnValue(
			ROOT_ROUTE_CONTEXT as never
		);
		vi.mocked(useNavigate).mockReturnValue(navigate);
		vi.mocked(useIsMobile).mockReturnValue(false);
		vi.mocked(useAuth).mockReturnValue({
			loading: false,
			permissions: ["portfolio:view"],
		} as never);
		vi.mocked(lenderPortfolioCommandCenterQueryOptions).mockReturnValue(
			COMMAND_CENTER_QUERY_OPTIONS as never
		);
		vi.mocked(useQuery).mockReturnValue({
			data: portfolioHistoricalSeriesFixture,
			error: null,
			isError: false,
			isPending: false,
		} as never);
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: unavailableSuggestedOpportunitiesFixture,
			isFetching: false,
		} as never);

		render(<LenderPortfolioRouteComponent />);

		expect(
			screen.getByTestId("suggested-opportunities-unavailable")
		).toBeTruthy();
		expect(screen.queryByTestId("suggested-opportunities-empty")).toBeNull();
	});
});

describe("lender portfolio page", () => {
	it("renders the empty-state-safe command-center shell", () => {
		vi.mocked(useIsMobile).mockReturnValue(false);

		renderPage({
			leafStateOverrides: {
				cockpit: {
					historySeries: emptyPortfolioHistoricalSeriesFixture,
					historyState: "ready",
				},
				exportStrip: {
					canExportTax: false,
					exportContract: null,
					exportState: "forbidden",
				},
			},
			snapshot: emptyPortfolioCommandCenterFixture,
		});

		expect(screen.getByText("No active positions yet")).toBeTruthy();
		expect(screen.getByText("No payment activity yet")).toBeTruthy();
		expect(screen.getAllByText("No historical trend data yet").length).toBe(2);
		expect(screen.getByTestId("suggested-slot-host")).toBeTruthy();
		expect(screen.getAllByTestId("sticky-rail-slot-host")).toHaveLength(2);
	});

	it("updates route-owned filters and sort controls from the ledger headers", () => {
		vi.mocked(useIsMobile).mockReturnValue(false);

		renderPage({});

		expect(
			screen.getByTestId("payment-row-obligation_overdue").textContent
		).toContain("123 King St W, Toronto");

		fireEvent.change(screen.getByLabelText("Search positions"), {
			target: { value: "Queen" },
		});

		expect(
			screen.queryByTestId("position-row-mortgage_king")
		).toBeNull();
		expect(screen.getByTestId("position-row-mortgage_queen")).toBeTruthy();

		fireEvent.change(screen.getByLabelText("Sort payments"), {
			target: { value: "amount-asc" },
		});

		expect(
			screen.getAllByTestId(/^payment-row-/)[0]?.textContent
		).toContain("88 Queen St W, Toronto");

		fireEvent.change(screen.getByLabelText("Filter payments from due date"), {
			target: { value: "2026-05-01" },
		});

		expect(screen.queryByTestId("payment-row-obligation_overdue")).toBeNull();
		expect(screen.getByTestId("payment-row-obligation_upcoming")).toBeTruthy();
	});

	it("opens the position detail host on desktop row click", () => {
		vi.mocked(useIsMobile).mockReturnValue(false);
		vi.mocked(lenderPortfolioPositionDetailQueryOptions).mockReturnValue(
			POSITION_DETAIL_QUERY_OPTIONS as never
		);
		vi.mocked(useQuery).mockImplementation((args: { queryKey: string[] }) => {
			if (args.queryKey[0] === "portfolio-position-detail") {
				return {
					data: portfolioPositionDetailFixture,
					error: null,
					isPending: false,
				} as never;
			}
			return {
				data: undefined,
				error: null,
				isPending: false,
			} as never;
		});

		renderPage({});

		fireEvent.click(screen.getByTestId("position-row-mortgage_king"));

		expect(screen.getByTestId("position-detail-host")).toBeTruthy();
		expect(screen.getByText("Position detail")).toBeTruthy();
		expect(
			within(screen.getByTestId("position-detail-host")).getAllByText(
				"123 King St W, Toronto"
			).length
		).toBeGreaterThan(0);
		expect(
			screen.getByLabelText("Close Position detail")
		).toBeTruthy();
	});

	it("opens the payment detail host in the mobile drawer path", () => {
		vi.mocked(useIsMobile).mockReturnValue(true);
		vi.mocked(lenderPortfolioPaymentDetailQueryOptions).mockReturnValue(
			PAYMENT_DETAIL_QUERY_OPTIONS as never
		);
		vi.mocked(useQuery).mockImplementation((args: { queryKey: string[] }) => {
			if (args.queryKey[0] === "portfolio-payment-detail") {
				return {
					data: portfolioPaymentDetailFixture,
					error: null,
					isPending: false,
				} as never;
			}
			return {
				data: undefined,
				error: null,
				isPending: false,
			} as never;
		});

		renderPage({});

		fireEvent.click(screen.getByTestId("payment-row-obligation_overdue"));

		expect(screen.getByTestId("payment-detail-host")).toBeTruthy();
		expect(screen.getByText("Payment detail")).toBeTruthy();
		expect(screen.getByText("Status timeline")).toBeTruthy();
	});
});
