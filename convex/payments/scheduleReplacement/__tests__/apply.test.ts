import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAIRLEND_ADMIN } from "../../../../src/test/auth/identities";
import {
	createGovernedTestConvex,
	seedBorrowerProfile,
	seedMortgage,
} from "../../../../src/test/convex/payments/helpers";
import { api, components } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { toUtcBusinessDate } from "../scheduleMath";
import type { PaymentScheduleReplacementValidationIssue } from "../types";

type GovernedTestConvex = ReturnType<typeof createGovernedTestConvex>;

type ApplyScheduleReplacementResult =
	| {
			draftId: Id<"paymentScheduleReplacementDrafts">;
			newExternalCollectionScheduleId?: Id<"externalCollectionSchedules">;
			outcome: "activated";
			replacementBatchId: string;
	  }
	| {
			draftId: Id<"paymentScheduleReplacementDrafts">;
			issues: PaymentScheduleReplacementValidationIssue[];
			outcome: "rejected";
			reasonCode: string;
			reasonDetail: string;
	  };

const applyScheduleReplacementDraftRef = makeFunctionReference<
	"action",
	{ draftId: Id<"paymentScheduleReplacementDrafts"> },
	ApplyScheduleReplacementResult
>("payments/scheduleReplacement/apply:applyScheduleReplacementDraft");

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
	const oldPlanEntryId = await insertPlanEntry(t, {
		amount: 30_000,
		mortgageId,
		obligationIds: [unpaidInterestId],
		scheduledDate: toUtcBusinessDate("2026-02-28"),
		status: "planned",
	});
	const retryPlanEntryId = await insertPlanEntry(t, {
		amount: 30_000,
		mortgageId,
		obligationIds: [unpaidInterestId],
		scheduledDate: toUtcBusinessDate("2026-03-15"),
		status: "planned",
		source: "retry_rule",
	});
	const settledPlanEntryId = await insertPlanEntry(t, {
		amount: 10_000,
		mortgageId,
		obligationIds: [settledInterestId],
		scheduledDate: toUtcBusinessDate("2026-01-31"),
		status: "completed",
	});
	const unpaidPrincipalId = await insertObligation(t, {
		amount: 850_000,
		amountSettled: 0,
		borrowerId,
		dueDate: toUtcBusinessDate("2026-04-30"),
		mortgageId,
		paymentNumber: 4,
		status: "upcoming",
		type: "principal_repayment",
	});
	const oldPrincipalPlanEntryId = await insertPlanEntry(t, {
		amount: 850_000,
		mortgageId,
		obligationIds: [unpaidPrincipalId],
		scheduledDate: toUtcBusinessDate("2026-04-30"),
		status: "planned",
	});

	return {
		borrowerId,
		mortgageId,
		oldPlanEntryId,
		oldPrincipalPlanEntryId,
		retryPlanEntryId,
		settledInterestId,
		settledPlanEntryId,
		settledPrincipalId,
		unpaidPrincipalId,
		unpaidInterestId,
	};
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
		source?:
			| "admin"
			| "admin_reschedule"
			| "admin_workout"
			| "default_schedule"
			| "late_fee_rule"
			| "retry_rule";
		status: "cancelled" | "completed" | "executing" | "planned";
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
			source: args.source ?? "default_schedule",
			createdAt: Date.now(),
		})
	);
}

async function createReadyAppManagedDraft(
	t: GovernedTestConvex,
	mortgageId: Id<"mortgages">
) {
	return t
		.withIdentity(FAIRLEND_ADMIN)
		.mutation(
			api.payments.scheduleReplacement.drafts
				.createOrUpdateScheduleReplacementDraft,
			{
				mortgageId,
				replacementRail: "app_managed_manual",
				startDate: toUtcBusinessDate("2026-03-31"),
				paymentFrequency: "monthly",
				interestPaymentAmount: 30_000,
			}
		);
}

async function readObligation(t: GovernedTestConvex, id: Id<"obligations">) {
	return t.run(async (ctx) => ctx.db.get(id));
}

async function readPlanEntry(
	t: GovernedTestConvex,
	id: Id<"collectionPlanEntries">
) {
	return t.run(async (ctx) => ctx.db.get(id));
}

async function listMortgageObligations(
	t: GovernedTestConvex,
	mortgageId: Id<"mortgages">
) {
	return t.run(async (ctx) =>
		ctx.db
			.query("obligations")
			.withIndex("by_mortgage_and_date", (q) => q.eq("mortgageId", mortgageId))
			.collect()
	);
}

async function listMortgagePlanEntries(
	t: GovernedTestConvex,
	mortgageId: Id<"mortgages">
) {
	return t.run(async (ctx) =>
		ctx.db
			.query("collectionPlanEntries")
			.withIndex("by_mortgage_status_scheduled", (q) =>
				q.eq("mortgageId", mortgageId)
			)
			.collect()
	);
}

describe("app-managed payment schedule replacement apply", () => {
	it("archives unpaid old rows, preserves settled history, creates replacement rows, and is idempotent", async () => {
		const t = createBackendTestConvex();
		const fixture = await seedScheduleReplacementFixture(t);
		const draftResult = await createReadyAppManagedDraft(t, fixture.mortgageId);
		const replacementBatchId = `schedule-replacement:${draftResult.draftId}`;

		expect(draftResult.status).toBe("ready");

		const firstApply = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(applyScheduleReplacementDraftRef, {
				draftId: draftResult.draftId,
			});

		expect(firstApply).toEqual({
			draftId: draftResult.draftId,
			outcome: "activated",
			replacementBatchId,
		});

		const settledInterest = await readObligation(t, fixture.settledInterestId);
		const settledPrincipal = await readObligation(
			t,
			fixture.settledPrincipalId
		);
		const settledPlanEntry = await readPlanEntry(t, fixture.settledPlanEntryId);
		const archivedInterest = await readObligation(t, fixture.unpaidInterestId);
		const archivedPrincipal = await readObligation(
			t,
			fixture.unpaidPrincipalId
		);
		const archivedPlanEntry = await readPlanEntry(t, fixture.oldPlanEntryId);
		const archivedRetryPlanEntry = await readPlanEntry(
			t,
			fixture.retryPlanEntryId
		);
		const archivedPrincipalPlanEntry = await readPlanEntry(
			t,
			fixture.oldPrincipalPlanEntryId
		);

		expect(settledInterest).toMatchObject({ status: "settled" });
		expect(settledInterest).not.toHaveProperty("replacementBatchId");
		expect(settledInterest).not.toHaveProperty("archivedAt");
		expect(settledPrincipal).toMatchObject({ status: "settled" });
		expect(settledPrincipal).not.toHaveProperty("replacementBatchId");
		expect(settledPrincipal).not.toHaveProperty("archivedAt");
		expect(settledPlanEntry).toMatchObject({ status: "completed" });
		expect(settledPlanEntry).not.toHaveProperty("replacementBatchId");
		expect(settledPlanEntry).not.toHaveProperty("archivedAt");
		expect(archivedInterest).toMatchObject({
			status: "cancelled",
			archivedByReplacementDraftId: draftResult.draftId,
			archivedByReplacementBatchId: replacementBatchId,
			replacedByReplacementBatchId: replacementBatchId,
			archivedAt: Date.now(),
			archiveReason: "payment_schedule_replacement",
		});
		expect(archivedPrincipal).toMatchObject({
			status: "cancelled",
			archivedByReplacementDraftId: draftResult.draftId,
			archivedByReplacementBatchId: replacementBatchId,
			replacedByReplacementBatchId: replacementBatchId,
			archivedAt: Date.now(),
			archiveReason: "payment_schedule_replacement",
		});
		expect(archivedPlanEntry).toMatchObject({
			status: "cancelled",
			archivedByReplacementDraftId: draftResult.draftId,
			archivedByReplacementBatchId: replacementBatchId,
			replacedByReplacementBatchId: replacementBatchId,
			archivedAt: Date.now(),
			archiveReason: "payment_schedule_replacement",
		});
		expect(archivedRetryPlanEntry).toMatchObject({
			status: "cancelled",
			archivedByReplacementDraftId: draftResult.draftId,
			archivedByReplacementBatchId: replacementBatchId,
			replacedByReplacementBatchId: replacementBatchId,
			archivedAt: Date.now(),
			archiveReason: "payment_schedule_replacement",
		});
		expect(archivedPrincipalPlanEntry).toMatchObject({
			status: "cancelled",
			archivedByReplacementDraftId: draftResult.draftId,
			archivedByReplacementBatchId: replacementBatchId,
			replacedByReplacementBatchId: replacementBatchId,
			archivedAt: Date.now(),
			archiveReason: "payment_schedule_replacement",
		});

		const replacementObligations = (
			await listMortgageObligations(t, fixture.mortgageId)
		).filter(
			(obligation) => obligation.replacementBatchId === replacementBatchId
		);
		const replacementPlanEntries = (
			await listMortgagePlanEntries(t, fixture.mortgageId)
		).filter(
			(planEntry) => planEntry.replacementBatchId === replacementBatchId
		);

		expect(replacementObligations).toHaveLength(2);
		expect(replacementPlanEntries).toHaveLength(2);
		expect(replacementObligations).toEqual([
			expect.objectContaining({
				amount: 30_000,
				amountSettled: 0,
				dueDate: toUtcBusinessDate("2026-03-31"),
				paymentNumber: 5,
				replacementDraftId: draftResult.draftId,
				replacementBatchId,
				status: "upcoming",
				type: "regular_interest",
			}),
			expect.objectContaining({
				amount: 850_000,
				amountSettled: 0,
				dueDate: toUtcBusinessDate("2026-04-30"),
				paymentNumber: 6,
				replacementDraftId: draftResult.draftId,
				replacementBatchId,
				status: "upcoming",
				type: "principal_repayment",
			}),
		]);
		expect(replacementPlanEntries).toEqual([
			expect.objectContaining({
				amount: 30_000,
				executionMode: "app_owned",
				method: "manual",
				replacementDraftId: draftResult.draftId,
				replacementBatchId,
				scheduledDate: toUtcBusinessDate("2026-03-31"),
				source: "admin",
				status: "planned",
			}),
			expect.objectContaining({
				amount: 850_000,
				executionMode: "app_owned",
				method: "manual",
				replacementDraftId: draftResult.draftId,
				replacementBatchId,
				scheduledDate: toUtcBusinessDate("2026-04-30"),
				source: "admin",
				status: "planned",
			}),
		]);
		expect(replacementPlanEntries.map((entry) => entry.obligationIds)).toEqual([
			[replacementObligations[0]._id],
			[replacementObligations[1]._id],
		]);
		const auditEntries = await t.query(
			components.auditLog.lib.queryByResource,
			{
				resourceType: "paymentScheduleReplacementDrafts",
				resourceId: draftResult.draftId,
			}
		);
		const activationAudit = auditEntries.find(
			(entry: { action: string }) =>
				entry.action === "payments.schedule_replacement.activated"
		);
		expect(activationAudit?.metadata).toMatchObject({
			archivedPlanEntryIds: expect.arrayContaining([
				fixture.oldPlanEntryId,
				fixture.oldPrincipalPlanEntryId,
				fixture.retryPlanEntryId,
			]),
		});

		const beforeRetryObligationIds = (
			await listMortgageObligations(t, fixture.mortgageId)
		).map((obligation) => obligation._id);
		const beforeRetryPlanEntryIds = (
			await listMortgagePlanEntries(t, fixture.mortgageId)
		).map((planEntry) => planEntry._id);

		const secondApply = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(applyScheduleReplacementDraftRef, {
				draftId: draftResult.draftId,
			});

		expect(secondApply).toEqual(firstApply);
		expect(
			(await listMortgageObligations(t, fixture.mortgageId)).map(
				(obligation) => obligation._id
			)
		).toEqual(beforeRetryObligationIds);
		expect(
			(await listMortgagePlanEntries(t, fixture.mortgageId)).map(
				(planEntry) => planEntry._id
			)
		).toEqual(beforeRetryPlanEntryIds);
	});

	it("rejects when a current archive candidate is executing and leaves rows retryable", async () => {
		const t = createBackendTestConvex();
		const fixture = await seedScheduleReplacementFixture(t);
		const draftResult = await createReadyAppManagedDraft(t, fixture.mortgageId);
		const oldObligationBefore = await readObligation(
			t,
			fixture.unpaidInterestId
		);

		await t.run(async (ctx) => {
			await ctx.db.patch(fixture.oldPlanEntryId, {
				executionIdempotencyKey: "existing-execution",
			});
		});
		const oldPlanEntryBefore = await readPlanEntry(t, fixture.oldPlanEntryId);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(applyScheduleReplacementDraftRef, {
				draftId: draftResult.draftId,
			});

		expect(result).toEqual({
			draftId: draftResult.draftId,
			issues: [
				expect.objectContaining({
					code: "unsafe_existing_execution_state",
					rowKey: `archive-candidate-${fixture.unpaidInterestId}`,
				}),
			],
			outcome: "rejected",
			reasonCode: "unsafe_existing_execution_state",
			reasonDetail:
				"An existing collection plan entry is already executing and must be resolved before replacing this schedule.",
		});
		expect(await readObligation(t, fixture.unpaidInterestId)).toEqual(
			oldObligationBefore
		);
		expect(await readPlanEntry(t, fixture.oldPlanEntryId)).toEqual(
			oldPlanEntryBefore
		);
		expect(
			(await listMortgageObligations(t, fixture.mortgageId)).filter(
				(obligation) =>
					obligation.replacementBatchId ===
					`schedule-replacement:${draftResult.draftId}`
			)
		).toEqual([]);
		expect(
			await t
				.withIdentity(FAIRLEND_ADMIN)
				.query(
					api.payments.scheduleReplacement.drafts.getScheduleReplacementDraft,
					{ draftId: draftResult.draftId }
				)
		).toMatchObject({ status: "ready" });
	});

	it("rejects a ready draft when the mortgage maturity deadline no longer fits the generated payoff", async () => {
		const t = createBackendTestConvex();
		const fixture = await seedScheduleReplacementFixture(t);
		const draftResult = await createReadyAppManagedDraft(t, fixture.mortgageId);

		await t.run(async (ctx) => {
			await ctx.db.patch(fixture.mortgageId, {
				maturityDate: "2026-01-15",
			});
		});

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(applyScheduleReplacementDraftRef, {
				draftId: draftResult.draftId,
			});

		expect(result).toMatchObject({
			draftId: draftResult.draftId,
			outcome: "rejected",
			reasonCode: "stale_draft",
		});
		expect(result.outcome === "rejected" ? result.reasonDetail : "").toContain(
			"no longer fits"
		);
		const oldInterest = await readObligation(t, fixture.unpaidInterestId);
		const oldPlanEntry = await readPlanEntry(t, fixture.oldPlanEntryId);
		expect(oldInterest).toMatchObject({ status: "upcoming" });
		expect(oldInterest?.archivedAt).toBeUndefined();
		expect(oldPlanEntry).toMatchObject({ status: "planned" });
		expect(oldPlanEntry?.archivedAt).toBeUndefined();

		const auditEntries = await t.query(
			components.auditLog.lib.queryByResource,
			{
				resourceType: "paymentScheduleReplacementDrafts",
				resourceId: draftResult.draftId,
			}
		);
		expect(
			auditEntries.some(
				(entry: {
					action: string;
					metadata?: { validationCodes?: string[] };
				}) =>
					entry.action === "payments.schedule_replacement.apply_rejected" &&
					entry.metadata?.validationCodes?.includes("stale_draft")
			)
		).toBe(true);
	});

	it("rejects a non-activated draft when replacement rows already exist for its batch", async () => {
		const t = createBackendTestConvex();
		const fixture = await seedScheduleReplacementFixture(t);
		const draftResult = await createReadyAppManagedDraft(t, fixture.mortgageId);
		const replacementBatchId = `schedule-replacement:${draftResult.draftId}`;

		await t.run(async (ctx) => {
			await ctx.db.insert("obligations", {
				status: "upcoming",
				machineContext: {},
				lastTransitionAt: Date.now(),
				mortgageId: fixture.mortgageId,
				borrowerId: fixture.borrowerId,
				paymentNumber: 99,
				type: "principal_repayment",
				amount: 1,
				amountSettled: 0,
				dueDate: toUtcBusinessDate("2026-03-31"),
				gracePeriodEnd: toUtcBusinessDate("2026-03-31"),
				createdAt: Date.now(),
				replacementDraftId: draftResult.draftId,
				replacementBatchId,
			});
		});

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(applyScheduleReplacementDraftRef, {
				draftId: draftResult.draftId,
			});
		const storedDraft = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(
				api.payments.scheduleReplacement.drafts.getScheduleReplacementDraft,
				{
					draftId: draftResult.draftId,
				}
			);

		expect(result).toMatchObject({
			draftId: draftResult.draftId,
			outcome: "rejected",
			reasonCode: "stale_draft",
		});
		expect(storedDraft).toMatchObject({ status: "ready" });
		const oldInterest = await readObligation(t, fixture.unpaidInterestId);
		expect(oldInterest).toMatchObject({ status: "upcoming" });
		expect(oldInterest).not.toHaveProperty("archivedAt");
	});
});
