import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { FAIRLEND_BROKERAGE_ORG_ID } from "../constants";
import { adminMutation } from "../fluent";
import { upsertDefaultOriginationOwner } from "../platform/defaultOriginationOwner";
import {
	FAIRLEND_MIC_INVESTMENT_VEHICLE_LEGAL_NAME,
	FAIRLEND_MIC_INVESTMENT_VEHICLE_NAME,
	FAIRLEND_MIC_LENDER_EMAIL,
} from "../platform/defaultOriginationOwnerContract";
import {
	MIC_PORTAL_DEFAULT_POST_AUTH_PATH,
	MIC_PORTAL_LOCAL_HOST,
	MIC_PORTAL_PRODUCTION_HOST,
	MIC_PORTAL_SLUG,
	micPortalFields,
} from "../portals/helpers";
import {
	ensureOrganization,
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

export interface EnsureFairLendMicPortalResult {
	lenderId: Id<"lenders">;
	micLenderAuthId: string;
	orgId: string;
	portalId: Id<"portals">;
	wasCreated: boolean;
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

async function resolveFairLendBrokerId(
	ctx: MutationCtx,
	brokerId: Id<"brokers"> | undefined
) {
	if (brokerId) {
		const broker = await ctx.db.get(brokerId);
		if (!broker || broker.orgId !== FAIRLEND_BROKERAGE_ORG_ID) {
			throw new ConvexError(
				"FairLend MIC ownership seeding requires a FairLend brokerage broker"
			);
		}
		return brokerId;
	}

	const existingBroker = await ctx.db
		.query("brokers")
		.withIndex("by_org", (q) => q.eq("orgId", FAIRLEND_BROKERAGE_ORG_ID))
		.first();
	if (existingBroker) {
		return existingBroker._id;
	}

	await ensureOrganization(ctx, {
		allowProfilesOutsideOrganization: true,
		externalId: "seed_fairlend_capital",
		name: "FairLend Capital",
		workosId: FAIRLEND_BROKERAGE_ORG_ID,
	});
	const { userId } = await ensureUserByEmail(ctx, {
		address: {
			city: "Toronto",
			postalCode: "M5H1J9",
			streetAddress: "120 King St W",
			unit: "Suite 800",
		},
		authId: seedAuthIdFromEmail("amelia.chan+broker@fairlend.ca"),
		email: "amelia.chan+broker@fairlend.ca",
		firstName: "Amelia",
		lastName: "Chan",
		phoneNumber: "+1-416-555-0101",
	});
	const createdAt = seedTimestamp();
	const createdBrokerId = await ctx.db.insert("brokers", {
		brokerageName: "FairLend Capital",
		createdAt,
		lastTransitionAt: createdAt + 300_000,
		licenseId: "M08001234",
		licenseProvince: "ON",
		onboardedAt: createdAt + 300_000,
		orgId: FAIRLEND_BROKERAGE_ORG_ID,
		status: "active",
		userId,
	});

	await writeCreationJournalEntry(ctx, {
		entityId: createdBrokerId,
		entityType: "broker",
		initialState: "active",
		organizationId: FAIRLEND_BROKERAGE_ORG_ID,
		payload: {
			brokerageName: "FairLend Capital",
			licenseId: "M08001234",
			userId,
		},
		source: SEED_SOURCE,
		timestamp: createdAt,
	});

	return createdBrokerId;
}

async function ensureFairLendMicLender(
	ctx: MutationCtx,
	args: { brokerId?: Id<"brokers">; createdAt: number }
) {
	const { userId } = await ensureUserByEmail(ctx, {
		authId: seedAuthIdFromEmail(FAIRLEND_MIC_LENDER_EMAIL),
		email: FAIRLEND_MIC_LENDER_EMAIL,
		firstName: "FairLend",
		lastName: "MIC",
		phoneNumber: "+1-416-555-0199",
	});
	const resolvedBrokerId = await resolveFairLendBrokerId(ctx, args.brokerId);
	const lender = await upsertFairLendMicLender(ctx, {
		brokerId: resolvedBrokerId,
		createdAt: args.createdAt,
		userId,
	});

	return {
		...lender,
		micLenderAuthId: seedAuthIdFromEmail(FAIRLEND_MIC_LENDER_EMAIL),
	};
}

async function upsertFairLendMicPortal(
	ctx: MutationCtx,
	args: {
		createdAt: number;
		lenderId: Id<"lenders">;
		micLenderAuthId: string;
		orgId?: string;
	}
): Promise<EnsureFairLendMicPortalResult> {
	const existingMicPortals = await ctx.db
		.query("portals")
		.withIndex("by_slug", (q) => q.eq("slug", MIC_PORTAL_SLUG))
		.collect();
	const existingPortal =
		existingMicPortals.find(
			(portal) =>
				portal.localHost === MIC_PORTAL_LOCAL_HOST ||
				portal.productionHost === MIC_PORTAL_PRODUCTION_HOST
		) ??
		existingMicPortals.find((portal) => portal.status === "active") ??
		existingMicPortals[0];
	const orgId =
		args.orgId ?? existingPortal?.orgId ?? FAIRLEND_BROKERAGE_ORG_ID;
	const fields = {
		...micPortalFields({
			micLenderAuthId: args.micLenderAuthId,
			now: args.createdAt,
			orgId,
		}),
		lenderId: args.lenderId,
	};

	if (existingPortal) {
		await ctx.db.patch(existingPortal._id, {
			defaultPostAuthPath: MIC_PORTAL_DEFAULT_POST_AUTH_PATH,
			isPublished: fields.isPublished,
			lenderId: fields.lenderId,
			localHost: fields.localHost,
			micLenderAuthId: fields.micLenderAuthId,
			orgId: fields.orgId,
			portalType: fields.portalType,
			productionHost: fields.productionHost,
			publicTeaserEnabled: fields.publicTeaserEnabled,
			slug: fields.slug,
			status: fields.status,
			teaserListingLimit: fields.teaserListingLimit,
			updatedAt: Date.now(),
		});
		return {
			lenderId: args.lenderId,
			micLenderAuthId: args.micLenderAuthId,
			orgId,
			portalId: existingPortal._id,
			wasCreated: false,
		};
	}

	const portalId = await ctx.db.insert("portals", fields);
	return {
		lenderId: args.lenderId,
		micLenderAuthId: args.micLenderAuthId,
		orgId,
		portalId,
		wasCreated: true,
	};
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
		legalName: FAIRLEND_MIC_INVESTMENT_VEHICLE_LEGAL_NAME,
		lenderId: args.lenderId,
		name: FAIRLEND_MIC_INVESTMENT_VEHICLE_NAME,
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
	args: {
		createdAt: number;
		investmentVehicleId: Id<"investmentVehicles">;
		preferredTrustBankAccountId?: Id<"bankAccounts">;
	}
) {
	const existingTrustBankAccounts = await ctx.db
		.query("bankAccounts")
		.withIndex("by_owner", (q) =>
			q.eq("ownerType", "trust").eq("ownerId", String(args.investmentVehicleId))
		)
		.collect();
	const preferredTrustBankAccount = args.preferredTrustBankAccountId
		? existingTrustBankAccounts.find(
				(account) => account._id === args.preferredTrustBankAccountId
			)
		: undefined;
	if (preferredTrustBankAccount) {
		return {
			trustBankAccountId: preferredTrustBankAccount._id,
			wasCreated: false,
		};
	}

	const reusableTrustBankAccount =
		[...existingTrustBankAccounts]
			.filter((account) => account.status === "validated")
			.sort(
				(left, right) =>
					left.createdAt - right.createdAt ||
					String(left._id).localeCompare(String(right._id))
			)
			.at(0) ??
		[...existingTrustBankAccounts]
			.sort(
				(left, right) =>
					left.createdAt - right.createdAt ||
					String(left._id).localeCompare(String(right._id))
			)
			.at(0);
	if (reusableTrustBankAccount) {
		return {
			trustBankAccountId: reusableTrustBankAccount._id,
			wasCreated: false,
		};
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
		const lender = await ensureFairLendMicLender(ctx, {
			brokerId: args.brokerId,
			createdAt,
		});
		const investmentVehicle = await upsertFairLendMicVehicle(ctx, {
			createdAt,
			lenderId: lender.lenderId,
		});
		const workspace = await upsertFairLendMicWorkspace(ctx, {
			createdAt,
			investmentVehicleId: investmentVehicle.investmentVehicleId,
		});
		const existingSettings = await ctx.db
			.query("platformSettings")
			.withIndex("by_key", (q) => q.eq("key", "default"))
			.unique();
		const trustBankAccount = await upsertFairLendMicTrustAccount(ctx, {
			createdAt,
			investmentVehicleId: investmentVehicle.investmentVehicleId,
			preferredTrustBankAccountId:
				existingSettings?.defaultFairlendTrustBankAccountId,
		});

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

export const ensureFairLendMicPortal = adminMutation
	.input({
		brokerId: v.optional(v.id("brokers")),
		orgId: v.optional(v.string()),
	})
	.handler(async (ctx, args): Promise<EnsureFairLendMicPortalResult> => {
		const createdAt = seedTimestamp(18_000_000);
		const lender = await ensureFairLendMicLender(ctx, {
			brokerId: args.brokerId,
			createdAt,
		});
		return await upsertFairLendMicPortal(ctx, {
			createdAt,
			lenderId: lender.lenderId,
			micLenderAuthId: lender.micLenderAuthId,
			orgId: args.orgId,
		});
	})
	.public();
