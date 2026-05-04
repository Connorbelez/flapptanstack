/** Mirrors `TOTAL_SUPPLY` in convex/ledger/constants.ts — units per mortgage. */
export const MIC_MORTGAGE_UNIT_SUPPLY = 10_000;

export function formatMicOwnershipSummary(positionUnits: number): string {
	const pct = (positionUnits / MIC_MORTGAGE_UNIT_SUPPLY) * 100;
	return `${positionUnits.toLocaleString("en-CA")} / ${MIC_MORTGAGE_UNIT_SUPPLY.toLocaleString("en-CA")} · ${pct.toFixed(2)}%`;
}
