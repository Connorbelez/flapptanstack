import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	redirect,
	ScriptOnce,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { AppErrorComponent } from "../components/error-boundary";
import Header from "../components/header";
import { PortalStateBoundary } from "../components/portal/portal-state-boundary";
import { Toaster } from "../components/ui/sonner";
import { isAdminPathname } from "../lib/admin-routes";
import { getReturnPathname } from "../lib/auth-redirect";
import { portalRequestMiddleware } from "../lib/portal/request-host";
import { resolveRouteHostDecision } from "../lib/portal/route-host-decision";
import { resolveRouteHostSession } from "../lib/portal/route-host-session";
import appCss from "../styles.css?url";

// Suppress known TanStack Start SSR hydration warning (dev-only, harmless)
const SUPPRESS_WARNINGS_SCRIPT = `(function(){if(typeof window!=='undefined'){var ow=console.warn;console.warn=function(){if(typeof arguments[0]==='string'&&arguments[0].indexOf('useRouter must be used inside')!==-1)return;ow.apply(console,arguments)}}})();`;

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

const fetchWorkosAuth = createServerFn({ method: "GET" })
	.middleware([portalRequestMiddleware])
	.handler(async ({ context }) =>
		resolveRouteHostSession({ requestHost: context.requestHost })
	);

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
	convexClient: ConvexReactClient;
	convexQueryClient: ConvexQueryClient;
	getPortalCacheScope: () => string;
	setPortalCacheScope: (nextScope: string) => void;
}>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Convex + TanStack Start + WorkOS AuthKit",
			},
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", href: "/convex.svg" },
		],
	}),
	component: RootComponent,
	errorComponent: ({ error, reset }) => (
		<RootDocument>
			<AppErrorComponent error={error} reset={reset} />
		</RootDocument>
	),
	notFoundComponent: () => (
		<RootDocument>
			<AppErrorComponent
				error={Object.assign(new Error("Page not found"), {
					name: "NotFoundError",
				})}
			/>
		</RootDocument>
	),
	beforeLoad: async (ctx) => {
		const {
			userId,
			token,
			role,
			roles,
			permissions,
			orgId,
			portalCacheKey,
			portalContext,
			requestHost,
			viewerPortalAssignment,
		} = await fetchWorkosAuth();

		// During SSR only (the only time serverHttpClient exists),
		// set the WorkOS auth token to make HTTP queries with.
		if (token) {
			ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
		}
		ctx.context.setPortalCacheScope(portalCacheKey);

		const isBlockedPortalHost =
			portalContext.kind === "reserved" ||
			portalContext.kind === "unknown" ||
			(portalContext.kind === "portal" &&
				portalContext.availability !== "active");
		const isAllowedBlockedHostAuthPath =
			ctx.location.pathname === "/auth-complete" ||
			ctx.location.pathname === "/callback";
		if (
			isBlockedPortalHost &&
			ctx.location.pathname !== "/" &&
			!isAllowedBlockedHostAuthPath
		) {
			throw redirect({ to: "/" });
		}

		const routeHostDecision = resolveRouteHostDecision({
			pathname: ctx.location.pathname,
			portalContext,
			returnTo: getReturnPathname(ctx.location.href ?? ctx.location.pathname),
			userId,
			viewerPortalAssignment,
		});
		if (routeHostDecision.kind === "boundary") {
			throw redirect({
				to: "/host-boundary",
				search: { returnTo: routeHostDecision.returnTo },
			});
		}
		if (routeHostDecision.kind === "redirect") {
			throw redirect({ href: routeHostDecision.href });
		}

		return {
			userId,
			token,
			role,
			roles,
			permissions,
			orgId,
			portalCacheKey,
			portalContext,
			requestHost,
			viewerPortalAssignment,
		};
	},
});

function RootComponent() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const { portalContext } = Route.useRouteContext();
	const isAdminRoute = isAdminPathname(pathname);

	return (
		<RootDocument>
			<PortalStateBoundary portalContext={portalContext}>
				{isAdminRoute ? null : <Header />}
				<Outlet />
			</PortalStateBoundary>
		</RootDocument>
	);
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<ScriptOnce>{SUPPRESS_WARNINGS_SCRIPT}</ScriptOnce>
				<ScriptOnce>{THEME_INIT_SCRIPT}</ScriptOnce>
				<HeadContent />
			</head>
			<body className="wrap-anywhere font-sans antialiased selection:bg-[rgba(79,184,178,0.24)]">
				{children}
				<Toaster />
				<Scripts />
			</body>
		</html>
	);
}
