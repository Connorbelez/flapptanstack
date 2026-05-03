import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { calculateProRataShares } from "../accrual/interestMath";
import { appendAuditJournalEntry } from "../engine/auditJournal";
import { sourceValidator } from "../engine/validators";
import {
	type ResolvedWaterfallFeeConfig,
	resolveWaterfallFeeConfigs,
} from "../fees/resolver";
import { getAccountLenderId } from "../ledger/accountOwnership";
import { getPostedBalance } from "../ledger/accounts";
import {
	postSettlementAllocation,
	type ServicingFeeMetadata,
} from "../payments/cashLedger/integrations";
import { calculatePayoutEligibleDate } from "./holdPeriod";
import { requireLenderIdForAuthId } from "./lenderIdentity";
import { calculateServicingFee } from "./servicingFee";

interface ActivePosition {
	lenderAccountId: Id<"ledger_accounts">;
	lenderAuthId: string;
	units: number;
}

interface DispersalCreationResult {
	created: boolean;
	entries: Array<{
		id: Id<"dispersalEntries">;
		lenderId: Id<"lenders">;
		lenderAccountId: Id<"ledger_accounts">;
		amount: number;
		rawAmount: number;
		units: number;
	}>;
	servicingFeeEntryId: Id<"servicingFeeEntries"> | null;
}

interface LoadedDispersalDocuments {
	mortgage: Doc<"mortgages">;
	obligation: Doc<"obligations">;
}

interface ExistingDispersalState {
	existingEntries: Doc<"dispersalEntries">[];
	existingFee: Doc<"servicingFeeEntries"> | null;
}

interface WaterfallFeeAllocation {
	config: ResolvedWaterfallFeeConfig;
	feeCashApplied: number;
	feeDue: number;
	feeReceivable: number;
}

interface FeeRuntimeRecord {
	allocation: WaterfallFeeAllocation;
	feeAssessmentId?: Id<"feeAssessments">;
	feeMetadata?: ServicingFeeMetadata;
	servicingFeeEntryId: Id<"servicingFeeEntries">;
}

interface ServicingSplit {
	distributableAmount: number;
	feeAllocations: WaterfallFeeAllocation[];
	feeCashApplied: number;
	feeDue: number;
	feeReceivable: number;
	servicingConfig: ResolvedWaterfallFeeConfig | null;
}

function selectCanonicalServicingFeeEntry(
	entries: Doc<"servicingFeeEntries">[]
): Doc<"servicingFeeEntries"> | null {
	return (
		entries.find((entry) => entry.feeCode === "servicing") ?? entries[0] ?? null
	);
}

async function resolveLenderIdFromAuthId(
	ctx: MutationCtx,
	lenderAuthId: string
): Promise<Id<"lenders">> {
	return requireLenderIdForAuthId(
		ctx.db,
		lenderAuthId,
		"createDispersalEntries"
	);
}

async function resolvePaymentMethodFromCollection(
	ctx: MutationCtx,
	obligationId: Id<"obligations">
): Promise<string | undefined> {
	// Walk: collectionPlanEntries (by_status, obligationIds contains this obligation)
	//     → collectionAttempts (by_plan_entry, confirmed + method, most recent)
	//     → method
	const planEntryBatches = await Promise.all(
		(["planned", "executing", "completed"] as const).map((status) =>
			ctx.db
				.query("collectionPlanEntries")
				.withIndex("by_status", (q) => q.eq("status", status))
				.collect()
		)
	);
	const planEntries = planEntryBatches
		.flat()
		.filter((e) => e.obligationIds.includes(obligationId));

	let bestConfirmed: { method: string; creationTime: number } | undefined;
	for (const entry of planEntries) {
		const attempts = await ctx.db
			.query("collectionAttempts")
			.withIndex("by_plan_entry", (q) => q.eq("planEntryId", entry._id))
			.collect();
		for (const a of attempts) {
			if (
				a.status === "confirmed" &&
				a.method &&
				(!bestConfirmed || a._creationTime > bestConfirmed.creationTime)
			) {
				bestConfirmed = { method: a.method, creationTime: a._creationTime };
			}
		}
	}
	if (bestConfirmed) {
		return bestConfirmed.method;
	}

	let bestPlanMethod: { method: string; creationTime: number } | undefined;
	for (const entry of planEntries) {
		if (
			entry.method &&
			(!bestPlanMethod || entry._creationTime > bestPlanMethod.creationTime)
		) {
			bestPlanMethod = {
				method: entry.method,
				creationTime: entry._creationTime,
			};
		}
	}
	return bestPlanMethod?.method;
}

function validateIntegerCents(value: number, label: string) {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new ConvexError(
			`createDispersalEntries: ${label} must be a non-negative integer cent value, got ${value}`
		);
	}
}

function assertValidSettledDate(settledDate: string) {
	const parsedSettledDate = Date.parse(`${settledDate}T00:00:00Z`);
	if (Number.isNaN(parsedSettledDate)) {
		throw new ConvexError(
			`createDispersalEntries: settledDate must be YYYY-MM-DD, got ${settledDate}`
		);
	}
}

async function loadDispersalDocuments(
	ctx: MutationCtx,
	args: {
		mortgageId: Id<"mortgages">;
		obligationId: Id<"obligations">;
	}
): Promise<LoadedDispersalDocuments> {
	const mortgage = (await ctx.db.get(
		args.mortgageId
	)) as Doc<"mortgages"> | null;
	if (!mortgage) {
		throw new ConvexError(
			`createDispersalEntries: mortgage not found: ${args.mortgageId}`
		);
	}

	const obligation = await ctx.db.get(args.obligationId);
	if (!obligation) {
		throw new ConvexError(
			`createDispersalEntries: obligation not found: ${args.obligationId}`
		);
	}

	return { mortgage, obligation };
}

async function loadExistingDispersalState(
	ctx: MutationCtx,
	obligationId: Id<"obligations">
): Promise<ExistingDispersalState> {
	const [existingEntries, existingFeeEntries] = await Promise.all([
		ctx.db
			.query("dispersalEntries")
			.withIndex("by_obligation", (q) => q.eq("obligationId", obligationId))
			.collect(),
		ctx.db
			.query("servicingFeeEntries")
			.withIndex("by_obligation", (q) => q.eq("obligationId", obligationId))
			.collect(),
	]);

	const existingFee = selectCanonicalServicingFeeEntry(existingFeeEntries);

	return { existingEntries, existingFee };
}

async function calculateServicingSplit(
	ctx: MutationCtx,
	args: {
		mortgage: Doc<"mortgages">;
		obligation: Doc<"obligations">;
		settledAmount: number;
		settledDate: string;
	}
): Promise<ServicingSplit> {
	if (args.obligation.type !== "regular_interest") {
		return {
			servicingConfig: null,
			feeAllocations: [],
			feeDue: 0,
			feeCashApplied: 0,
			feeReceivable: 0,
			distributableAmount: args.settledAmount,
		};
	}

	const waterfallConfigs = await resolveWaterfallFeeConfigs(
		ctx.db,
		args.mortgage,
		args.settledDate
	);
	// ENG-217: Fee basis is current outstanding principal (mortgage.principal).
	// This means fees decrease as principal is repaid — standard amortizing mortgage behavior.
	// The principalBalance used is stored in servicingFeeEntries for audit verification.
	let remainingCash = args.settledAmount;
	const feeAllocations: WaterfallFeeAllocation[] = [];
	for (const config of waterfallConfigs) {
		const feeDue = calculateServicingFee(
			config.annualRate,
			args.mortgage.principal,
			args.mortgage.paymentFrequency
		);
		if (feeDue === 0) {
			continue;
		}
		const feeCashApplied = Math.min(remainingCash, feeDue);
		remainingCash -= feeCashApplied;
		feeAllocations.push({
			config,
			feeDue,
			feeCashApplied,
			feeReceivable: feeDue - feeCashApplied,
		});
	}

	const feeDue = feeAllocations.reduce(
		(sum, allocation) => sum + allocation.feeDue,
		0
	);
	const feeCashApplied = feeAllocations.reduce(
		(sum, allocation) => sum + allocation.feeCashApplied,
		0
	);
	const feeReceivable = feeAllocations.reduce(
		(sum, allocation) => sum + allocation.feeReceivable,
		0
	);
	const servicingConfig =
		feeAllocations.find((allocation) => allocation.config.code === "servicing")
			?.config ??
		feeAllocations[0]?.config ??
		null;
	return {
		servicingConfig,
		feeAllocations,
		feeDue,
		feeCashApplied,
		feeReceivable,
		distributableAmount: args.settledAmount - feeCashApplied,
	};
}

async function loadActivePositions(
	ctx: MutationCtx,
	ledgerMortgageId: string
): Promise<ActivePosition[]> {
	const accounts = await ctx.db
		.query("ledger_accounts")
		.withIndex("by_type_and_mortgage", (q) =>
			q.eq("type", "POSITION").eq("mortgageId", ledgerMortgageId)
		)
		.collect();

	const positions: ActivePosition[] = [];
	for (const account of accounts) {
		const balance = getPostedBalance(account);
		if (balance <= 0n) {
			continue;
		}

		const lenderAuthId = getAccountLenderId(account);
		if (!lenderAuthId) {
			throw new ConvexError(
				`createDispersalEntries: POSITION account ${account._id} is missing lenderId`
			);
		}

		const units = Number(balance);
		if (!Number.isSafeInteger(units)) {
			throw new ConvexError(
				`createDispersalEntries: POSITION account ${account._id} has a balance that does not fit in a safe integer`
			);
		}

		positions.push({
			lenderAccountId: account._id,
			lenderAuthId,
			units,
		});
	}

	return positions;
}

async function applyDealReroutes(
	ctx: MutationCtx,
	mortgageId: Id<"mortgages">,
	settledDate: string,
	positions: ActivePosition[]
): Promise<number> {
	let appliedCount = 0;
	const reroutes = await ctx.db
		.query("dealReroutes")
		.withIndex("by_mortgage", (q) => q.eq("mortgageId", mortgageId))
		.collect();

	// Sort reroutes by effectiveAfterDate to ensure deterministic processing order
	const sortedReroutes = reroutes.slice().sort((a, b) => {
		const dateCompare = a.effectiveAfterDate.localeCompare(
			b.effectiveAfterDate
		);
		if (dateCompare !== 0) {
			return dateCompare;
		}
		return a._creationTime - b._creationTime;
	});

	for (const reroute of sortedReroutes) {
		if (reroute.effectiveAfterDate > settledDate) {
			continue;
		}

		const fromPosition = positions.find(
			(position) => position.lenderAuthId === reroute.fromOwnerId
		);
		const toPosition = positions.find(
			(position) => position.lenderAuthId === reroute.toOwnerId
		);

		if (!(fromPosition && toPosition)) {
			continue;
		}

		if (!Number.isSafeInteger(reroute.fractionalShare)) {
			throw new ConvexError(
				`createDispersalEntries: deal reroute ${reroute._id} has a non-integer fractionalShare`
			);
		}

		if (reroute.fractionalShare <= 0) {
			throw new ConvexError(
				`createDispersalEntries: reroute ${reroute._id} has invalid fractionalShare ${reroute.fractionalShare} (must be > 0)`
			);
		}

		fromPosition.units -= reroute.fractionalShare;
		toPosition.units += reroute.fractionalShare;
		appliedCount++;

		if (fromPosition.units < 0) {
			throw new ConvexError(
				`createDispersalEntries: reroute ${reroute._id} would make lender ${reroute.fromOwnerId} negative`
			);
		}
	}

	return appliedCount;
}

async function normalizePositions(
	ctx: MutationCtx,
	activePositions: ActivePosition[]
): Promise<
	Array<{
		lenderAccountId: Id<"ledger_accounts">;
		lenderId: Id<"lenders">;
		units: number;
	}>
> {
	const lenderIdCache = new Map<string, Id<"lenders">>();
	const normalizedPositions: Array<{
		lenderAccountId: Id<"ledger_accounts">;
		lenderId: Id<"lenders">;
		units: number;
	}> = [];

	for (const position of activePositions) {
		if (position.units <= 0) {
			continue;
		}

		const cachedLenderId = lenderIdCache.get(position.lenderAuthId);
		// Auth boundary: ledger POSITION accounts store WorkOS auth IDs.
		// Normalize to domain `Id<"lenders">` once here before persistence.
		const lenderId =
			cachedLenderId ??
			(await resolveLenderIdFromAuthId(ctx, position.lenderAuthId));
		lenderIdCache.set(position.lenderAuthId, lenderId);

		normalizedPositions.push({
			lenderAccountId: position.lenderAccountId,
			lenderId,
			units: position.units,
		});
	}

	return normalizedPositions;
}

function buildReplayResult(
	existingEntries: Doc<"dispersalEntries">[],
	existingFee: Doc<"servicingFeeEntries"> | null
): DispersalCreationResult {
	return {
		created: false,
		entries: existingEntries.map((entry) => ({
			id: entry._id,
			lenderId: entry.lenderId,
			lenderAccountId: entry.lenderAccountId,
			amount: entry.amount,
			rawAmount: entry.calculationDetails.rawAmount,
			units: entry.calculationDetails.ownershipUnits,
		})),
		servicingFeeEntryId: existingFee?._id ?? null,
	};
}

export const createDispersalEntries = internalMutation({
	args: {
		obligationId: v.id("obligations"),
		mortgageId: v.id("mortgages"),
		settledAmount: v.number(),
		settledDate: v.string(),
		idempotencyKey: v.string(),
		source: sourceValidator,
		paymentMethod: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<DispersalCreationResult> => {
		validateIntegerCents(args.settledAmount, "settledAmount");
		assertValidSettledDate(args.settledDate);

		const { mortgage, obligation } = await loadDispersalDocuments(ctx, args);
		const { existingEntries, existingFee } = await loadExistingDispersalState(
			ctx,
			args.obligationId
		);
		const {
			servicingConfig,
			feeAllocations,
			feeDue,
			feeCashApplied,
			feeReceivable,
			distributableAmount,
		} = await calculateServicingSplit(ctx, {
			mortgage,
			obligation,
			settledAmount: args.settledAmount,
			settledDate: args.settledDate,
		});

		const ledgerMortgageId = mortgage.simulationId ?? String(args.mortgageId);
		const activePositions = await loadActivePositions(ctx, ledgerMortgageId);
		if (activePositions.length === 0) {
			throw new ConvexError(
				`createDispersalEntries: no active positions for mortgage ${args.mortgageId}`
			);
		}

		const reroutesAppliedCount = await applyDealReroutes(
			ctx,
			args.mortgageId,
			args.settledDate,
			activePositions
		);

		const normalizedPositions = await normalizePositions(ctx, activePositions);

		if (normalizedPositions.length === 0) {
			throw new ConvexError(
				`createDispersalEntries: no positive positions remain after reroutes for mortgage ${args.mortgageId}`
			);
		}

		const totalUnits = normalizedPositions.reduce(
			(sum, position) => sum + position.units,
			0
		);

		const shares = calculateProRataShares(
			normalizedPositions,
			distributableAmount
		).filter((share) => share.amount > 0);

		if (existingFee || existingEntries.length > 0) {
			const expectedEntryCount = shares.length;
			const isConsistentReplay =
				(existingFee !== null || feeDue === 0) &&
				existingEntries.length === expectedEntryCount;

			if (!isConsistentReplay) {
				throw new ConvexError(
					`createDispersalEntries: inconsistent replay state for obligation ${args.obligationId}`
				);
			}

			return buildReplayResult(existingEntries, existingFee);
		}

		// Resolve payment method for hold period calculation
		const resolvedMethod =
			args.paymentMethod ??
			(await resolvePaymentMethodFromCollection(ctx, args.obligationId)) ??
			"manual";
		const payoutEligibleAfter = calculatePayoutEligibleDate(
			args.settledDate,
			resolvedMethod
		);

		const existingCalculationRun = await ctx.db
			.query("dispersalCalculationRuns")
			.withIndex("by_idempotency", (q) =>
				q.eq("idempotencyKey", args.idempotencyKey)
			)
			.first();

		if (
			existingCalculationRun &&
			(existingCalculationRun.mortgageId !== args.mortgageId ||
				existingCalculationRun.obligationId !== args.obligationId)
		) {
			throw new ConvexError(
				`createDispersalEntries: idempotency key collision for calculation run ${existingCalculationRun._id}`
			);
		}

		const calculationInputs = {
			distributableAmount,
			feeCashApplied,
			feeDue,
			feeReceivable,
			paymentMethod: resolvedMethod,
			payoutEligibleAfter,
			reroutesAppliedCount,
			settledAmount: args.settledAmount,
			settledDate: args.settledDate,
			servicingConfig: servicingConfig
				? {
						annualRate: servicingConfig.annualRate,
						behavior: servicingConfig.behavior,
						code: servicingConfig.code,
						displayCode: servicingConfig.displayCode,
						mortgageFeeId: servicingConfig.mortgageFeeId,
						policyVersion: servicingConfig.policyVersion,
					}
				: null,
			waterfallFees: feeAllocations.map((allocation) => ({
				annualRate: allocation.config.annualRate,
				behavior: allocation.config.behavior,
				code: allocation.config.code,
				displayCode: allocation.config.displayCode,
				feeCashApplied: allocation.feeCashApplied,
				feeDue: allocation.feeDue,
				feeReceivable: allocation.feeReceivable,
				mortgageFeeId: allocation.config.mortgageFeeId,
				policyVersion: allocation.config.policyVersion,
			})),
			ownershipSnapshot: normalizedPositions.map((position) => ({
				lenderAccountId: `${position.lenderAccountId}`,
				lenderId: `${position.lenderId}`,
				units: position.units,
			})),
		};
		const calculationOutputs = {
			servicingFeeEntryExpected: feeDue > 0,
			waterfallFees: feeAllocations.map((allocation) => ({
				code: allocation.config.code,
				displayCode: allocation.config.displayCode,
				feeCashApplied: allocation.feeCashApplied,
				feeDue: allocation.feeDue,
				feeReceivable: allocation.feeReceivable,
				mortgageFeeId: allocation.config.mortgageFeeId,
			})),
			shares: shares.map((share) => ({
				amount: share.amount,
				lenderAccountId: `${share.lenderAccountId}`,
				lenderId: `${share.lenderId}`,
				rawAmount: share.rawAmount,
				units: share.units,
			})),
			totalUnits,
		};

		let calculationRunId = existingCalculationRun?._id;

		if (!calculationRunId) {
			const createdAt = Date.now();
			calculationRunId = await ctx.db.insert("dispersalCalculationRuns", {
				orgId: mortgage.orgId,
				mortgageId: args.mortgageId,
				obligationId: args.obligationId,
				idempotencyKey: args.idempotencyKey,
				settledAmount: args.settledAmount,
				settledDate: args.settledDate,
				paymentMethod: resolvedMethod,
				payoutEligibleAfter,
				calculationVersion: "audit-ready-v1",
				inputs: calculationInputs,
				outputs: calculationOutputs,
				source: args.source,
				createdAt,
			});

			await appendAuditJournalEntry(ctx, {
				entityType: "dispersalCalculationRun",
				entityId: `${calculationRunId}`,
				eventType: "CREATED",
				eventCategory: "domain_write",
				organizationId: mortgage.orgId,
				previousState: "none",
				newState: "recorded",
				outcome: "transitioned",
				actorId: args.source.actorId ?? "system",
				actorType: args.source.actorType,
				channel: args.source.channel,
				payload: {
					obligationId: `${args.obligationId}`,
					mortgageId: `${args.mortgageId}`,
				},
				idempotencyKey: args.idempotencyKey,
				linkedRecordIds: {
					calculationRunId: `${calculationRunId}`,
					mortgageId: `${args.mortgageId}`,
					obligationId: `${args.obligationId}`,
				},
				afterState: {
					_id: `${calculationRunId}`,
					calculationVersion: "audit-ready-v1",
					createdAt,
					idempotencyKey: args.idempotencyKey,
					inputs: calculationInputs,
					mortgageId: `${args.mortgageId}`,
					obligationId: `${args.obligationId}`,
					orgId: mortgage.orgId,
					outputs: calculationOutputs,
					paymentMethod: resolvedMethod,
					payoutEligibleAfter,
					settledAmount: args.settledAmount,
					settledDate: args.settledDate,
				},
				timestamp: createdAt,
			});
		}

		const entries: DispersalCreationResult["entries"] = [];
		const createdAt = Date.now();
		for (const share of shares) {
			const entryId = await ctx.db.insert("dispersalEntries", {
				orgId: mortgage.orgId,
				mortgageId: args.mortgageId,
				lenderId: share.lenderId,
				lenderAccountId: share.lenderAccountId,
				calculationRunId,
				amount: share.amount,
				dispersalDate: args.settledDate,
				obligationId: args.obligationId,
				servicingFeeDeducted: 0,
				status: "pending",
				idempotencyKey: `${args.idempotencyKey}:${share.lenderId}`,
				paymentMethod: resolvedMethod,
				payoutEligibleAfter,
				calculationDetails: {
					settledAmount: args.settledAmount,
					servicingFee: feeCashApplied,
					distributableAmount,
					feeDue,
					feeCashApplied,
					feeReceivable,
					ownershipUnits: share.units,
					totalUnits,
					ownershipFraction: totalUnits === 0 ? 0 : share.units / totalUnits,
					policyVersion: servicingConfig?.policyVersion,
					rawAmount: share.rawAmount,
					roundedAmount: share.amount,
					sourceObligationType: obligation.type,
					mortgageFeeId: servicingConfig?.mortgageFeeId,
					feeCode: servicingConfig?.code,
					ownershipSnapshotDate: args.settledDate,
					reroutesAppliedCount,
				},
				createdAt,
			});

			await appendAuditJournalEntry(ctx, {
				entityType: "dispersalEntry",
				entityId: `${entryId}`,
				eventType: "CREATED",
				eventCategory: "domain_write",
				organizationId: mortgage.orgId,
				previousState: "none",
				newState: "pending",
				outcome: "transitioned",
				actorId: args.source.actorId ?? "system",
				actorType: args.source.actorType,
				channel: args.source.channel,
				payload: {
					amount: share.amount,
					dispersalDate: args.settledDate,
					lenderId: `${share.lenderId}`,
					mortgageId: `${args.mortgageId}`,
					obligationId: `${args.obligationId}`,
				},
				idempotencyKey: `${args.idempotencyKey}:${share.lenderId}`,
				linkedRecordIds: {
					calculationRunId: `${calculationRunId}`,
					dispersalEntryId: `${entryId}`,
					lenderId: `${share.lenderId}`,
					mortgageId: `${args.mortgageId}`,
					obligationId: `${args.obligationId}`,
				},
				afterState: {
					_id: `${entryId}`,
					amount: share.amount,
					calculationDetails: {
						distributableAmount,
						feeCashApplied,
						feeCode: servicingConfig?.code,
						feeDue,
						feeReceivable,
						mortgageFeeId: servicingConfig?.mortgageFeeId
							? `${servicingConfig.mortgageFeeId}`
							: undefined,
						ownershipFraction: totalUnits === 0 ? 0 : share.units / totalUnits,
						ownershipSnapshotDate: args.settledDate,
						ownershipUnits: share.units,
						policyVersion: servicingConfig?.policyVersion,
						rawAmount: share.rawAmount,
						reroutesAppliedCount,
						roundedAmount: share.amount,
						settledAmount: args.settledAmount,
						servicingFee: feeCashApplied,
						sourceObligationType: obligation.type,
						totalUnits,
					},
					calculationRunId: `${calculationRunId}`,
					createdAt,
					dispersalDate: args.settledDate,
					lenderAccountId: `${share.lenderAccountId}`,
					lenderId: `${share.lenderId}`,
					mortgageId: `${args.mortgageId}`,
					obligationId: `${args.obligationId}`,
					orgId: mortgage.orgId,
					paymentMethod: resolvedMethod,
					payoutEligibleAfter,
					status: "pending",
				},
				timestamp: createdAt,
			});
			entries.push({
				id: entryId,
				lenderId: share.lenderId,
				lenderAccountId: share.lenderAccountId,
				amount: share.amount,
				rawAmount: share.rawAmount,
				units: share.units,
			});
		}

		const feeRuntimeRecords: FeeRuntimeRecord[] = [];
		for (const allocation of feeAllocations) {
			const servicingFeeEntryId = await ctx.db.insert("servicingFeeEntries", {
				calculationRunId,
				mortgageId: args.mortgageId,
				obligationId: args.obligationId,
				amount: allocation.feeCashApplied,
				annualRate: allocation.config.annualRate,
				principalBalance: mortgage.principal,
				date: args.settledDate,
				createdAt,
				feeDue: allocation.feeDue,
				feeCashApplied: allocation.feeCashApplied,
				feeReceivable: allocation.feeReceivable,
				policyVersion: allocation.config.policyVersion,
				sourceObligationType: obligation.type,
				mortgageFeeId: allocation.config.mortgageFeeId,
				feeCode: allocation.config.code,
			});

			await appendAuditJournalEntry(ctx, {
				entityType: "servicingFeeEntry",
				entityId: `${servicingFeeEntryId}`,
				eventType: "CREATED",
				eventCategory: "domain_write",
				organizationId: mortgage.orgId,
				previousState: "none",
				newState: "recorded",
				outcome: "transitioned",
				actorId: args.source.actorId ?? "system",
				actorType: args.source.actorType,
				channel: args.source.channel,
				payload: {
					amount: allocation.feeCashApplied,
					feeCode: allocation.config.code,
					mortgageFeeId: `${allocation.config.mortgageFeeId}`,
					obligationId: `${args.obligationId}`,
				},
				idempotencyKey: `${args.idempotencyKey}:servicing-fee:${allocation.config.mortgageFeeId}`,
				linkedRecordIds: {
					calculationRunId: `${calculationRunId}`,
					mortgageId: `${args.mortgageId}`,
					obligationId: `${args.obligationId}`,
					servicingFeeEntryId: `${servicingFeeEntryId}`,
				},
				afterState: {
					_id: `${servicingFeeEntryId}`,
					amount: allocation.feeCashApplied,
					annualRate: allocation.config.annualRate,
					calculationRunId: `${calculationRunId}`,
					createdAt,
					date: args.settledDate,
					feeCashApplied: allocation.feeCashApplied,
					feeCode: allocation.config.code,
					feeDue: allocation.feeDue,
					feeReceivable: allocation.feeReceivable,
					mortgageFeeId: `${allocation.config.mortgageFeeId}`,
					mortgageId: `${args.mortgageId}`,
					obligationId: `${args.obligationId}`,
					policyVersion: allocation.config.policyVersion,
					principalBalance: mortgage.principal,
					sourceObligationType: obligation.type,
				},
				timestamp: createdAt,
			});

			const mortgageFee = await ctx.db.get(allocation.config.mortgageFeeId);
			if (!mortgageFee || mortgageFee.mortgageId !== args.mortgageId) {
				throw new ConvexError(
					`createDispersalEntries: waterfall mortgageFeeId ${allocation.config.mortgageFeeId} is not valid for mortgage ${args.mortgageId}`
				);
			}
			const feeAssessmentId = await ctx.db.insert("feeAssessments", {
				orgId: mortgage.orgId,
				mortgageId: args.mortgageId,
				mortgageFeeId: allocation.config.mortgageFeeId,
				feeTemplateId: mortgageFee.feeTemplateId,
				feeSetTemplateId: mortgageFee.feeSetTemplateId,
				behavior: allocation.config.behavior,
				code: allocation.config.code,
				displayCode: allocation.config.displayCode,
				amountCents: allocation.feeDue,
				amountSettledCents: 0,
				source: "payment_waterfall",
				status: "assessed",
				assessedAt: createdAt,
				effectiveDate: args.settledDate,
				sourceObligationId: args.obligationId,
				obligationId: args.obligationId,
				servicingFeeEntryId,
				metadata: {
					calculationRunId,
					distributableAmount,
					feeCashApplied: allocation.feeCashApplied,
					feeCode: allocation.config.code,
					feeDue: allocation.feeDue,
					feeReceivable: allocation.feeReceivable,
					idempotencyKey: args.idempotencyKey,
					settledAmount: args.settledAmount,
				},
				createdAt,
				updatedAt: createdAt,
			});

			let feeMetadata: ServicingFeeMetadata | undefined;
			if (allocation.feeCashApplied > 0) {
				const feeCalculationOutputs = {
					...calculationOutputs,
					feeCashApplied: allocation.feeCashApplied,
					feeDue: allocation.feeDue,
					feeReceivable: allocation.feeReceivable,
				};
				const feeAssessmentMetadata = {
					behavior: allocation.config.behavior,
					calculationInputs,
					calculationOutputs: feeCalculationOutputs,
					displayCode: allocation.config.displayCode,
					feeAssessmentId,
					feeCode: allocation.config.code,
					mortgageFeeId: allocation.config.mortgageFeeId,
				};
				feeMetadata = {
					annualRate: allocation.config.annualRate,
					behavior: allocation.config.behavior,
					calculationInputs,
					calculationOutputs: feeCalculationOutputs,
					displayCode: allocation.config.displayCode,
					feeAssessment: feeAssessmentMetadata,
					feeAssessmentId,
					policyVersion: allocation.config.policyVersion,
					feeCode: allocation.config.code,
					mortgageFeeId: allocation.config.mortgageFeeId,
					paymentFrequency: mortgage.paymentFrequency,
					principalBalance: mortgage.principal,
					feeDue: allocation.feeDue,
					feeCashApplied: allocation.feeCashApplied,
					feeReceivable: allocation.feeReceivable,
				};
			}

			feeRuntimeRecords.push({
				allocation,
				feeAssessmentId,
				feeMetadata,
				servicingFeeEntryId,
			});
		}

		const newServicingFeeEntryId =
			feeRuntimeRecords.find(
				(record) => record.allocation.config.code === "servicing"
			)?.servicingFeeEntryId ??
			feeRuntimeRecords[0]?.servicingFeeEntryId ??
			null;
		const feeMetadataEntries = feeRuntimeRecords
			.map((record) => record.feeMetadata)
			.filter(
				(metadata): metadata is ServicingFeeMetadata => metadata !== undefined
			);

		await postSettlementAllocation(ctx, {
			obligationId: args.obligationId,
			mortgageId: args.mortgageId,
			settledDate: args.settledDate,
			settledAmount: args.settledAmount,
			servicingFee: feeCashApplied,
			entries: entries.map((entry) => ({
				dispersalEntryId: entry.id,
				lenderId: entry.lenderId,
				amount: entry.amount,
			})),
			source: args.source,
			...(feeMetadataEntries.length > 0 ? { feeMetadataEntries } : {}),
		});

		return {
			created: true,
			entries,
			servicingFeeEntryId: newServicingFeeEntryId,
		};
	},
});
