/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchWorkosAuthMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-start", async () => {
	const actual =
		await vi.importActual<typeof import("@tanstack/react-start")>(
			"@tanstack/react-start"
		);

	return {
		...actual,
		createServerFn: () => ({
			handler: () => fetchWorkosAuthMock,
			middleware: () => ({
				handler: () => fetchWorkosAuthMock,
			}),
		}),
	};
});

function buildUnknownPortalContext() {
	return {
		kind: "unknown" as const,
		requestedHost: "ghost.localhost:3000",
		canonicalHost: "ghost.localhost:3000",
		cacheKey: "unknown:ghost.localhost:3000",
	};
}

function buildFetchWorkosAuthResult() {
	const portalContext = buildUnknownPortalContext();
	return {
		userId: null,
		token: null,
		role: null,
		roles: [],
		permissions: [],
		orgId: null,
		portalCacheKey: portalContext.cacheKey,
		portalContext,
		requestHost: portalContext.requestedHost,
		viewerPortalAssignment: null,
	};
}

function buildMarketingFetchWorkosAuthResult() {
	return {
		userId: null,
		token: null,
		role: null,
		roles: [],
		permissions: [],
		orgId: null,
		portalCacheKey: "marketing:localhost:3000",
		portalContext: {
			kind: "marketing" as const,
			requestedHost: "localhost:3000",
			canonicalHost: "localhost:3000",
			cacheKey: "marketing:localhost:3000",
		},
		requestHost: "localhost:3000",
		viewerPortalAssignment: null,
	};
}

function buildWrongPortalFetchWorkosAuthResult() {
	return {
		userId: "user_app",
		token: "token",
		role: "lender",
		roles: ["lender"],
		permissions: ["listing:view"],
		orgId: "org_app",
		portalCacheKey: "portal:portal_meridian:active:local:meridian.localhost:3000",
		portalContext: {
			kind: "portal" as const,
			requestedHost: "meridian.localhost:3000",
			canonicalHost: "meridian.localhost:3000",
			cacheKey:
				"portal:portal_meridian:active:local:meridian.localhost:3000",
			availability: "active" as const,
			matchedHostType: "local" as const,
			portal: {
				portalId: "portal_meridian",
				slug: "meridian",
				portalType: "broker",
				productionHost: "meridian.fairlend.ca",
				localHost: "meridian.localhost:3000",
				status: "active",
				isPublished: true,
				publicTeaserEnabled: true,
				teaserListingLimit: 12,
				defaultPostAuthPath: "/",
			},
		},
		requestHost: "meridian.localhost:3000",
		viewerPortalAssignment: {
			userId: "user_app",
			homePortalId: "portal_app",
			homePortal: {
				portalId: "portal_app",
				slug: "app",
				portalType: "fairlend",
				productionHost: "app.fairlend.ca",
				localHost: "app.localhost:3000",
				status: "active",
				isPublished: true,
				defaultPostAuthPath: "/borrower/home",
			},
			currentOrgPortalId: null,
			currentOrgPortal: null,
			isFairLendAdmin: false,
		},
	};
}

describe("root route blocked-host handling", () => {
	beforeEach(() => {
		vi.resetModules();
		fetchWorkosAuthMock.mockReset();
	});

	it("keeps the / child route inert for blocked hosts", async () => {
		fetchWorkosAuthMock.mockResolvedValue(buildFetchWorkosAuthResult());

		const rootRouteModule = await import("#/routes/__root");
		const indexRouteModule = await import("#/routes/index");
		const setPortalCacheScope = vi.fn();

		const result = await rootRouteModule.Route.options.beforeLoad?.({
			context: {
				convexQueryClient: {
					serverHttpClient: {
						setAuth: vi.fn(),
					},
				},
				setPortalCacheScope,
			},
			location: { pathname: "/" },
		} as never);

		expect(result).toMatchObject({
			portalCacheKey: "unknown:ghost.localhost:3000",
			portalContext: {
				kind: "unknown",
				requestedHost: "ghost.localhost:3000",
			},
		});
		expect(setPortalCacheScope).toHaveBeenCalledWith(
			"unknown:ghost.localhost:3000"
		);
		expect(indexRouteModule.Route.options.loader).toBeUndefined();
	});

	it("redirects blocked hosts away from non-root routes before child loaders can run", async () => {
		fetchWorkosAuthMock.mockResolvedValue(buildFetchWorkosAuthResult());

		const rootRouteModule = await import("#/routes/__root");

		await expect(
			rootRouteModule.Route.options.beforeLoad?.({
				context: {
					convexQueryClient: {
						serverHttpClient: {
							setAuth: vi.fn(),
						},
					},
					setPortalCacheScope: vi.fn(),
				},
				location: { pathname: "/lender/listings" },
			} as never)
		).rejects.toMatchObject({
			options: {
				statusCode: 307,
				to: "/",
			},
			});
	});

	it("allows /callback to pass through the blocked-host guard", async () => {
		fetchWorkosAuthMock.mockResolvedValue(buildFetchWorkosAuthResult());

		const rootRouteModule = await import("#/routes/__root");

		await expect(
			rootRouteModule.Route.options.beforeLoad?.({
				context: {
					convexQueryClient: {
						serverHttpClient: {
							setAuth: vi.fn(),
						},
					},
					setPortalCacheScope: vi.fn(),
				},
				location: { pathname: "/callback" },
			} as never)
		).resolves.toMatchObject({
			portalContext: {
				kind: "unknown",
			},
		});
	});

	it("allows /auth-complete to pass through the blocked-host guard", async () => {
		fetchWorkosAuthMock.mockResolvedValue(buildFetchWorkosAuthResult());

		const rootRouteModule = await import("#/routes/__root");

		await expect(
			rootRouteModule.Route.options.beforeLoad?.({
				context: {
					convexQueryClient: {
						serverHttpClient: {
							setAuth: vi.fn(),
						},
					},
					setPortalCacheScope: vi.fn(),
				},
				location: { pathname: "/auth-complete" },
			} as never)
		).resolves.toMatchObject({
			portalContext: {
				kind: "unknown",
			},
		});
	});

	it("redirects marketing-host portal routes to the host boundary before child loaders run", async () => {
		fetchWorkosAuthMock.mockResolvedValue(buildMarketingFetchWorkosAuthResult());

		const rootRouteModule = await import("#/routes/__root");

		await expect(
			rootRouteModule.Route.options.beforeLoad?.({
				context: {
					convexQueryClient: {
						serverHttpClient: {
							setAuth: vi.fn(),
						},
					},
					setPortalCacheScope: vi.fn(),
				},
				location: { href: "/listings", pathname: "/listings" },
			} as never)
		).rejects.toMatchObject({
			options: {
				statusCode: 307,
				to: "/host-boundary",
				search: {
					returnTo: "/listings",
				},
			},
		});
	});

	it("redirects wrong-portal requests to the host boundary before child loaders run", async () => {
		fetchWorkosAuthMock.mockResolvedValue(buildWrongPortalFetchWorkosAuthResult());

		const rootRouteModule = await import("#/routes/__root");

		await expect(
			rootRouteModule.Route.options.beforeLoad?.({
				context: {
					convexQueryClient: {
						serverHttpClient: {
							setAuth: vi.fn(),
						},
					},
					setPortalCacheScope: vi.fn(),
				},
				location: { href: "/listings", pathname: "/listings" },
			} as never)
		).rejects.toMatchObject({
			options: {
				statusCode: 307,
				to: "/host-boundary",
				search: {
					returnTo: "/listings",
				},
			},
		});
	});
});
