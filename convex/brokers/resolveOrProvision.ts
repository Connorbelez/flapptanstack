import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type BrokerReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;
type BrokerWriterCtx = Pick<MutationCtx, "db">;

export interface ResolveOrProvisionBrokerInput {
	applicationId?: Id<"brokerOnboardingApplications">;
	brokerageName?: string | null;
	invitedByBrokerId?: string;
	licenseId?: string | null;
	licenseProvince?: string | null;
	now: number;
	referralSource?: "broker_invite" | "self_signup";
	targetOrganizationId: string;
	userId: Id<"users">;
}

export interface ResolveOrProvisionBrokerResult {
	broker: Doc<"brokers">;
	wasCreated: boolean;
	wasPatched: boolean;
}

interface BrokerActivationPatch {
	brokerageName?: string;
	brokerOnboardingApplicationId?: Id<"brokerOnboardingApplications">;
	invitedByBrokerId?: string;
	lastTransitionAt: number;
	licenseId: string;
	licenseProvince?: string;
	onboardedAt: number;
	orgId: string;
	referralSource: "broker_invite" | "self_signup";
	status: string;
	updatedAt: number;
}

function normalizeLicenseId(value?: string | null) {
	const normalized = value?.trim().toUpperCase();
	return normalized ? normalized : undefined;
}

function normalizeOptionalString(value?: string | null) {
	const normalized = value?.trim();
	return normalized ? normalized : undefined;
}

async function collectBrokersByLicense(
	ctx: BrokerReaderCtx,
	licenseId: string
) {
	return ctx.db
		.query("brokers")
		.withIndex("by_license", (query) => query.eq("licenseId", licenseId))
		.collect();
}

async function getUniqueBrokerByLicense(
	ctx: BrokerReaderCtx,
	licenseId: string
) {
	const brokers = await collectBrokersByLicense(ctx, licenseId);
	if (brokers.length > 1) {
		throw new ConvexError(
			"Multiple broker rows already exist for this verified license"
		);
	}
	return brokers[0] ?? null;
}

async function getUniqueBrokerByUser(
	ctx: BrokerReaderCtx,
	userId: Id<"users">
) {
	const brokers = await ctx.db
		.query("brokers")
		.withIndex("by_user", (query) => query.eq("userId", userId))
		.collect();
	if (brokers.length > 1) {
		throw new ConvexError(
			"Multiple broker rows already exist for this verified user"
		);
	}
	return brokers[0] ?? null;
}

async function getUniqueBrokerByOrg(ctx: BrokerReaderCtx, orgId: string) {
	const brokers = await ctx.db
		.query("brokers")
		.withIndex("by_org", (query) => query.eq("orgId", orgId))
		.collect();
	if (brokers.length > 1) {
		throw new ConvexError(
			"Multiple broker rows already exist for this organization"
		);
	}
	return brokers[0] ?? null;
}

function assertBrokerCompatible(
	broker: Doc<"brokers">,
	args: {
		licenseId?: string;
		orgId: string;
		userId: Id<"users">;
	}
) {
	if (broker.userId !== args.userId) {
		throw new ConvexError(
			"Existing broker identity belongs to a different user"
		);
	}
	if (broker.orgId && broker.orgId !== args.orgId) {
		throw new ConvexError(
			"Existing broker identity belongs to a different organization"
		);
	}
	if (
		broker.licenseId &&
		args.licenseId &&
		broker.licenseId !== args.licenseId
	) {
		throw new ConvexError(
			"Existing broker identity has a conflicting verified license"
		);
	}
}

function buildBrokerPatch(args: ResolveOrProvisionBrokerInput) {
	const licenseId = normalizeLicenseId(args.licenseId);
	if (!licenseId) {
		throw new ConvexError(
			"Verified broker license is required for broker activation"
		);
	}
	const patch: BrokerActivationPatch = {
		brokerageName: normalizeOptionalString(args.brokerageName),
		invitedByBrokerId: args.invitedByBrokerId,
		lastTransitionAt: args.now,
		licenseId,
		licenseProvince: normalizeOptionalString(args.licenseProvince),
		onboardedAt: args.now,
		orgId: args.targetOrganizationId,
		referralSource: args.referralSource ?? "self_signup",
		status: "active",
		updatedAt: args.now,
	};
	if (args.applicationId) {
		patch.brokerOnboardingApplicationId = args.applicationId;
	}

	return patch;
}

function hasMaterialBrokerActivationChanges(
	broker: Doc<"brokers">,
	patch: BrokerActivationPatch
) {
	return (
		broker.brokerageName !== patch.brokerageName ||
		broker.brokerOnboardingApplicationId !==
			patch.brokerOnboardingApplicationId ||
		broker.invitedByBrokerId !== patch.invitedByBrokerId ||
		broker.licenseId !== patch.licenseId ||
		broker.licenseProvince !== patch.licenseProvince ||
		broker.onboardedAt !== patch.onboardedAt ||
		broker.orgId !== patch.orgId ||
		broker.referralSource !== patch.referralSource ||
		broker.status !== patch.status
	);
}

async function patchBrokerForActivation(
	ctx: BrokerWriterCtx,
	broker: Doc<"brokers">,
	args: ResolveOrProvisionBrokerInput
) {
	const licenseId = normalizeLicenseId(args.licenseId);
	assertBrokerCompatible(broker, {
		licenseId,
		orgId: args.targetOrganizationId,
		userId: args.userId,
	});
	const patch = buildBrokerPatch(args);
	const wasPatched = hasMaterialBrokerActivationChanges(broker, patch);
	await ctx.db.patch(broker._id, patch);
	const patchedBroker = await ctx.db.get(broker._id);
	if (!patchedBroker) {
		throw new ConvexError("Broker record disappeared during activation");
	}
	return {
		broker: patchedBroker,
		wasPatched,
	};
}

export async function resolveOrProvisionBrokerForActivation(
	ctx: BrokerWriterCtx,
	args: ResolveOrProvisionBrokerInput
): Promise<ResolveOrProvisionBrokerResult> {
	const licenseId = normalizeLicenseId(args.licenseId);
	if (!licenseId) {
		throw new ConvexError(
			"Verified broker license is required for broker activation"
		);
	}

	const byLicense = await getUniqueBrokerByLicense(ctx, licenseId);
	if (byLicense) {
		const patchResult = await patchBrokerForActivation(ctx, byLicense, args);
		return {
			broker: patchResult.broker,
			wasCreated: false,
			wasPatched: patchResult.wasPatched,
		};
	}

	const byUser = await getUniqueBrokerByUser(ctx, args.userId);
	if (byUser) {
		const patchResult = await patchBrokerForActivation(ctx, byUser, args);
		return {
			broker: patchResult.broker,
			wasCreated: false,
			wasPatched: patchResult.wasPatched,
		};
	}

	const byOrg = await getUniqueBrokerByOrg(ctx, args.targetOrganizationId);
	if (byOrg) {
		const patchResult = await patchBrokerForActivation(ctx, byOrg, args);
		return {
			broker: patchResult.broker,
			wasCreated: false,
			wasPatched: patchResult.wasPatched,
		};
	}

	const brokerId = await ctx.db.insert("brokers", {
		...buildBrokerPatch(args),
		createdAt: args.now,
		userId: args.userId,
	});
	const broker = await ctx.db.get(brokerId);
	if (!broker) {
		throw new ConvexError("Broker record could not be created");
	}

	return {
		broker,
		wasPatched: false,
		wasCreated: true,
	};
}
