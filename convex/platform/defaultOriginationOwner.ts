import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { FAIRLEND_BROKERAGE_ORG_ID } from "../constants";
import { appendAuditJournalEntry } from "../engine/auditJournal";
import type { ActorType, CommandChannel } from "../engine/types";
import { adminMutation, adminQuery } from "../fluent";
import {
	FAIRLEND_MIC_INVESTMENT_VEHICLE_LEGAL_NAME,
	FAIRLEND_MIC_INVESTMENT_VEHICLE_NAME,
	FAIRLEND_MIC_LENDER_EMAIL,
} from "./defaultOriginationOwnerContract";

const PLATFORM_SETTINGS_KEY = "default";

interface DefaultOriginationOwnerCtx {
	db: QueryCtx["db"] | MutationCtx["db"];
}

interface DefaultOriginationOwnerLinkArgs {
	defaultFairlendTrustBankAccountId?: Id<"bankAccounts">;
	defaultOriginationInvestmentVehicleId: Id<"investmentVehicles">;
	defaultOriginationLenderId: Id<"lenders">;
	defaultOriginationWorkspaceId?: Id<"investmentVehicleWorkspaces">;
}

type UpsertDefaultOriginationOwnerArgs = DefaultOriginationOwnerLinkArgs & {
	actorId: string;
	actorType: ActorType;
	changeReason: string;
	channel: CommandChannel;
	source: "seed" | "admin_mutation" | "migration";
};

function snapshotPlatformSettings(
	settings: Pick<
		Doc<"platformSettings">,
		| "changeReason"
		| "createdAt"
		| "defaultFairlendTrustBankAccountId"
		| "defaultOriginationInvestmentVehicleId"
		| "defaultOriginationLenderId"
		| "defaultOriginationWorkspaceId"
		| "key"
		| "source"
		| "updatedAt"
		| "updatedBy"
	>
) {
	return {
		changeReason: settings.changeReason,
		createdAt: settings.createdAt,
		defaultFairlendTrustBankAccountId:
			settings.defaultFairlendTrustBankAccountId,
		defaultOriginationInvestmentVehicleId:
			settings.defaultOriginationInvestmentVehicleId,
		defaultOriginationLenderId: settings.defaultOriginationLenderId,
		defaultOriginationWorkspaceId: settings.defaultOriginationWorkspaceId,
		key: settings.key,
		source: settings.source,
		updatedAt: settings.updatedAt,
		updatedBy: settings.updatedBy,
	};
}

function missingDefaultOriginationOwnerError() {
	return new ConvexError({
		code: "DEFAULT_ORIGINATION_OWNER_MISSING",
		message: "platformSettings.default has not been configured",
	});
}

function invalidDefaultOriginationOwnerError(message: string) {
	return new ConvexError({
		code: "DEFAULT_ORIGINATION_OWNER_INVALID",
		message,
	});
}

function normalizeConfiguredEmail(email?: string) {
	return email?.trim().toLowerCase();
}

async function resolveDefaultOriginationOwnerLinks(
	ctx: DefaultOriginationOwnerCtx,
	args: DefaultOriginationOwnerLinkArgs
) {
	const [lender, investmentVehicle, workspace, trustBankAccount] =
		await Promise.all([
			ctx.db.get(args.defaultOriginationLenderId),
			ctx.db.get(args.defaultOriginationInvestmentVehicleId),
			args.defaultOriginationWorkspaceId
				? ctx.db.get(args.defaultOriginationWorkspaceId)
				: Promise.resolve(null),
			args.defaultFairlendTrustBankAccountId
				? ctx.db.get(args.defaultFairlendTrustBankAccountId)
				: Promise.resolve(null),
		]);

	if (!lender || lender.status !== "active") {
		throw invalidDefaultOriginationOwnerError(
			"Configured lender is missing or inactive"
		);
	}

	const [broker, lenderUser] = await Promise.all([
		ctx.db.get(lender.brokerId),
		ctx.db.get(lender.userId),
	]);
	if (
		!broker ||
		broker.orgId !== FAIRLEND_BROKERAGE_ORG_ID ||
		lender.orgId !== FAIRLEND_BROKERAGE_ORG_ID
	) {
		throw invalidDefaultOriginationOwnerError(
			"Configured lender must belong to the FairLend brokerage org"
		);
	}

	if (
		!lenderUser ||
		normalizeConfiguredEmail(lenderUser.email) !== FAIRLEND_MIC_LENDER_EMAIL
	) {
		throw invalidDefaultOriginationOwnerError(
			"Configured lender must be the canonical FairLend MIC owner"
		);
	}

	if (
		!investmentVehicle ||
		investmentVehicle.lenderId !== args.defaultOriginationLenderId
	) {
		throw invalidDefaultOriginationOwnerError(
			"Configured investment vehicle is not linked to the configured lender"
		);
	}

	if (investmentVehicle.entityType !== "mic") {
		throw invalidDefaultOriginationOwnerError(
			"Configured investment vehicle must be a MIC"
		);
	}

	if (
		investmentVehicle.name !== FAIRLEND_MIC_INVESTMENT_VEHICLE_NAME ||
		investmentVehicle.legalName !== FAIRLEND_MIC_INVESTMENT_VEHICLE_LEGAL_NAME
	) {
		throw invalidDefaultOriginationOwnerError(
			"Configured investment vehicle must be the canonical FairLend MIC"
		);
	}

	if (args.defaultOriginationWorkspaceId && !workspace) {
		throw invalidDefaultOriginationOwnerError(
			"Configured workspace is missing"
		);
	}

	if (
		workspace &&
		workspace.investmentVehicleId !== args.defaultOriginationInvestmentVehicleId
	) {
		throw invalidDefaultOriginationOwnerError(
			"Configured workspace is not linked to the configured investment vehicle"
		);
	}

	if (args.defaultFairlendTrustBankAccountId && !trustBankAccount) {
		throw invalidDefaultOriginationOwnerError(
			"Configured trust account is missing"
		);
	}

	if (
		trustBankAccount &&
		!(
			trustBankAccount.ownerType === "trust" &&
			trustBankAccount.ownerId ===
				String(args.defaultOriginationInvestmentVehicleId)
		)
	) {
		throw invalidDefaultOriginationOwnerError(
			"Configured trust account is not owned by the configured investment vehicle"
		);
	}

	if (trustBankAccount && trustBankAccount.status !== "validated") {
		throw invalidDefaultOriginationOwnerError(
			"Configured trust account is not validated"
		);
	}

	return {
		investmentVehicle,
		lender,
		trustBankAccount,
		workspace,
	};
}

export async function getRequiredDefaultOriginationOwner(
	ctx: DefaultOriginationOwnerCtx
) {
	const settings = await ctx.db
		.query("platformSettings")
		.withIndex("by_key", (q) => q.eq("key", PLATFORM_SETTINGS_KEY))
		.unique();

	if (!settings) {
		throw missingDefaultOriginationOwnerError();
	}

	const resolved = await resolveDefaultOriginationOwnerLinks(ctx, {
		defaultFairlendTrustBankAccountId:
			settings.defaultFairlendTrustBankAccountId,
		defaultOriginationInvestmentVehicleId:
			settings.defaultOriginationInvestmentVehicleId,
		defaultOriginationLenderId: settings.defaultOriginationLenderId,
		defaultOriginationWorkspaceId: settings.defaultOriginationWorkspaceId,
	});

	return {
		settings,
		...resolved,
	};
}

function isDefaultOriginationOwnerLinkConfigUnchanged(
	existing: Doc<"platformSettings">,
	args: DefaultOriginationOwnerLinkArgs
): boolean {
	return (
		existing.defaultOriginationLenderId === args.defaultOriginationLenderId &&
		existing.defaultOriginationInvestmentVehicleId ===
			args.defaultOriginationInvestmentVehicleId &&
		existing.defaultOriginationWorkspaceId ===
			args.defaultOriginationWorkspaceId &&
		existing.defaultFairlendTrustBankAccountId ===
			args.defaultFairlendTrustBankAccountId
	);
}

export async function upsertDefaultOriginationOwner(
	ctx: MutationCtx,
	args: UpsertDefaultOriginationOwnerArgs
) {
	const now = Date.now();
	const existing = await ctx.db
		.query("platformSettings")
		.withIndex("by_key", (q) => q.eq("key", PLATFORM_SETTINGS_KEY))
		.unique();

	const resolved = await resolveDefaultOriginationOwnerLinks(ctx, args);
	if (
		existing &&
		isDefaultOriginationOwnerLinkConfigUnchanged(existing, args)
	) {
		return { settings: existing };
	}

	const beforeState = existing ? snapshotPlatformSettings(existing) : undefined;
	const nextSettingsFields = {
		key: PLATFORM_SETTINGS_KEY,
		defaultOriginationLenderId: args.defaultOriginationLenderId,
		defaultOriginationInvestmentVehicleId:
			args.defaultOriginationInvestmentVehicleId,
		defaultOriginationWorkspaceId: args.defaultOriginationWorkspaceId,
		defaultFairlendTrustBankAccountId: args.defaultFairlendTrustBankAccountId,
		updatedBy: args.actorId,
		changeReason: args.changeReason,
		source: args.source,
		updatedAt: now,
	};

	let settingsId: Id<"platformSettings">;
	if (existing) {
		await ctx.db.patch(existing._id, nextSettingsFields);
		settingsId = existing._id;
	} else {
		settingsId = await ctx.db.insert("platformSettings", {
			...nextSettingsFields,
			createdAt: now,
		});
	}

	const settings = await ctx.db.get(settingsId);
	if (!settings) {
		throw new Error("Expected platform settings to exist after upsert");
	}
	const afterState = snapshotPlatformSettings(settings);

	await appendAuditJournalEntry(ctx, {
		actorId: args.actorId,
		actorType: args.actorType,
		channel: args.channel,
		entityId: String(settingsId),
		entityType: "platformSetting",
		afterState,
		eventCategory: "configuration",
		eventType: "DEFAULT_ORIGINATION_OWNER_SET",
		newState: "configured",
		organizationId: resolved.lender.orgId,
		outcome: "transitioned",
		payload: {
			after: afterState,
			before: beforeState ?? null,
			changeReason: args.changeReason,
			source: args.source,
		},
		beforeState,
		previousState: existing ? "configured" : "none",
		timestamp: now,
	});

	return { settings };
}

export const getDefaultOriginationOwner = adminQuery
	.handler(async (ctx) => {
		return getRequiredDefaultOriginationOwner(ctx);
	})
	.public();

export const setDefaultOriginationOwner = adminMutation
	.input({
		changeReason: v.string(),
		defaultOriginationInvestmentVehicleId: v.id("investmentVehicles"),
		defaultOriginationLenderId: v.id("lenders"),
		defaultOriginationWorkspaceId: v.optional(
			v.id("investmentVehicleWorkspaces")
		),
		defaultFairlendTrustBankAccountId: v.optional(v.id("bankAccounts")),
	})
	.handler(async (ctx, args) => {
		return upsertDefaultOriginationOwner(ctx, {
			...args,
			actorId: ctx.viewer.authId,
			actorType: "admin",
			channel: "admin_dashboard",
			source: "admin_mutation",
		});
	})
	.public();
