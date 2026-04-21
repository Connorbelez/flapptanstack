import { v } from "convex/values";
import { portalLenderQuery, requirePermission } from "../fluent";
import {
	portfolioCommandCenterValidator,
	portfolioPaymentDetailValidator,
	portfolioPositionDetailValidator,
} from "./contracts";
import {
	buildPortfolioCommandCenter,
	buildPortfolioPaymentDetail,
	buildPortfolioPositionDetail,
} from "./helpers";

export const getLenderPortfolioCommandCenter = portalLenderQuery()
	.use(requirePermission("portfolio:view"))
	.returns(portfolioCommandCenterValidator)
	.handler(async (ctx) => await buildPortfolioCommandCenter(ctx))
	.public();

export const getLenderPortfolioPositionDetail = portalLenderQuery({
	mortgageId: v.id("mortgages"),
})
	.use(requirePermission("portfolio:view"))
	.returns(portfolioPositionDetailValidator)
	.handler(
		async (ctx, args) =>
			await buildPortfolioPositionDetail(ctx, args.mortgageId)
	)
	.public();

export const getLenderPortfolioPaymentDetail = portalLenderQuery({
	obligationId: v.id("obligations"),
})
	.use(requirePermission("portfolio:view"))
	.returns(portfolioPaymentDetailValidator)
	.handler(
		async (ctx, args) =>
			await buildPortfolioPaymentDetail(ctx, args.obligationId)
	)
	.public();
