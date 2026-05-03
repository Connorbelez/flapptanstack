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

export function adminLenderPortfolioCommandCenterQueryOptions(
	targetLenderId: Id<"lenders">
) {
	return convexQuery(
		api.admin.portfolio.queries.getAdminLenderPortfolioCommandCenter,
		{ targetLenderId }
	);
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

export function adminLenderPortfolioPositionDetailQueryOptions(
	targetLenderId: Id<"lenders">,
	mortgageId: string
) {
	return convexQuery(
		api.admin.portfolio.queries.getAdminLenderPortfolioPositionDetail,
		{
			mortgageId: mortgageId as Id<"mortgages">,
			targetLenderId,
		}
	);
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

export function adminLenderPortfolioPaymentDetailQueryOptions(
	targetLenderId: Id<"lenders">,
	obligationId: string
) {
	return convexQuery(
		api.admin.portfolio.queries.getAdminLenderPortfolioPaymentDetail,
		{
			obligationId: obligationId as Id<"obligations">,
			targetLenderId,
		}
	);
}

export function lenderPortfolioRenewalIntentQueryOptions(
	portalId: Id<"portals">,
	mortgageId: string
) {
	return convexQuery(api.renewals.portal.getLenderRenewalIntentByMortgage, {
		mortgageId: mortgageId as Id<"mortgages">,
		portalId,
	});
}

export function adminLenderPortfolioRenewalIntentQueryOptions(
	targetLenderId: Id<"lenders">,
	mortgageId: string
) {
	return convexQuery(
		api.admin.portfolio.queries.getAdminLenderPortfolioRenewalIntentByMortgage,
		{
			mortgageId: mortgageId as Id<"mortgages">,
			targetLenderId,
		}
	);
}
