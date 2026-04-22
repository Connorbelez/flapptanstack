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

export function formatPortfolioDate(value: string | null | undefined) {
	if (!value) {
		return "Unavailable";
	}

	const parsed = new Date(`${value}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) {
		return value;
	}

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
