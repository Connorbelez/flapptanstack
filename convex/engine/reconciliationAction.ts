import type { FunctionReference, FunctionType } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
	internalAction,
	internalMutation,
	internalQuery,
} from "../_generated/server";
import { auditLog } from "../auditLog";
import type { ReplayResult } from "../payments/cashLedger/replayIntegrity";
import { ENTITY_TABLE_MAP } from "./types";

const RECONCILIATION_PAGE_SIZE = 128;

interface LatestJournalEntry {
	_id: string;
	newState: string;
}

interface Discrepancy {
	entityId: string;
	entityStatus: string;
	entityType: string;
	journalEntryId: string;
	journalNewState: string;
}

interface ReconciliationResult {
	checkedAt: number;
	discrepancies: Discrepancy[];
	isHealthy: boolean;
}

interface AuditJournalPageEntry {
	_id: string;
	entityId: string;
	newState: string;
	outcome: string;
}

interface AuditJournalPageResult {
	continueCursor: string | null;
	isDone: boolean;
	page: AuditJournalPageEntry[];
}

interface EntityStatusLookupResult {
	entityId: string;
	status: string | null;
	supported: boolean;
}

type ReconciliationCtx = Pick<QueryCtx, "db">;

function makeInternalFunctionReference<
	Type extends FunctionType,
	Args extends Record<string, unknown>,
	ReturnType,
>(name: string) {
	return makeFunctionReference<Type, Args, ReturnType>(
		name
	) as unknown as FunctionReference<Type, "internal", Args, ReturnType>;
}

const reconcileInternalRef = makeInternalFunctionReference<
	"action",
	Record<string, never>,
	ReconciliationResult
>("engine/reconciliationAction:runStatusReconciliation");

const listAuditJournalPageByEntityTypeRef = makeInternalFunctionReference<
	"query",
	{
		cursor?: string | null;
		entityType: string;
	},
	AuditJournalPageResult
>("engine/reconciliationAction:listAuditJournalPageByEntityType");

const lookupEntityStatusesRef = makeInternalFunctionReference<
	"query",
	{
		entityIds: string[];
		entityType: string;
	},
	EntityStatusLookupResult[]
>("engine/reconciliationAction:lookupEntityStatuses");

const logReconciliationDiscrepanciesRef = makeInternalFunctionReference<
	"mutation",
	{
		checkedAt: number;
		discrepancies: Discrepancy[];
		discrepancyCount: number;
	},
	null
>("engine/reconciliationAction:logReconciliationDiscrepancies");

// ── Replay Integrity Refs ────────────────────────────────────

const runReplayIntegrityCheckRef = makeInternalFunctionReference<
	"query",
	Record<string, never>,
	ReplayResult
>("payments/cashLedger/reconciliation:runReplayIntegrityCheck");

const advanceReplayCursorRef = makeInternalFunctionReference<
	"mutation",
	{ lastProcessedSequence: bigint },
	null
>("payments/cashLedger/replayIntegrity:advanceReplayCursor");

async function lookupStatuses(
	ctx: ReconciliationCtx,
	entityType: string,
	entityIds: string[]
): Promise<EntityStatusLookupResult[]> {
	const results: EntityStatusLookupResult[] = [];

	for (const entityId of entityIds) {
		const status = await lookupStatus(ctx, entityType, entityId);
		results.push({
			entityId,
			status: status ?? null,
			supported: status !== undefined,
		});
	}

	return results;
}

async function lookupStatus(
	ctx: ReconciliationCtx,
	entityType: string,
	entityId: string
): Promise<string | null | undefined> {
	// Table-driven lookup: entityType → typed getter.
	// biome-ignore: cognitive complexity is 28 because each entity type requires
	// a separate db.get call — this is unavoidable for a data-access function
	// that must handle 14 distinct entity table types.
	switch (entityType) {
		case "brokerOnboardingApplication":
			return (
				(await ctx.db.get(entityId as Id<"brokerOnboardingApplications">))
					?.status ?? null
			);
		case "onboardingRequest":
			return (
				(await ctx.db.get(entityId as Id<"onboardingRequests">))?.status ?? null
			);
		case "mortgage":
			return (await ctx.db.get(entityId as Id<"mortgages">))?.status ?? null;
		case "obligation":
			return (await ctx.db.get(entityId as Id<"obligations">))?.status ?? null;
		case "collectionAttempt":
			return (
				(await ctx.db.get(entityId as Id<"collectionAttempts">))?.status ?? null
			);
		// Non-governed entity types: tables exist in schema but have no
		// machine definitions. Skip to avoid false discrepancies.
		case "deal":
		case "provisionalApplication":
		case "applicationPackage":
		case "broker":
		case "borrower":
		case "lenderOnboarding":
		case "provisionalOffer":
		case "offerCondition":
		case "lenderRenewalIntent":
		case "dispersalEntry":
			return undefined;
		case "lender":
			return (await ctx.db.get(entityId as Id<"lenders">))?.status ?? null;
		default: {
			// Log error for any entity type not yet covered — this prevents silent skipping
			console.error(
				`[RECONCILIATION] lookupStatus: unhandled entity type "${entityType}" for entity ${entityId}. This entity will NOT be reconciled.`
			);
			return undefined;
		}
	}
}

function buildDiscrepancy(
	entityType: string,
	entityId: string,
	entityStatus: string | null,
	journal: LatestJournalEntry
): Discrepancy | null {
	if (entityStatus === null) {
		return {
			entityType,
			entityId,
			entityStatus: "ENTITY_NOT_FOUND",
			journalNewState: journal.newState,
			journalEntryId: journal._id,
		};
	}
	if (entityStatus !== journal.newState) {
		return {
			entityType,
			entityId,
			entityStatus,
			journalNewState: journal.newState,
			journalEntryId: journal._id,
		};
	}
	return null;
}

export const listAuditJournalPageByEntityType = internalQuery({
	args: {
		cursor: v.optional(v.union(v.string(), v.null())),
		entityType: v.string(),
	},
	handler: async (ctx, args): Promise<AuditJournalPageResult> => {
		const result = await ctx.db
			.query("auditJournal")
			.withIndex("by_type_and_time", (q) =>
				q.eq("entityType", args.entityType as Doc<"auditJournal">["entityType"])
			)
			.order("desc")
			.paginate({
				cursor: args.cursor ?? null,
				numItems: RECONCILIATION_PAGE_SIZE,
			});

		return {
			continueCursor: result.continueCursor,
			isDone: result.isDone,
			page: result.page.map((entry) => ({
				_id: entry._id,
				entityId: entry.entityId,
				newState: entry.newState,
				outcome: entry.outcome,
			})),
		};
	},
});

export const lookupEntityStatuses = internalQuery({
	args: {
		entityIds: v.array(v.string()),
		entityType: v.string(),
	},
	handler: async (ctx, args) => {
		return lookupStatuses(ctx, args.entityType, args.entityIds);
	},
});

/**
 * Internal action for status reconciliation — no auth required.
 * Called by the daily cron and the admin action wrapper.
 */
export const runStatusReconciliation = internalAction({
	handler: async (ctx) => {
		const discrepancies: Discrepancy[] = [];
		const entityTypes = Object.keys(ENTITY_TABLE_MAP) as Array<
			keyof typeof ENTITY_TABLE_MAP
		>;

		for (const entityType of entityTypes) {
			const seenEntityIds = new Set<string>();
			let cursor: string | null = null;

			while (true) {
				const pageResult: AuditJournalPageResult = await ctx.runQuery(
					listAuditJournalPageByEntityTypeRef,
					{
						cursor,
						entityType,
					}
				);

				const latestEntries: Array<{
					entityId: string;
					journal: LatestJournalEntry;
				}> = [];

				for (const entry of pageResult.page) {
					if (
						entry.outcome !== "transitioned" ||
						seenEntityIds.has(entry.entityId)
					) {
						continue;
					}

					seenEntityIds.add(entry.entityId);
					latestEntries.push({
						entityId: entry.entityId,
						journal: {
							_id: entry._id,
							newState: entry.newState,
						},
					});
				}

				if (latestEntries.length > 0) {
					const statuses = await ctx.runQuery(lookupEntityStatusesRef, {
						entityIds: latestEntries.map(({ entityId }) => entityId),
						entityType,
					});
					const statusByEntityId = new Map(
						statuses.map((status) => [status.entityId, status])
					);

					for (const { entityId, journal } of latestEntries) {
						const statusResult = statusByEntityId.get(entityId);
						if (!statusResult?.supported) {
							continue;
						}

						const d = buildDiscrepancy(
							entityType,
							entityId,
							statusResult.status,
							journal
						);
						if (d) {
							discrepancies.push(d);
						}
					}
				}

				if (pageResult.isDone) {
					break;
				}

				cursor = pageResult.continueCursor;
			}
		}

		return {
			checkedAt: Date.now(),
			discrepancies,
			isHealthy: discrepancies.length === 0,
		};
	},
});

/**
 * Internal mutation to persist reconciliation discrepancies through the audit pipeline.
 * Actions cannot call auditLog.log() directly (it requires MutationCtx),
 * so dailyReconciliation schedules this mutation via ctx.runMutation.
 */
export const logReconciliationDiscrepancies = internalMutation({
	args: {
		discrepancyCount: v.number(),
		discrepancies: v.array(
			v.object({
				entityId: v.string(),
				entityStatus: v.string(),
				entityType: v.string(),
				journalEntryId: v.string(),
				journalNewState: v.string(),
			})
		),
		checkedAt: v.number(),
	},
	handler: async (ctx, args) => {
		await auditLog.log(ctx, {
			action: "reconciliation.discrepancies_found",
			actorId: "system",
			resourceType: "reconciliation",
			resourceId: "daily-check",
			severity: "error",
			metadata: {
				checkedAt: args.checkedAt,
				discrepancyCount: args.discrepancyCount,
				discrepancies: args.discrepancies,
			},
		});
	},
});

/**
 * Daily reconciliation cron action.
 * Layer 1 (StatusCheck): state-machine status must match latest audit journal entry.
 * Layer 2 (BalanceCheck): replayed journal entry totals must match stored account balances.
 * Each layer runs independently — a failure in one does not prevent the other from running.
 */
export const dailyReconciliation = internalAction({
	handler: async (ctx) => {
		// ── Layer 1: StatusCheck (status vs journal) ────────────────
		let layer1Result: {
			isHealthy: boolean;
			checkedAt: number;
			discrepancies: Discrepancy[];
		} | null = null;
		try {
			layer1Result = await ctx.runAction(reconcileInternalRef, {});

			if (layer1Result.isHealthy) {
				console.info(
					"[RECONCILIATION] StatusCheck passed — zero discrepancies."
				);
			} else {
				console.error(
					`[RECONCILIATION P0] ${layer1Result.discrepancies.length} discrepancies found:`,
					JSON.stringify(layer1Result.discrepancies, null, 2)
				);

				await ctx.runMutation(logReconciliationDiscrepanciesRef, {
					discrepancyCount: layer1Result.discrepancies.length,
					discrepancies: layer1Result.discrepancies,
					checkedAt: layer1Result.checkedAt,
				});
			}
		} catch (error) {
			console.error(
				"[RECONCILIATION FATAL] StatusCheck failed entirely:",
				error instanceof Error ? error.message : String(error)
			);
			// Continue to Layer 2 so partial checks still run
		}

		// ── Layer 2: BalanceCheck (journal replay integrity) ───────
		try {
			const replayResult = await ctx.runQuery(runReplayIntegrityCheckRef, {});

			if (replayResult.passed) {
				console.info(
					`[REPLAY INTEGRITY] BalanceCheck passed — ${replayResult.entriesReplayed} entries replayed, ` +
						`${replayResult.accountsChecked} accounts checked in ${replayResult.durationMs}ms.`
				);

				// Advance cursor so next incremental run starts from here
				if (replayResult.toSequence !== "0") {
					await ctx.runMutation(advanceReplayCursorRef, {
						lastProcessedSequence: BigInt(replayResult.toSequence),
					});
				}
			} else {
				console.error(
					`[REPLAY INTEGRITY P0] ${replayResult.mismatches.length} mismatches, ` +
						`${replayResult.missingSequences.length} missing sequences found:`,
					JSON.stringify(replayResult, null, 2)
				);

				const discrepancies: Discrepancy[] = replayResult.mismatches.map(
					(m) => ({
						entityType: "cash_ledger_account",
						entityId: m.accountId,
						entityStatus: `debits=${m.storedDebits},credits=${m.storedCredits}`,
						journalNewState: `debits=${m.expectedDebits},credits=${m.expectedCredits}`,
						journalEntryId: `seq:${m.firstDivergenceSequence}-${m.lastEntrySequence}`,
					})
				);

				// Gap-only failures persist an empty discrepancy list with a non-zero count
				// without this entry — build a proper Discrepancy for missing sequences
				for (const seq of replayResult.missingSequences) {
					discrepancies.push({
						entityType: "cash_ledger_sequence_gap",
						entityId: "gap",
						entityStatus: "SEQUENCE_MISSING",
						journalNewState: seq.toString(),
						journalEntryId: "gap",
					});
				}

				await ctx.runMutation(logReconciliationDiscrepanciesRef, {
					discrepancyCount: discrepancies.length,
					discrepancies,
					checkedAt: Date.now(),
				});
			}
		} catch (error) {
			console.error(
				"[REPLAY INTEGRITY FATAL] BalanceCheck failed entirely:",
				error instanceof Error ? error.message : String(error)
			);
		}

		return layer1Result;
	},
});
