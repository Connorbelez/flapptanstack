import { ConvexError, v } from "convex/values";
import { resolveDealAccessDecision } from "../../src/lib/deals/access-policy/resolve";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import {
	adminAction,
	adminMutation,
	authedMutation,
	convex,
	type Viewer,
} from "../fluent";
import {
	canUploadManualPaymentProof,
	type DealPortalPersona,
} from "./portalContracts";

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
	"application/pdf",
	"image/jpeg",
	"image/png",
	"image/webp",
]);
const paymentProofMimeTypeValidator = v.union(
	v.literal("application/pdf"),
	v.literal("image/jpeg"),
	v.literal("image/png"),
	v.literal("image/webp")
);
const MIN_TRANSFER_DATE_MS = Date.UTC(2000, 0, 1);
const MAX_TRANSFER_DATE_FUTURE_MS = 7 * 24 * 60 * 60 * 1000;

interface DbContext {
	db: QueryCtx["db"] | MutationCtx["db"];
}
type PaymentProofSubmitterRole =
	| "admin"
	| "fairlend_admin"
	| "guest_lawyer"
	| "lender"
	| "platform_lawyer"
	| "primary_lawyer"
	| "purchasing_lender";

interface NormalizedPaymentProofInput {
	amount: number;
	attachmentIds: readonly Id<"documentAssets">[];
	currency: "CAD";
	institutionName: string | undefined;
	note: string | undefined;
	referenceNumber: string | undefined;
	sendingParty: string;
	transferDate: number;
}

interface ApprovedPaymentProofResult {
	cashLedgerJournalEntryIds: Id<"cash_ledger_journal_entries">[];
	cashLedgerPostingGroupId?: string;
	fundsEvidenceId: Id<"dealFundsEvidence">;
	leg1TransferId: Id<"transferRequests">;
	leg2TransferId: Id<"transferRequests">;
	proofId: Id<"dealPaymentProofs">;
}

interface PipelineLegs {
	leg1: Doc<"transferRequests"> | null;
	leg2: Doc<"transferRequests"> | null;
}

function trimOptional(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function assertFundsPending(deal: Doc<"deals"> | null): Doc<"deals"> {
	if (!deal) {
		throw new ConvexError("Deal not found");
	}
	if (deal.status !== "fundsTransfer.pending") {
		throw new ConvexError(
			"Deal must be in fundsTransfer.pending to upload payment proof"
		);
	}
	return deal;
}

async function resolveUploaderRole(
	ctx: DbContext,
	args: { dealId: Id<"deals">; viewer: Viewer }
): Promise<PaymentProofSubmitterRole> {
	const decision = await resolveDealAccessDecision(ctx, {
		dealId: args.dealId,
		intent: "deal.payment_proof.upload",
		viewer: args.viewer,
	});
	if (
		decision?.allowed &&
		canUploadManualPaymentProof(decision.persona as DealPortalPersona)
	) {
		return decision.persona as PaymentProofSubmitterRole;
	}

	throw new ConvexError(
		"Only purchasing lender, ready primary lawyer, or admin can upload proof"
	);
}

function personaForRole(role: PaymentProofSubmitterRole): DealPortalPersona {
	switch (role) {
		case "admin":
		case "fairlend_admin":
			return "fairlend_admin";
		case "guest_lawyer":
		case "platform_lawyer":
		case "primary_lawyer":
			return "primary_lawyer";
		case "lender":
		case "purchasing_lender":
			return "purchasing_lender";
		default:
			return role satisfies never;
	}
}

function assertValidTransferDate(transferDate: number, now = Date.now()) {
	if (
		!(Number.isInteger(transferDate) && Number.isSafeInteger(transferDate)) ||
		transferDate <= 0
	) {
		throw new ConvexError("Transfer date must be a positive integer timestamp");
	}
	if (transferDate < MIN_TRANSFER_DATE_MS) {
		throw new ConvexError("Transfer date cannot be before 2000-01-01");
	}
	if (transferDate > now + MAX_TRANSFER_DATE_FUTURE_MS) {
		throw new ConvexError(
			"Transfer date cannot be more than 7 days in the future"
		);
	}
}

async function assertPaymentProofAssetUploadAllowed(
	ctx: DbContext,
	args: { dealId: Id<"deals">; viewer: Viewer }
): Promise<PaymentProofSubmitterRole> {
	assertFundsPending(await ctx.db.get(args.dealId));
	return await resolveUploaderRole(ctx, args);
}

async function viewerUserId(
	ctx: DbContext,
	viewer: Viewer
): Promise<Id<"users">> {
	const user = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", viewer.authId))
		.first();
	if (!user) {
		throw new ConvexError("Viewer user not found");
	}
	return user._id;
}

async function assertAttachmentSet(
	ctx: DbContext,
	args: {
		attachmentIds: readonly Id<"documentAssets">[];
		submittedByRole: PaymentProofSubmitterRole;
		viewer: Viewer;
	}
): Promise<void> {
	if (args.attachmentIds.length === 0) {
		throw new ConvexError("At least one attachment is required");
	}

	const requiredUploaderUserId =
		args.submittedByRole === "fairlend_admin" ||
		args.submittedByRole === "admin"
			? null
			: await viewerUserId(ctx, args.viewer);

	for (const attachmentId of args.attachmentIds) {
		const attachment = await ctx.db.get(attachmentId);
		if (!attachment) {
			throw new ConvexError("Payment proof attachment not found");
		}
		if (attachment.source !== "payment_proof_upload") {
			throw new ConvexError(
				"Payment proof attachments must come from payment proof upload"
			);
		}
		if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(attachment.mimeType)) {
			throw new ConvexError("Payment proof attachment type is not supported");
		}
		if (
			requiredUploaderUserId !== null &&
			attachment.uploadedByUserId !== requiredUploaderUserId
		) {
			throw new ConvexError(
				"Non-admin uploaders must use their own uploaded payment proof attachments"
			);
		}
	}
}

async function assertReviewableAttachments(
	ctx: DbContext,
	attachmentIds: readonly Id<"documentAssets">[]
) {
	if (attachmentIds.length === 0) {
		throw new ConvexError("At least one attachment is required");
	}

	for (const attachmentId of attachmentIds) {
		const attachment = await ctx.db.get(attachmentId);
		if (!attachment) {
			throw new ConvexError("Payment proof attachment not found");
		}
		if (attachment.source !== "payment_proof_upload") {
			throw new ConvexError(
				"Payment proof attachments must come from payment proof upload"
			);
		}
		if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(attachment.mimeType)) {
			throw new ConvexError("Payment proof attachment type is not supported");
		}
	}
}

function normalizePaymentProofInput(args: {
	amount: number;
	attachmentIds: readonly Id<"documentAssets">[];
	currency: "CAD";
	institutionName?: string;
	note?: string;
	referenceNumber?: string;
	sendingParty: string;
	transferDate: number;
}): NormalizedPaymentProofInput {
	if (!Number.isInteger(args.amount) || args.amount <= 0) {
		throw new ConvexError("Amount must be a positive integer number of cents");
	}
	assertValidTransferDate(args.transferDate);

	const sendingParty = args.sendingParty.trim();
	if (!sendingParty) {
		throw new ConvexError("Sending party is required");
	}

	return {
		amount: args.amount,
		attachmentIds: args.attachmentIds,
		currency: args.currency,
		institutionName: trimOptional(args.institutionName),
		note: trimOptional(args.note),
		referenceNumber: trimOptional(args.referenceNumber),
		sendingParty,
		transferDate: args.transferDate,
	};
}

function orderedAttachmentIdsEqual(
	left: readonly Id<"documentAssets">[],
	right: readonly Id<"documentAssets">[]
) {
	return (
		left.length === right.length &&
		left.every((attachmentId, index) => attachmentId === right[index])
	);
}

function pendingProofMatches(
	proof: Doc<"dealPaymentProofs">,
	args: {
		input: NormalizedPaymentProofInput;
		submittedBy: string;
		submittedByRole: PaymentProofSubmitterRole;
	}
) {
	return (
		proof.submittedBy === args.submittedBy &&
		proof.submittedByRole === args.submittedByRole &&
		proof.amount === args.input.amount &&
		proof.currency === args.input.currency &&
		proof.transferDate === args.input.transferDate &&
		proof.sendingParty === args.input.sendingParty &&
		proof.referenceNumber === args.input.referenceNumber &&
		proof.institutionName === args.input.institutionName &&
		proof.note === args.input.note &&
		orderedAttachmentIdsEqual(proof.attachmentIds, args.input.attachmentIds)
	);
}

async function existingPendingPaymentProof(
	ctx: DbContext,
	args: {
		dealId: Id<"deals">;
		input: NormalizedPaymentProofInput;
		submittedBy: string;
		submittedByRole: PaymentProofSubmitterRole;
	}
): Promise<Id<"dealPaymentProofs"> | null> {
	const pendingProofs = await ctx.db
		.query("dealPaymentProofs")
		.withIndex("by_deal_status", (query) =>
			query.eq("dealId", args.dealId).eq("status", "pending_review")
		)
		.collect();
	if (pendingProofs.length === 0) {
		return null;
	}
	if (
		pendingProofs.length === 1 &&
		pendingProofMatches(pendingProofs[0], args)
	) {
		return pendingProofs[0]._id;
	}
	throw new ConvexError(
		"A payment proof is already pending review for this deal"
	);
}

function approvedPaymentProofResult(
	proof: Doc<"dealPaymentProofs">
): ApprovedPaymentProofResult {
	if (
		!(
			proof.leg1TransferId &&
			proof.leg2TransferId &&
			proof.fundsEvidenceId &&
			proof.cashLedgerJournalEntryIds
		) ||
		proof.cashLedgerJournalEntryIds.length === 0
	) {
		throw new ConvexError("Approved payment proof is missing approval links");
	}

	return {
		proofId: proof._id,
		leg1TransferId: proof.leg1TransferId,
		leg2TransferId: proof.leg2TransferId,
		cashLedgerJournalEntryIds: proof.cashLedgerJournalEntryIds,
		cashLedgerPostingGroupId: proof.cashLedgerPostingGroupId ?? undefined,
		fundsEvidenceId: proof.fundsEvidenceId,
	};
}

function manualSettlementEvidence(args: {
	proof: Doc<"dealPaymentProofs">;
	reviewedBy: string;
}) {
	return {
		instrumentType: "wire" as const,
		settlementOccurredAt: args.proof.transferDate,
		externalReference:
			args.proof.referenceNumber ?? `payment-proof:${args.proof._id}`,
		enteredBy: args.reviewedBy,
		location: args.proof.institutionName,
		evidenceAttachmentIds: args.proof.attachmentIds.map(
			(attachmentId) => `${attachmentId}`
		),
	};
}

async function confirmTransferIfNeeded(
	ctx: Pick<ActionCtx, "runMutation" | "runQuery">,
	args: {
		proof: Doc<"dealPaymentProofs">;
		reviewedBy: string;
		transferId: Id<"transferRequests">;
	}
) {
	const transfer: Doc<"transferRequests"> | null = await ctx.runQuery(
		internal.payments.transfers.queries.getTransferInternal,
		{ transferId: args.transferId }
	);
	if (!transfer) {
		throw new ConvexError("Transfer request not found");
	}
	if (transfer.status === "confirmed") {
		return;
	}

	await ctx.runMutation(
		internal.payments.transfers.mutations.confirmManualTransferInternal,
		{
			transferId: args.transferId,
			providerRef: `payment-proof:${args.proof._id}:${args.transferId}`,
			manualSettlement: manualSettlementEvidence({
				proof: args.proof,
				reviewedBy: args.reviewedBy,
			}),
			source: {
				actorId: args.reviewedBy,
				actorType: "admin",
				channel: "admin_dashboard",
			},
		}
	);
}

function pipelineIdForProof(proof: Doc<"dealPaymentProofs">) {
	return `deal-closing:${proof.dealId}`;
}

async function getPipelineLegs(
	ctx: Pick<ActionCtx, "runQuery">,
	pipelineId: string
): Promise<PipelineLegs> {
	const legs: Doc<"transferRequests">[] = await ctx.runQuery(
		internal.payments.transfers.queries.getPipelineLegsInternal,
		{ pipelineId }
	);
	return {
		leg1:
			legs.find(
				(leg) =>
					leg.legNumber === 1 && leg.transferType === "deal_principal_transfer"
			) ?? null,
		leg2:
			legs.find(
				(leg) =>
					leg.legNumber === 2 && leg.transferType === "deal_seller_payout"
			) ?? null,
	};
}

function assertPipelineLegMatchesProof(
	leg: Doc<"transferRequests">,
	args: {
		deal: Doc<"deals">;
		proof: Doc<"dealPaymentProofs">;
	}
) {
	if (
		leg.dealId !== args.proof.dealId ||
		leg.mortgageId !== args.deal.mortgageId ||
		leg.amount !== args.proof.amount ||
		leg.providerCode !== "manual_review"
	) {
		throw new ConvexError(
			"Existing payment proof transfer pipeline does not match proof terms"
		);
	}
}

async function ensureLeg1Transfer(
	ctx: Pick<ActionCtx, "runAction" | "runMutation" | "runQuery">,
	args: {
		deal: Doc<"deals">;
		proof: Doc<"dealPaymentProofs">;
		reviewedBy: string;
	}
) {
	const pipelineId = pipelineIdForProof(args.proof);
	let { leg1 } = await getPipelineLegs(ctx, pipelineId);
	if (!leg1) {
		if (args.deal.status !== "fundsTransfer.pending") {
			throw new ConvexError(
				"Cannot recover payment proof approval without an existing leg 1 transfer"
			);
		}
		const pipeline = await ctx.runAction(
			internal.payments.transfers.pipeline.createDealClosingPipeline,
			{
				dealId: args.proof.dealId,
				pipelineId,
				buyerId: args.deal.buyerId,
				sellerId: args.deal.sellerId,
				lenderId: args.deal.lenderId,
				mortgageId: args.deal.mortgageId,
				leg1Amount: args.proof.amount,
				leg2Amount: args.proof.amount,
				providerCode: "manual_review",
			}
		);
		leg1 = (await ctx.runQuery(
			internal.payments.transfers.queries.getTransferInternal,
			{ transferId: pipeline.leg1TransferId }
		)) as Doc<"transferRequests"> | null;
	}
	if (!leg1) {
		throw new ConvexError("Payment proof approval requires leg 1 transfer");
	}
	assertPipelineLegMatchesProof(leg1, args);
	await confirmTransferIfNeeded(ctx, {
		proof: args.proof,
		reviewedBy: args.reviewedBy,
		transferId: leg1._id,
	});
	return leg1._id;
}

async function ensureLeg2Transfer(
	ctx: Pick<ActionCtx, "runAction" | "runMutation" | "runQuery">,
	args: {
		deal: Doc<"deals">;
		proof: Doc<"dealPaymentProofs">;
		reviewedBy: string;
	}
) {
	const pipelineId = pipelineIdForProof(args.proof);
	let { leg2 } = await getPipelineLegs(ctx, pipelineId);
	if (!leg2) {
		if (args.deal.status !== "fundsTransfer.pending") {
			throw new ConvexError(
				"Cannot recover payment proof approval without an existing leg 2 transfer"
			);
		}
		const created = await ctx.runAction(
			internal.payments.transfers.pipeline.createAndInitiateLeg2,
			{
				pipelineId,
				dealId: args.proof.dealId,
				sellerId: args.deal.sellerId,
				lenderId: args.deal.lenderId,
				mortgageId: args.deal.mortgageId,
				leg2Amount: args.proof.amount,
				providerCode: "manual_review",
			}
		);
		leg2 = (await ctx.runQuery(
			internal.payments.transfers.queries.getTransferInternal,
			{ transferId: created.leg2TransferId }
		)) as Doc<"transferRequests"> | null;
	}
	if (!leg2) {
		throw new ConvexError("Payment proof approval requires leg 2 transfer");
	}
	assertPipelineLegMatchesProof(leg2, args);
	await confirmTransferIfNeeded(ctx, {
		proof: args.proof,
		reviewedBy: args.reviewedBy,
		transferId: leg2._id,
	});
	return leg2._id;
}

async function ensureDealClosedForPaymentProof(
	ctx: Pick<ActionCtx, "runMutation" | "runQuery">,
	args: {
		leg2TransferId: Id<"transferRequests">;
		proof: Doc<"dealPaymentProofs">;
	}
) {
	await ctx.runMutation(
		internal.payments.transfers.mutations.fireDealTransitionInternal,
		{
			dealId: args.proof.dealId,
			eventType: "FUNDS_RECEIVED",
			payload: {
				method: "manual",
				fundsReceiptSource: {
					kind: "transfer_pipeline",
					pipelineId: pipelineIdForProof(args.proof),
					leg2TransferId: args.leg2TransferId,
					providerCode: "manual_review",
				},
			},
		}
	);
}

export const getPaymentProofForReviewInternal = convex
	.query()
	.input({ proofId: v.id("dealPaymentProofs") })
	.handler(
		async (
			ctx,
			args
		): Promise<{
			deal: Doc<"deals">;
			proof: Doc<"dealPaymentProofs">;
		}> => {
			const proof = await ctx.db.get(args.proofId);
			if (!proof) {
				throw new ConvexError("Payment proof not found");
			}
			const deal = await ctx.db.get(proof.dealId);
			if (!deal) {
				throw new ConvexError("Deal not found");
			}
			await assertReviewableAttachments(ctx, proof.attachmentIds);
			return { proof, deal };
		}
	)
	.internal();

export const getCashLedgerIdsForPaymentProofInternal = convex
	.query()
	.input({ transferIds: v.array(v.id("transferRequests")) })
	.handler(
		async (
			ctx,
			args
		): Promise<{
			cashLedgerJournalEntryIds: Id<"cash_ledger_journal_entries">[];
			cashLedgerPostingGroupId: string | undefined;
		}> => {
			const entries = (
				await Promise.all(
					args.transferIds.map((transferId) =>
						ctx.db
							.query("cash_ledger_journal_entries")
							.withIndex("by_transfer_request", (query) =>
								query.eq("transferRequestId", transferId)
							)
							.collect()
					)
				)
			).flat();
			const orderedEntries = entries.sort(
				(left, right) =>
					Number(left.sequenceNumber - right.sequenceNumber) ||
					left._creationTime - right._creationTime
			);
			const postingGroupId = orderedEntries.find(
				(entry) => entry.postingGroupId
			)?.postingGroupId;

			return {
				cashLedgerJournalEntryIds: orderedEntries.map((entry) => entry._id),
				cashLedgerPostingGroupId: postingGroupId,
			};
		}
	)
	.internal();

export const generatePaymentProofUploadUrl = authedMutation
	.input({ dealId: v.id("deals") })
	.returns(v.object({ uploadUrl: v.string() }))
	.handler(async (ctx, args) => {
		await assertPaymentProofAssetUploadAllowed(ctx, {
			dealId: args.dealId,
			viewer: ctx.viewer,
		});
		return { uploadUrl: await ctx.storage.generateUploadUrl() };
	})
	.public();

export const createPaymentProofAsset = authedMutation
	.input({
		dealId: v.id("deals"),
		description: v.optional(v.string()),
		fileHash: v.string(),
		fileRef: v.id("_storage"),
		fileSize: v.number(),
		mimeType: paymentProofMimeTypeValidator,
		name: v.string(),
		originalFilename: v.string(),
	})
	.returns(
		v.object({
			assetId: v.id("documentAssets"),
			duplicate: v.boolean(),
		})
	)
	.handler(async (ctx, args) => {
		await assertPaymentProofAssetUploadAllowed(ctx, {
			dealId: args.dealId,
			viewer: ctx.viewer,
		});
		if (args.fileSize <= 0) {
			throw new ConvexError("Payment proof attachment cannot be empty");
		}
		if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(args.mimeType)) {
			throw new ConvexError("Payment proof attachment type is not supported");
		}

		const uploadedByUserId = await viewerUserId(ctx, ctx.viewer);
		const matchingAssets = await ctx.db
			.query("documentAssets")
			.withIndex("by_hash", (query) => query.eq("fileHash", args.fileHash))
			.collect();
		const existingOwnPaymentProofAsset = matchingAssets.find(
			(asset) =>
				asset.source === "payment_proof_upload" &&
				asset.uploadedByUserId === uploadedByUserId
		);
		if (existingOwnPaymentProofAsset) {
			return { assetId: existingOwnPaymentProofAsset._id, duplicate: true };
		}

		const trimmedName = args.name.trim() || "Payment proof";
		const assetId = await ctx.db.insert("documentAssets", {
			description: args.description,
			fileHash: args.fileHash,
			fileRef: args.fileRef,
			fileSize: args.fileSize,
			mimeType: args.mimeType,
			name: trimmedName,
			originalFilename: args.originalFilename.trim() || trimmedName,
			source: "payment_proof_upload",
			uploadedAt: Date.now(),
			uploadedByUserId,
		});

		return { assetId, duplicate: false };
	})
	.public();

export const markManualPaymentProofApprovedInternal = convex
	.mutation()
	.input({
		proofId: v.id("dealPaymentProofs"),
		reviewedBy: v.string(),
		reviewNote: v.string(),
		leg1TransferId: v.id("transferRequests"),
		leg2TransferId: v.id("transferRequests"),
		cashLedgerJournalEntryIds: v.array(v.id("cash_ledger_journal_entries")),
		cashLedgerPostingGroupId: v.optional(v.string()),
	})
	.handler(async (ctx, args): Promise<ApprovedPaymentProofResult> => {
		const proof = await ctx.db.get(args.proofId);
		if (!proof) {
			throw new ConvexError("Payment proof not found");
		}
		if (proof.status === "approved") {
			return approvedPaymentProofResult(proof);
		}
		if (proof.status !== "pending_review") {
			throw new ConvexError("Only pending payment proofs can be approved");
		}
		if (args.cashLedgerJournalEntryIds.length < 2) {
			throw new ConvexError("Payment proof approval requires cash ledger rows");
		}

		const latestFundsEvidence = (
			await ctx.db
				.query("dealFundsEvidence")
				.withIndex("by_deal", (query) => query.eq("dealId", proof.dealId))
				.collect()
		).sort((left, right) => right.recordedAt - left.recordedAt)[0];
		if (!latestFundsEvidence) {
			throw new ConvexError("Payment proof approval requires funds evidence");
		}

		const now = Date.now();
		await ctx.db.patch(args.proofId, {
			status: "approved",
			reviewedBy: args.reviewedBy,
			reviewedAt: now,
			reviewReason: args.reviewNote,
			leg1TransferId: args.leg1TransferId,
			leg2TransferId: args.leg2TransferId,
			cashLedgerJournalEntryIds: args.cashLedgerJournalEntryIds,
			cashLedgerPostingGroupId: args.cashLedgerPostingGroupId,
			fundsEvidenceId: latestFundsEvidence._id,
			updatedAt: now,
		});

		return {
			proofId: args.proofId,
			leg1TransferId: args.leg1TransferId,
			leg2TransferId: args.leg2TransferId,
			cashLedgerJournalEntryIds: args.cashLedgerJournalEntryIds,
			cashLedgerPostingGroupId: args.cashLedgerPostingGroupId,
			fundsEvidenceId: latestFundsEvidence._id,
		};
	})
	.internal();

export const uploadManualPaymentProof = authedMutation
	.input({
		dealId: v.id("deals"),
		amount: v.number(),
		currency: v.literal("CAD"),
		transferDate: v.number(),
		sendingParty: v.string(),
		referenceNumber: v.optional(v.string()),
		institutionName: v.optional(v.string()),
		note: v.optional(v.string()),
		attachmentIds: v.array(v.id("documentAssets")),
	})
	.returns(v.object({ proofId: v.id("dealPaymentProofs") }))
	.handler(async (ctx, args) => {
		assertFundsPending(await ctx.db.get(args.dealId));
		const normalizedInput = normalizePaymentProofInput(args);

		const submittedByRole = await resolveUploaderRole(ctx, {
			dealId: args.dealId,
			viewer: ctx.viewer,
		});
		if (!canUploadManualPaymentProof(personaForRole(submittedByRole))) {
			throw new ConvexError(
				"Only purchasing lender, ready primary lawyer, or admin can upload proof"
			);
		}
		await assertAttachmentSet(ctx, {
			attachmentIds: normalizedInput.attachmentIds,
			submittedByRole,
			viewer: ctx.viewer,
		});

		const pendingProofId = await existingPendingPaymentProof(ctx, {
			dealId: args.dealId,
			input: normalizedInput,
			submittedBy: ctx.viewer.authId,
			submittedByRole,
		});
		if (pendingProofId !== null) {
			return { proofId: pendingProofId };
		}

		const now = Date.now();
		const proofId = await ctx.db.insert("dealPaymentProofs", {
			dealId: args.dealId,
			submittedBy: ctx.viewer.authId,
			submittedByRole,
			submittedByPersona: personaForRole(submittedByRole),
			status: "pending_review",
			amount: normalizedInput.amount,
			currency: normalizedInput.currency,
			transferDate: normalizedInput.transferDate,
			sendingParty: normalizedInput.sendingParty,
			referenceNumber: normalizedInput.referenceNumber,
			institutionName: normalizedInput.institutionName,
			note: normalizedInput.note,
			attachmentIds: [...normalizedInput.attachmentIds],
			createdAt: now,
			updatedAt: now,
		});

		return { proofId };
	})
	.public();

export const rejectManualPaymentProof = adminMutation
	.input({
		proofId: v.id("dealPaymentProofs"),
		reason: v.string(),
	})
	.returns(v.object({ proofId: v.id("dealPaymentProofs") }))
	.handler(async (ctx, args) => {
		const reason = args.reason.trim();
		if (!reason) {
			throw new ConvexError("Rejection reason is required");
		}

		const proof = await ctx.db.get(args.proofId);
		if (!proof) {
			throw new ConvexError("Payment proof not found");
		}
		if (proof.status !== "pending_review") {
			throw new ConvexError("Only pending payment proofs can be rejected");
		}

		const now = Date.now();
		await ctx.db.patch(args.proofId, {
			status: "rejected",
			reviewedBy: ctx.viewer.authId,
			reviewedAt: now,
			reviewReason: reason,
			updatedAt: now,
		});

		return { proofId: args.proofId };
	})
	.public();

export const approveManualPaymentProof = adminAction
	.input({
		proofId: v.id("dealPaymentProofs"),
		reviewNote: v.string(),
	})
	.handler(async (ctx, args): Promise<ApprovedPaymentProofResult> => {
		const { proof, deal } = await ctx.runQuery(
			internal.deals.paymentProofs.getPaymentProofForReviewInternal,
			{ proofId: args.proofId }
		);

		if (proof.status === "approved") {
			const result = approvedPaymentProofResult(proof);
			await ensureDealClosedForPaymentProof(ctx, {
				proof,
				leg2TransferId: result.leg2TransferId,
			});
			return result;
		}
		if (proof.status === "rejected") {
			throw new ConvexError("Rejected payment proofs cannot be approved");
		}
		if (proof.status !== "pending_review") {
			throw new ConvexError("Only pending payment proofs can be approved");
		}

		const reviewNote = args.reviewNote.trim();
		if (!reviewNote) {
			throw new ConvexError("Review note is required");
		}

		if (
			deal.status !== "fundsTransfer.pending" &&
			deal.status !== "confirmed"
		) {
			throw new ConvexError(
				"Deal must be in fundsTransfer.pending to approve payment proof"
			);
		}
		if (!deal.lenderId) {
			throw new ConvexError("Deal lender is required to approve payment proof");
		}

		const leg1TransferId = await ensureLeg1Transfer(ctx, {
			deal,
			proof,
			reviewedBy: ctx.viewer.authId,
		});
		const leg2TransferId = await ensureLeg2Transfer(ctx, {
			deal,
			proof,
			reviewedBy: ctx.viewer.authId,
		});

		await ensureDealClosedForPaymentProof(ctx, { proof, leg2TransferId });

		const cashLedger = await ctx.runQuery(
			internal.deals.paymentProofs.getCashLedgerIdsForPaymentProofInternal,
			{ transferIds: [leg1TransferId, leg2TransferId] }
		);
		if (cashLedger.cashLedgerJournalEntryIds.length < 2) {
			throw new ConvexError("Payment proof approval requires cash ledger rows");
		}

		return await ctx.runMutation(
			internal.deals.paymentProofs.markManualPaymentProofApprovedInternal,
			{
				proofId: args.proofId,
				reviewedBy: ctx.viewer.authId,
				reviewNote,
				leg1TransferId,
				leg2TransferId,
				cashLedgerJournalEntryIds: cashLedger.cashLedgerJournalEntryIds,
				cashLedgerPostingGroupId: cashLedger.cashLedgerPostingGroupId,
			}
		);
	})
	.public();
