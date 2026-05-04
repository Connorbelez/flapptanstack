import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export type PortfolioQueryAccess =
	| {
			mode: "admin";
			renewalActionReason: string;
			targetLenderId: Id<"lenders">;
	  }
	| { mode: "portal"; portalId: Id<"portals"> };

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

export function lenderPortfolioHistoricalSeriesQueryOptions(
	portalId: Id<"portals">,
	months: number
) {
	return convexQuery(api.portfolio.queries.getLenderPortfolioHistoricalSeries, {
		months,
		portalId,
	});
}

export function adminLenderPortfolioHistoricalSeriesQueryOptions(
	targetLenderId: Id<"lenders">,
	months: number
) {
	return convexQuery(
		api.admin.portfolio.queries.getAdminLenderPortfolioHistoricalSeries,
		{
			months,
			targetLenderId,
		}
	);
}

export function lenderPortfolioTaxExportQueryOptions(portalId: Id<"portals">) {
	return convexQuery(api.portfolio.queries.getLenderPortfolioTaxExport, {
		portalId,
	});
}

export function adminLenderPortfolioTaxExportQueryOptions(
	targetLenderId: Id<"lenders">
) {
	return convexQuery(
		api.admin.portfolio.queries.getAdminLenderPortfolioTaxExport,
		{
			targetLenderId,
		}
	);
}
