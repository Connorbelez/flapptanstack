import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { adminMutation, adminQuery } from "../../fluent";
import type { EligibleBankAccountRow } from "./readModel";
import { loadMortgageScheduleReplacementFacts } from "./readModel";
import { buildReplacementPreview } from "./scheduleMath";
import type {
	PaymentScheduleReplacementStatus,
	PaymentScheduleReplacementValidationIssue,
	ScheduleReplacementDraftResult,
	ScheduleReplacementPreviewRow,
} from "./types";
import {
	paymentScheduleReplacementFrequencyValidator,
	paymentScheduleReplacementRailValidator,
} from "./validators";

type DraftDoc = Doc<"paymentScheduleReplacementDrafts">;

function issue(
	code: PaymentScheduleReplacementValidationIssue["code"],
	message: string,
	rowKey?: string
): PaymentScheduleReplacementValidationIssue {
	return rowKey ? { code, message, rowKey } : { code, message };
}

async function providerRequiredIssues(
	ctx: Pick<MutationCtx, "db">,
	args: {
		bankAccountId?: Id<"bankAccounts">;
		eligibleBankAccounts: EligibleBankAccountRow[];
		padAuthorizationAssetId?: Id<"documentAssets">;
		replacementRail: DraftDoc["replacementRail"];
	}
) {
	const issues: PaymentScheduleReplacementValidationIssue[] = [];
	if (args.replacementRail !== "provider_managed_rotessa") {
		return issues;
	}

	if (!args.bankAccountId) {
		issues.push(
			issue(
				"provider_bank_account_required",
				"Provider-managed Rotessa schedules require a borrower bank account."
			)
		);
	} else if (
		!args.eligibleBankAccounts.some(
			(account) => account.bankAccountId === args.bankAccountId
		)
	) {
		issues.push(
			issue(
				"provider_bank_account_required",
				"Provider-managed Rotessa schedules require an active borrower-owned bank account."
			)
		);
	}
	if (args.padAuthorizationAssetId) {
		const padAsset = await ctx.db.get(args.padAuthorizationAssetId);
		if (
			!padAsset ||
			padAsset.mimeType !== "application/pdf" ||
			padAsset.source !== "admin_upload"
		) {
			issues.push(
				issue(
					"provider_pad_required",
					"Provider-managed Rotessa schedules require an uploaded PDF PAD authorization document."
				)
			);
		}
	} else {
		issues.push(
			issue(
				"provider_pad_required",
				"Provider-managed Rotessa schedules require a PAD authorization document."
			)
		);
	}

	return issues;
}

function draftStatusForIssues(
	issues: PaymentScheduleReplacementValidationIssue[]
): PaymentScheduleReplacementStatus {
	return issues.length === 0 ? "ready" : "draft";
}

function assertEditableDraft(draft: DraftDoc) {
	if (draft.status === "activated" || draft.status === "activating") {
		throw new ConvexError("Payment schedule replacement draft is not editable");
	}
}

function generatedRows(previewRows: ScheduleReplacementPreviewRow[]) {
	return previewRows.filter((row) => row.status === "generated");
}

function withDateOverride(
	dateOverrides: DraftDoc["dateOverrides"],
	rowKey: string,
	scheduledDate: number
) {
	const nextOverride = {
		rowKey,
		dueDate: scheduledDate,
		scheduledDate,
	};
	const existingIndex = dateOverrides.findIndex(
		(override) => override.rowKey === rowKey
	);
	if (existingIndex === -1) {
		return [...dateOverrides, nextOverride];
	}

	return dateOverrides.map((override, index) =>
		index === existingIndex ? nextOverride : override
	);
}

function updatedPreviewRows(
	previewRows: ScheduleReplacementPreviewRow[],
	rowKey: string,
	scheduledDate: number
) {
	return previewRows.map((row) =>
		row.rowKey === rowKey
			? {
					...row,
					dueDate: scheduledDate,
					scheduledDate,
				}
			: row
	);
}

function validateDateOverride(args: {
	deadlineDate: number;
	previewRows: ScheduleReplacementPreviewRow[];
	rowKey: string;
	scheduledDate: number;
}) {
	const rows = generatedRows(args.previewRows);
	const rowIndex = rows.findIndex((row) => row.rowKey === args.rowKey);
	const row = rows[rowIndex];
	if (!row?.editableDate) {
		return [
			issue(
				"date_override_out_of_order",
				"Only generated editable replacement rows can be adjusted.",
				args.rowKey
			),
		];
	}

	const previousRow = rows[rowIndex - 1];
	if (previousRow && args.scheduledDate <= previousRow.scheduledDate) {
		return [
			issue(
				"date_override_out_of_order",
				"Adjusted date must be after the previous generated replacement row.",
				args.rowKey
			),
		];
	}

	const nextRow = rows[rowIndex + 1];
	if (nextRow && args.scheduledDate >= nextRow.scheduledDate) {
		return [
			issue(
				"date_override_out_of_order",
				"Adjusted date must be before the next generated replacement row.",
				args.rowKey
			),
		];
	}

	if (args.scheduledDate > args.deadlineDate) {
		return [
			issue(
				"date_override_after_deadline",
				"Adjusted date must be on or before the replacement deadline.",
				args.rowKey
			),
		];
	}

	return [];
}

export const getScheduleReplacementContext = adminQuery
	.input({ mortgageId: v.id("mortgages") })
	.handler(async (ctx, args) => {
		const facts = await loadMortgageScheduleReplacementFacts(
			ctx,
			args.mortgageId
		);
		if (!facts) {
			throw new ConvexError("Mortgage not found or has no borrower");
		}

		return {
			mortgageId: facts.mortgageId,
			borrowerId: facts.borrowerId,
			borrowerLabel: facts.borrowerLabel,
			currentRailLabel: facts.currentRailLabel,
			maturityDate: facts.maturityDate,
			deadlineDate: facts.deadlineDate,
			deadlineIsoDate: facts.deadlineIsoDate,
			minStartDate: facts.minStartDate,
			outstandingInterestAmount: facts.outstandingInterestAmount,
			principalPayoffAmount: facts.principalPayoffAmount,
			previewContextRows: facts.previewContextRows,
			archiveCandidateRows: facts.archiveCandidateRows,
			eligibleBankAccounts: facts.eligibleBankAccounts,
			suggestedDraft: facts.suggestedDraft,
		};
	})
	.public();

export const createOrUpdateScheduleReplacementDraft = adminMutation
	.input({
		draftId: v.optional(v.id("paymentScheduleReplacementDrafts")),
		mortgageId: v.id("mortgages"),
		replacementRail: paymentScheduleReplacementRailValidator,
		startDate: v.number(),
		paymentFrequency: paymentScheduleReplacementFrequencyValidator,
		interestPaymentAmount: v.number(),
		bankAccountId: v.optional(v.id("bankAccounts")),
		padAuthorizationAssetId: v.optional(v.id("documentAssets")),
	})
	.handler(async (ctx, args): Promise<ScheduleReplacementDraftResult> => {
		const facts = await loadMortgageScheduleReplacementFacts(
			ctx,
			args.mortgageId
		);
		if (!facts) {
			throw new ConvexError("Mortgage not found or has no borrower");
		}

		const preview = buildReplacementPreview({
			startDate: args.startDate,
			deadlineDate: facts.deadlineDate,
			paymentFrequency: args.paymentFrequency,
			outstandingInterestAmount: facts.outstandingInterestAmount,
			principalPayoffAmount: facts.principalPayoffAmount,
			interestPaymentAmount: args.interestPaymentAmount,
			replacementRail: args.replacementRail,
			firstPaymentNumber: facts.firstPaymentNumber,
		});
		const unsafeIssues = facts.unsafePlanEntryRows.map((row) =>
			issue(
				"unsafe_existing_execution_state",
				"An existing collection plan entry is already executing and must be resolved before replacing this schedule.",
				row.rowKey
			)
		);
		const startDateIssues =
			args.startDate < facts.minStartDate
				? [
						issue(
							"invalid_start_date",
							"Replacement schedule start date must be today or later."
						),
					]
				: [];
		const issues = [
			...preview.issues,
			...startDateIssues,
			...unsafeIssues,
			...(args.replacementRail === "provider_managed_rotessa" &&
			preview.issues.length === 0 &&
			preview.interestInstallmentCount < 1
				? [
						issue(
							"provider_interest_required",
							"Provider-managed Rotessa schedules require at least one interest installment. Use manual collection for principal-only payoff."
						),
					]
				: []),
			...(await providerRequiredIssues(ctx, {
				...args,
				eligibleBankAccounts: facts.eligibleBankAccounts,
			})),
		];
		const status = draftStatusForIssues(issues);
		const previewRows = [
			...facts.previewContextRows,
			...facts.archiveCandidateRows,
			...preview.rows,
		];
		const now = Date.now();
		const draftFields = {
			mortgageId: args.mortgageId,
			status,
			replacementRail: args.replacementRail,
			startDate: args.startDate,
			paymentFrequency: args.paymentFrequency,
			interestPaymentAmount: args.interestPaymentAmount,
			outstandingInterestAmount: facts.outstandingInterestAmount,
			principalPayoffAmount: facts.principalPayoffAmount,
			interestInstallmentCount: preview.interestInstallmentCount,
			finalPayoffDate: preview.finalPayoffDate,
			deadlineDate: facts.deadlineDate,
			sliderBounds: preview.sliderBounds,
			previewRows,
			validationIssues: issues,
			bankAccountId: args.bankAccountId,
			padAuthorizationAssetId: args.padAuthorizationAssetId,
			updatedByActorId: ctx.viewer.authId,
			updatedAt: now,
		};

		if (args.draftId) {
			const existingDraft = await ctx.db.get(args.draftId);
			if (!existingDraft) {
				throw new ConvexError("Payment schedule replacement draft not found");
			}
			if (existingDraft.mortgageId !== args.mortgageId) {
				throw new ConvexError(
					"Payment schedule replacement draft does not belong to the requested mortgage"
				);
			}
			assertEditableDraft(existingDraft);
			await ctx.db.patch(args.draftId, {
				...draftFields,
				dateOverrides: [],
			});
			return { draftId: args.draftId, issues, status };
		}

		const draftId = await ctx.db.insert("paymentScheduleReplacementDrafts", {
			...draftFields,
			dateOverrides: [],
			createdByActorId: ctx.viewer.authId,
			createdAt: now,
		});

		return { draftId, issues, status };
	})
	.public();

export const getScheduleReplacementDraft = adminQuery
	.input({ draftId: v.id("paymentScheduleReplacementDrafts") })
	.handler(async (ctx, args) => {
		return ctx.db.get(args.draftId);
	})
	.public();

export const adjustDraftRowDate = adminMutation
	.input({
		draftId: v.id("paymentScheduleReplacementDrafts"),
		rowKey: v.string(),
		scheduledDate: v.number(),
	})
	.handler(async (ctx, args): Promise<ScheduleReplacementDraftResult> => {
		const draft = await ctx.db.get(args.draftId);
		if (!draft) {
			throw new ConvexError("Payment schedule replacement draft not found");
		}
		assertEditableDraft(draft);

		if (draft.replacementRail === "provider_managed_rotessa") {
			const issues = [
				issue(
					"provider_date_overrides_not_allowed",
					"Provider-managed schedule replacement drafts do not allow row-level date overrides.",
					args.rowKey
				),
			];
			const status = draftStatusForIssues(issues);
			await ctx.db.patch(args.draftId, {
				status,
				validationIssues: issues,
				updatedAt: Date.now(),
				updatedByActorId: ctx.viewer.authId,
			});
			return { draftId: args.draftId, issues, status };
		}

		const issues = validateDateOverride({
			deadlineDate: draft.deadlineDate,
			previewRows: draft.previewRows,
			rowKey: args.rowKey,
			scheduledDate: args.scheduledDate,
		});
		const status = draftStatusForIssues(issues);
		if (issues.length > 0) {
			await ctx.db.patch(args.draftId, {
				status,
				validationIssues: issues,
				updatedAt: Date.now(),
				updatedByActorId: ctx.viewer.authId,
			});
			return { draftId: args.draftId, issues, status };
		}

		await ctx.db.patch(args.draftId, {
			status,
			previewRows: updatedPreviewRows(
				draft.previewRows,
				args.rowKey,
				args.scheduledDate
			),
			dateOverrides: withDateOverride(
				draft.dateOverrides,
				args.rowKey,
				args.scheduledDate
			),
			validationIssues: [],
			updatedAt: Date.now(),
			updatedByActorId: ctx.viewer.authId,
		});

		return { draftId: args.draftId, issues: [], status };
	})
	.public();

export const cancelScheduleReplacementDraft = adminMutation
	.input({
		draftId: v.id("paymentScheduleReplacementDrafts"),
		reason: v.optional(v.string()),
	})
	.handler(async (ctx, args): Promise<ScheduleReplacementDraftResult> => {
		const draft = await ctx.db.get(args.draftId);
		if (!draft) {
			throw new ConvexError("Payment schedule replacement draft not found");
		}
		if (draft.status === "activated") {
			throw new ConvexError(
				"Activated payment schedule replacement drafts cannot be cancelled"
			);
		}
		if (draft.status === "activating") {
			throw new ConvexError(
				"Activating payment schedule replacement drafts cannot be cancelled"
			);
		}

		await ctx.db.patch(args.draftId, {
			status: "cancelled",
			cancelledAt: Date.now(),
			lastError: args.reason,
			updatedAt: Date.now(),
			updatedByActorId: ctx.viewer.authId,
		});

		return { draftId: args.draftId, issues: [], status: "cancelled" };
	})
	.public();
