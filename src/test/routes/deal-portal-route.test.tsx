/**
 * @vitest-environment jsdom
 */

import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	dealPortalQueryOptions,
	DealPortalRouteComponent,
	Route,
} from "#/routes/deals/$dealId";
import { Route as AdminDealRoute } from "#/routes/admin/deals/$recordid";
import { Route as BorrowerDealRoute } from "#/routes/borrower.deals.$dealId";
import { Route as BrokerDealRoute } from "#/routes/broker.deals.$dealId";
import { Route as LawyerDealRoute } from "#/routes/lawyer/deals.$dealId";
import { Route as LenderDealRoute } from "#/routes/lender.deals.$dealId";

const convexReactMockState = vi.hoisted(() => ({
	renderAuthenticatedChildren: true,
}));

vi.mock("@convex-dev/react-query", () => ({
	convexQuery: vi.fn((_apiRef: unknown, args: unknown) => ({
		queryKey: ["deal-portal-workspace", args],
	})),
}));

vi.mock("@tanstack/react-query", () => ({
	useSuspenseQuery: vi.fn(),
}));

vi.mock("convex/react", () => ({
	Authenticated: ({ children }: { children: ReactNode }) =>
		convexReactMockState.renderAuthenticatedChildren ? (
			<div data-testid="authenticated-shell">{children}</div>
		) : null,
	AuthLoading: ({ children }: { children: ReactNode }) => (
		<div data-testid="auth-loading-shell">{children}</div>
	),
}));

vi.mock("#/components/deals/portal/DealPortalPage", () => ({
	DealPortalPage: ({ workspace }: { workspace: { deal: { dealId: string } } }) => (
		<div>Deal portal page {workspace.deal.dealId}</div>
	),
}));

afterEach(() => {
	cleanup();
	convexReactMockState.renderAuthenticatedChildren = true;
	vi.restoreAllMocks();
});

function captureThrown(perform: () => void) {
	try {
		perform();
		return null;
	} catch (error) {
		return error;
	}
}

const workspace = {
	deal: { dealId: "deal_route" },
};

function expectRedirectToPortal(
	route: { options: { beforeLoad?: (args: never) => unknown } },
	params: Record<string, string>
) {
	const thrown = captureThrown(() =>
		route.options.beforeLoad?.({ params } as never)
	);
	expect(thrown).toMatchObject({
		options: {
			params: { dealId: "deal_route" },
			statusCode: 307,
			to: "/deals/$dealId",
		},
	});
}

describe("deal portal route", () => {
	it("redirects signed-out viewers to AuthKit with a deal portal return path", () => {
		const thrown = captureThrown(() =>
			Route.options.beforeLoad?.({
				context: {
					orgId: null,
					permissions: [],
					role: null,
					roles: [],
					token: null,
					userId: null,
				},
				location: {
					href: "/deals/deal_route",
					pathname: "/deals/deal_route",
				},
			} as never)
		);

		expect(thrown).toMatchObject({
			options: {
				search: { redirect: "/deals/deal_route" },
				statusCode: 307,
				to: "/sign-in",
			},
		});
	});

	it("returns route params from the loader without subscribing before auth readiness", async () => {
		const ensureQueryData = vi.fn().mockResolvedValue(workspace);

		expect(
			await Route.options.loader?.({
				context: {
					queryClient: { ensureQueryData },
				},
				params: { dealId: "deal_route" },
			} as never)
		).toEqual({ dealId: "deal_route" });

		expect(convexQuery).not.toHaveBeenCalled();
		expect(ensureQueryData).not.toHaveBeenCalled();
	});

	it("renders the portal page inside the Convex authenticated boundary", () => {
		vi.spyOn(Route, "useLoaderData").mockReturnValue({
			dealId: "deal_route",
		} as never);
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: workspace,
		} as never);

		render(<DealPortalRouteComponent />);

		expect(screen.getByTestId("authenticated-shell")).toBeTruthy();
		expect(screen.getByText("Deal portal page deal_route")).toBeTruthy();
	});

	it("does not subscribe to the workspace query before Convex auth is ready", () => {
		convexReactMockState.renderAuthenticatedChildren = false;
		vi.spyOn(Route, "useLoaderData").mockReturnValue({
			dealId: "deal_route",
		} as never);
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: workspace,
		} as never);

		render(<DealPortalRouteComponent />);

		expect(useSuspenseQuery).not.toHaveBeenCalled();
		expect(screen.queryByText("Deal portal page deal_route")).toBeNull();
	});

	it("delegates legacy deal detail routes into the shared portal route", () => {
		const legacyDealRouteTargets = {
			admin: "/deals/$dealId",
			borrower: "/deals/$dealId",
			broker: "/deals/$dealId",
			lawyer: "/deals/$dealId",
			lender: "/deals/$dealId",
		} as const;

		expect(legacyDealRouteTargets).toEqual({
			admin: "/deals/$dealId",
			borrower: "/deals/$dealId",
			broker: "/deals/$dealId",
			lawyer: "/deals/$dealId",
			lender: "/deals/$dealId",
		});
		expectRedirectToPortal(LenderDealRoute, { dealId: "deal_route" });
		expectRedirectToPortal(LawyerDealRoute, { dealId: "deal_route" });
		expectRedirectToPortal(BrokerDealRoute, { dealId: "deal_route" });
		expectRedirectToPortal(BorrowerDealRoute, { dealId: "deal_route" });
		expectRedirectToPortal(AdminDealRoute, { recordid: "deal_route" });
	});
});
