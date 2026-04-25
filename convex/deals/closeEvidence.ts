import { ConvexError, type Infer, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { convex } from "../fluent";
import { providerCodeValidator } from "../payments/transfers/validators";

export const fundsReceiptSourceValidator = v.union(
	v.object({
		kind: v.literal("transfer_pipeline"),
		pipelineId: v.string(),
		leg2TransferId: v.id("transferRequests"),
		providerCode: providerCodeValidator,
	}),
	v.object({
		kind: v.literal("manual_admin"),
		confirmedBy: v.string(),
		evidenceNote: v.string(),
		receivedAt: v.number(),
		attachmentIds: v.optional(v.array(v.id("documentAssets"))),
	})
);

export const closeEffectNameValidator = v.union(
	v.literal("funds_confirmation"),
	v.literal("signed_archive"),
	v.literal("reservation_commit"),
	v.literal("accrual_proration"),
	v.literal("payment_reroute"),
	v.literal("lawyer_access_cleanup")
);

export const closeEffectOutcomeStatusValidator = v.union(
	v.literal("succeeded"),
	v.literal("skipped"),
	v.literal("blocked"),
	v.literal("failed")
);

export const closeExceptionKindValidator = v.union(
	v.literal("missing_funds_evidence"),
	v.literal("evidence_mismatch"),
	v.literal("incompatible_duplicate_evidence"),
	v.literal("invalid_deal_state"),
	v.literal("missing_signed_artifacts"),
	v.literal("archive_failed"),
	v.literal("effect_failed")
);

export const signedArchiveStatusValidator = v.union(
	v.literal("archived"),
	v.literal("blocked_missing_artifacts"),
	v.literal("failed")
);

export const adminCloseFundsSummaryValidator = v.object({
	sourceKind: v.union(
		v.literal("transfer_pipeline"),
		v.literal("manual_admin")
	),
	receivedAt: v.number(),
	recordedAt: v.number(),
	pipelineId: v.optional(v.string()),
	leg2TransferId: v.optional(v.id("transferRequests")),
	providerCode: v.optional(providerCodeValidator),
	confirmedBy: v.optional(v.string()),
	evidenceNote: v.optional(v.string()),
	attachmentIds: v.optional(v.array(v.id("documentAssets"))),
});

export const participantCloseFundsSummaryValidator = v.object({
	sourceKind: v.union(
		v.literal("transfer_pipeline"),
		v.literal("manual_admin")
	),
	receivedAt: v.number(),
	recordedAt: v.number(),
	providerCode: v.optional(providerCodeValidator),
});

export const closeReceiptSummaryValidator = v.object({
	dealId: v.id("deals"),
	closedAt: v.optional(v.number()),
	funds: v.optional(participantCloseFundsSummaryValidator),
	signedArchiveStatus: v.optional(signedArchiveStatusValidator),
});

export type FundsReceiptSource = Infer<typeof fundsReceiptSourceValidator>;
type TransferProviderCode = Extract<
	FundsReceiptSource,
	{ kind: "transfer_pipeline" }
>["providerCode"];

const providerCodes: readonly TransferProviderCode[] = [
	"manual",
	"manual_review",
	"mock_pad",
	"mock_eft",
	"pad_vopay",
	"pad_rotessa",
	"eft_vopay",
	"e_transfer",
	"wire",
	"plaid_transfer",
];

const providerCodeSet: ReadonlySet<TransferProviderCode> = new Set(
	providerCodes
);

/**
 * Best-effort parse of untrusted effect payload `fundsReceiptSource`.
 * Returns null when the shape is not recognized; `recordFundsReceiptInternal` re-validates.
 */
export function parseFundsReceiptSource(
	value: unknown
): FundsReceiptSource | null {
	if (value == null) {
		return null;
	}
	if (typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	const o = value as Record<string, unknown>;
	if (o.kind === "transfer_pipeline") {
		if (typeof o.pipelineId !== "string") {
			return null;
		}
		if (typeof o.leg2TransferId !== "string") {
			return null;
		}
		if (
			typeof o.providerCode !== "string" ||
			!providerCodeSet.has(o.providerCode as TransferProviderCode)
		) {
			return null;
		}
		return {
			kind: "transfer_pipeline",
			pipelineId: o.pipelineId,
			leg2TransferId: o.leg2TransferId as Id<"transferRequests">,
			providerCode: o.providerCode as TransferProviderCode,
		};
	}
	if (o.kind === "manual_admin") {
		if (typeof o.confirmedBy !== "string") {
			return null;
		}
		if (typeof o.evidenceNote !== "string") {
			return null;
		}
		if (typeof o.receivedAt !== "number") {
			return null;
		}
		const rawAttachments = o.attachmentIds;
		if (rawAttachments === undefined) {
			return {
				kind: "manual_admin",
				confirmedBy: o.confirmedBy,
				evidenceNote: o.evidenceNote,
				receivedAt: o.receivedAt,
			};
		}
		if (!Array.isArray(rawAttachments)) {
			return null;
		}
		for (const id of rawAttachments) {
			if (typeof id !== "string") {
				return null;
			}
		}
		return {
			kind: "manual_admin",
			confirmedBy: o.confirmedBy,
			evidenceNote: o.evidenceNote,
			receivedAt: o.receivedAt,
			attachmentIds: rawAttachments as Id<"documentAssets">[],
		};
	}
	return null;
}

export type CloseEffectName = Infer<typeof closeEffectNameValidator>;
export type CloseEffectOutcomeStatus = Infer<
	typeof closeEffectOutcomeStatusValidator
>;
export type CloseExceptionKind = Infer<typeof closeExceptionKindValidator>;
export type SignedArchiveStatus = Infer<typeof signedArchiveStatusValidator>;

type CloseEvidenceMutationCtx = Pick<MutationCtx, "db">;
type CloseEvidenceQueryCtx = Pick<QueryCtx, "db">;

export function normalizeEvidenceNote(note: string): string {
	return note.trim().replace(/\s+/g, " ");
}

export function buildFundsEvidenceIdempotencyKey(args: {
	dealId: Id<"deals">;
	source: FundsReceiptSource;
}): string {
	if (args.source.kind === "transfer_pipeline") {
		return [
			"deal",
			args.dealId,
			"funds",
			"transfer_pipeline",
			args.source.pipelineId,
			args.source.leg2TransferId,
		].join(":");
	}
	return [
		"deal",
		args.dealId,
		"funds",
		"manual_admin",
		args.source.confirmedBy,
		args.source.receivedAt,
	].join(":");
}

export function buildCloseEffectIdempotencyKey(args: {
	dealId: Id<"deals">;
	effectName: CloseEffectName;
}): string {
	return ["deal", args.dealId, "close-effect", args.effectName].join(":");
}

export function buildSignedArchiveIdempotencyKey(args: {
	dealId: Id<"deals">;
	attemptId?: Id<"dealEnvelopeAttempts">;
}): string {
	return [
		"deal",
		args.dealId,
		"signed-archive",
		args.attemptId ?? "active",
	].join(":");
}

export function fundsSourcesMatch(
	left: FundsReceiptSource,
	right: FundsReceiptSource
): boolean {
	if (left.kind !== right.kind) {
		return false;
	}
	if (left.kind === "transfer_pipeline" && right.kind === "transfer_pipeline") {
		return (
			left.pipelineId === right.pipelineId &&
			left.leg2TransferId === right.leg2TransferId &&
			left.providerCode === right.providerCode
		);
	}
	if (left.kind === "manual_admin" && right.kind === "manual_admin") {
		return (
			left.confirmedBy === right.confirmedBy &&
			normalizeEvidenceNote(left.evidenceNote) ===
				normalizeEvidenceNote(right.evidenceNote) &&
			left.receivedAt === right.receivedAt &&
			sameIdList(left.attachmentIds ?? [], right.attachmentIds ?? [])
		);
	}
	return false;
}

function sameIdList<T extends string>(left: readonly T[], right: readonly T[]) {
	if (left.length !== right.length) {
		return false;
	}
	const sortedLeft = [...left].sort();
	const sortedRight = [...right].sort();
	return sortedLeft.every((value, index) => value === sortedRight[index]);
}

export function projectFundsSourceForParticipant(args: {
	receivedAt: number;
	recordedAt: number;
	source: FundsReceiptSource;
}) {
	return {
		sourceKind: args.source.kind,
		receivedAt: args.receivedAt,
		recordedAt: args.recordedAt,
		providerCode:
			args.source.kind === "transfer_pipeline"
				? args.source.providerCode
				: undefined,
	};
}

export function projectFundsSourceForAdmin(args: {
	receivedAt: number;
	recordedAt: number;
	source: FundsReceiptSource;
}) {
	if (args.source.kind === "transfer_pipeline") {
		return {
			sourceKind: args.source.kind,
			receivedAt: args.receivedAt,
			recordedAt: args.recordedAt,
			pipelineId: args.source.pipelineId,
			leg2TransferId: args.source.leg2TransferId,
			providerCode: args.source.providerCode,
		};
	}
	return {
		sourceKind: args.source.kind,
		receivedAt: args.receivedAt,
		recordedAt: args.recordedAt,
		confirmedBy: args.source.confirmedBy,
		evidenceNote: normalizeEvidenceNote(args.source.evidenceNote),
		attachmentIds: args.source.attachmentIds,
	};
}

async function getLatestFundsEvidence(
	ctx: CloseEvidenceQueryCtx,
	dealId: Id<"deals">
) {
	const rows = await ctx.db
		.query("dealFundsEvidence")
		.withIndex("by_deal", (query) => query.eq("dealId", dealId))
		.collect();
	return (
		rows.sort((left, right) => right.recordedAt - left.recordedAt)[0] ?? null
	);
}

export async function recordCloseEffectOutcomeRow(
	ctx: CloseEvidenceMutationCtx,
	args: {
		dealId: Id<"deals">;
		effectName: CloseEffectName;
		status: CloseEffectOutcomeStatus;
		idempotencyKey: string;
		exceptionKind?: CloseExceptionKind;
		message?: string;
		error?: string;
		metadata?: Record<string, string>;
		now: number;
	}
) {
	const existing = await ctx.db
		.query("dealCloseEffectOutcomes")
		.withIndex("by_idempotency", (query) =>
			query.eq("idempotencyKey", args.idempotencyKey)
		)
		.unique();

	const patch = {
		status: args.status,
		exceptionKind: args.exceptionKind,
		message: args.message,
		error: args.error,
		metadata: args.metadata,
		completedAt:
			args.status === "succeeded" || args.status === "skipped"
				? args.now
				: undefined,
		updatedAt: args.now,
	};

	if (existing) {
		await ctx.db.patch(existing._id, patch);
		return existing._id;
	}

	return await ctx.db.insert("dealCloseEffectOutcomes", {
		dealId: args.dealId,
		effectName: args.effectName,
		status: args.status,
		idempotencyKey: args.idempotencyKey,
		exceptionKind: args.exceptionKind,
		message: args.message,
		error: args.error,
		metadata: args.metadata,
		startedAt: args.now,
		completedAt: patch.completedAt,
		updatedAt: args.now,
	});
}

async function validateManualAttachments(
	ctx: CloseEvidenceQueryCtx,
	attachmentIds: readonly Id<"documentAssets">[]
) {
	for (const attachmentId of attachmentIds) {
		const asset = await ctx.db.get(attachmentId);
		if (!asset) {
			throw new ConvexError(
				`Manual evidence attachment not found: ${attachmentId}`
			);
		}
	}
}

async function validateProviderSource(
	ctx: CloseEvidenceQueryCtx,
	args: {
		dealId: Id<"deals">;
		source: Extract<FundsReceiptSource, { kind: "transfer_pipeline" }>;
	}
) {
	const transfer = await ctx.db.get(args.source.leg2TransferId);
	if (!transfer) {
		throw new ConvexError("Provider funds evidence transfer not found");
	}
	if (transfer.dealId !== args.dealId) {
		throw new ConvexError("Provider funds evidence is for a different deal");
	}
	if (transfer.pipelineId !== args.source.pipelineId) {
		throw new ConvexError("Provider funds evidence pipeline mismatch");
	}
	if (
		transfer.legNumber !== 2 ||
		transfer.transferType !== "deal_seller_payout"
	) {
		throw new ConvexError(
			"Provider funds evidence must be leg 2 seller payout"
		);
	}
	if (transfer.status !== "confirmed") {
		throw new ConvexError("Provider funds evidence transfer is not confirmed");
	}
	if (transfer.providerCode !== args.source.providerCode) {
		throw new ConvexError("Provider funds evidence provider mismatch");
	}
	return transfer;
}

export const resolveProviderFundsSourceForDealInternal = convex
	.query()
	.input({ dealId: v.id("deals") })
	.handler(async (ctx, args): Promise<FundsReceiptSource | null> => {
		const pipelineId = `deal-closing:${args.dealId}`;
		const leg2 = await ctx.db
			.query("transferRequests")
			.withIndex("by_pipeline", (query) =>
				query.eq("pipelineId", pipelineId).eq("legNumber", 2)
			)
			.first();

		if (
			!leg2 ||
			leg2.dealId !== args.dealId ||
			leg2.status !== "confirmed" ||
			leg2.transferType !== "deal_seller_payout"
		) {
			return null;
		}

		return {
			kind: "transfer_pipeline",
			pipelineId,
			leg2TransferId: leg2._id,
			providerCode: leg2.providerCode,
		};
	})
	.internal();

export const recordCloseEffectOutcomeInternal = convex
	.mutation()
	.input({
		dealId: v.id("deals"),
		effectName: closeEffectNameValidator,
		status: closeEffectOutcomeStatusValidator,
		exceptionKind: v.optional(closeExceptionKindValidator),
		message: v.optional(v.string()),
		error: v.optional(v.string()),
		metadata: v.optional(v.record(v.string(), v.string())),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		return await recordCloseEffectOutcomeRow(ctx, {
			dealId: args.dealId,
			effectName: args.effectName,
			status: args.status,
			idempotencyKey: buildCloseEffectIdempotencyKey({
				dealId: args.dealId,
				effectName: args.effectName,
			}),
			exceptionKind: args.exceptionKind,
			message: args.message,
			error: args.error,
			metadata: args.metadata,
			now,
		});
	})
	.internal();

export interface RecordFundsReceiptResult {
	evidenceId: Id<"dealFundsEvidence"> | null;
	status: "recorded" | "replayed" | "blocked";
}

export async function recordFundsReceiptRow(
	ctx: CloseEvidenceMutationCtx,
	args: {
		dealId: Id<"deals">;
		source: FundsReceiptSource;
		journalEntryId?: string;
		recordedBy: string;
	}
): Promise<RecordFundsReceiptResult> {
	const deal = await ctx.db.get(args.dealId);
	if (!deal) {
		throw new ConvexError("Deal not found");
	}

	const now = Date.now();
	const idempotencyKey = buildFundsEvidenceIdempotencyKey({
		dealId: args.dealId,
		source: args.source,
	});
	const existingByKey = await ctx.db
		.query("dealFundsEvidence")
		.withIndex("by_idempotency", (query) =>
			query.eq("idempotencyKey", idempotencyKey)
		)
		.unique();

	if (existingByKey) {
		await recordCloseEffectOutcomeRow(ctx, {
			dealId: args.dealId,
			effectName: "funds_confirmation",
			status: "skipped",
			idempotencyKey: buildCloseEffectIdempotencyKey({
				dealId: args.dealId,
				effectName: "funds_confirmation",
			}),
			message: "Funds evidence already recorded for this source",
			now,
		});
		return { evidenceId: existingByKey._id, status: "replayed" };
	}

	const existingForDeal = await getLatestFundsEvidence(ctx, args.dealId);
	if (
		existingForDeal &&
		!fundsSourcesMatch(existingForDeal.source, args.source)
	) {
		await recordCloseEffectOutcomeRow(ctx, {
			dealId: args.dealId,
			effectName: "funds_confirmation",
			status: "blocked",
			idempotencyKey: buildCloseEffectIdempotencyKey({
				dealId: args.dealId,
				effectName: "funds_confirmation",
			}),
			exceptionKind: "incompatible_duplicate_evidence",
			message: "Funds evidence already exists with incompatible source data",
			now,
		});
		return { evidenceId: null, status: "blocked" };
	}

	let receivedAt: number;
	if (args.source.kind === "transfer_pipeline") {
		const transfer = await validateProviderSource(ctx, {
			dealId: args.dealId,
			source: args.source,
		});
		receivedAt = transfer.confirmedAt ?? transfer.settledAt ?? now;
	} else {
		const evidenceNote = normalizeEvidenceNote(args.source.evidenceNote);
		if (!evidenceNote) {
			throw new ConvexError(
				"Manual funds confirmation requires an evidence note"
			);
		}
		if (args.source.receivedAt <= 0) {
			throw new ConvexError("Manual funds confirmation requires receivedAt");
		}
		await validateManualAttachments(ctx, args.source.attachmentIds ?? []);
		receivedAt = args.source.receivedAt;
	}

	const evidenceId = await ctx.db.insert("dealFundsEvidence", {
		dealId: args.dealId,
		source:
			args.source.kind === "manual_admin"
				? {
						...args.source,
						evidenceNote: normalizeEvidenceNote(args.source.evidenceNote),
					}
				: args.source,
		sourceKind: args.source.kind,
		idempotencyKey,
		receivedAt,
		recordedAt: now,
		recordedBy: args.recordedBy,
		journalEntryId: args.journalEntryId,
		pipelineId:
			args.source.kind === "transfer_pipeline"
				? args.source.pipelineId
				: undefined,
		leg2TransferId:
			args.source.kind === "transfer_pipeline"
				? args.source.leg2TransferId
				: undefined,
		providerCode:
			args.source.kind === "transfer_pipeline"
				? args.source.providerCode
				: undefined,
		manualConfirmedBy:
			args.source.kind === "manual_admin" ? args.source.confirmedBy : undefined,
		manualEvidenceNote:
			args.source.kind === "manual_admin"
				? normalizeEvidenceNote(args.source.evidenceNote)
				: undefined,
		manualAttachmentIds:
			args.source.kind === "manual_admin"
				? args.source.attachmentIds
				: undefined,
	});

	await recordCloseEffectOutcomeRow(ctx, {
		dealId: args.dealId,
		effectName: "funds_confirmation",
		status: "succeeded",
		idempotencyKey: buildCloseEffectIdempotencyKey({
			dealId: args.dealId,
			effectName: "funds_confirmation",
		}),
		message: "Funds evidence recorded",
		now,
	});

	return { evidenceId, status: "recorded" };
}

export const recordFundsReceiptInternal = convex
	.mutation()
	.input({
		dealId: v.id("deals"),
		source: fundsReceiptSourceValidator,
		journalEntryId: v.optional(v.string()),
		recordedBy: v.string(),
	})
	.handler(async (ctx, args): Promise<RecordFundsReceiptResult> => {
		return recordFundsReceiptRow(ctx, args);
	})
	.internal();

export const listCloseEvidenceForDealInternal = convex
	.query()
	.input({ dealId: v.id("deals") })
	.handler(
		async (
			ctx,
			args
		): Promise<{
			archives: Doc<"dealSignedArchives">[];
			effectOutcomes: Doc<"dealCloseEffectOutcomes">[];
			fundsEvidence: Doc<"dealFundsEvidence">[];
		}> => {
			const [fundsEvidence, archives, effectOutcomes] = await Promise.all([
				ctx.db
					.query("dealFundsEvidence")
					.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
					.collect(),
				ctx.db
					.query("dealSignedArchives")
					.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
					.collect(),
				ctx.db
					.query("dealCloseEffectOutcomes")
					.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
					.collect(),
			]);

			return { fundsEvidence, archives, effectOutcomes };
		}
	)
	.internal();

export const recordSignedArchiveForDealInternal = convex
	.mutation()
	.input({
		dealId: v.id("deals"),
		journalEntryId: v.optional(v.string()),
	})
	.handler(
		async (
			ctx,
			args
		): Promise<{
			archiveId: Id<"dealSignedArchives">;
			status: SignedArchiveStatus;
		}> => {
			const now = Date.now();
			const activeAttempts = await ctx.db
				.query("dealEnvelopeAttempts")
				.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
				.collect();
			const completedAttempt =
				activeAttempts
					.filter((attempt) => attempt.active && attempt.status === "completed")
					.sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;

			const idempotencyKey = buildSignedArchiveIdempotencyKey({
				dealId: args.dealId,
				attemptId: completedAttempt?._id,
			});
			const existing = await ctx.db
				.query("dealSignedArchives")
				.withIndex("by_idempotency", (query) =>
					query.eq("idempotencyKey", idempotencyKey)
				)
				.unique();

			if (!completedAttempt) {
				const archiveId = await upsertSignedArchiveBlocker(ctx, {
					dealId: args.dealId,
					idempotencyKey,
					message:
						"No active completed envelope attempt is available to archive.",
					now,
					existing,
				});
				return { archiveId, status: "blocked_missing_artifacts" };
			}

			const [documentInstance, generatedDocument] = await Promise.all([
				ctx.db.get(completedAttempt.dealDocumentInstanceId),
				completedAttempt.generatedDocumentId
					? ctx.db.get(completedAttempt.generatedDocumentId)
					: Promise.resolve(null),
			]);

			if (!generatedDocument?.pdfStorageId) {
				const archiveId = await upsertSignedArchiveBlocker(ctx, {
					dealId: args.dealId,
					idempotencyKey,
					attemptId: completedAttempt._id,
					packageId: completedAttempt.packageId,
					dealDocumentInstanceId: completedAttempt.dealDocumentInstanceId,
					generatedDocumentId: completedAttempt.generatedDocumentId,
					message:
						"Completed envelope attempt has no generated signed PDF artifact.",
					now,
					existing,
				});
				return { archiveId, status: "blocked_missing_artifacts" };
			}

			const archiveFields = {
				dealId: args.dealId,
				packageId: completedAttempt.packageId,
				attemptId: completedAttempt._id,
				dealDocumentInstanceId: completedAttempt.dealDocumentInstanceId,
				generatedDocumentId: generatedDocument._id,
				status: "archived" as const,
				idempotencyKey,
				assetIds: documentInstance?.assetId ? [documentInstance.assetId] : [],
				storageIds: [generatedDocument.pdfStorageId],
				blockerKind: undefined,
				blockerMessage: undefined,
				archivedAt: now,
				updatedAt: now,
			};

			let archiveId: Id<"dealSignedArchives">;
			if (existing) {
				await ctx.db.patch(existing._id, archiveFields);
				archiveId = existing._id;
			} else {
				archiveId = await ctx.db.insert("dealSignedArchives", {
					...archiveFields,
					createdAt: now,
				});
			}

			await recordCloseEffectOutcomeRow(ctx, {
				dealId: args.dealId,
				effectName: "signed_archive",
				status: "succeeded",
				idempotencyKey: buildCloseEffectIdempotencyKey({
					dealId: args.dealId,
					effectName: "signed_archive",
				}),
				message: "Signed archive recorded",
				metadata: {
					journalEntryId: args.journalEntryId ?? "",
					attemptId: `${completedAttempt._id}`,
				},
				now,
			});

			return { archiveId, status: "archived" };
		}
	)
	.internal();

async function upsertSignedArchiveBlocker(
	ctx: CloseEvidenceMutationCtx,
	args: {
		dealId: Id<"deals">;
		idempotencyKey: string;
		message: string;
		now: number;
		existing: Doc<"dealSignedArchives"> | null;
		packageId?: Id<"dealDocumentPackages">;
		attemptId?: Id<"dealEnvelopeAttempts">;
		dealDocumentInstanceId?: Id<"dealDocumentInstances">;
		generatedDocumentId?: Id<"generatedDocuments">;
	}
) {
	const archiveFields = {
		dealId: args.dealId,
		packageId: args.packageId,
		attemptId: args.attemptId,
		dealDocumentInstanceId: args.dealDocumentInstanceId,
		generatedDocumentId: args.generatedDocumentId,
		status: "blocked_missing_artifacts" as const,
		idempotencyKey: args.idempotencyKey,
		assetIds: [],
		storageIds: [],
		blockerKind: "missing_signed_artifacts" as const,
		blockerMessage: args.message,
		archivedAt: undefined,
		updatedAt: args.now,
	};

	let archiveId: Id<"dealSignedArchives">;
	if (args.existing) {
		await ctx.db.patch(args.existing._id, archiveFields);
		archiveId = args.existing._id;
	} else {
		archiveId = await ctx.db.insert("dealSignedArchives", {
			...archiveFields,
			createdAt: args.now,
		});
	}

	await recordCloseEffectOutcomeRow(ctx, {
		dealId: args.dealId,
		effectName: "signed_archive",
		status: "blocked",
		idempotencyKey: buildCloseEffectIdempotencyKey({
			dealId: args.dealId,
			effectName: "signed_archive",
		}),
		exceptionKind: "missing_signed_artifacts",
		message: args.message,
		now: args.now,
	});

	return archiveId;
}
