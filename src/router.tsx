import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import {
	AuthKitProvider,
	useAccessToken,
	useAuth,
} from "@workos/authkit-tanstack-react-start/client";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useCallback, useMemo } from "react";
import { AppRoutePendingScreen } from "./components/AppRoutePendingScreen";
import { AppErrorComponent } from "./components/error-boundary";
import {
	createPortalCacheScopeController,
	createPortalScopedQueryKeyHashFn,
} from "./lib/portal/query-cache-scope";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;
	if (!CONVEX_URL) {
		throw new Error("missing VITE_CONVEX_URL env var");
	}

	// 1. Initialize Convex & Convex Query
	const convex = new ConvexReactClient(CONVEX_URL);
	const convexQueryClient = new ConvexQueryClient(convex);
	const portalCacheScope = createPortalCacheScopeController();
	const baseQueryKeyHashFn = convexQueryClient.hashFn();

	// 2. Initialize regular TanStack Query & connect them
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				queryKeyHashFn: createPortalScopedQueryKeyHashFn({
					baseHashFn: baseQueryKeyHashFn,
					getPortalCacheScope: portalCacheScope.getScope,
				}),
				queryFn: convexQueryClient.queryFn(),
				gcTime: 5000,
			},
		},
	});
	convexQueryClient.connect(queryClient);

	// 3. Create the Router
	const router = createRouter({
		routeTree,
		defaultPreload: "intent",
		defaultViewTransition: true,
		scrollRestoration: true,
		defaultPreloadStaleTime: 0, // Let React Query handle all caching
		defaultPendingMs: 0, // Show route pendingComponent immediately
		defaultPendingComponent: AppRoutePendingScreen,
		defaultErrorComponent: ({ error, reset }) => (
			<AppErrorComponent error={error} reset={reset} />
		),
		defaultNotFoundComponent: () => <p>not found</p>,
		context: {
			queryClient,
			convexClient: convex,
			convexQueryClient,
			getPortalCacheScope: portalCacheScope.getScope,
			setPortalCacheScope: portalCacheScope.setScope,
		},

		// 4. Wrap the app with SSR-friendly providers
		Wrap: ({ children }) => (
			<AuthKitProvider>
				<ConvexProviderWithAuth
					client={convexQueryClient.convexClient}
					useAuth={useAuthFromWorkOS}
				>
					{children}
				</ConvexProviderWithAuth>
			</AuthKitProvider>
		),
	});

	// 5. Setup SSR integration
	setupRouterSsrQueryIntegration({ router, queryClient });

	return router;
}

// 6. Adapter to map WorkOS auth state to Convex's expected auth format
function useAuthFromWorkOS() {
	const { loading, user } = useAuth();
	const { getAccessToken, refresh } = useAccessToken();

	const fetchAccessToken = useCallback(
		async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
			if (!user) {
				return null;
			}

			if (forceRefreshToken) {
				return (await refresh()) ?? null;
			}

			return (await getAccessToken()) ?? null;
		},
		[user, refresh, getAccessToken]
	);

	return useMemo(
		() => ({
			isLoading: loading,
			isAuthenticated: !!user,
			fetchAccessToken,
		}),
		[loading, user, fetchAccessToken]
	);
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
