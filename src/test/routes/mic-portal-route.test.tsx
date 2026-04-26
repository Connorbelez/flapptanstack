/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MicPortalRouteComponent, Route } from "#/routes/portal";
import { Route as RootRoute } from "#/routes/__root";

let convexAuthState: "authenticated" | "loading" = "authenticated";

vi.mock("convex/react", () => ({
	Authenticated: ({ children }: { children: ReactNode }) =>
		convexAuthState === "authenticated" ? (
			<div data-testid="authenticated-shell">{children}</div>
		) : null,
	AuthLoading: ({ children }: { children: ReactNode }) =>
		convexAuthState === "loading" ? (
			<div data-testid="auth-loading-shell">{children}</div>
		) : null,
}));

vi.mock("#/routes/__root", () => ({
	Route: {
		useRouteContext: vi.fn(),
	},
}));

afterEach(() => {
	cleanup();
	convexAuthState = "authenticated";
	vi.restoreAllMocks();
});

const MIC_PORTAL_CONTEXT = {
	portalContext: {
		availability: "active",
		cacheKey: "portal:portal_mic:active:local:mic.localhost:3000",
		canonicalHost: "mic.localhost:3000",
		kind: "portal",
		matchedHostType: "local",
		portal: {
			defaultPostAuthPath: "/portal",
			isPublished: true,
			localHost: "mic.localhost:3000",
			orgId: "org_mic",
			portalId: "portal_mic",
			portalType: "mic",
			productionHost: "mic.fairlend.ca",
			publicTeaserEnabled: true,
			slug: "mic",
			status: "active",
			teaserListingLimit: 0,
		},
		requestedHost: "mic.localhost:3000",
	},
};

function captureThrown(perform: () => void) {
	try {
		perform();
		return null;
	} catch (error) {
		return error;
	}
}

describe("MIC portal route", () => {
	it("redirects signed-out visitors to sign-in with a /portal return path", () => {
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
					href: "/portal",
					pathname: "/portal",
				},
			} as never)
		);

		expect(thrown).toMatchObject({
			options: {
				search: {
					redirect: "/portal",
				},
				statusCode: 307,
				to: "/sign-in",
			},
		});
	});

	it("denies authenticated visitors without mic:access", () => {
		const thrown = captureThrown(() =>
			Route.options.beforeLoad?.({
				context: {
					orgId: "org_lender",
					permissions: ["lender:access", "portfolio:view"],
					role: "lender",
					roles: ["lender"],
					token: "token",
					userId: "user_lender",
				},
				location: {
					href: "/portal",
					pathname: "/portal",
				},
			} as never)
		);

		expect(thrown).toMatchObject({
			options: {
				statusCode: 307,
				to: "/unauthorized",
			},
		});
	});

	it("allows MIC investors and admins through the shared route guard", () => {
		expect(
			captureThrown(() =>
				Route.options.beforeLoad?.({
					context: {
						orgId: "org_mic",
						permissions: ["mic:access"],
						role: "micinvestor",
						roles: ["micinvestor"],
						token: "token",
						userId: "user_mic",
					},
					location: {
						href: "/portal",
						pathname: "/portal",
					},
				} as never)
			)
		).toBeNull();

		expect(
			captureThrown(() =>
				Route.options.beforeLoad?.({
					context: {
						orgId: "org_admin",
						permissions: ["admin:access"],
						role: "admin",
						roles: ["admin"],
						token: "token",
						userId: "user_admin",
					},
					location: {
						href: "/portal",
						pathname: "/portal",
					},
				} as never)
			)
		).toBeNull();
	});

	it("renders protected content inside the Convex authenticated boundary", () => {
		vi.mocked(RootRoute.useRouteContext).mockReturnValue(
			MIC_PORTAL_CONTEXT as never
		);

		render(<MicPortalRouteComponent />);

		expect(screen.getByTestId("authenticated-shell")).toBeTruthy();
		expect(screen.getByText("Protected MIC portal")).toBeTruthy();
		expect(screen.getByText("portal_mic")).toBeTruthy();
	});

	it("does not mount protected content while Convex auth is loading", () => {
		convexAuthState = "loading";
		vi.mocked(RootRoute.useRouteContext).mockReturnValue(
			MIC_PORTAL_CONTEXT as never
		);

		render(<MicPortalRouteComponent />);

		expect(screen.getByTestId("auth-loading-shell")).toBeTruthy();
		expect(screen.queryByText("Protected MIC portal")).toBeNull();
		expect(screen.queryByText("portal_mic")).toBeNull();
	});
});
