import { type FunctionReference, makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import { adminAction, convex } from "../../fluent";
import { drainCursorPages } from "../../lib/drainLoops";
import { getRecurringCollectionScheduleProvider } from "./providers/registry";

const listSchedulesEligibleForPollingPageRef = makeFunctionReference<
	"query",
	{
		asOf: number;
		cursor?: string;
		limit?: number;
		status: "active" | "sync_error";
	},
	{
		continueCursor: string | null;
		isDone: boolean;
		page: Array<{
			_id: Id<"externalCollectionSchedules">;
			endDate: number;
			externalScheduleRef?: string;
			lastSyncCursor?: string;
			lastSyncedAt?: number;
			nextPollAt?: number;
			providerCode: "pad_rotessa";
			startDate: number;
			status: string;
			syncLeaseExpiresAt?: number;
		}>;
	}
>("payments/recurringSchedules/queries:listSchedulesEligibleForPollingPage");

interface PollingCandidate {
	_id: Id<"externalCollectionSchedules">;
	endDate: number;
	externalScheduleRef?: string;
	lastSyncCursor?: string;
	lastSyncedAt?: number;
	nextPollAt?: number;
	providerCode: "pad_rotessa";
	startDate: number;
	status: string;
	syncLeaseExpiresAt?: number;
}

const DEFAULT_POLL_LIMIT = 25;
const MAX_POLL_LIMIT = 100;
/** Bounded waves per run; remaining work is continued via {@link POLL_CONTINUATION_DELAY_MS}. */
const MAX_POLL_WAVES = 100;
const POLL_CONTINUATION_DELAY_MS = 10_000;

const ingestExternalOccurrenceEventRef = makeFunctionReference<
	"mutation",
	{
		event: {
			amount?: number;
			externalOccurrenceOrdinal?: number;
			externalOccurrenceRef?: string;
			externalScheduleRef: string;
			mappedTransferEvent:
				| "PROCESSING_UPDATE"
				| "FUNDS_SETTLED"
				| "TRANSFER_FAILED"
				| "TRANSFER_REVERSED";
			occurredAt?: number;
			providerCode: "pad_rotessa";
			providerData?: Record<string, unknown>;
			providerRef?: string;
			rawProviderReason?: string;
			rawProviderStatus: string;
			receivedVia: "poller";
			scheduledDate?: string;
		};
	},
	Promise<
		| {
				outcome: "unresolved";
				reason: string;
		  }
		| {
				outcome: "materialized" | "already_applied" | "applied";
				matchedBy: string;
				collectionAttemptId: string;
				planEntryId: string;
				transferRequestId: string;
		  }
	>
>(
	"payments/recurringSchedules/occurrenceIngestion:ingestExternalOccurrenceEvent"
);

const previewSchedulesEligibleForPollingRef = makeFunctionReference<
	"action",
	{ asOf: number; limit?: number },
	Promise<PollingCandidate[]>
>("payments/recurringSchedules/poller:previewSchedulesEligibleForPolling");

const countSchedulesEligibleForPollingRef = makeFunctionReference<
	"action",
	{ asOf: number },
	Promise<number>
>("payments/recurringSchedules/poller:countSchedulesEligibleForPolling");

const getExternalCollectionScheduleDetailRef = makeFunctionReference<
	"query",
	{ scheduleId: Id<"externalCollectionSchedules"> },
	Promise<{ schedule: PollingCandidate } | null>
>("payments/recurringSchedules/queries:getExternalCollectionScheduleDetail");

const POLL_INTERVAL_MS = 15 * 60 * 1000;
const POLL_LEASE_MS = 10 * 60 * 1000;
const LOOKAHEAD_DAYS = 14;
const LOOKBACK_DAYS = 35;
const MS_PER_DAY = 86_400_000;

function normalizePollingLimit(limit?: number) {
	return Math.max(
		1,
		Math.min(Math.floor(limit ?? DEFAULT_POLL_LIMIT), MAX_POLL_LIMIT)
	);
}

function toBusinessDate(timestamp: number) {
	return new Date(timestamp).toISOString().slice(0, 10);
}

function parseSyncCursorForOrdering(cursor: string | undefined) {
	if (!cursor) {
		return null;
	}
	try {
		const parsed = JSON.parse(cursor) as {
			occurredAt?: unknown;
			sortKey?: unknown;
		};
		if (
			typeof parsed.occurredAt === "number" &&
			Number.isFinite(parsed.occurredAt) &&
			typeof parsed.sortKey === "string"
		) {
			return {
				occurredAt: parsed.occurredAt,
				sortKey: parsed.sortKey,
			};
		}
	} catch {
		const occurredAt = Date.parse(cursor);
		if (!Number.isNaN(occurredAt)) {
			return { occurredAt, sortKey: "" };
		}
	}

	return null;
}

function compareSyncCursors(left: string, right: string) {
	const parsedLeft = parseSyncCursorForOrdering(left);
	const parsedRight = parseSyncCursorForOrdering(right);
	if (!(parsedLeft || parsedRight)) {
		return left.localeCompare(right);
	}
	if (!parsedLeft) {
		return -1;
	}
	if (!parsedRight) {
		return 1;
	}
	const occurredAtDelta = parsedLeft.occurredAt - parsedRight.occurredAt;
	if (occurredAtDelta !== 0) {
		return occurredAtDelta;
	}
	return parsedLeft.sortKey.localeCompare(parsedRight.sortKey);
}

function chooseNextSyncCursor(args: {
	currentCursor?: string;
	forceReplay?: boolean;
	nextCursor?: string;
}) {
	if (!args.nextCursor) {
		return args.currentCursor;
	}
	if (!(args.currentCursor && args.forceReplay)) {
		return args.nextCursor;
	}
	return compareSyncCursors(args.nextCursor, args.currentCursor) > 0
		? args.nextCursor
		: args.currentCursor;
}

function isLeaseActive(
	schedule: Pick<PollingCandidate, "syncLeaseExpiresAt">,
	asOf: number
) {
	return (
		schedule.syncLeaseExpiresAt !== undefined &&
		schedule.syncLeaseExpiresAt > asOf
	);
}

async function collectEligibleSchedulesForStatus(
	ctx: ActionCtx,
	args: {
		asOf: number;
		limit: number;
		status: "active" | "sync_error";
	}
) {
	if (args.limit <= 0) {
		return [] as PollingCandidate[];
	}

	const pageSize = Math.max(25, Math.min(args.limit * 3, MAX_POLL_LIMIT));
	const result = await drainCursorPages<PollingCandidate, PollingCandidate[]>({
		initialState: [],
		fetchPage: (cursor) =>
			ctx.runQuery(listSchedulesEligibleForPollingPageRef, {
				asOf: args.asOf,
				cursor: cursor ?? undefined,
				limit: pageSize,
				status: args.status,
			}),
		onPage: (eligible, page) => {
			const next = [...eligible];
			for (const schedule of page) {
				if (isLeaseActive(schedule, args.asOf)) {
					continue;
				}
				next.push(schedule);
				if (next.length >= args.limit) {
					break;
				}
			}
			return next;
		},
		shouldStop: (eligible) => eligible.length >= args.limit,
	});

	return result.state.slice(0, args.limit);
}

async function buildPollingCandidates(
	ctx: ActionCtx,
	args: { asOf: number; limit: number }
) {
	const syncErrorBudget = Math.max(1, Math.ceil(args.limit / 4));
	const syncErrorCandidates = await collectEligibleSchedulesForStatus(ctx, {
		asOf: args.asOf,
		limit: args.limit,
		status: "sync_error",
	});
	const reservedSyncErrorCount = Math.min(
		syncErrorCandidates.length,
		Math.min(args.limit, syncErrorBudget)
	);
	const active = await collectEligibleSchedulesForStatus(ctx, {
		asOf: args.asOf,
		limit: Math.max(0, args.limit - reservedSyncErrorCount),
		status: "active",
	});
	const remainingSlots = Math.max(
		0,
		args.limit - reservedSyncErrorCount - active.length
	);
	const extraSyncError =
		remainingSlots === 0
			? []
			: syncErrorCandidates.slice(
					reservedSyncErrorCount,
					reservedSyncErrorCount + remainingSlots
				);

	return [
		...syncErrorCandidates.slice(0, reservedSyncErrorCount),
		...active,
		...extraSyncError,
	]
		.sort((left, right) => (left.nextPollAt ?? 0) - (right.nextPollAt ?? 0))
		.slice(0, args.limit);
}

async function countEligibleSchedulesForStatus(
	ctx: ActionCtx,
	args: { asOf: number; status: "active" | "sync_error" }
) {
	const result = await drainCursorPages<PollingCandidate, number>({
		initialState: 0,
		fetchPage: (cursor) =>
			ctx.runQuery(listSchedulesEligibleForPollingPageRef, {
				asOf: args.asOf,
				cursor: cursor ?? undefined,
				limit: MAX_POLL_LIMIT,
				status: args.status,
			}),
		onPage: (count, page) =>
			count +
			page.filter((schedule) => !isLeaseActive(schedule, args.asOf)).length,
	});

	return result.state;
}

async function syncClaimedExternalCollectionSchedule(
	ctx: ActionCtx,
	args: {
		asOf: number;
		forceReplay?: boolean;
		leaseOwner: string;
		schedule: PollingCandidate;
	}
) {
	try {
		if (!args.schedule.externalScheduleRef) {
			throw new ConvexError(
				`External collection schedule ${args.schedule._id} is missing externalScheduleRef`
			);
		}

		const provider = getRecurringCollectionScheduleProvider(
			args.schedule.providerCode
		);
		const pollWindowStart = Math.max(
			args.schedule.startDate,
			(args.schedule.lastSyncedAt ?? args.asOf) - LOOKBACK_DAYS * MS_PER_DAY
		);
		const pollWindowEnd = Math.min(
			args.schedule.endDate,
			args.asOf + LOOKAHEAD_DAYS * MS_PER_DAY
		);

		const [scheduleStatus, occurrenceUpdates] = await Promise.all([
			provider.getScheduleStatus(args.schedule.externalScheduleRef),
			provider.pollOccurrenceUpdates({
				endDate: toBusinessDate(pollWindowEnd),
				externalScheduleRef: args.schedule.externalScheduleRef,
				sinceCursor: args.forceReplay
					? undefined
					: args.schedule.lastSyncCursor,
				startDate: toBusinessDate(pollWindowStart),
			}),
		]);
		const normalizedScheduleStatus =
			scheduleStatus.status === "completed" ? "completed" : "active";
		const unresolvedOccurrenceReasons: string[] = [];
		let ingestedEventCount = 0;

		for (const event of occurrenceUpdates.events) {
			const ingestionResult = await ctx.runMutation(
				ingestExternalOccurrenceEventRef,
				{
					event: {
						...event,
						receivedVia: "poller",
					},
				}
			);
			if (ingestionResult.outcome === "unresolved") {
				unresolvedOccurrenceReasons.push(
					ingestionResult.reason ??
						`No local match found for provider occurrence on schedule ${args.schedule._id}.`
				);
				continue;
			}
			ingestedEventCount += 1;
		}
		const hasUnresolvedOccurrences = unresolvedOccurrenceReasons.length > 0;

		await ctx.runMutation(
			makeFunctionReference(
				"payments/recurringSchedules/poller:recordExternalCollectionScheduleSyncSuccess"
			) as unknown as FunctionReference<"mutation">,
			{
				asOf: args.asOf,
				lastProviderScheduleStatus: scheduleStatus.status,
				nextCursor: hasUnresolvedOccurrences
					? args.schedule.lastSyncCursor
					: chooseNextSyncCursor({
							currentCursor: args.schedule.lastSyncCursor,
							forceReplay: args.forceReplay,
							nextCursor: occurrenceUpdates.nextCursor,
						}),
				nextPollAt: args.asOf + POLL_INTERVAL_MS,
				providerData: {
					...(scheduleStatus.providerData ?? {}),
					...(occurrenceUpdates.providerData ?? {}),
				},
				scheduleStatus: normalizedScheduleStatus,
				scheduleId: args.schedule._id,
				leaseOwner: args.leaseOwner,
				syncWarningMessage: hasUnresolvedOccurrences
					? unresolvedOccurrenceReasons.join("; ")
					: undefined,
			}
		);

		return { failed: false as const, ingestedEventCount };
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown polling error";
		await ctx.runMutation(
			makeFunctionReference(
				"payments/recurringSchedules/poller:recordExternalCollectionScheduleSyncFailure"
			) as unknown as FunctionReference<"mutation">,
			{
				asOf: args.asOf,
				errorMessage,
				nextPollAt: args.asOf + POLL_INTERVAL_MS,
				scheduleId: args.schedule._id,
				leaseOwner: args.leaseOwner,
			}
		);
		return { errorMessage, failed: true as const, ingestedEventCount: 0 };
	}
}

export const previewSchedulesEligibleForPolling = convex
	.action()
	.input({
		asOf: v.number(),
		limit: v.optional(v.number()),
	})
	.handler(async (ctx, args) =>
		buildPollingCandidates(ctx, {
			asOf: args.asOf,
			limit: normalizePollingLimit(args.limit),
		})
	)
	.internal();

export const countSchedulesEligibleForPolling = convex
	.action()
	.input({
		asOf: v.number(),
	})
	.handler(async (ctx, args) => {
		const [activeCount, syncErrorCount] = await Promise.all([
			countEligibleSchedulesForStatus(ctx, {
				asOf: args.asOf,
				status: "active",
			}),
			countEligibleSchedulesForStatus(ctx, {
				asOf: args.asOf,
				status: "sync_error",
			}),
		]);
		return activeCount + syncErrorCount;
	})
	.internal();

export const syncExternalCollectionScheduleNow = adminAction
	.input({
		scheduleId: v.id("externalCollectionSchedules"),
	})
	.handler(async (ctx, args) => {
		const asOf = Date.now();
		const leaseOwner = `provider-managed-manual-sync:${crypto.randomUUID()}`;
		const detail = await ctx.runQuery(getExternalCollectionScheduleDetailRef, {
			scheduleId: args.scheduleId,
		});
		if (!detail) {
			throw new ConvexError("External collection schedule not found.");
		}

		const claimed = (await ctx.runMutation(
			makeFunctionReference(
				"payments/recurringSchedules/poller:claimExternalCollectionScheduleSync"
			) as unknown as FunctionReference<"mutation">,
			{
				asOf,
				leaseOwner,
				leaseTtlMs: POLL_LEASE_MS,
				scheduleId: args.scheduleId,
			}
		)) as { claimed: boolean; reason?: string };

		if (!claimed.claimed) {
			return {
				errorMessage: claimed.reason ?? "Schedule could not be claimed.",
				ingestedEventCount: 0,
				status: "skipped" as const,
			};
		}

		const result = await syncClaimedExternalCollectionSchedule(ctx, {
			asOf,
			forceReplay: true,
			leaseOwner,
			schedule: detail.schedule,
		});
		if (result.failed) {
			return {
				errorMessage: result.errorMessage,
				ingestedEventCount: 0,
				status: "failed" as const,
			};
		}

		return {
			ingestedEventCount: result.ingestedEventCount,
			status: "synced" as const,
		};
	})
	.public();

export const claimExternalCollectionScheduleSync = convex
	.mutation()
	.input({
		asOf: v.number(),
		leaseOwner: v.string(),
		leaseTtlMs: v.optional(v.number()),
		scheduleId: v.id("externalCollectionSchedules"),
	})
	.handler(async (ctx, args) => {
		const schedule = await ctx.db.get(args.scheduleId);
		if (!schedule) {
			return { claimed: false as const, reason: "missing_schedule" as const };
		}
		if (!schedule.externalScheduleRef) {
			await ctx.db.patch(args.scheduleId, {
				status: "sync_error",
				lastSyncAttemptAt: args.asOf,
				lastSyncErrorAt: args.asOf,
				lastSyncErrorMessage:
					"External collection schedule is missing externalScheduleRef",
				nextPollAt: args.asOf + POLL_INTERVAL_MS,
				consecutiveSyncFailures: (schedule.consecutiveSyncFailures ?? 0) + 1,
				lastTransitionAt: args.asOf,
				syncLeaseOwner: undefined,
				syncLeaseExpiresAt: undefined,
			});
			return {
				claimed: false as const,
				reason: "missing_external_schedule_ref" as const,
			};
		}
		if (
			schedule.syncLeaseExpiresAt !== undefined &&
			schedule.syncLeaseExpiresAt > args.asOf
		) {
			return { claimed: false as const, reason: "lease_held" as const };
		}

		const leaseExpiresAt = args.asOf + (args.leaseTtlMs ?? POLL_LEASE_MS);
		await ctx.db.patch(args.scheduleId, {
			syncLeaseOwner: args.leaseOwner,
			syncLeaseExpiresAt: leaseExpiresAt,
			lastSyncAttemptAt: args.asOf,
		});

		return { claimed: true as const, leaseExpiresAt };
	})
	.internal();

export const recordExternalCollectionScheduleSyncSuccess = convex
	.mutation()
	.input({
		asOf: v.number(),
		lastProviderScheduleStatus: v.optional(v.string()),
		nextCursor: v.optional(v.string()),
		nextPollAt: v.number(),
		providerData: v.optional(v.record(v.string(), v.any())),
		scheduleStatus: v.union(v.literal("active"), v.literal("completed")),
		scheduleId: v.id("externalCollectionSchedules"),
		leaseOwner: v.string(),
		syncWarningMessage: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		const schedule = await ctx.db.get(args.scheduleId);
		if (!schedule || schedule.syncLeaseOwner !== args.leaseOwner) {
			return;
		}
		const nextScheduleStatus =
			args.scheduleStatus === "completed" ? "completed" : "active";

		await ctx.db.patch(args.scheduleId, {
			status: nextScheduleStatus,
			lastSyncedAt: args.asOf,
			lastSyncCursor: args.nextCursor,
			nextPollAt: args.nextPollAt,
			lastProviderScheduleStatus:
				args.lastProviderScheduleStatus ?? schedule.lastProviderScheduleStatus,
			providerData: {
				...(schedule.providerData ?? {}),
				...(args.providerData ?? {}),
			},
			consecutiveSyncFailures: 0,
			lastSyncErrorAt:
				args.syncWarningMessage === undefined ? undefined : args.asOf,
			lastSyncErrorMessage: args.syncWarningMessage,
			lastTransitionAt:
				schedule.status === nextScheduleStatus
					? schedule.lastTransitionAt
					: args.asOf,
			syncLeaseOwner: undefined,
			syncLeaseExpiresAt: undefined,
		});
	})
	.internal();

export const recordExternalCollectionScheduleSyncFailure = convex
	.mutation()
	.input({
		asOf: v.number(),
		errorMessage: v.string(),
		nextPollAt: v.number(),
		scheduleId: v.id("externalCollectionSchedules"),
		leaseOwner: v.string(),
	})
	.handler(async (ctx, args) => {
		const schedule = await ctx.db.get(args.scheduleId);
		if (!schedule || schedule.syncLeaseOwner !== args.leaseOwner) {
			return;
		}

		const consecutiveSyncFailures = (schedule.consecutiveSyncFailures ?? 0) + 1;
		await ctx.db.patch(args.scheduleId, {
			status: "sync_error",
			lastSyncErrorAt: args.asOf,
			lastSyncErrorMessage: args.errorMessage,
			nextPollAt: args.nextPollAt,
			consecutiveSyncFailures,
			lastTransitionAt: args.asOf,
			syncLeaseOwner: undefined,
			syncLeaseExpiresAt: undefined,
		});
	})
	.internal();

export const pollProviderManagedSchedules = convex
	.action()
	.input({
		asOf: v.optional(v.number()),
		limit: v.optional(v.number()),
	})
	.handler(async (ctx, args) => {
		const asOf = args.asOf ?? Date.now();
		const limit = normalizePollingLimit(args.limit);
		const leaseOwner = `provider-managed-poller:${crypto.randomUUID()}`;

		let candidateCount = 0;
		let claimedCount = 0;
		let syncedCount = 0;
		let ingestedEventCount = 0;
		let failedCount = 0;
		let wavesRun = 0;

		while (wavesRun < MAX_POLL_WAVES) {
			const candidates = await ctx.runAction(
				previewSchedulesEligibleForPollingRef,
				{
					asOf,
					limit,
				}
			);
			if (candidates.length === 0) {
				break;
			}

			wavesRun += 1;
			candidateCount += candidates.length;

			for (const candidate of candidates) {
				const claimed = (await ctx.runMutation(
					makeFunctionReference(
						"payments/recurringSchedules/poller:claimExternalCollectionScheduleSync"
					) as unknown as FunctionReference<"mutation">,
					{
						asOf,
						leaseOwner,
						leaseTtlMs: POLL_LEASE_MS,
						scheduleId: candidate._id,
					}
				)) as { claimed: boolean };

				if (!claimed.claimed) {
					continue;
				}
				claimedCount += 1;

				const syncResult = await syncClaimedExternalCollectionSchedule(ctx, {
					asOf,
					leaseOwner,
					schedule: candidate,
				});
				if (syncResult.failed) {
					failedCount += 1;
				} else {
					ingestedEventCount += syncResult.ingestedEventCount;
					syncedCount += 1;
				}
			}

			if (candidates.length < limit) {
				break;
			}
		}

		const remainingEligibleCount =
			wavesRun >= MAX_POLL_WAVES
				? await ctx.runAction(countSchedulesEligibleForPollingRef, { asOf })
				: 0;
		const maxWavesReached =
			wavesRun >= MAX_POLL_WAVES && remainingEligibleCount > 0;
		const drainedAllEligibleWork = !maxWavesReached;

		if (maxWavesReached) {
			await ctx.scheduler.runAfter(
				POLL_CONTINUATION_DELAY_MS,
				internal.payments.recurringSchedules.poller
					.pollProviderManagedSchedules,
				{ asOf, limit }
			);
		}

		return {
			candidateCount,
			claimedCount,
			failedCount,
			ingestedEventCount,
			syncedCount,
			wavesRun,
			drainedAllEligibleWork,
			remainingEligibleCount,
			maxWavesReached,
		};
	})
	.internal();
