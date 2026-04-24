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
	await ctx.db.patch(broker._id, buildBrokerPatch(args));
	const patchedBroker = await ctx.db.get(broker._id);
	if (!patchedBroker) {
		throw new ConvexError("Broker record disappeared during activation");
	}
	return patchedBroker;
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
		return {
			broker: await patchBrokerForActivation(ctx, byLicense, args),
			wasCreated: false,
		};
	}

	const byUser = await getUniqueBrokerByUser(ctx, args.userId);
	if (byUser) {
		return {
			broker: await patchBrokerForActivation(ctx, byUser, args),
			wasCreated: false,
		};
	}

	const byOrg = await getUniqueBrokerByOrg(ctx, args.targetOrganizationId);
	if (byOrg) {
		return {
			broker: await patchBrokerForActivation(ctx, byOrg, args),
			wasCreated: false,
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
		wasCreated: true,
	};
}
