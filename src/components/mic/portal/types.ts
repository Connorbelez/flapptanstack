export const MIC_PORTFOLIO_SORT_KEYS = [
	"maturity-soonest",
	"maturity-latest",
	"principal-highest",
	"principal-lowest",
	"yield-highest",
] as const;

export type MicPortfolioSortKey = (typeof MIC_PORTFOLIO_SORT_KEYS)[number];

export interface MicPortfolioFilterState {
	detailMortgageId?: string;
	positionQuery?: string;
	positionSort: MicPortfolioSortKey;
	positionStatus?: string;
}

export const DEFAULT_MIC_PORTFOLIO_FILTER_STATE: MicPortfolioFilterState = {
	positionSort: "maturity-soonest",
};

export type MicPortfolioFilterUpdater = (
	current: MicPortfolioFilterState
) => MicPortfolioFilterState;

export interface MicMetricCard {
	description: string;
	label: string;
	tone?: "critical" | "default" | "positive";
	value: string;
}

export interface MicFocusItem {
	id: string;
	label: string;
	severity: "critical" | "info" | "warning";
	summary: string;
	title: string;
	value?: string;
}

export interface MicExposureCard {
	description: string;
	label: string;
	value: string;
}

export interface MicActivityItem {
	dateLabel: string;
	id: string;
	summary: string;
	title: string;
}

export interface MicPositionRow {
	borrowerLabel: string;
	city: string;
	currentLtvPercent: number | null;
	currentPrincipal: number | null;
	maturityDate: string | null;
	mortgageId: string;
	mortgageStatus: string;
	nextPaymentDate: string | null;
	paymentAmount: number | null;
	positionPercent: number | null;
	propertyLabel: string;
	propertyType: string;
	province: string;
	thumbnailUrl?: string | null;
	weightedRatePercent: number | null;
}

export interface MicPortfolioSnapshot {
	asOfLabel: string;
	exposureCards: readonly MicExposureCard[];
	focusItems: readonly MicFocusItem[];
	fundName: string;
	metricCards: readonly MicMetricCard[];
	positions: readonly MicPositionRow[];
	recentActivity: readonly MicActivityItem[];
	sourceNote: string;
	subtitle: string;
}

export interface MicDetailField {
	label: string;
	value: string;
}

export interface MicTimelineEvent {
	dateLabel: string;
	id: string;
	kind: string;
	summary: string;
	title: string;
}

export interface MicMortgageDetail {
	addressLine: string;
	disclosures: readonly string[];
	economicsFields: readonly MicDetailField[];
	heroImageUrl?: string | null;
	history: readonly MicTimelineEvent[];
	mortgageId: string;
	overviewFields: readonly MicDetailField[];
	propertyFields: readonly MicDetailField[];
	propertyLabel: string;
	servicingFields: readonly MicDetailField[];
	status: string;
	subtitle: string;
	summaryMetrics: readonly MicMetricCard[];
}
