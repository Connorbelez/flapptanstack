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
});
