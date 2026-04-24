import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export function micPortfolioCommandCenterQueryOptions(portalId: Id<"portals">) {
	return convexQuery(api.micPortfolio.queries.getMicPortfolioCommandCenter, {
		portalId,
	});
}

export function micPortfolioPositionDetailQueryOptions(
	portalId: Id<"portals">,
	mortgageId: string
) {
	return convexQuery(api.micPortfolio.queries.getMicPortfolioPositionDetail, {
		mortgageId: mortgageId as Id<"mortgages">,
		portalId,
	});
}

export function micPortfolioMortgageDetailPageQueryOptions(
	portalId: Id<"portals">,
	mortgageId: string
) {
	return convexQuery(
		api.micPortfolio.queries.getMicPortfolioMortgageDetailPage,
		{
			mortgageId: mortgageId as Id<"mortgages">,
			portalId,
		}
	);
}
