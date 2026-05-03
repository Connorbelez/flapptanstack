import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getAvailableBalance } from "../ledger/accounts";
import {
	buildMortgageSaleInventorySummary,
	resolveCanonicalMicLenderAuthId as resolveSaleInventoryCanonicalMicLenderAuthId,
	resolveSellerLotForReservation,
	canonicalMicLenderAuthIdFallback as saleInventoryCanonicalMicLenderAuthIdFallback,
	validateSaleInventoryLedgerUnits,
} from "../marketplace/saleInventory";

interface ReadCtx {
	db: Pick<QueryCtx["db"], "get" | "query">;
}
type LedgerAccountDoc = Doc<"ledger_accounts">;

export interface MortgageMicSaleAvailabilitySummary {
	availableForSaleLedgerUnits: number;
	canonicalMicLenderAuthId: string;
	capLedgerUnits: number | null;
	capReason: string | null;
	capUpdatedAt: number | null;
	capUpdatedBy: string | null;
	hasMicPosition: boolean;
	lockedLedgerUnits: number;
	micAvailableLedgerUnits: number;
	micOwnedLedgerUnits: number;
	soldLedgerUnits: number;
	totalInvestors: number;
	totalLedgerUnits: number;
	treasuryAvailableLedgerUnits: number;
	treasuryOwnedLedgerUnits: number;
}

export function canonicalMicLenderAuthIdFallback(): string {
	return saleInventoryCanonicalMicLenderAuthIdFallback();
}

export async function resolveCanonicalMicLenderAuthId(
	ctx: ReadCtx
): Promise<string> {
	return await resolveSaleInventoryCanonicalMicLenderAuthId(ctx);
}

export function validateMicSaleAvailabilityUnits(units: number): number {
	return validateSaleInventoryLedgerUnits(units);
}

export async function buildMortgageMicSaleAvailabilitySummary(
	ctx: ReadCtx,
	mortgageId: Id<"mortgages">
): Promise<MortgageMicSaleAvailabilitySummary> {
	return await buildMortgageSaleInventorySummary(ctx, mortgageId);
}

export async function getCanonicalMicSellerAccountForSale(
	ctx: MutationCtx,
	args: {
		actorAuthId?: string;
		effectiveDate?: string;
		idempotencyKey?: string;
		mortgageId: Id<"mortgages">;
		requestedLedgerUnits: number;
	}
): Promise<{ account: LedgerAccountDoc; lenderId: string } | null> {
	const requestedLedgerUnits = validateMicSaleAvailabilityUnits(
		args.requestedLedgerUnits
	);
	if (requestedLedgerUnits <= 0) {
		return null;
	}

	const seller = await resolveSellerLotForReservation(ctx, {
		actorAuthId: args.actorAuthId ?? "system",
		effectiveDate: args.effectiveDate ?? new Date().toISOString().slice(0, 10),
		idempotencyKey:
			args.idempotencyKey ??
			`mic-sale:${String(args.mortgageId)}:${String(requestedLedgerUnits)}`,
		mortgageId: args.mortgageId,
		requestedLedgerUnits,
	});

	if (
		!seller ||
		getAvailableBalance(seller.account) < BigInt(requestedLedgerUnits)
	) {
		return null;
	}

	return { account: seller.account, lenderId: seller.lenderId };
}
