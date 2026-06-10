import { formatDecilesCardSummary } from "#/lib/mortgage-ownership-display";
import type {
	MarketplaceListingCardItem,
	MarketplaceListingsSearchState,
	MarketplaceListingsSnapshotItem,
} from "./marketplace-types";
import {
	DEFAULT_FILTERS,
	type FilterMetricItem,
	type FilterState,
	type MortgageType,
	type PropertyType,
} from "./types/listing-filters";

const DEFAULT_MARKETPLACE_COORDINATES = {
	lat: 43.6532,
	lng: -79.3832,
} as const;

function parseValidDate(value: string | undefined): Date | undefined {
	if (!value) {
		return undefined;
	}

	const parsed = new Date(value);
	return Number.isFinite(parsed.getTime()) ? parsed : undefined;
}

const CENTS_PER_DOLLAR = 100;

export function principalCentsToDollars(cents: number): number {
	return cents / CENTS_PER_DOLLAR;
}

export function principalDollarsToCents(dollars: number): number {
	return Math.round(dollars * CENTS_PER_DOLLAR);
}

export function searchStateToFilterState(
	search: MarketplaceListingsSearchState
): FilterState {
	return {
		...DEFAULT_FILTERS,
		availablePercentRange: [
			search.availableMin ?? DEFAULT_FILTERS.availablePercentRange[0],
			search.availableMax ?? DEFAULT_FILTERS.availablePercentRange[1],
		],
		interestRateRange: [
			search.rateMin ?? DEFAULT_FILTERS.interestRateRange[0],
			search.rateMax ?? DEFAULT_FILTERS.interestRateRange[1],
		],
		minimumInvestmentRange: [
			search.minimumInvestmentMin ?? DEFAULT_FILTERS.minimumInvestmentRange[0],
			search.minimumInvestmentMax ?? DEFAULT_FILTERS.minimumInvestmentRange[1],
		],
		principalRange: [
			search.principalMin ?? DEFAULT_FILTERS.principalRange[0],
			search.principalMax ?? DEFAULT_FILTERS.principalRange[1],
		],
		ltvRange: [
			search.ltvMin ?? DEFAULT_FILTERS.ltvRange[0],
			search.ltvMax ?? DEFAULT_FILTERS.ltvRange[1],
		],
		maturityDate: parseValidDate(search.maturityBefore),
		mortgageTypes: search.mortgageTypes ?? [],
		propertyTypes: search.propertyTypes ?? [],
		searchQuery: search.q ?? "",
	};
}

export function filterStateToSearchState(
	filters: FilterState,
	currentSort: MarketplaceListingsSearchState["sort"]
): MarketplaceListingsSearchState {
	return {
		availableMax:
			filters.availablePercentRange[1] !==
			DEFAULT_FILTERS.availablePercentRange[1]
				? filters.availablePercentRange[1]
				: undefined,
		availableMin:
			filters.availablePercentRange[0] !==
			DEFAULT_FILTERS.availablePercentRange[0]
				? filters.availablePercentRange[0]
				: undefined,
		maturityBefore: filters.maturityDate?.toISOString().slice(0, 10),
		minimumInvestmentMax:
			filters.minimumInvestmentRange[1] !==
			DEFAULT_FILTERS.minimumInvestmentRange[1]
				? filters.minimumInvestmentRange[1]
				: undefined,
		minimumInvestmentMin:
			filters.minimumInvestmentRange[0] !==
			DEFAULT_FILTERS.minimumInvestmentRange[0]
				? filters.minimumInvestmentRange[0]
				: undefined,
		mortgageTypes:
			filters.mortgageTypes.length > 0 ? filters.mortgageTypes : undefined,
		principalMax:
			filters.principalRange[1] !== DEFAULT_FILTERS.principalRange[1]
				? filters.principalRange[1]
				: undefined,
		principalMin:
			filters.principalRange[0] !== DEFAULT_FILTERS.principalRange[0]
				? filters.principalRange[0]
				: undefined,
		propertyTypes:
			filters.propertyTypes.length > 0 ? filters.propertyTypes : undefined,
		q: filters.searchQuery.trim() || undefined,
		rateMax:
			filters.interestRateRange[1] !== DEFAULT_FILTERS.interestRateRange[1]
				? filters.interestRateRange[1]
				: undefined,
		rateMin:
			filters.interestRateRange[0] !== DEFAULT_FILTERS.interestRateRange[0]
				? filters.interestRateRange[0]
				: undefined,
		sort: currentSort && currentSort !== "featured" ? currentSort : undefined,
		ltvMax:
			filters.ltvRange[1] !== DEFAULT_FILTERS.ltvRange[1]
				? filters.ltvRange[1]
				: undefined,
		ltvMin:
			filters.ltvRange[0] !== DEFAULT_FILTERS.ltvRange[0]
				? filters.ltvRange[0]
				: undefined,
	};
}

export function deriveMinimumInvestmentDollars(principalCents: number): number {
	return principalCentsToDollars(principalCents) / 10;
}

export function buildFilterMetricItems(
	page: readonly MarketplaceListingsSnapshotItem[]
): FilterMetricItem[] {
	return page.map((listing) => ({
		apr: listing.interestRate,
		availablePercent: Math.round(listing.availability?.availablePercent ?? 0),
		ltv: listing.ltvRatio,
		minimumInvestment: deriveMinimumInvestmentDollars(listing.principal),
		principal: principalCentsToDollars(listing.principal),
	}));
}

export function buildMarketplaceListingCardItems(
	page: readonly MarketplaceListingsSnapshotItem[]
): MarketplaceListingCardItem[] {
	return page.map((listing) => ({
		address: listing.locationLabel,
		apr: listing.interestRate,
		availablePercent: Math.round(listing.availability?.availablePercent ?? 0),
		fractionsSummary: formatDecilesCardSummary(
			listing.availability?.availableFractions ?? 0,
			listing.availability?.totalFractions ?? 0
		),
		id: listing.id,
		imageSrc: listing.heroImageUrl ?? undefined,
		lat: listing.approximateLatitude ?? DEFAULT_MARKETPLACE_COORDINATES.lat,
		lng: listing.approximateLongitude ?? DEFAULT_MARKETPLACE_COORDINATES.lng,
		lockedPercent: Math.round(listing.availability?.lockedPercent ?? 0),
		ltv: listing.ltvRatio,
		maturityDate: new Date(listing.maturityDate),
		minimumInvestment: deriveMinimumInvestmentDollars(listing.principal),
		mortgageType: listing.mortgageTypeLabel as MortgageType,
		principal: principalCentsToDollars(listing.principal),
		propertyType: listing.propertyTypeLabel as PropertyType,
		soldPercent: Math.round(listing.availability?.soldPercent ?? 0),
		title: listing.title,
	}));
}

function normalizePercent(value: number): number {
	return value > 0 && value <= 1 ? value * 100 : value;
}

function inRange(value: number, range: [number, number]): boolean {
	return value >= range[0] && value <= range[1];
}

function matchesSearchQuery(
	item: MarketplaceListingCardItem,
	query: string
): boolean {
	const normalizedQuery = query.trim().toLowerCase();
	if (normalizedQuery.length === 0) {
		return true;
	}

	return [
		item.title,
		item.address,
		item.propertyType,
		item.mortgageType,
		item.fractionsSummary ?? "",
	]
		.join(" ")
		.toLowerCase()
		.includes(normalizedQuery);
}

export function applyMarketplaceListingFilters(
	items: readonly MarketplaceListingCardItem[],
	filters: FilterState
): MarketplaceListingCardItem[] {
	return items.filter((item) => {
		const ltvPercent = normalizePercent(item.ltv);
		return (
			matchesSearchQuery(item, filters.searchQuery) &&
			inRange(ltvPercent, filters.ltvRange) &&
			inRange(item.apr, filters.interestRateRange) &&
			inRange(item.principal, filters.principalRange) &&
			inRange(item.availablePercent, filters.availablePercentRange) &&
			inRange(item.minimumInvestment, filters.minimumInvestmentRange) &&
			(filters.mortgageTypes.length === 0 ||
				filters.mortgageTypes.includes(item.mortgageType)) &&
			(filters.propertyTypes.length === 0 ||
				filters.propertyTypes.includes(item.propertyType))
		);
	});
}
