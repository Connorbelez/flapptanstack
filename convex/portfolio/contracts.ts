import { type Infer, v } from "convex/values";
import { marketplaceFiltersValidator } from "../listings/marketplace";

const nullableStringValidator = v.union(v.string(), v.null());
const nullableNumberValidator = v.union(v.number(), v.null());
const numericRangeValidator = v.union(
	v.object({ max: v.number(), min: v.number() }),
	v.null()
);

export const portfolioSourceOfTruthValidator = v.object({
	cockpitMetrics: v.string(),
	csvTaxExportInputs: v.string(),
	historicalChartInputs: v.string(),
	paymentActivityRows: v.string(),
});
export type PortfolioSourceOfTruth = Infer<
	typeof portfolioSourceOfTruthValidator
>;

export const portfolioDataCompletenessValidator = v.union(
	v.literal("live_fallback"),
	v.literal("snapshot_complete")
);
export type PortfolioDataCompleteness = Infer<
	typeof portfolioDataCompletenessValidator
>;

export const portfolioHistoricalPointValidator = v.object({
	cumulativeIncome: v.number(),
	dataCompleteness: portfolioDataCompletenessValidator,
	periodEndDate: v.string(),
	periodIncome: v.number(),
	periodLabel: v.string(),
	periodSource: v.union(
		v.literal("live_fallback"),
		v.literal("monthly_snapshot")
	),
	projectedAggregateEarnings: v.number(),
	totalFractions: v.number(),
	totalInvestedValue: v.number(),
	totalPositions: v.number(),
});
export type PortfolioHistoricalPoint = Infer<
	typeof portfolioHistoricalPointValidator
>;

export const portfolioHistoricalSeriesValidator = v.object({
	asOfDate: v.string(),
	dataCompleteness: portfolioDataCompletenessValidator,
	generatedAt: v.number(),
	liveFallbackPeriodLabel: v.optional(v.string()),
	points: v.array(portfolioHistoricalPointValidator),
	snapshotBackedThrough: v.optional(v.string()),
});
export type PortfolioHistoricalSeries = Infer<
	typeof portfolioHistoricalSeriesValidator
>;

export const portfolioTaxExportValidator = v.object({
	csv: v.optional(v.string()),
	dataCompleteness: portfolioDataCompletenessValidator,
	filename: v.optional(v.string()),
	generatedAt: v.number(),
	isAvailable: v.boolean(),
	periodLabel: v.string(),
	unavailableReason: v.optional(v.string()),
});
export type PortfolioTaxExport = Infer<typeof portfolioTaxExportValidator>;

export const portfolioBreakdownEntryValidator = v.object({
	count: v.number(),
	key: v.string(),
	positionUnits: v.number(),
});
export type PortfolioBreakdownEntry = Infer<
	typeof portfolioBreakdownEntryValidator
>;

export const portfolioCockpitMetricsValidator = v.object({
	activeDealCount: v.number(),
	activePositionCount: v.number(),
	availableCashBalance: v.number(),
	estimatedPortfolioValue: v.number(),
	lifetimeAccruedInterest: v.number(),
	monthlyAccruedInterest: v.number(),
	paymentExceptionCount: v.number(),
	renewalsDueSoonCount: v.number(),
	totalFractions: v.number(),
	totalPositionUnits: v.number(),
	undisbursedBalance: v.number(),
	weightedAverageInterestRate: v.number(),
	ytdAccruedInterest: v.number(),
});
export type PortfolioCockpitMetrics = Infer<
	typeof portfolioCockpitMetricsValidator
>;

export const portfolioCockpitValidator = v.object({
	breakdowns: v.object({
		byMortgageStatus: v.array(portfolioBreakdownEntryValidator),
		byPropertyType: v.array(portfolioBreakdownEntryValidator),
	}),
	metrics: portfolioCockpitMetricsValidator,
});
export type PortfolioCockpit = Infer<typeof portfolioCockpitValidator>;

export const portfolioPositionRowValidator = v.object({
	borrowerLabel: nullableStringValidator,
	city: nullableStringValidator,
	currentLtvPercent: nullableNumberValidator,
	currentPrincipal: nullableNumberValidator,
	estimatedPositionValue: v.number(),
	fractionCount: v.number(),
	lenderSharePaymentAmount: v.number(),
	maturityDate: nullableStringValidator,
	mortgageId: v.string(),
	mortgageStatus: v.string(),
	nextPaymentDate: nullableStringValidator,
	paymentAmount: v.number(),
	positionPercent: v.number(),
	positionUnits: v.number(),
	propertyLabel: v.string(),
	propertyType: nullableStringValidator,
	province: nullableStringValidator,
	renewalIntentStatus: nullableStringValidator,
	renewalTimingLabel: v.string(),
	thumbnailUrl: nullableStringValidator,
	weightedRatePercent: nullableNumberValidator,
});
export type PortfolioPositionRow = Infer<typeof portfolioPositionRowValidator>;

export const portfolioPositionsSectionValidator = v.object({
	rows: v.array(portfolioPositionRowValidator),
});
export type PortfolioPositionsSection = Infer<
	typeof portfolioPositionsSectionValidator
>;

export const portfolioPaymentRowValidator = v.object({
	dueDate: v.string(),
	grossAmount: v.number(),
	latestCollectionStatus: nullableStringValidator,
	latestTransferStatus: nullableStringValidator,
	lenderShareAmount: v.number(),
	mortgageId: v.string(),
	obligationId: v.string(),
	obligationStatus: v.string(),
	paymentNumber: v.number(),
	propertyLabel: v.string(),
	rowStatus: v.string(),
	type: v.string(),
});
export type PortfolioPaymentRow = Infer<typeof portfolioPaymentRowValidator>;

export const portfolioPaymentActivitySectionValidator = v.object({
	rows: v.array(portfolioPaymentRowValidator),
});
export type PortfolioPaymentActivitySection = Infer<
	typeof portfolioPaymentActivitySectionValidator
>;

export const portfolioBrokerPrefillContextValidator = v.object({
	contextType: v.union(
		v.literal("deal"),
		v.literal("mortgage"),
		v.literal("payment")
	),
	dealId: v.optional(v.string()),
	mortgageId: v.optional(v.string()),
	obligationId: v.optional(v.string()),
	propertyLabel: v.string(),
	subjectId: v.string(),
	summary: v.string(),
	title: v.string(),
});
export type PortfolioBrokerPrefillContext = Infer<
	typeof portfolioBrokerPrefillContextValidator
>;

export const portfolioActionItemValidator = v.object({
	dealId: v.optional(v.string()),
	dueDate: nullableStringValidator,
	id: v.string(),
	kind: v.union(
		v.literal("broker_message"),
		v.literal("deal_action"),
		v.literal("payment_exception"),
		v.literal("renewal_prompt")
	),
	mortgageId: v.optional(v.string()),
	obligationId: v.optional(v.string()),
	prefillContext: portfolioBrokerPrefillContextValidator,
	priority: v.union(v.literal("high"), v.literal("low"), v.literal("medium")),
	status: v.string(),
	summary: v.string(),
	title: v.string(),
});
export type PortfolioActionItem = Infer<typeof portfolioActionItemValidator>;

export const portfolioActionsSectionValidator = v.object({
	allClear: v.boolean(),
	items: v.array(portfolioActionItemValidator),
});
export type PortfolioActionsSection = Infer<
	typeof portfolioActionsSectionValidator
>;

export const portfolioConstraintSummaryValidator = v.object({
	allowedMortgageTypes: v.array(v.string()),
	allowedPropertyTypes: v.array(v.string()),
	interestRateRange: numericRangeValidator,
	loanAmountRange: numericRangeValidator,
	ltvRange: numericRangeValidator,
	maturityDateMax: nullableStringValidator,
	updatedAt: nullableNumberValidator,
});
export type PortfolioConstraintSummary = Infer<
	typeof portfolioConstraintSummaryValidator
>;

export const portfolioLimitsStripValidator = v.object({
	constraints: portfolioConstraintSummaryValidator,
	effectiveFilters: v.union(marketplaceFiltersValidator, v.null()),
	hasConstraints: v.boolean(),
	suggestionSeedCount: v.number(),
});
export type PortfolioLimitsStrip = Infer<typeof portfolioLimitsStripValidator>;

export const portfolioSuggestionReasonTagValidator = v.object({
	label: v.string(),
	reason: v.string(),
});
export type PortfolioSuggestionReasonTag = Infer<
	typeof portfolioSuggestionReasonTagValidator
>;

export const portfolioSuggestedOpportunityValidator = v.object({
	explanationTags: v.array(portfolioSuggestionReasonTagValidator),
	heroImageUrl: nullableStringValidator,
	interestRate: v.number(),
	listingId: v.string(),
	locationLabel: v.string(),
	ltvRatio: v.number(),
	marketplaceCopy: v.string(),
	maturityDate: v.string(),
	mortgageId: nullableStringValidator,
	mortgageTypeLabel: v.string(),
	principal: v.number(),
	propertyTypeLabel: v.string(),
	title: v.string(),
});
export type PortfolioSuggestedOpportunity = Infer<
	typeof portfolioSuggestedOpportunityValidator
>;

export const portfolioSuggestedOpportunitiesAvailabilityValidator = v.union(
	v.literal("ready"),
	v.literal("unavailable")
);
export type PortfolioSuggestedOpportunitiesAvailability = Infer<
	typeof portfolioSuggestedOpportunitiesAvailabilityValidator
>;

export const portfolioSuggestedOpportunitiesSectionValidator = v.object({
	availabilityState: portfolioSuggestedOpportunitiesAvailabilityValidator,
	excludedOwnedMortgageCount: v.number(),
	rows: v.array(portfolioSuggestedOpportunityValidator),
	unavailableReason: v.optional(v.string()),
});
export type PortfolioSuggestedOpportunitiesSection = Infer<
	typeof portfolioSuggestedOpportunitiesSectionValidator
>;

export const portfolioBrokerSummaryValidator = v.union(
	v.object({
		brokerId: v.string(),
		brokerageName: nullableStringValidator,
		email: nullableStringValidator,
		name: v.string(),
		phoneNumber: nullableStringValidator,
	}),
	v.null()
);
export type PortfolioBrokerSummary = Infer<
	typeof portfolioBrokerSummaryValidator
>;

export const portfolioBrokerContactValidator = v.union(
	v.object({
		label: v.string(),
		mode: v.union(v.literal("email"), v.literal("phone"), v.literal("profile")),
		value: nullableStringValidator,
	}),
	v.null()
);
export type PortfolioBrokerContact = Infer<
	typeof portfolioBrokerContactValidator
>;

export const portfolioBrokerCoordinationValidator = v.object({
	assignedBroker: portfolioBrokerSummaryValidator,
	availabilityState: v.union(
		v.literal("fallback_contact_only"),
		v.literal("missing_broker")
	),
	fallbackContactCta: portfolioBrokerContactValidator,
	prefillContextPayloads: v.object({
		dealFollowUps: v.array(portfolioBrokerPrefillContextValidator),
		mortgageFollowUps: v.array(portfolioBrokerPrefillContextValidator),
		paymentFollowUps: v.array(portfolioBrokerPrefillContextValidator),
	}),
	threadId: nullableStringValidator,
});
export type PortfolioBrokerCoordination = Infer<
	typeof portfolioBrokerCoordinationValidator
>;

export const portfolioEmptyStatesValidator = v.object({
	hasActions: v.boolean(),
	hasPayments: v.boolean(),
	hasPositions: v.boolean(),
	hasSuggestions: v.boolean(),
});
export type PortfolioEmptyStates = Infer<typeof portfolioEmptyStatesValidator>;

export const portfolioCommandCenterValidator = v.object({
	actionsRequired: portfolioActionsSectionValidator,
	brokerCoordination: portfolioBrokerCoordinationValidator,
	cockpit: portfolioCockpitValidator,
	emptyStates: portfolioEmptyStatesValidator,
	generatedAt: v.number(),
	limitsStrip: portfolioLimitsStripValidator,
	paymentActivity: portfolioPaymentActivitySectionValidator,
	positions: portfolioPositionsSectionValidator,
	sourceOfTruth: portfolioSourceOfTruthValidator,
	suggestedOpportunities: portfolioSuggestedOpportunitiesSectionValidator,
});
export type PortfolioCommandCenter = Infer<
	typeof portfolioCommandCenterValidator
>;

export const portfolioPositionDetailValidator = v.object({
	generatedAt: v.number(),
	mortgage: v.object({
		amortizationMonths: v.number(),
		firstPaymentDate: v.string(),
		interestRate: v.number(),
		lienPosition: v.number(),
		maturityDate: v.string(),
		mortgageId: v.string(),
		paymentAmount: v.number(),
		paymentFrequency: v.string(),
		principal: v.number(),
		rateType: v.string(),
		status: v.string(),
		termMonths: v.number(),
	}),
	paymentOverview: v.object({
		lenderSharePaymentAmount: v.number(),
		nextPaymentDate: nullableStringValidator,
	}),
	position: portfolioPositionRowValidator,
	property: v.object({
		city: v.string(),
		heroImageUrl: nullableStringValidator,
		postalCode: v.string(),
		propertyType: v.string(),
		province: v.string(),
		streetAddress: v.string(),
		unit: nullableStringValidator,
	}),
	quickActions: v.array(portfolioActionItemValidator),
	renewal: v.object({
		brokerAcknowledgedAt: nullableNumberValidator,
		intent: nullableStringValidator,
		partialExitFractions: nullableNumberValidator,
		signalDeadline: nullableStringValidator,
		status: nullableStringValidator,
	}),
});
export type PortfolioPositionDetail = Infer<
	typeof portfolioPositionDetailValidator
>;

export const portfolioMortgageDetailPageValidator = v.object({
	generatedAt: v.number(),
	paymentHistory: v.array(portfolioPaymentRowValidator),
	positionDetail: portfolioPositionDetailValidator,
	sourceOfTruth: portfolioSourceOfTruthValidator,
});
export type PortfolioMortgageDetailPage = Infer<
	typeof portfolioMortgageDetailPageValidator
>;

export const portfolioTimelineEventValidator = v.object({
	label: v.string(),
	status: v.string(),
	timestampLabel: v.string(),
});
export type PortfolioTimelineEvent = Infer<
	typeof portfolioTimelineEventValidator
>;

export const portfolioPaymentDetailValidator = v.object({
	collectionTimeline: v.array(portfolioTimelineEventValidator),
	generatedAt: v.number(),
	mortgage: v.object({
		interestRate: v.number(),
		maturityDate: v.string(),
		mortgageId: v.string(),
		paymentAmount: v.number(),
		paymentFrequency: v.string(),
		principal: v.number(),
		status: v.string(),
	}),
	payment: portfolioPaymentRowValidator,
	positionSummary: v.object({
		estimatedPositionValue: v.number(),
		lenderSharePercent: v.number(),
		positionUnits: v.number(),
	}),
	property: v.object({
		city: v.string(),
		propertyType: v.string(),
		province: v.string(),
		streetAddress: v.string(),
		unit: nullableStringValidator,
	}),
	relatedActions: v.array(portfolioActionItemValidator),
});
export type PortfolioPaymentDetail = Infer<
	typeof portfolioPaymentDetailValidator
>;
