/**
 * UI helpers for mortgage ownership “fractions”.
 *
 * Ledger stores balances in ownership units per mortgage (`TOTAL_SUPPLY = 10_000`,
 * `MIN_FRACTION = 1_000` = 10% minimum) — see `convex/ledger/constants.ts`.
 * One UI decile = 1,000 ledger units = 10% of principal.
 */

export const LEDGER_UNITS_PER_DECILE = 1000;

export function ledgerUnitsToDecilesExact(ledgerUnits: number): number {
	return ledgerUnits / LEDGER_UNITS_PER_DECILE;
}

/** Whole 10% slices available for purchase (floor of ledger balance). */
export function wholeDecilesFromLedger(ledgerUnits: number): number {
	return Math.floor(ledgerUnits / LEDGER_UNITS_PER_DECILE);
}

export function formatDecileCountForDisplay(deciles: number): string {
	const rounded = Math.round(deciles * 10) / 10;
	if (Number.isInteger(rounded)) {
		return rounded.toLocaleString("en-CA");
	}
	return rounded.toLocaleString("en-CA", {
		maximumFractionDigits: 1,
		minimumFractionDigits: 0,
	});
}

export function formatDecileAvailability(
	availableLedger: number,
	totalLedger: number
): string {
	if (
		!(Number.isFinite(availableLedger) && Number.isFinite(totalLedger)) ||
		totalLedger <= 0
	) {
		return "Unavailable";
	}
	const availableDeciles = ledgerUnitsToDecilesExact(availableLedger);
	const totalDeciles = ledgerUnitsToDecilesExact(totalLedger);
	return `${formatDecileCountForDisplay(availableDeciles)} of ${formatDecileCountForDisplay(totalDeciles)} available`;
}

/** Compact line for listing cards (ledger units in, human deciles out). */
export function formatDecilesCardSummary(
	availableLedger: number,
	totalLedger: number
): string | undefined {
	if (!(Number.isFinite(availableLedger) && Number.isFinite(totalLedger))) {
		return undefined;
	}
	if (totalLedger <= 0) {
		return undefined;
	}
	const a = formatDecileCountForDisplay(
		ledgerUnitsToDecilesExact(availableLedger)
	);
	const t = formatDecileCountForDisplay(ledgerUnitsToDecilesExact(totalLedger));
	return `${a} / ${t} fractions (10% each)`;
}
