import { v } from "convex/values";
import { adminQuery } from "../../fluent";
import { unixMsToBusinessDate } from "../../lib/businessDates";
import {
	portfolioCommandCenterValidator,
	portfolioHistoricalSeriesValidator,
	portfolioPaymentDetailValidator,
	portfolioPositionDetailValidator,
	portfolioTaxExportValidator,
} from "../../portfolio/contracts";
import { buildPortfolioTaxExport } from "../../portfolio/export";
import {
	buildPortfolioCommandCenter,
	buildPortfolioPaymentDetail,
	buildPortfolioPositionDetail,
} from "../../portfolio/helpers";
import { buildPortfolioHistoricalSeries } from "../../portfolio/history";
import { projectRenewalIntent } from "../../renewals/portal";
import { findExistingLenderRenewalIntent } from "../../renewals/runtime";
import { resolveAdminPortfolioContext } from "./context";

export const getAdminLenderPortfolioCommandCenter = adminQuery
	.input({ targetLenderId: v.id("lenders") })
	.returns(portfolioCommandCenterValidator)
	.handler(async (ctx, args) => {
		const portfolioCtx = await resolveAdminPortfolioContext(
			ctx,
			args.targetLenderId
		);
		return await buildPortfolioCommandCenter(portfolioCtx);
	})
	.public();

export const getAdminLenderPortfolioPositionDetail = adminQuery
	.input({
		mortgageId: v.id("mortgages"),
		targetLenderId: v.id("lenders"),
	})
	.returns(portfolioPositionDetailValidator)
	.handler(async (ctx, args) => {
		const portfolioCtx = await resolveAdminPortfolioContext(
			ctx,
			args.targetLenderId
		);
		return await buildPortfolioPositionDetail(portfolioCtx, args.mortgageId);
	})
	.public();

export const getAdminLenderPortfolioPaymentDetail = adminQuery
	.input({
		obligationId: v.id("obligations"),
		targetLenderId: v.id("lenders"),
	})
	.returns(portfolioPaymentDetailValidator)
	.handler(async (ctx, args) => {
		const portfolioCtx = await resolveAdminPortfolioContext(
			ctx,
			args.targetLenderId
		);
		return await buildPortfolioPaymentDetail(portfolioCtx, args.obligationId);
	})
	.public();

export const getAdminLenderPortfolioHistoricalSeries = adminQuery
	.input({
		months: v.optional(v.number()),
		targetLenderId: v.id("lenders"),
	})
	.returns(portfolioHistoricalSeriesValidator)
	.handler(async (ctx, args) => {
		const portfolioCtx = await resolveAdminPortfolioContext(
			ctx,
			args.targetLenderId
		);
		return await buildPortfolioHistoricalSeries(portfolioCtx, {
			lenderAuthId: portfolioCtx.viewer.authId,
			lenderId: portfolioCtx.lender._id,
			months: args.months,
			today: unixMsToBusinessDate(Date.now()),
		});
	})
	.public();

export const getAdminLenderPortfolioTaxExport = adminQuery
	.input({
		targetLenderId: v.id("lenders"),
		year: v.optional(v.number()),
	})
	.returns(portfolioTaxExportValidator)
	.handler(async (ctx, args) => {
		const portfolioCtx = await resolveAdminPortfolioContext(
			ctx,
			args.targetLenderId
		);
		return await buildPortfolioTaxExport(portfolioCtx, {
			lenderAuthId: portfolioCtx.viewer.authId,
			lenderId: portfolioCtx.lender._id,
			today: unixMsToBusinessDate(Date.now()),
			year: args.year,
		});
	})
	.public();

export const getAdminLenderPortfolioRenewalIntentByMortgage = adminQuery
	.input({
		mortgageId: v.id("mortgages"),
		targetLenderId: v.id("lenders"),
	})
	.handler(async (ctx, args) => {
		const portfolioCtx = await resolveAdminPortfolioContext(
			ctx,
			args.targetLenderId
		);
		const intent = await findExistingLenderRenewalIntent({
			ctx: portfolioCtx,
			lenderId: portfolioCtx.lender._id,
			mortgageId: args.mortgageId,
		});
		if (!intent) {
			return null;
		}
		return await projectRenewalIntent({
			ctx: portfolioCtx,
			intent,
			nowMs: Date.now(),
		});
	})
	.public();
