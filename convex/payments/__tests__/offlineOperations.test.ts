import { anyApi } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAIRLEND_ADMIN } from "../../../src/test/auth/identities";
import {
	createGovernedTestConvex,
	drainScheduledWork,
	ensureBorrowerReceivableAccount,
	seedBorrowerProfile,
	seedCollectionSettlementPrereqs,
	seedMortgage,
	seedObligation,
	seedPlanEntry,
} from "../../../src/test/convex/payments/helpers";
import type { Doc, Id } from "../../_generated/dataModel";

const offlineApi = anyApi.payments.offlineOperations;

const AS_OF = Date.parse("2026-06-15T12:00:00.000Z");
const NOW = AS_OF;
const EARLY_START_REASON_ERROR = /early-start reason/i;
const EXACT_REMAINING_COLLECTIBLE_AMOUNT_ERROR =
	/exact remaining collectible amount/i;
const EVIDENCE_ERROR = /evidence/i;

type GovernedTestConvex = ReturnType<typeof createGovernedTestConvex>;

function createBackendTestConvex() {
	return createGovernedTestConvex({ includeWorkflowComponents: false });
}

function asPaymentUser(t: GovernedTestConvex) {
	return t.withIdentity(FAIRLEND_ADMIN);
}

function utcDate(date: string) {
	return Date.parse(`${date}T12:00:00.000Z`);
}

async function seedOfflineBase(t: GovernedTestConvex) {
	const borrowerId = await seedBorrowerProfile(t);
	const mortgageId = await seedMortgage(t);
	return { borrowerId, mortgageId };
}

async function seedOfflineEntry(
	t: GovernedTestConvex,
	args: {
		amount?: number;
		borrowerId: Id<"borrowers">;
		dueDate?: number;
		method?: string;
		mortgageId: Id<"mortgages">;
		obligationStatus?: Doc<"obligations">["status"];
		planStatus?: Doc<"collectionPlanEntries">["status"];
		scheduledDate: number;
	}
) {
	const obligationId = await seedObligation(
		t,
		args.mortgageId,
		args.borrowerId,
		{
			amount: args.amount ?? 100_000,
			dueDate: args.dueDate ?? args.scheduledDate,
			status: args.obligationStatus ?? "due",
		}
	);
	const planEntryId = await seedPlanEntry(t, {
		amount: args.amount ?? 100_000,
		method: args.method ?? "manual_review",
		obligationIds: [obligationId],
		scheduledDate: args.scheduledDate,
		status: args.planStatus ?? "planned",
		source: "default_schedule",
	});

	return { obligationId, planEntryId };
}

function uploadedEvidenceId(label: string) {
	return `uploaded:${label}:storage-ref`;
}

async function seedPendingOfflineAttempt(
	t: GovernedTestConvex,
	planEntryId: Id<"collectionPlanEntries">,
	options?: { requestedAt?: number }
) {
	const requestedAt = options?.requestedAt ?? NOW;
	const result = await asPaymentUser(t).action(offlineApi.startCollection, {
		asOf: requestedAt,
		planEntryId,
		reason: "collector picked up cash desk work",
	});
	await drainScheduledWork(t);
	return result as {
		collectionAttemptId: Id<"collectionAttempts">;
		planEntryId: Id<"collectionPlanEntries">;
		transferRequestId: Id<"transferRequests">;
	};
}

function evidenceInput(attachmentId: string) {
	return {
		attachmentIds: [attachmentId],
		note: "cash drawer receipt uploaded",
	};
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
	vi.stubEnv("DISABLE_CASH_LEDGER_HASHCHAIN", "true");
	vi.stubEnv("DISABLE_GT_HASHCHAIN", "true");
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe("offline payment operations read model", () => {
	it("projects only offline entries into the PRD buckets and separates grouped installments", async () => {
		const t = createBackendTestConvex();
		const { borrowerId, mortgageId } = await seedOfflineBase(t);
		const upcoming = await seedOfflineEntry(t, {
			borrowerId,
			mortgageId,
			scheduledDate: utcDate("2026-06-17"),
		});
		const due = await seedOfflineEntry(t, {
			borrowerId,
			mortgageId,
			scheduledDate: utcDate("2026-06-12"),
		});
		const overdue = await seedOfflineEntry(t, {
			borrowerId,
			mortgageId,
			scheduledDate: utcDate("2026-06-09"),
		});
		const delinquent = await seedOfflineEntry(t, {
			borrowerId,
			mortgageId,
			scheduledDate: utcDate("2026-06-01"),
		});
		const inProgress = await seedOfflineEntry(t, {
			borrowerId,
			mortgageId,
			scheduledDate: utcDate("2026-06-09"),
		});
		const staffOverdue = await seedOfflineEntry(t, {
			borrowerId,
			mortgageId,
			scheduledDate: utcDate("2026-06-01"),
		});
		const groupedObligationA = await seedObligation(t, mortgageId, borrowerId, {
			amount: 80_000,
			dueDate: utcDate("2026-06-12"),
			status: "due",
		});
		const groupedObligationB = await seedObligation(t, mortgageId, borrowerId, {
			amount: 60_000,
			dueDate: utcDate("2026-06-13"),
			status: "due",
		});
		const groupedPlanEntryId = await seedPlanEntry(t, {
			amount: 100_000,
			method: "manual_review",
			obligationIds: [groupedObligationA, groupedObligationB],
			scheduledDate: utcDate("2026-06-12"),
			status: "planned",
			source: "admin_workout",
		});
		await seedOfflineEntry(t, {
			borrowerId,
			method: "pad_rotessa",
			mortgageId,
			scheduledDate: utcDate("2026-06-12"),
		});

		await seedPendingOfflineAttempt(t, inProgress.planEntryId, {
			requestedAt: AS_OF - 60 * 60 * 1000,
		});
		await seedPendingOfflineAttempt(t, staffOverdue.planEntryId, {
			requestedAt: AS_OF - 25 * 60 * 60 * 1000,
		});

		const snapshot = await asPaymentUser(t).query(
			offlineApi.getOfflinePaymentOperationsSnapshot,
			{ asOf: AS_OF }
		);

		expect(
			snapshot.kanban.upcoming.map(
				(item: { planEntryId: string }) => item.planEntryId
			)
		).toEqual([String(upcoming.planEntryId)]);
		expect(
			snapshot.kanban.due.map(
				(item: { planEntryId: string }) => item.planEntryId
			)
		).toEqual([String(due.planEntryId)]);
		expect(
			snapshot.kanban.overdue.map(
				(item: { planEntryId: string }) => item.planEntryId
			)
		).toEqual([String(overdue.planEntryId)]);
		expect(
			snapshot.kanban.delinquent.map(
				(item: { planEntryId: string }) => item.planEntryId
			)
		).toEqual([String(delinquent.planEntryId)]);
		expect(
			snapshot.kanban.inProgress.map(
				(item: { planEntryId: string }) => item.planEntryId
			)
		).toEqual([String(inProgress.planEntryId)]);
		expect(
			snapshot.kanban.staffOverdue.map(
				(item: { planEntryId: string }) => item.planEntryId
			)
		).toEqual([String(staffOverdue.planEntryId)]);
		expect(snapshot.groupedEntries).toHaveLength(1);
		expect(snapshot.groupedEntries[0]).toMatchObject({
			planEntryId: String(groupedPlanEntryId),
			installments: [
				{
					obligationIds: [
						String(groupedObligationA),
						String(groupedObligationB),
					],
				},
			],
		});
		expect(
			snapshot.calendarEvents.map(
				(event: { planEntryId: string }) => event.planEntryId
			)
		).toEqual(
			expect.arrayContaining([
				String(upcoming.planEntryId),
				String(due.planEntryId),
				String(groupedPlanEntryId),
			])
		);
	});
});

describe("offline payment operations actions", () => {
	it("allows early start only within three business days with an audited reason", async () => {
		const t = createBackendTestConvex();
		const { borrowerId, mortgageId } = await seedOfflineBase(t);
		const early = await seedOfflineEntry(t, {
			borrowerId,
			mortgageId,
			scheduledDate: utcDate("2026-06-17"),
		});

		await expect(
			asPaymentUser(t).action(offlineApi.startCollection, {
				asOf: AS_OF,
				planEntryId: early.planEntryId,
			})
		).rejects.toThrow(EARLY_START_REASON_ERROR);

		const result = await asPaymentUser(t).action(offlineApi.startCollection, {
			asOf: AS_OF,
			earlyStartReason: "Borrower is at the office with certified cheque",
			planEntryId: early.planEntryId,
		});
		await drainScheduledWork(t);

		expect(result).toMatchObject({
			outcome: "started",
			planEntryId: early.planEntryId,
			transferStatus: "pending",
		});
		await t.run(async (ctx) => {
			const planEntry = await ctx.db.get(early.planEntryId);
			const activity = await ctx.db
				.query("offlinePaymentActivities")
				.withIndex("by_plan_entry_created", (q) =>
					q.eq("planEntryId", early.planEntryId)
				)
				.collect();
			expect(planEntry?.scheduledDate).toBe(utcDate("2026-06-17"));
			expect(activity).toContainEqual(
				expect.objectContaining({
					action: "started",
					reason: "Borrower is at the office with certified cheque",
				})
			);
		});
	});

	it("directly confirms a due single-obligation card with exact amount and immutable evidence", async () => {
		const t = createBackendTestConvex();
		const { borrowerId, mortgageId } = await seedOfflineBase(t);
		const due = await seedOfflineEntry(t, {
			amount: 125_000,
			borrowerId,
			mortgageId,
			scheduledDate: utcDate("2026-06-12"),
		});
		await seedCollectionSettlementPrereqs(t, {
			mortgageId,
			obligationId: due.obligationId,
		});
		const attachmentId = uploadedEvidenceId("single-cash-confirmation");

		await expect(
			asPaymentUser(t).action(offlineApi.confirmCollection, {
				amount: 124_999,
				evidence: evidenceInput(attachmentId),
				instrument: { type: "cash" },
				planEntryId: due.planEntryId,
				asOf: AS_OF,
			})
		).rejects.toThrow(EXACT_REMAINING_COLLECTIBLE_AMOUNT_ERROR);

		await expect(
			asPaymentUser(t).action(offlineApi.confirmCollection, {
				amount: 125_000,
				instrument: { type: "cash" },
				planEntryId: due.planEntryId,
				asOf: AS_OF,
			})
		).rejects.toThrow(EVIDENCE_ERROR);

		const result = await asPaymentUser(t).action(offlineApi.confirmCollection, {
			amount: 125_000,
			evidence: evidenceInput(attachmentId),
			instrument: {
				receivedAt: utcDate("2026-06-15"),
				referenceNumber: "drawer-7",
				type: "cash",
			},
			planEntryId: due.planEntryId,
			asOf: AS_OF,
		});
		await drainScheduledWork(t);

		expect(result).toMatchObject({
			outcome: "confirmed",
			planEntryId: due.planEntryId,
			transferStatus: "confirmed",
		});
		await t.run(async (ctx) => {
			const evidence = await ctx.db
				.query("offlinePaymentEvidence")
				.withIndex("by_plan_entry_created", (q) =>
					q.eq("planEntryId", due.planEntryId)
				)
				.first();
			expect(evidence).toMatchObject({
				amount: 125_000,
				attachmentIds: [attachmentId],
				instrumentType: "cash",
				isImmutable: true,
			});
			const transfer = await ctx.db.get(result.transferRequestId);
			expect(transfer?.status).toBe("confirmed");
			expect(transfer?.manualSettlement?.instrumentType).toBe("cash");
			expect(transfer?.manualSettlement?.evidenceAttachmentIds).toEqual(
				expect.arrayContaining([String(evidence?._id), attachmentId])
			);
			const ledgerEntries = await ctx.db
				.query("cash_ledger_journal_entries")
				.withIndex("by_transfer_request", (q) =>
					q.eq("transferRequestId", result.transferRequestId)
				)
				.collect();
			expect(ledgerEntries).toHaveLength(1);
			expect(ledgerEntries[0]?.entryType).toBe("CASH_RECEIVED");
		});
	});

	it("confirms grouped installments in deterministic obligation order and allows only the final partial", async () => {
		const t = createBackendTestConvex();
		const { borrowerId, mortgageId } = await seedOfflineBase(t);
		const newer = await seedObligation(t, mortgageId, borrowerId, {
			amount: 60_000,
			dueDate: utcDate("2026-06-12"),
			paymentNumber: 2,
			status: "due",
		});
		const older = await seedObligation(t, mortgageId, borrowerId, {
			amount: 60_000,
			dueDate: utcDate("2026-06-01"),
			paymentNumber: 1,
			status: "due",
		});
		await seedCollectionSettlementPrereqs(t, {
			mortgageId,
			obligationId: older,
		});
		await ensureBorrowerReceivableAccount(t, {
			initialDebitBalance: 60_000n,
			obligationId: newer,
		});
		const planEntryId = await seedPlanEntry(t, {
			amount: 80_000,
			method: "manual_review",
			obligationIds: [newer, older],
			scheduledDate: utcDate("2026-06-12"),
			status: "planned",
			source: "admin_workout",
		});
		const attachmentId = uploadedEvidenceId("grouped-cheque-confirmation");

		const result = await asPaymentUser(t).action(
			offlineApi.confirmGroupedInstallment,
			{
				amount: 80_000,
				asOf: AS_OF,
				evidence: evidenceInput(attachmentId),
				instrument: {
					chequeNumber: "CHK-1007",
					receivedAt: utcDate("2026-06-15"),
					type: "cheque",
				},
				planEntryId,
			}
		);
		await drainScheduledWork(t);

		expect(result).toMatchObject({
			outcome: "confirmed",
			planEntryId,
			transferStatus: "confirmed",
		});
		await t.run(async (ctx) => {
			const olderAfter = await ctx.db.get(older);
			const newerAfter = await ctx.db.get(newer);
			const planEntry = await ctx.db.get(planEntryId);
			expect(planEntry?.obligationIds).toEqual([older, newer]);
			expect(olderAfter?.amountSettled).toBe(60_000);
			expect(olderAfter?.status).toBe("settled");
			expect(newerAfter?.amountSettled).toBe(20_000);
			expect(newerAfter?.status).toBe("partially_settled");
		});
	});

	it("assigns, notes, and releases stale manual-review attempts with lineage", async () => {
		const t = createBackendTestConvex();
		const { borrowerId, mortgageId } = await seedOfflineBase(t);
		const stale = await seedOfflineEntry(t, {
			borrowerId,
			mortgageId,
			scheduledDate: utcDate("2026-06-09"),
		});
		const started = await seedPendingOfflineAttempt(t, stale.planEntryId, {
			requestedAt: AS_OF - 26 * 60 * 60 * 1000,
		});

		await asPaymentUser(t).mutation(offlineApi.assignCollector, {
			assignedCollectorActorId: "collector-123",
			planEntryId: stale.planEntryId,
			reason: "cash desk owns this stale queue",
		});
		await asPaymentUser(t).mutation(offlineApi.addCollectionNote, {
			note: "Called borrower; cheque is ready for pickup.",
			planEntryId: stale.planEntryId,
		});
		const releaseResult = await asPaymentUser(t).mutation(
			offlineApi.releaseCollectionAttempt,
			{
				planEntryId: stale.planEntryId,
				reason: "collector shift ended before cheque pickup",
			}
		);

		expect(releaseResult).toMatchObject({
			oldPlanEntryId: stale.planEntryId,
			outcome: "released",
		});
		await t.run(async (ctx) => {
			const oldPlanEntry = await ctx.db.get(stale.planEntryId);
			const newPlanEntry = await ctx.db.get(releaseResult.newPlanEntryId);
			const attempt = await ctx.db.get(started.collectionAttemptId);
			const transfer = await ctx.db.get(started.transferRequestId);
			const activities = await ctx.db
				.query("offlinePaymentActivities")
				.withIndex("by_plan_entry_created", (q) =>
					q.eq("planEntryId", stale.planEntryId)
				)
				.collect();

			expect(oldPlanEntry?.status).toBe("cancelled");
			expect(newPlanEntry).toMatchObject({
				amount: oldPlanEntry?.amount,
				method: oldPlanEntry?.method,
				obligationIds: oldPlanEntry?.obligationIds,
				rescheduledFromId: stale.planEntryId,
				status: "planned",
			});
			expect(attempt?.status).toBe("cancelled");
			expect(transfer?.status).toBe("cancelled");
			expect(activities.map((activity) => activity.action)).toEqual(
				expect.arrayContaining(["assigned", "noted", "released"])
			);
		});
	});
});
