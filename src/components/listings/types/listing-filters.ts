export type MortgageType = "First" | "Second" | "Other";

export type PropertyType =
	| "Detached Home"
	| "Duplex"
	| "Condo"
	| "Commercial"
	| "Townhouse"
	| "Triplex"
	| "Mixed-Use"
	| "Other";

export interface FilterMetricItem {
	apr?: number;
	availablePercent?: number;
	ltv?: number;
	minimumInvestment?: number;
	principal?: number;
}

export interface FilterState {
	availablePercentRange: [number, number];
	interestRateRange: [number, number];
	ltvRange: [number, number];
	maturityDate?: Date;
	minimumInvestmentRange: [number, number];
	mortgageTypes: MortgageType[];
	principalRange: [number, number];
	propertyTypes: PropertyType[];
	searchQuery: string;
}

export const FILTER_BOUNDS = {
	ltvRange: [30, 80] as [number, number],
	interestRateRange: [3, 15] as [number, number],
	principalRange: [0, 5_000_000] as [number, number],
	availablePercentRange: [0, 100] as [number, number],
	minimumInvestmentRange: [0, 500_000] as [number, number],
} as const;

export const DEFAULT_FILTERS: FilterState = {
	availablePercentRange: FILTER_BOUNDS.availablePercentRange,
	ltvRange: FILTER_BOUNDS.ltvRange,
	interestRateRange: FILTER_BOUNDS.interestRateRange,
	minimumInvestmentRange: FILTER_BOUNDS.minimumInvestmentRange,
	principalRange: FILTER_BOUNDS.principalRange,
	mortgageTypes: [],
	propertyTypes: [],
	searchQuery: "",
	maturityDate: undefined,
};
