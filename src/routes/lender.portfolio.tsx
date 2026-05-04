import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { lenderPortfolioCommandCenterQueryOptions } from "#/components/lender/portfolio/query-options";
import { guardRouteAccess } from "#/lib/auth";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import {
	LENDER_PORTFOLIO_ROUTE_PATH,
	LenderPortfolioRouteComponent,
	validateLenderPortfolioSearch,
} from "./-lender-portfolio-route-component";

export const Route = createFileRoute(LENDER_PORTFOLIO_ROUTE_PATH)({
	beforeLoad: guardRouteAccess("lenderPortfolio"),
	component: LenderPortfolioRouteComponent,
	errorComponent: ({ error }) => (
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
							{error instanceof Error ? error.message : "Unknown route error"}
						</p>
					</div>
				</div>
			</div>
		</div>
	),
	loader: async ({ context }) => {
		const portalId = assertActivePortalId(
			context.portalContext,
			"Lender portfolio requires an active portal host."
		);
		await context.queryClient.ensureQueryData(
			lenderPortfolioCommandCenterQueryOptions(portalId)
		);
	},
	validateSearch: validateLenderPortfolioSearch,
});
