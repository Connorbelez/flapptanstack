import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { FAIRLEND_BROKERAGE_ORG_ID } from "../constants";
import { adminMutation } from "../fluent";
import { upsertDefaultOriginationOwner } from "../platform/defaultOriginationOwner";
import {
	ensureUserByEmail,
	findLenderByUserId,
	SEED_SOURCE,
	seedAuthIdFromEmail,
	seedTimestamp,
	writeCreationJournalEntry,
} from "./seedHelpers";

export interface SeedPlatformOwnershipResult {
	created: {
		bankAccounts: number;
		investmentVehicles: number;
		investmentVehicleWorkspaces: number;
		lenders: number;
		platformSettings: number;
	};
	defaultFairlendTrustBankAccountId: Id<"bankAccounts">;
	defaultOriginationInvestmentVehicleId: Id<"investmentVehicles">;
	defaultOriginationLenderId: Id<"lenders">;
	defaultOriginationWorkspaceId: Id<"investmentVehicleWorkspaces">;
	reused: {
		bankAccounts: number;
		investmentVehicles: number;
		investmentVehicleWorkspaces: number;
		lenders: number;
		platformSettings: number;
	};
	settingsId?: Id<"platformSettings">;
}

async function upsertFairLendMicLender(
	ctx: MutationCtx,
	args: { brokerId: Id<"brokers">; createdAt: number; userId: Id<"users"> }
) {
	const existing = await findLenderByUserId(ctx, args.userId);
	if (existing) {
		return { lenderId: existing._id, wasCreated: false };
	}

	const lenderId = await ctx.db.insert("lenders", {
		accreditationStatus: "exempt",
		brokerId: args.brokerId,
		createdAt: args.createdAt,
		kycStatus: "approved",
		onboardingEntryPath: "admin_dashboard",
		orgId: FAIRLEND_BROKERAGE_ORG_ID,
		status: "active",
		userId: args.userId,
	});

	await writeCreationJournalEntry(ctx, {
		entityId: lenderId,
		entityType: "lender",
		initialState: "active",
		organizationId: FAIRLEND_BROKERAGE_ORG_ID,
		payload: {
			brokerId: args.brokerId,
			userId: args.userId,
		},
		source: SEED_SOURCE,
		timestamp: args.createdAt,
	});

	return { lenderId, wasCreated: true };
}

async function upsertFairLendMicVehicle(
	ctx: MutationCtx,
	args: { createdAt: number; lenderId: Id<"lenders"> }
) {
	const existing = await ctx.db
		.query("investmentVehicles")
		.withIndex("by_lender", (q) => q.eq("lenderId", args.lenderId))
		.unique();
	if (existing) {
		return { investmentVehicleId: existing._id, wasCreated: false };
	}

	const investmentVehicleId = await ctx.db.insert("investmentVehicles", {
		createdAt: args.createdAt,
		entityType: "mic",
		legalName: "FairLend Mortgage Investment Corporation",
		lenderId: args.lenderId,
		name: "FairLend MIC",
		status: "active",
		updatedAt: args.createdAt,
	});

	await writeCreationJournalEntry(ctx, {
		entityId: investmentVehicleId,
		entityType: "investmentVehicle",
		initialState: "active",
		organizationId: FAIRLEND_BROKERAGE_ORG_ID,
		payload: {
			lenderId: args.lenderId,
		},
		source: SEED_SOURCE,
		timestamp: args.createdAt,
	});

	return { investmentVehicleId, wasCreated: true };
}

async function upsertFairLendMicWorkspace(
	ctx: MutationCtx,
	args: { createdAt: number; investmentVehicleId: Id<"investmentVehicles"> }
) {
	const existing = await ctx.db
		.query("investmentVehicleWorkspaces")
		.withIndex("by_vehicle", (q) =>
			q.eq("investmentVehicleId", args.investmentVehicleId)
		)
		.unique();
	if (existing) {
		return { workspaceId: existing._id, wasCreated: false };
	}

	const workspaceId = await ctx.db.insert("investmentVehicleWorkspaces", {
		createdAt: args.createdAt,
		investmentVehicleId: args.investmentVehicleId,
		name: "FairLend MIC Workspace",
		status: "active",
		updatedAt: args.createdAt,
	});

	await writeCreationJournalEntry(ctx, {
		entityId: workspaceId,
		entityType: "investmentVehicleWorkspace",
		initialState: "active",
		organizationId: FAIRLEND_BROKERAGE_ORG_ID,
		payload: {
			investmentVehicleId: args.investmentVehicleId,
		},
		source: SEED_SOURCE,
		timestamp: args.createdAt,
	});

	return { workspaceId, wasCreated: true };
}

async function upsertFairLendMicTrustAccount(
	ctx: MutationCtx,
	args: { createdAt: number; investmentVehicleId: Id<"investmentVehicles"> }
) {
	const existing = await ctx.db
		.query("bankAccounts")
		.withIndex("by_owner", (q) =>
			q.eq("ownerType", "trust").eq("ownerId", String(args.investmentVehicleId))
		)
		.unique();
	if (existing) {
		return { trustBankAccountId: existing._id, wasCreated: false };
	}

	const trustBankAccountId = await ctx.db.insert("bankAccounts", {
		accountLast4: "2401",
		country: "CA",
		createdAt: args.createdAt,
		currency: "CAD",
		institutionNumber: "001",
		mandateStatus: "not_required",
		ownerId: String(args.investmentVehicleId),
		ownerType: "trust",
		status: "validated",
		transitNumber: "00011",
		updatedAt: args.createdAt,
		validationMethod: "manual",
	});

	return { trustBankAccountId, wasCreated: true };
}

export const seedPlatformOwnership = adminMutation
	.input({
		brokerId: v.optional(v.id("brokers")),
	})
	.handler(async (ctx, args): Promise<SeedPlatformOwnershipResult> => {
		const createdAt = seedTimestamp(18_000_000);
		const { userId } = await ensureUserByEmail(ctx, {
			authId: seedAuthIdFromEmail("fairlend.mic+lender@fairlend.ca"),
			email: "fairlend.mic+lender@fairlend.ca",
			firstName: "FairLend",
			lastName: "MIC",
			phoneNumber: "+1-416-555-0199",
		});

		const resolvedBrokerId =
			args.brokerId ??
			(
				await ctx.db
					.query("brokers")
					.withIndex("by_org", (q) => q.eq("orgId", FAIRLEND_BROKERAGE_ORG_ID))
					.first()
			)?._id;

		if (!resolvedBrokerId) {
			throw new ConvexError(
				"FairLend broker must exist before seedPlatformOwnership runs"
			);
		}

		const broker = await ctx.db.get(resolvedBrokerId);
		if (!broker || broker.orgId !== FAIRLEND_BROKERAGE_ORG_ID) {
			throw new ConvexError(
				"seedPlatformOwnership requires a FairLend brokerage broker"
			);
		}

		const lender = await upsertFairLendMicLender(ctx, {
			brokerId: resolvedBrokerId,
			createdAt,
			userId,
		});
		const investmentVehicle = await upsertFairLendMicVehicle(ctx, {
			createdAt,
			lenderId: lender.lenderId,
		});
		const workspace = await upsertFairLendMicWorkspace(ctx, {
			createdAt,
			investmentVehicleId: investmentVehicle.investmentVehicleId,
		});
		const trustBankAccount = await upsertFairLendMicTrustAccount(ctx, {
			createdAt,
			investmentVehicleId: investmentVehicle.investmentVehicleId,
		});

		const existingSettings = await ctx.db
			.query("platformSettings")
			.withIndex("by_key", (q) => q.eq("key", "default"))
			.unique();

		const settings = await upsertDefaultOriginationOwner(ctx, {
			actorId: "seed",
			actorType: "system",
			changeReason: "Seed canonical FairLend MIC origination owner",
			channel: "admin_dashboard",
			defaultFairlendTrustBankAccountId: trustBankAccount.trustBankAccountId,
			defaultOriginationInvestmentVehicleId:
				investmentVehicle.investmentVehicleId,
			defaultOriginationLenderId: lender.lenderId,
			defaultOriginationWorkspaceId: workspace.workspaceId,
			source: "seed",
		});

		return {
			created: {
				bankAccounts: trustBankAccount.wasCreated ? 1 : 0,
				investmentVehicles: investmentVehicle.wasCreated ? 1 : 0,
				investmentVehicleWorkspaces: workspace.wasCreated ? 1 : 0,
				lenders: lender.wasCreated ? 1 : 0,
				platformSettings: existingSettings ? 0 : 1,
			},
			defaultFairlendTrustBankAccountId: trustBankAccount.trustBankAccountId,
			defaultOriginationInvestmentVehicleId:
				investmentVehicle.investmentVehicleId,
			defaultOriginationLenderId: lender.lenderId,
			defaultOriginationWorkspaceId: workspace.workspaceId,
			reused: {
				bankAccounts: trustBankAccount.wasCreated ? 0 : 1,
				investmentVehicles: investmentVehicle.wasCreated ? 0 : 1,
				investmentVehicleWorkspaces: workspace.wasCreated ? 0 : 1,
				lenders: lender.wasCreated ? 0 : 1,
				platformSettings: existingSettings ? 1 : 0,
			},
			settingsId: settings.settings._id,
		};
	})
	.public();
