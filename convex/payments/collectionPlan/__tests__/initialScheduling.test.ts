/**
 * Integration tests for the canonical initial scheduling seam.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createGovernedTestConvex,
	seedBorrowerProfile,
	seedMortgage,
	seedObligation,
	seedPlanEntry,
} from "../../../../src/test/convex/payments/helpers";
import { internal } from "../../../_generated/api";

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe("scheduleInitialEntries", () => {
	it("schedules upcoming collections on the obligation due date", async () => {
		const t = createGovernedTestConvex();
		const now = Date.parse("2026-04-28T00:00:00.000Z");
		vi.setSystemTime(now);

		const borrowerId = await seedBorrowerProfile(t);
		const mortgageId = await seedMortgage(t);
		const dueDate = now + 3 * 86_400_000;
		const obligationId = await seedObligation(t, mortgageId, borrowerId, {
			status: "upcoming",
		});
		await t.run(async (ctx) => {
			await ctx.db.patch(obligationId, {
				dueDate,
				gracePeriodEnd: dueDate + 5 * 86_400_000,
			});
		});

		const result = await t.mutation(
			internal.payments.collectionPlan.mutations.scheduleInitialEntries,
			{
				delayDays: 5,
				mortgageId,
				nowMs: now,
			}
		);

		const entry = await t.run(async (ctx) => {
			const [entryId] = result.createdPlanEntryIds;
			return entryId ? await ctx.db.get(entryId) : null;
		});

		expect(result.created).toBe(1);
		expect(result.obligationIds).toEqual([obligationId]);
		expect(entry?.scheduledDate).toBe(dueDate);
	});

	it("reuses an already covered non-planned plan entry", async () => {
		const t = createGovernedTestConvex();
		const now = Date.now();
		vi.setSystemTime(now);

		const borrowerId = await seedBorrowerProfile(t);
		const mortgageId = await seedMortgage(t);
		const obligationId = await seedObligation(t, mortgageId, borrowerId, {
			status: "upcoming",
			dueDate: now + 4 * 86_400_000,
		});
		const coveredEntryId = await seedPlanEntry(t, {
			obligationIds: [obligationId],
			amount: 300_000,
			method: "manual",
			scheduledDate: now + 86_400_000,
			status: "executing",
			source: "default_schedule",
		});

		const result = await t.mutation(
			internal.payments.collectionPlan.mutations.scheduleInitialEntries,
			{
				delayDays: 3,
				mortgageId,
				nowMs: now,
			}
		);

		expect(result.created).toBe(0);
		expect(result.reused).toBe(1);
		expect(result.createdPlanEntryIds).toHaveLength(0);
		expect(result.reusedPlanEntryIds).toEqual([coveredEntryId]);
		expect(result.obligationIds).toEqual([obligationId]);
	});
});
