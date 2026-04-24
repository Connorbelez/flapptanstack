import type {
	PortfolioCommandCenterSnapshot,
	PortfolioHistoricalSeries,
	PortfolioLenderRenewalIntentRecord,
	PortfolioPaymentDetail,
	PortfolioPositionDetail,
	PortfolioTaxExport,
} from "./portfolio-types";

export const portfolioCommandCenterFixture: PortfolioCommandCenterSnapshot = {
	actionsRequired: {
		allClear: false,
		items: [
			{
				dueDate: "2026-04-28",
				id: "action_renewal_king",
				kind: "renewal_prompt",
				mortgageId: "mortgage_king",
				prefillContext: {
					contextType: "mortgage",
					mortgageId: "mortgage_king",
					propertyLabel: "123 King St W, Toronto",
					subjectId: "mortgage_king",
					summary:
						"Renewal intent is awaiting lender decision with status pending_signal",
					title: "Review King Street renewal",
				},
				priority: "high",
				status: "pending_signal",
				summary:
					"Renewal intent is awaiting lender decision with status pending_signal",
				title: "Review renewal decision",
			},
			{
				dueDate: "2026-04-01",
				id: "action_payment_overdue",
				kind: "payment_exception",
				mortgageId: "mortgage_king",
				obligationId: "obligation_overdue",
				prefillContext: {
					contextType: "payment",
					mortgageId: "mortgage_king",
					obligationId: "obligation_overdue",
					propertyLabel: "123 King St W, Toronto",
					subjectId: "obligation_overdue",
					summary: "Collection follow-up required for overdue lender payment.",
					title: "Investigate overdue payment",
				},
				priority: "high",
				status: "overdue",
				summary: "Collection follow-up required for overdue lender payment.",
				title: "Investigate overdue payment",
			},
		],
	},
	brokerCoordination: {
		assignedBroker: {
			brokerId: "broker_meridian",
			brokerageName: "Meridian Brokerage",
			email: "broker@fairlend.ca",
			name: "Morgan Broker",
			phoneNumber: "416-555-0100",
		},
		availabilityState: "fallback_contact_only",
		fallbackContactCta: {
			label: "Email Morgan Broker",
			mode: "email",
			value: "broker@fairlend.ca",
		},
		prefillContextPayloads: {
			dealFollowUps: [],
			mortgageFollowUps: [
				{
					contextType: "mortgage",
					mortgageId: "mortgage_king",
					propertyLabel: "123 King St W, Toronto",
					subjectId: "mortgage_king",
					summary: "Discuss the renewal decision for the King Street mortgage.",
					title: "Discuss renewal timing",
				},
			],
			paymentFollowUps: [
				{
					contextType: "payment",
					mortgageId: "mortgage_king",
					obligationId: "obligation_overdue",
					propertyLabel: "123 King St W, Toronto",
					subjectId: "obligation_overdue",
					summary: "Coordinate next steps for the overdue payment.",
					title: "Escalate overdue payment",
				},
			],
		},
		threadId: null,
	},
	cockpit: {
		breakdowns: {
			byMortgageStatus: [
				{ count: 1, key: "active", positionUnits: 6000 },
				{ count: 1, key: "delinquent", positionUnits: 4000 },
			],
			byPropertyType: [
				{ count: 2, key: "Detached Home", positionUnits: 10_000 },
			],
		},
		metrics: {
			activeDealCount: 1,
			activePositionCount: 2,
			availableCashBalance: 5000,
			estimatedPortfolioValue: 360_000,
			lifetimeAccruedInterest: 24_000,
			monthlyAccruedInterest: 2200,
			paymentExceptionCount: 1,
			renewalsDueSoonCount: 1,
			totalFractions: 10,
			totalPositionUnits: 10_000,
			undisbursedBalance: 1200,
			weightedAverageInterestRate: 8.2,
			ytdAccruedInterest: 9000,
		},
	},
	emptyStates: {
		hasActions: true,
		hasPayments: true,
		hasPositions: true,
		hasSuggestions: true,
	},
	generatedAt: 1_710_000_500_000,
	limitsStrip: {
		constraints: {
			allowedMortgageTypes: ["First"],
			allowedPropertyTypes: ["Detached Home"],
			interestRateRange: { max: 10, min: 6.5 },
			loanAmountRange: { max: 450_000, min: 200_000 },
			ltvRange: { max: 0.75, min: 0.55 },
			maturityDateMax: "2027-12-31",
			updatedAt: 1_710_000_500_000,
		},
		effectiveFilters: {
			interestRate: { max: 10, min: 6.5 },
			ltv: { max: 0.75, min: 0.55 },
			maturityDate: { end: "2027-12-31" },
			mortgageTypes: ["First"],
			principalAmount: { max: 450_000, min: 200_000 },
			propertyTypes: ["Detached Home"],
			searchQuery: undefined,
		},
		hasConstraints: true,
		suggestionSeedCount: 2,
	},
	paymentActivity: {
		rows: [
			{
				dueDate: "2026-04-01",
				grossAmount: 1250,
				latestCollectionStatus: "failed",
				latestTransferStatus: "pending",
				lenderShareAmount: 750,
				mortgageId: "mortgage_king",
				obligationId: "obligation_overdue",
				obligationStatus: "overdue",
				paymentNumber: 4,
				propertyLabel: "123 King St W, Toronto",
				rowStatus: "overdue",
				type: "scheduled",
			},
			{
				dueDate: "2026-06-01",
				grossAmount: 980,
				latestCollectionStatus: "scheduled",
				latestTransferStatus: "queued",
				lenderShareAmount: 620,
				mortgageId: "mortgage_queen",
				obligationId: "obligation_upcoming",
				obligationStatus: "scheduled",
				paymentNumber: 5,
				propertyLabel: "88 Queen St W, Toronto",
				rowStatus: "upcoming",
				type: "scheduled",
			},
		],
	},
	positions: {
		rows: [
			{
				estimatedPositionValue: 220_000,
				fractionCount: 6,
				lenderSharePaymentAmount: 750,
				mortgageId: "mortgage_king",
				mortgageStatus: "active",
				nextPaymentDate: "2026-05-01",
				paymentAmount: 1250,
				positionPercent: 60,
				positionUnits: 6000,
				propertyLabel: "123 King St W, Toronto",
				renewalIntentStatus: "pending_signal",
				renewalTimingLabel: "Review due in 45 days",
				thumbnailUrl: "https://images.example.com/king-street.jpg",
			},
			{
				estimatedPositionValue: 140_000,
				fractionCount: 4,
				lenderSharePaymentAmount: 620,
				mortgageId: "mortgage_queen",
				mortgageStatus: "delinquent",
				nextPaymentDate: "2026-04-15",
				paymentAmount: 980,
				positionPercent: 40,
				positionUnits: 4000,
				propertyLabel: "88 Queen St W, Toronto",
				renewalIntentStatus: null,
				renewalTimingLabel: "Servicing follow-up active",
				thumbnailUrl: null,
			},
		],
	},
	sourceOfTruth: {
		cockpitMetrics: "ledger + accrual contract",
		csvTaxExportInputs: "portfolio export contract",
		historicalChartInputs: "snapshot pipeline",
		paymentActivityRows: "obligations + collection attempts",
	},
	suggestedOpportunities: {
		availabilityState: "ready",
		excludedOwnedMortgageCount: 1,
		rows: [
			{
				explanationTags: [
					{
						label: "Matches detached allocation",
						reason: "The listing fits the current detached-home concentration.",
					},
				],
				heroImageUrl: null,
				interestRate: 8.4,
				listingId: "listing_fresh",
				locationLabel: "Toronto, ON",
				ltvRatio: 0.64,
				marketplaceCopy: "Fresh lender opportunity",
				maturityDate: "2027-08-01",
				mortgageId: null,
				mortgageTypeLabel: "First",
				principal: 250_000,
				propertyTypeLabel: "Detached Home",
				title: "Fresh Opportunity",
			},
		],
	},
};

export const emptyPortfolioCommandCenterFixture: PortfolioCommandCenterSnapshot =
	{
		...portfolioCommandCenterFixture,
		actionsRequired: { allClear: true, items: [] },
		cockpit: {
			...portfolioCommandCenterFixture.cockpit,
			metrics: {
				...portfolioCommandCenterFixture.cockpit.metrics,
				activeDealCount: 0,
				activePositionCount: 0,
				availableCashBalance: 0,
				estimatedPortfolioValue: 0,
				lifetimeAccruedInterest: 0,
				monthlyAccruedInterest: 0,
				paymentExceptionCount: 0,
				renewalsDueSoonCount: 0,
				totalFractions: 0,
				totalPositionUnits: 0,
				undisbursedBalance: 0,
				weightedAverageInterestRate: 0,
				ytdAccruedInterest: 0,
			},
		},
		emptyStates: {
			hasActions: false,
			hasPayments: false,
			hasPositions: false,
			hasSuggestions: false,
		},
		limitsStrip: {
			...portfolioCommandCenterFixture.limitsStrip,
			hasConstraints: false,
		},
		paymentActivity: { rows: [] },
		positions: { rows: [] },
		suggestedOpportunities: {
			availabilityState: "ready",
			excludedOwnedMortgageCount: 0,
			rows: [],
		},
	};

export const noSuggestedOpportunitiesFixture: PortfolioCommandCenterSnapshot = {
	...portfolioCommandCenterFixture,
	emptyStates: {
		...portfolioCommandCenterFixture.emptyStates,
		hasSuggestions: false,
	},
	suggestedOpportunities: {
		availabilityState: "ready",
		excludedOwnedMortgageCount: 2,
		rows: [],
	},
};

export const unavailableSuggestedOpportunitiesFixture: PortfolioCommandCenterSnapshot =
	{
		...portfolioCommandCenterFixture,
		emptyStates: {
			...portfolioCommandCenterFixture.emptyStates,
			hasSuggestions: false,
		},
		limitsStrip: {
			...portfolioCommandCenterFixture.limitsStrip,
			hasConstraints: false,
		},
		suggestedOpportunities: {
			availabilityState: "unavailable",
			excludedOwnedMortgageCount: 0,
			rows: [],
			unavailableReason:
				"FairLend could not load a reliable suggestion snapshot right now.",
		},
	};

export const staleSuggestedOpportunitiesFixture: PortfolioCommandCenterSnapshot =
	{
		...portfolioCommandCenterFixture,
		generatedAt: Date.parse("2026-03-20T12:00:00.000Z"),
	};

export const portfolioHistoricalSeriesFixture: PortfolioHistoricalSeries = {
	asOfDate: "2026-04-21",
	dataCompleteness: "live_fallback",
	generatedAt: 1_710_000_500_000,
	liveFallbackPeriodLabel: "Apr 2026",
	points: [
		{
			cumulativeIncome: 4200,
			dataCompleteness: "snapshot_complete",
			periodEndDate: "2026-01-31",
			periodIncome: 1050,
			periodLabel: "Jan 2026",
			periodSource: "monthly_snapshot",
			projectedAggregateEarnings: 46_800,
			totalFractions: 10,
			totalInvestedValue: 330_000,
			totalPositions: 2,
		},
		{
			cumulativeIncome: 8900,
			dataCompleteness: "snapshot_complete",
			periodEndDate: "2026-02-28",
			periodIncome: 4700,
			periodLabel: "Feb 2026",
			periodSource: "monthly_snapshot",
			projectedAggregateEarnings: 46_100,
			totalFractions: 10,
			totalInvestedValue: 346_000,
			totalPositions: 2,
		},
		{
			cumulativeIncome: 15_300,
			dataCompleteness: "snapshot_complete",
			periodEndDate: "2026-03-31",
			periodIncome: 6400,
			periodLabel: "Mar 2026",
			periodSource: "monthly_snapshot",
			projectedAggregateEarnings: 45_900,
			totalFractions: 10,
			totalInvestedValue: 357_000,
			totalPositions: 2,
		},
		{
			cumulativeIncome: 18_100,
			dataCompleteness: "live_fallback",
			periodEndDate: "2026-04-21",
			periodIncome: 2800,
			periodLabel: "Apr 2026",
			periodSource: "live_fallback",
			projectedAggregateEarnings: 45_400,
			totalFractions: 10,
			totalInvestedValue: 360_000,
			totalPositions: 2,
		},
	],
	snapshotBackedThrough: "2026-03-31",
};

export const emptyPortfolioHistoricalSeriesFixture: PortfolioHistoricalSeries =
	{
		asOfDate: "2026-04-21",
		dataCompleteness: "live_fallback",
		generatedAt: 1_710_000_500_000,
		liveFallbackPeriodLabel: "Apr 2026",
		points: [],
	};

export const portfolioTaxExportFixture: PortfolioTaxExport = {
	csv: "period_label,snapshot_date,mortgage_id\n2026 year-to-date,2026-04-21,mortgage_king",
	dataCompleteness: "live_fallback",
	filename: "lender-portfolio-tax-export-2026-ytd.csv",
	generatedAt: 1_710_000_500_000,
	isAvailable: true,
	periodLabel: "2026 year-to-date",
};

export const unavailablePortfolioTaxExportFixture: PortfolioTaxExport = {
	dataCompleteness: "live_fallback",
	generatedAt: 1_710_000_500_000,
	isAvailable: false,
	periodLabel: "2026 year-to-date",
	unavailableReason:
		"No lender interest income is available for 2026 year-to-date.",
};

export const portfolioRenewalIntentFixture: PortfolioLenderRenewalIntentRecord =
	{
		actionBlockedReason: null,
		actionRequired: true,
		availableChoices: ["renew", "exit", "partial_exit"],
		canChangeIntent: false,
		currentHeldFractions: 600,
		fractionCount: 600,
		id: "renewal_intent_king",
		intent: null,
		maturityDate: "2027-01-01",
		mortgageId: "mortgage_king",
		notes: null,
		partialExitAvailable: true,
		partialExitFractions: null,
		partialExitMinimumFractions: 100,
		positionAccountId: "position_account_king",
		recordedAt: 1_710_000_500_000,
		signalDeadline: "2026-05-15",
		signalledAt: null,
		status: "pending_signal",
	};

export const renewedPortfolioRenewalIntentFixture: PortfolioLenderRenewalIntentRecord =
	{
		...portfolioRenewalIntentFixture,
		actionRequired: false,
		availableChoices: ["exit", "partial_exit"],
		canChangeIntent: true,
		intent: "renew",
		signalledAt: 1_710_000_860_000,
		status: "renewed",
	};

export const partialExitPortfolioRenewalIntentFixture: PortfolioLenderRenewalIntentRecord =
	{
		...portfolioRenewalIntentFixture,
		actionRequired: false,
		availableChoices: ["renew", "exit"],
		canChangeIntent: true,
		intent: "partial_exit",
		partialExitFractions: 150,
		signalledAt: 1_710_000_860_000,
		status: "exiting",
	};

export const expiredPortfolioRenewalIntentFixture: PortfolioLenderRenewalIntentRecord =
	{
		...portfolioRenewalIntentFixture,
		actionBlockedReason: "expired",
		actionRequired: false,
		availableChoices: [],
		canChangeIntent: false,
		status: "expired",
	};

export const soldOutPortfolioRenewalIntentFixture: PortfolioLenderRenewalIntentRecord =
	{
		...renewedPortfolioRenewalIntentFixture,
		actionBlockedReason: "position_sold",
		availableChoices: [],
		canChangeIntent: false,
		currentHeldFractions: 0,
		fractionCount: 0,
	};

export const portfolioPositionDetailFixture: PortfolioPositionDetail = {
	generatedAt: 1_710_000_500_000,
	mortgage: {
		amortizationMonths: 240,
		firstPaymentDate: "2026-02-01",
		interestRate: 8.5,
		lienPosition: 1,
		maturityDate: "2027-01-01",
		mortgageId: "mortgage_king",
		paymentAmount: 1250,
		paymentFrequency: "monthly",
		principal: 250_000,
		rateType: "fixed",
		status: "active",
		termMonths: 12,
	},
	paymentOverview: {
		lenderSharePaymentAmount: 750,
		nextPaymentDate: "2026-05-01",
	},
	position: portfolioCommandCenterFixture.positions.rows[0],
	property: {
		city: "Toronto",
		heroImageUrl: "https://images.example.com/king-street-hero.jpg",
		postalCode: "M5V1E3",
		propertyType: "Detached Home",
		province: "ON",
		streetAddress: "123 King St W",
		unit: null,
	},
	quickActions: [
		portfolioCommandCenterFixture.actionsRequired.items[0],
		{
			dealId: "deal_king",
			dueDate: null,
			id: "action_open_deal",
			kind: "deal_action",
			mortgageId: "mortgage_king",
			prefillContext: {
				contextType: "deal",
				dealId: "deal_king",
				propertyLabel: "123 King St W, Toronto",
				subjectId: "deal_king",
				summary: "Open the linked deal package for the King Street mortgage.",
				title: "Open linked deal",
			},
			priority: "medium",
			status: "ready",
			summary: "Open the linked deal package for the King Street mortgage.",
			title: "Open linked deal",
		},
	],
	renewal: {
		brokerAcknowledgedAt: null,
		intent: "renew",
		partialExitFractions: null,
		signalDeadline: "2026-05-15",
		status: "pending_signal",
	},
};

export const portfolioPaymentDetailFixture: PortfolioPaymentDetail = {
	collectionTimeline: [
		{
			label: "Payment scheduled",
			status: "scheduled",
			timestampLabel: "Apr 1, 2026",
		},
		{
			label: "Collection attempt created",
			status: "failed",
			timestampLabel: "Apr 2, 2026",
		},
	],
	generatedAt: 1_710_000_500_000,
	mortgage: {
		interestRate: 8.5,
		maturityDate: "2027-01-01",
		mortgageId: "mortgage_king",
		paymentAmount: 1250,
		paymentFrequency: "monthly",
		principal: 250_000,
		status: "active",
	},
	payment: portfolioCommandCenterFixture.paymentActivity.rows[0],
	positionSummary: {
		estimatedPositionValue: 220_000,
		lenderSharePercent: 60,
		positionUnits: 6000,
	},
	property: {
		city: "Toronto",
		propertyType: "Detached Home",
		province: "ON",
		streetAddress: "123 King St W",
		unit: null,
	},
	relatedActions: portfolioCommandCenterFixture.actionsRequired.items,
};
