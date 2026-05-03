import { describe, expect, it, vi } from "vitest";
import { FAIRLEND_ADMIN, LENDER } from "../../../src/test/auth/identities";
import {
	createHarness,
	createPortfolioFixture,
} from "../../../src/test/convex/portfolio-fixtures";
import { api, internal } from "../../_generated/api";

describe("portfolio snapshots", () => {
	it("materializes monthly and year-end snapshots idempotently for the same business date", async () => {
		const t = createHarness();
		const fixture = await createPortfolioFixture(t);
		const admin = t.withIdentity(FAIRLEND_ADMIN);

		const firstMonthly = await admin.mutation(
			internal.portfolio.snapshots.materializePortfolioSnapshot,
			{
				lenderAuthId: LENDER.subject,
				lenderId: fixture.lenderId,
				snapshotDate: "2026-12-31",
				snapshotType: "monthly",
			}
		);
		const secondMonthly = await admin.mutation(
			internal.portfolio.snapshots.materializePortfolioSnapshot,
			{
				lenderAuthId: LENDER.subject,
				lenderId: fixture.lenderId,
				snapshotDate: "2026-12-31",
				snapshotType: "monthly",
			}
		);
		const yearEnd = await admin.mutation(
			internal.portfolio.snapshots.materializePortfolioSnapshot,
			{
				lenderAuthId: LENDER.subject,
				lenderId: fixture.lenderId,
				snapshotDate: "2026-12-31",
				snapshotType: "year_end",
			}
		);

		expect(firstMonthly.created).toBe(true);
		expect(secondMonthly.created).toBe(false);
		expect(yearEnd.created).toBe(true);

		const snapshots = await t.run(
			async (ctx) => await ctx.db.query("portfolioSnapshots").collect()
		);
		expect(snapshots).toHaveLength(2);
		expect(snapshots.map((snapshot) => snapshot.snapshotType).sort()).toEqual([
			"monthly",
			"year_end",
		]);
	});

	it("creates zero-position snapshots for lenders without holdings", async () => {
		const t = createHarness();
		const fixture = await createPortfolioFixture(t, { issueAmount: 0 });
		const admin = t.withIdentity(FAIRLEND_ADMIN);

		await admin.mutation(
			internal.portfolio.snapshots.materializePortfolioSnapshot,
			{
				lenderAuthId: LENDER.subject,
				lenderId: fixture.lenderId,
				snapshotDate: "2026-12-31",
				snapshotType: "year_end",
			}
		);

		const snapshot = await t.run(
			async (ctx) =>
				await ctx.db
					.query("portfolioSnapshots")
					.withIndex("by_lender_snapshot", (query) =>
						query
							.eq("lenderId", fixture.lenderId)
							.eq("snapshotType", "year_end")
							.eq("snapshotDate", "2026-12-31")
					)
					.unique()
		);

		expect(snapshot).not.toBeNull();
		expect(snapshot?.totalPositions).toBe(0);
		expect(snapshot?.totalFractions).toBe(0);
		expect(snapshot?.periodIncome).toBe(0);
		expect(snapshot?.projectedAggregateEarnings).toBe(0);
		expect(snapshot?.positions).toEqual([]);
	});

	it("preserves exited-position income in year-end snapshots even when ending balances are zero", async () => {
		const t = createHarness();
		const fixture = await createPortfolioFixture(t, {
			exitDate: "2026-07-01",
		});
		const admin = t.withIdentity(FAIRLEND_ADMIN);

		await admin.mutation(
			internal.portfolio.snapshots.materializePortfolioSnapshot,
			{
				lenderAuthId: LENDER.subject,
				lenderId: fixture.lenderId,
				snapshotDate: "2026-12-31",
				snapshotType: "year_end",
			}
		);

		const snapshot = await t.run(
			async (ctx) =>
				await ctx.db
					.query("portfolioSnapshots")
					.withIndex("by_lender_snapshot", (query) =>
						query
							.eq("lenderId", fixture.lenderId)
							.eq("snapshotType", "year_end")
							.eq("snapshotDate", "2026-12-31")
					)
					.unique()
		);

		expect(snapshot?.totalPositions).toBe(0);
		expect(snapshot?.periodIncome ?? 0).toBeGreaterThan(0);
		expect(snapshot?.projectedAggregateEarnings ?? 0).toBeGreaterThan(0);
		expect(snapshot?.positions).toHaveLength(1);
		expect(snapshot?.positions[0]?.balance).toBe(0);
		expect(snapshot?.positions[0]?.periodIncome ?? 0).toBeGreaterThan(0);
		expect(snapshot?.positions[0]?.projectedAggregateEarnings ?? 0).toBe(
			snapshot?.positions[0]?.cumulativeIncome
		);
	});

	it("returns snapshot-backed completed months and live fallback for the current month", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-21T12:00:00.000Z"));

		try {
			const t = createHarness();
			const fixture = await createPortfolioFixture(t);
			const admin = t.withIdentity(FAIRLEND_ADMIN);
			const lender = t.withIdentity(LENDER);

			await admin.mutation(
				internal.portfolio.snapshots.materializePortfolioSnapshot,
				{
					lenderAuthId: LENDER.subject,
					lenderId: fixture.lenderId,
					snapshotDate: "2026-03-31",
					snapshotType: "monthly",
				}
			);

			const history = await lender.query(
				api.portfolio.queries.getLenderPortfolioHistoricalSeries,
				{
					months: 3,
					portalId: fixture.portalId,
				}
			);

			expect(history.points).toHaveLength(3);
			expect(history.points[0]?.periodEndDate).toBe("2026-02-28");
			expect(history.points[0]?.dataCompleteness).toBe("live_fallback");
			expect(history.points[1]?.periodEndDate).toBe("2026-03-31");
			expect(history.points[1]?.dataCompleteness).toBe("snapshot_complete");
			expect(
				history.points[1]?.projectedAggregateEarnings ?? 0
			).toBeGreaterThan(history.points[1]?.cumulativeIncome ?? 0);
			expect(history.points[2]?.periodEndDate).toBe("2026-04-21");
			expect(history.points[2]?.dataCompleteness).toBe("live_fallback");
			expect(
				history.points[2]?.projectedAggregateEarnings ?? 0
			).toBeGreaterThan(history.points[2]?.cumulativeIncome ?? 0);
			expect(history.snapshotBackedThrough).toBe("2026-03-31");
			expect(history.liveFallbackPeriodLabel).toBe("Apr 2026");
		} finally {
			vi.useRealTimers();
		}
	});

	it("supports a single-month history request without trying to backfill prior months", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-21T12:00:00.000Z"));

		try {
			const t = createHarness();
			const fixture = await createPortfolioFixture(t);
			const lender = t.withIdentity(LENDER);

			const history = await lender.query(
				api.portfolio.queries.getLenderPortfolioHistoricalSeries,
				{
					months: 1,
					portalId: fixture.portalId,
				}
			);

			expect(history.points).toHaveLength(1);
			expect(history.points[0]?.periodEndDate).toBe("2026-04-21");
			expect(history.points[0]?.dataCompleteness).toBe("live_fallback");
			expect(
				history.points[0]?.projectedAggregateEarnings ?? 0
			).toBeGreaterThan(history.points[0]?.cumulativeIncome ?? 0);
			expect(history.snapshotBackedThrough).toBeUndefined();
			expect(history.liveFallbackPeriodLabel).toBe("Apr 2026");
		} finally {
			vi.useRealTimers();
		}
	});
});
