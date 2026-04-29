import type {
	LenderPortfolioSearchState,
	PortfolioDetailType,
	PortfolioPaymentRow,
	PortfolioPaymentSortKey,
	PortfolioPositionRow,
	PortfolioPositionSortKey,
} from "./portfolio-types";
import {
	DEFAULT_LENDER_PORTFOLIO_SEARCH,
	PORTFOLIO_DETAIL_TYPES,
	PORTFOLIO_PAYMENT_SORT_KEYS,
	PORTFOLIO_POSITION_SORT_KEYS,
} from "./portfolio-types";

const detailTypeSet = new Set<PortfolioDetailType>(PORTFOLIO_DETAIL_TYPES);
const paymentSortSet = new Set<PortfolioPaymentSortKey>(
	PORTFOLIO_PAYMENT_SORT_KEYS
);
const positionSortSet = new Set<PortfolioPositionSortKey>(
	PORTFOLIO_POSITION_SORT_KEYS
);

const CALENDAR_YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseString(value: unknown) {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function isValidCalendarDateKey(value: string) {
	const match = CALENDAR_YMD.exec(value);
	if (!match) {
		return false;
	}

	const y = Number(match[1]);
	const m = Number(match[2]);
	const d = Number(match[3]);
	const parsed = new Date(y, m - 1, d);
	return (
		parsed.getFullYear() === y &&
		parsed.getMonth() === m - 1 &&
		parsed.getDate() === d
	);
}

function parseDateKey(value: unknown) {
	const parsed = parseString(value);
	return parsed && isValidCalendarDateKey(parsed) ? parsed : undefined;
}

function parseDetailType(value: unknown) {
	return detailTypeSet.has(value as PortfolioDetailType)
		? (value as PortfolioDetailType)
		: undefined;
}

function parsePaymentSort(value: unknown): PortfolioPaymentSortKey {
	return paymentSortSet.has(value as PortfolioPaymentSortKey)
		? (value as PortfolioPaymentSortKey)
		: DEFAULT_LENDER_PORTFOLIO_SEARCH.paymentSort;
}

function parsePositionSort(value: unknown): PortfolioPositionSortKey {
	return positionSortSet.has(value as PortfolioPositionSortKey)
		? (value as PortfolioPositionSortKey)
		: DEFAULT_LENDER_PORTFOLIO_SEARCH.positionSort;
}

function buildSearchHaystack(values: Array<string | null | undefined>) {
	return values
		.filter((value): value is string => typeof value === "string")
		.join(" ")
		.toLowerCase();
}

function compareNullableDate(
	left: string | null | undefined,
	right: string | null | undefined,
	direction: "asc" | "desc"
) {
	const leftValue = left ?? "";
	const rightValue = right ?? "";
	const comparison = leftValue.localeCompare(rightValue);
	return direction === "asc" ? comparison : comparison * -1;
}

function extractDateKey(value: string | null | undefined) {
	if (!value) {
		return undefined;
	}

	return value.slice(0, 10);
}

function matchesDateRange(
	value: string | null | undefined,
	dateFrom?: string,
	dateTo?: string
) {
	const dateKey = extractDateKey(value);
	if (!dateKey) {
		return !(dateFrom || dateTo);
	}

	if (dateFrom && dateKey < dateFrom) {
		return false;
	}

	if (dateTo && dateKey > dateTo) {
		return false;
	}

	return true;
}

export function parseLenderPortfolioSearch(
	raw: Record<string, unknown>
): LenderPortfolioSearchState {
	return {
		detailId: parseString(raw.detailId),
		detailType: parseDetailType(raw.detailType),
		paymentDateFrom: parseDateKey(raw.paymentDateFrom),
		paymentDateTo: parseDateKey(raw.paymentDateTo),
		paymentQuery: parseString(raw.paymentQuery),
		paymentSort: parsePaymentSort(raw.paymentSort),
		paymentStatus: parseString(raw.paymentStatus),
		positionQuery: parseString(raw.positionQuery),
		positionSort: parsePositionSort(raw.positionSort),
		positionStatus: parseString(raw.positionStatus),
	};
}

export function cleanLenderPortfolioSearch(
	search: LenderPortfolioSearchState
): Partial<LenderPortfolioSearchState> {
	const detailState =
		search.detailId && search.detailType
			? {
					detailId: search.detailId,
					detailType: search.detailType,
				}
			: {};

	return Object.fromEntries(
		Object.entries({
			...search,
			...detailState,
			detailId: detailState.detailId,
			detailType: detailState.detailType,
		}).filter(([key, value]) => {
			if (value === undefined || value === null) {
				return false;
			}
			if (typeof value === "string") {
				return value.trim().length > 0;
			}
			if (
				key === "paymentSort" &&
				value === DEFAULT_LENDER_PORTFOLIO_SEARCH.paymentSort
			) {
				return false;
			}
			if (
				key === "positionSort" &&
				value === DEFAULT_LENDER_PORTFOLIO_SEARCH.positionSort
			) {
				return false;
			}
			return true;
		})
	) as Partial<LenderPortfolioSearchState>;
}

export function clearPortfolioDetailSelection(
	search: LenderPortfolioSearchState
): LenderPortfolioSearchState {
	return {
		...search,
		detailId: undefined,
		detailType: undefined,
	};
}

export function buildPortfolioDetailSearch(
	search: LenderPortfolioSearchState,
	args: { detailId: string; detailType: PortfolioDetailType }
): LenderPortfolioSearchState {
	return {
		...search,
		detailId: args.detailId,
		detailType: args.detailType,
	};
}

export function applyPortfolioPositionSearch(
	rows: readonly PortfolioPositionRow[],
	search: LenderPortfolioSearchState
) {
	const query = search.positionQuery?.toLowerCase();
	const filtered = rows.filter((row) => {
		const matchesStatus =
			!search.positionStatus || row.mortgageStatus === search.positionStatus;
		const matchesQuery =
			!query ||
			buildSearchHaystack([
				row.mortgageStatus,
				row.propertyLabel,
				row.renewalIntentStatus,
				row.renewalTimingLabel,
			]).includes(query);

		return matchesStatus && matchesQuery;
	});

	return [...filtered].sort((left, right) => {
		switch (search.positionSort) {
			case "payment-highest":
				return right.paymentAmount - left.paymentAmount;
			case "payment-lowest":
				return left.paymentAmount - right.paymentAmount;
			case "property-a-z":
				return left.propertyLabel.localeCompare(right.propertyLabel);
			case "next-payment-latest":
				return compareNullableDate(
					left.nextPaymentDate,
					right.nextPaymentDate,
					"desc"
				);
			default:
				return compareNullableDate(
					left.nextPaymentDate,
					right.nextPaymentDate,
					"asc"
				);
		}
	});
}

export function applyPortfolioPaymentSearch(
	rows: readonly PortfolioPaymentRow[],
	search: LenderPortfolioSearchState
) {
	const query = search.paymentQuery?.toLowerCase();
	const filtered = rows.filter((row) => {
		const matchesStatus =
			!search.paymentStatus || row.rowStatus === search.paymentStatus;
		const matchesDueDate = matchesDateRange(
			row.dueDate,
			search.paymentDateFrom,
			search.paymentDateTo
		);
		const matchesQuery =
			!query ||
			buildSearchHaystack([
				row.latestCollectionStatus,
				row.latestTransferStatus,
				row.obligationStatus,
				row.propertyLabel,
				row.rowStatus,
				row.type,
				String(row.paymentNumber),
			]).includes(query);

		return matchesStatus && matchesDueDate && matchesQuery;
	});

	return [...filtered].sort((left, right) => {
		switch (search.paymentSort) {
			case "amount-asc":
				return left.lenderShareAmount - right.lenderShareAmount;
			case "amount-desc":
				return right.lenderShareAmount - left.lenderShareAmount;
			case "due-asc":
				return left.dueDate.localeCompare(right.dueDate);
			case "status-a-z":
				return left.rowStatus.localeCompare(right.rowStatus);
			default:
				return right.dueDate.localeCompare(left.dueDate);
		}
	});
}
