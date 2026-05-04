import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAIRLEND_ADMIN } from "../../../../src/test/auth/identities";
import {
	createGovernedTestConvex,
	seedBorrowerProfile,
	seedMortgage,
} from "../../../../src/test/convex/payments/helpers";
import { api } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { toIsoBusinessDate, toUtcBusinessDate } from "../scheduleMath";

type GovernedTestConvex = ReturnType<typeof createGovernedTestConvex>;

const DRAFT_MORTGAGE_MISMATCH_ERROR =
	/does not belong to the requested mortgage/i;
const ACTIVATED_DRAFT_CANCEL_ERROR =
	/activated payment schedule replacement drafts cannot be cancelled/i;

function createBackendTestConvex() {
	return createGovernedTestConvex({ includeWorkflowComponents: false });
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
});

afterEach(() => {
	vi.useRealTimers();
});

async function seedScheduleReplacementFixture(t: GovernedTestConvex) {
	const borrowerId = await seedBorrowerProfile(t);
	const mortgageId = await seedMortgage(t);

	await t.run(async (ctx) => {
		await ctx.db.patch(mortgageId, {
			maturityDate: "2026-04-30",
			principal: 1_000_000,
		});
		await ctx.db.insert("mortgageBorrowers", {
			mortgageId,
			borrowerId,
			role: "primary",
			addedAt: Date.now(),
		});
	});

	const settledInterestId = await insertObligation(t, {
		amount: 10_000,
		amountSettled: 10_000,
		borrowerId,
		dueDate: toUtcBusinessDate("2026-01-31"),
		mortgageId,
		paymentNumber: 1,
		status: "settled",
		type: "regular_interest",
	});
	const unpaidInterestId = await insertObligation(t, {
		amount: 40_000,
		amountSettled: 10_000,
		borrowerId,
		dueDate: toUtcBusinessDate("2026-02-28"),
		mortgageId,
		paymentNumber: 2,
		status: "upcoming",
		type: "regular_interest",
	});
	const settledPrincipalId = await insertObligation(t, {
		amount: 150_000,
		amountSettled: 150_000,
		borrowerId,
		dueDate: toUtcBusinessDate("2026-03-31"),
		mortgageId,
		paymentNumber: 3,
		status: "settled",
		type: "principal_repayment",
	});
	const unsafePlanEntryId = await insertPlanEntry(t, {
		amount: 30_000,
		mortgageId,
		obligationIds: [unpaidInterestId],
		scheduledDate: toUtcBusinessDate("2026-02-28"),
		status: "planned",
	});

	return {
		borrowerId,
		mortgageId,
		settledInterestId,
		settledPrincipalId,
		unpaidInterestId,
		unsafePlanEntryId,
	};
}

async function insertBankAccount(
	t: GovernedTestConvex,
	args: {
		borrowerId: Id<"borrowers">;
		mandateStatus?: "active" | "not_required" | "pending" | "revoked";
		ownerType?: "borrower" | "lender" | "investor" | "trust";
		status?: "pending_validation" | "validated" | "revoked" | "rejected";
	}
) {
	return t.run(async (ctx) =>
		ctx.db.insert("bankAccounts", {
			ownerType: args.ownerType ?? "borrower",
			ownerId: String(args.borrowerId),
			institutionNumber: "001",
			transitNumber: "00011",
			accountNumber: "1234567",
			accountLast4: "4567",
			country: "CA",
			currency: "CAD",
			status: args.status ?? "validated",
			validationMethod: "manual",
			mandateStatus: args.mandateStatus ?? "active",
			metadata: {
				rotessaCustomerCustomIdentifier: `borrower-${args.borrowerId}`,
			},
			createdAt: Date.now(),
		})
	);
}

async function insertDocumentAsset(
	t: GovernedTestConvex,
	args: {
		mimeType?: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
		source?:
			| "admin_upload"
			| "external_import"
			| "payment_proof_upload"
			| "signature_archive";
	}
) {
	return t.run(async (ctx) => {
		const uploadedByUser = await ctx.db.query("users").first();
		if (!uploadedByUser) {
			throw new Error("Document asset fixture requires a seeded user");
		}
		const fileRef = await (
			ctx.storage as unknown as {
				store: (blob: Blob) => Promise<Id<"_storage">>;
			}
		).store(new Blob(["PAD"], { type: args.mimeType ?? "application/pdf" }));

		return ctx.db.insert("documentAssets", {
			description: "PAD Authorization",
			fileHash: `hash-pad-authorization-${args.mimeType ?? "application/pdf"}`,
			fileRef,
			fileSize: 128,
			mimeType: args.mimeType ?? "application/pdf",
			name: "PAD Authorization",
			originalFilename: "pad-authorization.pdf",
			pageCount: 1,
			source: args.source ?? "admin_upload",
			uploadedAt: Date.now(),
			uploadedByUserId: uploadedByUser._id,
		});
	});
}

async function insertObligation(
	t: GovernedTestConvex,
	args: {
		amount: number;
		amountSettled: number;
		borrowerId: Id<"borrowers">;
		dueDate: number;
		mortgageId: Id<"mortgages">;
		paymentNumber: number;
		status: string;
		type: "principal_repayment" | "regular_interest";
	}
) {
	return t.run(async (ctx) =>
		ctx.db.insert("obligations", {
			status: args.status,
			machineContext: {},
			lastTransitionAt: Date.now(),
			mortgageId: args.mortgageId,
			borrowerId: args.borrowerId,
			paymentNumber: args.paymentNumber,
			type: args.type,
			amount: args.amount,
			amountSettled: args.amountSettled,
			dueDate: args.dueDate,
			gracePeriodEnd: args.dueDate,
			settledAt: args.status === "settled" ? args.dueDate : undefined,
			createdAt: Date.now(),
		})
	);
}

async function insertPlanEntry(
	t: GovernedTestConvex,
	args: {
		amount: number;
		mortgageId: Id<"mortgages">;
		obligationIds: Id<"obligations">[];
		scheduledDate: number;
		status: "executing" | "planned";
	}
) {
	return t.run(async (ctx) =>
		ctx.db.insert("collectionPlanEntries", {
			mortgageId: args.mortgageId,
			obligationIds: args.obligationIds,
			amount: args.amount,
			method: "manual",
			scheduledDate: args.scheduledDate,
			status: args.status,
			executionMode: "app_owned",
			source: "default_schedule",
			createdAt: Date.now(),
		})
	);
}

async function readObligation(t: GovernedTestConvex, id: Id<"obligations">) {
	return t.run(async (ctx) => ctx.db.get(id));
}

describe("payment schedule replacement drafts", () => {
	it("loads settled context and unpaid replacement candidates without mutating obligations", async () => {
		const t = createBackendTestConvex();
		const fixture = await seedScheduleReplacementFixture(t);
		const beforeCandidate = await readObligation(t, fixture.unpaidInterestId);

		const context = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(
				api.payments.scheduleReplacement.drafts.getScheduleReplacementContext,
				{ mortgageId: fixture.mortgageId }
			);
		const afterCandidate = await readObligation(t, fixture.unpaidInterestId);

		expect(context).toMatchObject({
			mortgageId: fixture.mortgageId,
			borrowerId: fixture.borrowerId,
			borrowerLabel: "Test Borrower",
			currentRailLabel: "App-managed manual",
			deadlineIsoDate: "2026-06-30",
			outstandingInterestAmount: 30_000,
			principalPayoffAmount: 850_000,
		});
		expect(toIsoBusinessDate(context.deadlineDate)).toBe("2026-06-30");
		expect(toIsoBusinessDate(context.minStartDate)).toBe("2026-01-01");
		expect(context.previewContextRows).toEqual([
			expect.objectContaining({
				amount: 10_000,
				kind: "historical_settled",
				obligationId: fixture.settledInterestId,
				rowKey: `historical-${fixture.settledInterestId}`,
				status: "context",
			}),
			expect.objectContaining({
				amount: 150_000,
				kind: "historical_settled",
				obligationId: fixture.settledPrincipalId,
				rowKey: `historical-${fixture.settledPrincipalId}`,
				status: "context",
			}),
		]);
		expect(context.archiveCandidateRows).toEqual([
			expect.objectContaining({
				amount: 30_000,
				collectionPlanEntryId: fixture.unsafePlanEntryId,
				kind: "archived_candidate",
				obligationId: fixture.unpaidInterestId,
				rowKey: `archive-candidate-${fixture.unpaidInterestId}`,
				status: "will_archive",
			}),
		]);
		expect(context.suggestedDraft).toMatchObject({
			replacementRail: "app_managed_manual",
			paymentFrequency: "monthly",
			interestPaymentAmount: 30_000,
			status: "ready",
			validationIssues: [],
		});
		expect(afterCandidate).toEqual(beforeCandidate);
	});

	it("excludes terminal unpaid interest rows from replacement candidates", async () => {
		const t = createBackendTestConvex();
		const fixture = await seedScheduleReplacementFixture(t);
		const cancelledInterestId = await insertObligation(t, {
			amount: 60_000,
			amountSettled: 0,
			borrowerId: fixture.borrowerId,
			dueDate: toUtcBusinessDate("2026-04-30"),
			mortgageId: fixture.mortgageId,
			paymentNumber: 4,
			status: "cancelled",
			type: "regular_interest",
		});
		const waivedInterestId = await insertObligation(t, {
			amount: 70_000,
			amountSettled: 0,
			borrowerId: fixture.borrowerId,
			dueDate: toUtcBusinessDate("2026-05-31"),
			mortgageId: fixture.mortgageId,
			paymentNumber: 5,
			status: "waived",
			type: "regular_interest",
		});

		const context = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(
				api.payments.scheduleReplacement.drafts.getScheduleReplacementContext,
				{ mortgageId: fixture.mortgageId }
			);

		expect(context.outstandingInterestAmount).toBe(30_000);
		expect(context.archiveCandidateRows.map((row) => row.obligationId)).toEqual(
			[fixture.unpaidInterestId]
		);
		expect(
			context.archiveCandidateRows.map((row) => row.obligationId)
		).not.toContain(cancelledInterestId);
		expect(
			context.archiveCandidateRows.map((row) => row.obligationId)
		).not.toContain(waivedInterestId);
	});

	it("creates a ready app-managed draft with generated rows and manual final principal semantics", async () => {
		const t = createBackendTestConvex();
		const fixture = await seedScheduleReplacementFixture(t);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(
				api.payments.scheduleReplacement.drafts
					.createOrUpdateScheduleReplacementDraft,
				{
					mortgageId: fixture.mortgageId,
					replacementRail: "app_managed_manual",
					startDate: toUtcBusinessDate("2026-03-31"),
					paymentFrequency: "monthly",
					interestPaymentAmount: 30_000,
				}
			);
		const draft = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(
				api.payments.scheduleReplacement.drafts.getScheduleReplacementDraft,
				{
					draftId: result.draftId,
				}
			);

		expect(result).toEqual({
			draftId: result.draftId,
			issues: [],
			status: "ready",
		});
		expect(draft).toMatchObject({
			status: "ready",
			replacementRail: "app_managed_manual",
			outstandingInterestAmount: 30_000,
			principalPayoffAmount: 850_000,
			interestInstallmentCount: 1,
		});
		expect(draft?.previewRows.map((row) => row.status)).toEqual([
			"context",
			"context",
			"will_archive",
			"generated",
			"generated",
		]);
		expect(draft?.previewRows.at(-2)).toMatchObject({
			amount: 30_000,
			editableDate: true,
			executionMode: "app_owned",
			kind: "replacement_interest",
			rowKey: "generated-interest-4",
			status: "generated",
		});
		expect(draft?.previewRows.at(-1)).toMatchObject({
			amount: 850_000,
			editableDate: false,
			executionMode: "app_owned",
			kind: "replacement_principal",
			rowKey: "generated-principal-5",
			status: "generated",
		});
	});

	it("keeps drafts blocked when the selected start date is before the backend minimum", async () => {
		const t = createBackendTestConvex();
		const fixture = await seedScheduleReplacementFixture(t);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(
				api.payments.scheduleReplacement.drafts
					.createOrUpdateScheduleReplacementDraft,
				{
					mortgageId: fixture.mortgageId,
					replacementRail: "app_managed_manual",
					startDate: toUtcBusinessDate("2025-12-31"),
					paymentFrequency: "monthly",
					interestPaymentAmount: 30_000,
				}
			);

		expect(result.status).toBe("draft");
		expect(result.issues).toEqual([
			expect.objectContaining({
				code: "invalid_start_date",
			}),
		]);
	});

	it("keeps provider-managed drafts blocked until bank account and PAD are supplied", async () => {
		const t = createBackendTestConvex();
		const fixture = await seedScheduleReplacementFixture(t);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(
				api.payments.scheduleReplacement.drafts
					.createOrUpdateScheduleReplacementDraft,
				{
					mortgageId: fixture.mortgageId,
					replacementRail: "provider_managed_rotessa",
					startDate: toUtcBusinessDate("2026-03-31"),
					paymentFrequency: "monthly",
					interestPaymentAmount: 30_000,
				}
			);

		expect(result.status).toBe("draft");
		expect(result.issues.map((issue) => issue.code).sort()).toEqual([
			"provider_bank_account_required",
			"provider_pad_required",
		]);
	});

	it("keeps provider-managed drafts blocked for ineligible bank accounts and non-PDF PAD assets", async () => {
		const t = createBackendTestConvex();
		const fixture = await seedScheduleReplacementFixture(t);
		const ineligibleBankAccountId = await insertBankAccount(t, {
			borrowerId: fixture.borrowerId,
			ownerType: "lender",
		});
		const nonPadAssetId = await insertDocumentAsset(t, {
			mimeType: "image/png",
		});

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(
				api.payments.scheduleReplacement.drafts
					.createOrUpdateScheduleReplacementDraft,
				{
					mortgageId: fixture.mortgageId,
					replacementRail: "provider_managed_rotessa",
					startDate: toUtcBusinessDate("2026-03-31"),
					paymentFrequency: "monthly",
					interestPaymentAmount: 30_000,
					bankAccountId: ineligibleBankAccountId,
					padAuthorizationAssetId: nonPadAssetId,
				}
			);

		expect(result.status).toBe("draft");
		expect(result.issues.map((issue) => issue.code).sort()).toEqual([
			"provider_bank_account_required",
			"provider_pad_required",
		]);
	});

	it("allows provider-managed drafts with an eligible borrower bank account and uploaded PDF PAD", async () => {
		const t = createBackendTestConvex();
		const fixture = await seedScheduleReplacementFixture(t);
		const bankAccountId = await insertBankAccount(t, {
			borrowerId: fixture.borrowerId,
		});
		const padAuthorizationAssetId = await insertDocumentAsset(t, {});

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(
				api.payments.scheduleReplacement.drafts
					.createOrUpdateScheduleReplacementDraft,
				{
					mortgageId: fixture.mortgageId,
					replacementRail: "provider_managed_rotessa",
					startDate: toUtcBusinessDate("2026-03-31"),
					paymentFrequency: "monthly",
					interestPaymentAmount: 30_000,
					bankAccountId,
					padAuthorizationAssetId,
				}
			);
		const draft = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(
				api.payments.scheduleReplacement.drafts.getScheduleReplacementDraft,
				{
					draftId: result.draftId,
				}
			);

		expect(result).toEqual({
			draftId: result.draftId,
			issues: [],
			status: "ready",
		});
		expect(draft).toMatchObject({
			bankAccountId,
			padAuthorizationAssetId,
			replacementRail: "provider_managed_rotessa",
			status: "ready",
		});
		expect(draft?.previewRows.at(-2)).toMatchObject({
			editableDate: false,
			executionMode: "provider_managed",
			kind: "replacement_interest",
		});
		expect(draft?.previewRows.at(-1)).toMatchObject({
			editableDate: false,
			executionMode: "app_owned",
			kind: "replacement_principal",
		});
	});

	it("keeps provider-managed principal-only drafts blocked before activation", async () => {
		const t = createBackendTestConvex();
		const fixture = await seedScheduleReplacementFixture(t);
		const bankAccountId = await insertBankAccount(t, {
			borrowerId: fixture.borrowerId,
		});
		const padAuthorizationAssetId = await insertDocumentAsset(t, {});
		await t.run(async (ctx) => {
			await ctx.db.patch(fixture.unpaidInterestId, {
				amountSettled: 40_000,
				status: "settled",
				settledAt: Date.now(),
			});
		});

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(
				api.payments.scheduleReplacement.drafts
					.createOrUpdateScheduleReplacementDraft,
				{
					mortgageId: fixture.mortgageId,
					replacementRail: "provider_managed_rotessa",
					startDate: toUtcBusinessDate("2026-03-31"),
					paymentFrequency: "monthly",
					interestPaymentAmount: 30_000,
					bankAccountId,
					padAuthorizationAssetId,
				}
			);

		expect(result.status).toBe("draft");
		expect(result.issues).toEqual([
			expect.objectContaining({
				code: "provider_interest_required",
			}),
		]);
	});

	it("keeps provider-managed drafts blocked when Rotessa cannot represent the generated interest rows exactly", async () => {
		const t = createBackendTestConvex();
		const fixture = await seedScheduleReplacementFixture(t);
		const bankAccountId = await insertBankAccount(t, {
			borrowerId: fixture.borrowerId,
		});
		const padAuthorizationAssetId = await insertDocumentAsset(t, {});

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(
				api.payments.scheduleReplacement.drafts
					.createOrUpdateScheduleReplacementDraft,
				{
					mortgageId: fixture.mortgageId,
					replacementRail: "provider_managed_rotessa",
					startDate: toUtcBusinessDate("2026-03-31"),
					paymentFrequency: "monthly",
					interestPaymentAmount: 20_000,
					bankAccountId,
					padAuthorizationAssetId,
				}
			);

		expect(result.status).toBe("draft");
		expect(result.issues).toEqual([
			expect.objectContaining({
				code: "provider_uniform_interest_amount_required",
			}),
		]);
	});

	it("updates app-managed generated row dates and rejects provider-managed date overrides", async () => {
		const t = createBackendTestConvex();
		const fixture = await seedScheduleReplacementFixture(t);
		const admin = t.withIdentity(FAIRLEND_ADMIN);
		const appDraft = await admin.mutation(
			api.payments.scheduleReplacement.drafts
				.createOrUpdateScheduleReplacementDraft,
			{
				mortgageId: fixture.mortgageId,
				replacementRail: "app_managed_manual",
				startDate: toUtcBusinessDate("2026-03-31"),
				paymentFrequency: "monthly",
				interestPaymentAmount: 30_000,
			}
		);

		const overrideResult = await admin.mutation(
			api.payments.scheduleReplacement.drafts.adjustDraftRowDate,
			{
				draftId: appDraft.draftId,
				rowKey: "generated-interest-4",
				scheduledDate: toUtcBusinessDate("2026-04-15"),
			}
		);
		const adjustedDraft = await admin.query(
			api.payments.scheduleReplacement.drafts.getScheduleReplacementDraft,
			{ draftId: appDraft.draftId }
		);
		const adjustedRow = adjustedDraft?.previewRows.find(
			(row) => row.rowKey === "generated-interest-4"
		);

		expect(overrideResult).toEqual({
			draftId: appDraft.draftId,
			issues: [],
			status: "ready",
		});
		expect(adjustedRow).toMatchObject({
			dueDate: toUtcBusinessDate("2026-04-15"),
			scheduledDate: toUtcBusinessDate("2026-04-15"),
		});
		expect(adjustedDraft?.dateOverrides).toEqual([
			{
				rowKey: "generated-interest-4",
				dueDate: toUtcBusinessDate("2026-04-15"),
				scheduledDate: toUtcBusinessDate("2026-04-15"),
			},
		]);

		const regeneratedResult = await admin.mutation(
			api.payments.scheduleReplacement.drafts
				.createOrUpdateScheduleReplacementDraft,
			{
				draftId: appDraft.draftId,
				mortgageId: fixture.mortgageId,
				replacementRail: "app_managed_manual",
				startDate: toUtcBusinessDate("2026-04-30"),
				paymentFrequency: "monthly",
				interestPaymentAmount: 30_000,
			}
		);
		const regeneratedDraft = await admin.query(
			api.payments.scheduleReplacement.drafts.getScheduleReplacementDraft,
			{ draftId: appDraft.draftId }
		);

		expect(regeneratedResult.status).toBe("ready");
		expect(regeneratedDraft?.dateOverrides).toEqual([]);
		expect(
			regeneratedDraft?.previewRows.find(
				(row) => row.rowKey === "generated-interest-4"
			)
		).toMatchObject({
			dueDate: toUtcBusinessDate("2026-04-30"),
			scheduledDate: toUtcBusinessDate("2026-04-30"),
		});

		const providerDraft = await admin.mutation(
			api.payments.scheduleReplacement.drafts
				.createOrUpdateScheduleReplacementDraft,
			{
				mortgageId: fixture.mortgageId,
				replacementRail: "provider_managed_rotessa",
				startDate: toUtcBusinessDate("2026-03-31"),
				paymentFrequency: "monthly",
				interestPaymentAmount: 30_000,
			}
		);
		const providerOverrideResult = await admin.mutation(
			api.payments.scheduleReplacement.drafts.adjustDraftRowDate,
			{
				draftId: providerDraft.draftId,
				rowKey: "generated-interest-4",
				scheduledDate: toUtcBusinessDate("2026-04-15"),
			}
		);

		expect(providerOverrideResult.status).toBe("draft");
		expect(providerOverrideResult.issues).toEqual([
			expect.objectContaining({
				code: "provider_date_overrides_not_allowed",
				rowKey: "generated-interest-4",
			}),
		]);
	});

	it("rejects updates that try to move an existing draft to another mortgage", async () => {
		const t = createBackendTestConvex();
		const firstFixture = await seedScheduleReplacementFixture(t);
		const secondFixture = await seedScheduleReplacementFixture(t);
		const admin = t.withIdentity(FAIRLEND_ADMIN);
		const draftResult = await admin.mutation(
			api.payments.scheduleReplacement.drafts
				.createOrUpdateScheduleReplacementDraft,
			{
				mortgageId: firstFixture.mortgageId,
				replacementRail: "app_managed_manual",
				startDate: toUtcBusinessDate("2026-03-31"),
				paymentFrequency: "monthly",
				interestPaymentAmount: 30_000,
			}
		);

		await expect(
			admin.mutation(
				api.payments.scheduleReplacement.drafts
					.createOrUpdateScheduleReplacementDraft,
				{
					draftId: draftResult.draftId,
					mortgageId: secondFixture.mortgageId,
					replacementRail: "app_managed_manual",
					startDate: toUtcBusinessDate("2026-03-31"),
					paymentFrequency: "monthly",
					interestPaymentAmount: 30_000,
				}
			)
		).rejects.toThrow(DRAFT_MORTGAGE_MISMATCH_ERROR);

		const draft = await admin.query(
			api.payments.scheduleReplacement.drafts.getScheduleReplacementDraft,
			{ draftId: draftResult.draftId }
		);
		expect(draft?.mortgageId).toBe(firstFixture.mortgageId);
	});

	it("does not cancel activated replacement drafts", async () => {
		const t = createBackendTestConvex();
		const fixture = await seedScheduleReplacementFixture(t);
		const admin = t.withIdentity(FAIRLEND_ADMIN);
		const draftResult = await admin.mutation(
			api.payments.scheduleReplacement.drafts
				.createOrUpdateScheduleReplacementDraft,
			{
				mortgageId: fixture.mortgageId,
				replacementRail: "app_managed_manual",
				startDate: toUtcBusinessDate("2026-03-31"),
				paymentFrequency: "monthly",
				interestPaymentAmount: 30_000,
			}
		);
		await t.run(async (ctx) => {
			await ctx.db.patch(draftResult.draftId, {
				status: "activated",
				replacementBatchId: `schedule-replacement:${draftResult.draftId}`,
				activatedAt: Date.now(),
			});
		});

		await expect(
			admin.mutation(
				api.payments.scheduleReplacement.drafts.cancelScheduleReplacementDraft,
				{
					draftId: draftResult.draftId,
					reason: "wrong button",
				}
			)
		).rejects.toThrow(ACTIVATED_DRAFT_CANCEL_ERROR);

		const draft = await admin.query(
			api.payments.scheduleReplacement.drafts.getScheduleReplacementDraft,
			{ draftId: draftResult.draftId }
		);
		expect(draft).toMatchObject({
			status: "activated",
			replacementBatchId: `schedule-replacement:${draftResult.draftId}`,
		});
	});
});
