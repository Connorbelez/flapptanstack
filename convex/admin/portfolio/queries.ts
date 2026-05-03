import { v } from "convex/values";
import { adminQuery, requirePermission } from "../../fluent";
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
import {
	resolveAdminPortfolioTarget,
	withAdminPortfolioTarget,
} from "./target";

const adminPortfolioQuery = adminQuery.use(requirePermission("portfolio:view"));

export const getAdminLenderPortfolioCommandCenter = adminPortfolioQuery
	.input({ targetLenderId: v.id("lenders") })
	.returns(portfolioCommandCenterValidator)
	.handler(async (ctx, args) => {
		const target = await resolveAdminPortfolioTarget(ctx, args.targetLenderId);
		return await buildPortfolioCommandCenter(
			withAdminPortfolioTarget(ctx, target)
		);
	})
	.public();

export const getAdminLenderPortfolioPositionDetail = adminPortfolioQuery
	.input({
		mortgageId: v.id("mortgages"),
		targetLenderId: v.id("lenders"),
	})
	.returns(portfolioPositionDetailValidator)
	.handler(async (ctx, args) => {
		const target = await resolveAdminPortfolioTarget(ctx, args.targetLenderId);
		return await buildPortfolioPositionDetail(
			withAdminPortfolioTarget(ctx, target),
			args.mortgageId
		);
	})
	.public();

export const getAdminLenderPortfolioPaymentDetail = adminPortfolioQuery
	.input({
		obligationId: v.id("obligations"),
		targetLenderId: v.id("lenders"),
	})
	.returns(portfolioPaymentDetailValidator)
	.handler(async (ctx, args) => {
		const target = await resolveAdminPortfolioTarget(ctx, args.targetLenderId);
		return await buildPortfolioPaymentDetail(
			withAdminPortfolioTarget(ctx, target),
			args.obligationId
		);
	})
	.public();

export const getAdminLenderPortfolioHistoricalSeries = adminPortfolioQuery
	.input({
		months: v.optional(v.number()),
		targetLenderId: v.id("lenders"),
	})
	.returns(portfolioHistoricalSeriesValidator)
	.handler(async (ctx, args) => {
		const target = await resolveAdminPortfolioTarget(ctx, args.targetLenderId);
		return await buildPortfolioHistoricalSeries(ctx, {
			lenderAuthId: target.lenderAuthId,
			lenderId: target.lender._id,
			months: args.months,
			today: unixMsToBusinessDate(Date.now()),
		});
	})
	.public();

export const getAdminLenderPortfolioTaxExport = adminQuery
	.use(requirePermission("portfolio:export_tax"))
	.input({
		targetLenderId: v.id("lenders"),
		year: v.optional(v.number()),
	})
	.returns(portfolioTaxExportValidator)
	.handler(async (ctx, args) => {
		const target = await resolveAdminPortfolioTarget(ctx, args.targetLenderId);
		return await buildPortfolioTaxExport(ctx, {
			lenderAuthId: target.lenderAuthId,
			lenderId: target.lender._id,
			today: unixMsToBusinessDate(Date.now()),
			year: args.year,
		});
	})
	.public();

export const getAdminLenderPortfolioRenewalIntentByMortgage =
	adminPortfolioQuery
		.use(requirePermission("portfolio:signal_renewal"))
		.input({
			mortgageId: v.id("mortgages"),
			targetLenderId: v.id("lenders"),
		})
		.handler(async (ctx, args) => {
			const target = await resolveAdminPortfolioTarget(
				ctx,
				args.targetLenderId
			);
			const intent = await findExistingLenderRenewalIntent({
				ctx,
				lenderId: target.lender._id,
				mortgageId: args.mortgageId,
			});
			if (!intent) {
				return null;
			}
			return await projectRenewalIntent({
				ctx,
				intent,
				lenderAuthId: target.lenderAuthId,
				nowMs: Date.now(),
			});
		})
		.public();
