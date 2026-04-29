import {
	type FunctionReference,
	type FunctionType,
	makeFunctionReference,
} from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
	internalAction,
	internalMutation,
	internalQuery,
} from "../_generated/server";
import { getAccountLenderId } from "../ledger/accountOwnership";
import { unixMsToBusinessDate } from "../lib/businessDates";
import {
	addDaysToBusinessDate,
	isLenderRenewalWindowOpen,
	LENDER_RENEWAL_CREATE_WINDOW_DAYS,
} from "./constants";
import {
	ensurePendingLenderRenewalIntent,
	getCurrentHeldFractions,
	loadMortgageOrThrow,
	resolveLenderFromPositionAuthId,
} from "./runtime";

function makeInternalFunctionReference<
	Type extends FunctionType,
	Args extends Record<string, unknown>,
	ReturnType,
>(name: string) {
	return makeFunctionReference<Type, Args, ReturnType>(
		name
	) as unknown as FunctionReference<Type, "internal", Args, ReturnType>;
}

const listCreateWindowMortgagesRef = makeInternalFunctionReference<
	"query",
	{
		asOf?: number;
		continueCursor?: string | null;
		pageSize?: number;
	},
	{
		continueCursor: string | null;
		isDone: boolean;
		items: Array<{ mortgageId: Id<"mortgages"> }>;
	}
>("renewals/internal:listCreateWindowMortgages");

const syncRenewalIntentsForMortgageRef = makeInternalFunctionReference<
	"mutation",
	{ asOf?: number; mortgageId: Id<"mortgages"> },
	{ created: number; skipped: number; updated: number }
>("renewals/internal:syncRenewalIntentsForMortgage");

const listExpiredPendingIntentsRef = makeInternalFunctionReference<
	"query",
	{ asOf?: number; limit?: number },
	Array<{ intentId: Id<"lenderRenewalIntents"> }>
>("renewals/internal:listExpiredPendingIntents");

interface ListCreateWindowMortgagesPage {
	continueCursor: string | null;
	isDone: boolean;
	items: Array<{ mortgageId: Id<"mortgages"> }>;
}

export const listCreateWindowMortgages = internalQuery({
	args: {
		asOf: v.optional(v.number()),
		continueCursor: v.optional(v.union(v.string(), v.null())),
		limit: v.optional(v.number()),
		pageSize: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const asOf = args.asOf ?? Date.now();
		const businessDate = unixMsToBusinessDate(asOf);
		const maxMaturityDate = addDaysToBusinessDate(
			businessDate,
			LENDER_RENEWAL_CREATE_WINDOW_DAYS
		);
		const pageSize = args.pageSize ?? args.limit ?? 128;
		const cursor = args.continueCursor ?? null;

		const { continueCursor, isDone, page } = await ctx.db
			.query("mortgages")
			.withIndex("by_maturity", (query) =>
				query
					.gte("maturityDate", businessDate)
					.lte("maturityDate", maxMaturityDate)
			)
			.paginate({
				cursor,
				numItems: pageSize,
			});

		const items = page
			.filter((mortgage) => {
				if (mortgage.status !== "active") {
					return false;
				}

				return isLenderRenewalWindowOpen({
					asOf,
					maturityDate: mortgage.maturityDate,
				});
			})
			.map((mortgage) => ({
				mortgageId: mortgage._id,
			}));

		return {
			continueCursor: isDone ? null : continueCursor,
			isDone,
			items,
		};
	},
});

export const syncRenewalIntentsForMortgage = internalMutation({
	args: {
		asOf: v.optional(v.number()),
		mortgageId: v.id("mortgages"),
	},
	handler: async (ctx, args) => {
		const asOf = args.asOf ?? Date.now();
		const mortgage = await loadMortgageOrThrow(ctx, args.mortgageId);
		if (mortgage.status !== "active") {
			return { created: 0, skipped: 0, updated: 0 };
		}

		if (
			!isLenderRenewalWindowOpen({
				asOf,
				maturityDate: mortgage.maturityDate,
			})
		) {
			return { created: 0, skipped: 0, updated: 0 };
		}

		const positionAccounts = await ctx.db
			.query("ledger_accounts")
			.withIndex("by_type_and_mortgage", (query) =>
				query.eq("type", "POSITION").eq("mortgageId", args.mortgageId)
			)
			.collect();

		let created = 0;
		let skipped = 0;
		let updated = 0;

		for (const positionAccount of positionAccounts) {
			const lenderAuthId = getAccountLenderId(positionAccount);
			if (!lenderAuthId) {
				skipped += 1;
				continue;
			}

			const currentHeldFractions = getCurrentHeldFractions(positionAccount);
			if (currentHeldFractions <= 0) {
				skipped += 1;
				continue;
			}

			const lender = await resolveLenderFromPositionAuthId(ctx, lenderAuthId);
			if (!lender) {
				skipped += 1;
				continue;
			}

			if (lender.brokerId !== mortgage.brokerOfRecordId) {
				skipped += 1;
				continue;
			}

			const result = await ensurePendingLenderRenewalIntent({
				asOf,
				ctx,
				currentHeldFractions,
				lender,
				mortgage,
				positionAccount,
			});
			if (result.created) {
				created += 1;
			}
			if (result.updated) {
				updated += 1;
			}
		}

		return { created, skipped, updated };
	},
});

export const listExpiredPendingIntents = internalQuery({
	args: {
		asOf: v.optional(v.number()),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const asOf = args.asOf ?? Date.now();
		const intents = await ctx.db
			.query("lenderRenewalIntents")
			.withIndex("by_deadline", (query) =>
				query.eq("status", "pending_signal").lte("signalDeadline", asOf)
			)
			.take(args.limit ?? 128);

		return intents.map((intent) => ({
			intentId: intent._id,
		}));
	},
});

export const createRenewalIntentsInWindow = internalAction({
	args: {
		asOf: v.optional(v.number()),
		limit: v.optional(v.number()),
		maxMortgagesPerRun: v.optional(v.number()),
		pageSize: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const pageSize = args.pageSize ?? args.limit ?? 128;
		const maxMortgagesPerRun = args.maxMortgagesPerRun ?? 2000;
		let created = 0;
		let skipped = 0;
		let updated = 0;
		let candidatesChecked = 0;
		let dbCursor: string | null = null;

		while (candidatesChecked < maxMortgagesPerRun) {
			const batch: ListCreateWindowMortgagesPage = await ctx.runQuery(
				listCreateWindowMortgagesRef,
				{
					asOf: args.asOf,
					continueCursor: dbCursor,
					pageSize,
				}
			);

			for (const candidate of batch.items) {
				if (candidatesChecked >= maxMortgagesPerRun) {
					break;
				}
				const result = await ctx.runMutation(syncRenewalIntentsForMortgageRef, {
					asOf: args.asOf,
					mortgageId: candidate.mortgageId,
				});
				created += result.created;
				skipped += result.skipped;
				updated += result.updated;
				candidatesChecked += 1;
			}

			if (batch.isDone) {
				break;
			}

			if (candidatesChecked >= maxMortgagesPerRun) {
				break;
			}

			if (batch.continueCursor === null) {
				break;
			}

			dbCursor = batch.continueCursor;
		}

		return {
			candidatesChecked,
			created,
			skipped,
			updated,
		};
	},
});

export const expireLenderRenewalIntentsPastDeadline = internalAction({
	args: {
		asOf: v.optional(v.number()),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const expiredCandidates = await ctx.runQuery(
			listExpiredPendingIntentsRef,
			args
		);
		let expired = 0;
		let rejected = 0;

		for (const candidate of expiredCandidates) {
			const result = await ctx.runMutation(
				internal.engine.transitionMutation.transitionMutation,
				{
					entityType: "lenderRenewalIntent",
					entityId: candidate.intentId,
					eventType: "DEADLINE_PASSED",
					source: {
						actorType: "system",
						channel: "scheduler",
					},
				}
			);

			if (result.success) {
				expired += 1;
			} else {
				rejected += 1;
			}
		}

		return {
			candidatesChecked: expiredCandidates.length,
			expired,
			rejected,
		};
	},
});
