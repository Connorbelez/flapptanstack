import { v } from "convex/values";
import { portalLenderQuery, requirePermission } from "../fluent";
import { unixMsToBusinessDate } from "../lib/businessDates";
import {
	portfolioCommandCenterValidator,
	portfolioHistoricalSeriesValidator,
	portfolioPaymentDetailValidator,
	portfolioPositionDetailValidator,
	portfolioTaxExportValidator,
} from "./contracts";
import { buildPortfolioTaxExport } from "./export";
import {
	buildPortfolioCommandCenter,
	buildPortfolioPaymentDetail,
	buildPortfolioPositionDetail,
} from "./helpers";
import { buildPortfolioHistoricalSeries } from "./history";

export const getLenderPortfolioCommandCenter = portalLenderQuery()
	.use(requirePermission("portfolio:view"))
	.returns(portfolioCommandCenterValidator)
	.handler(
		async (ctx) =>
			await buildPortfolioCommandCenter({
				...ctx,
				lenderAuthId: ctx.viewer.authId,
			})
	)
	.public();

export const getLenderPortfolioPositionDetail = portalLenderQuery({
	mortgageId: v.id("mortgages"),
})
	.use(requirePermission("portfolio:view"))
	.returns(portfolioPositionDetailValidator)
	.handler(
		async (ctx, args) =>
			await buildPortfolioPositionDetail(
				{
					...ctx,
					lenderAuthId: ctx.viewer.authId,
				},
				args.mortgageId
			)
	)
	.public();

export const getLenderPortfolioPaymentDetail = portalLenderQuery({
	obligationId: v.id("obligations"),
})
	.use(requirePermission("portfolio:view"))
	.returns(portfolioPaymentDetailValidator)
	.handler(
		async (ctx, args) =>
			await buildPortfolioPaymentDetail(
				{
					...ctx,
					lenderAuthId: ctx.viewer.authId,
				},
				args.obligationId
			)
	)
	.public();

export const getLenderPortfolioHistoricalSeries = portalLenderQuery({
	months: v.optional(v.number()),
})
	.use(requirePermission("portfolio:view"))
	.returns(portfolioHistoricalSeriesValidator)
	.handler(
		async (ctx, args) =>
			await buildPortfolioHistoricalSeries(ctx, {
				lenderAuthId: ctx.viewer.authId,
				lenderId: ctx.lender._id,
				months: args.months,
				today: unixMsToBusinessDate(Date.now()),
			})
	)
	.public();

export const getLenderPortfolioTaxExport = portalLenderQuery({
	year: v.optional(v.number()),
})
	.use(requirePermission("portfolio:export_tax"))
	.returns(portfolioTaxExportValidator)
	.handler(
		async (ctx, args) =>
			await buildPortfolioTaxExport(ctx, {
				lenderAuthId: ctx.viewer.authId,
				lenderId: ctx.lender._id,
				today: unixMsToBusinessDate(Date.now()),
				year: args.year,
			})
	)
	.public();
