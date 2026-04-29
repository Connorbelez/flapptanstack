import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type {
	PortfolioDataCompleteness,
	PortfolioTaxExport,
} from "./contracts";
import {
	buildLivePortfolioSnapshot,
	buildTaxPeriodLabel,
	loadPortfolioSnapshot,
} from "./snapshots";

interface PortfolioTaxExportRow {
	cumulativeIncome: number;
	dataCompleteness: PortfolioDataCompleteness;
	endingBalanceUnits: number;
	endingEstimatedValue: number;
	mortgageId: string;
	mortgageStatus: string;
	periodIncome: number;
	periodLabel: string;
	snapshotDate: string;
}

function csvEscape(value: number | string) {
	const stringValue = String(value);
	if (
		stringValue.includes(",") ||
		stringValue.includes('"') ||
		stringValue.includes("\n")
	) {
		return `"${stringValue.replaceAll('"', '""')}"`;
	}
	return stringValue;
}

function buildPortfolioTaxExportCsv(rows: PortfolioTaxExportRow[]) {
	const headers = [
		"period_label",
		"snapshot_date",
		"mortgage_id",
		"mortgage_status",
		"period_income",
		"cumulative_income",
		"ending_balance_units",
		"ending_estimated_value",
		"data_completeness",
	];

	const lines = [headers.join(",")];
	for (const row of rows) {
		lines.push(
			[
				row.periodLabel,
				row.snapshotDate,
				row.mortgageId,
				row.mortgageStatus,
				row.periodIncome,
				row.cumulativeIncome,
				row.endingBalanceUnits,
				row.endingEstimatedValue,
				row.dataCompleteness,
			]
				.map(csvEscape)
				.join(",")
		);
	}
	return lines.join("\n");
}

function normalizeYear(year: number | undefined, today: string) {
	const currentYear = Number(today.slice(0, 4));
	if (year === undefined) {
		return currentYear;
	}
	if (!Number.isInteger(year) || year < 2000 || year > currentYear) {
		throw new ConvexError(
			`year must be an integer between 2000 and ${currentYear}`
		);
	}
	return year;
}

function toExportRows(args: {
	dataCompleteness: PortfolioDataCompleteness;
	periodLabel: string;
	snapshot: Awaited<ReturnType<typeof buildLivePortfolioSnapshot>>;
	snapshotDate: string;
}) {
	return args.snapshot.positions
		.filter((position) => position.periodIncome > 0)
		.sort((left, right) => left.mortgageId.localeCompare(right.mortgageId))
		.map((position) => ({
			cumulativeIncome: position.cumulativeIncome,
			dataCompleteness: args.dataCompleteness,
			endingBalanceUnits: position.balance,
			endingEstimatedValue: position.investedValue,
			mortgageId: position.mortgageId,
			mortgageStatus: position.mortgageStatus,
			periodIncome: position.periodIncome,
			periodLabel: args.periodLabel,
			snapshotDate: args.snapshotDate,
		}));
}

export async function buildPortfolioTaxExport(
	ctx: { db: QueryCtx["db"] },
	args: {
		lenderAuthId: string;
		lenderId: Id<"lenders">;
		today: string;
		year?: number;
	}
): Promise<PortfolioTaxExport> {
	const targetYear = normalizeYear(args.year, args.today);
	const completedPeriod = targetYear < Number(args.today.slice(0, 4));
	const completedSnapshotDate = `${targetYear}-12-31`;
	const snapshotDate = completedPeriod ? completedSnapshotDate : args.today;

	const snapshot = completedPeriod
		? await loadPortfolioSnapshot(ctx, {
				lenderId: args.lenderId,
				snapshotDate: completedSnapshotDate,
				snapshotType: "year_end",
			})
		: null;
	const dataCompleteness: PortfolioDataCompleteness = snapshot
		? "snapshot_complete"
		: "live_fallback";
	const effectiveSnapshot =
		snapshot ??
		(await buildLivePortfolioSnapshot(ctx, {
			lenderAuthId: args.lenderAuthId,
			snapshotDate,
			snapshotType: "year_end",
		}));
	const periodLabel = buildTaxPeriodLabel(targetYear, completedPeriod);
	const rows = toExportRows({
		dataCompleteness,
		periodLabel,
		snapshot: effectiveSnapshot,
		snapshotDate,
	});
	if (rows.length === 0) {
		return {
			dataCompleteness,
			generatedAt: Date.now(),
			isAvailable: false,
			periodLabel,
			unavailableReason: `No lender interest income is available for ${periodLabel}.`,
		};
	}

	const filename = completedPeriod
		? `lender-portfolio-tax-export-${targetYear}.csv`
		: `lender-portfolio-tax-export-${targetYear}-ytd.csv`;

	return {
		csv: buildPortfolioTaxExportCsv(rows),
		dataCompleteness,
		filename,
		generatedAt: Date.now(),
		isAvailable: true,
		periodLabel,
	};
}
