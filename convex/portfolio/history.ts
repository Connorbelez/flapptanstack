import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type {
	PortfolioDataCompleteness,
	PortfolioHistoricalPoint,
	PortfolioHistoricalSeries,
} from "./contracts";
import {
	buildLivePortfolioSnapshot,
	listRecentCompletedMonthEndDates,
	loadPortfolioSnapshot,
	monthLabelFor,
	normalizeMonths,
} from "./snapshots";

function determineSeriesCompleteness(
	points: PortfolioHistoricalPoint[]
): PortfolioDataCompleteness {
	return points.some((point) => point.dataCompleteness === "live_fallback")
		? "live_fallback"
		: "snapshot_complete";
}

function toHistoricalPoint(args: {
	dataCompleteness: PortfolioDataCompleteness;
	periodEndDate: string;
	periodSource: "live_fallback" | "monthly_snapshot";
	snapshot: Awaited<ReturnType<typeof buildLivePortfolioSnapshot>>;
}): PortfolioHistoricalPoint {
	return {
		cumulativeIncome: args.snapshot.cumulativeIncome,
		dataCompleteness: args.dataCompleteness,
		periodEndDate: args.periodEndDate,
		periodIncome: args.snapshot.periodIncome,
		periodLabel: monthLabelFor(args.periodEndDate),
		periodSource: args.periodSource,
		totalFractions: args.snapshot.totalFractions,
		totalInvestedValue: args.snapshot.totalInvestedValue,
		totalPositions: args.snapshot.totalPositions,
	};
}

export async function buildPortfolioHistoricalSeries(
	ctx: { db: QueryCtx["db"] },
	args: {
		lenderAuthId: string;
		lenderId: Id<"lenders">;
		months?: number;
		today: string;
	}
): Promise<PortfolioHistoricalSeries> {
	const completedMonthEnds = listRecentCompletedMonthEndDates(
		args.today,
		Math.max(normalizeMonths(args.months) - 1, 0)
	);
	const points: PortfolioHistoricalPoint[] = [];

	for (const snapshotDate of completedMonthEnds) {
		const snapshot = await loadPortfolioSnapshot(ctx, {
			lenderId: args.lenderId,
			snapshotDate,
			snapshotType: "monthly",
		});
		if (snapshot) {
			points.push(
				toHistoricalPoint({
					dataCompleteness: "snapshot_complete",
					periodEndDate: snapshotDate,
					periodSource: "monthly_snapshot",
					snapshot,
				})
			);
			continue;
		}

		const liveFallback = await buildLivePortfolioSnapshot(ctx, {
			lenderAuthId: args.lenderAuthId,
			snapshotDate,
			snapshotType: "monthly",
		});
		points.push(
			toHistoricalPoint({
				dataCompleteness: "live_fallback",
				periodEndDate: snapshotDate,
				periodSource: "live_fallback",
				snapshot: liveFallback,
			})
		);
	}

	const currentPoint = await buildLivePortfolioSnapshot(ctx, {
		lenderAuthId: args.lenderAuthId,
		snapshotDate: args.today,
		snapshotType: "monthly",
	});
	points.push(
		toHistoricalPoint({
			dataCompleteness: "live_fallback",
			periodEndDate: args.today,
			periodSource: "live_fallback",
			snapshot: currentPoint,
		})
	);

	let snapshotBackedThrough: string | undefined;
	for (const point of points) {
		if (point.dataCompleteness === "snapshot_complete") {
			snapshotBackedThrough = point.periodEndDate;
		}
	}

	const dataCompleteness = determineSeriesCompleteness(points);
	return {
		asOfDate: args.today,
		dataCompleteness,
		generatedAt: Date.now(),
		liveFallbackPeriodLabel:
			dataCompleteness === "live_fallback"
				? points.at(-1)?.periodLabel
				: undefined,
		points,
		snapshotBackedThrough,
	};
}
