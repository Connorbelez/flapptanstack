export function formatPortfolioCurrency(value: number | null | undefined) {
	if (typeof value !== "number") {
		return "Unavailable";
	}

	return new Intl.NumberFormat("en-CA", {
		currency: "CAD",
		maximumFractionDigits: 0,
		style: "currency",
	}).format(value);
}

export function formatPortfolioCompactCurrency(
	value: number | null | undefined
) {
	if (typeof value !== "number") {
		return "Unavailable";
	}

	return new Intl.NumberFormat("en-CA", {
		currency: "CAD",
		maximumFractionDigits: 1,
		notation: "compact",
		style: "currency",
	}).format(value);
}

const CALENDAR_YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidCalendarYmd(value: string) {
	const match = CALENDAR_YMD.exec(value);
	if (!match) {
		return false;
	}

	const [, year, month, day] = match;
	const y = Number(year);
	const m = Number(month);
	const d = Number(day);
	const parsed = new Date(y, m - 1, d);
	return (
		parsed.getFullYear() === y &&
		parsed.getMonth() === m - 1 &&
		parsed.getDate() === d
	);
}

export function formatPortfolioDate(value: string | null | undefined) {
	if (!value) {
		return "Unavailable";
	}

	const dateKey = value.slice(0, 10);
	if (!isValidCalendarYmd(dateKey)) {
		return value;
	}

	const parsed = new Date(
		Number(dateKey.slice(0, 4)),
		Number(dateKey.slice(5, 7)) - 1,
		Number(dateKey.slice(8, 10))
	);

	return parsed.toLocaleDateString("en-CA", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function formatPortfolioEnumLabel(value: string | null | undefined) {
	if (!value) {
		return "Unavailable";
	}

	return value
		.split("_")
		.map((segment) =>
			segment.length > 0
				? `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`
				: segment
		)
		.join(" ");
}

export function formatPortfolioFractions(value: number | null | undefined) {
	if (typeof value !== "number") {
		return "Unavailable";
	}

	return `${value.toLocaleString("en-CA")} fractions`;
}

export function formatPortfolioPercent(value: number | null | undefined) {
	if (typeof value !== "number") {
		return "Unavailable";
	}

	return `${value.toLocaleString("en-CA", {
		maximumFractionDigits: 1,
	})}%`;
}

export function formatPortfolioRate(value: number | null | undefined) {
	if (typeof value !== "number") {
		return "Unavailable";
	}

	return `${value.toLocaleString("en-CA", {
		maximumFractionDigits: 2,
	})}%`;
}

export function formatPortfolioDateTime(value: number | null | undefined) {
	if (typeof value !== "number") {
		return "Unavailable";
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return "Unavailable";
	}

	return parsed.toLocaleString("en-CA", {
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		month: "short",
		year: "numeric",
	});
}

export function formatPortfolioDataCompleteness(
	value: string | null | undefined
) {
	return formatPortfolioEnumLabel(value);
}
