import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getOrCreatePositionAccount, getPositionAccount } from "./accounts";
import { postEntry } from "./postEntry";
import type { EventSource } from "./types";

export interface ReserveSharesHandlerArgs {
	amount: number;
	buyerLenderId: string;
	dealId?: string;
	effectiveDate: string;
	idempotencyKey: string;
	metadata?: unknown;
	mortgageId: string;
	sellerLenderId: string;
	source: EventSource;
}

export interface ReserveSharesHandlerResult {
	journalEntry: Doc<"ledger_journal_entries"> & {
		reservationId?: Id<"ledger_reservations">;
	};
	reservationId: Id<"ledger_reservations">;
}

export async function reserveSharesHandler(
	ctx: MutationCtx,
	args: ReserveSharesHandlerArgs
): Promise<ReserveSharesHandlerResult> {
	const existingEntry = await ctx.db
		.query("ledger_journal_entries")
		.withIndex("by_idempotency", (q) =>
			q.eq("idempotencyKey", args.idempotencyKey)
		)
		.first();
	if (existingEntry) {
		if (existingEntry.entryType !== "SHARES_RESERVED") {
			throw new ConvexError({
				code: "IDEMPOTENT_REPLAY_FAILED" as const,
				message: `Idempotent reserveShares replay: existing entry ${existingEntry._id} has entryType ${existingEntry.entryType}, expected SHARES_RESERVED`,
			});
		}
		if (!existingEntry.reservationId) {
			throw new ConvexError({
				code: "IDEMPOTENT_REPLAY_FAILED" as const,
				message: `Idempotent reserveShares replay: existing entry ${existingEntry._id} lacks reservation linkage`,
			});
		}
		const reservation = await ctx.db.get(existingEntry.reservationId);
		if (!reservation) {
			throw new ConvexError({
				code: "IDEMPOTENT_REPLAY_FAILED" as const,
				message: `Idempotent reserveShares replay: reservation ${existingEntry.reservationId} missing`,
			});
		}
		return {
			reservationId: reservation._id,
			journalEntry: existingEntry,
		};
	}

	const sellerPosition = await getPositionAccount(
		ctx,
		args.mortgageId,
		args.sellerLenderId
	);
	const buyerPosition = await getOrCreatePositionAccount(
		ctx,
		args.mortgageId,
		args.buyerLenderId
	);

	const journalEntry = await postEntry(ctx, {
		entryType: "SHARES_RESERVED",
		mortgageId: args.mortgageId,
		debitAccountId: buyerPosition._id,
		creditAccountId: sellerPosition._id,
		amount: args.amount,
		effectiveDate: args.effectiveDate,
		idempotencyKey: args.idempotencyKey,
		source: args.source,
		metadata:
			args.metadata === undefined
				? undefined
				: (args.metadata as Record<string, unknown>),
	});

	const amountDelta = BigInt(args.amount);
	await ctx.db.patch(sellerPosition._id, {
		pendingCredits: (sellerPosition.pendingCredits ?? 0n) + amountDelta,
	});
	await ctx.db.patch(buyerPosition._id, {
		pendingDebits: (buyerPosition.pendingDebits ?? 0n) + amountDelta,
	});

	const reservationId = await ctx.db.insert("ledger_reservations", {
		mortgageId: args.mortgageId,
		sellerAccountId: sellerPosition._id,
		buyerAccountId: buyerPosition._id,
		amount: args.amount,
		status: "pending",
		dealId: args.dealId,
		reserveJournalEntryId: journalEntry._id,
		createdAt: Date.now(),
	});

	await ctx.db.patch(journalEntry._id, { reservationId });

	return {
		reservationId,
		journalEntry: { ...journalEntry, reservationId },
	};
}

export interface VoidReservationHandlerArgs {
	effectiveDate: string;
	idempotencyKey: string;
	reason: string;
	reservationId: Id<"ledger_reservations">;
	source: EventSource;
}

export async function voidReservationHandler(
	ctx: MutationCtx,
	args: VoidReservationHandlerArgs
): Promise<{ journalEntry: Doc<"ledger_journal_entries"> }> {
	const existingEntry = await ctx.db
		.query("ledger_journal_entries")
		.withIndex("by_idempotency", (q) =>
			q.eq("idempotencyKey", args.idempotencyKey)
		)
		.first();
	if (existingEntry) {
		if (existingEntry.entryType !== "SHARES_VOIDED") {
			throw new ConvexError({
				code: "IDEMPOTENT_REPLAY_FAILED" as const,
				message: `Idempotent voidReservation replay: existing entry ${existingEntry._id} has entryType ${existingEntry.entryType}, expected SHARES_VOIDED`,
			});
		}
		if (existingEntry.reservationId !== args.reservationId) {
			throw new ConvexError({
				code: "IDEMPOTENT_REPLAY_FAILED" as const,
				message: `Idempotent voidReservation replay: existing entry ${existingEntry._id} has reservationId ${existingEntry.reservationId}, expected ${args.reservationId}`,
			});
		}
		return { journalEntry: existingEntry };
	}

	const reservation = await ctx.db.get(args.reservationId);
	if (!reservation) {
		throw new ConvexError({
			code: "RESERVATION_NOT_FOUND" as const,
			message: `Reservation ${args.reservationId} does not exist`,
		});
	}
	if (reservation.status !== "pending") {
		throw new ConvexError({
			code: "RESERVATION_NOT_PENDING" as const,
			message: `Reservation ${args.reservationId} is ${reservation.status}, expected pending`,
		});
	}

	const sellerAccount = await ctx.db.get(reservation.sellerAccountId);
	const buyerAccount = await ctx.db.get(reservation.buyerAccountId);
	if (!(sellerAccount && buyerAccount)) {
		throw new ConvexError({
			code: "ACCOUNT_NOT_FOUND" as const,
			message: "Seller or buyer account from reservation not found",
		});
	}

	const amountDelta = BigInt(reservation.amount);
	await ctx.db.patch(reservation.sellerAccountId, {
		pendingCredits: (sellerAccount.pendingCredits ?? 0n) - amountDelta,
	});
	await ctx.db.patch(reservation.buyerAccountId, {
		pendingDebits: (buyerAccount.pendingDebits ?? 0n) - amountDelta,
	});

	const journalEntry = await postEntry(ctx, {
		entryType: "SHARES_VOIDED",
		mortgageId: reservation.mortgageId,
		debitAccountId: reservation.sellerAccountId,
		creditAccountId: reservation.buyerAccountId,
		amount: reservation.amount,
		effectiveDate: args.effectiveDate,
		idempotencyKey: args.idempotencyKey,
		source: args.source,
		reason: args.reason,
		reservationId: reservation._id,
	});

	await ctx.db.patch(reservation._id, {
		status: "voided",
		voidJournalEntryId: journalEntry._id,
		resolvedAt: Date.now(),
	});

	return { journalEntry };
}
