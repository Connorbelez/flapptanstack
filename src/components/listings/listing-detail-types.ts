export type ListingValueTone = "default" | "positive" | "warning";

export interface ListingBadge {
	id: string;
	label: string;
	tone?: "default" | "outline" | "dark";
}

export interface ListingHeroImage {
	alt: string;
	id: string;
	label: string;
	tone: "mist" | "pearl" | "sage" | "sand" | "stone" | "warm";
	url?: string | null;
}

export interface ListingAtAGlanceItem {
	label: string;
	tone?: ListingValueTone;
	value: string;
}

export interface ListingKeyFinancialItem {
	label: string;
	note: string;
	tone?: ListingValueTone;
	value: string;
}

export interface ListingAppraisalRecord {
	date?: string;
	label: string;
	note: string;
	secondaryLabel?: string;
	secondaryValue?: string;
	value: string;
}

export interface ListingComparable {
	address: string;
	date: string;
	distance: string;
	id: string;
	price: string;
	squareFeet: string;
}

export interface ListingBorrowerSignal {
	id: string;
	label: string;
	tone: ListingValueTone;
	value: string;
}

export interface ListingPaymentHistoryMonth {
	id: string;
	label: string;
	status: "late" | "missed" | "onTime";
}

export interface ListingDocumentItem {
	description?: string | null;
	id: string;
	label: string;
	meta: string;
	pageLabel: string;
	url?: string | null;
}

export type ListingCheckoutSelectedLawyer =
	| {
			email: string;
			firm?: string;
			lawyerId?: string;
			name: string;
			type: "platform_lawyer";
	  }
	| {
			email: string;
			firm?: string;
			name: string;
			type: "guest_lawyer";
	  };

export interface ListingCheckoutStartInput {
	listingId: string;
	portalId: string;
	requestedFractions: number;
	selectedLawyer: ListingCheckoutSelectedLawyer;
}

export type ListingCheckoutStartResult =
	| {
			checkoutSessionId: string;
			expiresAt: number;
			ok: true;
			stripeCheckoutUrl: string;
	  }
	| {
			code:
				| "demo_listing_not_supported"
				| "insufficient_fractions"
				| "invalid_lawyer"
				| "listing_unavailable"
				| "provider_start_failed"
				| "unauthorized";
			message: string;
			ok: false;
	  };

export type ListingCheckoutReturnState =
	| "abandoned"
	| "error"
	| "expired"
	| "provider_start_failed"
	| "success_pending";

export interface ListingLawyerOption {
	detail: string;
	email?: string;
	firm?: string;
	id: string;
	label: string;
	type?: "guest_lawyer" | "platform_lawyer";
}

export interface ListingSimilarCard {
	badges: ListingBadge[];
	href?: string;
	id: string;
	imageUrl?: string | null;
	metrics: string[];
	price: string;
	title: string;
	tone: ListingHeroImage["tone"];
}

export interface ListingDetailData {
	appraisal: {
		asIf: ListingAppraisalRecord;
		asIs: ListingAppraisalRecord;
	};
	atAGlance: ListingAtAGlanceItem[];
	badges: ListingBadge[];
	borrowerSignals: {
		grade: string;
		items: ListingBorrowerSignal[];
		note: string;
		score: string;
		subtitle: string;
	};
	checkout?: {
		defaultFractions: number;
		disabledReason?: string | null;
		isEligible: boolean;
		lawyers: ListingLawyerOption[];
		lockFee: {
			amountCents: number;
			currency: "CAD";
			display: string;
		};
		maximumFractions: number;
		minimumFractions: number;
		perFractionAmount: number;
	};
	comparables: {
		asIf: ListingComparable[];
		asIs: ListingComparable[];
	};
	documents: ListingDocumentItem[];
	heroImages: ListingHeroImage[];
	id: string;
	investment: {
		availabilityLabel: string;
		availabilityValue: number;
		/** Whole 10% slices available to buy (matches ledger, floor of balance ÷ 1,000 units). */
		availableFractions: number;
		investorCountLabel: string;
		lockedPercent?: number;
		minimumFractions?: number;
		/** CAD per one 10% slice (principal ÷ total deciles). */
		perFractionAmount?: number;
		projectedYield: string;
		soldPercent?: number;
		/** Total 10% slices for the mortgage (ledger total supply ÷ 1,000 units). */
		totalFractions: number;
	};
	keyFinancials: ListingKeyFinancialItem[];
	listedLabel: string;
	map: {
		label: string;
		lat?: number | null;
		lng?: number | null;
		locationText: string;
	};
	mlsId?: string;
	paymentHistory: {
		lateCount: number;
		missedCount: number;
		months: ListingPaymentHistoryMonth[];
		onTimeRate: string;
	};
	referenceLabel?: string;
	similarListings: ListingSimilarCard[];
	summary: string;
	title: string;
}

export type ListingDetailMock = ListingDetailData;
