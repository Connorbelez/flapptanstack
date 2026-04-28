import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getAccountLenderId } from "../ledger/accountOwnership";
import { getAvailableBalance, getPostedBalance } from "../ledger/accounts";
import { TOTAL_SUPPLY } from "../ledger/constants";
import { FAIRLEND_MIC_LENDER_EMAIL } from "../platform/defaultOriginationOwnerContract";

const PLATFORM_SETTINGS_KEY = "default";

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
}

export function canonicalMicLenderAuthIdFallback(): string {
	return `seed_${FAIRLEND_MIC_LENDER_EMAIL.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "_")}`;
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

export function validateMicSaleAvailabilityUnits(units: number): number {
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

async function loadOverride(
	ctx: ReadCtx,
	mortgageId: Id<"mortgages">
): Promise<Doc<"mortgageMicSaleAvailabilityOverrides"> | null> {
	return await ctx.db
		.query("mortgageMicSaleAvailabilityOverrides")
		.withIndex("by_mortgage", (q) => q.eq("mortgageId", mortgageId))
		.first();
}

export async function buildMortgageMicSaleAvailabilitySummary(
	ctx: ReadCtx,
	mortgageId: Id<"mortgages">
): Promise<MortgageMicSaleAvailabilitySummary> {
	const totalLedgerUnits = toSafeNumber(TOTAL_SUPPLY, "totalLedgerUnits");
	const canonicalMicLenderAuthId = await resolveCanonicalMicLenderAuthId(ctx);
	const [accounts, override] = await Promise.all([
		ctx.db
			.query("ledger_accounts")
			.withIndex("by_type_and_mortgage", (q) =>
				q.eq("type", "POSITION").eq("mortgageId", String(mortgageId))
			)
			.collect(),
		loadOverride(ctx, mortgageId),
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
	const capLedgerUnits =
		override?.availableLedgerUnits === undefined
			? null
			: validateMicSaleAvailabilityUnits(override.availableLedgerUnits);
	const cappedRemaining =
		capLedgerUnits === null
			? micAvailableLedgerUnits
			: Math.max(capLedgerUnits - lockedLedgerUnits, 0);
	const soldLedgerUnits = toSafeNumber(
		nonMicPositions.reduce(
			(total, position) => total + position.postedBalance,
			0n
		),
		"soldLedgerUnits"
	);

	return {
		availableForSaleLedgerUnits: Math.min(
			micAvailableLedgerUnits,
			cappedRemaining
		),
		capLedgerUnits,
		capReason: override?.reason ?? null,
		capUpdatedAt: override?.updatedAt ?? null,
		capUpdatedBy: override?.updatedBy ?? null,
		canonicalMicLenderAuthId,
		hasMicPosition: micPositions.length > 0,
		lockedLedgerUnits,
		micAvailableLedgerUnits,
		micOwnedLedgerUnits,
		soldLedgerUnits,
		totalInvestors: nonMicPositions.length,
		totalLedgerUnits,
	};
}

export async function getCanonicalMicSellerAccountForSale(
	ctx: ReadCtx,
	args: {
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

	const summary = await buildMortgageMicSaleAvailabilitySummary(
		ctx,
		args.mortgageId
	);
	if (summary.availableForSaleLedgerUnits < requestedLedgerUnits) {
		return null;
	}

	const account = await ctx.db
		.query("ledger_accounts")
		.withIndex("by_mortgage_and_lender", (q) =>
			q
				.eq("mortgageId", String(args.mortgageId))
				.eq("lenderId", summary.canonicalMicLenderAuthId)
		)
		.first();

	if (!account || getAvailableBalance(account) < BigInt(requestedLedgerUnits)) {
		return null;
	}

	return { account, lenderId: summary.canonicalMicLenderAuthId };
}
