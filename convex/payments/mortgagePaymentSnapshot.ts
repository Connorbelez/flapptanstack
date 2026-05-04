import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type MostRecentPaymentStatus =
	| "settled"
	| "processing"
	| "failed"
	| "reversed"
	| "cancelled"
	| "none";

export type NextUpcomingPaymentStatus =
	| "planned"
	| "provider_scheduled"
	| "executing"
	| "due"
	| "overdue"
	| "none";

export interface MortgagePaymentSnapshot {
	mostRecentPaymentAmount: number | null;
	mostRecentPaymentDate: number | null;
	mostRecentPaymentStatus: MostRecentPaymentStatus;
	nextUpcomingPaymentAmount: number | null;
	nextUpcomingPaymentDate: number | null;
	nextUpcomingPaymentStatus: NextUpcomingPaymentStatus;
}

type AttemptSource = Pick<
	Doc<"collectionAttempts">,
	| "_id"
	| "amount"
	| "cancelledAt"
	| "confirmedAt"
	| "failedAt"
	| "initiatedAt"
	| "reversedAt"
	| "settledAt"
	| "status"
	| "transferRequestId"
> & {
	obligationIds?: readonly unknown[];
};

type ObligationSource = Pick<
	Doc<"obligations">,
	"amount" | "dueDate" | "status"
> & {
	_id?: Id<"obligations">;
};

type ExternalScheduleCandidate = Pick<
	Doc<"externalCollectionSchedules">,
	"_id" | "createdAt" | "nextPollAt" | "status"
>;
type ExternalScheduleSource = ExternalScheduleCandidate | null;
type MortgageSource = Pick<
	Doc<"mortgages">,
	"_id" | "activeExternalCollectionScheduleId"
>;

type TransferSource = Pick<
	Doc<"transferRequests">,
	"confirmedAt" | "failedAt" | "reversedAt" | "status"
>;

// Table views can ask for many mortgage snapshots at once. Until a persisted
// snapshot read model lands, keep larger batches on indexed queries but cap how
// many mortgages we fan out across at a time.
const BULK_SNAPSHOT_SCAN_THRESHOLD = 8;
const BULK_SNAPSHOT_QUERY_CHUNK_SIZE = 8;

const EMPTY_SNAPSHOT: MortgagePaymentSnapshot = {
	mostRecentPaymentAmount: null,
	mostRecentPaymentDate: null,
	mostRecentPaymentStatus: "none",
	nextUpcomingPaymentAmount: null,
	nextUpcomingPaymentDate: null,
	nextUpcomingPaymentStatus: "none",
};

function isTerminalExternalCollectionScheduleStatus(
	status: ExternalScheduleCandidate["status"]
) {
	return (
		status === "cancelled" ||
		status === "completed" ||
		status === "activation_failed"
	);
}

function isSettledLikeObligationStatus(status: ObligationSource["status"]) {
	return (
		status === "settled" ||
		status === "waived" ||
		status === "partially_settled"
	);
}

function toMostRecentStatusFromAttempt(args: {
	attempt: AttemptSource;
	transfer?: TransferSource | null;
}): MostRecentPaymentStatus {
	const { attempt, transfer } = args;

	if (transfer?.status === "reversed" || attempt.reversedAt !== undefined) {
		return "reversed";
	}

	if (transfer?.status === "failed" || attempt.failedAt !== undefined) {
		return "failed";
	}

	if (transfer?.status === "cancelled" || attempt.cancelledAt !== undefined) {
		return "cancelled";
	}

	if (
		transfer?.status === "confirmed" ||
		attempt.settledAt !== undefined ||
		attempt.confirmedAt !== undefined ||
		attempt.status === "confirmed"
	) {
		return "settled";
	}

	if (
		transfer?.status === "initiated" ||
		transfer?.status === "pending" ||
		transfer?.status === "processing" ||
		attempt.status === "initiated" ||
		attempt.status === "pending" ||
		attempt.status === "executing" ||
		attempt.status === "processing"
	) {
		return "processing";
	}

	if (attempt.status === "permanent_fail" || attempt.status === "failed") {
		return "failed";
	}

	if (attempt.status === "cancelled") {
		return "cancelled";
	}

	return "processing";
}

function toMostRecentStatusFromObligation(
	obligation: ObligationSource
): MostRecentPaymentStatus {
	switch (obligation.status) {
		case "settled":
		case "waived":
			return "settled";
		case "upcoming":
		case "due":
		case "overdue":
		case "partially_settled":
			return "processing";
		default:
			return "none";
	}
}

function getLinkedObligationDate(args: {
	attempt: AttemptSource;
	obligationsById: ReadonlyMap<string, ObligationSource>;
}) {
	const dates =
		args.attempt.obligationIds
			?.map(
				(obligationId) =>
					args.obligationsById.get(String(obligationId))?.dueDate
			)
			.filter((dueDate): dueDate is number => dueDate !== undefined) ?? [];
	return dates.sort((left, right) => right - left)[0];
}

function getAttemptEffectiveTimestamp(args: {
	attempt: AttemptSource;
	obligationsById: ReadonlyMap<string, ObligationSource>;
	transfer?: TransferSource | null;
}) {
	if (
		toMostRecentStatusFromAttempt({
			attempt: args.attempt,
			transfer: args.transfer,
		}) === "processing"
	) {
		return (
			getLinkedObligationDate({
				attempt: args.attempt,
				obligationsById: args.obligationsById,
			}) ?? args.attempt.initiatedAt
		);
	}

	return (
		args.transfer?.reversedAt ??
		args.attempt.reversedAt ??
		args.transfer?.failedAt ??
		args.attempt.cancelledAt ??
		args.attempt.failedAt ??
		args.transfer?.confirmedAt ??
		args.attempt.settledAt ??
		args.attempt.confirmedAt ??
		args.attempt.initiatedAt
	);
}

function toNextUpcomingStatusFromObligation(args: {
	asOf: number;
	obligation: ObligationSource;
}): NextUpcomingPaymentStatus {
	switch (args.obligation.status) {
		case "overdue":
			return "overdue";
		case "due":
			return "due";
		case "partially_settled":
			return "executing";
		case "upcoming":
			return args.obligation.dueDate <= args.asOf ? "due" : "planned";
		default:
			return args.obligation.dueDate <= args.asOf ? "due" : "planned";
	}
}

function isActiveAttemptStatus(status: AttemptSource["status"]) {
	return (
		status === "initiated" ||
		status === "pending" ||
		status === "executing" ||
		status === "processing"
	);
}

function hasActiveAttemptForObligation(args: {
	attempts: readonly AttemptSource[];
	obligation: ObligationSource;
}) {
	if (!args.obligation._id) {
		return false;
	}

	const obligationId = String(args.obligation._id);
	return args.attempts.some(
		(attempt) =>
			isActiveAttemptStatus(attempt.status) &&
			attempt.obligationIds?.some((attemptObligationId) => {
				return String(attemptObligationId) === obligationId;
			}) === true
	);
}

function sortDescendingByDate<T extends { date: number }>(left: T, right: T) {
	return right.date - left.date;
}

function sortAscendingByDate<T extends { date: number }>(left: T, right: T) {
	return left.date - right.date;
}

export function pickPreferredExternalCollectionSchedule<
	TSchedule extends ExternalScheduleCandidate,
>(args: {
	mortgage: MortgageSource | null;
	schedules: readonly TSchedule[];
}): TSchedule | null;
export function pickPreferredExternalCollectionSchedule<
	TSchedule extends ExternalScheduleCandidate,
>(args: {
	mortgage: MortgageSource | null;
	schedules: readonly TSchedule[];
}): TSchedule | null {
	if (!args.mortgage) {
		return null;
	}

	if (args.mortgage.activeExternalCollectionScheduleId) {
		const activeSchedule = args.schedules.find(
			(schedule) =>
				schedule._id === args.mortgage?.activeExternalCollectionScheduleId
		);
		if (
			activeSchedule &&
			!isTerminalExternalCollectionScheduleStatus(activeSchedule.status)
		) {
			return activeSchedule;
		}
	}

	return (
		[...args.schedules]
			.filter(
				(schedule) =>
					!isTerminalExternalCollectionScheduleStatus(schedule.status)
			)
			.sort((left, right) => right.createdAt - left.createdAt)[0] ?? null
	);
}

function buildTransfersByAttemptId(args: {
	attempts: readonly AttemptSource[];
	transfersById: ReadonlyMap<string, TransferSource | null | undefined>;
}) {
	return new Map(
		args.attempts.map((attempt) => [
			String(attempt._id),
			attempt.transferRequestId
				? (args.transfersById.get(String(attempt.transferRequestId)) ?? null)
				: null,
		])
	);
}

export function deriveMostRecentPaymentSnapshot(args: {
	asOf: number;
	attempts: readonly AttemptSource[];
	obligations: readonly ObligationSource[];
	transfersByAttemptId: ReadonlyMap<string, TransferSource | null | undefined>;
}): {
	amount: number | null;
	date: number | null;
	status: MostRecentPaymentStatus;
} {
	const obligationsById = new Map(
		args.obligations
			.filter((obligation) => obligation._id !== undefined)
			.map((obligation) => [String(obligation._id), obligation] as const)
	);
	const latestAttempt = [...args.attempts]
		.map((attempt) => ({
			attempt,
			date: getAttemptEffectiveTimestamp({
				attempt,
				obligationsById,
				transfer: args.transfersByAttemptId.get(String(attempt._id)),
			}),
		}))
		.filter((candidate) => candidate.date <= args.asOf)
		.sort(sortDescendingByDate)[0];

	if (latestAttempt) {
		const transfer = args.transfersByAttemptId.get(
			String(latestAttempt.attempt._id)
		);
		return {
			amount: latestAttempt.attempt.amount,
			date: latestAttempt.date,
			status: toMostRecentStatusFromAttempt({
				attempt: latestAttempt.attempt,
				transfer,
			}),
		};
	}

	const latestSettledLikeObligation = args.obligations
		.filter(
			(obligation) =>
				isSettledLikeObligationStatus(obligation.status) &&
				obligation.dueDate <= args.asOf
		)
		.map((obligation) => ({ obligation, date: obligation.dueDate }))
		.sort(sortDescendingByDate)[0];
	const latestObligation =
		latestSettledLikeObligation ??
		[...args.obligations]
			.filter((obligation) => obligation.dueDate <= args.asOf)
			.map((obligation) => ({ obligation, date: obligation.dueDate }))
			.sort(sortDescendingByDate)[0];

	if (latestObligation) {
		return {
			amount: latestObligation.obligation.amount,
			date: latestObligation.obligation.dueDate,
			status: toMostRecentStatusFromObligation(latestObligation.obligation),
		};
	}

	return {
		amount: null,
		date: null,
		status: "none",
	};
}

export function deriveNextUpcomingPaymentSnapshot(args: {
	asOf: number;
	attempts: readonly AttemptSource[];
	externalSchedule: ExternalScheduleSource;
	obligations: readonly ObligationSource[];
}): {
	amount: number | null;
	date: number | null;
	status: NextUpcomingPaymentStatus;
} {
	const nextObligation = [...args.obligations]
		.filter(
			(obligation) =>
				obligation.status !== "settled" &&
				obligation.status !== "waived" &&
				!hasActiveAttemptForObligation({
					attempts: args.attempts,
					obligation,
				})
		)
		.map((obligation) => ({ obligation, date: obligation.dueDate }))
		.sort(sortAscendingByDate)[0];

	if (nextObligation) {
		return {
			amount: nextObligation.obligation.amount,
			date: nextObligation.obligation.dueDate,
			status: toNextUpcomingStatusFromObligation({
				asOf: args.asOf,
				obligation: nextObligation.obligation,
			}),
		};
	}

	if (args.externalSchedule?.nextPollAt !== undefined) {
		return {
			amount: null,
			date: args.externalSchedule.nextPollAt,
			status: "provider_scheduled",
		};
	}

	return {
		amount: null,
		date: null,
		status: "none",
	};
}

export function buildMortgagePaymentSnapshot(args: {
	asOf: number;
	attempts: readonly AttemptSource[];
	mortgage: MortgageSource | null;
	obligations: readonly ObligationSource[];
	schedules: readonly ExternalScheduleCandidate[];
	transfersById: ReadonlyMap<string, TransferSource | null | undefined>;
}): MortgagePaymentSnapshot {
	const transfersByAttemptId = buildTransfersByAttemptId({
		attempts: args.attempts,
		transfersById: args.transfersById,
	});
	const mostRecent = deriveMostRecentPaymentSnapshot({
		asOf: args.asOf,
		attempts: args.attempts,
		obligations: args.obligations,
		transfersByAttemptId,
	});
	const nextUpcoming = deriveNextUpcomingPaymentSnapshot({
		asOf: args.asOf,
		attempts: args.attempts,
		externalSchedule: pickPreferredExternalCollectionSchedule({
			mortgage: args.mortgage,
			schedules: args.schedules,
		}),
		obligations: args.obligations,
	});

	return {
		mostRecentPaymentAmount: mostRecent.amount,
		mostRecentPaymentDate: mostRecent.date,
		mostRecentPaymentStatus: mostRecent.status,
		nextUpcomingPaymentAmount: nextUpcoming.amount,
		nextUpcomingPaymentDate: nextUpcoming.date,
		nextUpcomingPaymentStatus: nextUpcoming.status,
	};
}

async function loadMortgagePaymentSnapshotsPerMortgage(args: {
	asOf: number;
	ctx: Pick<QueryCtx, "db">;
	mortgages: readonly MortgageSource[];
}) {
	const mortgageData = await Promise.all(
		args.mortgages.map(async (mortgage) => {
			const [obligations, attempts, schedules] = await Promise.all([
				args.ctx.db
					.query("obligations")
					.withIndex("by_mortgage_and_date", (query) =>
						query.eq("mortgageId", mortgage._id)
					)
					.collect(),
				args.ctx.db
					.query("collectionAttempts")
					.withIndex("by_mortgage_status", (query) =>
						query.eq("mortgageId", mortgage._id)
					)
					.collect(),
				args.ctx.db
					.query("externalCollectionSchedules")
					.withIndex("by_mortgage", (query) =>
						query.eq("mortgageId", mortgage._id)
					)
					.collect(),
			]);

			return {
				attempts,
				mortgage,
				obligations,
				schedules,
			};
		})
	);

	const transferIds = [
		...new Set(
			mortgageData
				.flatMap((entry) => entry.attempts)
				.map((attempt) => attempt.transferRequestId)
				.filter(
					(transferId): transferId is Id<"transferRequests"> =>
						transferId !== undefined
				)
		),
	];
	const transfers = await Promise.all(
		transferIds.map((transferId) => args.ctx.db.get(transferId))
	);
	const transfersById = new Map(
		transfers
			.filter(
				(transfer): transfer is Doc<"transferRequests"> => transfer !== null
			)
			.map((transfer) => [String(transfer._id), transfer] as const)
	);

	return new Map(
		mortgageData.map((entry) => [
			String(entry.mortgage._id),
			buildMortgagePaymentSnapshot({
				asOf: args.asOf,
				attempts: entry.attempts,
				mortgage: entry.mortgage,
				obligations: entry.obligations,
				schedules: entry.schedules,
				transfersById,
			}),
		])
	);
}

async function loadMortgagePaymentSnapshotsBulk(args: {
	asOf: number;
	ctx: Pick<QueryCtx, "db">;
	mortgages: readonly MortgageSource[];
}) {
	const snapshots = new Map<string, MortgagePaymentSnapshot>();

	for (
		let startIndex = 0;
		startIndex < args.mortgages.length;
		startIndex += BULK_SNAPSHOT_QUERY_CHUNK_SIZE
	) {
		const chunkSnapshots = await loadMortgagePaymentSnapshotsPerMortgage({
			asOf: args.asOf,
			ctx: args.ctx,
			mortgages: args.mortgages.slice(
				startIndex,
				startIndex + BULK_SNAPSHOT_QUERY_CHUNK_SIZE
			),
		});

		for (const [mortgageId, snapshot] of chunkSnapshots) {
			snapshots.set(mortgageId, snapshot);
		}
	}

	return snapshots;
}

export async function loadMortgagePaymentSnapshots(
	ctx: Pick<QueryCtx, "db">,
	mortgageIds: readonly Id<"mortgages">[],
	asOf = Date.now()
): Promise<Map<string, MortgagePaymentSnapshot>> {
	const uniqueMortgageIds = [...new Set(mortgageIds.map(String))]
		.map((mortgageId) => ctx.db.normalizeId("mortgages", mortgageId))
		.filter((mortgageId): mortgageId is Id<"mortgages"> => mortgageId !== null);

	if (uniqueMortgageIds.length === 0) {
		return new Map();
	}

	const mortgages = (
		await Promise.all(
			uniqueMortgageIds.map((mortgageId) => ctx.db.get(mortgageId))
		)
	).filter((mortgage): mortgage is Doc<"mortgages"> => mortgage !== null);
	if (mortgages.length === 0) {
		return new Map();
	}

	if (mortgages.length > BULK_SNAPSHOT_SCAN_THRESHOLD) {
		return loadMortgagePaymentSnapshotsBulk({
			asOf,
			ctx,
			mortgages,
		});
	}

	return loadMortgagePaymentSnapshotsPerMortgage({
		asOf,
		ctx,
		mortgages,
	});
}

export const EMPTY_MORTGAGE_PAYMENT_SNAPSHOT = EMPTY_SNAPSHOT;
