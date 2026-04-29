import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, AuthLoading } from "convex/react";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
import { LenderPortfolioPage } from "#/components/lender/portfolio/LenderPortfolioPage";
import type { LenderPortfolioSearchState } from "#/components/lender/portfolio/portfolio-types";
import { lenderPortfolioCommandCenterQueryOptions } from "#/components/lender/portfolio/query-options";
import {
	cleanLenderPortfolioSearch,
	parseLenderPortfolioSearch,
} from "#/components/lender/portfolio/search";
import { guardPermission } from "#/lib/auth";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import { Route as RootRoute } from "./__root";

const LENDER_PORTFOLIO_ROUTE_PATH = "/lender/portfolio" as const;

export const Route = createFileRoute(LENDER_PORTFOLIO_ROUTE_PATH)({
	beforeLoad: guardPermission("portfolio:view"),
	component: LenderPortfolioRouteComponent,
	errorComponent: ({ error }) => {
		return <LenderPortfolioRouteError error={error} />;
	},
	loader: async ({ context }) => {
		const portalId = assertActivePortalId(
			context.portalContext,
			"Lender portfolio requires an active portal host."
		);
		await context.queryClient.ensureQueryData(
			lenderPortfolioCommandCenterQueryOptions(portalId)
		);
	},
	validateSearch: (search: Record<string, unknown>) =>
		parseLenderPortfolioSearch(search),
});

export function LenderPortfolioRouteComponent() {
	return (
		<>
			<Authenticated>
				<LenderPortfolioRouteContent />
			</Authenticated>
			<AuthLoading>
				<AppRoutePendingScreen />
			</AuthLoading>
		</>
	);
}

function LenderPortfolioRouteError({ error }: { error: unknown }) {
	useEffect(() => {
		if (import.meta.env.DEV) {
			console.error(error);
		}
	}, [error]);

	return (
		<div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
			<div className="rounded-2xl border border-border/70 bg-card p-8 shadow-sm">
				<div className="flex items-start gap-4">
					<div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
						<AlertTriangle className="size-5" />
					</div>
					<div className="space-y-2">
						<h1 className="font-semibold text-2xl tracking-tight">
							Unable to load lender portfolio
						</h1>
						<p className="max-w-2xl text-muted-foreground text-sm leading-6">
							The command-center host could not be prepared for this portal.
							Check the active portal assignment, route permissions, or upstream
							portfolio contracts.
						</p>
						<p className="text-muted-foreground text-xs">
							Please try again or contact support if this continues.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}

function LenderPortfolioRouteContent() {
	const navigate = useNavigate({ from: LENDER_PORTFOLIO_ROUTE_PATH });
	const search = Route.useSearch();
	const { portalContext } = RootRoute.useRouteContext();
	const portalId = assertActivePortalId(
		portalContext,
		"Lender portfolio requires an active portal host."
	);
	const { data } = useSuspenseQuery(
		lenderPortfolioCommandCenterQueryOptions(portalId)
	);

	return (
		<LenderPortfolioPage
			portalId={portalId}
			search={search}
			setSearch={(updater) =>
				void navigate({
					search: (current) =>
						cleanLenderPortfolioSearch(
							updater(current as LenderPortfolioSearchState)
						) as LenderPortfolioSearchState,
					to: LENDER_PORTFOLIO_ROUTE_PATH,
				})
			}
			snapshot={data}
		/>
	);
}
