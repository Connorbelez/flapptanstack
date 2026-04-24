import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { portalMicQuery, requirePermission } from "../fluent";
import { unixMsToBusinessDate } from "../lib/businessDates";
import type { PortalMicContext } from "../portals/middleware";
import {
	portfolioCommandCenterValidator,
	portfolioHistoricalSeriesValidator,
	portfolioMortgageDetailPageValidator,
	portfolioPositionDetailValidator,
} from "../portfolio/contracts";
import {
	buildPortfolioCommandCenter,
	buildPortfolioMortgageDetailPage,
	buildPortfolioPositionDetail,
} from "../portfolio/helpers";
import { buildPortfolioHistoricalSeries } from "../portfolio/history";

type MicPortfolioContext = Pick<QueryCtx, "db" | "storage"> & {
	lender: Doc<"lenders">;
	lenderAuthId: string;
	portal: PortalMicContext["portal"];
};

function buildMicPortfolioContext(
	ctx: Pick<QueryCtx, "db" | "storage"> &
		Pick<PortalMicContext, "micLender" | "micLenderUser" | "portal">
): MicPortfolioContext {
	if (!ctx.micLenderUser.authId) {
		throw new Error("MIC lender user is missing an authId");
	}

	return {
		db: ctx.db,
		lender: ctx.micLender,
		lenderAuthId: ctx.micLenderUser.authId,
		portal: ctx.portal,
		storage: ctx.storage,
	};
}

export const getMicPortfolioCommandCenter = portalMicQuery()
	.use(requirePermission("mic:access"))
	.returns(portfolioCommandCenterValidator)
	.handler(
		async (ctx) =>
			await buildPortfolioCommandCenter(buildMicPortfolioContext(ctx))
	)
	.public();

export const getMicPortfolioPositionDetail = portalMicQuery({
	mortgageId: v.id("mortgages"),
})
	.use(requirePermission("mic:access"))
	.returns(portfolioPositionDetailValidator)
	.handler(
		async (ctx, args) =>
			await buildPortfolioPositionDetail(
				buildMicPortfolioContext(ctx),
				args.mortgageId
			)
	)
	.public();

export const getMicPortfolioMortgageDetailPage = portalMicQuery({
	mortgageId: v.id("mortgages"),
})
	.use(requirePermission("mic:access"))
	.returns(portfolioMortgageDetailPageValidator)
	.handler(
		async (ctx, args) =>
			await buildPortfolioMortgageDetailPage(
				buildMicPortfolioContext(ctx),
				args.mortgageId
			)
	)
	.public();

export const getMicPortfolioHistoricalSeries = portalMicQuery({
	months: v.optional(v.number()),
})
	.use(requirePermission("mic:access"))
	.returns(portfolioHistoricalSeriesValidator)
	.handler(
		async (ctx, args) =>
			await buildPortfolioHistoricalSeries(buildMicPortfolioContext(ctx), {
				lenderAuthId: ctx.micLenderUser.authId ?? "",
				lenderId: ctx.micLender._id,
				months: args.months,
				today: unixMsToBusinessDate(Date.now()),
			})
	)
	.public();
