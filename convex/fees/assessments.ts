import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import {
	feeAssessmentSourceValidator,
	feeAssessmentStatusValidator,
} from "./validators";

export const createFeeAssessment = internalMutation({
	args: {
		mortgageId: v.id("mortgages"),
		mortgageFeeId: v.id("mortgageFees"),
		amountCents: v.number(),
		source: feeAssessmentSourceValidator,
		effectiveDate: v.string(),
		sourceObligationId: v.optional(v.id("obligations")),
		metadata: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		assertValidMoneyCents(args.amountCents, "amountCents", {
			allowZero: false,
		});

		const mortgageFee = await ctx.db.get(args.mortgageFeeId);
		if (!mortgageFee) {
			throw new ConvexError(`Mortgage fee not found: ${args.mortgageFeeId}`);
		}
		if (mortgageFee.mortgageId !== args.mortgageId) {
			throw new ConvexError(
				`Mortgage fee ${args.mortgageFeeId} does not belong to mortgage ${args.mortgageId}`
			);
		}

		const mortgage = await ctx.db.get(args.mortgageId);
		if (!mortgage) {
			throw new ConvexError(`Mortgage not found: ${args.mortgageId}`);
		}
		if (args.sourceObligationId !== undefined) {
			await validateObligationBelongsToMortgage(
				ctx,
				args.sourceObligationId,
				args.mortgageId
			);
		}

		const now = Date.now();
		return await ctx.db.insert("feeAssessments", {
			orgId: mortgage.orgId,
			mortgageId: args.mortgageId,
			mortgageFeeId: args.mortgageFeeId,
			feeTemplateId: mortgageFee.feeTemplateId,
			feeSetTemplateId: mortgageFee.feeSetTemplateId,
			behavior: mortgageFee.behavior,
			code: mortgageFee.code,
			displayCode: mortgageFee.displayCode,
			amountCents: args.amountCents,
			amountSettledCents: 0,
			source: args.source,
			status: "assessed",
			assessedAt: now,
			effectiveDate: args.effectiveDate,
			sourceObligationId: args.sourceObligationId,
			metadata: args.metadata,
			createdAt: now,
			updatedAt: now,
		});
	},
});

type FeeAssessmentStatus =
	| "assessed"
	| "invoiced"
	| "partially_settled"
	| "settled"
	| "reversed";

function assertValidMoneyCents(
	value: number,
	fieldName: string,
	options: { allowZero: boolean }
) {
	const min = options.allowZero ? 0 : 1;
	if (!Number.isSafeInteger(value) || value < min) {
		throw new ConvexError(
			`${fieldName} must be a ${options.allowZero ? "non-negative" : "positive"} safe integer number of cents`
		);
	}
}

function centsFromInt64(value: bigint, fieldName: string) {
	if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
		throw new ConvexError(`${fieldName} exceeds the safe integer range`);
	}
	return Number(value);
}

const linkFeeAssessmentArgs = {
	feeAssessmentId: v.id("feeAssessments"),
	status: feeAssessmentStatusValidator,
	amountSettledCents: v.optional(v.number()),
	obligationId: v.optional(v.id("obligations")),
	dispersalEntryId: v.optional(v.id("dispersalEntries")),
	servicingFeeEntryId: v.optional(v.id("servicingFeeEntries")),
	cashLedgerJournalEntryId: v.optional(v.id("cash_ledger_journal_entries")),
};

async function linkFeeAssessmentHandler(
	ctx: MutationCtx,
	args: {
		feeAssessmentId: Id<"feeAssessments">;
		status: FeeAssessmentStatus;
		amountSettledCents?: number;
		obligationId?: Id<"obligations">;
		dispersalEntryId?: Id<"dispersalEntries">;
		servicingFeeEntryId?: Id<"servicingFeeEntries">;
		cashLedgerJournalEntryId?: Id<"cash_ledger_journal_entries">;
	}
) {
	const assessment = await ctx.db.get(args.feeAssessmentId);
	if (!assessment) {
		throw new ConvexError(`Fee assessment not found: ${args.feeAssessmentId}`);
	}
	assertImmutableTraceLinks(assessment, args);

	const amountSettledCents =
		args.amountSettledCents ?? assessment.amountSettledCents;
	assertValidMoneyCents(amountSettledCents, "amountSettledCents", {
		allowZero: true,
	});
	if (amountSettledCents > assessment.amountCents) {
		throw new ConvexError("amountSettledCents cannot exceed amountCents");
	}

	assertAllowedStatusTransition(assessment.status, args.status);
	assertStatusMatchesSettledAmount({
		status: args.status,
		amountCents: assessment.amountCents,
		amountSettledCents,
		hasCashLedgerJournalEntry:
			args.cashLedgerJournalEntryId !== undefined ||
			assessment.cashLedgerJournalEntryId !== undefined,
		hasObligationId:
			args.obligationId !== undefined || assessment.obligationId !== undefined,
	});

	await validateLinkedDocuments(ctx, {
		assessment,
		amountSettledCents,
		cashLedgerJournalEntryId:
			args.cashLedgerJournalEntryId ?? assessment.cashLedgerJournalEntryId,
		dispersalEntryId: args.dispersalEntryId ?? assessment.dispersalEntryId,
		obligationId: args.obligationId ?? assessment.obligationId,
		servicingFeeEntryId:
			args.servicingFeeEntryId ?? assessment.servicingFeeEntryId,
	});

	const patch: {
		amountSettledCents?: number;
		cashLedgerJournalEntryId?: Id<"cash_ledger_journal_entries">;
		dispersalEntryId?: Id<"dispersalEntries">;
		obligationId?: Id<"obligations">;
		servicingFeeEntryId?: Id<"servicingFeeEntries">;
		status: typeof args.status;
		updatedAt: number;
	} = {
		status: args.status,
		updatedAt: Date.now(),
	};

	if (args.amountSettledCents !== undefined) {
		patch.amountSettledCents = args.amountSettledCents;
	}
	if (args.cashLedgerJournalEntryId !== undefined) {
		patch.cashLedgerJournalEntryId = args.cashLedgerJournalEntryId;
	}
	if (args.dispersalEntryId !== undefined) {
		patch.dispersalEntryId = args.dispersalEntryId;
	}
	if (args.obligationId !== undefined) {
		patch.obligationId = args.obligationId;
	}
	if (args.servicingFeeEntryId !== undefined) {
		patch.servicingFeeEntryId = args.servicingFeeEntryId;
	}

	await ctx.db.patch(args.feeAssessmentId, patch);
	return args.feeAssessmentId;
}

function assertImmutableTraceLinks(
	assessment: Doc<"feeAssessments">,
	args: {
		obligationId?: Id<"obligations">;
		dispersalEntryId?: Id<"dispersalEntries">;
		servicingFeeEntryId?: Id<"servicingFeeEntries">;
		cashLedgerJournalEntryId?: Id<"cash_ledger_journal_entries">;
	}
) {
	assertImmutableTraceLink(
		assessment.obligationId,
		args.obligationId,
		"obligationId"
	);
	assertImmutableTraceLink(
		assessment.dispersalEntryId,
		args.dispersalEntryId,
		"dispersalEntryId"
	);
	assertImmutableTraceLink(
		assessment.servicingFeeEntryId,
		args.servicingFeeEntryId,
		"servicingFeeEntryId"
	);
	assertImmutableTraceLink(
		assessment.cashLedgerJournalEntryId,
		args.cashLedgerJournalEntryId,
		"cashLedgerJournalEntryId"
	);
}

function assertImmutableTraceLink(
	existingId: string | undefined,
	nextId: string | undefined,
	fieldName: string
) {
	if (
		existingId !== undefined &&
		nextId !== undefined &&
		existingId !== nextId
	) {
		throw new ConvexError(
			`Fee assessment ${fieldName} is immutable once linked`
		);
	}
}

function assertAllowedStatusTransition(
	currentStatus: FeeAssessmentStatus,
	nextStatus: FeeAssessmentStatus
) {
	if (nextStatus === "reversed") {
		throw new ConvexError(
			"Fee assessment reversal must use a dedicated reversal workflow"
		);
	}

	const statusRank: Record<Exclude<FeeAssessmentStatus, "reversed">, number> = {
		assessed: 0,
		invoiced: 1,
		partially_settled: 2,
		settled: 3,
	};
	if (currentStatus === "reversed") {
		throw new ConvexError("Reversed fee assessments cannot be relinked");
	}
	if (statusRank[nextStatus] < statusRank[currentStatus]) {
		throw new ConvexError(
			`Invalid fee assessment status transition: ${currentStatus} -> ${nextStatus}`
		);
	}
}

function assertStatusMatchesSettledAmount(args: {
	status: FeeAssessmentStatus;
	amountCents: number;
	amountSettledCents: number;
	hasCashLedgerJournalEntry: boolean;
	hasObligationId: boolean;
}) {
	if (args.status === "assessed" && args.amountSettledCents !== 0) {
		throw new ConvexError("Assessed fee assessments cannot have settled cash");
	}
	if (args.status === "invoiced") {
		if (args.amountSettledCents !== 0) {
			throw new ConvexError(
				"Invoiced fee assessments cannot have settled cash"
			);
		}
		if (!args.hasObligationId) {
			throw new ConvexError(
				"Invoiced fee assessments must link to an obligation"
			);
		}
	}
	if (args.status === "partially_settled") {
		if (
			args.amountSettledCents <= 0 ||
			args.amountSettledCents >= args.amountCents
		) {
			throw new ConvexError(
				"Partially settled fee assessments require a partial settled amount"
			);
		}
		if (!args.hasCashLedgerJournalEntry) {
			throw new ConvexError(
				"Partially settled fee assessments must link to a cash ledger journal entry"
			);
		}
	}
	if (args.status === "settled") {
		if (args.amountSettledCents !== args.amountCents) {
			throw new ConvexError(
				"Settled fee assessments must be settled for the full amount"
			);
		}
		if (!args.hasCashLedgerJournalEntry) {
			throw new ConvexError(
				"Settled fee assessments must link to a cash ledger journal entry"
			);
		}
	}
}

async function validateLinkedDocuments(
	ctx: MutationCtx,
	args: {
		assessment: Doc<"feeAssessments">;
		amountSettledCents: number;
		obligationId?: Id<"obligations">;
		dispersalEntryId?: Id<"dispersalEntries">;
		servicingFeeEntryId?: Id<"servicingFeeEntries">;
		cashLedgerJournalEntryId?: Id<"cash_ledger_journal_entries">;
	}
) {
	if (args.obligationId !== undefined) {
		await validateObligationLink(ctx, args.assessment, args.obligationId);
	}
	const effectiveObligationId =
		args.obligationId ?? args.assessment.obligationId;

	if (args.dispersalEntryId !== undefined) {
		await validateDispersalEntryLink(
			ctx,
			args.assessment,
			args.dispersalEntryId,
			effectiveObligationId
		);
	}

	if (args.servicingFeeEntryId !== undefined) {
		await validateServicingFeeEntryLink(
			ctx,
			args.assessment,
			args.servicingFeeEntryId,
			effectiveObligationId
		);
	}

	if (args.cashLedgerJournalEntryId !== undefined) {
		await validateCashLedgerJournalEntryLink(ctx, {
			amountSettledCents: args.amountSettledCents,
			assessment: args.assessment,
			cashLedgerJournalEntryId: args.cashLedgerJournalEntryId,
			obligationId: effectiveObligationId,
		});
	}
}

async function validateObligationBelongsToMortgage(
	ctx: MutationCtx,
	obligationId: Id<"obligations">,
	mortgageId: Id<"mortgages">
) {
	const obligation = await ctx.db.get(obligationId);
	if (!obligation) {
		throw new ConvexError(`Obligation not found: ${obligationId}`);
	}
	if (obligation.mortgageId !== mortgageId) {
		throw new ConvexError(
			`Obligation ${obligationId} does not belong to mortgage ${mortgageId}`
		);
	}
}

async function validateObligationLink(
	ctx: MutationCtx,
	assessment: Doc<"feeAssessments">,
	obligationId: Id<"obligations">
) {
	await validateObligationBelongsToMortgage(
		ctx,
		obligationId,
		assessment.mortgageId
	);
}

async function validateDispersalEntryLink(
	ctx: MutationCtx,
	assessment: Doc<"feeAssessments">,
	dispersalEntryId: Id<"dispersalEntries">,
	obligationId?: Id<"obligations">
) {
	const dispersalEntry = await ctx.db.get(dispersalEntryId);
	if (!dispersalEntry) {
		throw new ConvexError(`Dispersal entry not found: ${dispersalEntryId}`);
	}
	if (dispersalEntry.mortgageId !== assessment.mortgageId) {
		throw new ConvexError(
			`Dispersal entry ${dispersalEntryId} does not belong to mortgage ${assessment.mortgageId}`
		);
	}
	if (
		obligationId !== undefined &&
		dispersalEntry.obligationId !== obligationId
	) {
		throw new ConvexError(
			`Dispersal entry ${dispersalEntryId} does not match the linked obligation`
		);
	}
	if (
		dispersalEntry.mortgageFeeId !== undefined &&
		dispersalEntry.mortgageFeeId !== assessment.mortgageFeeId
	) {
		throw new ConvexError(
			`Dispersal entry ${dispersalEntryId} does not match the fee assessment mortgage fee`
		);
	}
}

async function validateServicingFeeEntryLink(
	ctx: MutationCtx,
	assessment: Doc<"feeAssessments">,
	servicingFeeEntryId: Id<"servicingFeeEntries">,
	obligationId?: Id<"obligations">
) {
	const servicingFeeEntry = await ctx.db.get(servicingFeeEntryId);
	if (!servicingFeeEntry) {
		throw new ConvexError(
			`Servicing fee entry not found: ${servicingFeeEntryId}`
		);
	}
	if (servicingFeeEntry.mortgageId !== assessment.mortgageId) {
		throw new ConvexError(
			`Servicing fee entry ${servicingFeeEntryId} does not belong to mortgage ${assessment.mortgageId}`
		);
	}
	if (
		obligationId !== undefined &&
		servicingFeeEntry.obligationId !== obligationId
	) {
		throw new ConvexError(
			`Servicing fee entry ${servicingFeeEntryId} does not match the linked obligation`
		);
	}
	if (
		servicingFeeEntry.mortgageFeeId !== undefined &&
		servicingFeeEntry.mortgageFeeId !== assessment.mortgageFeeId
	) {
		throw new ConvexError(
			`Servicing fee entry ${servicingFeeEntryId} does not match the fee assessment mortgage fee`
		);
	}
}

async function validateCashLedgerJournalEntryLink(
	ctx: MutationCtx,
	args: {
		assessment: Doc<"feeAssessments">;
		amountSettledCents: number;
		cashLedgerJournalEntryId: Id<"cash_ledger_journal_entries">;
		obligationId?: Id<"obligations">;
	}
) {
	const journalEntry = await ctx.db.get(args.cashLedgerJournalEntryId);
	if (!journalEntry) {
		throw new ConvexError(
			`Cash ledger journal entry not found: ${args.cashLedgerJournalEntryId}`
		);
	}
	if (journalEntry.mortgageId !== args.assessment.mortgageId) {
		throw new ConvexError(
			`Cash ledger journal entry ${args.cashLedgerJournalEntryId} does not belong to mortgage ${args.assessment.mortgageId}`
		);
	}
	if (
		args.assessment.behavior === "payment_waterfall_deduction" &&
		journalEntry.entryType !== "SERVICING_FEE_RECOGNIZED"
	) {
		throw new ConvexError(
			`Cash ledger journal entry ${args.cashLedgerJournalEntryId} is not a servicing fee recognition entry`
		);
	}
	const journalAmountCents = centsFromInt64(
		journalEntry.amount,
		"cash ledger journal entry amount"
	);
	if (journalAmountCents !== args.amountSettledCents) {
		throw new ConvexError(
			"Cash ledger journal entry amount must match amountSettledCents"
		);
	}
	if (
		args.obligationId !== undefined &&
		journalEntry.obligationId !== args.obligationId
	) {
		throw new ConvexError(
			`Cash ledger journal entry ${args.cashLedgerJournalEntryId} does not match the linked obligation`
		);
	}
}

export const linkFeeAssessment = internalMutation({
	args: linkFeeAssessmentArgs,
	handler: linkFeeAssessmentHandler,
});

export const linkFeeAssessmentLedgerEntry = internalMutation({
	args: linkFeeAssessmentArgs,
	handler: linkFeeAssessmentHandler,
});
