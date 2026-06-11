import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { auditLog } from "../../auditLog";
import { executeTransition } from "../../engine/transition";
import type { CommandSource } from "../../engine/types";
import { convex } from "../../fluent";
import { createTransferRequestRecord } from "../transfers/mutations";
import { obligationTypeToTransferType } from "../transfers/types";
import { isTransferAlreadyInTargetState } from "../webhooks/transferCore";
import type { NormalizedExternalCollectionOccurrenceEvent } from "./types";
import { normalizedExternalCollectionOccurrenceEventValidator } from "./validators";

function parseBusinessDateToUtcRange(businessDate: string) {
	const start = Date.parse(`${businessDate}T00:00:00.000Z`);
	if (Number.isNaN(start)) {
		throw new ConvexError(
			`Invalid scheduledDate "${businessDate}" received from external provider`
		);
	}
	return {
		start,
		endExclusive: start + 86_400_000,
	};
}

function buildOccurrenceKey(args: {
	externalOccurrenceOrdinal?: number;
	externalOccurrenceRef?: string;
	externalScheduleRef: string;
	providerCode: "pad_rotessa";
	providerRef?: string;
	scheduledDate?: string;
}) {
	const providerRef = normalizeProviderRefForIdentity(args.providerRef);
	return [
		args.providerCode,
		args.externalScheduleRef,
		args.externalOccurrenceRef ?? "no-occurrence-ref",
		providerRef ?? "no-provider-ref",
		args.externalOccurrenceOrdinal ?? "no-ordinal",
		args.scheduledDate ?? "no-date",
	].join(":");
}

function normalizeProviderRefForIdentity(providerRef?: string | null) {
	if (providerRef === undefined || providerRef === null) {
		return undefined;
	}
	const normalized = providerRef.trim();
	if (!normalized) {
		return undefined;
	}
	const lowercase = normalized.toLowerCase();
	if (lowercase === "null" || lowercase === "undefined") {
		return undefined;
	}
	return normalized;
}

function buildOccurrenceSource(
	receivedVia: "poller" | "webhook"
): CommandSource {
	return {
		actorId:
			receivedVia === "webhook"
				? "provider:pad_rotessa:webhook"
				: "provider:pad_rotessa:poller",
		actorType: "system",
		channel: receivedVia === "webhook" ? "api_webhook" : "scheduler",
	};
}

function shouldApplyProviderMirrorUpdate(args: {
	currentReportedAt?: number;
	occurredAt?: number;
}) {
	return (
		args.occurredAt === undefined ||
		args.occurredAt >= (args.currentReportedAt ?? 0)
	);
}

function canReplaceTransferProviderRef(args: {
	providerRef?: string | null;
	transferId: Id<"transferRequests">;
}) {
	const providerRef = normalizeProviderRefForIdentity(args.providerRef);
	return (
		providerRef === undefined ||
		providerRef === `provider-managed:${args.transferId}`
	);
}

function isTerminalProviderLifecycleStatus(status?: string) {
	return (
		status === "Approved" || status === "Declined" || status === "Chargeback"
	);
}

function isNonTerminalProviderLifecycleStatus(status: string) {
	return status === "Future" || status === "Pending";
}

function shouldPreserveTerminalProviderMirror(args: {
	currentProviderLifecycleStatus?: string;
	incomingProviderLifecycleStatus: string;
}) {
	return (
		isTerminalProviderLifecycleStatus(args.currentProviderLifecycleStatus) &&
		isNonTerminalProviderLifecycleStatus(args.incomingProviderLifecycleStatus)
	);
}

function buildCollectionAttemptProviderMirrorPatch(args: {
	currentProviderLifecycleStatus?: string;
	currentProviderOccurrenceKey?: string;
	currentReportedAt?: number;
	event: IngestOccurrenceEvent;
	providerOccurrenceKey?: string;
}) {
	const patch: {
		providerOccurrenceKey?: string;
		providerLifecycleStatus?: string;
		providerLifecycleReason?: string;
		providerLastReportedAt?: number;
		providerLastReportedVia?: "poller" | "webhook";
	} = {};
	const shouldPreserveTerminalMirror = shouldPreserveTerminalProviderMirror({
		currentProviderLifecycleStatus: args.currentProviderLifecycleStatus,
		incomingProviderLifecycleStatus: args.event.rawProviderStatus,
	});

	if (
		args.providerOccurrenceKey !== undefined &&
		!(
			shouldPreserveTerminalMirror &&
			args.currentProviderOccurrenceKey !== undefined
		)
	) {
		patch.providerOccurrenceKey = args.providerOccurrenceKey;
	}

	if (
		!shouldPreserveTerminalMirror &&
		shouldApplyProviderMirrorUpdate({
			currentReportedAt: args.currentReportedAt,
			occurredAt: args.event.occurredAt,
		})
	) {
		patch.providerLifecycleStatus = args.event.rawProviderStatus;
		patch.providerLifecycleReason = args.event.rawProviderReason;
		patch.providerLastReportedAt = args.event.occurredAt ?? Date.now();
		patch.providerLastReportedVia = args.event.receivedVia;
	}

	return patch;
}

function assertTransitionSucceeded(
	result: Awaited<ReturnType<typeof executeTransition>>,
	args: {
		entityId: string;
		entityType: "collectionAttempt" | "transfer";
		eventType: string;
	}
) {
	if (result.success) {
		return;
	}
	throw new ConvexError(
		`Provider-managed occurrence transition ${args.entityType}/${args.entityId} -> ${args.eventType} was rejected: ${result.reason}`
	);
}

type IngestOccurrenceMutationCtx = MutationCtx;
type IngestOccurrenceEvent = NormalizedExternalCollectionOccurrenceEvent;
type CollectionAttemptDoc = Doc<"collectionAttempts">;
type CollectionPlanEntryDoc = Doc<"collectionPlanEntries">;
type ExternalCollectionScheduleDoc = Doc<"externalCollectionSchedules">;
type TransferRequestDoc = Doc<"transferRequests">;

type OccurrenceMatchedBy =
	| "existing_transfer"
	| "external_occurrence_ref"
	| "external_schedule_ordinal"
	| "external_schedule_obligation_date"
	| "external_schedule_date"
	| "unresolved";

async function resolveScheduleId(
	ctx: IngestOccurrenceMutationCtx,
	args: {
		externalScheduleRef: string;
		providerCode: "pad_rotessa";
	}
): Promise<ExternalCollectionScheduleDoc | null> {
	return ctx.db
		.query("externalCollectionSchedules")
		.withIndex("by_provider_ref", (q) =>
			q
				.eq("providerCode", args.providerCode)
				.eq("externalScheduleRef", args.externalScheduleRef)
		)
		.first();
}

async function resolvePlanEntryByOccurrence(
	ctx: IngestOccurrenceMutationCtx,
	args: {
		event: IngestOccurrenceEvent;
		externalCollectionScheduleId?: Id<"externalCollectionSchedules">;
	}
): Promise<CollectionPlanEntryDoc | null> {
	if (args.event.externalOccurrenceRef) {
		if (args.externalCollectionScheduleId) {
			const byScopedOccurrenceRef = await ctx.db
				.query("collectionPlanEntries")
				.withIndex("by_external_schedule_occurrence_ref", (q) =>
					q
						.eq(
							"externalCollectionScheduleId",
							args.externalCollectionScheduleId
						)
						.eq("externalOccurrenceRef", args.event.externalOccurrenceRef)
				)
				.first();
			if (byScopedOccurrenceRef) {
				return byScopedOccurrenceRef;
			}
		}

		const byOccurrenceRef = await ctx.db
			.query("collectionPlanEntries")
			.withIndex("by_external_occurrence_ref", (q) =>
				q.eq("externalOccurrenceRef", args.event.externalOccurrenceRef)
			)
			.first();
		if (byOccurrenceRef) {
			return byOccurrenceRef;
		}
	}

	if (
		args.externalCollectionScheduleId &&
		args.event.externalOccurrenceOrdinal !== undefined
	) {
		const byOrdinal = await ctx.db
			.query("collectionPlanEntries")
			.withIndex("by_external_schedule_ordinal", (q) =>
				q
					.eq("externalCollectionScheduleId", args.externalCollectionScheduleId)
					.eq("externalOccurrenceOrdinal", args.event.externalOccurrenceOrdinal)
			)
			.first();
		if (byOrdinal) {
			return byOrdinal;
		}
	}

	if (args.externalCollectionScheduleId && args.event.scheduledDate) {
		const dayRange = parseBusinessDateToUtcRange(args.event.scheduledDate);
		const candidates = await ctx.db
			.query("collectionPlanEntries")
			.withIndex("by_external_schedule_date", (q) =>
				q
					.eq("externalCollectionScheduleId", args.externalCollectionScheduleId)
					.gte("scheduledDate", dayRange.start)
					.lt("scheduledDate", dayRange.endExclusive)
			)
			.collect();
		if (candidates.length > 1) {
			throw new ConvexError(
				`Multiple collection plan entries matched external schedule ${args.externalCollectionScheduleId} for scheduledDate ${args.event.scheduledDate}`
			);
		}
		return candidates[0] ?? null;
	}

	return null;
}

async function resolvePlanEntryByObligationDueDate(
	ctx: IngestOccurrenceMutationCtx,
	args: {
		event: IngestOccurrenceEvent;
		externalCollectionScheduleId?: Id<"externalCollectionSchedules">;
	}
): Promise<CollectionPlanEntryDoc | null> {
	if (!(args.externalCollectionScheduleId && args.event.scheduledDate)) {
		return null;
	}

	const dayRange = parseBusinessDateToUtcRange(args.event.scheduledDate);
	const candidates = await ctx.db
		.query("collectionPlanEntries")
		.withIndex("by_external_schedule_date", (q) =>
			q.eq("externalCollectionScheduleId", args.externalCollectionScheduleId)
		)
		.collect();
	const matchedEntries: CollectionPlanEntryDoc[] = [];

	for (const entry of candidates) {
		const obligations = await Promise.all(
			entry.obligationIds.map((obligationId) => ctx.db.get(obligationId))
		);
		if (
			obligations.some(
				(obligation) =>
					obligation &&
					obligation.dueDate >= dayRange.start &&
					obligation.dueDate < dayRange.endExclusive
			)
		) {
			matchedEntries.push(entry);
		}
	}

	if (matchedEntries.length > 1) {
		throw new ConvexError(
			`Multiple collection plan entries matched external schedule ${args.externalCollectionScheduleId} for obligation due date ${args.event.scheduledDate}`
		);
	}

	return matchedEntries[0] ?? null;
}

async function resolveExistingTransfer(
	ctx: IngestOccurrenceMutationCtx,
	event: Pick<IngestOccurrenceEvent, "providerCode" | "providerRef">
): Promise<TransferRequestDoc | null> {
	const providerRef = normalizeProviderRefForIdentity(event.providerRef);
	if (!providerRef) {
		return null;
	}

	return ctx.db
		.query("transferRequests")
		.withIndex("by_provider_ref", (q) =>
			q.eq("providerCode", event.providerCode).eq("providerRef", providerRef)
		)
		.first();
}

function readMetadataString(
	metadata: TransferRequestDoc["metadata"],
	key: string
) {
	const value = metadata?.[key];
	return typeof value === "string" ? value : undefined;
}

function assertOccurrenceGraphConsistency(args: {
	attempt: CollectionAttemptDoc | null;
	existingTransfer: TransferRequestDoc | null;
	linkedSchedule: ExternalCollectionScheduleDoc | null;
	planEntry: CollectionPlanEntryDoc;
}) {
	const linkedSchedule = args.linkedSchedule;
	if (!linkedSchedule) {
		return;
	}

	if (args.planEntry.mortgageId !== linkedSchedule.mortgageId) {
		throw new ConvexError(
			`Provider-managed occurrence matched plan entry ${args.planEntry._id} for mortgage ${args.planEntry.mortgageId}, but external schedule ${linkedSchedule._id} belongs to mortgage ${linkedSchedule.mortgageId}.`
		);
	}

	if (
		args.planEntry.externalCollectionScheduleId &&
		args.planEntry.externalCollectionScheduleId !== linkedSchedule._id
	) {
		throw new ConvexError(
			`Provider-managed occurrence matched plan entry ${args.planEntry._id} bound to external schedule ${args.planEntry.externalCollectionScheduleId}, but the provider event belongs to external schedule ${linkedSchedule._id}.`
		);
	}

	if (args.attempt && args.attempt.mortgageId !== linkedSchedule.mortgageId) {
		throw new ConvexError(
			`Provider-managed occurrence matched collection attempt ${args.attempt._id} for mortgage ${args.attempt.mortgageId}, but external schedule ${linkedSchedule._id} belongs to mortgage ${linkedSchedule.mortgageId}.`
		);
	}

	const existingTransfer = args.existingTransfer;
	if (!existingTransfer) {
		return;
	}

	if (
		existingTransfer.mortgageId &&
		existingTransfer.mortgageId !== linkedSchedule.mortgageId
	) {
		throw new ConvexError(
			`Provider-managed occurrence matched transfer ${existingTransfer._id} for mortgage ${existingTransfer.mortgageId}, but external schedule ${linkedSchedule._id} belongs to mortgage ${linkedSchedule.mortgageId}.`
		);
	}

	const transferScheduleRef = readMetadataString(
		existingTransfer.metadata,
		"externalCollectionScheduleRef"
	);
	if (
		transferScheduleRef &&
		transferScheduleRef !== linkedSchedule.externalScheduleRef
	) {
		throw new ConvexError(
			`Provider-managed occurrence matched transfer ${existingTransfer._id} for external schedule ref ${transferScheduleRef}, but the provider event belongs to external schedule ref ${linkedSchedule.externalScheduleRef}.`
		);
	}
}

async function ensureCollectionAttempt(args: {
	ctx: IngestOccurrenceMutationCtx;
	event: IngestOccurrenceEvent;
	planEntry: CollectionPlanEntryDoc;
}): Promise<CollectionAttemptDoc> {
	const occurrenceKey = buildOccurrenceKey(args.event);
	const existingByOccurrenceKey = await args.ctx.db
		.query("collectionAttempts")
		.withIndex("by_provider_occurrence_key", (q) =>
			q.eq("providerOccurrenceKey", occurrenceKey)
		)
		.first();
	if (existingByOccurrenceKey) {
		await args.ctx.db.patch(
			existingByOccurrenceKey._id,
			buildCollectionAttemptProviderMirrorPatch({
				currentProviderLifecycleStatus:
					existingByOccurrenceKey.providerLifecycleStatus,
				currentProviderOccurrenceKey:
					existingByOccurrenceKey.providerOccurrenceKey,
				currentReportedAt: existingByOccurrenceKey.providerLastReportedAt,
				event: args.event,
				providerOccurrenceKey: occurrenceKey,
			})
		);
		return existingByOccurrenceKey;
	}

	if (args.planEntry.collectionAttemptId) {
		const existingAttempt = await args.ctx.db.get(
			args.planEntry.collectionAttemptId
		);
		if (existingAttempt) {
			await args.ctx.db.patch(
				existingAttempt._id,
				buildCollectionAttemptProviderMirrorPatch({
					currentProviderLifecycleStatus:
						existingAttempt.providerLifecycleStatus,
					currentProviderOccurrenceKey: existingAttempt.providerOccurrenceKey,
					currentReportedAt: existingAttempt.providerLastReportedAt,
					event: args.event,
					providerOccurrenceKey: occurrenceKey,
				})
			);
			return {
				...existingAttempt,
				...(shouldPreserveTerminalProviderMirror({
					currentProviderLifecycleStatus:
						existingAttempt.providerLifecycleStatus,
					incomingProviderLifecycleStatus: args.event.rawProviderStatus,
				}) && existingAttempt.providerOccurrenceKey
					? {}
					: { providerOccurrenceKey: occurrenceKey }),
			} as CollectionAttemptDoc;
		}
	}

	const attemptId = await args.ctx.db.insert("collectionAttempts", {
		status: "initiated",
		machineContext: {
			attemptId: "",
			maxRetries: 3,
			retryCount: 0,
		},
		planEntryId: args.planEntry._id,
		mortgageId: args.planEntry.mortgageId,
		obligationIds: args.planEntry.obligationIds,
		method: args.planEntry.method,
		amount: args.event.amount ?? args.planEntry.amount,
		triggerSource:
			args.event.receivedVia === "webhook"
				? "provider_webhook"
				: "provider_poller",
		executionRequestedAt: args.event.occurredAt ?? Date.now(),
		executionIdempotencyKey: `provider-managed:${occurrenceKey}`,
		requestedByActorType: "system",
		requestedByActorId:
			args.event.receivedVia === "webhook"
				? "pad_rotessa:webhook"
				: "pad_rotessa:poller",
		executionReason: `provider_managed_${args.event.receivedVia}`,
		initiatedAt: Date.now(),
		providerOccurrenceKey: occurrenceKey,
		providerLifecycleStatus: args.event.rawProviderStatus,
		providerLifecycleReason: args.event.rawProviderReason,
		providerLastReportedAt: args.event.occurredAt ?? Date.now(),
		providerLastReportedVia: args.event.receivedVia,
	});

	await args.ctx.db.patch(attemptId, {
		machineContext: {
			attemptId: `${attemptId}`,
			maxRetries: 3,
			retryCount: 0,
		},
	});

	return args.ctx.db.get(attemptId) as Promise<CollectionAttemptDoc>;
}

async function syncCollectionAttemptProviderMirror(args: {
	ctx: IngestOccurrenceMutationCtx;
	attempt: CollectionAttemptDoc;
	event: IngestOccurrenceEvent;
}): Promise<CollectionAttemptDoc> {
	const providerOccurrenceKey = buildOccurrenceKey(args.event);
	await args.ctx.db.patch(
		args.attempt._id,
		buildCollectionAttemptProviderMirrorPatch({
			currentProviderLifecycleStatus: args.attempt.providerLifecycleStatus,
			currentProviderOccurrenceKey: args.attempt.providerOccurrenceKey,
			currentReportedAt: args.attempt.providerLastReportedAt,
			event: args.event,
			providerOccurrenceKey,
		})
	);

	const refreshedAttempt = await args.ctx.db.get(args.attempt._id);
	if (!refreshedAttempt) {
		throw new ConvexError(
			`Collection attempt ${args.attempt._id} disappeared while syncing provider mirror state.`
		);
	}
	return refreshedAttempt;
}

async function ensureTransferRequest(args: {
	ctx: IngestOccurrenceMutationCtx;
	attempt: CollectionAttemptDoc;
	event: IngestOccurrenceEvent;
	existingTransfer: TransferRequestDoc | null;
	planEntry: CollectionPlanEntryDoc;
}): Promise<TransferRequestDoc> {
	if (args.existingTransfer) {
		if (args.attempt.transferRequestId !== args.existingTransfer._id) {
			await args.ctx.db.patch(args.attempt._id, {
				transferRequestId: args.existingTransfer._id,
			});
		}
		if (
			args.existingTransfer.collectionAttemptId !== args.attempt._id ||
			args.existingTransfer.planEntryId !== args.planEntry._id
		) {
			await args.ctx.db.patch(args.existingTransfer._id, {
				collectionAttemptId: args.attempt._id,
				planEntryId: args.planEntry._id,
			});
		}

		const refreshedTransfer = await args.ctx.db.get(args.existingTransfer._id);
		if (!refreshedTransfer) {
			throw new ConvexError(
				`Transfer request ${args.existingTransfer._id} disappeared while healing provider-managed backlinks.`
			);
		}
		return refreshedTransfer;
	}

	if (args.attempt.transferRequestId) {
		const existingTransfer = await args.ctx.db.get(
			args.attempt.transferRequestId
		);
		if (existingTransfer) {
			return existingTransfer;
		}
	}

	const firstObligationId = args.planEntry.obligationIds[0];
	if (!firstObligationId) {
		throw new ConvexError(
			`Plan entry ${args.planEntry._id} has no linked obligations for provider-managed materialization.`
		);
	}
	const firstObligation = await args.ctx.db.get(firstObligationId);
	if (!firstObligation) {
		throw new ConvexError(
			`Linked obligation ${firstObligationId} not found for plan entry ${args.planEntry._id}.`
		);
	}
	const mortgageFee = firstObligation.mortgageFeeId
		? await args.ctx.db.get(firstObligation.mortgageFeeId)
		: null;

	const transferId = await createTransferRequestRecord(args.ctx, {
		direction: "inbound",
		transferType: obligationTypeToTransferType(firstObligation.type, {
			feeBehavior: mortgageFee?.behavior,
			feeCode: firstObligation.feeCode,
		}),
		amount: args.event.amount ?? args.planEntry.amount,
		counterpartyType: "borrower",
		counterpartyId: `${firstObligation.borrowerId}`,
		mortgageId: args.planEntry.mortgageId,
		obligationId: firstObligationId,
		planEntryId: args.planEntry._id,
		collectionAttemptId: args.attempt._id,
		borrowerId: firstObligation.borrowerId,
		providerCode: args.event.providerCode,
		idempotencyKey: `provider-managed-transfer:${buildOccurrenceKey(args.event)}`,
		metadata: {
			externalCollectionScheduleRef: args.event.externalScheduleRef,
			externalOccurrenceOrdinal: args.event.externalOccurrenceOrdinal,
			externalOccurrenceRef: args.event.externalOccurrenceRef,
			providerManaged: true,
			receivedVia: args.event.receivedVia,
			scheduledDate: args.event.scheduledDate,
			...args.event.providerData,
		},
		source: buildOccurrenceSource(args.event.receivedVia),
	});

	await args.ctx.db.patch(args.attempt._id, {
		transferRequestId: transferId,
	});

	const transfer = await args.ctx.db.get(transferId);
	if (!transfer) {
		throw new ConvexError(
			`Transfer ${transferId} could not be loaded after provider-managed materialization.`
		);
	}
	return transfer;
}

async function patchPlanEntryProviderMirror(args: {
	ctx: IngestOccurrenceMutationCtx;
	event: {
		externalCollectionScheduleId?: Id<"externalCollectionSchedules">;
		externalOccurrenceOrdinal?: number;
		externalOccurrenceRef?: string;
		occurredAt?: number;
		rawProviderReason?: string;
		rawProviderStatus: string;
		receivedVia: "poller" | "webhook";
	};
	planEntry: CollectionPlanEntryDoc;
	collectionAttemptId: Id<"collectionAttempts">;
}) {
	const nextStatus =
		args.planEntry.status === "planned" ||
		args.planEntry.status === "provider_scheduled"
			? "executing"
			: args.planEntry.status;

	const patch: {
		collectionAttemptId: Id<"collectionAttempts">;
		executedAt: number;
		externalCollectionScheduleId?: Id<"externalCollectionSchedules">;
		externalLastIngestedVia?: "poller" | "webhook";
		externalLastReportedAt?: number;
		externalOccurrenceOrdinal?: number;
		externalOccurrenceRef?: string;
		externalProviderEventStatus?: string;
		externalProviderReason?: string;
		status: CollectionPlanEntryDoc["status"];
	} = {
		status: nextStatus,
		collectionAttemptId: args.collectionAttemptId,
		executedAt:
			args.planEntry.executedAt ?? args.event.occurredAt ?? Date.now(),
		externalCollectionScheduleId:
			args.event.externalCollectionScheduleId ??
			args.planEntry.externalCollectionScheduleId,
		externalOccurrenceOrdinal:
			args.event.externalOccurrenceOrdinal ??
			args.planEntry.externalOccurrenceOrdinal,
		externalOccurrenceRef:
			args.event.externalOccurrenceRef ?? args.planEntry.externalOccurrenceRef,
	};
	const shouldPreserveTerminalMirror = shouldPreserveTerminalProviderMirror({
		currentProviderLifecycleStatus: args.planEntry.externalProviderEventStatus,
		incomingProviderLifecycleStatus: args.event.rawProviderStatus,
	});

	if (
		!shouldPreserveTerminalMirror &&
		shouldApplyProviderMirrorUpdate({
			currentReportedAt: args.planEntry.externalLastReportedAt,
			occurredAt: args.event.occurredAt,
		})
	) {
		patch.externalProviderEventStatus = args.event.rawProviderStatus;
		patch.externalProviderReason = args.event.rawProviderReason;
		patch.externalLastReportedAt = args.event.occurredAt ?? Date.now();
		patch.externalLastIngestedVia = args.event.receivedVia;
	}

	await args.ctx.db.patch(args.planEntry._id, patch);
}

async function ensurePendingBaseline(args: {
	attempt: CollectionAttemptDoc;
	ctx: IngestOccurrenceMutationCtx;
	event: {
		providerRef?: string;
		receivedVia: "poller" | "webhook";
	};
	transfer: TransferRequestDoc;
}) {
	const source = buildOccurrenceSource(args.event.receivedVia);
	if (args.attempt.status === "initiated") {
		const result = await executeTransition(args.ctx, {
			entityType: "collectionAttempt",
			entityId: args.attempt._id,
			eventType: "DRAW_INITIATED",
			payload: {},
			source,
		});
		assertTransitionSucceeded(result, {
			entityId: `${args.attempt._id}`,
			entityType: "collectionAttempt",
			eventType: "DRAW_INITIATED",
		});
	}

	if (args.transfer.status === "initiated") {
		const result = await executeTransition(args.ctx, {
			entityType: "transfer",
			entityId: args.transfer._id,
			eventType: "PROVIDER_INITIATED",
			payload: {
				providerRef:
					args.event.providerRef ??
					args.transfer.providerRef ??
					`provider-managed:${args.transfer._id}`,
			},
			source,
		});
		assertTransitionSucceeded(result, {
			entityId: `${args.transfer._id}`,
			entityType: "transfer",
			eventType: "PROVIDER_INITIATED",
		});
	}
}

async function resolveOccurrenceMatch(args: {
	ctx: IngestOccurrenceMutationCtx;
	event: IngestOccurrenceEvent;
	existingTransfer: TransferRequestDoc | null;
	linkedScheduleId?: Id<"externalCollectionSchedules">;
}): Promise<{
	attempt: CollectionAttemptDoc | null;
	matchedBy: OccurrenceMatchedBy;
	planEntry: CollectionPlanEntryDoc | null;
}> {
	let planEntry: CollectionPlanEntryDoc | null = null;
	let attempt: CollectionAttemptDoc | null = null;
	let matchedBy: OccurrenceMatchedBy = "unresolved";

	if (args.existingTransfer?.planEntryId) {
		planEntry = await args.ctx.db.get(args.existingTransfer.planEntryId);
		attempt = args.existingTransfer.collectionAttemptId
			? await args.ctx.db.get(args.existingTransfer.collectionAttemptId)
			: null;
		matchedBy = "existing_transfer";
	}

	if (!planEntry) {
		planEntry = await resolvePlanEntryByOccurrence(args.ctx, {
			event: args.event,
			externalCollectionScheduleId: args.linkedScheduleId,
		});
		if (planEntry) {
			if (args.event.externalOccurrenceRef) {
				matchedBy = "external_occurrence_ref";
			} else if (args.event.externalOccurrenceOrdinal !== undefined) {
				matchedBy = "external_schedule_ordinal";
			} else {
				matchedBy = "external_schedule_date";
			}
		}
	}

	if (!planEntry) {
		planEntry = await resolvePlanEntryByObligationDueDate(args.ctx, {
			event: args.event,
			externalCollectionScheduleId: args.linkedScheduleId,
		});
		if (planEntry) {
			matchedBy = "external_schedule_obligation_date";
		}
	}

	return { attempt, matchedBy, planEntry };
}

function buildTransferTransitionPayload(event: {
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
	receivedVia: "poller" | "webhook";
	scheduledDate?: string;
}) {
	switch (event.mappedTransferEvent) {
		case "PROCESSING_UPDATE":
			return {
				providerData: event.providerData ?? {
					rawProviderStatus: event.rawProviderStatus,
				},
			};
		case "FUNDS_SETTLED":
			return {
				settledAt: event.occurredAt ?? Date.now(),
				providerData: event.providerData ?? {
					rawProviderStatus: event.rawProviderStatus,
				},
			};
		case "TRANSFER_FAILED":
			return {
				errorCode: event.rawProviderReason ?? event.rawProviderStatus,
				reason:
					event.rawProviderReason ??
					`Rotessa status ${event.rawProviderStatus}`,
			};
		case "TRANSFER_REVERSED":
			return {
				reversalRef:
					event.providerRef ??
					event.externalOccurrenceRef ??
					buildOccurrenceKey(event),
				reason:
					event.rawProviderReason ??
					`Rotessa reversal ${event.rawProviderStatus}`,
			};
		default:
			throw new ConvexError("Unsupported provider-managed transfer event.");
	}
}

async function persistUnresolvedOccurrenceAudit(args: {
	ctx: IngestOccurrenceMutationCtx;
	event: IngestOccurrenceEvent;
	linkedSchedule: ExternalCollectionScheduleDoc | null;
	reason: string;
}) {
	const occurrenceKey = buildOccurrenceKey(args.event);
	await auditLog.log(args.ctx, {
		action: "payments.provider_managed_occurrence.unresolved",
		actorId: buildOccurrenceSource(args.event.receivedVia).actorId,
		resourceType: "providerManagedOccurrences",
		resourceId: occurrenceKey,
		severity: "error",
		metadata: {
			reason: args.reason,
			occurrenceKey,
			externalScheduleRef: args.event.externalScheduleRef,
			externalCollectionScheduleId: args.linkedSchedule?._id,
			externalOccurrenceOrdinal: args.event.externalOccurrenceOrdinal,
			externalOccurrenceRef: args.event.externalOccurrenceRef,
			providerCode: args.event.providerCode,
			providerRef: args.event.providerRef,
			rawProviderStatus: args.event.rawProviderStatus,
			rawProviderReason: args.event.rawProviderReason,
			scheduledDate: args.event.scheduledDate,
			occurredAt: args.event.occurredAt,
			receivedVia: args.event.receivedVia,
			providerData: args.event.providerData,
		},
	});
}

export const ingestExternalOccurrenceEvent = convex
	.mutation()
	.input({
		event: normalizedExternalCollectionOccurrenceEventValidator,
	})
	.handler(async (ctx, args) => {
		const source = buildOccurrenceSource(args.event.receivedVia);
		const existingTransfer = await resolveExistingTransfer(ctx, args.event);
		const linkedSchedule = await resolveScheduleId(ctx, args.event);
		const {
			matchedBy,
			planEntry,
			attempt: matchedAttempt,
		} = await resolveOccurrenceMatch({
			ctx,
			event: args.event,
			existingTransfer,
			linkedScheduleId: linkedSchedule?._id,
		});
		let attempt = matchedAttempt;
		let transfer = existingTransfer;

		if (!planEntry) {
			const reason =
				"No matching provider-managed collection plan entry was found for the external occurrence event.";
			await persistUnresolvedOccurrenceAudit({
				ctx,
				event: args.event,
				linkedSchedule,
				reason,
			});
			return {
				outcome: "unresolved" as const,
				reason,
			};
		}

		const linkedPlanEntryAttempt =
			attempt ??
			(planEntry.collectionAttemptId
				? await ctx.db.get(planEntry.collectionAttemptId)
				: null);
		assertOccurrenceGraphConsistency({
			attempt: linkedPlanEntryAttempt,
			existingTransfer,
			linkedSchedule,
			planEntry,
		});

		attempt =
			linkedPlanEntryAttempt ??
			(await ensureCollectionAttempt({
				ctx,
				event: args.event,
				planEntry,
			}));
		attempt = await syncCollectionAttemptProviderMirror({
			ctx,
			attempt,
			event: args.event,
		});

		await patchPlanEntryProviderMirror({
			ctx,
			event: {
				...args.event,
				externalCollectionScheduleId: linkedSchedule?._id,
			},
			planEntry,
			collectionAttemptId: attempt._id,
		});

		transfer = await ensureTransferRequest({
			ctx,
			attempt,
			event: args.event,
			existingTransfer,
			planEntry,
		});

		const incomingProviderRef = normalizeProviderRefForIdentity(
			args.event.providerRef
		);
		if (incomingProviderRef && transfer.providerRef !== incomingProviderRef) {
			if (
				!canReplaceTransferProviderRef({
					providerRef: transfer.providerRef,
					transferId: transfer._id,
				})
			) {
				throw new ConvexError(
					`Provider-managed occurrence attempted to overwrite transfer ${transfer._id} providerRef from "${transfer.providerRef}" to "${incomingProviderRef}".`
				);
			}

			await ctx.db.patch(transfer._id, {
				providerRef: incomingProviderRef,
			});
			transfer = {
				...transfer,
				providerRef: incomingProviderRef,
			} as TransferRequestDoc;
		}

		await ensurePendingBaseline({
			attempt,
			ctx,
			event: {
				...args.event,
				providerRef: incomingProviderRef,
			},
			transfer,
		});

		if (args.event.rawProviderStatus === "Future") {
			return {
				outcome: "materialized" as const,
				matchedBy,
				collectionAttemptId: attempt._id,
				planEntryId: planEntry._id,
				transferRequestId: transfer._id,
			};
		}

		if (
			isTransferAlreadyInTargetState(
				transfer.status,
				args.event.mappedTransferEvent
			)
		) {
			return {
				outcome: "already_applied" as const,
				matchedBy,
				collectionAttemptId: attempt._id,
				planEntryId: planEntry._id,
				transferRequestId: transfer._id,
			};
		}

		const transitionResult = await executeTransition(ctx, {
			entityType: "transfer",
			entityId: transfer._id,
			eventType: args.event.mappedTransferEvent,
			payload: buildTransferTransitionPayload(args.event),
			source,
		});
		assertTransitionSucceeded(transitionResult, {
			entityId: `${transfer._id}`,
			entityType: "transfer",
			eventType: args.event.mappedTransferEvent,
		});

		return {
			outcome: "applied" as const,
			matchedBy,
			collectionAttemptId: attempt._id,
			planEntryId: planEntry._id,
			transferRequestId: transfer._id,
		};
	})
	.internal();
