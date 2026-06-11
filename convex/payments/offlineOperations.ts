import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
	type ActionCtx,
	internalMutation,
	internalQuery,
	type MutationCtx,
	type QueryCtx,
} from "../_generated/server";
import { buildSource } from "../engine/commands";
import { executeTransition } from "../engine/transition";
import type { CommandSource } from "../engine/types";
import { paymentAction, paymentMutation, paymentQuery } from "../fluent";
import { addBusinessDays, countBusinessDaysBetween } from "../lib/businessDays";
import type { ExecutePlanEntryResult } from "./collectionPlan/executionContract";
import { createEntryImpl } from "./collectionPlan/initialScheduling";
import type { ManualSettlementDetails } from "./transfers/interface";

const MS_PER_HOUR = 60 * 60 * 1000;
const STAFF_OVERDUE_MS = 24 * MS_PER_HOUR;
const DEFAULT_CONFIRMED_LIMIT = 10;
const MAX_CONFIRMED_LIMIT = 50;

const OFFLINE_METHODS = new Set(["manual", "manual_review"]);
const ACTIVE_ATTEMPT_STATUSES = new Set(["initiated", "pending"]);
const ACTIVE_TRANSFER_STATUSES = new Set([
	"initiated",
	"pending",
	"processing",
]);

const offlineBucketValues = [
	"upcoming",
	"due",
	"in_progress",
	"staff_overdue",
	"overdue",
	"delinquent",
	"confirmed",
] as const;

type OfflineBucket = (typeof offlineBucketValues)[number];

const offlineBucketValidator = v.union(
	v.literal("upcoming"),
	v.literal("due"),
	v.literal("in_progress"),
	v.literal("staff_overdue"),
	v.literal("overdue"),
	v.literal("delinquent"),
	v.literal("confirmed")
);

interface OfflineEvidenceInput {
	attachmentIds: string[];
	note: string;
}

interface OfflineInstrumentInput {
	chequeNumber?: string;
	depositReference?: string;
	notes?: string;
	receivedAt?: number;
	referenceNumber?: string;
	type: "cash" | "cheque";
}

interface LoadedOfflinePlanEntry {
	attempt: Doc<"collectionAttempts"> | null;
	evidence: Doc<"offlinePaymentEvidence"> | null;
	obligations: Doc<"obligations">[];
	planEntry: Doc<"collectionPlanEntries">;
	transfer: Doc<"transferRequests"> | null;
}

interface OfflineOperationItem {
	amount: number;
	assignedAt?: number;
	assignedByActorId?: string;
	assignedCollectorActorId?: string;
	assignmentReason?: string;
	borrowerEmail?: string;
	borrowerId?: Id<"borrowers">;
	borrowerLabel: string;
	bucket: OfflineBucket;
	collectionAttemptId?: Id<"collectionAttempts">;
	confirmedAt?: number;
	dueDate?: number;
	evidenceAttachmentIds: string[];
	evidenceId?: Id<"offlinePaymentEvidence">;
	instrumentType?: string;
	isGrouped: boolean;
	mortgageId: Id<"mortgages">;
	mortgageLabel: string;
	obligationIds: Id<"obligations">[];
	obligations: Array<{
		amount: number;
		amountSettled: number;
		dueDate: number;
		obligationId: Id<"obligations">;
		paymentNumber?: number;
		status: Doc<"obligations">["status"];
	}>;
	planEntryId: Id<"collectionPlanEntries">;
	referenceNumber?: string;
	remainingCollectibleAmount: number;
	scheduledDate: number;
	source: Doc<"collectionPlanEntries">["source"];
	status: Doc<"collectionPlanEntries">["status"];
	transferRequestId?: Id<"transferRequests">;
	transferStatus?: string;
	workoutPlanId?: Id<"workoutPlans">;
}

interface ConfirmOfflineCollectionResult {
	collectionAttemptId: Id<"collectionAttempts">;
	evidenceId: Id<"offlinePaymentEvidence">;
	outcome: "confirmed";
	planEntryId: Id<"collectionPlanEntries">;
	transferRequestId: Id<"transferRequests">;
	transferStatus: string;
}

type OfflineActionCtx = ActionCtx & {
	viewer: { authId: string };
};

const offlineEvidenceInputValidator = v.object({
	attachmentIds: v.array(v.string()),
	note: v.string(),
});

const offlineInstrumentInputValidator = v.object({
	type: v.union(v.literal("cash"), v.literal("cheque")),
	chequeNumber: v.optional(v.string()),
	depositReference: v.optional(v.string()),
	notes: v.optional(v.string()),
	receivedAt: v.optional(v.number()),
	referenceNumber: v.optional(v.string()),
});

const offlineFiltersValidator = {
	amountMax: v.optional(v.number()),
	amountMin: v.optional(v.number()),
	borrowerId: v.optional(v.id("borrowers")),
	collectorActorId: v.optional(v.string()),
	confirmedCursor: v.optional(v.string()),
	confirmedLimit: v.optional(v.number()),
	dateFrom: v.optional(v.number()),
	dateTo: v.optional(v.number()),
	evidenceType: v.optional(
		v.union(v.literal("with_evidence"), v.literal("missing_evidence"))
	),
	instrumentType: v.optional(v.union(v.literal("cash"), v.literal("cheque"))),
	mortgageId: v.optional(v.id("mortgages")),
	search: v.optional(v.string()),
	staffOverdueOnly: v.optional(v.boolean()),
	statusBucket: v.optional(offlineBucketValidator),
};

function trimNonEmpty(value: string | undefined) {
	const trimmed = value?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function requireText(value: string | undefined, message: string) {
	const trimmed = trimNonEmpty(value);
	if (!trimmed) {
		throw new ConvexError(message);
	}
	return trimmed;
}

function toUtcDate(timestamp: number) {
	return new Date(timestamp).toISOString().slice(0, 10);
}

function isOfflinePlanEntry(entry: Doc<"collectionPlanEntries">) {
	return (
		OFFLINE_METHODS.has(entry.method) &&
		entry.executionMode !== "provider_managed"
	);
}

function remainingForObligation(obligation: Doc<"obligations">) {
	return Math.max(0, obligation.amount - (obligation.amountSettled ?? 0));
}

function totalRemaining(obligations: readonly Doc<"obligations">[]) {
	return obligations.reduce(
		(total, obligation) => total + remainingForObligation(obligation),
		0
	);
}

function compareObligationSettlementOrder(
	left: Doc<"obligations">,
	right: Doc<"obligations">
) {
	if (left.dueDate !== right.dueDate) {
		return left.dueDate - right.dueDate;
	}
	if ((left.paymentNumber ?? 0) !== (right.paymentNumber ?? 0)) {
		return (left.paymentNumber ?? 0) - (right.paymentNumber ?? 0);
	}
	return String(left._id).localeCompare(String(right._id), "en");
}

function deriveDateBucket(args: {
	asOf: number;
	scheduledDate: number;
}): OfflineBucket | null {
	const asOfDate = toUtcDate(args.asOf);
	const scheduledDate = toUtcDate(args.scheduledDate);

	if (scheduledDate > asOfDate) {
		const businessDaysAhead = countBusinessDaysBetween(asOfDate, scheduledDate);
		return businessDaysAhead >= 1 && businessDaysAhead <= 3 ? "upcoming" : null;
	}

	const businessDaysPast = countBusinessDaysBetween(scheduledDate, asOfDate);
	if (businessDaysPast <= 3) {
		return "due";
	}
	if (businessDaysPast <= 9) {
		return "overdue";
	}
	return "delinquent";
}

function deriveOperationalBucket(args: {
	asOf: number;
	attempt: Doc<"collectionAttempts"> | null;
	planEntry: Doc<"collectionPlanEntries">;
	transfer: Doc<"transferRequests"> | null;
}): OfflineBucket | null {
	const transfer = args.transfer;
	const attempt = args.attempt;
	const hasActiveManualReviewAttempt =
		attempt &&
		transfer &&
		transfer.providerCode === "manual_review" &&
		ACTIVE_ATTEMPT_STATUSES.has(attempt.status) &&
		ACTIVE_TRANSFER_STATUSES.has(transfer.status);

	if (hasActiveManualReviewAttempt) {
		const pendingSince = attempt.executionRequestedAt ?? attempt.initiatedAt;
		return args.asOf - pendingSince >= STAFF_OVERDUE_MS
			? "staff_overdue"
			: "in_progress";
	}

	if (transfer?.status === "confirmed") {
		return "confirmed";
	}

	if (args.planEntry.status !== "planned") {
		return null;
	}

	return deriveDateBucket({
		asOf: args.asOf,
		scheduledDate: args.planEntry.scheduledDate,
	});
}

async function loadLatestEvidence(
	ctx: Pick<QueryCtx, "db">,
	planEntryId: Id<"collectionPlanEntries">
) {
	const rows = await ctx.db
		.query("offlinePaymentEvidence")
		.withIndex("by_plan_entry_created", (q) => q.eq("planEntryId", planEntryId))
		.collect();
	return (
		rows.sort((left, right) => right.createdAt - left.createdAt)[0] ?? null
	);
}

async function loadAttemptForPlanEntry(
	ctx: Pick<QueryCtx, "db">,
	planEntry: Doc<"collectionPlanEntries">
) {
	if (planEntry.collectionAttemptId) {
		const linked = await ctx.db.get(planEntry.collectionAttemptId);
		if (linked) {
			return linked;
		}
	}

	const attempts = await ctx.db
		.query("collectionAttempts")
		.withIndex("by_plan_entry", (q) => q.eq("planEntryId", planEntry._id))
		.collect();
	return (
		attempts.sort((left, right) => right.initiatedAt - left.initiatedAt)[0] ??
		null
	);
}

async function loadTransferForAttempt(
	ctx: Pick<QueryCtx, "db">,
	attempt: Doc<"collectionAttempts"> | null
) {
	if (!attempt) {
		return null;
	}
	if (attempt.transferRequestId) {
		const linked = await ctx.db.get(attempt.transferRequestId);
		if (linked) {
			return linked;
		}
	}
	return (
		(await ctx.db
			.query("transferRequests")
			.withIndex("by_collection_attempt", (q) =>
				q.eq("collectionAttemptId", attempt._id)
			)
			.first()) ?? null
	);
}

async function loadOfflinePlanEntry(
	ctx: Pick<QueryCtx, "db">,
	planEntryId: Id<"collectionPlanEntries">
): Promise<LoadedOfflinePlanEntry | null> {
	const planEntry = await ctx.db.get(planEntryId);
	if (!planEntry) {
		return null;
	}

	const obligations: Doc<"obligations">[] = [];
	for (const obligationId of planEntry.obligationIds) {
		const obligation = await ctx.db.get(obligationId);
		if (obligation) {
			obligations.push(obligation);
		}
	}

	const attempt = await loadAttemptForPlanEntry(ctx, planEntry);
	const [transfer, evidence] = await Promise.all([
		loadTransferForAttempt(ctx, attempt),
		loadLatestEvidence(ctx, planEntry._id),
	]);

	return {
		attempt,
		evidence,
		obligations,
		planEntry,
		transfer,
	};
}

export const loadOfflinePlanEntryForAction = internalQuery({
	args: {
		planEntryId: v.id("collectionPlanEntries"),
	},
	handler: async (ctx, args) => loadOfflinePlanEntry(ctx, args.planEntryId),
});

async function buildBorrowerLabel(
	ctx: Pick<QueryCtx, "db">,
	borrowerId: Id<"borrowers"> | undefined
) {
	if (!borrowerId) {
		return { borrowerEmail: undefined, borrowerLabel: "Unknown borrower" };
	}
	const borrower = await ctx.db.get(borrowerId);
	const user = borrower ? await ctx.db.get(borrower.userId) : null;
	const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : "";
	return {
		borrowerEmail: user?.email,
		borrowerLabel:
			fullName || user?.email || `Borrower ${String(borrowerId).slice(-6)}`,
	};
}

async function buildMortgageLabel(
	ctx: Pick<QueryCtx, "db">,
	mortgageId: Id<"mortgages">
) {
	const mortgage = await ctx.db.get(mortgageId);
	const property = mortgage?.propertyId
		? await ctx.db.get(mortgage.propertyId)
		: null;
	return property
		? `${property.streetAddress}, ${property.city}`
		: `Mortgage ${String(mortgageId).slice(-6)}`;
}

async function buildOfflineItem(
	ctx: Pick<QueryCtx, "db">,
	args: {
		asOf: number;
		loaded: LoadedOfflinePlanEntry;
	}
): Promise<OfflineOperationItem | null> {
	const { attempt, evidence, obligations, planEntry, transfer } = args.loaded;
	if (!isOfflinePlanEntry(planEntry) || obligations.length === 0) {
		return null;
	}

	const bucket = deriveOperationalBucket({
		asOf: args.asOf,
		attempt,
		planEntry,
		transfer,
	});
	if (!bucket) {
		return null;
	}

	const firstObligation = obligations[0];
	const { borrowerEmail, borrowerLabel } = await buildBorrowerLabel(
		ctx,
		firstObligation?.borrowerId
	);
	const mortgageLabel = await buildMortgageLabel(ctx, planEntry.mortgageId);
	const manualSettlement = transfer?.manualSettlement as
		| ManualSettlementDetails
		| undefined;

	return {
		amount: planEntry.amount,
		assignedAt: planEntry.assignedAt,
		assignedByActorId: planEntry.assignedByActorId,
		assignedCollectorActorId: planEntry.assignedCollectorActorId,
		assignmentReason: planEntry.assignmentReason,
		borrowerEmail,
		borrowerId: firstObligation?.borrowerId,
		borrowerLabel,
		bucket,
		collectionAttemptId: attempt?._id,
		confirmedAt: transfer?.confirmedAt,
		dueDate: firstObligation?.dueDate,
		evidenceAttachmentIds:
			evidence?.attachmentIds ?? manualSettlement?.evidenceAttachmentIds ?? [],
		evidenceId: evidence?._id,
		instrumentType:
			evidence?.instrumentType ?? manualSettlement?.instrumentType,
		isGrouped: planEntry.obligationIds.length > 1,
		mortgageId: planEntry.mortgageId,
		mortgageLabel,
		obligationIds: planEntry.obligationIds,
		obligations: obligations.map((obligation) => ({
			amount: obligation.amount,
			amountSettled: obligation.amountSettled ?? 0,
			dueDate: obligation.dueDate,
			obligationId: obligation._id,
			paymentNumber: obligation.paymentNumber,
			status: obligation.status,
		})),
		planEntryId: planEntry._id,
		referenceNumber:
			evidence?.referenceNumber ??
			manualSettlement?.referenceNumber ??
			manualSettlement?.externalReference,
		remainingCollectibleAmount: totalRemaining(obligations),
		scheduledDate: planEntry.scheduledDate,
		source: planEntry.source,
		status: planEntry.status,
		transferRequestId: transfer?._id,
		transferStatus: transfer?.status,
		workoutPlanId: planEntry.workoutPlanId,
	};
}

function normalizeSearch(value: string | undefined) {
	const trimmed = value?.trim().toLowerCase();
	return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function itemMatchesFilters(
	item: OfflineOperationItem,
	filters: {
		amountMax?: number;
		amountMin?: number;
		borrowerId?: Id<"borrowers">;
		collectorActorId?: string;
		dateFrom?: number;
		dateTo?: number;
		evidenceType?: "missing_evidence" | "with_evidence";
		instrumentType?: "cash" | "cheque";
		mortgageId?: Id<"mortgages">;
		search?: string;
		staffOverdueOnly?: boolean;
		statusBucket?: OfflineBucket;
	}
) {
	if (filters.staffOverdueOnly && item.bucket !== "staff_overdue") {
		return false;
	}
	if (filters.statusBucket && item.bucket !== filters.statusBucket) {
		return false;
	}
	if (filters.mortgageId && item.mortgageId !== filters.mortgageId) {
		return false;
	}
	if (filters.borrowerId && item.borrowerId !== filters.borrowerId) {
		return false;
	}
	if (
		filters.collectorActorId &&
		item.assignedCollectorActorId !== filters.collectorActorId
	) {
		return false;
	}
	if (
		filters.instrumentType &&
		item.instrumentType !== filters.instrumentType
	) {
		return false;
	}
	if (filters.amountMin !== undefined && item.amount < filters.amountMin) {
		return false;
	}
	if (filters.amountMax !== undefined && item.amount > filters.amountMax) {
		return false;
	}
	if (filters.dateFrom !== undefined && item.scheduledDate < filters.dateFrom) {
		return false;
	}
	if (filters.dateTo !== undefined && item.scheduledDate > filters.dateTo) {
		return false;
	}
	if (
		filters.evidenceType === "with_evidence" &&
		item.evidenceAttachmentIds.length === 0
	) {
		return false;
	}
	if (
		filters.evidenceType === "missing_evidence" &&
		item.evidenceAttachmentIds.length > 0
	) {
		return false;
	}

	const search = normalizeSearch(filters.search);
	if (!search) {
		return true;
	}

	const haystack = [
		item.borrowerEmail,
		item.borrowerLabel,
		item.mortgageLabel,
		item.planEntryId,
		item.referenceNumber,
		item.transferRequestId,
		...item.obligationIds,
	]
		.filter((value): value is string => typeof value === "string")
		.join(" ")
		.toLowerCase();
	return haystack.includes(search);
}

function emptyKanban() {
	return {
		upcoming: [] as OfflineOperationItem[],
		due: [] as OfflineOperationItem[],
		inProgress: [] as OfflineOperationItem[],
		staffOverdue: [] as OfflineOperationItem[],
		overdue: [] as OfflineOperationItem[],
		delinquent: [] as OfflineOperationItem[],
		confirmed: [] as OfflineOperationItem[],
	};
}

function addToKanban(
	kanban: ReturnType<typeof emptyKanban>,
	item: OfflineOperationItem
) {
	switch (item.bucket) {
		case "upcoming":
			kanban.upcoming.push(item);
			break;
		case "due":
			kanban.due.push(item);
			break;
		case "in_progress":
			kanban.inProgress.push(item);
			break;
		case "staff_overdue":
			kanban.staffOverdue.push(item);
			break;
		case "overdue":
			kanban.overdue.push(item);
			break;
		case "delinquent":
			kanban.delinquent.push(item);
			break;
		case "confirmed":
			kanban.confirmed.push(item);
			break;
		default:
			break;
	}
}

function confirmedCursorFor(item: OfflineOperationItem) {
	return `${item.confirmedAt ?? 0}:${item.planEntryId}`;
}

function paginateConfirmed(
	items: OfflineOperationItem[],
	args: { confirmedCursor?: string; confirmedLimit?: number }
) {
	const limit = Math.max(
		1,
		Math.min(
			args.confirmedLimit ?? DEFAULT_CONFIRMED_LIMIT,
			MAX_CONFIRMED_LIMIT
		)
	);
	const sorted = [...items].sort((left, right) => {
		const confirmedDelta = (right.confirmedAt ?? 0) - (left.confirmedAt ?? 0);
		if (confirmedDelta !== 0) {
			return confirmedDelta;
		}
		return String(right.planEntryId).localeCompare(
			String(left.planEntryId),
			"en"
		);
	});

	const startIndex = args.confirmedCursor
		? sorted.findIndex(
				(item) => confirmedCursorFor(item) === args.confirmedCursor
			) + 1
		: 0;
	const boundedStart = Math.max(0, startIndex);
	const page = sorted.slice(boundedStart, boundedStart + limit);
	const hasMore = boundedStart + limit < sorted.length;
	const lastPageItem = page.at(-1);
	return {
		items: page,
		nextCursor:
			hasMore && lastPageItem ? confirmedCursorFor(lastPageItem) : null,
	};
}

function buildGroupedEntries(items: OfflineOperationItem[]) {
	return items
		.sort((left, right) => left.scheduledDate - right.scheduledDate)
		.map((item) => ({
			amount: item.amount,
			borrowerEmail: item.borrowerEmail,
			borrowerLabel: item.borrowerLabel,
			bucket: item.bucket,
			installments: [
				{
					amount: item.amount,
					bucket: item.bucket,
					obligationIds: item.obligationIds,
					obligations: item.obligations,
					planEntryId: item.planEntryId,
					scheduledDate: item.scheduledDate,
					status: item.status,
				},
			],
			mortgageId: item.mortgageId,
			mortgageLabel: item.mortgageLabel,
			planEntryId: item.planEntryId,
			scheduledDate: item.scheduledDate,
			workoutPlanId: item.workoutPlanId,
		}));
}

export const getOfflinePaymentOperationsSnapshot = paymentQuery
	.input({
		asOf: v.optional(v.number()),
		...offlineFiltersValidator,
	})
	.handler(async (ctx, args) => {
		const asOf = args.asOf ?? Date.now();
		const entries = await ctx.db.query("collectionPlanEntries").collect();
		const items: OfflineOperationItem[] = [];

		for (const entry of entries) {
			const loaded = await loadOfflinePlanEntry(ctx, entry._id);
			if (!loaded) {
				continue;
			}
			const item = await buildOfflineItem(ctx, { asOf, loaded });
			if (item && itemMatchesFilters(item, args)) {
				items.push(item);
			}
		}

		const singleItems = items.filter((item) => !item.isGrouped);
		const groupedItems = items.filter((item) => item.isGrouped);
		const confirmedPage = paginateConfirmed(
			singleItems.filter((item) => item.bucket === "confirmed"),
			args
		);
		const kanban = emptyKanban();
		for (const item of singleItems) {
			if (item.bucket === "confirmed") {
				continue;
			}
			addToKanban(kanban, item);
		}
		kanban.confirmed = confirmedPage.items;

		const calendarEvents = items
			.map((item) => ({
				amount: item.amount,
				borrowerLabel: item.borrowerLabel,
				bucket: item.bucket,
				isGrouped: item.isGrouped,
				mortgageLabel: item.mortgageLabel,
				planEntryId: item.planEntryId,
				scheduledDate: item.scheduledDate,
				title: `${item.borrowerLabel} - ${item.mortgageLabel}`,
			}))
			.sort((left, right) => left.scheduledDate - right.scheduledDate);

		return {
			asOf,
			calendarEvents,
			agenda: calendarEvents,
			confirmedPage,
			counters: {
				confirmed: confirmedPage.items.length,
				delinquent: kanban.delinquent.length,
				due: kanban.due.length,
				grouped: groupedItems.length,
				inProgress: kanban.inProgress.length,
				overdue: kanban.overdue.length,
				staffOverdue: kanban.staffOverdue.length,
				upcoming: kanban.upcoming.length,
			},
			groupedEntries: buildGroupedEntries(groupedItems),
			kanban,
		};
	})
	.public();

function assertLoadedOfflinePlanEntry(
	loaded: LoadedOfflinePlanEntry | null
): LoadedOfflinePlanEntry {
	if (!loaded) {
		throw new ConvexError("Offline collection plan entry not found");
	}
	if (!isOfflinePlanEntry(loaded.planEntry)) {
		throw new ConvexError("Only offline/manual plan entries are supported");
	}
	if (loaded.obligations.length !== loaded.planEntry.obligationIds.length) {
		throw new ConvexError("Offline plan entry has missing obligations");
	}
	return loaded;
}

function assertEvidenceInput(evidence: OfflineEvidenceInput | undefined) {
	if (!evidence) {
		throw new ConvexError("Offline confirmation evidence is required");
	}
	const attachmentIds = evidence.attachmentIds
		.map((attachmentId) => attachmentId.trim())
		.filter((attachmentId) => attachmentId.length > 0);
	const note = requireText(
		evidence.note,
		"Offline confirmation evidence note is required"
	);
	if (attachmentIds.length === 0) {
		throw new ConvexError(
			"Offline confirmation evidence attachment is required"
		);
	}
	return { attachmentIds, note };
}

function adminCommandSource(actorId: string): CommandSource {
	return {
		actorId,
		actorType: "admin",
		channel: "admin_dashboard",
	};
}

async function runPlanEntryExecution(
	ctx: Pick<OfflineActionCtx, "runAction" | "viewer">,
	args: {
		allowEarlyStart?: boolean;
		idempotencyKeyPrefix: string;
		planEntryId: Id<"collectionPlanEntries">;
		reason?: string;
		requestedAt: number;
	}
): Promise<ExecutePlanEntryResult> {
	return ctx.runAction(
		internal.payments.collectionPlan.execution.executePlanEntry,
		{
			allowEarlyStart: args.allowEarlyStart,
			idempotencyKey: `${args.idempotencyKeyPrefix}:${args.planEntryId}:${ctx.viewer.authId}:${args.requestedAt}`,
			planEntryId: args.planEntryId,
			reason: args.reason,
			requestedAt: args.requestedAt,
			requestedByActorId: ctx.viewer.authId,
			requestedByActorType: "admin",
			triggerSource: "admin_manual",
		}
	);
}

async function loadForAction(
	ctx: Pick<OfflineActionCtx, "runQuery">,
	planEntryId: Id<"collectionPlanEntries">
): Promise<LoadedOfflinePlanEntry> {
	return assertLoadedOfflinePlanEntry(
		await ctx.runQuery(
			internal.payments.offlineOperations.loadOfflinePlanEntryForAction,
			{ planEntryId }
		)
	);
}

function validateEarlyStart(args: {
	asOf: number;
	earlyStartReason?: string;
	planEntry: Doc<"collectionPlanEntries">;
	reason?: string;
}) {
	if (args.planEntry.scheduledDate <= args.asOf) {
		return { allowEarlyStart: false, reason: trimNonEmpty(args.reason) };
	}

	const asOfDate = toUtcDate(args.asOf);
	const scheduledDate = toUtcDate(args.planEntry.scheduledDate);
	const maxEarlyStartDate = addBusinessDays(asOfDate, 3);
	if (scheduledDate > maxEarlyStartDate) {
		throw new ConvexError(
			"Upcoming offline collections can only be started within the next three business days"
		);
	}

	return {
		allowEarlyStart: true,
		reason: requireText(
			args.earlyStartReason,
			"Starting an Upcoming offline collection requires an early-start reason"
		),
	};
}

export const recordOfflineActivity = internalMutation({
	args: {
		action: v.union(
			v.literal("assigned"),
			v.literal("cleared_assignment"),
			v.literal("confirmed"),
			v.literal("noted"),
			v.literal("released"),
			v.literal("started")
		),
		actorId: v.string(),
		collectionAttemptId: v.optional(v.id("collectionAttempts")),
		metadata: v.optional(v.record(v.string(), v.any())),
		note: v.optional(v.string()),
		planEntryId: v.id("collectionPlanEntries"),
		reason: v.optional(v.string()),
		replacementPlanEntryId: v.optional(v.id("collectionPlanEntries")),
		transferRequestId: v.optional(v.id("transferRequests")),
	},
	handler: async (ctx, args) => {
		return ctx.db.insert("offlinePaymentActivities", {
			...args,
			createdAt: Date.now(),
		});
	},
});

export const patchPlanEntryObligationOrder = internalMutation({
	args: {
		obligationIds: v.array(v.id("obligations")),
		planEntryId: v.id("collectionPlanEntries"),
	},
	handler: async (ctx, args) => {
		const planEntry = await ctx.db.get(args.planEntryId);
		if (!planEntry) {
			throw new ConvexError("Offline collection plan entry not found");
		}
		const existing = new Set(planEntry.obligationIds.map(String));
		const next = new Set(args.obligationIds.map(String));
		if (
			existing.size !== next.size ||
			![...existing].every((obligationId) => next.has(obligationId))
		) {
			throw new ConvexError(
				"Replacement obligation order must contain the same obligations"
			);
		}
		await ctx.db.patch(args.planEntryId, {
			obligationIds: args.obligationIds,
		});
	},
});

export const recordOfflineEvidence = internalMutation({
	args: {
		amount: v.number(),
		attachmentIds: v.array(v.string()),
		chequeNumber: v.optional(v.string()),
		collectionAttemptId: v.optional(v.id("collectionAttempts")),
		createdByActorId: v.string(),
		depositReference: v.optional(v.string()),
		instrumentType: v.union(v.literal("cash"), v.literal("cheque")),
		mortgageId: v.id("mortgages"),
		note: v.string(),
		obligationIds: v.array(v.id("obligations")),
		planEntryId: v.id("collectionPlanEntries"),
		receivedAt: v.optional(v.number()),
		referenceNumber: v.optional(v.string()),
		transferRequestId: v.optional(v.id("transferRequests")),
	},
	handler: async (ctx, args) => {
		return ctx.db.insert("offlinePaymentEvidence", {
			amount: args.amount,
			attachmentIds: args.attachmentIds,
			chequeNumber: args.chequeNumber,
			collectionAttemptId: args.collectionAttemptId,
			createdAt: Date.now(),
			createdByActorId: args.createdByActorId,
			depositReference: args.depositReference,
			instrumentType: args.instrumentType,
			isImmutable: true,
			mortgageId: args.mortgageId,
			note: args.note,
			obligationIds: args.obligationIds,
			planEntryId: args.planEntryId,
			receivedAt: args.receivedAt,
			referenceNumber: args.referenceNumber,
			transferRequestId: args.transferRequestId,
		});
	},
});

export const startCollection = paymentAction
	.input({
		asOf: v.optional(v.number()),
		earlyStartReason: v.optional(v.string()),
		planEntryId: v.id("collectionPlanEntries"),
		reason: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		const asOf = args.asOf ?? Date.now();
		const loaded = await loadForAction(ctx, args.planEntryId);
		if (loaded.planEntry.method !== "manual_review") {
			throw new ConvexError(
				"Starting offline collection requires a manual_review plan entry"
			);
		}
		const earlyStart = validateEarlyStart({
			asOf,
			earlyStartReason: args.earlyStartReason,
			planEntry: loaded.planEntry,
			reason: args.reason,
		});

		const result = await runPlanEntryExecution(ctx, {
			allowEarlyStart: earlyStart.allowEarlyStart,
			idempotencyKeyPrefix: "offline-start",
			planEntryId: args.planEntryId,
			reason: earlyStart.reason,
			requestedAt: asOf,
		});
		if (
			result.outcome !== "attempt_created" &&
			result.outcome !== "already_executed"
		) {
			throw new ConvexError(
				result.reasonDetail ?? "Offline collection could not be started"
			);
		}

		const refreshed = await loadForAction(ctx, args.planEntryId);
		await ctx.runMutation(
			internal.payments.offlineOperations.recordOfflineActivity,
			{
				action: "started",
				actorId: ctx.viewer.authId,
				collectionAttemptId: refreshed.attempt?._id,
				metadata: { earlyStart: earlyStart.allowEarlyStart },
				planEntryId: args.planEntryId,
				reason: earlyStart.reason,
				transferRequestId: refreshed.transfer?._id,
			}
		);

		return {
			collectionAttemptId: refreshed.attempt?._id,
			outcome: "started" as const,
			planEntryId: args.planEntryId,
			transferRequestId: refreshed.transfer?._id,
			transferStatus: refreshed.transfer?.status,
		};
	})
	.public();

async function ensureTransferForConfirmation(
	ctx: Pick<OfflineActionCtx, "runAction" | "runQuery" | "viewer">,
	args: {
		asOf: number;
		planEntryId: Id<"collectionPlanEntries">;
	}
): Promise<LoadedOfflinePlanEntry> {
	let loaded = await loadForAction(ctx, args.planEntryId);
	if (!(loaded.transfer && loaded.attempt)) {
		const result = await runPlanEntryExecution(ctx, {
			idempotencyKeyPrefix: "offline-confirm-start",
			planEntryId: args.planEntryId,
			reason: "Offline payment confirmation",
			requestedAt: args.asOf,
		});
		if (
			result.outcome !== "attempt_created" &&
			result.outcome !== "already_executed"
		) {
			throw new ConvexError(
				result.reasonDetail ??
					"Offline collection could not be prepared for confirmation"
			);
		}
		loaded = await loadForAction(ctx, args.planEntryId);
	}
	if (!(loaded.attempt && loaded.transfer)) {
		throw new ConvexError(
			"Offline confirmation requires a linked collection attempt and transfer"
		);
	}
	if (loaded.transfer.status === "confirmed") {
		throw new ConvexError("Offline collection is already confirmed");
	}
	if (!ACTIVE_TRANSFER_STATUSES.has(loaded.transfer.status)) {
		throw new ConvexError(
			`Offline transfer is ${loaded.transfer.status} and cannot be confirmed`
		);
	}
	return loaded;
}

function buildManualSettlement(args: {
	actorId: string;
	asOf: number;
	evidenceAttachmentIds: string[];
	evidenceNote: string;
	instrument: OfflineInstrumentInput;
}): ManualSettlementDetails {
	const occurredAt = args.instrument.receivedAt ?? args.asOf;
	return {
		chequeNumber: trimNonEmpty(args.instrument.chequeNumber),
		depositReference: trimNonEmpty(args.instrument.depositReference),
		enteredBy: args.actorId,
		evidenceAttachmentIds: args.evidenceAttachmentIds,
		externalReference:
			trimNonEmpty(args.instrument.referenceNumber) ??
			trimNonEmpty(args.instrument.chequeNumber) ??
			trimNonEmpty(args.instrument.depositReference),
		instrumentType: args.instrument.type,
		notes: trimNonEmpty(args.instrument.notes) ?? args.evidenceNote,
		receivedAt: args.instrument.receivedAt,
		referenceNumber: trimNonEmpty(args.instrument.referenceNumber),
		settlementOccurredAt: occurredAt,
	};
}

async function confirmLoadedOfflineCollection(
	ctx: Pick<OfflineActionCtx, "runMutation" | "viewer">,
	args: {
		amount: number;
		asOf: number;
		evidence: OfflineEvidenceInput;
		instrument: OfflineInstrumentInput;
		loaded: LoadedOfflinePlanEntry;
	}
): Promise<ConfirmOfflineCollectionResult> {
	if (!(args.loaded.attempt && args.loaded.transfer)) {
		throw new ConvexError(
			"Offline confirmation requires a linked attempt and transfer"
		);
	}
	const evidence = assertEvidenceInput(args.evidence);
	const evidenceId = await ctx.runMutation(
		internal.payments.offlineOperations.recordOfflineEvidence,
		{
			amount: args.amount,
			attachmentIds: evidence.attachmentIds,
			chequeNumber: args.instrument.chequeNumber,
			collectionAttemptId: args.loaded.attempt._id,
			createdByActorId: ctx.viewer.authId,
			depositReference: args.instrument.depositReference,
			instrumentType: args.instrument.type,
			mortgageId: args.loaded.planEntry.mortgageId,
			note: evidence.note,
			obligationIds: args.loaded.planEntry.obligationIds,
			planEntryId: args.loaded.planEntry._id,
			receivedAt: args.instrument.receivedAt,
			referenceNumber: args.instrument.referenceNumber,
			transferRequestId: args.loaded.transfer._id,
		}
	);
	const manualSettlement = buildManualSettlement({
		actorId: ctx.viewer.authId,
		asOf: args.asOf,
		evidenceAttachmentIds: [String(evidenceId), ...evidence.attachmentIds],
		evidenceNote: evidence.note,
		instrument: args.instrument,
	});

	const transition = await ctx.runMutation(
		internal.payments.transfers.mutations.confirmManualTransferInternal,
		{
			manualSettlement,
			providerRef:
				args.loaded.transfer.providerRef ??
				`offline-${args.instrument.type}:${args.loaded.transfer._id}`,
			source: adminCommandSource(ctx.viewer.authId),
			transferId: args.loaded.transfer._id,
		}
	);

	await ctx.runMutation(
		internal.payments.offlineOperations.recordOfflineActivity,
		{
			action: "confirmed",
			actorId: ctx.viewer.authId,
			collectionAttemptId: args.loaded.attempt._id,
			metadata: {
				amount: args.amount,
				evidenceId: String(evidenceId),
				instrumentType: args.instrument.type,
			},
			planEntryId: args.loaded.planEntry._id,
			transferRequestId: args.loaded.transfer._id,
		}
	);

	return {
		collectionAttemptId: args.loaded.attempt._id,
		evidenceId,
		outcome: "confirmed" as const,
		planEntryId: args.loaded.planEntry._id,
		transferRequestId: args.loaded.transfer._id,
		transferStatus: transition.newState,
	};
}

export const confirmCollection = paymentAction
	.input({
		amount: v.number(),
		asOf: v.optional(v.number()),
		evidence: v.optional(offlineEvidenceInputValidator),
		instrument: offlineInstrumentInputValidator,
		planEntryId: v.id("collectionPlanEntries"),
	})
	.handler(async (ctx, args) => {
		const asOf = args.asOf ?? Date.now();
		const evidence = assertEvidenceInput(args.evidence);
		const loaded = await loadForAction(ctx, args.planEntryId);
		if (loaded.planEntry.obligationIds.length !== 1) {
			throw new ConvexError(
				"Single-card confirmation requires exactly one obligation"
			);
		}
		const remainingAmount = totalRemaining(loaded.obligations);
		if (args.amount !== remainingAmount) {
			throw new ConvexError(
				"Single-obligation offline confirmation amount must equal the exact remaining collectible amount"
			);
		}
		const prepared = await ensureTransferForConfirmation(ctx, {
			asOf,
			planEntryId: args.planEntryId,
		});
		return confirmLoadedOfflineCollection(ctx, {
			amount: args.amount,
			asOf,
			evidence,
			instrument: args.instrument,
			loaded: prepared,
		});
	})
	.public();

export const confirmGroupedInstallment = paymentAction
	.input({
		amount: v.number(),
		asOf: v.optional(v.number()),
		evidence: offlineEvidenceInputValidator,
		instrument: offlineInstrumentInputValidator,
		planEntryId: v.id("collectionPlanEntries"),
	})
	.handler(async (ctx, args) => {
		const asOf = args.asOf ?? Date.now();
		const loaded = await loadForAction(ctx, args.planEntryId);
		if (loaded.planEntry.obligationIds.length <= 1) {
			throw new ConvexError(
				"Grouped installment confirmation requires multiple obligations"
			);
		}
		if (args.amount !== loaded.planEntry.amount) {
			throw new ConvexError(
				"Grouped installment confirmation amount must equal the planned installment amount"
			);
		}
		if (args.amount > totalRemaining(loaded.obligations)) {
			throw new ConvexError(
				"Grouped installment amount exceeds covered outstanding balance"
			);
		}

		const sortedObligations = [...loaded.obligations].sort(
			compareObligationSettlementOrder
		);
		await ctx.runMutation(
			internal.payments.offlineOperations.patchPlanEntryObligationOrder,
			{
				obligationIds: sortedObligations.map((obligation) => obligation._id),
				planEntryId: args.planEntryId,
			}
		);

		const prepared = await ensureTransferForConfirmation(ctx, {
			asOf,
			planEntryId: args.planEntryId,
		});
		return confirmLoadedOfflineCollection(ctx, {
			amount: args.amount,
			asOf,
			evidence: assertEvidenceInput(args.evidence),
			instrument: args.instrument,
			loaded: prepared,
		});
	})
	.public();

export const assignCollector = paymentMutation
	.input({
		assignedCollectorActorId: v.optional(v.string()),
		planEntryId: v.id("collectionPlanEntries"),
		reason: v.string(),
	})
	.handler(async (ctx, args) => {
		const loaded = assertLoadedOfflinePlanEntry(
			await loadOfflinePlanEntry(ctx, args.planEntryId)
		);
		const reason = requireText(args.reason, "Assignment reason is required");
		const assignedCollectorActorId = trimNonEmpty(
			args.assignedCollectorActorId
		);
		const now = Date.now();
		await ctx.db.patch(args.planEntryId, {
			assignedAt: assignedCollectorActorId ? now : undefined,
			assignedByActorId: ctx.viewer.authId,
			assignedCollectorActorId,
			assignmentReason: reason,
		});
		await ctx.db.insert("offlinePaymentActivities", {
			action: assignedCollectorActorId ? "assigned" : "cleared_assignment",
			actorId: ctx.viewer.authId,
			collectionAttemptId: loaded.attempt?._id,
			createdAt: now,
			planEntryId: args.planEntryId,
			reason,
			transferRequestId: loaded.transfer?._id,
		});
		return {
			assignedCollectorActorId,
			outcome: assignedCollectorActorId ? "assigned" : "cleared_assignment",
			planEntryId: args.planEntryId,
		};
	})
	.public();

export const addCollectionNote = paymentMutation
	.input({
		note: v.string(),
		planEntryId: v.id("collectionPlanEntries"),
	})
	.handler(async (ctx, args) => {
		const loaded = assertLoadedOfflinePlanEntry(
			await loadOfflinePlanEntry(ctx, args.planEntryId)
		);
		const note = requireText(args.note, "Collection note is required");
		await ctx.db.insert("offlinePaymentActivities", {
			action: "noted",
			actorId: ctx.viewer.authId,
			collectionAttemptId: loaded.attempt?._id,
			createdAt: Date.now(),
			note,
			planEntryId: args.planEntryId,
			transferRequestId: loaded.transfer?._id,
		});
		return { outcome: "noted" as const, planEntryId: args.planEntryId };
	})
	.public();

function assertReleasable(args: {
	attempt: Doc<"collectionAttempts"> | null;
	planEntry: Doc<"collectionPlanEntries">;
	transfer: Doc<"transferRequests"> | null;
}): asserts args is {
	attempt: Doc<"collectionAttempts">;
	planEntry: Doc<"collectionPlanEntries">;
	transfer: Doc<"transferRequests">;
} {
	if (!(args.attempt && args.transfer)) {
		throw new ConvexError(
			"Release requires an active manual-review attempt and transfer"
		);
	}
	if (args.planEntry.status !== "executing") {
		throw new ConvexError("Release requires an executing offline plan entry");
	}
	if (args.transfer.providerCode !== "manual_review") {
		throw new ConvexError(
			"Only manual_review transfers can be released from offline operations"
		);
	}
	if (!ACTIVE_ATTEMPT_STATUSES.has(args.attempt.status)) {
		throw new ConvexError(
			`Collection attempt is ${args.attempt.status} and cannot be released`
		);
	}
	if (!ACTIVE_TRANSFER_STATUSES.has(args.transfer.status)) {
		throw new ConvexError(
			`Transfer is ${args.transfer.status} and cannot be released`
		);
	}
}

async function cancelTransferThroughGovernedTransition(
	ctx: MutationCtx,
	args: {
		reason: string;
		source: CommandSource;
		transferId: Id<"transferRequests">;
	}
) {
	return executeTransition(ctx, {
		entityId: args.transferId,
		entityType: "transfer",
		eventType: "TRANSFER_CANCELLED",
		payload: { reason: args.reason },
		source: args.source,
	});
}

export const releaseCollectionAttempt = paymentMutation
	.input({
		planEntryId: v.id("collectionPlanEntries"),
		reason: v.string(),
	})
	.handler(async (ctx, args) => {
		const loaded = assertLoadedOfflinePlanEntry(
			await loadOfflinePlanEntry(ctx, args.planEntryId)
		);
		const reason = requireText(args.reason, "Release reason is required");
		assertReleasable(loaded);
		const source = buildSource(ctx.viewer, "admin_dashboard");

		const transferResult = await cancelTransferThroughGovernedTransition(ctx, {
			reason,
			source,
			transferId: loaded.transfer._id,
		});
		if (!transferResult.success) {
			throw new ConvexError(
				transferResult.reason ?? "Transfer cancellation transition failed"
			);
		}

		const attemptAfterTransfer = await ctx.db.get(loaded.attempt._id);
		if (attemptAfterTransfer && attemptAfterTransfer.status !== "cancelled") {
			const attemptResult = await executeTransition(ctx, {
				entityId: loaded.attempt._id,
				entityType: "collectionAttempt",
				eventType: "ATTEMPT_CANCELLED",
				payload: { reason },
				source,
			});
			if (!attemptResult.success) {
				throw new ConvexError(
					attemptResult.reason ??
						"Collection attempt cancellation transition failed"
				);
			}
		}

		const now = Date.now();
		await ctx.db.patch(args.planEntryId, {
			cancelledAt: now,
			status: "cancelled",
		});
		const replacementPlanEntryId = await createEntryImpl(ctx, {
			amount: loaded.planEntry.amount,
			executionMode: loaded.planEntry.executionMode ?? "app_owned",
			method: loaded.planEntry.method,
			obligationIds: loaded.planEntry.obligationIds,
			rescheduleReason: `Released offline collection attempt: ${reason}`,
			rescheduleRequestedAt: now,
			rescheduleRequestedByActorId: ctx.viewer.authId,
			rescheduleRequestedByActorType: "admin",
			rescheduledFromId: args.planEntryId,
			scheduledDate: loaded.planEntry.scheduledDate,
			source: "admin_reschedule",
			status: "planned",
			workoutPlanId: loaded.planEntry.workoutPlanId,
		});

		await ctx.db.insert("offlinePaymentActivities", {
			action: "released",
			actorId: ctx.viewer.authId,
			collectionAttemptId: loaded.attempt._id,
			createdAt: now,
			planEntryId: args.planEntryId,
			reason,
			replacementPlanEntryId,
			transferRequestId: loaded.transfer._id,
		});

		return {
			newPlanEntryId: replacementPlanEntryId,
			oldPlanEntryId: args.planEntryId,
			outcome: "released" as const,
		};
	})
	.public();
