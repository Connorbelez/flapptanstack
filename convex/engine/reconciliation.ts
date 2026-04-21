import type { FunctionReference, FunctionType } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { components } from "../_generated/api";
import { internalQuery } from "../_generated/server";
import { AuditTrail } from "../auditTrailClient";
import { adminAction } from "../fluent";

const auditTrail = new AuditTrail(components.auditTrail);
const RECONCILIATION_PAGE_SIZE = 128;

interface Discrepancy {
	entityId: string;
	entityStatus: string;
	entityType: string;
	journalEntryId: string;
	journalNewState: string;
}

interface StatusReconciliationResult {
	checkedAt: number;
	discrepancies: Discrepancy[];
	isHealthy: boolean;
}

interface ChainVerification {
	brokenAt?: number;
	entityId: string;
	error?: string;
	eventCount?: number;
	valid: boolean;
}

interface Layer2ReconciliationResult {
	brokenChains: ChainVerification[];
	checkedAt: number;
	isHealthy: boolean;
	totalEntities: number;
	verifications: ChainVerification[];
}

interface AuditJournalEntityIdPageResult {
	continueCursor: string;
	entityIds: string[];
	isDone: boolean;
}

function makeInternalFunctionReference<
	Type extends FunctionType,
	Args extends Record<string, unknown>,
	ReturnType,
>(name: string) {
	return makeFunctionReference<Type, Args, ReturnType>(
		name
	) as unknown as FunctionReference<Type, "internal", Args, ReturnType>;
}

const runStatusReconciliationRef = makeInternalFunctionReference<
	"action",
	Record<string, never>,
	StatusReconciliationResult
>("engine/reconciliationAction:runStatusReconciliation");

const listAuditJournalEntityIdsPageRef = makeInternalFunctionReference<
	"query",
	{
		cursor?: string | null;
	},
	AuditJournalEntityIdPageResult
>("engine/reconciliation:listAuditJournalEntityIdsPage");

function buildMissingChainVerification(entityId: string): ChainVerification {
	return {
		entityId,
		valid: false,
		eventCount: 0,
		error: "No Layer 2 entries found for entity with journal records",
	};
}

function normalizeChainVerification(
	entityId: string,
	result: unknown
): ChainVerification {
	if (!result || typeof result !== "object") {
		return buildMissingChainVerification(entityId);
	}

	const rawResult = result as {
		brokenAt?: unknown;
		error?: unknown;
		eventCount?: unknown;
		valid?: unknown;
	};
	if (typeof rawResult.valid !== "boolean") {
		return buildMissingChainVerification(entityId);
	}

	const eventCount =
		typeof rawResult.eventCount === "number" ? rawResult.eventCount : undefined;
	if (eventCount === 0) {
		return buildMissingChainVerification(entityId);
	}

	return {
		entityId,
		valid: rawResult.valid,
		eventCount,
		error: typeof rawResult.error === "string" ? rawResult.error : undefined,
		brokenAt:
			typeof rawResult.brokenAt === "number" ? rawResult.brokenAt : undefined,
	};
}

export const listAuditJournalEntityIdsPage = internalQuery({
	args: {
		cursor: v.optional(v.union(v.string(), v.null())),
	},
	handler: async (ctx, args): Promise<AuditJournalEntityIdPageResult> => {
		const result = await ctx.db.query("auditJournal").paginate({
			cursor: args.cursor ?? null,
			numItems: RECONCILIATION_PAGE_SIZE,
		});

		return {
			continueCursor: result.continueCursor,
			entityIds: result.page.map((entry) => entry.entityId),
			isDone: result.isDone,
		};
	},
});

/**
 * Layer 1 reconciliation: verifies each governed entity's current status
 * matches the newState of its most recent "transitioned" journal entry.
 *
 * Any discrepancy means something changed status outside the transition engine.
 */
export const reconcile = adminAction
	.input({})
	.handler(async (ctx) => {
		return ctx.runAction(runStatusReconciliationRef, {});
	})
	.public();

/**
 * Layer 2 reconciliation: verifies the SHA-256 hash chain integrity in the
 * auditTrail component for every entity that has journal entries.
 *
 * A broken chain means a Layer 2 entry was tampered with or is missing.
 */
export const reconcileLayer2 = adminAction
	.input({})
	.handler(async (ctx): Promise<Layer2ReconciliationResult> => {
		const uniqueEntityIds = new Set<string>();
		let cursor: string | null = null;

		while (true) {
			const pageResult: AuditJournalEntityIdPageResult = await ctx.runQuery(
				listAuditJournalEntityIdsPageRef,
				{ cursor }
			);

			for (const entityId of pageResult.entityIds) {
				uniqueEntityIds.add(entityId);
			}

			if (pageResult.isDone) {
				break;
			}

			cursor = pageResult.continueCursor;
		}

		const verifications: ChainVerification[] = [];
		for (const entityId of uniqueEntityIds) {
			const result = await auditTrail.verifyChain(ctx, { entityId });
			verifications.push(normalizeChainVerification(entityId, result));
		}

		const brokenChains = verifications.filter(
			(verification) => !verification.valid
		);

		return {
			checkedAt: Date.now(),
			totalEntities: verifications.length,
			verifications,
			brokenChains,
			isHealthy: brokenChains.length === 0,
		};
	})
	.public();
