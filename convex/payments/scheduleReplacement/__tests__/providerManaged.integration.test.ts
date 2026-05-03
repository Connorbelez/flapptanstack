import process from "node:process";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureSeededIdentity } from "../../../../src/test/auth/helpers";
import { FAIRLEND_ADMIN } from "../../../../src/test/auth/identities";
import {
	createGovernedTestConvex,
	seedBorrowerProfile,
	seedMortgage,
	seedObligation,
	seedPlanEntry,
} from "../../../../src/test/convex/payments/helpers";
import { api } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
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

const TRANSACTION_SCHEDULE_PATH_RE = /\/transaction_schedules\/(\d+)$/;

const testGlobal = globalThis as typeof globalThis & {
	process?: {
		env: Record<string, string | undefined>;
	};
};

type RotessaCall =
	| {
			externalScheduleRef: string;
			kind: "deleteTransactionSchedule";
	  }
	| {
			body: Record<string, unknown>;
			kind: "createTransactionSchedule";
	  };

let previousRotessaApiKey: string | undefined;

if (!testGlobal.process) {
	testGlobal.process = process as unknown as {
		env: Record<string, string | undefined>;
	};
}

function createBackendTestConvex() {
	return createGovernedTestConvex({ includeWorkflowComponents: false });
}

function jsonResponse(body: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify(body), {
		headers: { "Content-Type": "application/json" },
		status: 200,
		...init,
	});
}

function parseJsonBody(body: BodyInit | null | undefined) {
	if (typeof body !== "string") {
		return {};
	}
	const parsed: unknown = JSON.parse(body);
	return parsed && typeof parsed === "object"
		? (parsed as Record<string, unknown>)
		: {};
}

function installRotessaFetchHarness(options?: {
	createTransactionScheduleError?: Error;
	deleteTransactionScheduleError?: Error;
}) {
	const calls: RotessaCall[] = [];
	const scheduleResponse = {
		amount: "100.00",
		comment: "replacement schedule",
		created_at: "2026-01-01T00:00:00.000Z",
		financial_transactions: [],
		frequency: "Monthly",
		id: 987,
		installments: 4,
		next_process_date: "2026-02-15",
		process_date: "2026-02-15",
		updated_at: "2026-01-01T00:00:00.000Z",
	};

	const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
		const url = new URL(String(input));
		const method = init?.method ?? "GET";

		if (
			method === "POST" &&
			(url.pathname.endsWith("/transaction_schedules") ||
				url.pathname.endsWith(
					"/transaction_schedules/create_with_custom_identifier"
				))
		) {
			if (options?.createTransactionScheduleError) {
				throw options.createTransactionScheduleError;
			}
			calls.push({
				body: parseJsonBody(init?.body),
				kind: "createTransactionSchedule",
			});
			return jsonResponse(scheduleResponse);
		}

		const scheduleMatch = TRANSACTION_SCHEDULE_PATH_RE.exec(url.pathname);
		if (method === "DELETE" && scheduleMatch) {
			calls.push({
				externalScheduleRef: scheduleMatch[1],
				kind: "deleteTransactionSchedule",
			});
			if (options?.deleteTransactionScheduleError) {
				throw options.deleteTransactionScheduleError;
			}
			return new Response(null, { status: 204 });
		}

		if (method === "GET" && scheduleMatch) {
			return jsonResponse(scheduleResponse);
		}

		return new Response("not found", { status: 404 });
	});

	vi.stubGlobal("fetch", fetchMock);

	return { calls, fetchMock };
}

async function seedRotessaBankAccount(
	t: GovernedTestConvex,
	args: { borrowerId: Id<"borrowers"> }
) {
	return t.run(async (ctx) =>
		ctx.db.insert("bankAccounts", {
			accountLast4: "6789",
			country: "CA",
			currency: "CAD",
			createdAt: Date.now(),
			institutionNumber: "001",
			isDefaultInbound: true,
			mandateStatus: "active",
			metadata: {
				rotessaCustomerCustomIdentifier: "borrower-rotessa-001",
			},
			ownerId: String(args.borrowerId),
			ownerType: "borrower",
			status: "validated",
			transitNumber: "00011",
			validationMethod: "provider_verified",
		})
	);
}

async function seedDocumentAsset(t: GovernedTestConvex) {
	await ensureSeededIdentity(t, FAIRLEND_ADMIN);

	return t.run(async (ctx) => {
		const adminUser = await ctx.db
			.query("users")
			.withIndex("authId", (q) => q.eq("authId", FAIRLEND_ADMIN.subject))
			.unique();
		if (!adminUser) {
			throw new Error("expected seeded admin user");
		}

		const fileRef = await (
			ctx.storage as unknown as {
				store: (blob: Blob) => Promise<Id<"_storage">>;
			}
		).store(new Blob(["replacement pad"], { type: "application/pdf" }));

		return ctx.db.insert("documentAssets", {
			fileHash: `replacement-pad-${Date.now()}`,
			fileRef,
			fileSize: 15,
			mimeType: "application/pdf",
			name: "Replacement Rotessa PAD",
			originalFilename: "replacement-pad.pdf",
			pageCount: 1,
			source: "admin_upload",
			uploadedAt: Date.now(),
			uploadedByUserId: adminUser._id,
		});
	});
}

async function createProviderDraft(t: GovernedTestConvex) {
	const borrowerId = await seedBorrowerProfile(t);
	const mortgageId = await seedMortgage(t);
	const bankAccountId = await seedRotessaBankAccount(t, { borrowerId });

	await t.run(async (ctx) => {
		await ctx.db.patch(mortgageId, {
			collectionExecutionMode: "provider_managed",
			collectionExecutionProviderCode: "pad_rotessa",
			maturityDate: "2026-04-15",
			principal: 500_000,
		});
		await ctx.db.insert("mortgageBorrowers", {
			addedAt: Date.now(),
			borrowerId,
			mortgageId,
			role: "primary",
		});
	});

	const oldObligationId = await seedObligation(t, mortgageId, borrowerId, {
		status: "due",
	});
	await t.run(async (ctx) => {
		await ctx.db.patch(oldObligationId, {
			amount: 40_000,
			amountSettled: 0,
			dueDate: Date.UTC(2026, 1, 15),
			gracePeriodEnd: Date.UTC(2026, 1, 25),
			paymentNumber: 1,
			type: "regular_interest",
		});
	});
	const oldPlanEntryId = await seedPlanEntry(t, {
		amount: 40_000,
		executionMode: "provider_managed",
		method: "rotessa_pad",
		obligationIds: [oldObligationId],
		scheduledDate: Date.UTC(2026, 1, 15),
		status: "provider_scheduled",
	});
	const oldScheduleId = await t.run(async (ctx) =>
		ctx.db.insert("externalCollectionSchedules", {
			activationIdempotencyKey: "old-rotessa-schedule",
			activatedAt: Date.UTC(2026, 0, 1),
			bankAccountId,
			borrowerId,
			cadence: "Monthly",
			consecutiveSyncFailures: 0,
			coveredFromPlanEntryId: oldPlanEntryId,
			coveredToPlanEntryId: oldPlanEntryId,
			createdAt: Date.UTC(2026, 0, 1),
			endDate: Date.UTC(2026, 4, 15),
			externalScheduleRef: "123",
			lastProviderScheduleStatus: "active",
			lastTransitionAt: Date.UTC(2026, 0, 1),
			mortgageId,
			nextPollAt: Date.UTC(2026, 0, 1),
			providerCode: "pad_rotessa",
			source: "origination",
			startDate: Date.UTC(2026, 1, 15),
			status: "active",
		})
	);
	await t.run(async (ctx) => {
		await ctx.db.patch(mortgageId, {
			activeExternalCollectionScheduleId: oldScheduleId,
		});
		await ctx.db.patch(oldPlanEntryId, {
			externalCollectionScheduleId: oldScheduleId,
			externalOccurrenceOrdinal: 1,
		});
	});

	const padAuthorizationAssetId = await seedDocumentAsset(t);
	const draft = await t
		.withIdentity(FAIRLEND_ADMIN)
		.mutation(
			api.payments.scheduleReplacement.drafts
				.createOrUpdateScheduleReplacementDraft,
			{
				bankAccountId,
				interestPaymentAmount: 10_000,
				mortgageId,
				padAuthorizationAssetId,
				paymentFrequency: "monthly",
				replacementRail: "provider_managed_rotessa",
				startDate: Date.UTC(2026, 1, 15),
			}
		);

	return {
		bankAccountId,
		borrowerId,
		draft,
		mortgageId,
		oldObligationId,
		oldPlanEntryId,
		oldScheduleId,
		padAuthorizationAssetId,
	};
}

async function listReplacementPlanEntries(
	t: GovernedTestConvex,
	replacementBatchId: string
) {
	return t.run(async (ctx) =>
		ctx.db
			.query("collectionPlanEntries")
			.withIndex("by_replacement_batch", (q) =>
				q.eq("replacementBatchId", replacementBatchId)
			)
			.collect()
	);
}

beforeEach(() => {
	const env = testGlobal.process?.env;
	if (!env) {
		throw new Error("expected process env in test harness");
	}
	previousRotessaApiKey = env.ROTESSA_API_KEY;
	env.ROTESSA_API_KEY = "test-rotessa-key";
	vi.useFakeTimers({
		toFake: ["Date", "setTimeout", "clearTimeout"],
	});
	vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
});

afterEach(() => {
	const env = testGlobal.process?.env;
	if (env) {
		env.ROTESSA_API_KEY = previousRotessaApiKey;
	}
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe("provider-managed payment schedule replacement", () => {
	it("rejects a second provider-managed draft while another replacement is activating for the mortgage", async () => {
		const t = createBackendTestConvex();
		const harness = installRotessaFetchHarness();
		const { bankAccountId, draft, mortgageId, padAuthorizationAssetId } =
			await createProviderDraft(t);
		const secondDraft = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(
				api.payments.scheduleReplacement.drafts
					.createOrUpdateScheduleReplacementDraft,
				{
					bankAccountId,
					interestPaymentAmount: 10_000,
					mortgageId,
					padAuthorizationAssetId,
					paymentFrequency: "monthly",
					replacementRail: "provider_managed_rotessa",
					startDate: Date.UTC(2026, 1, 15),
				}
			);
		await t.run(async (ctx) => {
			await ctx.db.patch(draft.draftId, {
				replacementBatchId: `schedule-replacement:${draft.draftId}`,
				status: "activating",
			});
		});

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(applyScheduleReplacementDraftRef, {
				draftId: secondDraft.draftId,
			});

		expect(result).toMatchObject({
			outcome: "rejected",
			reasonCode: "already_activated",
		});
		expect(harness.calls).toEqual([]);
	});

	it("resumes an interrupted activating draft that has not yet created replacement rows", async () => {
		const t = createBackendTestConvex();
		const harness = installRotessaFetchHarness();
		const { draft } = await createProviderDraft(t);
		await t.run(async (ctx) => {
			await ctx.db.patch(draft.draftId, {
				replacementBatchId: `schedule-replacement:${draft.draftId}`,
				status: "activating",
			});
		});

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(applyScheduleReplacementDraftRef, {
				draftId: draft.draftId,
			});

		expect(result).toMatchObject({
			outcome: "rejected",
			reasonCode: "activation_in_progress",
		});
		expect(harness.calls).toEqual([]);
	});

	it("does not let a duplicate same-draft apply cancel a batch owned by an active lease", async () => {
		const t = createBackendTestConvex();
		const harness = installRotessaFetchHarness();
		const { draft } = await createProviderDraft(t);
		await t.run(async (ctx) => {
			await ctx.db.patch(draft.draftId, {
				activationLeaseExpiresAt: Date.now() + 15 * 60 * 1000,
				activationLeaseId: "first-activation-attempt",
				replacementBatchId: `schedule-replacement:${draft.draftId}`,
				status: "activating",
			});
		});

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(applyScheduleReplacementDraftRef, {
				draftId: draft.draftId,
			});

		expect(result).toMatchObject({
			outcome: "rejected",
			reasonCode: "activation_in_progress",
		});
		expect(harness.calls).toEqual([]);
	});

	it("resumes after old provider cancellation has been durably recorded", async () => {
		const t = createBackendTestConvex();
		const harness = installRotessaFetchHarness();
		const { draft, oldScheduleId } = await createProviderDraft(t);
		await t.run(async (ctx) => {
			await ctx.db.patch(oldScheduleId, {
				cancelledAt: Date.UTC(2026, 0, 2),
				lastProviderScheduleStatus: "cancelled",
				status: "cancelled",
			});
			await ctx.db.patch(draft.draftId, {
				archivedExternalCollectionScheduleId: oldScheduleId,
				providerCancelSucceededAt: Date.UTC(2026, 0, 2),
				replacementBatchId: `schedule-replacement:${draft.draftId}`,
				status: "activating",
			});
		});

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(applyScheduleReplacementDraftRef, {
				draftId: draft.draftId,
			});

		expect(result.outcome).toBe("activated");
		expect(harness.calls.map((call) => call.kind)).toEqual([
			"createTransactionSchedule",
		]);
	});

	it("rejects Rotessa drafts with missing customer metadata before cancelling the old schedule", async () => {
		const t = createBackendTestConvex();
		const harness = installRotessaFetchHarness();
		const {
			bankAccountId,
			draft,
			oldObligationId,
			oldPlanEntryId,
			oldScheduleId,
		} = await createProviderDraft(t);
		await t.run(async (ctx) => {
			await ctx.db.patch(bankAccountId, {
				metadata: {},
			});
		});

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(applyScheduleReplacementDraftRef, {
				draftId: draft.draftId,
			});

		expect(result).toMatchObject({
			outcome: "rejected",
			reasonCode: "provider_requirements_missing",
		});
		expect(harness.calls).toEqual([]);
		const oldPlanEntryAfter = await t.run(async (ctx) =>
			ctx.db.get(oldPlanEntryId)
		);
		const oldObligationAfter = await t.run(async (ctx) =>
			ctx.db.get(oldObligationId)
		);
		const oldScheduleAfter = await t.run(async (ctx) =>
			ctx.db.get(oldScheduleId)
		);
		expect(oldPlanEntryAfter?.status).toBe("provider_scheduled");
		expect(oldObligationAfter?.status).toBe("due");
		expect(oldScheduleAfter?.status).toBe("active");
	});

	it("cancels the old Rotessa schedule before creating interest-only provider rows and a manual principal payoff", async () => {
		const t = createBackendTestConvex();
		const harness = installRotessaFetchHarness();
		const { draft, mortgageId, oldScheduleId } = await createProviderDraft(t);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(applyScheduleReplacementDraftRef, {
				draftId: draft.draftId,
			});

		expect(result.outcome).toBe("activated");
		if (result.outcome !== "activated") {
			throw new Error("expected activated result");
		}
		expect(harness.calls.map((call) => call.kind)).toEqual([
			"deleteTransactionSchedule",
			"createTransactionSchedule",
		]);
		expect(harness.calls[0]).toMatchObject({
			externalScheduleRef: "123",
		});
		expect(harness.calls[1]).toMatchObject({
			body: {
				amount: 100,
				frequency: "Monthly",
				installments: 4,
				process_date: "2026-02-15",
			},
		});

		const oldSchedule = await t.run(async (ctx) => ctx.db.get(oldScheduleId));
		expect(oldSchedule).toMatchObject({
			status: "cancelled",
		});
		const mortgage = await t.run(async (ctx) => ctx.db.get(mortgageId));
		expect(mortgage?.activeExternalCollectionScheduleId).toBe(
			result.newExternalCollectionScheduleId
		);

		const replacementPlanEntries = await listReplacementPlanEntries(
			t,
			result.replacementBatchId
		);
		const providerEntries = replacementPlanEntries.filter(
			(entry) => entry.executionMode === "provider_managed"
		);
		const manualEntries = replacementPlanEntries.filter(
			(entry) => entry.executionMode === "app_owned"
		);
		expect(providerEntries).toHaveLength(4);
		expect(
			providerEntries.every(
				(entry) =>
					entry.status === "provider_scheduled" &&
					entry.externalCollectionScheduleId ===
						result.newExternalCollectionScheduleId
			)
		).toBe(true);
		expect(manualEntries).toHaveLength(1);
		expect(manualEntries[0]).toMatchObject({
			amount: 500_000,
			executionMode: "app_owned",
			method: "manual",
			status: "planned",
		});
	});

	it("deactivates an old live Rotessa schedule even when local sync status is not active", async () => {
		const t = createBackendTestConvex();
		const harness = installRotessaFetchHarness();
		const { draft, oldScheduleId } = await createProviderDraft(t);
		await t.run(async (ctx) => {
			await ctx.db.patch(oldScheduleId, {
				lastSyncErrorAt: Date.UTC(2026, 0, 2),
				lastSyncErrorMessage: "temporary provider sync issue",
				status: "sync_error",
			});
		});

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(applyScheduleReplacementDraftRef, {
				draftId: draft.draftId,
			});

		expect(result.outcome).toBe("activated");
		expect(harness.calls.map((call) => call.kind)).toEqual([
			"deleteTransactionSchedule",
			"createTransactionSchedule",
		]);
		expect(harness.calls[0]).toMatchObject({
			externalScheduleRef: "123",
		});

		const oldSchedule = await t.run(async (ctx) => ctx.db.get(oldScheduleId));
		expect(oldSchedule).toMatchObject({
			lastProviderScheduleStatus: "cancelled",
			status: "cancelled",
		});
	});

	it("leaves local production rows untouched and the draft retryable when old provider cancellation fails", async () => {
		const t = createBackendTestConvex();
		const harness = installRotessaFetchHarness({
			deleteTransactionScheduleError: new Error("Rotessa delete failed"),
		});
		const { draft, oldObligationId, oldPlanEntryId, oldScheduleId } =
			await createProviderDraft(t);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(applyScheduleReplacementDraftRef, {
				draftId: draft.draftId,
			});

		expect(result).toMatchObject({
			outcome: "rejected",
			reasonCode: "old_provider_cancel_failed",
		});
		expect(harness.calls.map((call) => call.kind)).toEqual([
			"deleteTransactionSchedule",
		]);
		const oldPlanEntryAfter = await t.run(async (ctx) =>
			ctx.db.get(oldPlanEntryId)
		);
		const oldObligationAfter = await t.run(async (ctx) =>
			ctx.db.get(oldObligationId)
		);
		const oldScheduleAfter = await t.run(async (ctx) =>
			ctx.db.get(oldScheduleId)
		);
		const storedDraft = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(
				api.payments.scheduleReplacement.drafts.getScheduleReplacementDraft,
				{
					draftId: draft.draftId,
				}
			);
		expect(oldPlanEntryAfter?.status).toBe("provider_scheduled");
		expect(oldPlanEntryAfter?.archivedAt).toBeUndefined();
		expect(oldObligationAfter?.status).toBe("due");
		expect(oldObligationAfter?.archivedAt).toBeUndefined();
		expect(oldScheduleAfter?.status).toBe("active");
		expect(storedDraft?.status).toBe("ready");
	});

	it("records activation_failed and leaves old local rows non-executable when new provider creation fails", async () => {
		const t = createBackendTestConvex();
		installRotessaFetchHarness({
			createTransactionScheduleError: new Error("Rotessa create failed"),
		});
		const { draft, oldObligationId, oldPlanEntryId, oldScheduleId } =
			await createProviderDraft(t);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(applyScheduleReplacementDraftRef, {
				draftId: draft.draftId,
			});

		expect(result).toMatchObject({
			outcome: "rejected",
			reasonCode: "new_provider_create_failed",
		});
		const oldSchedule = await t.run(async (ctx) => ctx.db.get(oldScheduleId));
		const oldPlanEntry = await t.run(async (ctx) => ctx.db.get(oldPlanEntryId));
		const oldObligation = await t.run(async (ctx) =>
			ctx.db.get(oldObligationId)
		);
		expect(oldSchedule?.status).toBe("cancelled");
		expect(oldPlanEntry?.status).toBe("cancelled");
		expect(oldPlanEntry?.archivedAt).toBeTypeOf("number");
		expect(oldObligation?.status).toBe("cancelled");
		expect(oldObligation?.archivedAt).toBeTypeOf("number");

		const storedDraft = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(
				api.payments.scheduleReplacement.drafts.getScheduleReplacementDraft,
				{
					draftId: draft.draftId,
				}
			);
		expect(storedDraft?.status).toBe("activation_failed");
		expect(storedDraft?.lastError).toContain("Rotessa create failed");
	});

	it("retries an activation_failed provider draft without duplicating local replacement rows", async () => {
		const t = createBackendTestConvex();
		installRotessaFetchHarness({
			createTransactionScheduleError: new Error("Rotessa create failed"),
		});
		const { draft } = await createProviderDraft(t);

		const failedResult = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(applyScheduleReplacementDraftRef, {
				draftId: draft.draftId,
			});
		expect(failedResult).toMatchObject({
			outcome: "rejected",
			reasonCode: "new_provider_create_failed",
		});
		const replacementBatchId = `schedule-replacement:${draft.draftId}`;
		const rowsAfterFailure = await listReplacementPlanEntries(
			t,
			replacementBatchId
		);
		expect(rowsAfterFailure).toHaveLength(5);
		expect(
			rowsAfterFailure.every((entry) => entry.status === "cancelled")
		).toBe(true);

		const retryHarness = installRotessaFetchHarness();
		const retryResult = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(applyScheduleReplacementDraftRef, {
				draftId: draft.draftId,
			});

		expect(retryResult).toMatchObject({
			outcome: "activated",
			replacementBatchId,
		});
		expect(retryHarness.calls.map((call) => call.kind)).toEqual([
			"createTransactionSchedule",
		]);
		const rowsAfterRetry = await listReplacementPlanEntries(
			t,
			replacementBatchId
		);
		expect(rowsAfterRetry).toHaveLength(5);
		expect(
			rowsAfterRetry.filter((entry) => entry.status === "cancelled")
		).toEqual([]);
	});

	it("cancels an active Rotessa schedule before applying a manual replacement", async () => {
		const t = createBackendTestConvex();
		const harness = installRotessaFetchHarness();
		const { mortgageId, oldScheduleId } = await createProviderDraft(t);
		const manualDraft = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(
				api.payments.scheduleReplacement.drafts
					.createOrUpdateScheduleReplacementDraft,
				{
					interestPaymentAmount: 10_000,
					mortgageId,
					paymentFrequency: "monthly",
					replacementRail: "app_managed_manual",
					startDate: Date.UTC(2026, 1, 15),
				}
			);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.action(applyScheduleReplacementDraftRef, {
				draftId: manualDraft.draftId,
			});

		expect(result).toMatchObject({
			outcome: "activated",
			replacementBatchId: `schedule-replacement:${manualDraft.draftId}`,
		});
		expect(harness.calls).toEqual([
			{
				externalScheduleRef: "123",
				kind: "deleteTransactionSchedule",
			},
		]);
		const oldSchedule = await t.run(async (ctx) => ctx.db.get(oldScheduleId));
		const mortgage = await t.run(async (ctx) => ctx.db.get(mortgageId));
		expect(oldSchedule).toMatchObject({ status: "cancelled" });
		expect(mortgage?.activeExternalCollectionScheduleId).toBeUndefined();
		expect(mortgage?.collectionExecutionMode).toBe("app_owned");
		expect(mortgage?.collectionExecutionProviderCode).toBeUndefined();
	});
});
