import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export function lenderPortfolioCommandCenterQueryOptions(
	portalId: Id<"portals">
) {
	return convexQuery(api.portfolio.queries.getLenderPortfolioCommandCenter, {
		portalId,
	});
}

export function lenderPortfolioPositionDetailQueryOptions(
	portalId: Id<"portals">,
	mortgageId: string
) {
	return convexQuery(api.portfolio.queries.getLenderPortfolioPositionDetail, {
		mortgageId: mortgageId as Id<"mortgages">,
		portalId,
	});
}

export function lenderPortfolioPaymentDetailQueryOptions(
	portalId: Id<"portals">,
	obligationId: string
) {
	return convexQuery(api.portfolio.queries.getLenderPortfolioPaymentDetail, {
		obligationId: obligationId as Id<"obligations">,
		portalId,
	});
}
