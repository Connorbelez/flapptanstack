import {
	formatDecileAvailability,
	formatDecileCountForDisplay,
	ledgerUnitsToDecilesExact,
	wholeDecilesFromLedger,
} from "#/lib/mortgage-ownership-display";
import type {
	ListingBadge,
	ListingBorrowerSignal,
	ListingComparable,
	ListingDetailData,
	ListingDocumentItem,
	ListingHeroImage,
	ListingPaymentHistoryMonth,
	ListingSimilarCard,
	ListingUpcomingPayment,
} from "./listing-detail-types";
import type { MarketplaceListingDetailSnapshot } from "./marketplace-types";

const HERO_TONES: readonly ListingHeroImage["tone"][] = [
	"stone",
	"mist",
	"pearl",
	"warm",
	"sand",
	"sage",
];
const WORD_BOUNDARY_PATTERN = /[_\s-]+/g;
const CENTS_PER_DOLLAR = 100;

type MarketplaceListingDetail = NonNullable<MarketplaceListingDetailSnapshot>;
type MarketplacePaymentSnapshot =
	MarketplaceListingDetail["listing"]["paymentSnapshot"];
type MarketplaceNextPaymentDue =
	MarketplaceListingDetail["listing"]["nextPaymentDue"];
type MarketplaceUpcomingPaymentStatus =
	NonNullable<MarketplacePaymentSnapshot>["nextUpcomingPaymentStatus"];

function pickHeroTone(index: number): ListingHeroImage["tone"] {
	return HERO_TONES[index % HERO_TONES.length] ?? "stone";
}

function formatCurrency(value: number) {
	return new Intl.NumberFormat("en-CA", {
		currency: "CAD",
		maximumFractionDigits: 0,
		style: "currency",
	}).format(value);
}

function formatCompactCurrency(value: number) {
	return new Intl.NumberFormat("en-CA", {
		currency: "CAD",
		maximumFractionDigits: 1,
		notation: "compact",
		style: "currency",
	}).format(value);
}

function centsToDollars(cents: number) {
	return cents / CENTS_PER_DOLLAR;
}

function formatCentsAsCurrency(cents: number) {
	return formatCurrency(centsToDollars(cents));
}

function formatCentsAsCompactCurrency(cents: number) {
	return formatCompactCurrency(centsToDollars(cents));
}

function formatPercent(value: number, digits = 2) {
	return `${value.toFixed(digits)}%`;
}

function formatDate(value: string) {
	const parsed = new Date(
		value.includes("T") ? value : `${value}T00:00:00.000Z`
	);
	if (Number.isNaN(parsed.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat("en-CA", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
		year: "numeric",
	}).format(parsed);
}

function formatTimestamp(value: number) {
	return new Intl.DateTimeFormat("en-CA", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
		year: "numeric",
	}).format(new Date(value));
}

function titleCase(value: string) {
	return value
		.split(WORD_BOUNDARY_PATTERN)
		.filter((part) => part.length > 0)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
		.join(" ");
}

function ordinal(value: number) {
	if (value % 100 >= 11 && value % 100 <= 13) {
		return `${value}th`;
	}

	switch (value % 10) {
		case 1:
			return `${value}st`;
		case 2:
			return `${value}nd`;
		case 3:
			return `${value}rd`;
		default:
			return `${value}th`;
	}
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (typeof value !== "object" || value === null) {
		return null;
	}
	return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function readArray<T>(value: readonly T[] | null | undefined): readonly T[] {
	return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
	return typeof value === "boolean" ? value : null;
}

function buildBadges(detail: NonNullable<MarketplaceListingDetailSnapshot>) {
	let mortgageTypeBadgeLabel = "OTHER POSITION";
	if (detail.listing.mortgageTypeLabel === "First") {
		mortgageTypeBadgeLabel = "1ST MORTGAGE";
	} else if (detail.listing.mortgageTypeLabel === "Second") {
		mortgageTypeBadgeLabel = "2ND MORTGAGE";
	}

	const badges: ListingBadge[] = [
		{
			id: "mortgage-type",
			label: mortgageTypeBadgeLabel,
			tone: "dark",
		},
		{
			id: "property-type",
			label: detail.listing.propertyTypeLabel,
			tone: "outline",
		},
		{
			id: "rate-type",
			label:
				detail.listing.rateType === "fixed" ? "Fixed Rate" : "Variable Rate",
			tone: "outline",
		},
	];

	if (detail.investment.soldPercent > 0) {
		badges.push({
			id: "sold",
			label: `${Math.round(detail.investment.soldPercent)}% Sold`,
			tone: "default",
		});
	}

	return badges;
}

function buildHeroImages(
	detail: NonNullable<MarketplaceListingDetailSnapshot>
): ListingHeroImage[] {
	const heroImages = readArray(detail.listing.heroImages);
	if (heroImages.length === 0) {
		return [
			{
				alt: detail.listing.title,
				id: `${detail.listing.id}:fallback`,
				label: "No photos available",
				tone: "stone",
				url: null,
			},
		];
	}

	return heroImages.map((image, index) => ({
		alt: image.caption ?? detail.listing.title,
		id: image.id,
		label: image.caption ?? `Photo ${index + 1}`,
		tone: pickHeroTone(index),
		url: image.url,
	}));
}

function buildComparables(
	detail: NonNullable<MarketplaceListingDetailSnapshot>
): ListingDetailData["comparables"] {
	const latestAppraisal = readArray(detail.appraisals)[0];
	const rows: ListingComparable[] = (latestAppraisal?.comparables ?? []).map(
		(comparable) => {
			const evidenceAssets = readArray(comparable.evidenceAssets)
				.filter((asset) => asset.url)
				.map((asset) => ({
					kind: asset.kind,
					label: asset.label,
					url: asset.url ?? "",
				}));

			return {
				address: comparable.address,
				date: comparable.saleDate
					? formatDate(comparable.saleDate)
					: "Unavailable",
				distance: "—",
				...(evidenceAssets.length > 0 ? { evidenceAssets } : {}),
				id: comparable.id,
				price:
					comparable.salePrice !== null
						? formatCentsAsCurrency(comparable.salePrice)
						: "Unavailable",
				squareFeet:
					comparable.squareFootage !== null
						? comparable.squareFootage.toLocaleString("en-CA")
						: "—",
			};
		}
	);

	return {
		asIf: [],
		asIs: rows,
	};
}

function buildBorrowerSignals(
	detail: NonNullable<MarketplaceListingDetailSnapshot>
): ListingDetailData["borrowerSignals"] {
	const borrowerSignal = asRecord(detail.listing.borrowerSignal);
	const participants = asArray(borrowerSignal?.participants).map(asRecord);
	const borrowerCount =
		readNumber(borrowerSignal?.borrowerCount) ?? participants.length;
	const hasGuarantor = readBoolean(borrowerSignal?.hasGuarantor) ?? false;
	const primaryBorrowerName =
		readString(borrowerSignal?.primaryBorrowerName) ?? "Not disclosed";
	const verifiedParticipants = participants.filter((participant) =>
		readString(participant?.idvStatus)
	).length;

	const items: ListingBorrowerSignal[] = [
		{
			id: "primary-borrower",
			label: "Primary borrower",
			tone: "default",
			value: primaryBorrowerName,
		},
		{
			id: "borrower-count",
			label: "Participants",
			tone: "default",
			value: `${borrowerCount} linked`,
		},
		{
			id: "verification",
			label: "Identity checks",
			tone: verifiedParticipants > 0 ? "positive" : "warning",
			value:
				borrowerCount > 0
					? `${verifiedParticipants}/${borrowerCount} surfaced`
					: "Awaiting data",
		},
		{
			id: "guarantor",
			label: "Guarantor",
			tone: hasGuarantor ? "positive" : "default",
			value: hasGuarantor ? "Present" : "None",
		},
	];

	let verificationGrade = "C";
	if (borrowerCount === 0) {
		verificationGrade = "N/A";
	} else if (verifiedParticipants >= borrowerCount) {
		verificationGrade = "A";
	} else if (verifiedParticipants > 0) {
		verificationGrade = "B";
	}

	return {
		grade: verificationGrade,
		items,
		note: "Operational profile",
		score:
			borrowerCount > 0
				? `${verifiedParticipants}/${borrowerCount}`
				: "Awaiting data",
		subtitle:
			borrowerCount > 0
				? "Borrower composition derived from the active mortgage file."
				: "Borrower profile details have not been published yet.",
	};
}

function formatUpcomingPaymentAmount(
	nextPaymentDue: MarketplaceNextPaymentDue,
	paymentSnapshot: MarketplacePaymentSnapshot
) {
	if (nextPaymentDue?.amount !== null && nextPaymentDue?.amount !== undefined) {
		return formatCentsAsCurrency(nextPaymentDue.amount);
	}
	if (
		paymentSnapshot?.nextUpcomingPaymentAmount !== null &&
		paymentSnapshot?.nextUpcomingPaymentAmount !== undefined
	) {
		return formatCentsAsCurrency(paymentSnapshot.nextUpcomingPaymentAmount);
	}
	return "Not scheduled";
}

function formatUpcomingPaymentDate(
	nextPaymentDue: MarketplaceNextPaymentDue,
	paymentSnapshot: MarketplacePaymentSnapshot
) {
	if (nextPaymentDue?.date !== null && nextPaymentDue?.date !== undefined) {
		return formatTimestamp(nextPaymentDue.date);
	}
	if (
		paymentSnapshot?.nextUpcomingPaymentDate !== null &&
		paymentSnapshot?.nextUpcomingPaymentDate !== undefined
	) {
		return formatTimestamp(paymentSnapshot.nextUpcomingPaymentDate);
	}
	return "No upcoming payment";
}

function buildNextUpcomingPayment(
	detail: MarketplaceListingDetail
): ListingUpcomingPayment {
	const { nextPaymentDue, paymentSnapshot } = detail.listing;
	const status =
		nextPaymentDue?.status ?? paymentSnapshot?.nextUpcomingPaymentStatus;

	return {
		amount: formatUpcomingPaymentAmount(nextPaymentDue, paymentSnapshot),
		date: formatUpcomingPaymentDate(nextPaymentDue, paymentSnapshot),
		status: normalizeUpcomingPaymentStatus(status),
		statusLabel: formatUpcomingPaymentStatus(status),
	};
}

function buildPaymentHistory(
	detail: MarketplaceListingDetail
): ListingDetailData["paymentHistory"] {
	const paymentHistory = asRecord(detail.listing.paymentHistory);
	const byStatus = asRecord(paymentHistory?.byStatus) ?? {};
	const lateCount =
		(readNumber(byStatus.overdue) ?? 0) +
		(readNumber(byStatus.partially_settled) ?? 0);
	const missedCount =
		(readNumber(byStatus.missed) ?? 0) +
		(readNumber(byStatus.defaulted) ?? 0) +
		(readNumber(byStatus.failed) ?? 0);
	const onTimeCount =
		(readNumber(byStatus.settled) ?? 0) + (readNumber(byStatus.waived) ?? 0);
	const rateDenominator = onTimeCount + lateCount + missedCount;

	return {
		lateCount,
		missedCount,
		months: buildPaymentHistoryMonths(paymentHistory),
		nextUpcoming: buildNextUpcomingPayment(detail),
		onTimeRate:
			rateDenominator > 0
				? `${Math.round((onTimeCount / rateDenominator) * 100)}%`
				: "N/A",
	};
}

function normalizeUpcomingPaymentStatus(
	status: MarketplaceUpcomingPaymentStatus | null | undefined
): ListingDetailData["paymentHistory"]["nextUpcoming"]["status"] {
	if (status === "due" || status === "overdue" || status === "executing") {
		return status;
	}

	if (status === "planned" || status === "provider_scheduled") {
		return "planned";
	}

	return "none";
}

function formatUpcomingPaymentStatus(
	status: MarketplaceUpcomingPaymentStatus | null | undefined
) {
	switch (status) {
		case "provider_scheduled":
			return "Provider scheduled";
		case "executing":
			return "Collection running";
		case "due":
			return "Due now";
		case "overdue":
			return "Overdue";
		case "planned":
			return "Planned";
		default:
			return "No upcoming payment";
	}
}

function buildPaymentHistoryMonths(
	paymentHistory: Record<string, unknown> | null
): ListingPaymentHistoryMonth[] {
	return asArray(paymentHistory?.months).flatMap((rawMonth, index) => {
		const month = asRecord(rawMonth);
		if (month === null) {
			return [];
		}

		const status = normalizePaymentHistoryMonthStatus(month.status);
		if (status === null) {
			return [];
		}

		const label =
			readString(month.label) ??
			readString(month.month) ??
			readString(month.period) ??
			`Period ${index + 1}`;

		return [
			{
				id: readString(month.id) ?? label,
				label,
				status,
			},
		];
	});
}

function normalizePaymentHistoryMonthStatus(
	status: unknown
): ListingPaymentHistoryMonth["status"] | null {
	if (
		status === "late" ||
		status === "overdue" ||
		status === "partially_settled"
	) {
		return "late";
	}

	if (status === "missed" || status === "defaulted" || status === "failed") {
		return "missed";
	}

	if (status === "onTime" || status === "settled" || status === "paid") {
		return "onTime";
	}

	return null;
}

function buildDocuments(
	detail: NonNullable<MarketplaceListingDetailSnapshot>
): ListingDocumentItem[] {
	return readArray(detail.documents).map((document) => ({
		assetId: String(document.assetId),
		contentType: document.contentType ?? null,
		description: document.description,
		fileName: document.fileName ?? null,
		id: String(document.assetId),
		kind: document.kind,
		label: document.displayName,
		meta: titleCase(document.class),
		url: document.url,
	}));
}

function buildSimilarListings(
	detail: NonNullable<MarketplaceListingDetailSnapshot>
): ListingSimilarCard[] {
	return readArray(detail.similarListings).map((listing, index) => ({
		badges: [
			{
				id: `${listing.id}-mortgage-type`,
				label: listing.mortgageTypeLabel,
				tone: "dark",
			},
			{
				id: `${listing.id}-property-type`,
				label: listing.propertyTypeLabel ?? "Property",
				tone: "outline",
			},
		],
		id: listing.id,
		imageUrl: listing.heroImageUrl,
		metrics: [formatPercent(listing.interestRate), `${listing.ltvRatio}% LTV`],
		price: formatCentsAsCompactCurrency(listing.principal),
		title: listing.title,
		tone: pickHeroTone(index),
	}));
}

function buildCheckoutContract(
	detail: NonNullable<MarketplaceListingDetailSnapshot>,
	perFractionAmount: number
): ListingDetailData["checkout"] {
	const availableFractions = wholeDecilesFromLedger(
		detail.investment.availableFractions
	);
	if (!detail.investment.checkoutReady || availableFractions <= 0) {
		return undefined;
	}

	const minimumFractions = Math.min(1, availableFractions);

	return {
		defaultFractions: Math.max(minimumFractions, 1),
		disabledReason:
			availableFractions > 0 ? null : "No fractions are currently available.",
		isEligible: availableFractions > 0,
		lawyers: readArray(detail.lawyers).map((lawyer) => ({
			activeDealCount: lawyer.activeDealCount ?? 0,
			availability: [...(lawyer.availability ?? [])],
			barNumber: lawyer.barNumber,
			capacityLimit: lawyer.capacityLimit ?? 0,
			capacityWarning: lawyer.capacityWarning ?? "none",
			detail:
				lawyer.slaTier == null
					? titleCase(lawyer.role)
					: `${lawyer.slaTier.name} SLA`,
			email: lawyer.email,
			firm: lawyer.firmName,
			id: lawyer.authId,
			jurisdiction: lawyer.jurisdiction,
			label: lawyer.displayName,
			lawyerProfileId: String(lawyer.lawyerProfileId),
			latestVerificationId: lawyer.latestVerificationId
				? String(lawyer.latestVerificationId)
				: null,
			slaTier: lawyer.slaTier ?? null,
			type: "platform_lawyer",
		})),
		lsoLawyerSearchResults: [],
		lockFee: {
			amountCents: 25_000,
			currency: "CAD",
			display: formatCurrency(250),
		},
		maximumFractions: availableFractions,
		minimumFractions,
		perFractionAmount: Math.round(perFractionAmount),
	};
}

function buildAdminQuickLinks(
	detail: NonNullable<MarketplaceListingDetailSnapshot>
): ListingDetailData["adminQuickLinks"] {
	const links: NonNullable<ListingDetailData["adminQuickLinks"]> = [
		{
			entityType: "listings",
			id: detail.listing.id,
			label: "Listing",
		},
	];

	if (detail.listing.mortgageId) {
		links.push({
			entityType: "mortgages",
			id: detail.listing.mortgageId,
			label: "Mortgage",
		});
	}

	if (detail.listing.nextPaymentDue?.planEntryId) {
		links.push({
			entityType: "collectionPlanEntries",
			id: detail.listing.nextPaymentDue.planEntryId,
			label: "Payment schedule",
		});
	}

	if (detail.listing.nextPaymentDue?.obligationId) {
		links.push({
			entityType: "obligations",
			id: detail.listing.nextPaymentDue.obligationId,
			label: "Current obligation",
		});
	}

	return links;
}

export function buildMarketplaceListingDetailModel(
	detail: NonNullable<MarketplaceListingDetailSnapshot>
): ListingDetailData {
	const latestAppraisal = readArray(detail.appraisals)[0];
	const availableLedger = detail.investment.availableFractions;
	const totalLedger = detail.investment.totalFractions;
	const totalDecilesExact = ledgerUnitsToDecilesExact(totalLedger);
	const totalDecilesForPricing = Math.max(totalDecilesExact, 1);
	const perFractionAmount = Math.round(
		centsToDollars(detail.listing.principal) / totalDecilesForPricing
	);
	const availableDecilesWhole = wholeDecilesFromLedger(availableLedger);
	const totalDecilesWhole = wholeDecilesFromLedger(totalLedger);
	const encumbranceCount = readArray(detail.encumbrances).length;
	const positionLabel = ordinal(detail.listing.lienPosition);
	const valueAsIfComplete = latestAppraisal?.valueAsIfComplete;
	const asIfAppraisal =
		latestAppraisal != null && valueAsIfComplete != null
			? { appraisal: latestAppraisal, value: valueAsIfComplete }
			: null;

	return {
		adminQuickLinks: buildAdminQuickLinks(detail),
		appraisal: {
			asIf: asIfAppraisal
				? {
						label: "As-If Complete",
						note: "Projected value from the latest published appraisal package.",
						secondaryLabel: "Effective",
						secondaryValue: formatDate(asIfAppraisal.appraisal.effectiveDate),
						value: formatCentsAsCurrency(asIfAppraisal.value),
					}
				: {
						label: "Projected Value",
						note: "No as-if-complete valuation has been published.",
						value: "Unavailable",
					},
			asIs: latestAppraisal
				? {
						date: formatDate(latestAppraisal.reportDate),
						label: "As-Is Appraisal",
						note: titleCase(latestAppraisal.type),
						secondaryLabel: "Effective",
						secondaryValue: formatDate(latestAppraisal.effectiveDate),
						value: formatCentsAsCurrency(latestAppraisal.valueAsIs),
					}
				: {
						label: "As-Is Appraisal",
						note: "No appraisal has been published for this listing.",
						value: "Unavailable",
					},
			hasAsIf: asIfAppraisal != null,
		},
		atAGlance: [
			{
				label: "Principal",
				value: formatCentsAsCurrency(detail.listing.principal),
			},
			{
				label: "Interest Rate",
				value: `${formatPercent(detail.listing.interestRate)} ${titleCase(detail.listing.rateType)}`,
			},
			{
				label: "LTV",
				tone: detail.listing.ltvRatio <= 65 ? "positive" : "default",
				value: formatPercent(detail.listing.ltvRatio),
			},
			{ label: "Term", value: `${detail.listing.termMonths} months` },
			{
				label: "Available",
				tone: availableLedger > 0 ? "positive" : "warning",
				value: `${formatDecileCountForDisplay(ledgerUnitsToDecilesExact(availableLedger))} / ${formatDecileCountForDisplay(ledgerUnitsToDecilesExact(totalLedger))} at 10%`,
			},
			{
				label: "Prior Charges",
				value:
					encumbranceCount > 0
						? `${encumbranceCount} disclosed`
						: "None published",
			},
		],
		badges: buildBadges(detail),
		borrowerSignals: buildBorrowerSignals(detail),
		checkout: buildCheckoutContract(detail, perFractionAmount),
		comparables: buildComparables(detail),
		documents: buildDocuments(detail),
		heroImages: buildHeroImages(detail),
		id: detail.listing.id,
		investment: {
			availabilityLabel: formatDecileAvailability(availableLedger, totalLedger),
			availabilityValue:
				totalLedger > 0 ? Math.round((availableLedger / totalLedger) * 100) : 0,
			availableFractions: availableDecilesWhole,
			investorCountLabel:
				detail.investment.investorCount > 0
					? `${detail.investment.investorCount} investors currently committed`
					: "No investors have locked fractions yet.",
			lockedPercent: detail.investment.lockedPercent,
			minimumFractions: availableLedger > 0 ? 1 : 0,
			perFractionAmount,
			projectedYield: `${formatPercent(detail.listing.interestRate)} APR`,
			soldPercent: detail.investment.soldPercent,
			totalFractions: totalDecilesWhole,
		},
		keyFinancials: [
			{
				label: "Principal Amount",
				note: "CAD",
				value: formatCentsAsCurrency(detail.listing.principal),
			},
			{
				label: "Interest Rate",
				note: titleCase(detail.listing.rateType),
				value: formatPercent(detail.listing.interestRate),
			},
			{
				label: "LTV",
				note:
					detail.listing.ltvRatio <= 65 ? "Lower leverage" : "Published ratio",
				tone: detail.listing.ltvRatio <= 65 ? "positive" : "default",
				value: formatPercent(detail.listing.ltvRatio),
			},
			{
				label: "Lien Position",
				note:
					encumbranceCount > 0
						? `${encumbranceCount} prior encumbrance${encumbranceCount === 1 ? "" : "s"}`
						: "No prior charges published",
				value: `${positionLabel} position`,
			},
			{
				label: "Term Length",
				note: "Original note term",
				value: `${detail.listing.termMonths} mo`,
			},
			{
				label: "Monthly Payment",
				note: titleCase(detail.listing.paymentFrequency),
				value: formatCentsAsCurrency(detail.listing.monthlyPayment),
			},
			{
				label: "Payment Frequency",
				note: `${detail.listing.paymentFrequency.replaceAll("_", " ")} schedule`,
				value: titleCase(detail.listing.paymentFrequency),
			},
			{
				label: "Maturity Date",
				note: "Current published maturity",
				value: formatDate(detail.listing.maturityDate),
			},
		],
		listedLabel: `Matures ${formatDate(detail.listing.maturityDate)}`,
		map: {
			label: "Approximate location",
			lat: detail.listing.approximateLatitude,
			lng: detail.listing.approximateLongitude,
			locationText: detail.listing.locationLabel,
		},
		paymentHistory: buildPaymentHistory(detail),
		referenceLabel: `FairLend listing ${detail.listing.id.slice(-6)}`,
		similarListings: buildSimilarListings(detail),
		summary: detail.listing.summary,
		title: detail.listing.title,
	};
}
