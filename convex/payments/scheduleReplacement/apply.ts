import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { auditLog } from "../../auditLog";
import { adminAction, convex } from "../../fluent";
import { getRecurringCollectionScheduleProvider } from "../recurringSchedules/providers/registry";
import {
	hasRotessaCustomerReference,
	resolveRotessaCustomerReference,
} from "../recurringSchedules/rotessaCustomerReference";
import {
	isUnsafePlanEntryExecutionState,
	loadMortgageScheduleReplacementFacts,
} from "./readModel";
import { buildReplacementPreview, toIsoBusinessDate } from "./scheduleMath";
import type {
	PaymentScheduleReplacementValidationIssue,
	ScheduleReplacementPreviewRow,
} from "./types";

type DraftDoc = Doc<"paymentScheduleReplacementDrafts">;
type MortgageScheduleReplacementFacts = NonNullable<
	Awaited<ReturnType<typeof loadMortgageScheduleReplacementFacts>>
>;

interface ActivatedApplyResult {
	draftId: Id<"paymentScheduleReplacementDrafts">;
	newExternalCollectionScheduleId?: Id<"externalCollectionSchedules">;
	outcome: "activated";
	replacementBatchId: string;
}

interface RejectedApplyResult {
	draftId: Id<"paymentScheduleReplacementDrafts">;
	issues: PaymentScheduleReplacementValidationIssue[];
	outcome: "rejected";
	reasonCode: string;
	reasonDetail: string;
}

type ApplyScheduleReplacementResult =
	| ActivatedApplyResult
	| RejectedApplyResult;

const loadDraftForApplyInternalRef = makeFunctionReference<
	"query",
	{ draftId: Id<"paymentScheduleReplacementDrafts"> },
	DraftDoc | null
>("payments/scheduleReplacement/apply:loadDraftForApplyInternal");

const applyAppManagedReplacementInternalRef = makeFunctionReference<
	"mutation",
	{
		actorId: string;
		draftId: Id<"paymentScheduleReplacementDrafts">;
		oldScheduleId?: Id<"externalCollectionSchedules">;
	},
	ApplyScheduleReplacementResult
>("payments/scheduleReplacement/apply:applyAppManagedReplacementInternal");

const loadActiveRotessaScheduleForManualReplacementInternalRef =
	makeFunctionReference<
		"query",
		{ draftId: Id<"paymentScheduleReplacementDrafts"> },
		{
			externalScheduleRef: string;
			oldScheduleId: Id<"externalCollectionSchedules">;
		} | null
	>(
		"payments/scheduleReplacement/apply:loadActiveRotessaScheduleForManualReplacementInternal"
	);

const applyProviderManagedReplacementInternalRef = makeFunctionReference<
	"action",
	{ actorId: string; draftId: Id<"paymentScheduleReplacementDrafts"> },
	ApplyScheduleReplacementResult
>("payments/scheduleReplacement/apply:applyProviderManagedReplacementInternal");

const ARCHIVE_REASON = "payment_schedule_replacement";
const PROVIDER_ACTIVATION_LEASE_MS = 15 * 60 * 1000;

type ProviderReplacementBeginResult =
	| ActivatedApplyResult
	| RejectedApplyResult
	| {
			bankAccount: Doc<"bankAccounts">;
			draft: DraftDoc;
			oldExternalScheduleRef?: string;
			oldScheduleId?: Id<"externalCollectionSchedules">;
			outcome: "ready";
			replacementBatchId: string;
	  }
	| {
			bankAccount: Doc<"bankAccounts">;
			draft: DraftDoc;
			outcome: "prepared";
			prepared: ProviderReplacementPreparedResult;
			replacementBatchId: string;
	  }
	| {
			externalScheduleRef: string;
			interestPlanEntryIds: Id<"collectionPlanEntries">[];
			newExternalCollectionScheduleId: Id<"externalCollectionSchedules">;
			outcome: "provider_created";
			providerData?: Record<string, unknown>;
			providerStatus: "active" | "pending";
			replacementBatchId: string;
	  };

interface ProviderReplacementPreparedResult {
	interestPlanEntryIds: Id<"collectionPlanEntries">[];
	newExternalCollectionScheduleId: Id<"externalCollectionSchedules">;
}

const beginProviderManagedReplacementInternalRef = makeFunctionReference<
	"mutation",
	{
		activationLeaseId: string;
		actorId: string;
		draftId: Id<"paymentScheduleReplacementDrafts">;
	},
	ProviderReplacementBeginResult
>("payments/scheduleReplacement/apply:beginProviderManagedReplacementInternal");

const recordOldProviderCancelSucceededInternalRef = makeFunctionReference<
	"mutation",
	{
		activationLeaseId: string;
		actorId: string;
		draftId: Id<"paymentScheduleReplacementDrafts">;
		oldScheduleId: Id<"externalCollectionSchedules">;
		replacementBatchId: string;
	},
	RejectedApplyResult | { outcome: "recorded" }
>(
	"payments/scheduleReplacement/apply:recordOldProviderCancelSucceededInternal"
);

const recordOldProviderCancelFailedInternalRef = makeFunctionReference<
	"mutation",
	{
		activationLeaseId: string;
		actorId: string;
		draftId: Id<"paymentScheduleReplacementDrafts">;
		errorMessage: string;
	},
	RejectedApplyResult
>("payments/scheduleReplacement/apply:recordOldProviderCancelFailedInternal");

const prepareProviderManagedReplacementInternalRef = makeFunctionReference<
	"mutation",
	{
		actorId: string;
		activationLeaseId: string;
		draftId: Id<"paymentScheduleReplacementDrafts">;
		oldScheduleId?: Id<"externalCollectionSchedules">;
		replacementBatchId: string;
	},
	ProviderReplacementPreparedResult
>(
	"payments/scheduleReplacement/apply:prepareProviderManagedReplacementInternal"
);

const failProviderManagedReplacementInternalRef = makeFunctionReference<
	"mutation",
	{
		actorId: string;
		activationLeaseId: string;
		compensationFailureMessage?: string;
		draftId: Id<"paymentScheduleReplacementDrafts">;
		errorMessage: string;
		externalScheduleRef?: string;
		newExternalCollectionScheduleId?: Id<"externalCollectionSchedules">;
		providerData?: Record<string, unknown>;
		providerStatus?: "active" | "pending";
		reasonCode: string;
		replacementBatchId: string;
	},
	RejectedApplyResult
>("payments/scheduleReplacement/apply:failProviderManagedReplacementInternal");

const recordProviderScheduleCreatedInternalRef = makeFunctionReference<
	"mutation",
	{
		actorId: string;
		activationLeaseId: string;
		draftId: Id<"paymentScheduleReplacementDrafts">;
		externalScheduleRef: string;
		newExternalCollectionScheduleId: Id<"externalCollectionSchedules">;
		providerData?: Record<string, unknown>;
		providerStatus: "active" | "pending";
		replacementBatchId: string;
	},
	ProviderReplacementBeginResult
>("payments/scheduleReplacement/apply:recordProviderScheduleCreatedInternal");

const commitProviderManagedReplacementInternalRef = makeFunctionReference<
	"mutation",
	{
		actorId: string;
		activationLeaseId: string;
		draftId: Id<"paymentScheduleReplacementDrafts">;
		externalScheduleRef: string;
		interestPlanEntryIds: Id<"collectionPlanEntries">[];
		newExternalCollectionScheduleId: Id<"externalCollectionSchedules">;
		providerData?: Record<string, unknown>;
		providerStatus: "active" | "pending";
		replacementBatchId: string;
	},
	ActivatedApplyResult
>(
	"payments/scheduleReplacement/apply:commitProviderManagedReplacementInternal"
);

function replacementBatchIdForDraft(
	draftId: Id<"paymentScheduleReplacementDrafts">
) {
	return `schedule-replacement:${draftId}`;
}

function issue(
	code: PaymentScheduleReplacementValidationIssue["code"],
	message: string,
	rowKey?: string
): PaymentScheduleReplacementValidationIssue {
	return rowKey ? { code, message, rowKey } : { code, message };
}

function activatedResult(draft: Pick<DraftDoc, "_id" | "replacementBatchId">) {
	return {
		draftId: draft._id,
		outcome: "activated",
		replacementBatchId:
			draft.replacementBatchId ?? replacementBatchIdForDraft(draft._id),
	} satisfies ActivatedApplyResult;
}

function activatedProviderResult(args: {
	draftId: Id<"paymentScheduleReplacementDrafts">;
	newExternalCollectionScheduleId: Id<"externalCollectionSchedules">;
	replacementBatchId: string;
}): ActivatedApplyResult {
	return {
		draftId: args.draftId,
		newExternalCollectionScheduleId: args.newExternalCollectionScheduleId,
		outcome: "activated",
		replacementBatchId: args.replacementBatchId,
	};
}

function rejectedResult(args: {
	draftId: Id<"paymentScheduleReplacementDrafts">;
	issueCode: PaymentScheduleReplacementValidationIssue["code"];
	message: string;
	reasonCode: string;
}): RejectedApplyResult {
	return {
		draftId: args.draftId,
		issues: [issue(args.issueCode, args.message)],
		outcome: "rejected",
		reasonCode: args.reasonCode,
		reasonDetail: args.message,
	};
}

function generatedRows(draft: DraftDoc) {
	return draft.previewRows.filter((row) => row.status === "generated");
}

function generatedInterestAndPrincipalRows(draft: DraftDoc) {
	return generatedRows(draft).filter(
		(row) =>
			row.kind === "replacement_interest" ||
			row.kind === "replacement_principal"
	);
}

function generatedInterestRows(draft: DraftDoc) {
	return generatedRows(draft).filter(
		(row) => row.kind === "replacement_interest"
	);
}

function generatedPrincipalRows(draft: DraftDoc) {
	return generatedRows(draft).filter(
		(row) => row.kind === "replacement_principal"
	);
}

function rotessaFrequency(
	paymentFrequency: DraftDoc["paymentFrequency"]
): "Every Other Week" | "Monthly" | "Weekly" {
	switch (paymentFrequency) {
		case "monthly":
			return "Monthly";
		case "bi_weekly":
		case "accelerated_bi_weekly":
			return "Every Other Week";
		case "weekly":
			return "Weekly";
		default:
			throw new Error(`Unsupported payment frequency: ${paymentFrequency}`);
	}
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : "Unknown activation error";
}

function activationInProgressResult(
	draft: Pick<DraftDoc, "_id">
): RejectedApplyResult {
	return rejectedResult({
		draftId: draft._id,
		issueCode: "stale_draft",
		message:
			"Provider-managed payment schedule replacement activation is already in progress.",
		reasonCode: "activation_in_progress",
	});
}

function hasActiveLease(
	draft: Pick<DraftDoc, "activationLeaseExpiresAt" | "activationLeaseId">,
	activationLeaseId: string,
	now: number
) {
	return (
		draft.activationLeaseId !== undefined &&
		draft.activationLeaseId !== activationLeaseId &&
		(draft.activationLeaseExpiresAt ?? 0) > now
	);
}

function isLeaseOwner(
	draft: Pick<DraftDoc, "activationLeaseId">,
	activationLeaseId: string
) {
	return draft.activationLeaseId === activationLeaseId;
}

function isTerminalExternalCollectionScheduleStatus(
	status: Doc<"externalCollectionSchedules">["status"]
) {
	return (
		status === "cancelled" ||
		status === "completed" ||
		status === "activation_failed"
	);
}

function staleScheduleIssues(
	draft: DraftDoc,
	facts: MortgageScheduleReplacementFacts,
	amounts?: {
		outstandingInterestAmount: number;
		principalPayoffAmount: number;
	}
): PaymentScheduleReplacementValidationIssue[] {
	const draftRows = generatedInterestAndPrincipalRows(draft);
	const firstDraftPaymentNumber =
		draftRows[0]?.paymentNumber ?? facts.firstPaymentNumber;
	const outstandingInterestAmount =
		amounts?.outstandingInterestAmount ?? facts.outstandingInterestAmount;
	const principalPayoffAmount =
		amounts?.principalPayoffAmount ?? facts.principalPayoffAmount;
	const regeneratedPreview = buildReplacementPreview({
		startDate: draft.startDate,
		deadlineDate: facts.deadlineDate,
		paymentFrequency: draft.paymentFrequency,
		outstandingInterestAmount,
		principalPayoffAmount,
		interestPaymentAmount: draft.interestPaymentAmount,
		replacementRail: draft.replacementRail,
		firstPaymentNumber: firstDraftPaymentNumber,
	});
	if (regeneratedPreview.issues.length > 0) {
		if (
			regeneratedPreview.issues.some(
				(row) =>
					row.code === "insufficient_cadence_slots" ||
					row.code === "invalid_interest_amount"
			)
		) {
			return [
				issue(
					"stale_draft",
					"The draft no longer fits within two months after the mortgage maturity date. Refresh and retry."
				),
			];
		}
		return regeneratedPreview.issues;
	}

	if (draftRows.length !== regeneratedPreview.rows.length) {
		return [
			issue(
				"stale_draft",
				"Payment schedule replacement draft no longer matches the current mortgage payoff plan. Refresh and retry."
			),
		];
	}

	const draftRowsByKey = new Map(draftRows.map((row) => [row.rowKey, row]));
	for (const regeneratedRow of regeneratedPreview.rows) {
		const draftRow = draftRowsByKey.get(regeneratedRow.rowKey);
		if (
			!draftRow ||
			draftRow.amount !== regeneratedRow.amount ||
			draftRow.kind !== regeneratedRow.kind ||
			draftRow.obligationType !== regeneratedRow.obligationType ||
			draftRow.paymentNumber !== regeneratedRow.paymentNumber
		) {
			return [
				issue(
					"stale_draft",
					"Payment schedule replacement draft no longer matches the current mortgage payoff plan. Refresh and retry."
				),
			];
		}
		if (
			draft.replacementRail === "provider_managed_rotessa" &&
			(draftRow.scheduledDate !== regeneratedRow.scheduledDate ||
				draftRow.dueDate !== regeneratedRow.dueDate)
		) {
			return [
				issue(
					"provider_date_overrides_not_allowed",
					"Provider-managed Rotessa schedule dates must be regenerated from the selected cadence."
				),
			];
		}
	}

	const rowsPastDeadline = draftRows.filter(
		(row) =>
			row.scheduledDate > facts.deadlineDate || row.dueDate > facts.deadlineDate
	);
	if (rowsPastDeadline.length > 0) {
		return rowsPastDeadline.map((row) =>
			issue(
				"stale_draft",
				"The draft no longer fits within two months after the mortgage maturity date. Refresh and retry.",
				row.rowKey
			)
		);
	}

	for (let index = 1; index < draftRows.length; index += 1) {
		const previous = draftRows[index - 1];
		const current = draftRows[index];
		if (
			previous &&
			current &&
			current.scheduledDate <= previous.scheduledDate
		) {
			return [
				issue(
					"date_override_out_of_order",
					"Generated replacement row dates must be strictly increasing.",
					current.rowKey
				),
			];
		}
	}

	return [];
}

async function auditScheduleReplacementApplyRejected(
	ctx: MutationCtx,
	args: {
		actorId: string;
		draft: DraftDoc;
		issues: PaymentScheduleReplacementValidationIssue[];
		newExternalCollectionScheduleId?: Id<"externalCollectionSchedules">;
		oldExternalScheduleId?: Id<"externalCollectionSchedules">;
		providerError?: string;
		reasonCode: string;
		reasonDetail: string;
		replacementBatchId?: string;
	}
) {
	await auditLog.log(ctx, {
		action: "payments.schedule_replacement.apply_rejected",
		actorId: args.actorId,
		resourceType: "paymentScheduleReplacementDrafts",
		resourceId: args.draft._id,
		severity: "warning",
		metadata: {
			mortgageId: args.draft.mortgageId,
			replacementBatchId: args.replacementBatchId,
			reasonCode: args.reasonCode,
			reasonDetail: args.reasonDetail,
			validationCodes: args.issues.map((row) => row.code),
			validationRowKeys: args.issues
				.map((row) => row.rowKey)
				.filter((rowKey) => rowKey !== undefined),
			oldExternalScheduleId: args.oldExternalScheduleId,
			newExternalCollectionScheduleId: args.newExternalCollectionScheduleId,
			providerError: args.providerError,
		},
	});
}

async function rejectDraft(
	ctx: MutationCtx,
	draft: DraftDoc,
	issues: PaymentScheduleReplacementValidationIssue[],
	options?: {
		actorId?: string;
		newExternalCollectionScheduleId?: Id<"externalCollectionSchedules">;
		oldExternalScheduleId?: Id<"externalCollectionSchedules">;
		providerError?: string;
		reasonCode?: string;
		replacementBatchId?: string;
	}
): Promise<RejectedApplyResult> {
	const firstIssue = issues[0] ?? issue("stale_draft", "Draft apply rejected.");
	const reasonCode = options?.reasonCode ?? firstIssue.code;
	const reasonDetail = firstIssue.message;
	await ctx.db.patch(draft._id, {
		lastError: issues.map((row) => row.message).join(" "),
		updatedAt: Date.now(),
	});
	if (options?.actorId) {
		await auditScheduleReplacementApplyRejected(ctx, {
			actorId: options.actorId,
			draft,
			issues,
			newExternalCollectionScheduleId: options.newExternalCollectionScheduleId,
			oldExternalScheduleId: options.oldExternalScheduleId,
			providerError: options.providerError,
			reasonCode,
			reasonDetail,
			replacementBatchId: options.replacementBatchId,
		});
	}
	return {
		draftId: draft._id,
		issues,
		outcome: "rejected",
		reasonCode,
		reasonDetail,
	};
}

async function findActivatedReplacementForMortgage(
	ctx: Pick<MutationCtx, "db">,
	draft: DraftDoc
) {
	const activatedDrafts = await ctx.db
		.query("paymentScheduleReplacementDrafts")
		.withIndex("by_mortgage_status_created", (q) =>
			q.eq("mortgageId", draft.mortgageId).eq("status", "activated")
		)
		.collect();

	return activatedDrafts.find(
		(activatedDraft) =>
			activatedDraft._id !== draft._id &&
			activatedDraft.replacementBatchId !== undefined
	);
}

async function findBlockingReplacementForMortgage(
	ctx: Pick<MutationCtx, "db">,
	draft: DraftDoc
) {
	const [activatingDrafts, activatedDrafts] = await Promise.all([
		ctx.db
			.query("paymentScheduleReplacementDrafts")
			.withIndex("by_mortgage_status_created", (q) =>
				q.eq("mortgageId", draft.mortgageId).eq("status", "activating")
			)
			.collect(),
		ctx.db
			.query("paymentScheduleReplacementDrafts")
			.withIndex("by_mortgage_status_created", (q) =>
				q.eq("mortgageId", draft.mortgageId).eq("status", "activated")
			)
			.collect(),
	]);

	return [...activatingDrafts, ...activatedDrafts].find(
		(candidate) => candidate._id !== draft._id
	);
}

async function rejectForBlockingReplacement(
	ctx: MutationCtx,
	draft: DraftDoc,
	actorId: string
): Promise<RejectedApplyResult> {
	return rejectDraft(
		ctx,
		draft,
		[
			issue(
				"already_activated",
				"A payment schedule replacement is already activating or activated for this mortgage."
			),
		],
		{ actorId, reasonCode: "already_activated" }
	);
}

async function archiveOldRows(args: {
	archivePlanEntries: Doc<"collectionPlanEntries">[];
	ctx: Pick<MutationCtx, "db">;
	draft: DraftDoc;
	now: number;
	replacementBatchId: string;
	rows: ScheduleReplacementPreviewRow[];
}) {
	for (const row of args.rows) {
		if (row.obligationId) {
			await args.ctx.db.patch(row.obligationId, {
				status: "cancelled",
				archivedByReplacementDraftId: args.draft._id,
				archivedByReplacementBatchId: args.replacementBatchId,
				replacedByReplacementBatchId: args.replacementBatchId,
				archivedAt: args.now,
				archiveReason: ARCHIVE_REASON,
				lastTransitionAt: args.now,
			});
		}
	}

	for (const planEntry of args.archivePlanEntries) {
		await args.ctx.db.patch(planEntry._id, {
			status: "cancelled",
			archivedByReplacementDraftId: args.draft._id,
			archivedByReplacementBatchId: args.replacementBatchId,
			replacedByReplacementBatchId: args.replacementBatchId,
			archivedAt: args.now,
			archiveReason: ARCHIVE_REASON,
			cancelledAt: args.now,
		});
	}
}

async function loadArchivePlanEntries(args: {
	ctx: Pick<MutationCtx, "db">;
	mortgageId: Id<"mortgages">;
	rows: ScheduleReplacementPreviewRow[];
}) {
	const targetObligationIds = new Set(
		args.rows.flatMap((row) => (row.obligationId ? [row.obligationId] : []))
	);
	if (targetObligationIds.size === 0) {
		return [];
	}

	const planEntries = await args.ctx.db
		.query("collectionPlanEntries")
		.withIndex("by_mortgage_status_scheduled", (q) =>
			q.eq("mortgageId", args.mortgageId)
		)
		.collect();

	return planEntries.filter((planEntry) =>
		planEntry.obligationIds.some((obligationId) =>
			targetObligationIds.has(obligationId)
		)
	);
}

function unsafePlanEntryIssues(args: {
	planEntries: Doc<"collectionPlanEntries">[];
	rows: ScheduleReplacementPreviewRow[];
}): PaymentScheduleReplacementValidationIssue[] {
	const rowByObligationId = new Map(
		args.rows.flatMap((row) =>
			row.obligationId ? [[row.obligationId, row]] : []
		)
	);

	return args.planEntries
		.filter(isUnsafePlanEntryExecutionState)
		.map((planEntry) => {
			const row = planEntry.obligationIds
				.map((obligationId) => rowByObligationId.get(obligationId))
				.find((candidate) => candidate !== undefined);
			return issue(
				"unsafe_existing_execution_state",
				"An existing collection plan entry is already executing and must be resolved before replacing this schedule.",
				row?.rowKey
			);
		});
}

async function insertReplacementRows(args: {
	borrowerId: Id<"borrowers">;
	ctx: Pick<MutationCtx, "db">;
	draft: DraftDoc;
	now: number;
	replacementBatchId: string;
	rows: ScheduleReplacementPreviewRow[];
}) {
	const insertedObligationIds: Id<"obligations">[] = [];
	const insertedPlanEntryIds: Id<"collectionPlanEntries">[] = [];

	for (const row of args.rows) {
		const obligationId = await args.ctx.db.insert("obligations", {
			status: "upcoming",
			machineContext: {},
			lastTransitionAt: args.now,
			mortgageId: args.draft.mortgageId,
			borrowerId: args.borrowerId,
			paymentNumber: row.paymentNumber,
			type: row.obligationType,
			amount: row.amount,
			amountSettled: 0,
			dueDate: row.dueDate,
			gracePeriodEnd: row.dueDate,
			createdAt: args.now,
			replacementDraftId: args.draft._id,
			replacementBatchId: args.replacementBatchId,
		});
		insertedObligationIds.push(obligationId);

		const planEntryId = await args.ctx.db.insert("collectionPlanEntries", {
			mortgageId: args.draft.mortgageId,
			obligationIds: [obligationId],
			amount: row.amount,
			method: "manual",
			scheduledDate: row.scheduledDate,
			status: "planned",
			executionMode: "app_owned",
			source: "admin",
			createdAt: args.now,
			replacementDraftId: args.draft._id,
			replacementBatchId: args.replacementBatchId,
		});
		insertedPlanEntryIds.push(planEntryId);
	}

	return { insertedObligationIds, insertedPlanEntryIds };
}

async function insertProviderManagedReplacementRows(args: {
	borrowerId: Id<"borrowers">;
	ctx: Pick<MutationCtx, "db">;
	draft: DraftDoc;
	interestRows: ScheduleReplacementPreviewRow[];
	now: number;
	principalRows: ScheduleReplacementPreviewRow[];
	replacementBatchId: string;
}) {
	const insertedObligationIds: Id<"obligations">[] = [];
	const insertedPlanEntryIds: Id<"collectionPlanEntries">[] = [];
	const interestPlanEntryIds: Id<"collectionPlanEntries">[] = [];

	for (const row of [...args.interestRows, ...args.principalRows]) {
		const obligationId = await args.ctx.db.insert("obligations", {
			status: "upcoming",
			machineContext: {},
			lastTransitionAt: args.now,
			mortgageId: args.draft.mortgageId,
			borrowerId: args.borrowerId,
			paymentNumber: row.paymentNumber,
			type: row.obligationType,
			amount: row.amount,
			amountSettled: 0,
			dueDate: row.dueDate,
			gracePeriodEnd: row.dueDate,
			createdAt: args.now,
			replacementDraftId: args.draft._id,
			replacementBatchId: args.replacementBatchId,
		});
		insertedObligationIds.push(obligationId);

		const isInterestRow = row.kind === "replacement_interest";
		const planEntryId = await args.ctx.db.insert("collectionPlanEntries", {
			mortgageId: args.draft.mortgageId,
			obligationIds: [obligationId],
			amount: row.amount,
			method: "manual",
			scheduledDate: row.scheduledDate,
			status: "planned",
			executionMode: "app_owned",
			source: "admin",
			createdAt: args.now,
			replacementDraftId: args.draft._id,
			replacementBatchId: args.replacementBatchId,
		});
		insertedPlanEntryIds.push(planEntryId);
		if (isInterestRow) {
			interestPlanEntryIds.push(planEntryId);
		}
	}

	return {
		insertedObligationIds,
		insertedPlanEntryIds,
		interestPlanEntryIds,
	};
}

async function loadProviderManagedPreparedResult(args: {
	ctx: Pick<MutationCtx, "db">;
	draft: DraftDoc;
	replacementBatchId: string;
}): Promise<ProviderReplacementPreparedResult | null> {
	if (!args.draft.newExternalCollectionScheduleId) {
		return null;
	}

	const obligations = await args.ctx.db
		.query("obligations")
		.withIndex("by_replacement_batch", (q) =>
			q.eq("replacementBatchId", args.replacementBatchId)
		)
		.collect();
	const interestObligationIds = new Set(
		obligations
			.filter((obligation) => obligation.type === "regular_interest")
			.map((obligation) => obligation._id)
	);
	if (interestObligationIds.size === 0) {
		return null;
	}

	const interestPlanEntryIds = (
		await args.ctx.db
			.query("collectionPlanEntries")
			.withIndex("by_replacement_batch", (q) =>
				q.eq("replacementBatchId", args.replacementBatchId)
			)
			.collect()
	)
		.filter((planEntry) =>
			planEntry.obligationIds.some((obligationId) =>
				interestObligationIds.has(obligationId)
			)
		)
		.sort((left, right) => left.scheduledDate - right.scheduledDate)
		.map((planEntry) => planEntry._id);

	if (interestPlanEntryIds.length === 0) {
		return null;
	}

	return {
		interestPlanEntryIds,
		newExternalCollectionScheduleId: args.draft.newExternalCollectionScheduleId,
	};
}

async function reactivateProviderManagedReplacementRows(args: {
	ctx: Pick<MutationCtx, "db">;
	interestPlanEntryIds: Id<"collectionPlanEntries">[];
	newExternalCollectionScheduleId: Id<"externalCollectionSchedules">;
	now: number;
	replacementBatchId: string;
}) {
	const interestPlanEntryIds = new Set(args.interestPlanEntryIds);
	const planEntries = await args.ctx.db
		.query("collectionPlanEntries")
		.withIndex("by_replacement_batch", (q) =>
			q.eq("replacementBatchId", args.replacementBatchId)
		)
		.collect();
	for (const planEntry of planEntries) {
		if (interestPlanEntryIds.has(planEntry._id)) {
			const ordinal = args.interestPlanEntryIds.indexOf(planEntry._id) + 1;
			await args.ctx.db.patch(planEntry._id, {
				status: "provider_scheduled",
				executionMode: "provider_managed",
				method: "pad_rotessa",
				externalCollectionScheduleId: args.newExternalCollectionScheduleId,
				externalOccurrenceOrdinal: ordinal,
				externallyManagedAt: args.now,
				archivedAt: undefined,
				archiveReason: undefined,
				cancelledAt: undefined,
			});
			continue;
		}

		await args.ctx.db.patch(planEntry._id, {
			status: "planned",
			executionMode: "app_owned",
			method: "manual",
			externalCollectionScheduleId: undefined,
			externalOccurrenceOrdinal: undefined,
			externallyManagedAt: undefined,
			archivedAt: undefined,
			archiveReason: undefined,
			cancelledAt: undefined,
		});
	}

	const obligations = await args.ctx.db
		.query("obligations")
		.withIndex("by_replacement_batch", (q) =>
			q.eq("replacementBatchId", args.replacementBatchId)
		)
		.collect();
	for (const obligation of obligations) {
		await args.ctx.db.patch(obligation._id, {
			status: "upcoming",
			archivedAt: undefined,
			archiveReason: undefined,
			lastTransitionAt: args.now,
		});
	}
}

export const loadDraftForApplyInternal = convex
	.query()
	.input({ draftId: v.id("paymentScheduleReplacementDrafts") })
	.handler(async (ctx, args) => ctx.db.get(args.draftId))
	.internal();

export const loadActiveRotessaScheduleForManualReplacementInternal = convex
	.query()
	.input({ draftId: v.id("paymentScheduleReplacementDrafts") })
	.handler(async (ctx, args) => {
		const draft = await ctx.db.get(args.draftId);
		if (
			!draft ||
			draft.status !== "ready" ||
			draft.replacementRail !== "app_managed_manual"
		) {
			return null;
		}
		const mortgage = await ctx.db.get(draft.mortgageId);
		if (!mortgage?.activeExternalCollectionScheduleId) {
			return null;
		}
		const schedule = await ctx.db.get(
			mortgage.activeExternalCollectionScheduleId
		);
		if (
			!schedule ||
			isTerminalExternalCollectionScheduleStatus(schedule.status)
		) {
			return null;
		}
		if (
			schedule.providerCode !== "pad_rotessa" ||
			!schedule.externalScheduleRef
		) {
			return null;
		}
		return {
			externalScheduleRef: schedule.externalScheduleRef,
			oldScheduleId: schedule._id,
		};
	})
	.internal();

export const applyAppManagedReplacementInternal = convex
	.mutation()
	.input({
		actorId: v.string(),
		draftId: v.id("paymentScheduleReplacementDrafts"),
		oldScheduleId: v.optional(v.id("externalCollectionSchedules")),
	})
	.handler(async (ctx, args): Promise<ApplyScheduleReplacementResult> => {
		const draft = await ctx.db.get(args.draftId);
		if (!draft) {
			return {
				draftId: args.draftId,
				issues: [
					issue(
						"mortgage_not_found",
						"Payment schedule replacement draft was not found."
					),
				],
				outcome: "rejected",
				reasonCode: "draft_not_found",
				reasonDetail: "Payment schedule replacement draft was not found.",
			};
		}
		if (draft.status === "activated" && draft.replacementBatchId) {
			return activatedResult(draft);
		}
		if (draft.status === "cancelled") {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"stale_draft",
						"Cancelled payment schedule replacement drafts cannot be applied."
					),
				],
				{ actorId: args.actorId }
			);
		}
		if (draft.status === "activation_failed") {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"stale_draft",
						"Failed payment schedule replacement drafts are not handled by the app-managed apply path."
					),
				],
				{ actorId: args.actorId }
			);
		}
		if (draft.status !== "ready") {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"stale_draft",
						"Payment schedule replacement draft must be ready before apply."
					),
				],
				{ actorId: args.actorId }
			);
		}
		if (draft.replacementRail !== "app_managed_manual") {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"provider_pad_required",
						"Provider-managed Rotessa replacement activation is handled by the provider-managed apply path."
					),
				],
				{ actorId: args.actorId }
			);
		}

		const alreadyActivated = await findActivatedReplacementForMortgage(
			ctx,
			draft
		);
		if (alreadyActivated) {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"already_activated",
						"A replacement schedule has already been activated for this mortgage."
					),
				],
				{ actorId: args.actorId }
			);
		}

		const facts = await loadMortgageScheduleReplacementFacts(
			ctx,
			draft.mortgageId
		);
		if (!facts) {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"mortgage_not_found",
						"Mortgage not found or has no borrower for schedule replacement."
					),
				],
				{ actorId: args.actorId }
			);
		}

		const archivePlanEntries = await loadArchivePlanEntries({
			ctx,
			mortgageId: draft.mortgageId,
			rows: facts.archiveCandidateRows,
		});
		const unsafeIssues = unsafePlanEntryIssues({
			planEntries: archivePlanEntries,
			rows: facts.archiveCandidateRows,
		});
		if (unsafeIssues.length > 0) {
			return rejectDraft(ctx, draft, unsafeIssues, { actorId: args.actorId });
		}
		if (
			facts.outstandingInterestAmount !== draft.outstandingInterestAmount ||
			facts.principalPayoffAmount !== draft.principalPayoffAmount
		) {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"stale_draft",
						"Mortgage payment facts changed after this replacement draft was prepared. Refresh and retry."
					),
				],
				{ actorId: args.actorId }
			);
		}
		const scheduleIssues = staleScheduleIssues(draft, facts);
		if (scheduleIssues.length > 0) {
			return rejectDraft(ctx, draft, scheduleIssues, {
				actorId: args.actorId,
				reasonCode: "stale_draft",
			});
		}

		const replacementRows = generatedInterestAndPrincipalRows(draft);
		if (replacementRows.length === 0) {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"stale_draft",
						"Payment schedule replacement draft has no generated replacement rows."
					),
				],
				{ actorId: args.actorId }
			);
		}

		const replacementBatchId = replacementBatchIdForDraft(draft._id);
		const now = Date.now();
		if (facts.mortgage.activeExternalCollectionScheduleId) {
			const oldSchedule = await ctx.db.get(
				facts.mortgage.activeExternalCollectionScheduleId
			);
			if (
				oldSchedule &&
				!isTerminalExternalCollectionScheduleStatus(oldSchedule.status) &&
				oldSchedule._id !== args.oldScheduleId
			) {
				return rejectDraft(
					ctx,
					draft,
					[
						issue(
							"stale_draft",
							"Manual replacement requires cancelling the active provider schedule before activation."
						),
					],
					{ actorId: args.actorId, replacementBatchId }
				);
			}
		}
		const existingReplacementRows = await ctx.db
			.query("obligations")
			.withIndex("by_replacement_batch", (q) =>
				q.eq("replacementBatchId", replacementBatchId)
			)
			.collect();
		if (existingReplacementRows.length > 0) {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"stale_draft",
						"Replacement batch rows already exist for a draft that is not activated. Manual review is required before retrying."
					),
				],
				{ actorId: args.actorId, replacementBatchId }
			);
		}

		await ctx.db.patch(draft._id, {
			status: "activating",
			lastError: undefined,
			updatedAt: now,
			updatedByActorId: args.actorId,
		});

		await archiveOldRows({
			archivePlanEntries,
			ctx,
			draft,
			now,
			replacementBatchId,
			rows: facts.archiveCandidateRows,
		});
		const inserted = await insertReplacementRows({
			borrowerId: facts.borrowerId,
			ctx,
			draft,
			now,
			replacementBatchId,
			rows: replacementRows,
		});
		if (args.oldScheduleId) {
			const oldSchedule = await ctx.db.get(args.oldScheduleId);
			await ctx.db.patch(args.oldScheduleId, {
				cancelledAt: now,
				lastProviderScheduleStatus: "cancelled",
				lastTransitionAt: now,
				providerData: {
					...(oldSchedule?.providerData ?? {}),
					cancelledByReplacementDraftId: String(draft._id),
					cancelledByReplacementBatchId: replacementBatchId,
				},
				status: "cancelled",
			});
			await ctx.db.patch(draft.mortgageId, {
				activeExternalCollectionScheduleId: undefined,
				collectionExecutionMode: "app_owned",
				collectionExecutionProviderCode: undefined,
				collectionExecutionUpdatedAt: now,
			});
		}

		await ctx.db.patch(draft._id, {
			status: "activated",
			replacementBatchId,
			activatedAt: now,
			activatedByActorId: args.actorId,
			updatedAt: now,
			updatedByActorId: args.actorId,
		});
		await auditLog.log(ctx, {
			action: "payments.schedule_replacement.activated",
			actorId: args.actorId,
			resourceType: "paymentScheduleReplacementDrafts",
			resourceId: draft._id,
			severity: "info",
			metadata: {
				mortgageId: draft.mortgageId,
				replacementBatchId,
				archivedObligationIds: facts.archiveCandidateRows
					.map((row) => row.obligationId)
					.filter((id) => id !== undefined),
				archivedPlanEntryIds: archivePlanEntries.map((entry) => entry._id),
				insertedObligationIds: inserted.insertedObligationIds,
				insertedPlanEntryIds: inserted.insertedPlanEntryIds,
			},
		});

		return activatedResult({ _id: draft._id, replacementBatchId });
	})
	.internal();

export const beginProviderManagedReplacementInternal = convex
	.mutation()
	.input({
		activationLeaseId: v.string(),
		actorId: v.string(),
		draftId: v.id("paymentScheduleReplacementDrafts"),
	})
	.handler(async (ctx, args): Promise<ProviderReplacementBeginResult> => {
		const draft = await ctx.db.get(args.draftId);
		if (!draft) {
			return rejectedResult({
				draftId: args.draftId,
				issueCode: "mortgage_not_found",
				message: "Payment schedule replacement draft was not found.",
				reasonCode: "draft_not_found",
			});
		}
		if (draft.status === "activated" && draft.replacementBatchId) {
			return activatedResult(draft);
		}
		const isActivatingRetry = draft.status === "activating";
		const isActivationFailedRetry = draft.status === "activation_failed";
		const isResumable = isActivatingRetry || isActivationFailedRetry;
		const now = Date.now();
		if (
			isActivatingRetry &&
			hasActiveLease(draft, args.activationLeaseId, now)
		) {
			return activationInProgressResult(draft);
		}
		if (!(draft.status === "ready" || isResumable)) {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"stale_draft",
						"Provider-managed payment schedule replacement draft must be ready or resumable before apply."
					),
				],
				{ actorId: args.actorId }
			);
		}
		if (draft.replacementRail !== "provider_managed_rotessa") {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"stale_draft",
						"Only provider-managed Rotessa drafts can use the provider-managed apply path."
					),
				],
				{ actorId: args.actorId }
			);
		}
		if (!(draft.bankAccountId && draft.padAuthorizationAssetId)) {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"provider_pad_required",
						"Provider-managed Rotessa replacement requires a bank account and PAD authorization asset."
					),
				],
				{
					actorId: args.actorId,
					reasonCode: "provider_requirements_missing",
				}
			);
		}

		const bankAccount = await ctx.db.get(draft.bankAccountId);
		if (!bankAccount) {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"provider_bank_account_required",
						"Provider-managed Rotessa replacement requires an active borrower-owned bank account."
					),
				],
				{
					actorId: args.actorId,
					reasonCode: "provider_requirements_missing",
				}
			);
		}
		const padAsset = await ctx.db.get(draft.padAuthorizationAssetId);
		if (
			!padAsset ||
			padAsset.mimeType !== "application/pdf" ||
			padAsset.source !== "admin_upload"
		) {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"provider_pad_required",
						"Provider-managed Rotessa replacement requires an uploaded PDF PAD authorization document."
					),
				],
				{
					actorId: args.actorId,
					reasonCode: "provider_requirements_missing",
				}
			);
		}

		const alreadyActivated = await findActivatedReplacementForMortgage(
			ctx,
			draft
		);
		if (alreadyActivated) {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"already_activated",
						"A replacement schedule has already been activated for this mortgage."
					),
				],
				{ actorId: args.actorId, reasonCode: "already_activated" }
			);
		}
		const blockingReplacement = await findBlockingReplacementForMortgage(
			ctx,
			draft
		);
		if (blockingReplacement) {
			return rejectForBlockingReplacement(ctx, draft, args.actorId);
		}

		const facts = await loadMortgageScheduleReplacementFacts(
			ctx,
			draft.mortgageId
		);
		if (!facts) {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"mortgage_not_found",
						"Mortgage not found or has no borrower for schedule replacement."
					),
				],
				{ actorId: args.actorId, reasonCode: "mortgage_not_found" }
			);
		}
		if (
			bankAccount.ownerType !== "borrower" ||
			bankAccount.ownerId !== String(facts.borrowerId) ||
			bankAccount.status !== "validated" ||
			bankAccount.mandateStatus !== "active"
		) {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"provider_bank_account_required",
						"Provider-managed Rotessa replacement requires an active borrower-owned bank account."
					),
				],
				{
					actorId: args.actorId,
					reasonCode: "provider_requirements_missing",
				}
			);
		}
		if (!hasRotessaCustomerReference(bankAccount.metadata)) {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"provider_bank_account_required",
						"Provider-managed Rotessa replacement requires a bank account linked to a Rotessa customer."
					),
				],
				{
					actorId: args.actorId,
					reasonCode: "provider_requirements_missing",
				}
			);
		}

		const archivePlanEntries = await loadArchivePlanEntries({
			ctx,
			mortgageId: draft.mortgageId,
			rows: facts.archiveCandidateRows,
		});
		const unsafeIssues = unsafePlanEntryIssues({
			planEntries: archivePlanEntries,
			rows: facts.archiveCandidateRows,
		});
		if (unsafeIssues.length > 0) {
			return rejectDraft(ctx, draft, unsafeIssues, { actorId: args.actorId });
		}
		const replacementBatchId =
			draft.replacementBatchId ?? replacementBatchIdForDraft(draft._id);
		const preparedResume = isResumable
			? await loadProviderManagedPreparedResult({
					ctx,
					draft,
					replacementBatchId,
				})
			: null;
		const isPreparedActivationFailureRetry =
			isActivationFailedRetry && preparedResume !== null;
		if (
			!isPreparedActivationFailureRetry &&
			(facts.outstandingInterestAmount !== draft.outstandingInterestAmount ||
				facts.principalPayoffAmount !== draft.principalPayoffAmount)
		) {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"stale_draft",
						"Mortgage payment facts changed after this replacement draft was prepared. Refresh and retry."
					),
				],
				{ actorId: args.actorId }
			);
		}
		const scheduleIssues = staleScheduleIssues(
			draft,
			facts,
			isPreparedActivationFailureRetry
				? {
						outstandingInterestAmount: draft.outstandingInterestAmount,
						principalPayoffAmount: draft.principalPayoffAmount,
					}
				: undefined
		);
		if (scheduleIssues.length > 0) {
			return rejectDraft(ctx, draft, scheduleIssues, {
				actorId: args.actorId,
				reasonCode: "stale_draft",
			});
		}
		if (
			generatedInterestRows(draft).length !== draft.interestInstallmentCount ||
			generatedPrincipalRows(draft).length !== 1
		) {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"stale_draft",
						"Payment schedule replacement draft has invalid generated provider rows."
					),
				],
				{ actorId: args.actorId }
			);
		}

		if (preparedResume) {
			await ctx.db.patch(draft._id, {
				status: "activating",
				activationLeaseId: args.activationLeaseId,
				activationLeaseExpiresAt: now + PROVIDER_ACTIVATION_LEASE_MS,
				lastError: undefined,
				updatedAt: now,
				updatedByActorId: args.actorId,
			});
			const leasedDraft = {
				...draft,
				status: "activating" as const,
				activationLeaseId: args.activationLeaseId,
				activationLeaseExpiresAt: now + PROVIDER_ACTIVATION_LEASE_MS,
				lastError: undefined,
			};
			const newSchedule = await ctx.db.get(
				preparedResume.newExternalCollectionScheduleId
			);
			if (
				newSchedule?.externalScheduleRef &&
				newSchedule.status !== "activation_failed"
			) {
				return {
					externalScheduleRef: newSchedule.externalScheduleRef,
					interestPlanEntryIds: preparedResume.interestPlanEntryIds,
					newExternalCollectionScheduleId:
						preparedResume.newExternalCollectionScheduleId,
					outcome: "provider_created",
					providerData: newSchedule.providerData,
					providerStatus:
						newSchedule.lastProviderScheduleStatus === "active"
							? "active"
							: "pending",
					replacementBatchId,
				};
			}

			return {
				bankAccount,
				draft: leasedDraft,
				outcome: "prepared",
				prepared: preparedResume,
				replacementBatchId,
			};
		}
		if (isActivatingRetry) {
			if (draft.archivedExternalCollectionScheduleId) {
				await ctx.db.patch(draft._id, {
					activationLeaseId: args.activationLeaseId,
					activationLeaseExpiresAt: now + PROVIDER_ACTIVATION_LEASE_MS,
					updatedAt: now,
					updatedByActorId: args.actorId,
				});
				return {
					bankAccount,
					draft,
					oldScheduleId: draft.archivedExternalCollectionScheduleId,
					outcome: "ready",
					replacementBatchId,
				};
			}

			return activationInProgressResult(draft);
		}
		const existingReplacementRows = await ctx.db
			.query("obligations")
			.withIndex("by_replacement_batch", (q) =>
				q.eq("replacementBatchId", replacementBatchId)
			)
			.collect();
		if (existingReplacementRows.length > 0) {
			return rejectDraft(
				ctx,
				draft,
				[
					issue(
						"stale_draft",
						"Replacement batch rows already exist for a draft that is not activated. Manual review is required before retrying."
					),
				],
				{ actorId: args.actorId, replacementBatchId }
			);
		}

		const mortgage = facts.mortgage;
		let oldSchedule: Doc<"externalCollectionSchedules"> | null = null;
		let oldProviderScheduleToCancel: Doc<"externalCollectionSchedules"> | null =
			null;
		if (mortgage.activeExternalCollectionScheduleId) {
			oldSchedule = await ctx.db.get(
				mortgage.activeExternalCollectionScheduleId
			);
			if (!oldSchedule) {
				return rejectDraft(
					ctx,
					draft,
					[
						issue(
							"stale_draft",
							"Mortgage references a missing active external collection schedule."
						),
					],
					{ actorId: args.actorId }
				);
			}
			if (!isTerminalExternalCollectionScheduleStatus(oldSchedule.status)) {
				if (oldSchedule.providerCode !== "pad_rotessa") {
					return rejectDraft(
						ctx,
						draft,
						[
							issue(
								"stale_draft",
								"Mortgage has a live external collection schedule that is not managed by Rotessa."
							),
						],
						{ actorId: args.actorId }
					);
				}
				if (!oldSchedule.externalScheduleRef) {
					return rejectDraft(
						ctx,
						draft,
						[
							issue(
								"stale_draft",
								"Live Rotessa schedule is missing externalScheduleRef and cannot be cancelled safely."
							),
						],
						{
							actorId: args.actorId,
							oldExternalScheduleId: oldSchedule._id,
							reasonCode: "old_provider_cancel_failed",
						}
					);
				}
				oldProviderScheduleToCancel = oldSchedule;
			}
		}

		await ctx.db.patch(draft._id, {
			status: "activating",
			replacementBatchId,
			activationLeaseId: args.activationLeaseId,
			activationLeaseExpiresAt: now + PROVIDER_ACTIVATION_LEASE_MS,
			lastError: undefined,
			updatedAt: now,
			updatedByActorId: args.actorId,
		});

		return {
			bankAccount,
			draft,
			oldExternalScheduleRef: oldProviderScheduleToCancel?.externalScheduleRef,
			oldScheduleId: oldProviderScheduleToCancel?._id,
			outcome: "ready",
			replacementBatchId,
		};
	})
	.internal();

export const recordOldProviderCancelSucceededInternal = convex
	.mutation()
	.input({
		activationLeaseId: v.string(),
		actorId: v.string(),
		draftId: v.id("paymentScheduleReplacementDrafts"),
		oldScheduleId: v.id("externalCollectionSchedules"),
		replacementBatchId: v.string(),
	})
	.handler(
		async (
			ctx,
			args
		): Promise<RejectedApplyResult | { outcome: "recorded" }> => {
			const draft = await ctx.db.get(args.draftId);
			if (!draft) {
				return rejectedResult({
					draftId: args.draftId,
					issueCode: "mortgage_not_found",
					message: "Payment schedule replacement draft was not found.",
					reasonCode: "draft_not_found",
				});
			}
			if (!isLeaseOwner(draft, args.activationLeaseId)) {
				return activationInProgressResult(draft);
			}

			const now = Date.now();
			const oldSchedule = await ctx.db.get(args.oldScheduleId);
			await ctx.db.patch(args.oldScheduleId, {
				cancelledAt: now,
				lastProviderScheduleStatus: "cancelled",
				lastTransitionAt: now,
				providerData: {
					...(oldSchedule?.providerData ?? {}),
					cancelledByReplacementDraftId: String(args.draftId),
					cancelledByReplacementBatchId: args.replacementBatchId,
				},
				status: "cancelled",
			});
			await ctx.db.patch(args.draftId, {
				archivedExternalCollectionScheduleId: args.oldScheduleId,
				providerCancelSucceededAt: now,
				updatedAt: now,
				updatedByActorId: args.actorId,
			});

			return { outcome: "recorded" };
		}
	)
	.internal();

export const recordOldProviderCancelFailedInternal = convex
	.mutation()
	.input({
		activationLeaseId: v.string(),
		actorId: v.string(),
		draftId: v.id("paymentScheduleReplacementDrafts"),
		errorMessage: v.string(),
	})
	.handler(async (ctx, args): Promise<RejectedApplyResult> => {
		const draft = await ctx.db.get(args.draftId);
		if (draft && !isLeaseOwner(draft, args.activationLeaseId)) {
			return activationInProgressResult(draft);
		}
		const now = Date.now();
		await ctx.db.patch(args.draftId, {
			status: "ready",
			activationLeaseId: undefined,
			activationLeaseExpiresAt: undefined,
			lastError: args.errorMessage,
			updatedAt: now,
			updatedByActorId: args.actorId,
		});
		const issues = [issue("stale_draft", args.errorMessage)];
		if (draft) {
			await auditScheduleReplacementApplyRejected(ctx, {
				actorId: args.actorId,
				draft,
				issues,
				providerError: args.errorMessage,
				reasonCode: "old_provider_cancel_failed",
				reasonDetail: args.errorMessage,
			});
		}
		return rejectedResult({
			draftId: args.draftId,
			issueCode: "stale_draft",
			message: args.errorMessage,
			reasonCode: "old_provider_cancel_failed",
		});
	})
	.internal();

export const prepareProviderManagedReplacementInternal = convex
	.mutation()
	.input({
		activationLeaseId: v.string(),
		actorId: v.string(),
		draftId: v.id("paymentScheduleReplacementDrafts"),
		oldScheduleId: v.optional(v.id("externalCollectionSchedules")),
		replacementBatchId: v.string(),
	})
	.handler(async (ctx, args): Promise<ProviderReplacementPreparedResult> => {
		const draft = await ctx.db.get(args.draftId);
		if (!draft) {
			throw new Error("Payment schedule replacement draft was not found.");
		}
		if (!isLeaseOwner(draft, args.activationLeaseId)) {
			throw new Error(
				"Provider-managed payment schedule replacement activation is already in progress."
			);
		}
		if (
			draft.status !== "activating" ||
			draft.replacementRail !== "provider_managed_rotessa" ||
			!draft.bankAccountId
		) {
			throw new Error(
				"Provider-managed payment schedule replacement draft is not ready for preparation."
			);
		}

		const facts = await loadMortgageScheduleReplacementFacts(
			ctx,
			draft.mortgageId
		);
		if (!facts) {
			throw new Error(
				"Mortgage not found or has no borrower for schedule replacement."
			);
		}
		const blockingReplacement = await findBlockingReplacementForMortgage(
			ctx,
			draft
		);
		if (blockingReplacement) {
			throw new Error(
				"A payment schedule replacement is already activating or activated for this mortgage."
			);
		}
		const archivePlanEntries = await loadArchivePlanEntries({
			ctx,
			mortgageId: draft.mortgageId,
			rows: facts.archiveCandidateRows,
		});
		const unsafeIssues = unsafePlanEntryIssues({
			planEntries: archivePlanEntries,
			rows: facts.archiveCandidateRows,
		});
		if (unsafeIssues.length > 0) {
			throw new Error(unsafeIssues.map((row) => row.message).join(" "));
		}
		if (
			facts.outstandingInterestAmount !== draft.outstandingInterestAmount ||
			facts.principalPayoffAmount !== draft.principalPayoffAmount
		) {
			throw new Error(
				"Mortgage payment facts changed after this replacement draft was prepared. Refresh and retry."
			);
		}
		const scheduleIssues = staleScheduleIssues(draft, facts);
		if (scheduleIssues.length > 0) {
			throw new Error(scheduleIssues.map((row) => row.message).join(" "));
		}
		if (
			generatedInterestRows(draft).length !== draft.interestInstallmentCount ||
			generatedPrincipalRows(draft).length !== 1
		) {
			throw new Error(
				"Payment schedule replacement draft has invalid generated provider rows."
			);
		}
		if (draft.interestInstallmentCount < 1) {
			throw new Error(
				"Provider-managed Rotessa schedules require at least one interest installment."
			);
		}
		const existingReplacementRows = await ctx.db
			.query("obligations")
			.withIndex("by_replacement_batch", (q) =>
				q.eq("replacementBatchId", args.replacementBatchId)
			)
			.collect();
		if (existingReplacementRows.length > 0) {
			throw new Error(
				"Replacement batch rows already exist before provider-managed preparation."
			);
		}
		const now = Date.now();

		if (args.oldScheduleId) {
			const oldSchedule = await ctx.db.get(args.oldScheduleId);
			await ctx.db.patch(args.oldScheduleId, {
				cancelledAt: now,
				lastProviderScheduleStatus: "cancelled",
				lastTransitionAt: now,
				providerData: {
					...(oldSchedule?.providerData ?? {}),
					cancelledByReplacementDraftId: String(draft._id),
					cancelledByReplacementBatchId: args.replacementBatchId,
				},
				status: "cancelled",
			});
		}

		await archiveOldRows({
			archivePlanEntries,
			ctx,
			draft,
			now,
			replacementBatchId: args.replacementBatchId,
			rows: facts.archiveCandidateRows,
		});

		const interestRows = generatedInterestRows(draft);
		const principalRows = generatedPrincipalRows(draft);
		const inserted = await insertProviderManagedReplacementRows({
			borrowerId: facts.borrowerId,
			ctx,
			draft,
			interestRows,
			now,
			principalRows,
			replacementBatchId: args.replacementBatchId,
		});
		const firstInterestPlanEntryId = inserted.interestPlanEntryIds[0];
		const lastInterestPlanEntryId = inserted.interestPlanEntryIds.at(-1);
		const firstInterestRow = interestRows[0];
		const lastInterestRow = interestRows.at(-1);
		if (
			!(
				firstInterestPlanEntryId &&
				lastInterestPlanEntryId &&
				firstInterestRow &&
				lastInterestRow
			)
		) {
			throw new Error(
				"Provider-managed replacement requires at least one interest installment."
			);
		}

		const newExternalCollectionScheduleId = await ctx.db.insert(
			"externalCollectionSchedules",
			{
				status: "activating",
				mortgageId: draft.mortgageId,
				borrowerId: facts.borrowerId,
				providerCode: "pad_rotessa",
				bankAccountId: draft.bankAccountId,
				activationIdempotencyKey: args.replacementBatchId,
				startDate: firstInterestRow.scheduledDate,
				endDate: lastInterestRow.scheduledDate,
				cadence: rotessaFrequency(draft.paymentFrequency),
				coveredFromPlanEntryId: firstInterestPlanEntryId,
				coveredToPlanEntryId: lastInterestPlanEntryId,
				consecutiveSyncFailures: 0,
				providerData: {
					replacementDraftId: String(draft._id),
					replacementBatchId: args.replacementBatchId,
					archivedExternalCollectionScheduleId: args.oldScheduleId
						? String(args.oldScheduleId)
						: undefined,
				},
				source: "payment_schedule_replacement",
				createdAt: now,
				lastTransitionAt: now,
			}
		);

		await ctx.db.patch(draft._id, {
			archivedExternalCollectionScheduleId: args.oldScheduleId,
			newExternalCollectionScheduleId,
			replacementBatchId: args.replacementBatchId,
			updatedAt: now,
			updatedByActorId: args.actorId,
		});

		return {
			interestPlanEntryIds: inserted.interestPlanEntryIds,
			newExternalCollectionScheduleId,
		};
	})
	.internal();

export const failProviderManagedReplacementInternal = convex
	.mutation()
	.input({
		activationLeaseId: v.string(),
		actorId: v.string(),
		compensationFailureMessage: v.optional(v.string()),
		draftId: v.id("paymentScheduleReplacementDrafts"),
		errorMessage: v.string(),
		externalScheduleRef: v.optional(v.string()),
		newExternalCollectionScheduleId: v.optional(
			v.id("externalCollectionSchedules")
		),
		providerData: v.optional(v.record(v.string(), v.any())),
		providerStatus: v.optional(
			v.union(v.literal("pending"), v.literal("active"))
		),
		reasonCode: v.string(),
		replacementBatchId: v.string(),
	})
	.handler(async (ctx, args): Promise<RejectedApplyResult> => {
		const draft = await ctx.db.get(args.draftId);
		if (draft && !isLeaseOwner(draft, args.activationLeaseId)) {
			return activationInProgressResult(draft);
		}
		const now = Date.now();
		const providerRefMessage = args.externalScheduleRef
			? ` External Rotessa schedule ref: ${args.externalScheduleRef}.`
			: "";
		const compensationMessage = args.compensationFailureMessage
			? ` Compensation cancel failed: ${args.compensationFailureMessage}.`
			: "";
		const lastError = `${args.errorMessage}${providerRefMessage}${compensationMessage}`;

		const planEntries = await ctx.db
			.query("collectionPlanEntries")
			.withIndex("by_replacement_batch", (q) =>
				q.eq("replacementBatchId", args.replacementBatchId)
			)
			.collect();
		for (const planEntry of planEntries) {
			if (planEntry.status !== "cancelled") {
				await ctx.db.patch(planEntry._id, {
					status: "cancelled",
					cancelledAt: now,
					archiveReason: ARCHIVE_REASON,
					archivedAt: planEntry.archivedAt ?? now,
				});
			}
		}

		const obligations = await ctx.db
			.query("obligations")
			.withIndex("by_replacement_batch", (q) =>
				q.eq("replacementBatchId", args.replacementBatchId)
			)
			.collect();
		for (const obligation of obligations) {
			if (obligation.status !== "cancelled") {
				await ctx.db.patch(obligation._id, {
					status: "cancelled",
					archiveReason: ARCHIVE_REASON,
					archivedAt: obligation.archivedAt ?? now,
					lastTransitionAt: now,
				});
			}
		}

		if (args.newExternalCollectionScheduleId) {
			const existingSchedule = await ctx.db.get(
				args.newExternalCollectionScheduleId
			);
			await ctx.db.patch(args.newExternalCollectionScheduleId, {
				externalScheduleRef:
					args.externalScheduleRef ?? existingSchedule?.externalScheduleRef,
				status: "activation_failed",
				lastProviderScheduleStatus:
					args.providerStatus ?? existingSchedule?.lastProviderScheduleStatus,
				lastSyncErrorAt: now,
				lastSyncErrorMessage: lastError,
				lastTransitionAt: now,
				providerData: {
					...(existingSchedule?.providerData ?? {}),
					...(args.providerData ?? {}),
					replacementDraftId: String(args.draftId),
					replacementBatchId: args.replacementBatchId,
					...(args.compensationFailureMessage
						? { compensationCancelFailed: true }
						: {}),
				},
			});
		}

		await ctx.db.patch(args.draftId, {
			status: "activation_failed",
			activationLeaseId: undefined,
			activationLeaseExpiresAt: undefined,
			lastError,
			updatedAt: now,
			updatedByActorId: args.actorId,
		});
		const issues = [issue("stale_draft", lastError)];
		if (draft) {
			await auditScheduleReplacementApplyRejected(ctx, {
				actorId: args.actorId,
				draft,
				issues,
				newExternalCollectionScheduleId: args.newExternalCollectionScheduleId,
				providerError: lastError,
				reasonCode: args.reasonCode,
				reasonDetail: lastError,
				replacementBatchId: args.replacementBatchId,
			});
		}

		return rejectedResult({
			draftId: args.draftId,
			issueCode: "stale_draft",
			message: lastError,
			reasonCode: args.reasonCode,
		});
	})
	.internal();

export const recordProviderScheduleCreatedInternal = convex
	.mutation()
	.input({
		activationLeaseId: v.string(),
		actorId: v.string(),
		draftId: v.id("paymentScheduleReplacementDrafts"),
		externalScheduleRef: v.string(),
		newExternalCollectionScheduleId: v.id("externalCollectionSchedules"),
		providerData: v.optional(v.record(v.string(), v.any())),
		providerStatus: v.union(v.literal("pending"), v.literal("active")),
		replacementBatchId: v.string(),
	})
	.handler(async (ctx, args): Promise<ProviderReplacementBeginResult> => {
		const draft = await ctx.db.get(args.draftId);
		if (!draft) {
			return rejectedResult({
				draftId: args.draftId,
				issueCode: "mortgage_not_found",
				message: "Payment schedule replacement draft was not found.",
				reasonCode: "draft_not_found",
			});
		}
		if (!isLeaseOwner(draft, args.activationLeaseId)) {
			return activationInProgressResult(draft);
		}

		const now = Date.now();
		await ctx.db.patch(args.newExternalCollectionScheduleId, {
			externalScheduleRef: args.externalScheduleRef,
			lastProviderScheduleStatus: args.providerStatus,
			lastTransitionAt: now,
			nextPollAt: now,
			providerData: {
				...(args.providerData ?? {}),
				replacementDraftId: String(args.draftId),
				replacementBatchId: args.replacementBatchId,
			},
			status: "activating",
		});
		await ctx.db.patch(args.draftId, {
			newExternalCollectionScheduleId: args.newExternalCollectionScheduleId,
			replacementBatchId: args.replacementBatchId,
			updatedAt: now,
			updatedByActorId: args.actorId,
		});

		const prepared = await loadProviderManagedPreparedResult({
			ctx,
			draft: {
				...draft,
				newExternalCollectionScheduleId: args.newExternalCollectionScheduleId,
				replacementBatchId: args.replacementBatchId,
			},
			replacementBatchId: args.replacementBatchId,
		});
		if (!prepared) {
			return rejectedResult({
				draftId: args.draftId,
				issueCode: "stale_draft",
				message:
					"Provider schedule was created but local replacement rows were not found.",
				reasonCode: "local_commit_failed",
			});
		}

		return {
			externalScheduleRef: args.externalScheduleRef,
			interestPlanEntryIds: prepared.interestPlanEntryIds,
			newExternalCollectionScheduleId: args.newExternalCollectionScheduleId,
			outcome: "provider_created",
			providerData: args.providerData,
			providerStatus: args.providerStatus,
			replacementBatchId: args.replacementBatchId,
		};
	})
	.internal();

export const commitProviderManagedReplacementInternal = convex
	.mutation()
	.input({
		activationLeaseId: v.string(),
		actorId: v.string(),
		draftId: v.id("paymentScheduleReplacementDrafts"),
		externalScheduleRef: v.string(),
		interestPlanEntryIds: v.array(v.id("collectionPlanEntries")),
		newExternalCollectionScheduleId: v.id("externalCollectionSchedules"),
		providerData: v.optional(v.record(v.string(), v.any())),
		providerStatus: v.union(v.literal("pending"), v.literal("active")),
		replacementBatchId: v.string(),
	})
	.handler(async (ctx, args): Promise<ActivatedApplyResult> => {
		const draft = await ctx.db.get(args.draftId);
		if (!draft) {
			throw new Error("Payment schedule replacement draft was not found.");
		}
		if (!isLeaseOwner(draft, args.activationLeaseId)) {
			throw new Error(
				"Provider-managed payment schedule replacement activation is already in progress."
			);
		}

		const now = Date.now();
		await ctx.db.patch(args.newExternalCollectionScheduleId, {
			activatedAt: now,
			externalScheduleRef: args.externalScheduleRef,
			lastProviderScheduleStatus: args.providerStatus,
			lastTransitionAt: now,
			nextPollAt: now,
			providerData: {
				...(args.providerData ?? {}),
				replacementDraftId: String(args.draftId),
				replacementBatchId: args.replacementBatchId,
			},
			status: args.providerStatus === "active" ? "active" : "activating",
		});

		await reactivateProviderManagedReplacementRows({
			ctx,
			interestPlanEntryIds: args.interestPlanEntryIds,
			newExternalCollectionScheduleId: args.newExternalCollectionScheduleId,
			now,
			replacementBatchId: args.replacementBatchId,
		});

		await ctx.db.patch(draft.mortgageId, {
			collectionExecutionMode: "provider_managed",
			collectionExecutionProviderCode: "pad_rotessa",
			activeExternalCollectionScheduleId: args.newExternalCollectionScheduleId,
			collectionExecutionUpdatedAt: now,
		});

		await ctx.db.patch(draft._id, {
			status: "activated",
			activationLeaseId: undefined,
			activationLeaseExpiresAt: undefined,
			replacementBatchId: args.replacementBatchId,
			newExternalCollectionScheduleId: args.newExternalCollectionScheduleId,
			activatedAt: now,
			activatedByActorId: args.actorId,
			updatedAt: now,
			updatedByActorId: args.actorId,
		});

		await auditLog.log(ctx, {
			action: "payments.schedule_replacement.provider_managed_activated",
			actorId: args.actorId,
			resourceType: "paymentScheduleReplacementDrafts",
			resourceId: draft._id,
			severity: "info",
			metadata: {
				mortgageId: draft.mortgageId,
				replacementBatchId: args.replacementBatchId,
				newExternalCollectionScheduleId: args.newExternalCollectionScheduleId,
				interestPlanEntryIds: args.interestPlanEntryIds,
			},
		});

		return activatedProviderResult({
			draftId: draft._id,
			newExternalCollectionScheduleId: args.newExternalCollectionScheduleId,
			replacementBatchId: args.replacementBatchId,
		});
	})
	.internal();

export const applyProviderManagedReplacementInternal = convex
	.action()
	.input({
		actorId: v.string(),
		draftId: v.id("paymentScheduleReplacementDrafts"),
	})
	.handler(async (ctx, args): Promise<ApplyScheduleReplacementResult> => {
		const activationLeaseId = crypto.randomUUID();
		const begin = await ctx.runMutation(
			beginProviderManagedReplacementInternalRef,
			{ ...args, activationLeaseId }
		);
		if (
			begin.outcome !== "ready" &&
			begin.outcome !== "prepared" &&
			begin.outcome !== "provider_created"
		) {
			return begin;
		}
		if (begin.outcome === "provider_created") {
			const provider = getRecurringCollectionScheduleProvider("pad_rotessa");
			try {
				return await ctx.runMutation(
					commitProviderManagedReplacementInternalRef,
					{
						activationLeaseId,
						actorId: args.actorId,
						draftId: args.draftId,
						externalScheduleRef: begin.externalScheduleRef,
						interestPlanEntryIds: begin.interestPlanEntryIds,
						newExternalCollectionScheduleId:
							begin.newExternalCollectionScheduleId,
						providerData: begin.providerData,
						providerStatus: begin.providerStatus,
						replacementBatchId: begin.replacementBatchId,
					}
				);
			} catch (error) {
				let compensationFailureMessage: string | undefined;
				try {
					await provider.cancelSchedule(begin.externalScheduleRef);
				} catch (cancelError) {
					compensationFailureMessage = errorMessage(cancelError);
				}

				return ctx.runMutation(failProviderManagedReplacementInternalRef, {
					activationLeaseId,
					actorId: args.actorId,
					compensationFailureMessage,
					draftId: args.draftId,
					errorMessage: errorMessage(error),
					externalScheduleRef: begin.externalScheduleRef,
					newExternalCollectionScheduleId:
						begin.newExternalCollectionScheduleId,
					providerData: begin.providerData,
					providerStatus: begin.providerStatus,
					reasonCode: "local_commit_failed",
					replacementBatchId: begin.replacementBatchId,
				});
			}
		}

		const provider = getRecurringCollectionScheduleProvider("pad_rotessa");
		if (begin.outcome === "ready" && begin.oldExternalScheduleRef) {
			try {
				await provider.cancelSchedule(begin.oldExternalScheduleRef);
				if (begin.oldScheduleId) {
					const recordedCancel = await ctx.runMutation(
						recordOldProviderCancelSucceededInternalRef,
						{
							activationLeaseId,
							actorId: args.actorId,
							draftId: args.draftId,
							oldScheduleId: begin.oldScheduleId,
							replacementBatchId: begin.replacementBatchId,
						}
					);
					if (recordedCancel.outcome === "rejected") {
						return recordedCancel;
					}
				}
			} catch (error) {
				return ctx.runMutation(recordOldProviderCancelFailedInternalRef, {
					activationLeaseId,
					actorId: args.actorId,
					draftId: args.draftId,
					errorMessage: errorMessage(error),
				});
			}
		}

		let prepared: ProviderReplacementPreparedResult;
		if (begin.outcome === "prepared") {
			prepared = begin.prepared;
		} else {
			try {
				prepared = await ctx.runMutation(
					prepareProviderManagedReplacementInternalRef,
					{
						activationLeaseId,
						actorId: args.actorId,
						draftId: args.draftId,
						oldScheduleId: begin.oldScheduleId,
						replacementBatchId: begin.replacementBatchId,
					}
				);
			} catch (error) {
				return ctx.runMutation(failProviderManagedReplacementInternalRef, {
					activationLeaseId,
					actorId: args.actorId,
					draftId: args.draftId,
					errorMessage: errorMessage(error),
					reasonCode: "local_prepare_failed",
					replacementBatchId: begin.replacementBatchId,
				});
			}
		}

		let providerExternalScheduleRef: string | undefined;
		try {
			const providerSchedule = await provider.createSchedule({
				...resolveRotessaCustomerReference(begin.bankAccount.metadata),
				amount: begin.draft.interestPaymentAmount,
				bankAccountId: begin.bankAccount._id,
				comment: `payment_schedule_replacement:${begin.draft._id};batch:${begin.replacementBatchId};schedule:${prepared.newExternalCollectionScheduleId}`,
				frequency: rotessaFrequency(begin.draft.paymentFrequency),
				installments: begin.draft.interestInstallmentCount,
				processDate: toIsoBusinessDate(begin.draft.startDate),
				providerCode: "pad_rotessa",
			});
			providerExternalScheduleRef = providerSchedule.externalScheduleRef;
			const recordedProviderSchedule = await ctx.runMutation(
				recordProviderScheduleCreatedInternalRef,
				{
					activationLeaseId,
					actorId: args.actorId,
					draftId: args.draftId,
					externalScheduleRef: providerSchedule.externalScheduleRef,
					newExternalCollectionScheduleId:
						prepared.newExternalCollectionScheduleId,
					providerData: providerSchedule.providerData,
					providerStatus: providerSchedule.status,
					replacementBatchId: begin.replacementBatchId,
				}
			);
			if (recordedProviderSchedule.outcome !== "provider_created") {
				if (
					recordedProviderSchedule.outcome === "activated" ||
					recordedProviderSchedule.outcome === "rejected"
				) {
					return recordedProviderSchedule;
				}
				throw new Error(
					"Provider schedule creation checkpoint returned an unexpected resumable state."
				);
			}

			return await ctx.runMutation(
				commitProviderManagedReplacementInternalRef,
				{
					activationLeaseId,
					actorId: args.actorId,
					draftId: args.draftId,
					externalScheduleRef: recordedProviderSchedule.externalScheduleRef,
					interestPlanEntryIds: recordedProviderSchedule.interestPlanEntryIds,
					newExternalCollectionScheduleId:
						recordedProviderSchedule.newExternalCollectionScheduleId,
					providerData: recordedProviderSchedule.providerData,
					providerStatus: recordedProviderSchedule.providerStatus,
					replacementBatchId: begin.replacementBatchId,
				}
			);
		} catch (error) {
			let compensationFailureMessage: string | undefined;
			if (providerExternalScheduleRef) {
				try {
					await provider.cancelSchedule(providerExternalScheduleRef);
				} catch (cancelError) {
					compensationFailureMessage = errorMessage(cancelError);
				}
			}

			return ctx.runMutation(failProviderManagedReplacementInternalRef, {
				activationLeaseId,
				actorId: args.actorId,
				compensationFailureMessage,
				draftId: args.draftId,
				errorMessage: errorMessage(error),
				...(providerExternalScheduleRef
					? {
							externalScheduleRef: providerExternalScheduleRef,
							providerStatus: "pending" as const,
						}
					: {}),
				newExternalCollectionScheduleId:
					prepared.newExternalCollectionScheduleId,
				reasonCode: providerExternalScheduleRef
					? "local_commit_failed"
					: "new_provider_create_failed",
				replacementBatchId: begin.replacementBatchId,
			});
		}
	})
	.internal();

export const applyScheduleReplacementDraft = adminAction
	.input({ draftId: v.id("paymentScheduleReplacementDrafts") })
	.handler(async (ctx, args): Promise<ApplyScheduleReplacementResult> => {
		const draft = await ctx.runQuery(loadDraftForApplyInternalRef, {
			draftId: args.draftId,
		});
		if (!draft) {
			return {
				draftId: args.draftId,
				issues: [
					issue(
						"mortgage_not_found",
						"Payment schedule replacement draft was not found."
					),
				],
				outcome: "rejected",
				reasonCode: "draft_not_found",
				reasonDetail: "Payment schedule replacement draft was not found.",
			};
		}
		if (draft.status === "activated" && draft.replacementBatchId) {
			return activatedResult(draft);
		}
		if (draft.replacementRail === "provider_managed_rotessa") {
			return ctx.runAction(applyProviderManagedReplacementInternalRef, {
				actorId: ctx.viewer.authId,
				draftId: args.draftId,
			});
		}
		const oldSchedule = await ctx.runQuery(
			loadActiveRotessaScheduleForManualReplacementInternalRef,
			{
				draftId: args.draftId,
			}
		);
		if (oldSchedule) {
			try {
				const provider = getRecurringCollectionScheduleProvider("pad_rotessa");
				await provider.cancelSchedule(oldSchedule.externalScheduleRef);
			} catch (error) {
				const message = errorMessage(error);
				return {
					draftId: args.draftId,
					issues: [issue("stale_draft", message)],
					outcome: "rejected",
					reasonCode: "old_provider_cancel_failed",
					reasonDetail: message,
				};
			}
		}

		return ctx.runMutation(applyAppManagedReplacementInternalRef, {
			actorId: ctx.viewer.authId,
			draftId: args.draftId,
			oldScheduleId: oldSchedule?.oldScheduleId,
		});
	})
	.public();
