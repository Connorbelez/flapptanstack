import { type Infer, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
	calculateAccrualForPeriods,
	calculatePeriodAccrual,
	dayAfter,
	dayBefore,
	daysBetween,
} from "../accrual/interestMath";
import { getOwnershipPeriods } from "../accrual/ownershipPeriods";
import { convex } from "../fluent";
import { TOTAL_SUPPLY } from "../ledger/constants";
import {
	businessDateToUnixMs,
	unixMsToBusinessDate,
} from "../lib/businessDates";
import { mortgageNominalAnnualRateToDecimal } from "../mortgages/nominalAnnualRate";

const snapshotTypeValidator = v.union(
	v.literal("monthly"),
	v.literal("year_end")
);

const snapshotLenderValidator = v.object({
	lenderAuthId: v.string(),
	lenderId: v.id("lenders"),
});
type SnapshotLender = Infer<typeof snapshotLenderValidator>;

const materializePortfolioSnapshotResultValidator = v.object({
	created: v.boolean(),
	snapshotId: v.id("portfolioSnapshots"),
});

const materializeCompletedPortfolioSnapshotsResultValidator = v.object({
	created: v.number(),
	skipped: v.number(),
	snapshotDates: v.array(v.string()),
});

type SnapshotType = Infer<typeof snapshotTypeValidator>;
type SnapshotPositionRow = Doc<"portfolioSnapshots">["positions"][number];
type SnapshotDoc = Omit<Doc<"portfolioSnapshots">, "_creationTime" | "_id">;

interface SnapshotDbCtx {
	db: QueryCtx["db"];
}

const MONTH_LABELS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

function roundCurrency(value: number) {
	return Math.round(value * 100) / 100;
}

function parseBusinessDate(date: string) {
	return new Date(`${date}T00:00:00.000Z`);
}

function startOfMonthBusinessDateFor(date: string) {
	const parsed = parseBusinessDate(date);
	return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1))
		.toISOString()
		.slice(0, 10);
}

function endOfMonthBusinessDateFor(date: string) {
	const parsed = parseBusinessDate(date);
	return new Date(
		Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0)
	)
		.toISOString()
		.slice(0, 10);
}

function startOfYearBusinessDateFor(date: string) {
	const parsed = parseBusinessDate(date);
	return new Date(Date.UTC(parsed.getUTCFullYear(), 0, 1))
		.toISOString()
		.slice(0, 10);
}

function isMonthEndBusinessDate(date: string) {
	return endOfMonthBusinessDateFor(date) === date;
}

function isYearEndBusinessDate(date: string) {
	return date.endsWith("-12-31");
}

function normalizeMonths(months: number | undefined) {
	if (months === undefined) {
		return 12;
	}
	if (!Number.isInteger(months) || months < 1 || months > 24) {
		throw new Error("months must be an integer between 1 and 24");
	}
	return months;
}

function balanceUnitsToFractions(balanceUnits: number) {
	return roundCurrency(balanceUnits / 1000);
}

function calculateEstimatedValue(balanceUnits: number, principal: number) {
	return roundCurrency((balanceUnits / Number(TOTAL_SUPPLY)) * principal);
}

function calculateProjectedAggregateEarnings(args: {
	annualRateDecimal: number;
	balanceUnits: number;
	cumulativeIncome: number;
	maturityDate: string;
	principal: number;
	snapshotDate: string;
}) {
	if (args.balanceUnits <= 0 || args.snapshotDate >= args.maturityDate) {
		return roundCurrency(args.cumulativeIncome);
	}

	const remainingStartDate = dayAfter(args.snapshotDate);
	if (remainingStartDate > args.maturityDate) {
		return roundCurrency(args.cumulativeIncome);
	}

	const projectedRemainingIncome = calculatePeriodAccrual(
		args.annualRateDecimal,
		args.balanceUnits / Number(TOTAL_SUPPLY),
		args.principal,
		daysBetween(remainingStartDate, args.maturityDate)
	);

	return roundCurrency(args.cumulativeIncome + projectedRemainingIncome);
}

function activeBalanceUnitsAtDate(
	periods: Awaited<ReturnType<typeof getOwnershipPeriods>>,
	snapshotDate: string
) {
	const activePeriod = periods.find(
		(period) =>
			period.fromDate <= snapshotDate &&
			(period.toDate === null || period.toDate >= snapshotDate)
	);
	if (!activePeriod) {
		return 0;
	}
	return Math.round(activePeriod.fraction * Number(TOTAL_SUPPLY));
}

function buildSnapshotPeriodStart(
	snapshotDate: string,
	snapshotType: SnapshotType
) {
	return snapshotType === "monthly"
		? startOfMonthBusinessDateFor(snapshotDate)
		: startOfYearBusinessDateFor(snapshotDate);
}

function firstOwnershipDate(
	periods: Awaited<ReturnType<typeof getOwnershipPeriods>>,
	fallbackDate: string
) {
	return periods[0]?.fromDate ?? fallbackDate;
}

function monthLabelFor(date: string) {
	const parsed = parseBusinessDate(date);
	return `${MONTH_LABELS[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`;
}

export function buildTaxPeriodLabel(year: number, completePeriod: boolean) {
	return completePeriod ? `${year} tax year` : `${year} year-to-date`;
}

export async function loadPortfolioSnapshot(
	ctx: SnapshotDbCtx,
	args: {
		lenderId: Id<"lenders">;
		snapshotDate: string;
		snapshotType: SnapshotType;
	}
) {
	return await ctx.db
		.query("portfolioSnapshots")
		.withIndex("by_lender_snapshot", (query) =>
			query
				.eq("lenderId", args.lenderId)
				.eq("snapshotType", args.snapshotType)
				.eq("snapshotDate", args.snapshotDate)
		)
		.unique();
}

export function listRecentCompletedMonthEndDates(
	asOfDate: string,
	months: number
) {
	if (months <= 0) {
		return [];
	}
	const normalizedMonths = normalizeMonths(months);
	const monthEnds: string[] = [];
	let cursor = dayBefore(startOfMonthBusinessDateFor(asOfDate));

	for (let index = 0; index < normalizedMonths; index += 1) {
		monthEnds.push(cursor);
		cursor = dayBefore(startOfMonthBusinessDateFor(cursor));
	}

	return monthEnds.reverse();
}

async function listSnapshotPositionAccounts(
	ctx: SnapshotDbCtx,
	lenderAuthId: string
) {
	const accounts = await ctx.db
		.query("ledger_accounts")
		.withIndex("by_lender", (query) => query.eq("lenderId", lenderAuthId))
		.collect();

	const deduped = new Map<string, Doc<"ledger_accounts">>();
	for (const account of accounts) {
		if (account.type !== "POSITION" || !account.mortgageId) {
			continue;
		}
		const mortgageKey = String(account.mortgageId);
		if (!deduped.has(mortgageKey)) {
			deduped.set(mortgageKey, account);
		}
	}

	return [...deduped.values()].sort((left, right) =>
		String(left.mortgageId).localeCompare(String(right.mortgageId))
	);
}

async function buildSnapshotPositionRows(
	ctx: SnapshotDbCtx,
	args: {
		lenderAuthId: string;
		snapshotDate: string;
		snapshotType: SnapshotType;
	}
) {
	const periodStartDate = buildSnapshotPeriodStart(
		args.snapshotDate,
		args.snapshotType
	);
	const accounts = await listSnapshotPositionAccounts(ctx, args.lenderAuthId);
	const rows: SnapshotPositionRow[] = [];

	for (const account of accounts) {
		const mortgageId = account.mortgageId as Id<"mortgages">;
		const mortgage = await ctx.db.get(mortgageId);
		if (!mortgage) {
			continue;
		}

		const periods = await getOwnershipPeriods(
			ctx,
			String(mortgageId),
			args.lenderAuthId
		);
		if (periods.length === 0) {
			continue;
		}

		const annualRateDecimal = mortgageNominalAnnualRateToDecimal(
			mortgage.interestRate
		);
		const balance = activeBalanceUnitsAtDate(periods, args.snapshotDate);
		const periodIncome = roundCurrency(
			calculateAccrualForPeriods(
				periods,
				annualRateDecimal,
				mortgage.principal,
				periodStartDate,
				args.snapshotDate
			)
		);
		const cumulativeIncome = roundCurrency(
			calculateAccrualForPeriods(
				periods,
				annualRateDecimal,
				mortgage.principal,
				firstOwnershipDate(periods, periodStartDate),
				args.snapshotDate
			)
		);
		const projectedAggregateEarnings = calculateProjectedAggregateEarnings({
			annualRateDecimal,
			balanceUnits: balance,
			cumulativeIncome,
			maturityDate: mortgage.maturityDate,
			principal: mortgage.principal,
			snapshotDate: args.snapshotDate,
		});

		if (
			balance <= 0 &&
			periodIncome <= 0 &&
			cumulativeIncome <= 0 &&
			projectedAggregateEarnings <= 0
		) {
			continue;
		}

		rows.push({
			accountId: String(account._id),
			balance,
			cumulativeIncome,
			investedValue: calculateEstimatedValue(balance, mortgage.principal),
			mortgageId: String(mortgageId),
			mortgageStatus: mortgage.status,
			periodIncome,
			projectedAggregateEarnings,
		});
	}

	return rows;
}

export async function buildLivePortfolioSnapshot(
	ctx: SnapshotDbCtx,
	args: {
		lenderAuthId: string;
		snapshotDate: string;
		snapshotType: SnapshotType;
	}
): Promise<Omit<SnapshotDoc, "createdAt" | "lenderId">> {
	const positions = await buildSnapshotPositionRows(ctx, args);

	return {
		snapshotDate: args.snapshotDate,
		snapshotType: args.snapshotType,
		totalPositions: positions.filter((position) => position.balance > 0).length,
		totalFractions: roundCurrency(
			positions.reduce(
				(sum, position) => sum + balanceUnitsToFractions(position.balance),
				0
			)
		),
		totalInvestedValue: roundCurrency(
			positions.reduce((sum, position) => sum + position.investedValue, 0)
		),
		periodIncome: roundCurrency(
			positions.reduce((sum, position) => sum + position.periodIncome, 0)
		),
		cumulativeIncome: roundCurrency(
			positions.reduce((sum, position) => sum + position.cumulativeIncome, 0)
		),
		projectedAggregateEarnings: roundCurrency(
			positions.reduce(
				(sum, position) => sum + position.projectedAggregateEarnings,
				0
			)
		),
		positions,
	};
}

export const listSnapshotLenders = convex
	.query()
	.returns(v.array(snapshotLenderValidator))
	.handler(async (ctx) => {
		const lenders = await ctx.db
			.query("lenders")
			.withIndex("by_status", (query) => query.eq("status", "active"))
			.collect();

		const snapshotLenders: SnapshotLender[] = [];
		for (const lender of lenders) {
			const user = await ctx.db.get(lender.userId);
			if (!user?.authId) {
				continue;
			}
			snapshotLenders.push({
				lenderAuthId: user.authId,
				lenderId: lender._id,
			});
		}

		return snapshotLenders.sort((left, right) =>
			String(left.lenderId).localeCompare(String(right.lenderId))
		);
	})
	.internal();

export const materializePortfolioSnapshot = convex
	.mutation()
	.input({
		lenderAuthId: v.string(),
		lenderId: v.id("lenders"),
		snapshotDate: v.string(),
		snapshotType: snapshotTypeValidator,
	})
	.returns(materializePortfolioSnapshotResultValidator)
	.handler(async (ctx, args) => {
		businessDateToUnixMs(args.snapshotDate);

		const existing = await loadPortfolioSnapshot(ctx, {
			lenderId: args.lenderId,
			snapshotDate: args.snapshotDate,
			snapshotType: args.snapshotType,
		});
		if (existing) {
			return { created: false, snapshotId: existing._id };
		}

		const snapshot = await buildLivePortfolioSnapshot(ctx, args);
		const snapshotId = await ctx.db.insert("portfolioSnapshots", {
			...snapshot,
			createdAt: Date.now(),
			lenderId: args.lenderId,
		});
		return { created: true, snapshotId };
	})
	.internal();

export const materializeCompletedPortfolioSnapshots = convex
	.action()
	.input({
		asOf: v.optional(v.number()),
	})
	.returns(materializeCompletedPortfolioSnapshotsResultValidator)
	.handler(async (ctx, args) => {
		const asOf = args.asOf ?? Date.now();
		const businessDate = unixMsToBusinessDate(asOf);
		const completedDate = dayBefore(businessDate);
		const snapshotTargets: Array<{
			snapshotDate: string;
			snapshotType: SnapshotType;
		}> = [];

		if (isMonthEndBusinessDate(completedDate)) {
			snapshotTargets.push({
				snapshotDate: completedDate,
				snapshotType: "monthly",
			});
		}
		if (isYearEndBusinessDate(completedDate)) {
			snapshotTargets.push({
				snapshotDate: completedDate,
				snapshotType: "year_end",
			});
		}

		if (snapshotTargets.length === 0) {
			return { created: 0, skipped: 0, snapshotDates: [] };
		}

		const lenders = await ctx.runQuery(
			internal.portfolio.snapshots.listSnapshotLenders,
			{}
		);
		let created = 0;
		let skipped = 0;

		for (const target of snapshotTargets) {
			for (const lender of lenders) {
				const result = await ctx.runMutation(
					internal.portfolio.snapshots.materializePortfolioSnapshot,
					{
						...lender,
						...target,
					}
				);
				if (result.created) {
					created += 1;
					continue;
				}
				skipped += 1;
			}
		}

		return {
			created,
			skipped,
			snapshotDates: snapshotTargets.map((target) => target.snapshotDate),
		};
	})
	.internal();

export { endOfMonthBusinessDateFor, monthLabelFor, normalizeMonths };
