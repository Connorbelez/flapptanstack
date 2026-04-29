import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
	buildPortalHosts,
	DEFAULT_PORTAL_POST_AUTH_PATH,
	DEFAULT_PORTAL_TEASER_LIMIT,
	isReservedPortalSlug,
	normalizePortalSlug,
} from "../portals/helpers";
import {
	getPortalByBrokerId,
	getPortalByOrgId,
	syncUserHomePortalAssignmentByUserId,
} from "../portals/homePortalAssignment";
import { assertPortalRegistryInvariants } from "../portals/invariants";
import {
	ensureBrokerPortalPricingSetting,
	ensurePortalSelectedPricingPolicy,
} from "../portals/pricing";
import { resolveOrProvisionBrokerForActivation } from "./resolveOrProvision";

type BrokerActivationReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;
type BrokerActivationWriterCtx = Pick<MutationCtx, "db">;

export interface BrokerActivationOutcome {
	activatedAt: number;
	brokerId: Id<"brokers">;
	brokerWasCreated: boolean;
	homePortalId: Id<"portals">;
	onboardingRequestId: Id<"onboardingRequests">;
	portalId: Id<"portals">;
	portalWasCreated: boolean;
	targetOrganizationId: string;
	userId: Id<"users">;
}

interface BrokerPortalUpsertResult {
	portal: Doc<"portals">;
	wasCreated: boolean;
}

function normalizeEmail(value?: string | null) {
	const normalized = value?.trim().toLowerCase();
	return normalized ? normalized : undefined;
}

function requireVerifiedApplicationEmail(args: {
	application: Doc<"brokerOnboardingApplications">;
	user: Doc<"users">;
}) {
	const snapshotEmail = normalizeEmail(
		args.application.verificationSnapshot?.emailVerification.email
	);
	const applicationEmail = normalizeEmail(args.application.verifiedEmail);
	const userEmail = normalizeEmail(args.user.email);

	if (
		args.application.verificationSnapshot?.emailVerification.status !==
		"verified"
	) {
		throw new ConvexError(
			"Broker activation requires verified WorkOS email evidence"
		);
	}

	const verifiedEmail = applicationEmail ?? snapshotEmail;
	if (!verifiedEmail) {
		throw new ConvexError("Broker activation requires a verified email");
	}
	if (snapshotEmail && snapshotEmail !== verifiedEmail) {
		throw new ConvexError(
			"Broker activation email evidence conflicts with the application email"
		);
	}
	if (userEmail && userEmail !== verifiedEmail) {
		throw new ConvexError(
			"Broker activation email evidence conflicts with the canonical user"
		);
	}

	return verifiedEmail;
}

function requireActiveRegulatorEvidence(
	application: Doc<"brokerOnboardingApplications">
) {
	const regulator = application.verificationSnapshot?.regulator;
	if (!regulator || regulator.status !== "active") {
		throw new ConvexError(
			"Broker activation requires active regulator evidence"
		);
	}
	if (!regulator.licenseNumber?.trim()) {
		throw new ConvexError(
			"Broker activation requires a verified regulator license number"
		);
	}
	return regulator;
}

function requireVerifiedIdentityEvidence(
	application: Doc<"brokerOnboardingApplications">
) {
	const identity = application.verificationSnapshot?.identityVerification;
	if (!identity || identity.status !== "verified" || identity.fraudSignal) {
		throw new ConvexError(
			"Broker activation requires verified IDV evidence without fraud signals"
		);
	}
	return identity;
}

function requireRequestedPortalSlug(
	application: Doc<"brokerOnboardingApplications">
) {
	const slug = normalizePortalSlug(
		application.draftData.requestedPortalSlug ?? ""
	);
	if (!slug) {
		throw new ConvexError("Broker activation requires a requested portal slug");
	}
	if (isReservedPortalSlug(slug)) {
		throw new ConvexError(`Portal slug "${slug}" is reserved`);
	}
	return slug;
}

async function selectExistingBrokerPortal(
	ctx: BrokerActivationReaderCtx,
	args: {
		brokerId: Id<"brokers">;
		orgId: string;
	}
) {
	const byBroker = await getPortalByBrokerId(ctx, args.brokerId);
	const byOrg = await getPortalByOrgId(ctx, args.orgId);

	if (byBroker && byOrg && byBroker._id !== byOrg._id) {
		throw new ConvexError(
			"Broker activation found conflicting broker and organization portals"
		);
	}
	const portal = byBroker ?? byOrg;
	if (portal?.brokerId && portal.brokerId !== args.brokerId) {
		throw new ConvexError(
			"Broker activation portal is already linked to a different broker"
		);
	}
	return portal;
}

export async function ensureBrokerPortalForActivation(
	ctx: BrokerActivationWriterCtx,
	args: {
		broker: Doc<"brokers">;
		now: number;
		orgId: string;
		requestedSlug: string;
	}
): Promise<BrokerPortalUpsertResult> {
	const slug = normalizePortalSlug(args.requestedSlug);
	if (!slug) {
		throw new ConvexError("Broker portal slug cannot be empty");
	}
	if (isReservedPortalSlug(slug)) {
		throw new ConvexError(`Portal slug "${slug}" is reserved`);
	}

	const existingPortal = await selectExistingBrokerPortal(ctx, {
		brokerId: args.broker._id,
		orgId: args.orgId,
	});
	const normalizedPortal = await assertPortalRegistryInvariants(ctx, {
		brokerId: args.broker._id,
		currentPortalId: existingPortal?._id,
		...buildPortalHosts(slug),
		orgId: args.orgId,
		slug,
	});
	const setting = await ensureBrokerPortalPricingSetting(ctx);

	if (existingPortal) {
		await ctx.db.patch(existingPortal._id, {
			...normalizedPortal,
			brokerId: args.broker._id,
			defaultPostAuthPath:
				existingPortal.defaultPostAuthPath ?? DEFAULT_PORTAL_POST_AUTH_PATH,
			isPublished: true,
			portalType: "broker",
			publicTeaserEnabled: true,
			status: "active",
			teaserListingLimit:
				existingPortal.teaserListingLimit ?? DEFAULT_PORTAL_TEASER_LIMIT,
			updatedAt: args.now,
		});
		await ensurePortalSelectedPricingPolicy(ctx, {
			brokerSplitPercent: setting.brokerSplitPercent,
			portalId: existingPortal._id,
		});
		const portal = await ctx.db.get(existingPortal._id);
		if (!portal) {
			throw new ConvexError("Broker portal disappeared during activation");
		}
		return { portal, wasCreated: false };
	}

	const portalId = await ctx.db.insert("portals", {
		...normalizedPortal,
		brokerId: args.broker._id,
		createdAt: args.now,
		defaultPostAuthPath: DEFAULT_PORTAL_POST_AUTH_PATH,
		isPublished: true,
		portalType: "broker",
		publicTeaserEnabled: true,
		status: "active",
		teaserListingLimit: DEFAULT_PORTAL_TEASER_LIMIT,
		updatedAt: args.now,
	});
	await ensurePortalSelectedPricingPolicy(ctx, {
		brokerSplitPercent: setting.brokerSplitPercent,
		portalId,
	});
	const portal = await ctx.db.get(portalId);
	if (!portal) {
		throw new ConvexError("Broker portal could not be created");
	}

	return { portal, wasCreated: true };
}

export async function activateBrokerForApprovedApplication(
	ctx: BrokerActivationWriterCtx,
	args: {
		application: Doc<"brokerOnboardingApplications">;
		downstreamRequest: Doc<"onboardingRequests">;
		now: number;
	}
): Promise<BrokerActivationOutcome> {
	if (args.downstreamRequest.status !== "role_assigned") {
		throw new ConvexError(
			"Broker activation requires downstream role assignment to complete"
		);
	}
	if (args.downstreamRequest.requestedRole !== "broker") {
		throw new ConvexError("Broker activation requires a broker request");
	}
	if (
		args.downstreamRequest.brokerOnboardingApplicationId !==
		args.application._id
	) {
		throw new ConvexError(
			"Broker activation request is not linked to the application"
		);
	}
	if (!args.downstreamRequest.targetOrganizationId?.trim()) {
		throw new ConvexError(
			"Broker activation requires a downstream target organization"
		);
	}

	const user = await ctx.db.get(args.application.userId);
	if (!user) {
		throw new ConvexError("Broker activation user not found");
	}
	if (args.downstreamRequest.userId !== user._id) {
		throw new ConvexError(
			"Broker activation request belongs to a different user"
		);
	}

	requireVerifiedApplicationEmail({ application: args.application, user });
	const regulator = requireActiveRegulatorEvidence(args.application);
	requireVerifiedIdentityEvidence(args.application);
	const requestedSlug = requireRequestedPortalSlug(args.application);
	const brokerResult = await resolveOrProvisionBrokerForActivation(ctx, {
		applicationId: args.application._id,
		brokerageName:
			regulator.brokerageName ?? args.application.draftData.brokerageName,
		invitedByBrokerId: args.application.invitedByBrokerId,
		licenseId: regulator.licenseNumber,
		licenseProvince:
			regulator.licenseProvince ?? args.application.draftData.licenseProvince,
		now: args.now,
		referralSource: args.application.referralSource,
		targetOrganizationId: args.downstreamRequest.targetOrganizationId,
		userId: user._id,
	});
	const portalResult = await ensureBrokerPortalForActivation(ctx, {
		broker: brokerResult.broker,
		now: args.now,
		orgId: args.downstreamRequest.targetOrganizationId,
		requestedSlug,
	});

	await ctx.db.patch(brokerResult.broker._id, {
		activatedPortalId: portalResult.portal._id,
		updatedAt: args.now,
	});

	const homePortalSync = await syncUserHomePortalAssignmentByUserId(
		ctx,
		user._id
	);
	if (!homePortalSync) {
		throw new ConvexError("Broker activation home portal sync failed");
	}
	if (homePortalSync.homePortalId !== portalResult.portal._id) {
		throw new ConvexError(
			"Broker activation did not synchronize the broker portal as home portal"
		);
	}

	return {
		activatedAt: args.now,
		brokerId: brokerResult.broker._id,
		brokerWasCreated: brokerResult.wasCreated,
		homePortalId: homePortalSync.homePortalId,
		onboardingRequestId: args.downstreamRequest._id,
		portalId: portalResult.portal._id,
		portalWasCreated: portalResult.wasCreated,
		targetOrganizationId: args.downstreamRequest.targetOrganizationId,
		userId: user._id,
	};
}
