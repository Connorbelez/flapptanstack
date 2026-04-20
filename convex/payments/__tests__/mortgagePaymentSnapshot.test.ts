import { describe, expect, it, vi } from "vitest";
import {
	deriveMostRecentPaymentSnapshot,
	deriveNextUpcomingPaymentSnapshot,
	loadMortgagePaymentSnapshots,
	pickPreferredExternalCollectionSchedule,
} from "../mortgagePaymentSnapshot";

describe("mortgagePaymentSnapshot", () => {
	it("prefers the latest execution outcome over obligation fallback", () => {
		const snapshot = deriveMostRecentPaymentSnapshot({
			attempts: [
				{
					_id: "attempt_older",
					amount: 2450,
					confirmedAt: Date.parse("2026-04-01T12:00:00.000Z"),
					failedAt: undefined,
					cancelledAt: undefined,
					reversedAt: undefined,
					initiatedAt: Date.parse("2026-04-01T10:00:00.000Z"),
					settledAt: undefined,
					status: "confirmed",
				},
				{
					_id: "attempt_latest",
					amount: 2450,
					confirmedAt: undefined,
					failedAt: Date.parse("2026-04-02T12:00:00.000Z"),
					cancelledAt: undefined,
					reversedAt: undefined,
					initiatedAt: Date.parse("2026-04-02T10:00:00.000Z"),
					settledAt: undefined,
					status: "failed",
				},
			],
			obligations: [
				{
					amount: 2450,
					dueDate: Date.parse("2026-05-01T00:00:00.000Z"),
					status: "upcoming",
				},
			],
			transfersByAttemptId: new Map(),
		});

		expect(snapshot).toEqual({
			amount: 2450,
			date: Date.parse("2026-04-02T12:00:00.000Z"),
			status: "failed",
		});
	});

	it("falls back to a settled obligation when no execution history exists", () => {
		const snapshot = deriveMostRecentPaymentSnapshot({
			attempts: [],
			obligations: [
				{
					amount: 2450,
					dueDate: Date.parse("2026-04-01T00:00:00.000Z"),
					status: "settled",
				},
				{
					amount: 2450,
					dueDate: Date.parse("2026-05-01T00:00:00.000Z"),
					status: "upcoming",
				},
			],
			transfersByAttemptId: new Map(),
		});

		expect(snapshot).toEqual({
			amount: 2450,
			date: Date.parse("2026-04-01T00:00:00.000Z"),
			status: "settled",
		});
	});

	it("uses the best available obligation state when no attempt history exists", () => {
		const snapshot = deriveMostRecentPaymentSnapshot({
			attempts: [],
			obligations: [
				{
					amount: 2450,
					dueDate: Date.parse("2026-05-01T00:00:00.000Z"),
					status: "upcoming",
				},
			],
			transfersByAttemptId: new Map(),
		});

		expect(snapshot).toEqual({
			amount: 2450,
			date: Date.parse("2026-05-01T00:00:00.000Z"),
			status: "processing",
		});
	});

	it("prefers a linked transfer lifecycle when normalizing the most recent status", () => {
		const snapshot = deriveMostRecentPaymentSnapshot({
			attempts: [
				{
					_id: "attempt_1",
					amount: 2450,
					confirmedAt: undefined,
					failedAt: undefined,
					cancelledAt: undefined,
					reversedAt: undefined,
					initiatedAt: Date.parse("2026-04-02T10:00:00.000Z"),
					settledAt: undefined,
					status: "initiated",
				},
			],
			obligations: [],
			transfersByAttemptId: new Map([
				[
					"attempt_1",
					{
						confirmedAt: Date.parse("2026-04-02T12:00:00.000Z"),
						failedAt: undefined,
						reversedAt: undefined,
						status: "confirmed",
					},
				],
			]),
		});

		expect(snapshot).toEqual({
			amount: 2450,
			date: Date.parse("2026-04-02T12:00:00.000Z"),
			status: "settled",
		});
	});

	it("falls back to the next collection plan entry before provider schedule or obligation", () => {
		const snapshot = deriveNextUpcomingPaymentSnapshot({
			asOf: Date.parse("2026-04-15T00:00:00.000Z"),
			externalSchedule: {
				nextPollAt: Date.parse("2026-04-22T00:00:00.000Z"),
				status: "active",
			},
			obligations: [
				{
					amount: 2450,
					dueDate: Date.parse("2026-05-01T00:00:00.000Z"),
					status: "upcoming",
				},
			],
			planEntries: [
				{
					amount: 2450,
					scheduledDate: Date.parse("2026-04-30T00:00:00.000Z"),
					status: "planned",
				},
			],
		});

		expect(snapshot).toEqual({
			amount: 2450,
			date: Date.parse("2026-04-30T00:00:00.000Z"),
			status: "planned",
		});
	});

	it("returns explicit none states when a mortgage has no payment context", () => {
		expect(
			deriveMostRecentPaymentSnapshot({
				attempts: [],
				obligations: [],
				transfersByAttemptId: new Map(),
			})
		).toEqual({
			amount: null,
			date: null,
			status: "none",
		});

		expect(
			deriveNextUpcomingPaymentSnapshot({
				asOf: Date.parse("2026-04-15T00:00:00.000Z"),
				externalSchedule: null,
				obligations: [],
				planEntries: [],
			})
		).toEqual({
			amount: null,
			date: null,
			status: "none",
		});
	});

	it("falls back to an overdue obligation when no plan entry or provider schedule exists", () => {
		const snapshot = deriveNextUpcomingPaymentSnapshot({
			asOf: Date.parse("2026-04-15T00:00:00.000Z"),
			externalSchedule: null,
			obligations: [
				{
					amount: 2450,
					dueDate: Date.parse("2026-04-10T00:00:00.000Z"),
					status: "overdue",
				},
			],
			planEntries: [],
		});

		expect(snapshot).toEqual({
			amount: 2450,
			date: Date.parse("2026-04-10T00:00:00.000Z"),
			status: "overdue",
		});
	});

	it("prefers the mortgage active external schedule reference over stale schedules", () => {
		const selected = pickPreferredExternalCollectionSchedule({
			mortgage: {
				_id: "mortgage_1",
				activeExternalCollectionScheduleId: "schedule_live",
			},
			schedules: [
				{
					_id: "schedule_old",
					createdAt: Date.parse("2026-04-01T00:00:00.000Z"),
					nextPollAt: Date.parse("2026-04-02T00:00:00.000Z"),
					status: "cancelled",
				},
				{
					_id: "schedule_live",
					createdAt: Date.parse("2026-04-03T00:00:00.000Z"),
					nextPollAt: Date.parse("2026-04-04T00:00:00.000Z"),
					status: "active",
				},
			],
		});

		expect(selected).toMatchObject({
			nextPollAt: Date.parse("2026-04-04T00:00:00.000Z"),
			status: "active",
		});
	});

	it("falls back to the latest non-terminal external schedule when no active pointer exists", () => {
		const selected = pickPreferredExternalCollectionSchedule({
			mortgage: {
				_id: "mortgage_1",
				activeExternalCollectionScheduleId: undefined,
			},
			schedules: [
				{
					_id: "schedule_old",
					createdAt: Date.parse("2026-04-01T00:00:00.000Z"),
					nextPollAt: Date.parse("2026-04-02T00:00:00.000Z"),
					status: "cancelled",
				},
				{
					_id: "schedule_live",
					createdAt: Date.parse("2026-04-03T00:00:00.000Z"),
					nextPollAt: Date.parse("2026-04-04T00:00:00.000Z"),
					status: "sync_error",
				},
			],
		});

		expect(selected).toMatchObject({
			nextPollAt: Date.parse("2026-04-04T00:00:00.000Z"),
			status: "sync_error",
		});
	});

	it("ignores a stale terminal active schedule pointer and falls back to a live schedule", () => {
		const selected = pickPreferredExternalCollectionSchedule({
			mortgage: {
				_id: "mortgage_1",
				activeExternalCollectionScheduleId: "schedule_done",
			},
			schedules: [
				{
					_id: "schedule_done",
					createdAt: Date.parse("2026-04-05T00:00:00.000Z"),
					nextPollAt: Date.parse("2026-04-06T00:00:00.000Z"),
					status: "completed",
				},
				{
					_id: "schedule_live",
					createdAt: Date.parse("2026-04-04T00:00:00.000Z"),
					nextPollAt: Date.parse("2026-04-07T00:00:00.000Z"),
					status: "active",
				},
			],
		});

		expect(selected).toMatchObject({
			nextPollAt: Date.parse("2026-04-07T00:00:00.000Z"),
			status: "active",
		});
	});

	it("uses indexed per-mortgage loading for larger mortgage batches", async () => {
		const mortgageIds = Array.from(
			{ length: 9 },
			(_, index) => `mortgage_${String(index + 1)}`
		);
		const obligationDueDate = Date.parse("2026-05-01T00:00:00.000Z");
		const indexedQueries = {
			collectionAttempts: {
				expectedIndex: "by_mortgage_status",
				mortgageIds: [] as string[],
				rowsByMortgageId: {} as Record<string, unknown[]>,
			},
			collectionPlanEntries: {
				expectedIndex: "by_mortgage_status_scheduled",
				mortgageIds: [] as string[],
				rowsByMortgageId: {} as Record<string, unknown[]>,
			},
			externalCollectionSchedules: {
				expectedIndex: "by_mortgage",
				mortgageIds: [] as string[],
				rowsByMortgageId: {} as Record<string, unknown[]>,
			},
			obligations: {
				expectedIndex: "by_mortgage_and_date",
				mortgageIds: [] as string[],
				rowsByMortgageId: {
					mortgage_1: [
						{
							amount: 2450,
							dueDate: obligationDueDate,
							status: "upcoming",
						},
					],
				} as Record<string, unknown[]>,
			},
		};
		const ctx = {
			db: {
				get: vi.fn(async (id: string) => ({
					_id: id,
					activeExternalCollectionScheduleId: undefined,
				})),
				normalizeId: vi.fn((_table: string, id: string) => id),
				query: vi.fn((table: keyof typeof indexedQueries) => {
					const queryConfig = indexedQueries[table];
					if (!queryConfig) {
						throw new Error(`Unexpected table query: ${table}`);
					}
					return {
						withIndex: vi.fn(
							(
								indexName: string,
								applyIndex: (query: {
									eq: (field: string, value: string) => unknown;
								}) => unknown
							) => {
								expect(indexName).toBe(queryConfig.expectedIndex);
								let mortgageId: string | undefined;
								applyIndex({
									eq: (_field: string, value: string) => {
										mortgageId = value;
										return {};
									},
								});
								if (!mortgageId) {
									throw new Error("Expected mortgageId to be captured");
								}
								const resolvedMortgageId = mortgageId;

								return {
									collect: vi.fn(async () => {
										queryConfig.mortgageIds.push(resolvedMortgageId);
										return (
											queryConfig.rowsByMortgageId[resolvedMortgageId] ?? []
										);
									}),
								};
							}
						),
					};
				}),
			},
		};

		const snapshots = await loadMortgagePaymentSnapshots(
			ctx as never,
			mortgageIds as never,
			Date.parse("2026-04-15T00:00:00.000Z")
		);

		expect(indexedQueries.obligations.mortgageIds).toEqual(mortgageIds);
		expect(indexedQueries.collectionPlanEntries.mortgageIds).toEqual(
			mortgageIds
		);
		expect(indexedQueries.collectionAttempts.mortgageIds).toEqual(mortgageIds);
		expect(indexedQueries.externalCollectionSchedules.mortgageIds).toEqual(
			mortgageIds
		);
		expect(ctx.db.query).not.toHaveBeenCalledWith("transferRequests");
		expect(snapshots.get("mortgage_1")).toEqual({
			mostRecentPaymentAmount: 2450,
			mostRecentPaymentDate: obligationDueDate,
			mostRecentPaymentStatus: "processing",
			nextUpcomingPaymentAmount: 2450,
			nextUpcomingPaymentDate: obligationDueDate,
			nextUpcomingPaymentStatus: "planned",
		});
		expect(snapshots.get("mortgage_9")).toEqual({
			mostRecentPaymentAmount: null,
			mostRecentPaymentDate: null,
			mostRecentPaymentStatus: "none",
			nextUpcomingPaymentAmount: null,
			nextUpcomingPaymentDate: null,
			nextUpcomingPaymentStatus: "none",
		});
	});
});
