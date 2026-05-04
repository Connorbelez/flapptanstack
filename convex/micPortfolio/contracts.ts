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

export const micPositionCurrentPaymentValidator = v.object({
	amount: v.number(),
	dueDate: v.string(),
	status: v.string(),
});
export type MicPositionCurrentPayment = Infer<
	typeof micPositionCurrentPaymentValidator
>;

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
	currentPayment: v.union(micPositionCurrentPaymentValidator, v.null()),
	thumbnailUrl: nullableStringValidator,
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
	inferredLendingFeeIncome: v.number(),
	lendingFeeIncomeSharePercent: nullableNumberValidator,
	outstandingPrincipal: v.number(),
	totalReturnIncome: v.number(),
	weightedAverageLtv: nullableNumberValidator,
	weightedAverageYield: nullableNumberValidator,
});
export type MicPortfolioMetrics = Infer<typeof micPortfolioMetricsValidator>;

export const micLendingFeeMetricsValidator = v.object({
	feeBasisPoints: v.number(),
	inferredLendingFeeIncome: v.number(),
	lendingFeeIncomeSharePercent: nullableNumberValidator,
	mortgageOriginatedCount: v.number(),
	originatedPrincipal: v.number(),
	totalInterestIncome: v.number(),
	totalReturnIncome: v.number(),
});
export type MicLendingFeeMetrics = Infer<typeof micLendingFeeMetricsValidator>;

export const micReturnSeriesRowValidator = v.object({
	cumulativeFeeIncome: v.number(),
	cumulativeInterestIncome: v.number(),
	cumulativeTotalReturn: v.number(),
	feeIncome: v.number(),
	feeIncomeSharePercent: nullableNumberValidator,
	interestIncome: v.number(),
	originatedPrincipal: v.number(),
	period: v.string(),
	totalReturn: v.number(),
});
export type MicReturnSeriesRow = Infer<typeof micReturnSeriesRowValidator>;

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
	micSharePercentOfGross: nullableNumberValidator,
	mortgageId: v.string(),
	obligationId: v.string(),
	paymentNumber: v.number(),
	propertyLabel: v.string(),
	rowStatus: v.string(),
	type: v.string(),
});
export type MicPaymentHistoryRow = Infer<typeof micPaymentHistoryRowValidator>;

export const micListingHeroImageValidator = v.object({
	caption: nullableStringValidator,
	id: v.string(),
	url: nullableStringValidator,
});
export type MicListingHeroImage = Infer<typeof micListingHeroImageValidator>;

export const micOwnershipValidator = v.object({
	percent: v.number(),
	totalUnits: v.number(),
	units: v.number(),
});
export type MicOwnership = Infer<typeof micOwnershipValidator>;

export const micDealHistoryRowValidator = v.object({
	closingDate: nullableNumberValidator,
	createdAt: v.number(),
	dealId: v.string(),
	fractionalSharePercent: v.number(),
	fractionalShareUnits: v.number(),
	isTerminal: v.boolean(),
	status: v.string(),
});
export type MicDealHistoryRow = Infer<typeof micDealHistoryRowValidator>;

export const micTransferHistoryRowValidator = v.object({
	amount: v.number(),
	createdAt: v.number(),
	currency: v.string(),
	direction: v.string(),
	hasObligationLink: v.boolean(),
	status: v.string(),
	transferId: v.string(),
	transferType: v.string(),
});
export type MicTransferHistoryRow = Infer<
	typeof micTransferHistoryRowValidator
>;

export const micAuditHistoryRowValidator = v.object({
	entityType: v.string(),
	eventId: v.string(),
	eventType: v.string(),
	newState: v.string(),
	outcome: v.union(v.literal("transitioned"), v.literal("rejected")),
	previousState: v.string(),
	reason: nullableStringValidator,
	sequenceNumber: v.string(),
	timestamp: v.number(),
});
export type MicAuditHistoryRow = Infer<typeof micAuditHistoryRowValidator>;

export const micDashboardSnapshotValidator = v.object({
	...micPortfolioEnvelopeFields,
	concentration: micConcentrationExposureDataValidator,
	lendingFeeMetrics: micLendingFeeMetricsValidator,
	maturityLadder: v.array(micMaturityLadderBucketValidator),
	metrics: micPortfolioMetricsValidator,
	positions: v.array(micPositionRowValidator),
	returnSeries: v.array(micReturnSeriesRowValidator),
});
export type MicDashboardSnapshot = Infer<typeof micDashboardSnapshotValidator>;

export const micPositionsResultValidator = v.object({
	...micPortfolioEnvelopeFields,
	filters: v.union(micPositionFiltersValidator, v.null()),
	rows: v.array(micPositionRowValidator),
});
export type MicPositionsResult = Infer<typeof micPositionsResultValidator>;

export const micPositionDetailDataValidator = v.object({
	auditHistory: v.array(micAuditHistoryRowValidator),
	dealHistory: v.array(micDealHistoryRowValidator),
	heroImages: v.array(micListingHeroImageValidator),
	micOwnership: micOwnershipValidator,
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
	ongoingDeals: v.array(micDealHistoryRowValidator),
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
	transferHistory: v.array(micTransferHistoryRowValidator),
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
