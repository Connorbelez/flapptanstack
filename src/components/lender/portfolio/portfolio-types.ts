import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";

export const PORTFOLIO_DETAIL_TYPES = ["payment", "position"] as const;
export type PortfolioDetailType = (typeof PORTFOLIO_DETAIL_TYPES)[number];

export const PORTFOLIO_POSITION_SORT_KEYS = [
	"next-payment-soonest",
	"next-payment-latest",
	"payment-highest",
	"payment-lowest",
	"property-a-z",
] as const;
export type PortfolioPositionSortKey =
	(typeof PORTFOLIO_POSITION_SORT_KEYS)[number];

export const PORTFOLIO_PAYMENT_SORT_KEYS = [
	"due-desc",
	"due-asc",
	"amount-desc",
	"amount-asc",
	"status-a-z",
] as const;
export type PortfolioPaymentSortKey =
	(typeof PORTFOLIO_PAYMENT_SORT_KEYS)[number];

export interface LenderPortfolioSearchState {
	detailId?: string;
	detailType?: PortfolioDetailType;
	paymentDateFrom?: string;
	paymentDateTo?: string;
	paymentQuery?: string;
	paymentSort: PortfolioPaymentSortKey;
	paymentStatus?: string;
	positionQuery?: string;
	positionSort: PortfolioPositionSortKey;
	positionStatus?: string;
}

export const DEFAULT_LENDER_PORTFOLIO_SEARCH: LenderPortfolioSearchState = {
	paymentSort: "due-desc",
	positionSort: "next-payment-soonest",
};

export type PortfolioSearchUpdater = (
	current: LenderPortfolioSearchState
) => LenderPortfolioSearchState;

export type PortfolioCommandCenterSnapshot = FunctionReturnType<
	typeof api.portfolio.queries.getLenderPortfolioCommandCenter
>;
export type PortfolioPositionRow =
	PortfolioCommandCenterSnapshot["positions"]["rows"][number];
export type PortfolioPaymentRow =
	PortfolioCommandCenterSnapshot["paymentActivity"]["rows"][number];

export type PortfolioPositionDetail = FunctionReturnType<
	typeof api.portfolio.queries.getLenderPortfolioPositionDetail
>;
export type PortfolioPaymentDetail = FunctionReturnType<
	typeof api.portfolio.queries.getLenderPortfolioPaymentDetail
>;
