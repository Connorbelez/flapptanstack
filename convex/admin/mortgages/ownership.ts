import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { appendAuditJournalEntry } from "../../engine/auditJournal";
import { adminMutation } from "../../fluent";
import {
	getOrCreatePositionAccount,
	getPostedBalance,
	getTreasuryAccount,
} from "../../ledger/accounts";
import { TOTAL_SUPPLY } from "../../ledger/constants";
import { postEntry } from "../../ledger/postEntry";
import {
	buildMortgageMicSaleAvailabilitySummary,
	validateMicSaleAvailabilityUnits,
} from "../../mortgages/micSaleAvailability";
import { getRequiredDefaultOriginationOwner } from "../../platform/defaultOriginationOwner";

const MIN_REASON_LENGTH = 12;

interface PositiveSourceAccount {
	account: Doc<"ledger_accounts">;
	balance: bigint;
}

async function getDefaultOriginationOwnerAuthId(ctx: MutationCtx) {
	const defaultOwner = await getRequiredDefaultOriginationOwner(ctx);
	const lenderUser = await ctx.db.get(defaultOwner.lender.userId);
	if (!lenderUser?.authId) {
		throw new ConvexError(
			"Default origination owner lender user is missing an auth id."
		);
	}
	return {
		defaultOwner,
		lenderAuthId: lenderUser.authId,
	};
}

async function getRequiredMortgageMintEntry(
	ctx: Pick<MutationCtx, "db">,
	mortgageId: Id<"mortgages">
) {
	const mintEntry = await ctx.db
		.query("ledger_journal_entries")
		.withIndex("by_mortgage_and_time", (query) =>
			query.eq("mortgageId", String(mortgageId))
		)
		.filter((query) => query.eq(query.field("entryType"), "MORTGAGE_MINTED"))
		.first();
	if (!mintEntry) {
		throw new ConvexError(
			"Mortgage must be minted in the ownership ledger before fractions can be assigned."
		);
	}
	return mintEntry;
}

async function loadPositiveSourceAccounts(
	ctx: Pick<MutationCtx, "db">,
	args: {
		micAccountId: Id<"ledger_accounts">;
		mortgageId: Id<"mortgages">;
	}
): Promise<PositiveSourceAccount[]> {
	const accounts = await ctx.db
		.query("ledger_accounts")
		.withIndex("by_mortgage", (query) =>
			query.eq("mortgageId", String(args.mortgageId))
		)
		.collect();

	return accounts
		.filter((account) => account._id !== args.micAccountId)
		.map((account) => ({
			account,
			balance: getPostedBalance(account),
		}))
		.filter((source) => source.balance > 0n)
		.sort((left, right) => {
			if (left.account.type === right.account.type) {
				return String(left.account._id).localeCompare(
					String(right.account._id)
				);
			}
			return left.account.type === "TREASURY" ? -1 : 1;
		});
}

function toSafeNumber(value: bigint, label: string) {
	if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
		throw new ConvexError(`${label} exceeds safe integer range.`);
	}
	return Number(value);
}

function validateTargetUnits(targetUnits: number) {
	if (
		!Number.isSafeInteger(targetUnits) ||
		targetUnits < 0 ||
		targetUnits > Number(TOTAL_SUPPLY)
	) {
		throw new ConvexError(
			`Target units must be an integer between 0 and ${Number(TOTAL_SUPPLY)}.`
		);
	}
}

function validateReason(reason: string) {
	if (reason.trim().length < MIN_REASON_LENGTH) {
		throw new ConvexError(
			`Ownership override reason must be at least ${MIN_REASON_LENGTH} characters.`
		);
	}
	return reason.trim();
}

async function upsertMicSaleAvailabilityOverride(
	ctx: MutationCtx,
	args: {
		availableLedgerUnits?: number;
		mortgageId: Id<"mortgages">;
		reason: string;
		updatedBy: string;
	}
) {
	const now = Date.now();
	const existing = await ctx.db
		.query("mortgageMicSaleAvailabilityOverrides")
		.withIndex("by_mortgage", (q) => q.eq("mortgageId", args.mortgageId))
		.first();
	const patch = {
		availableLedgerUnits: args.availableLedgerUnits,
		reason: args.reason,
		updatedAt: now,
		updatedBy: args.updatedBy,
	};

	if (existing) {
		await ctx.db.patch(existing._id, patch);
		return {
			overrideId: existing._id,
			previousAvailableLedgerUnits: existing.availableLedgerUnits ?? null,
			timestamp: now,
		};
	}

	const overrideId = await ctx.db.insert(
		"mortgageMicSaleAvailabilityOverrides",
		{
			...patch,
			createdAt: now,
			mortgageId: args.mortgageId,
		}
	);
	return {
		overrideId,
		previousAvailableLedgerUnits: null,
		timestamp: now,
	};
}

async function auditMicSaleAvailabilityOverride(
	ctx: MutationCtx,
	args: {
		availableLedgerUnits: number | null;
		actorId: string;
		mortgage: Doc<"mortgages">;
		mortgageId: Id<"mortgages">;
		organizationId?: string;
		previousAvailableLedgerUnits: number | null;
		reason: string;
		timestamp: number;
	}
) {
	await appendAuditJournalEntry(ctx, {
		actorId: args.actorId,
		actorType: "admin",
		channel: "admin_dashboard",
		entityId: String(args.mortgageId),
		entityType: "mortgage",
		eventCategory: "marketplace_controls",
		eventType: "MORTGAGE_MIC_SALE_AVAILABILITY_OVERRIDE_UPDATED",
		idempotencyKey: `mic-sale-availability:${String(args.mortgageId)}:${args.timestamp}:${globalThis.crypto.randomUUID()}`,
		linkedRecordIds: {
			entityId: String(args.mortgageId),
			mortgageId: String(args.mortgageId),
		},
		newState:
			args.availableLedgerUnits === null
				? "mic_sale_availability_uncapped"
				: "mic_sale_availability_capped",
		organizationId: args.mortgage.orgId ?? args.organizationId ?? "unknown",
		outcome: "transitioned",
		payload: {
			availableLedgerUnits: args.availableLedgerUnits,
			previousAvailableLedgerUnits: args.previousAvailableLedgerUnits,
			reason: args.reason,
		},
		previousState: args.mortgage.status,
		timestamp: args.timestamp,
	});
}

export const setMicSaleAvailabilityOverride = adminMutation
	.input({
		availableLedgerUnits: v.number(),
		mortgageId: v.id("mortgages"),
		reason: v.string(),
	})
	.handler(async (ctx, args) => {
		const mortgage = await ctx.db.get(args.mortgageId);
		if (!mortgage) {
			throw new ConvexError("Mortgage not found.");
		}

		const availableLedgerUnits = validateMicSaleAvailabilityUnits(
			args.availableLedgerUnits
		);
		const reason = validateReason(args.reason);
		const override = await upsertMicSaleAvailabilityOverride(ctx, {
			availableLedgerUnits,
			mortgageId: args.mortgageId,
			reason,
			updatedBy: ctx.viewer.authId,
		});
		await auditMicSaleAvailabilityOverride(ctx, {
			actorId: ctx.viewer.authId,
			availableLedgerUnits,
			mortgage,
			mortgageId: args.mortgageId,
			organizationId: ctx.viewer.orgId,
			previousAvailableLedgerUnits: override.previousAvailableLedgerUnits,
			reason,
			timestamp: override.timestamp,
		});

		return {
			...(await buildMortgageMicSaleAvailabilitySummary(ctx, args.mortgageId)),
			mortgageId: args.mortgageId,
			overrideId: override.overrideId,
		};
	})
	.public();

export const clearMicSaleAvailabilityOverride = adminMutation
	.input({
		mortgageId: v.id("mortgages"),
		reason: v.string(),
	})
	.handler(async (ctx, args) => {
		const mortgage = await ctx.db.get(args.mortgageId);
		if (!mortgage) {
			throw new ConvexError("Mortgage not found.");
		}

		const reason = validateReason(args.reason);
		const override = await upsertMicSaleAvailabilityOverride(ctx, {
			mortgageId: args.mortgageId,
			reason,
			updatedBy: ctx.viewer.authId,
		});
		await auditMicSaleAvailabilityOverride(ctx, {
			actorId: ctx.viewer.authId,
			availableLedgerUnits: null,
			mortgage,
			mortgageId: args.mortgageId,
			organizationId: ctx.viewer.orgId,
			previousAvailableLedgerUnits: override.previousAvailableLedgerUnits,
			reason,
			timestamp: override.timestamp,
		});

		return {
			...(await buildMortgageMicSaleAvailabilitySummary(ctx, args.mortgageId)),
			mortgageId: args.mortgageId,
			overrideId: override.overrideId,
		};
	})
	.public();

export const assignMortgageFractionsToFairLendMic = adminMutation
	.input({
		mortgageId: v.id("mortgages"),
		reason: v.string(),
		targetUnits: v.optional(v.number()),
	})
	.handler(async (ctx, args) => {
		const mortgage = await ctx.db.get(args.mortgageId);
		if (!mortgage) {
			throw new ConvexError("Mortgage not found.");
		}

		const targetUnits = args.targetUnits ?? Number(TOTAL_SUPPLY);
		validateTargetUnits(targetUnits);
		const reason = validateReason(args.reason);
		const targetUnitsBigInt = BigInt(targetUnits);
		const { defaultOwner, lenderAuthId } =
			await getDefaultOriginationOwnerAuthId(ctx);
		const mintEntry = await getRequiredMortgageMintEntry(ctx, args.mortgageId);
		const micPosition = await getOrCreatePositionAccount(
			ctx,
			String(args.mortgageId),
			lenderAuthId
		);
		const micBalance = getPostedBalance(micPosition);
		const postedEntries: Doc<"ledger_journal_entries">[] = [];
		const now = Date.now();
		const idempotencyBase = `admin-ownership-override:${String(args.mortgageId)}:${targetUnits}:${now}:${globalThis.crypto.randomUUID()}`;

		if (micBalance < targetUnitsBigInt) {
			let remaining = targetUnitsBigInt - micBalance;
			const sources = await loadPositiveSourceAccounts(ctx, {
				micAccountId: micPosition._id,
				mortgageId: args.mortgageId,
			});

			for (const source of sources) {
				if (remaining === 0n) {
					break;
				}
				const amount = source.balance < remaining ? source.balance : remaining;
				const entry = await postEntry(ctx, {
					amount: toSafeNumber(amount, "Ownership override amount"),
					causedBy: mintEntry._id,
					creditAccountId: source.account._id,
					debitAccountId: micPosition._id,
					effectiveDate: new Date(now).toISOString().slice(0, 10),
					entryType: "CORRECTION",
					idempotencyKey: `${idempotencyBase}:increase:${postedEntries.length}`,
					metadata: {
						defaultOriginationInvestmentVehicleId: String(
							defaultOwner.investmentVehicle._id
						),
						defaultOriginationLenderId: String(defaultOwner.lender._id),
						micLenderAuthId: lenderAuthId,
						targetUnits,
					},
					mortgageId: String(args.mortgageId),
					reason,
					source: {
						actor: ctx.viewer.authId,
						channel: "admin_mortgage_ownership_override",
						type: "user",
					},
				});
				postedEntries.push(entry);
				remaining -= amount;
			}

			if (remaining > 0n) {
				throw new ConvexError(
					`Unable to assign ${targetUnits} units to MIC; ${toSafeNumber(remaining, "Remaining ownership units")} units are not available.`
				);
			}
		} else if (micBalance > targetUnitsBigInt) {
			const treasury = await getTreasuryAccount(ctx, String(args.mortgageId));
			if (!treasury) {
				throw new ConvexError(
					"Mortgage treasury account is required to reduce MIC ownership."
				);
			}
			const amount = micBalance - targetUnitsBigInt;
			const entry = await postEntry(ctx, {
				amount: toSafeNumber(amount, "Ownership override amount"),
				causedBy: mintEntry._id,
				creditAccountId: micPosition._id,
				debitAccountId: treasury._id,
				effectiveDate: new Date(now).toISOString().slice(0, 10),
				entryType: "CORRECTION",
				idempotencyKey: `${idempotencyBase}:decrease`,
				metadata: {
					defaultOriginationInvestmentVehicleId: String(
						defaultOwner.investmentVehicle._id
					),
					defaultOriginationLenderId: String(defaultOwner.lender._id),
					micLenderAuthId: lenderAuthId,
					targetUnits,
				},
				mortgageId: String(args.mortgageId),
				reason,
				source: {
					actor: ctx.viewer.authId,
					channel: "admin_mortgage_ownership_override",
					type: "user",
				},
			});
			postedEntries.push(entry);
		}

		const updatedMicPosition = await ctx.db.get(micPosition._id);
		if (!updatedMicPosition) {
			throw new ConvexError("MIC position disappeared during override.");
		}
		const micPositionUnits = toSafeNumber(
			getPostedBalance(updatedMicPosition),
			"MIC position units"
		);

		await appendAuditJournalEntry(ctx, {
			actorId: ctx.viewer.authId,
			actorType: "admin",
			channel: "admin_dashboard",
			entityId: String(args.mortgageId),
			entityType: "mortgage",
			eventCategory: "ledger_correction",
			eventType: "MORTGAGE_FRACTIONS_ASSIGNED_TO_FAIRLEND_MIC",
			idempotencyKey: `${idempotencyBase}:audit`,
			linkedRecordIds: {
				entityId: String(args.mortgageId),
				investmentVehicleId: String(defaultOwner.investmentVehicle._id),
				lenderId: String(defaultOwner.lender._id),
				micLenderAuthId: lenderAuthId,
				mortgageId: String(args.mortgageId),
				positionAccountId: String(micPosition._id),
			},
			newState: "ownership_overridden",
			organizationId: mortgage.orgId ?? ctx.viewer.orgId ?? "unknown",
			outcome: "transitioned",
			payload: {
				entriesPosted: postedEntries.map((entry) => String(entry._id)),
				micLenderAuthId: lenderAuthId,
				micPositionUnits,
				reason,
				targetUnits,
			},
			previousState: mortgage.status,
			timestamp: now,
		});

		return {
			entriesPosted: postedEntries.length,
			micLenderAuthId: lenderAuthId,
			micPositionUnits,
			mortgageId: args.mortgageId,
			targetUnits,
		};
	})
	.public();
