import { describe, expect, it, vi } from "vitest";
import { FAIRLEND_ADMIN, LENDER } from "../../../src/test/auth/identities";
import {
	createHarness,
	createPortfolioFixture,
} from "../../../src/test/convex/portfolio-fixtures";
import { api, internal } from "../../_generated/api";

describe("portfolio tax export", () => {
	it("returns a snapshot-backed export contract when a year-end snapshot exists", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2027-01-02T12:00:00.000Z"));

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
					snapshotDate: "2026-12-31",
					snapshotType: "year_end",
				}
			);

			const first = await lender.query(
				api.portfolio.queries.getLenderPortfolioTaxExport,
				{
					portalId: fixture.portalId,
					year: 2026,
				}
			);
			const second = await lender.query(
				api.portfolio.queries.getLenderPortfolioTaxExport,
				{
					portalId: fixture.portalId,
					year: 2026,
				}
			);

			expect(first.dataCompleteness).toBe("snapshot_complete");
			expect(first.isAvailable).toBe(true);
			expect(first.filename).toBe("lender-portfolio-tax-export-2026.csv");
			expect(first.periodLabel).toBe("2026 tax year");
			expect(first.csv).toBeDefined();
			expect(first.csv).toContain(
				"period_label,snapshot_date,mortgage_id,mortgage_status,period_income,cumulative_income,projected_aggregate_earnings,ending_balance_units,ending_estimated_value,data_completeness"
			);
			expect(first.csv).toContain("snapshot_complete");
			expect(first.csv).toContain("2026 tax year,2026-12-31");
			expect(second.csv).toBe(first.csv);
		} finally {
			vi.useRealTimers();
		}
	});

	it("returns a live fallback export contract for the current year before a completed snapshot exists", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-21T12:00:00.000Z"));

		try {
			const t = createHarness();
			const fixture = await createPortfolioFixture(t);
			const lender = t.withIdentity(LENDER);

			const result = await lender.query(
				api.portfolio.queries.getLenderPortfolioTaxExport,
				{
					portalId: fixture.portalId,
					year: 2026,
				}
			);

			expect(result.dataCompleteness).toBe("live_fallback");
			expect(result.isAvailable).toBe(true);
			expect(result.filename).toBe("lender-portfolio-tax-export-2026-ytd.csv");
			expect(result.periodLabel).toBe("2026 year-to-date");
			expect(result.csv).toContain("2026 year-to-date,2026-04-21");
		} finally {
			vi.useRealTimers();
		}
	});

	it("returns a clear unavailable reason when no lender income exists for the requested period", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-21T12:00:00.000Z"));

		try {
			const t = createHarness();
			const fixture = await createPortfolioFixture(t, { issueAmount: 0 });
			const lender = t.withIdentity(LENDER);

			const result = await lender.query(
				api.portfolio.queries.getLenderPortfolioTaxExport,
				{
					portalId: fixture.portalId,
					year: 2026,
				}
			);

			expect(result.isAvailable).toBe(false);
			expect(result.csv).toBeUndefined();
			expect(result.filename).toBeUndefined();
			expect(result.dataCompleteness).toBe("live_fallback");
			expect(result.unavailableReason).toContain(
				"No lender interest income is available"
			);
		} finally {
			vi.useRealTimers();
		}
	});
});
