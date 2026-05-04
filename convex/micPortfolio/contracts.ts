import { type Infer, v } from "convex/values";

const nullableStringValidator = v.union(v.string(), v.null());
const nullableNumberValidator = v.union(v.number(), v.null());

export const micPortfolioSourceOfTruthValidator = v.literal(
	"mortgage_ledger_lender_participation"
);
export type MicPortfolioSourceOfTruth = Infer<
	typeof micPortfolioSourceOfTruthValidator
>;

export const micPortfolioDataCompletenessValidator = v.union(
	v.literal("complete"),
	v.literal("partial")
);
export type MicPortfolioDataCompleteness = Infer<
	typeof micPortfolioDataCompletenessValidator
>;

export const micPositionFiltersValidator = v.object({
	propertyType: v.optional(v.string()),
	province: v.optional(v.string()),
	searchQuery: v.optional(v.string()),
	status: v.optional(v.string()),
});
export type MicPositionFilters = Infer<typeof micPositionFiltersValidator>;

export const micPortfolioEnvelopeFields = {
	dataCompleteness: micPortfolioDataCompletenessValidator,
	generatedAt: v.number(),
	sourceOfTruth: micPortfolioSourceOfTruthValidator,
	warnings: v.array(v.string()),
};

export const micArrearsSignalValidator = v.object({
	overdueAmount: v.number(),
	overdueCount: v.number(),
	status: v.union(
		v.literal("current"),
		v.literal("due"),
		v.literal("overdue"),
		v.literal("exception")
	),
});
export type MicArrearsSignal = Infer<typeof micArrearsSignalValidator>;

export const micPositionDrilldownIdsValidator = v.object({
	listingId: nullableStringValidator,
	mortgageId: v.string(),
	positionAccountId: v.string(),
	propertyId: v.string(),
});
export type MicPositionDrilldownIds = Infer<
	typeof micPositionDrilldownIdsValidator
>;

export const micPositionRowValidator = v.object({
	arrearsSignal: micArrearsSignalValidator,
	borrowerLabel: v.string(),
	drilldownIds: micPositionDrilldownIdsValidator,
	ltv: nullableNumberValidator,
	maturityDate: v.string(),
	mortgageId: v.string(),
	outstandingPrincipal: v.number(),
	positionAccountId: v.string(),
	positionUnits: v.number(),
	principal: v.number(),
	propertyLabel: v.string(),
	propertySummary: v.object({
		city: v.string(),
		propertyType: v.string(),
		province: v.string(),
		streetAddress: v.string(),
		unit: nullableStringValidator,
	}),
	rateYield: nullableNumberValidator,
	status: v.string(),
});
export type MicPositionRow = Infer<typeof micPositionRowValidator>;

export const micMaturityLadderBucketValidator = v.object({
	bucket: v.union(
		v.literal("past_due"),
		v.literal("0_6_months"),
		v.literal("6_12_months"),
		v.literal("12_24_months"),
		v.literal("24_plus_months"),
		v.literal("unknown")
	),
	count: v.number(),
	outstandingPrincipal: v.number(),
});
export type MicMaturityLadderBucket = Infer<
	typeof micMaturityLadderBucketValidator
>;

export const micPortfolioMetricsValidator = v.object({
	activePositionCount: v.number(),
	arrearsExposure: v.number(),
	delinquencyExposure: v.number(),
	outstandingPrincipal: v.number(),
	weightedAverageLtv: nullableNumberValidator,
	weightedAverageYield: nullableNumberValidator,
});
export type MicPortfolioMetrics = Infer<typeof micPortfolioMetricsValidator>;

export const micConcentrationEntryValidator = v.object({
	count: v.number(),
	key: v.string(),
	label: v.string(),
	outstandingPrincipal: v.number(),
	sharePercent: v.number(),
});
export type MicConcentrationEntry = Infer<
	typeof micConcentrationEntryValidator
>;

export const micConcentrationExposureDataValidator = v.object({
	byBorrower: v.array(micConcentrationEntryValidator),
	byGeography: v.array(micConcentrationEntryValidator),
	byPropertyType: v.array(micConcentrationEntryValidator),
	byStatus: v.array(micConcentrationEntryValidator),
});
export type MicConcentrationExposureData = Infer<
	typeof micConcentrationExposureDataValidator
>;

export const micPaymentHistoryRowValidator = v.object({
	amountSettled: v.number(),
	dueDate: v.string(),
	grossAmount: v.number(),
	latestCollectionStatus: nullableStringValidator,
	latestTransferStatus: nullableStringValidator,
	micShareAmount: v.number(),
	mortgageId: v.string(),
	obligationId: v.string(),
	paymentNumber: v.number(),
	propertyLabel: v.string(),
	rowStatus: v.string(),
	type: v.string(),
});
export type MicPaymentHistoryRow = Infer<typeof micPaymentHistoryRowValidator>;

export const micDashboardSnapshotValidator = v.object({
	...micPortfolioEnvelopeFields,
	concentration: micConcentrationExposureDataValidator,
	maturityLadder: v.array(micMaturityLadderBucketValidator),
	metrics: micPortfolioMetricsValidator,
	positions: v.array(micPositionRowValidator),
});
export type MicDashboardSnapshot = Infer<typeof micDashboardSnapshotValidator>;

export const micPositionsResultValidator = v.object({
	...micPortfolioEnvelopeFields,
	filters: v.union(micPositionFiltersValidator, v.null()),
	rows: v.array(micPositionRowValidator),
});
export type MicPositionsResult = Infer<typeof micPositionsResultValidator>;

export const micPositionDetailDataValidator = v.object({
	mortgage: v.object({
		amortizationMonths: v.number(),
		firstPaymentDate: v.string(),
		interestRate: v.number(),
		lienPosition: v.number(),
		loanType: v.string(),
		maturityDate: v.string(),
		mortgageId: v.string(),
		paymentAmount: v.number(),
		paymentFrequency: v.string(),
		principal: v.number(),
		rateType: v.string(),
		status: v.string(),
		termMonths: v.number(),
		termStartDate: v.string(),
	}),
	payments: v.array(micPaymentHistoryRowValidator),
	position: micPositionRowValidator,
	property: v.object({
		city: v.string(),
		postalCode: v.string(),
		propertyId: v.string(),
		propertyType: v.string(),
		province: v.string(),
		streetAddress: v.string(),
		unit: nullableStringValidator,
	}),
});
export type MicPositionDetailData = Infer<
	typeof micPositionDetailDataValidator
>;

export const micPositionDetailResultValidator = v.object({
	...micPortfolioEnvelopeFields,
	position: v.union(micPositionDetailDataValidator, v.null()),
});
export type MicPositionDetailResult = Infer<
	typeof micPositionDetailResultValidator
>;

export const micPaymentsHistoryResultValidator = v.object({
	...micPortfolioEnvelopeFields,
	mortgageId: v.union(v.string(), v.null()),
	rows: v.array(micPaymentHistoryRowValidator),
});
export type MicPaymentsHistoryResult = Infer<
	typeof micPaymentsHistoryResultValidator
>;

export const micConcentrationExposureResultValidator = v.object({
	...micPortfolioEnvelopeFields,
	concentration: micConcentrationExposureDataValidator,
});
export type MicConcentrationExposureResult = Infer<
	typeof micConcentrationExposureResultValidator
>;
