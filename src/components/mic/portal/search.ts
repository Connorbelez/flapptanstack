import {
	DEFAULT_MIC_PORTFOLIO_FILTER_STATE,
	MIC_PORTFOLIO_SORT_KEYS,
	type MicPortfolioFilterState,
	type MicPortfolioSortKey,
} from "./types";

const MIC_SORT_KEYS = new Set<MicPortfolioSortKey>(MIC_PORTFOLIO_SORT_KEYS);

function parseString(value: unknown) {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function parseSort(value: unknown): MicPortfolioSortKey {
	return MIC_SORT_KEYS.has(value as MicPortfolioSortKey)
		? (value as MicPortfolioSortKey)
		: DEFAULT_MIC_PORTFOLIO_FILTER_STATE.positionSort;
}

export function parseMicPortfolioSearch(
	raw: Record<string, unknown>
): MicPortfolioFilterState {
	return {
		detailMortgageId: parseString(raw.detailMortgageId),
		positionQuery: parseString(raw.positionQuery),
		positionSort: parseSort(raw.positionSort),
		positionStatus: parseString(raw.positionStatus),
	};
}

export function cleanMicPortfolioSearch(
	search: MicPortfolioFilterState
): Partial<MicPortfolioFilterState> {
	return Object.fromEntries(
		Object.entries(search).filter(([key, value]) => {
			if (value === undefined || value === null) {
				return false;
			}
			if (typeof value === "string" && value.trim().length === 0) {
				return false;
			}
			if (
				key === "positionSort" &&
				value === DEFAULT_MIC_PORTFOLIO_FILTER_STATE.positionSort
			) {
				return false;
			}
			return true;
		})
	) as Partial<MicPortfolioFilterState>;
}
