import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getAccountLenderId } from "../ledger/accountOwnership";
import { getAvailableBalance, getPostedBalance } from "../ledger/accounts";
import { TOTAL_SUPPLY } from "../ledger/constants";
import { issueSharesHandler } from "../ledger/mutations";
import { FAIRLEND_MIC_LENDER_EMAIL } from "../platform/defaultOriginationOwnerContract";

const PLATFORM_SALE_INVENTORY_SOURCE = "fairlend_mic_default";
const PLATFORM_SETTINGS_KEY = "default";

interface ReadCtx {
	db: Pick<QueryCtx["db"], "get" | "query">;
}

type LedgerAccountDoc = Doc<"ledger_accounts">;
type SellerKind = "fairlend_mic" | "private_lender";
type SaleInventorySource =
	| "fairlend_mic_position"
	| "fairlend_mic_treasury"
	| "private_lender_position";

export interface MortgageSaleInventoryLot {
	availableLedgerUnits: number;
	capLedgerUnits: number | null;
	lockedLedgerUnits: number;
	reservableLedgerUnits: number;
	sellerAuthId: string;
	sellerKind: SellerKind;
	source: SaleInventorySource;
}

export interface MortgageSaleInventorySummary {
	availableForSaleLedgerUnits: number;
	canonicalMicLenderAuthId: string;
	capLedgerUnits: number | null;
	capReason: string | null;
	capUpdatedAt: number | null;
	capUpdatedBy: string | null;
	hasMicPosition: boolean;
	lockedLedgerUnits: number;
	lots: MortgageSaleInventoryLot[];
	micAvailableLedgerUnits: number;
	micOwnedLedgerUnits: number;
	soldLedgerUnits: number;
	totalInvestors: number;
	totalLedgerUnits: number;
	treasuryAvailableLedgerUnits: number;
	treasuryOwnedLedgerUnits: number;
}

export interface ResolvedSellerLotForReservation {
	account: LedgerAccountDoc;
	lenderId: string;
	lot: MortgageSaleInventoryLot;
	materializedLedgerUnits: number;
}

function toSafeNumber(value: bigint, label: string): number {
	if (
		value > BigInt(Number.MAX_SAFE_INTEGER) ||
		value < BigInt(Number.MIN_SAFE_INTEGER)
	) {
		throw new ConvexError(`${label} exceeds Number safe integer range`);
	}

	return Number(value);
}

export function validateSaleInventoryLedgerUnits(units: number): number {
	if (
		!Number.isSafeInteger(units) ||
		units < 0 ||
		units > Number(TOTAL_SUPPLY)
	) {
		throw new ConvexError(
			`Available ledger units must be an integer between 0 and ${Number(TOTAL_SUPPLY)}.`
		);
	}

	return units;
}

export function canonicalMicLenderAuthIdFallback(): string {
	return `seed_${FAIRLEND_MIC_LENDER_EMAIL.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "_")}`;
}

export async function resolveCanonicalMicLenderAuthId(
	ctx: ReadCtx
): Promise<string> {
	const settings = await ctx.db
		.query("platformSettings")
		.withIndex("by_key", (q) => q.eq("key", PLATFORM_SETTINGS_KEY))
		.unique();

	if (!settings) {
		return canonicalMicLenderAuthIdFallback();
	}

	const lender = await ctx.db.get(settings.defaultOriginationLenderId);
	const user = lender ? await ctx.db.get(lender.userId) : null;
	return user?.authId ?? canonicalMicLenderAuthIdFallback();
}

async function loadMicAvailabilityOverride(
	ctx: ReadCtx,
	mortgageId: Id<"mortgages">
): Promise<Doc<"mortgageMicSaleAvailabilityOverrides"> | null> {
	return await ctx.db
		.query("mortgageMicSaleAvailabilityOverrides")
		.withIndex("by_mortgage", (q) => q.eq("mortgageId", mortgageId))
		.first();
}

async function loadPositionAccounts(ctx: ReadCtx, mortgageId: Id<"mortgages">) {
	return await ctx.db
		.query("ledger_accounts")
		.withIndex("by_type_and_mortgage", (q) =>
			q.eq("type", "POSITION").eq("mortgageId", String(mortgageId))
		)
		.collect();
}

function buildSaleInventoryLot(args: {
	availableLedgerUnits: number;
	capLedgerUnits: number | null;
	lockedLedgerUnits: number;
	sellerAuthId: string;
	sellerKind: SellerKind;
	source: SaleInventorySource;
}): MortgageSaleInventoryLot {
	return {
		availableLedgerUnits: args.availableLedgerUnits,
		capLedgerUnits: args.capLedgerUnits,
		lockedLedgerUnits: args.lockedLedgerUnits,
		reservableLedgerUnits: Math.max(
			Math.min(
				args.availableLedgerUnits,
				args.capLedgerUnits === null
					? args.availableLedgerUnits
					: args.capLedgerUnits - args.lockedLedgerUnits
			),
			0
		),
		sellerAuthId: args.sellerAuthId,
		sellerKind: args.sellerKind,
		source: args.source,
	};
}

export async function buildMortgageSaleInventorySummary(
	ctx: ReadCtx,
	mortgageId: Id<"mortgages">
): Promise<MortgageSaleInventorySummary> {
	const totalLedgerUnits = toSafeNumber(TOTAL_SUPPLY, "totalLedgerUnits");
	const canonicalMicLenderAuthId = await resolveCanonicalMicLenderAuthId(ctx);
	const [accounts, treasuryAccount, override] = await Promise.all([
		loadPositionAccounts(ctx, mortgageId),
		ctx.db
			.query("ledger_accounts")
			.withIndex("by_type_and_mortgage", (q) =>
				q.eq("type", "TREASURY").eq("mortgageId", String(mortgageId))
			)
			.first(),
		loadMicAvailabilityOverride(ctx, mortgageId),
	]);

	const positions = accounts
		.map((account) => ({
			account,
			availableBalance: getAvailableBalance(account),
			lenderId: getAccountLenderId(account),
			postedBalance: getPostedBalance(account),
		}))
		.filter(
			(
				position
			): position is {
				account: LedgerAccountDoc;
				availableBalance: bigint;
				lenderId: string;
				postedBalance: bigint;
			} => position.postedBalance > 0n && position.lenderId !== undefined
		);

	const micPositions = positions.filter(
		(position) => position.lenderId === canonicalMicLenderAuthId
	);
	const nonMicPositions = positions.filter(
		(position) => position.lenderId !== canonicalMicLenderAuthId
	);
	const micOwnedLedgerUnits = toSafeNumber(
		micPositions.reduce(
			(total, position) => total + position.postedBalance,
			0n
		),
		"micOwnedLedgerUnits"
	);
	const lockedLedgerUnits = toSafeNumber(
		micPositions.reduce(
			(total, position) => total + (position.account.pendingCredits ?? 0n),
			0n
		),
		"lockedLedgerUnits"
	);
	const micAvailableLedgerUnits = Math.max(
		toSafeNumber(
			micPositions.reduce(
				(total, position) => total + position.availableBalance,
				0n
			),
			"micAvailableLedgerUnits"
		),
		0
	);
	const treasuryOwnedLedgerUnits = treasuryAccount
		? Math.max(
				toSafeNumber(
					getPostedBalance(treasuryAccount),
					"treasuryOwnedLedgerUnits"
				),
				0
			)
		: 0;
	const treasuryAvailableLedgerUnits = treasuryAccount
		? Math.max(
				toSafeNumber(
					getAvailableBalance(treasuryAccount),
					"treasuryAvailableLedgerUnits"
				),
				0
			)
		: 0;
	const platformAvailableLedgerUnits =
		micAvailableLedgerUnits + treasuryAvailableLedgerUnits;
	const capLedgerUnits =
		override?.availableLedgerUnits === undefined
			? null
			: validateSaleInventoryLedgerUnits(override.availableLedgerUnits);
	const effectiveMicReservableLedgerUnits =
		capLedgerUnits === null
			? platformAvailableLedgerUnits
			: Math.max(
					Math.min(
						platformAvailableLedgerUnits,
						capLedgerUnits - lockedLedgerUnits
					),
					0
				);
	const soldLedgerUnits = toSafeNumber(
		nonMicPositions.reduce(
			(total, position) => total + position.postedBalance,
			0n
		),
		"soldLedgerUnits"
	);
	const micPositionReservableLedgerUnits = Math.min(
		micAvailableLedgerUnits,
		effectiveMicReservableLedgerUnits
	);
	const treasuryReservableLedgerUnits = Math.min(
		treasuryAvailableLedgerUnits,
		Math.max(
			effectiveMicReservableLedgerUnits - micPositionReservableLedgerUnits,
			0
		)
	);
	const lots = [
		buildSaleInventoryLot({
			availableLedgerUnits: micAvailableLedgerUnits,
			capLedgerUnits,
			lockedLedgerUnits,
			sellerAuthId: canonicalMicLenderAuthId,
			sellerKind: "fairlend_mic",
			source: "fairlend_mic_position",
		}),
		buildSaleInventoryLot({
			availableLedgerUnits: treasuryAvailableLedgerUnits,
			capLedgerUnits,
			lockedLedgerUnits,
			sellerAuthId: canonicalMicLenderAuthId,
			sellerKind: "fairlend_mic",
			source: "fairlend_mic_treasury",
		}),
	].map((lot) =>
		lot.source === "fairlend_mic_position"
			? { ...lot, reservableLedgerUnits: micPositionReservableLedgerUnits }
			: { ...lot, reservableLedgerUnits: treasuryReservableLedgerUnits }
	);

	return {
		availableForSaleLedgerUnits: effectiveMicReservableLedgerUnits,
		capLedgerUnits,
		capReason: override?.reason ?? null,
		capUpdatedAt: override?.updatedAt ?? null,
		capUpdatedBy: override?.updatedBy ?? null,
		canonicalMicLenderAuthId,
		hasMicPosition: micPositions.length > 0,
		lockedLedgerUnits,
		lots,
		micAvailableLedgerUnits,
		micOwnedLedgerUnits,
		soldLedgerUnits,
		totalInvestors: nonMicPositions.length,
		totalLedgerUnits,
		treasuryAvailableLedgerUnits,
		treasuryOwnedLedgerUnits,
	};
}

async function getCanonicalMicPositionAccount(
	ctx: MutationCtx,
	args: { lenderId: string; mortgageId: Id<"mortgages"> }
) {
	return await ctx.db
		.query("ledger_accounts")
		.withIndex("by_mortgage_and_lender", (q) =>
			q.eq("mortgageId", String(args.mortgageId)).eq("lenderId", args.lenderId)
		)
		.first();
}

async function materializeTreasuryUnitsForMicSale(
	ctx: MutationCtx,
	args: {
		actorAuthId: string;
		effectiveDate: string;
		idempotencyKey: string;
		lenderId: string;
		mortgageId: Id<"mortgages">;
		units: number;
	}
) {
	if (args.units <= 0) {
		return await getCanonicalMicPositionAccount(ctx, args);
	}

	const result = await issueSharesHandler(ctx, {
		amount: args.units,
		effectiveDate: args.effectiveDate,
		idempotencyKey: `${PLATFORM_SALE_INVENTORY_SOURCE}:${args.idempotencyKey}:materialize`,
		lenderId: args.lenderId,
		metadata: {
			materializedFor: "marketplace_reservation",
			sellerKind: "fairlend_mic",
			source: "treasury",
		},
		mortgageId: String(args.mortgageId),
		source: {
			actor: args.actorAuthId,
			channel: "marketplace_sale_inventory",
			type: "user",
		},
	});
	return await ctx.db.get(result.positionAccountId);
}

export async function resolveSellerLotForReservation(
	ctx: MutationCtx,
	args: {
		actorAuthId: string;
		effectiveDate: string;
		idempotencyKey: string;
		mortgageId: Id<"mortgages">;
		requestedLedgerUnits: number;
	}
): Promise<ResolvedSellerLotForReservation | null> {
	const requestedLedgerUnits = validateSaleInventoryLedgerUnits(
		args.requestedLedgerUnits
	);
	if (requestedLedgerUnits <= 0) {
		return null;
	}

	const summary = await buildMortgageSaleInventorySummary(ctx, args.mortgageId);
	if (summary.availableForSaleLedgerUnits < requestedLedgerUnits) {
		return null;
	}

	const positionLot = summary.lots.find(
		(lot) => lot.source === "fairlend_mic_position"
	);
	const treasuryLot = summary.lots.find(
		(lot) => lot.source === "fairlend_mic_treasury"
	);
	const positionAccount = await getCanonicalMicPositionAccount(ctx, {
		lenderId: summary.canonicalMicLenderAuthId,
		mortgageId: args.mortgageId,
	});
	const positionAvailable = positionAccount
		? Math.max(
				toSafeNumber(
					getAvailableBalance(positionAccount),
					"positionAvailableLedgerUnits"
				),
				0
			)
		: 0;
	const materializedLedgerUnits = Math.max(
		requestedLedgerUnits - positionAvailable,
		0
	);
	if (
		materializedLedgerUnits > 0 &&
		(!treasuryLot ||
			treasuryLot.reservableLedgerUnits < materializedLedgerUnits)
	) {
		return null;
	}

	const sellerAccount =
		materializedLedgerUnits > 0
			? await materializeTreasuryUnitsForMicSale(ctx, {
					actorAuthId: args.actorAuthId,
					effectiveDate: args.effectiveDate,
					idempotencyKey: args.idempotencyKey,
					lenderId: summary.canonicalMicLenderAuthId,
					mortgageId: args.mortgageId,
					units: materializedLedgerUnits,
				})
			: positionAccount;

	if (
		!sellerAccount ||
		getAvailableBalance(sellerAccount) < BigInt(requestedLedgerUnits)
	) {
		return null;
	}

	return {
		account: sellerAccount,
		lenderId: summary.canonicalMicLenderAuthId,
		lot:
			materializedLedgerUnits > 0 && treasuryLot
				? treasuryLot
				: (positionLot ?? {
						availableLedgerUnits: positionAvailable,
						capLedgerUnits: summary.capLedgerUnits,
						lockedLedgerUnits: summary.lockedLedgerUnits,
						reservableLedgerUnits: requestedLedgerUnits,
						sellerAuthId: summary.canonicalMicLenderAuthId,
						sellerKind: "fairlend_mic",
						source: "fairlend_mic_position",
					}),
		materializedLedgerUnits,
	};
}
