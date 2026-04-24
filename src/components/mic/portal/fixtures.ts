import type { MicMortgageDetail, MicPortfolioSnapshot } from "./types";

export const micPortfolioSnapshotFixture: MicPortfolioSnapshot = {
	asOfLabel: "As of Apr 23, 2026",
	exposureCards: [
		{
			description:
				"Largest single borrower concentration currently visible in the ledger.",
			label: "Top borrower exposure",
			value: "14.8%",
		},
		{
			description:
				"Share of active mortgages maturing within the next 180 days.",
			label: "6-month maturity wall",
			value: "31%",
		},
		{
			description:
				"Weighted mix across the live book by current collateral type.",
			label: "Detached housing mix",
			value: "58%",
		},
	],
	focusItems: [
		{
			id: "focus_1",
			label: "Servicing exception",
			severity: "critical",
			summary:
				"One Toronto mortgage is 18 days past its scheduled payment transfer date.",
			title: "Overdue servicing follow-up",
			value: "1 mortgage",
		},
		{
			id: "focus_2",
			label: "Maturity watch",
			severity: "warning",
			summary:
				"Two positions reach maturity in the next quarter and should be reviewed against renewal posture.",
			title: "Near-term maturity cluster",
			value: "2 positions",
		},
		{
			id: "focus_3",
			label: "Transparency note",
			severity: "info",
			summary:
				"Treasury and cash-on-hand are intentionally excluded until the cash ledger becomes canonical for MIC operations.",
			title: "Ledger-derived reporting boundary",
		},
	],
	fundName: "FairLend MIC",
	metricCards: [
		{
			description:
				"Outstanding principal currently attributable to the MIC in the mortgage ledger.",
			label: "Outstanding principal",
			value: "$8.4M",
		},
		{
			description:
				"Weighted average note yield across current MIC mortgage participation.",
			label: "Weighted average yield",
			tone: "positive",
			value: "8.37%",
		},
		{
			description:
				"Weighted average collateral position using the latest mortgage facts available in the system.",
			label: "Weighted average LTV",
			value: "63.4%",
		},
		{
			description:
				"Mortgages presently reflected in the MIC participation view.",
			label: "Active positions",
			value: "12",
		},
	],
	positions: [
		{
			borrowerLabel: "King Street Developments Inc.",
			city: "Toronto",
			currentLtvPercent: 61.2,
			currentPrincipal: 2_450_000,
			maturityDate: "2026-08-15",
			mortgageId: "mortgage_king",
			mortgageStatus: "active",
			nextPaymentDate: "2026-05-01",
			paymentAmount: 18_375,
			positionPercent: 100,
			propertyLabel: "123 King St W",
			propertyType: "Mixed-use",
			province: "ON",
			thumbnailUrl: "https://images.example.com/king-street.jpg",
			weightedRatePercent: 8.1,
		},
		{
			borrowerLabel: "Queen West Holdings LP",
			city: "Toronto",
			currentLtvPercent: 68.9,
			currentPrincipal: 1_840_000,
			maturityDate: "2026-06-30",
			mortgageId: "mortgage_queen",
			mortgageStatus: "delinquent",
			nextPaymentDate: "2026-04-15",
			paymentAmount: 14_880,
			positionPercent: 100,
			propertyLabel: "88 Queen St W",
			propertyType: "Retail",
			province: "ON",
			thumbnailUrl: null,
			weightedRatePercent: 8.9,
		},
		{
			borrowerLabel: "Niagara Orchard Estates Ltd.",
			city: "St. Catharines",
			currentLtvPercent: 57.8,
			currentPrincipal: 910_000,
			maturityDate: "2027-01-10",
			mortgageId: "mortgage_orchard",
			mortgageStatus: "active",
			nextPaymentDate: "2026-05-12",
			paymentAmount: 7120,
			positionPercent: 100,
			propertyLabel: "14 Orchard Lane",
			propertyType: "Detached",
			province: "ON",
			thumbnailUrl: null,
			weightedRatePercent: 7.95,
		},
	],
	recentActivity: [
		{
			dateLabel: "Apr 18, 2026",
			id: "activity_1",
			summary:
				"Servicing marked the latest transfer as pending after a missed automated collection attempt.",
			title: "Queen West payment exception",
		},
		{
			dateLabel: "Apr 11, 2026",
			id: "activity_2",
			summary:
				"Updated appraisal facts and refreshed current LTV for the King Street mortgage.",
			title: "Collateral facts refreshed",
		},
		{
			dateLabel: "Apr 4, 2026",
			id: "activity_3",
			summary:
				"Borrower submitted renewal materials for a Q3 maturity now visible in the mortgage history.",
			title: "Renewal package received",
		},
	],
	sourceNote:
		"All figures on this page are derived from currently available mortgage-ledger data and adjacent mortgage facts already in the system.",
	subtitle:
		"Read-only transparency into live MIC mortgage positions, servicing signals, and position-level history.",
};

export const micMortgageDetailFixtures: Record<string, MicMortgageDetail> = {
	mortgage_king: {
		addressLine: "123 King St W, Toronto, ON",
		disclosures: [
			"Displayed values are limited to mortgage-ledger and mortgage-fact data presently modeled in FairLend.",
			"MIC cash, reserve, and treasury reporting are intentionally omitted until cash-ledger coverage exists.",
		],
		economicsFields: [
			{ label: "Current principal", value: "$2,450,000" },
			{ label: "Coupon", value: "8.10%" },
			{ label: "Payment amount", value: "$18,375" },
			{ label: "Payment frequency", value: "Monthly" },
			{ label: "Maturity date", value: "Aug 15, 2026" },
			{ label: "Current LTV", value: "61.2%" },
		],
		heroImageUrl: "https://images.example.com/king-street.jpg",
		history: [
			{
				dateLabel: "Apr 11, 2026",
				id: "king_history_1",
				kind: "appraisal_refresh",
				summary:
					"Updated valuation package recorded and collateral metrics refreshed.",
				title: "Appraisal facts refreshed",
			},
			{
				dateLabel: "Mar 22, 2026",
				id: "king_history_2",
				kind: "renewal_watch",
				summary:
					"Renewal planning opened ahead of Q3 maturity with internal review note captured.",
				title: "Renewal watch opened",
			},
		],
		mortgageId: "mortgage_king",
		overviewFields: [
			{ label: "Borrower", value: "King Street Developments Inc." },
			{ label: "Property type", value: "Mixed-use" },
			{ label: "Jurisdiction", value: "Toronto, ON" },
			{ label: "Lien position", value: "First" },
			{ label: "Originator", value: "FairLend Direct" },
			{ label: "Next payment", value: "May 1, 2026" },
		],
		propertyFields: [
			{ label: "Occupancy", value: "Commercial + residential" },
			{ label: "Security", value: "Registered charge" },
			{ label: "Last valuation", value: "$4,000,000" },
			{ label: "Latest valuation date", value: "Apr 10, 2026" },
		],
		propertyLabel: "123 King St W",
		servicingFields: [
			{ label: "Servicing status", value: "Current" },
			{ label: "Transfer state", value: "Scheduled" },
			{ label: "Renewal posture", value: "Under review" },
			{ label: "Document completeness", value: "Complete" },
		],
		status: "active",
		subtitle:
			"Downtown Toronto mixed-use collateral with Q3 maturity monitoring.",
		summaryMetrics: [
			{
				description:
					"Latest outstanding amount reflected in the mortgage ledger.",
				label: "Principal",
				value: "$2.45M",
			},
			{
				description: "Current loan-to-value using the latest collateral facts.",
				label: "Current LTV",
				value: "61.2%",
			},
			{
				description: "Expected upcoming borrower payment date.",
				label: "Next payment",
				value: "May 1",
			},
			{
				description: "Current note coupon attributed to the MIC position.",
				label: "Coupon",
				tone: "positive",
				value: "8.10%",
			},
		],
	},
	mortgage_queen: {
		addressLine: "88 Queen St W, Toronto, ON",
		disclosures: [
			"Servicing exception status is shown from the latest mortgage-ledger activity and may resolve before a formal portfolio snapshot refresh.",
		],
		economicsFields: [
			{ label: "Current principal", value: "$1,840,000" },
			{ label: "Coupon", value: "8.90%" },
			{ label: "Payment amount", value: "$14,880" },
			{ label: "Payment frequency", value: "Monthly" },
			{ label: "Maturity date", value: "Jun 30, 2026" },
			{ label: "Current LTV", value: "68.9%" },
		],
		heroImageUrl: null,
		history: [
			{
				dateLabel: "Apr 18, 2026",
				id: "queen_history_1",
				kind: "payment_exception",
				summary:
					"Collection failed and transfer remains pending while servicing continues follow-up.",
				title: "Payment exception recorded",
			},
			{
				dateLabel: "Apr 2, 2026",
				id: "queen_history_2",
				kind: "borrower_contact",
				summary:
					"Borrower requested short extension ahead of near-term maturity review.",
				title: "Borrower extension request logged",
			},
		],
		mortgageId: "mortgage_queen",
		overviewFields: [
			{ label: "Borrower", value: "Queen West Holdings LP" },
			{ label: "Property type", value: "Retail" },
			{ label: "Jurisdiction", value: "Toronto, ON" },
			{ label: "Lien position", value: "First" },
			{ label: "Originator", value: "FairLend Marketplace" },
			{ label: "Next payment", value: "Apr 15, 2026" },
		],
		propertyFields: [
			{ label: "Occupancy", value: "Street retail" },
			{ label: "Security", value: "Registered charge" },
			{ label: "Last valuation", value: "$2,670,000" },
			{ label: "Latest valuation date", value: "Jan 14, 2026" },
		],
		propertyLabel: "88 Queen St W",
		servicingFields: [
			{ label: "Servicing status", value: "Delinquent" },
			{ label: "Transfer state", value: "Pending follow-up" },
			{ label: "Renewal posture", value: "Watchlist" },
			{ label: "Document completeness", value: "Borrower follow-up open" },
		],
		status: "delinquent",
		subtitle:
			"Retail collateral with an active payment exception and near-term maturity.",
		summaryMetrics: [
			{
				description:
					"Latest outstanding amount reflected in the mortgage ledger.",
				label: "Principal",
				value: "$1.84M",
			},
			{
				description: "Current loan-to-value using the latest collateral facts.",
				label: "Current LTV",
				value: "68.9%",
			},
			{
				description: "Most recent scheduled borrower payment date.",
				label: "Scheduled payment",
				value: "Apr 15",
			},
			{
				description: "Current note coupon attributed to the MIC position.",
				label: "Coupon",
				tone: "positive",
				value: "8.90%",
			},
		],
	},
};
