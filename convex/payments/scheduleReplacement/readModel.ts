import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { hasRotessaCustomerReference } from "../recurringSchedules/rotessaCustomerReference";
import {
	addCalendarMonths,
	buildReplacementPreview,
	calculateSliderBounds,
	toIsoBusinessDate,
	toUtcBusinessDate,
} from "./scheduleMath";
import type {
	PaymentScheduleReplacementRail,
	PaymentScheduleReplacementValidationIssue,
	ScheduleReplacementPreviewRow,
} from "./types";

type ReadModelCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;
type PreviewableObligation = Doc<"obligations"> & {
	type: "principal_repayment" | "regular_interest";
};
const TERMINAL_NON_REPLACEABLE_OBLIGATION_STATUSES = new Set([
	"cancelled",
	"settled",
	"waived",
]);

interface MortgageFacts {
	archiveCandidateRows: ScheduleReplacementPreviewRow[];
	borrowerId: Id<"borrowers">;
	borrowerLabel: string;
	currentRailLabel: string;
	deadlineDate: number;
	deadlineIsoDate: string;
	eligibleBankAccounts: EligibleBankAccountRow[];
	firstPaymentNumber: number;
	maturityDate: string;
	minStartDate: number;
	mortgage: Doc<"mortgages">;
	mortgageId: Id<"mortgages">;
	outstandingInterestAmount: number;
	previewContextRows: ScheduleReplacementPreviewRow[];
	principalPayoffAmount: number;
	suggestedDraft: SuggestedScheduleReplacementDraft;
	unsafePlanEntryRows: ScheduleReplacementPreviewRow[];
}

export interface EligibleBankAccountRow {
	accountLast4?: string;
	bankAccountId: Id<"bankAccounts">;
	label: string;
	mandateStatus: Doc<"bankAccounts">["mandateStatus"];
	status: Doc<"bankAccounts">["status"];
}

export interface SuggestedScheduleReplacementDraft {
	bankAccountId?: Id<"bankAccounts">;
	interestPaymentAmount: number;
	padAuthorizationAssetId?: Id<"documentAssets">;
	paymentFrequency: Doc<"paymentScheduleReplacementDrafts">["paymentFrequency"];
	previewRows: ScheduleReplacementPreviewRow[];
	replacementRail: PaymentScheduleReplacementRail;
	sliderBounds: Doc<"paymentScheduleReplacementDrafts">["sliderBounds"];
	startDate: number;
	status: Doc<"paymentScheduleReplacementDrafts">["status"];
	validationIssues: PaymentScheduleReplacementValidationIssue[];
}

export function outstandingBalance(
	obligation: Pick<Doc<"obligations">, "amount" | "amountSettled">
) {
	return Math.max(0, obligation.amount - obligation.amountSettled);
}

export function isSettledHistoricalObligation(
	obligation: Doc<"obligations">
): obligation is PreviewableObligation {
	return (
		(obligation.type === "regular_interest" ||
			obligation.type === "principal_repayment") &&
		(obligation.amountSettled >= obligation.amount ||
			obligation.status === "settled")
	);
}

export function isUnpaidReplacementCandidate(
	obligation: Doc<"obligations">
): obligation is PreviewableObligation {
	return (
		(obligation.type === "regular_interest" ||
			obligation.type === "principal_repayment") &&
		outstandingBalance(obligation) > 0 &&
		!TERMINAL_NON_REPLACEABLE_OBLIGATION_STATUSES.has(obligation.status) &&
		obligation.archivedAt === undefined
	);
}

export function isUnsafePlanEntryExecutionState(
	planEntry: Doc<"collectionPlanEntries">
) {
	return (
		planEntry.status === "executing" ||
		planEntry.status === "completed" ||
		planEntry.executedAt !== undefined ||
		planEntry.executionIdempotencyKey !== undefined ||
		planEntry.collectionAttemptId !== undefined
	);
}

export function buildHistoricalPreviewRow(
	obligation: PreviewableObligation,
	planEntry?: Doc<"collectionPlanEntries">
): ScheduleReplacementPreviewRow {
	return {
		amount: obligation.amountSettled,
		collectionPlanEntryId: planEntry?._id,
		dueDate: obligation.dueDate,
		editableDate: false,
		executionMode: planEntry?.executionMode ?? "app_owned",
		externalCollectionScheduleId: planEntry?.externalCollectionScheduleId,
		kind: "historical_settled",
		obligationId: obligation._id,
		obligationType: obligation.type,
		paymentNumber: obligation.paymentNumber,
		rowKey: `historical-${obligation._id}`,
		scheduledDate: planEntry?.scheduledDate ?? obligation.dueDate,
		status: "context",
	};
}

export function buildArchiveCandidatePreviewRow(
	obligation: PreviewableObligation,
	planEntry?: Doc<"collectionPlanEntries">
): ScheduleReplacementPreviewRow {
	return {
		amount: outstandingBalance(obligation),
		collectionPlanEntryId: planEntry?._id,
		dueDate: obligation.dueDate,
		editableDate: false,
		executionMode: planEntry?.executionMode ?? "app_owned",
		externalCollectionScheduleId: planEntry?.externalCollectionScheduleId,
		kind: "archived_candidate",
		obligationId: obligation._id,
		obligationType: obligation.type,
		paymentNumber: obligation.paymentNumber,
		rowKey: `archive-candidate-${obligation._id}`,
		scheduledDate: planEntry?.scheduledDate ?? obligation.dueDate,
		status: "will_archive",
	};
}

function compareScheduleRows(
	left: Pick<ScheduleReplacementPreviewRow, "dueDate" | "paymentNumber">,
	right: Pick<ScheduleReplacementPreviewRow, "dueDate" | "paymentNumber">
) {
	return (
		left.dueDate - right.dueDate || left.paymentNumber - right.paymentNumber
	);
}

function currentRailLabel(mortgage: Doc<"mortgages">) {
	if (
		mortgage.collectionExecutionMode === "provider_managed" ||
		mortgage.collectionExecutionProviderCode === "pad_rotessa"
	) {
		return "Provider-managed Rotessa";
	}

	return "App-managed manual";
}

async function findBorrowerId(ctx: ReadModelCtx, mortgageId: Id<"mortgages">) {
	const mortgageBorrowers = await ctx.db
		.query("mortgageBorrowers")
		.withIndex("by_mortgage", (q) => q.eq("mortgageId", mortgageId))
		.collect();
	const primaryBorrower = mortgageBorrowers.find(
		(borrower) => borrower.role === "primary"
	);
	if (primaryBorrower) {
		return primaryBorrower.borrowerId;
	}
	if (mortgageBorrowers[0]) {
		return mortgageBorrowers[0].borrowerId;
	}

	const firstObligation = await ctx.db
		.query("obligations")
		.withIndex("by_mortgage_and_date", (q) => q.eq("mortgageId", mortgageId))
		.first();

	return firstObligation?.borrowerId ?? null;
}

async function borrowerLabel(ctx: ReadModelCtx, borrowerId: Id<"borrowers">) {
	const borrower = await ctx.db.get(borrowerId);
	if (!borrower) {
		return String(borrowerId);
	}

	const user = await ctx.db.get(borrower.userId);
	if (!user) {
		return String(borrowerId);
	}

	const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
	return fullName || user.email || String(borrowerId);
}

async function eligibleBankAccounts(
	ctx: ReadModelCtx,
	borrowerId: Id<"borrowers">
): Promise<EligibleBankAccountRow[]> {
	const accounts = await ctx.db
		.query("bankAccounts")
		.withIndex("by_owner", (q) =>
			q.eq("ownerType", "borrower").eq("ownerId", String(borrowerId))
		)
		.collect();

	return accounts
		.filter(
			(account) =>
				account.status === "validated" &&
				account.mandateStatus === "active" &&
				hasRotessaCustomerReference(account.metadata)
		)
		.map((account) => ({
			accountLast4: account.accountLast4,
			bankAccountId: account._id,
			label: account.accountLast4
				? `Bank account ending ${account.accountLast4}`
				: "Validated borrower bank account",
			mandateStatus: account.mandateStatus,
			status: account.status,
		}));
}

async function planEntriesByObligationId(
	ctx: ReadModelCtx,
	mortgageId: Id<"mortgages">
) {
	const planEntries = await ctx.db
		.query("collectionPlanEntries")
		.withIndex("by_mortgage_status_scheduled", (q) =>
			q.eq("mortgageId", mortgageId)
		)
		.collect();
	const entriesByObligationId = new Map<
		Id<"obligations">,
		Doc<"collectionPlanEntries">[]
	>();

	for (const planEntry of planEntries) {
		for (const obligationId of planEntry.obligationIds) {
			const entries = entriesByObligationId.get(obligationId) ?? [];
			entries.push(planEntry);
			entriesByObligationId.set(obligationId, entries);
		}
	}

	return entriesByObligationId;
}

function buildSuggestedDraft(args: {
	deadlineDate: number;
	firstPaymentNumber: number;
	minStartDate: number;
	outstandingInterestAmount: number;
	principalPayoffAmount: number;
	unsafePlanEntryRows: ScheduleReplacementPreviewRow[];
}) {
	const replacementRail = "app_managed_manual";
	const paymentFrequency = "monthly";
	const sliderBounds = calculateSliderBounds({
		startDate: args.minStartDate,
		deadlineDate: args.deadlineDate,
		paymentFrequency,
		outstandingInterestAmount: args.outstandingInterestAmount,
	});
	const interestPaymentAmount =
		args.outstandingInterestAmount > 0
			? sliderBounds.maxInterestPaymentAmount
			: 0;
	const preview = buildReplacementPreview({
		startDate: args.minStartDate,
		deadlineDate: args.deadlineDate,
		paymentFrequency,
		outstandingInterestAmount: args.outstandingInterestAmount,
		principalPayoffAmount: args.principalPayoffAmount,
		interestPaymentAmount,
		replacementRail,
		firstPaymentNumber: args.firstPaymentNumber,
	});
	const unsafeIssues: PaymentScheduleReplacementValidationIssue[] =
		args.unsafePlanEntryRows.map((row) => ({
			code: "unsafe_existing_execution_state",
			message:
				"An existing collection plan entry is already executing and must be resolved before replacing this schedule.",
			rowKey: row.rowKey,
		}));
	const validationIssues = [...preview.issues, ...unsafeIssues];

	return {
		replacementRail,
		startDate: args.minStartDate,
		paymentFrequency,
		interestPaymentAmount,
		sliderBounds: preview.sliderBounds,
		validationIssues,
		previewRows: preview.rows,
		status: validationIssues.length === 0 ? "ready" : "draft",
	} satisfies SuggestedScheduleReplacementDraft;
}

export async function loadMortgageScheduleReplacementFacts(
	ctx: ReadModelCtx,
	mortgageId: Id<"mortgages">
): Promise<MortgageFacts | null> {
	const mortgage = await ctx.db.get(mortgageId);
	if (!mortgage) {
		return null;
	}

	const borrowerId = await findBorrowerId(ctx, mortgageId);
	if (!borrowerId) {
		return null;
	}

	const obligations = await ctx.db
		.query("obligations")
		.withIndex("by_mortgage_and_date", (q) => q.eq("mortgageId", mortgageId))
		.collect();
	const planEntries = await planEntriesByObligationId(ctx, mortgageId);
	const historicalRows = obligations
		.filter(isSettledHistoricalObligation)
		.map((obligation) =>
			buildHistoricalPreviewRow(
				obligation,
				planEntries.get(obligation._id)?.[0]
			)
		)
		.sort(compareScheduleRows);
	const archiveCandidateRows = obligations
		.filter(isUnpaidReplacementCandidate)
		.map((obligation) =>
			buildArchiveCandidatePreviewRow(
				obligation,
				planEntries.get(obligation._id)?.[0]
			)
		)
		.sort(compareScheduleRows);
	const unsafePlanEntryRows = archiveCandidateRows.flatMap((row) => {
		if (!row.obligationId) {
			return [];
		}
		return (planEntries.get(row.obligationId) ?? [])
			.filter(isUnsafePlanEntryExecutionState)
			.map((planEntry) => ({
				...row,
				collectionPlanEntryId: planEntry._id,
			}));
	});
	const outstandingInterestAmount = obligations
		.filter(
			(obligation) =>
				obligation.type === "regular_interest" &&
				isUnpaidReplacementCandidate(obligation)
		)
		.reduce((total, obligation) => total + outstandingBalance(obligation), 0);
	const settledPrincipalAmount = obligations
		.filter(
			(obligation) =>
				obligation.type === "principal_repayment" &&
				isSettledHistoricalObligation(obligation)
		)
		.reduce((total, obligation) => total + obligation.amountSettled, 0);
	const principalPayoffAmount = Math.max(
		0,
		mortgage.principal - settledPrincipalAmount
	);
	const deadlineIsoDate = addCalendarMonths(mortgage.maturityDate, 2);
	const deadlineDate = toUtcBusinessDate(deadlineIsoDate);
	const todayDate = toUtcBusinessDate(toIsoBusinessDate(Date.now()));
	const firstPaymentNumber =
		Math.max(0, ...obligations.map((obligation) => obligation.paymentNumber)) +
		1;

	return {
		mortgage,
		mortgageId,
		borrowerId,
		borrowerLabel: await borrowerLabel(ctx, borrowerId),
		currentRailLabel: currentRailLabel(mortgage),
		maturityDate: mortgage.maturityDate,
		deadlineDate,
		deadlineIsoDate,
		minStartDate: todayDate,
		outstandingInterestAmount,
		principalPayoffAmount,
		previewContextRows: historicalRows,
		archiveCandidateRows,
		unsafePlanEntryRows,
		eligibleBankAccounts: await eligibleBankAccounts(ctx, borrowerId),
		firstPaymentNumber,
		suggestedDraft: buildSuggestedDraft({
			deadlineDate,
			firstPaymentNumber,
			minStartDate: todayDate,
			outstandingInterestAmount,
			principalPayoffAmount,
			unsafePlanEntryRows,
		}),
	};
}
