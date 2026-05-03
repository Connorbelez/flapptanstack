const DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
	day: "numeric",
	month: "short",
	year: "numeric",
});

const CURRENCY_FORMAT = new Intl.NumberFormat("en-CA", {
	currency: "CAD",
	maximumFractionDigits: 0,
	style: "currency",
});
const TRAILING_ZERO_PERCENT_PATTERN = /\.00$/u;

export function formatDate(value: number | null | undefined): string {
	return value ? DATE_FORMAT.format(new Date(value)) : "Not set";
}

export function formatCurrency(value: number | null | undefined): string {
	return typeof value === "number" ? CURRENCY_FORMAT.format(value) : "Not set";
}

export function formatPercent(value: number | null | undefined): string {
	return typeof value === "number"
		? `${value.toFixed(2).replace(TRAILING_ZERO_PERCENT_PATTERN, "")}%`
		: "Not set";
}

export function formatEnumLabel(value: string | null | undefined): string {
	if (!value) {
		return "Not set";
	}
	return value
		.replace(/[._-]+/gu, " ")
		.replace(/\b\w/gu, (match) => match.toUpperCase());
}

export function shortDealId(value: string): string {
	return value.length <= 8 ? value : value.slice(-8);
}
