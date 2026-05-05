/**
 * @vitest-environment jsdom
 */

import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@convex-dev/react-query", () => ({
	convexQuery: vi.fn((_apiRef: unknown, args: unknown) => ({
		queryKey: ["deal-portal-workspace", args],
	})),
}));

vi.mock("@tanstack/react-query", () => ({
	useSuspenseQuery: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
		"@tanstack/react-router"
	);

	return {
		...actual,
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

vi.mock("#/components/deals/portal/DealPortalPage", () => ({
	DealPortalPage: ({ workspace }: { workspace: { deal: { dealId: string } } }) => (
		<div>Deal portal page {workspace.deal.dealId}</div>
	),
}));

afterEach(() => {
	cleanup();
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

	it("prefetches the shared deal portal workspace in the loader", async () => {
		const ensureQueryData = vi.fn().mockResolvedValue(workspace);

		await expect(
			Route.options.loader?.({
				context: {
					queryClient: { ensureQueryData },
				},
				params: { dealId: "deal_route" },
			} as never)
		).resolves.toEqual({ dealId: "deal_route" });

		expect(convexQuery).toHaveBeenCalledWith(expect.anything(), {
			dealId: "deal_route",
		});
		expect(ensureQueryData).toHaveBeenCalledWith(
			dealPortalQueryOptions("deal_route")
		);
	});

	it("redirects onboarding-only lawyer decisions before rendering the portal", async () => {
		const ensureQueryData = vi.fn().mockResolvedValue({
			accessDecision: {
				allowed: false,
				persona: "primary_lawyer",
				readiness: "invited",
				redirectTo: "/lawyer/deals/deal_route",
				scope: "none",
			},
			deal: { dealId: "deal_route" },
		});

		await expect(
			Route.options.loader?.({
				context: {
					queryClient: { ensureQueryData },
				},
				params: { dealId: "deal_route" },
			} as never)
		).rejects.toMatchObject({
			options: {
				href: "/lawyer/deals/deal_route",
				statusCode: 307,
			},
		});
	});

	it("renders the portal page inside the Convex authenticated boundary", () => {
		vi.spyOn(Route, "useLoaderData").mockReturnValue({
			dealId: "deal_route",
		} as never);
		vi.mocked(useNavigate).mockReturnValue(vi.fn() as never);
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: workspace,
		} as never);

		render(<DealPortalRouteComponent />);

		expect(screen.getByTestId("authenticated-shell")).toBeTruthy();
		expect(screen.getByText("Deal portal page deal_route")).toBeTruthy();
	});

	it("does not crash if a cached workspace predates accessDecision", () => {
		vi.spyOn(Route, "useLoaderData").mockReturnValue({
			dealId: "deal_route",
		} as never);
		vi.mocked(useNavigate).mockReturnValue(vi.fn() as never);
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: workspace,
		} as never);

		render(<DealPortalRouteComponent />);

		expect(screen.getByText("Deal portal page deal_route")).toBeTruthy();
	});

	it("redirects stale onboarding-required portal payloads to lawyer bootstrap", async () => {
		const navigate = vi.fn().mockResolvedValue(undefined);
		vi.spyOn(Route, "useLoaderData").mockReturnValue({
			dealId: "deal_route",
		} as never);
		vi.mocked(useNavigate).mockReturnValue(navigate as never);
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: {
				deal: { dealId: "deal_route" },
				onboarding: {
					nextRoute: null,
					required: true,
					sessionId: null,
				},
				viewer: {
					persona: "selected_lawyer_onboarding_required",
					readiness: "onboarding_in_progress",
				},
			},
		} as never);

		render(<DealPortalRouteComponent />);

		await waitFor(() => {
			expect(navigate).toHaveBeenCalledWith({
				href: "/lawyer/deals/deal_route",
				replace: true,
			});
		});
		expect(screen.queryByText("Deal portal page deal_route")).toBeNull();
	});

	it("loader redirects stale onboarding-required workspace payloads before render", async () => {
		const ensureQueryData = vi.fn().mockResolvedValue({
			deal: { dealId: "deal_route" },
			onboarding: {
				nextRoute: "/lawyer/onboarding/session_route",
				required: true,
				sessionId: "session_route",
			},
			viewer: {
				persona: "selected_lawyer_onboarding_required",
			},
		});

		await expect(
			Route.options.loader?.({
				context: {
					queryClient: { ensureQueryData },
				},
				params: { dealId: "deal_route" },
			} as never)
		).rejects.toMatchObject({
			options: {
				href: "/lawyer/onboarding/session_route",
				statusCode: 307,
			},
		});
	});

	it("component-level guard redirects denied onboarding decisions without rendering the portal", async () => {
		const navigate = vi.fn().mockResolvedValue(undefined);
		vi.spyOn(Route, "useLoaderData").mockReturnValue({
			dealId: "deal_route",
		} as never);
		vi.mocked(useNavigate).mockReturnValue(navigate as never);
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: {
				accessDecision: {
					allowed: false,
					persona: "primary_lawyer",
					readiness: "onboarding_in_progress",
					redirectTo: "/lawyer/onboarding/session_route",
					scope: "none",
				},
				deal: { dealId: "deal_route" },
			},
		} as never);

		render(<DealPortalRouteComponent />);

		await waitFor(() => {
			expect(navigate).toHaveBeenCalledWith({
				href: "/lawyer/onboarding/session_route",
				replace: true,
			});
		});
		expect(screen.queryByText("Deal portal page deal_route")).toBeNull();
	});

	it("delegates legacy lender, broker, borrower, and admin detail routes into the shared portal route", () => {
		const legacyDealRouteTargets = {
			admin: "/deals/$dealId",
			borrower: "/deals/$dealId",
			broker: "/deals/$dealId",
			lender: "/deals/$dealId",
		} as const;

		expect(legacyDealRouteTargets).toEqual({
			admin: "/deals/$dealId",
			borrower: "/deals/$dealId",
			broker: "/deals/$dealId",
			lender: "/deals/$dealId",
		});
		expectRedirectToPortal(LenderDealRoute, { dealId: "deal_route" });
		expectRedirectToPortal(BrokerDealRoute, { dealId: "deal_route" });
		expectRedirectToPortal(BorrowerDealRoute, { dealId: "deal_route" });
		expectRedirectToPortal(AdminDealRoute, { recordid: "deal_route" });
	});

	it("keeps the lawyer deal route as its own onboarding bootstrap entry point", () => {
		expect(LawyerDealRoute.options.beforeLoad).toBeUndefined();
	});
});
