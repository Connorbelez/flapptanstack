import { useSuspenseQuery } from "@tanstack/react-query";
import type { FileRoutesByPath } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { Authenticated, AuthLoading } from "convex/react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
import { LenderPortfolioPage } from "#/components/lender/portfolio/LenderPortfolioPage";
import type { LenderPortfolioSearchState } from "#/components/lender/portfolio/portfolio-types";
import { lenderPortfolioCommandCenterQueryOptions } from "#/components/lender/portfolio/query-options";
import {
	cleanLenderPortfolioSearch,
	parseLenderPortfolioSearch,
} from "#/components/lender/portfolio/search";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import { Route as RootRoute } from "./__root";
import { Route } from "./lender.portfolio";

export const LENDER_PORTFOLIO_ROUTE_PATH =
	"/lender/portfolio" as keyof FileRoutesByPath & string;

export const validateLenderPortfolioSearch = (
	search: Record<string, unknown>
) => parseLenderPortfolioSearch(search);

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

function LenderPortfolioRouteContent() {
	const navigate = useNavigate();
	const search = Route.useSearch() as LenderPortfolioSearchState;
	const { portalContext } = RootRoute.useRouteContext();
	const portalId = assertActivePortalId(
		portalContext,
		"Lender portfolio requires an active portal host."
	);
	const { data } = useSuspenseQuery(
		lenderPortfolioCommandCenterQueryOptions(portalId)
	);
	const suggestedOpportunitiesState: "ready" | "unavailable" =
		data.suggestedOpportunities.availabilityState === "unavailable"
			? "unavailable"
			: "ready";

	return (
		<LenderPortfolioPage
			access={{ mode: "portal", portalId }}
			search={search}
			setSearch={(updater) =>
				void navigate({
					search: (current: LenderPortfolioSearchState) =>
						cleanLenderPortfolioSearch(updater(current)),
					to: LENDER_PORTFOLIO_ROUTE_PATH,
				} as never)
			}
			snapshot={data}
			suggestedOpportunitiesState={suggestedOpportunitiesState}
		/>
	);
}
