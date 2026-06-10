import type { Id } from "../../../convex/_generated/dataModel";

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
	evidenceAssets?: ListingComparableEvidenceAsset[];
	id: string;
	price: string;
	squareFeet: string;
}

export interface ListingComparableEvidenceAsset {
	kind: "file" | "image";
	label: string;
	url: string;
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

export interface ListingUpcomingPayment {
	amount: string;
	date: string;
	status: "due" | "executing" | "none" | "overdue" | "planned";
	statusLabel: string;
}

export interface ListingDocumentItem {
	assetId: string;
	contentType?: string | null;
	description?: string | null;
	fileName?: string | null;
	id: string;
	kind: "pdf" | "other";
	label: string;
	meta: string;
	url?: string | null;
}

export interface ListingAdminQuickLink {
	entityType: string;
	id: string;
	label: string;
}

export interface ListingLawyerOption {
	activeDealCount?: number;
	availability?: Array<{
		businessDate: string;
		hasAvailability: boolean;
		isOnHold: boolean;
		label: string;
		windows: readonly string[];
	}>;
	barNumber?: string | null;
	capacityLimit?: number;
	capacityWarning?: "approaching" | "full" | "none" | "over_capacity";
	detail: string;
	email?: string | null;
	firm?: string | null;
	id: string;
	jurisdiction?: string | null;
	label: string;
	latestVerificationId?: string | null;
	lawyerProfileId?: string;
	slaTier?: {
		name: string;
		reviewHours: number;
	} | null;
	type: "guest_lawyer" | "platform_lawyer";
}

export type ListingLsoLicensingStatus =
	| "administratively_suspended"
	| "licensed"
	| "retired"
	| "revoked"
	| "suspended"
	| "unknown";

export type ListingLsoRestrictionStatus =
	| "clear"
	| "requires_review"
	| "restricted"
	| "suspended"
	| "unknown";

export type ListingLsoRegistrySource =
	| "lso_import"
	| "lso_live_refresh"
	| "manual_admin";

export interface ListingLsoLawyerSearchResult {
	barNumber: string;
	displayName: string;
	email: string | null;
	firmName: string | null;
	jurisdiction: string;
	licensingStatus: ListingLsoLicensingStatus;
	lsoLawyerId: Id<"lsoLawyers">;
	restrictionStatus: ListingLsoRestrictionStatus;
	restrictionSummary: string | null;
	selectable: boolean;
	source: ListingLsoRegistrySource;
	sourceFetchedAt: number;
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
	adminQuickLinks?: ListingAdminQuickLink[];
	appraisal: {
		asIf: ListingAppraisalRecord;
		asIs: ListingAppraisalRecord;
		hasAsIf?: boolean;
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
		lsoLawyerSearchResults?: ListingLsoLawyerSearchResult[];
		lockFee: {
			amountCents: number;
			currency: string;
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
		nextUpcoming: ListingUpcomingPayment;
	};
	referenceLabel?: string;
	similarListings: ListingSimilarCard[];
	summary: string;
	title: string;
}

export type ListingDetailMock = ListingDetailData;

export type ListingCheckoutReturnState =
	| "abandoned"
	| "error"
	| "expired"
	| "provider_start_failed"
	| "success_pending";

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
			lso: {
				barNumber: string;
				jurisdiction: string;
				licensingStatus?: ListingLsoLicensingStatus;
				lsoLawyerId: Id<"lsoLawyers">;
				restrictionStatus?: ListingLsoRestrictionStatus;
				restrictionSummary?: string;
				source: ListingLsoRegistrySource;
				sourceFetchedAt: number;
			};
			name: string;
			source: "lso_search";
			type: "guest_lawyer";
	  }
	| {
			email: string;
			firm?: string;
			name: string;
			source: "manual";
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
			code: string;
			message: string;
			ok: false;
	  };
