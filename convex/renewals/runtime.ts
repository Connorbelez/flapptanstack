import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getLenderByAuthId } from "../auth/actorResolution";
import {
	findPositionAccountOrNull,
	getPostedBalance,
} from "../ledger/accounts";
import { buildLenderRenewalTimeline } from "./constants";

type RenewalReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;
type RenewalWriterCtx = Pick<MutationCtx, "db">;

function safeFractionCount(balance: bigint): number {
	if (balance < 0n) {
		return 0;
	}
	if (balance > BigInt(Number.MAX_SAFE_INTEGER)) {
		throw new ConvexError(
			"Position balance exceeds the supported safe integer range for renewal intent fractions"
		);
	}
	return Number(balance);
}

export async function loadMortgageOrThrow(
	ctx: RenewalReaderCtx,
	mortgageId: Id<"mortgages">
) {
	const mortgage = await ctx.db.get(mortgageId);
	if (!mortgage) {
		throw new ConvexError("Mortgage not found");
	}
	return mortgage;
}

export async function findCurrentPositionAccount(args: {
	ctx: RenewalReaderCtx;
	lenderAuthId: string;
	mortgageId: Id<"mortgages">;
}) {
	return findPositionAccountOrNull(
		args.ctx,
		args.mortgageId,
		args.lenderAuthId
	);
}

export function getCurrentHeldFractions(
	positionAccount: Doc<"ledger_accounts"> | null
) {
	if (!positionAccount) {
		return 0;
	}

	const balance = getPostedBalance(positionAccount);
	if (balance <= 0n) {
		return 0;
	}

	return safeFractionCount(balance);
}

export async function findExistingLenderRenewalIntent(args: {
	ctx: RenewalReaderCtx;
	lenderId: Id<"lenders">;
	mortgageId: Id<"mortgages">;
}) {
	const matches = await args.ctx.db
		.query("lenderRenewalIntents")
		.withIndex("by_mortgage_and_lender", (query) =>
			query.eq("mortgageId", args.mortgageId).eq("lenderId", args.lenderId)
		)
		.collect();

	if (matches.length > 1) {
		throw new ConvexError(
			"Multiple lender renewal intents exist for the same mortgage and lender"
		);
	}

	return matches[0] ?? null;
}

export async function resolveLenderFromPositionAuthId(
	ctx: RenewalReaderCtx,
	lenderAuthId: string
) {
	return getLenderByAuthId(ctx, lenderAuthId);
}

export async function ensurePendingLenderRenewalIntent(args: {
	asOf: number;
	ctx: RenewalWriterCtx;
	currentHeldFractions: number;
	lender: Doc<"lenders">;
	mortgage: Doc<"mortgages">;
	positionAccount: Doc<"ledger_accounts">;
}) {
	const timeline = buildLenderRenewalTimeline(args.mortgage.maturityDate);
	const existing = await findExistingLenderRenewalIntent({
		ctx: args.ctx,
		lenderId: args.lender._id,
		mortgageId: args.mortgage._id,
	});
	const positionAccountId = args.positionAccount._id as string;

	if (existing) {
		if (existing.status !== "pending_signal") {
			return {
				created: false,
				intent: existing,
				updated: false,
			};
		}

		const patch: Partial<Doc<"lenderRenewalIntents">> = {};
		if (existing.brokerId !== args.mortgage.brokerOfRecordId) {
			patch.brokerId = args.mortgage.brokerOfRecordId;
		}
		if (existing.fractionCount !== args.currentHeldFractions) {
			patch.fractionCount = args.currentHeldFractions;
		}
		if (existing.positionAccountId !== positionAccountId) {
			patch.positionAccountId = positionAccountId;
		}
		if (existing.signalDeadline !== timeline.signalDeadlineAt) {
			patch.signalDeadline = timeline.signalDeadlineAt;
		}
		if (existing.maturityDate !== timeline.maturityAt) {
			patch.maturityDate = timeline.maturityAt;
		}

		if (Object.keys(patch).length > 0) {
			await args.ctx.db.patch(existing._id, patch);
			return {
				created: false,
				intent: {
					...existing,
					...patch,
				},
				updated: true,
			};
		}

		return {
			created: false,
			intent: existing,
			updated: false,
		};
	}

	const insertedId = await args.ctx.db.insert("lenderRenewalIntents", {
		status: "pending_signal",
		machineContext: {},
		mortgageId: args.mortgage._id,
		lenderId: args.lender._id,
		brokerId: args.mortgage.brokerOfRecordId,
		positionAccountId,
		fractionCount: args.currentHeldFractions,
		maturityDate: timeline.maturityAt,
		signalDeadline: timeline.signalDeadlineAt,
		createdAt: args.asOf,
	});

	const inserted = await args.ctx.db.get(insertedId);
	if (!inserted) {
		throw new ConvexError("Failed to create lender renewal intent");
	}

	return {
		created: true,
		intent: inserted,
		updated: false,
	};
}
