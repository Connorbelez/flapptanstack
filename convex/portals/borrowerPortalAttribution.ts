import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getPortalByBrokerId } from "./homePortalAssignment";

type PortalReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;
type PortalWriterCtx = Pick<MutationCtx, "db">;

export async function getDeterministicPortalIdForOrgId(
	ctx: PortalReaderCtx,
	orgId: string
) {
	const livePublishedPortals = (
		await ctx.db
			.query("portals")
			.withIndex("by_org", (query) => query.eq("orgId", orgId))
			.collect()
	).filter((portal) => portal.status === "active" && portal.isPublished);

	if (livePublishedPortals.length !== 1) {
		return undefined;
	}

	return livePublishedPortals[0]?._id;
}

export async function getLatestOnboardingPortalIdForUser(
	ctx: PortalReaderCtx,
	userId: Id<"users">
) {
	const requests = await ctx.db
		.query("onboardingRequests")
		.withIndex("by_user", (query) => query.eq("userId", userId))
		.collect();

	const attributedRequests = requests
		.filter(
			(request): request is typeof request & { portalId: Id<"portals"> } =>
				request.portalId !== undefined
		)
		.sort((left, right) => {
			if (left.createdAt !== right.createdAt) {
				return right.createdAt - left.createdAt;
			}
			return String(right._id).localeCompare(String(left._id));
		});

	return attributedRequests[0]?.portalId;
}

export async function resolveBorrowerPortalIdForWrite(
	ctx: PortalReaderCtx,
	args: {
		brokerId?: Id<"brokers">;
		explicitPortalId?: Id<"portals">;
		orgId?: string;
		userId: Id<"users">;
	}
) {
	if (args.explicitPortalId) {
		return args.explicitPortalId;
	}

	if (args.brokerId) {
		const brokerPortal = await getPortalByBrokerId(ctx, args.brokerId);
		if (brokerPortal) {
			return brokerPortal._id;
		}
	}

	if (args.orgId) {
		return getDeterministicPortalIdForOrgId(ctx, args.orgId);
	}

	return undefined;
}

export async function resolveOnboardingRequestPortalIdForBackfill(
	ctx: PortalReaderCtx,
	onboardingRequest: Doc<"onboardingRequests">
) {
	if (onboardingRequest.portalId) {
		return onboardingRequest.portalId;
	}

	if (!onboardingRequest.targetOrganizationId) {
		return undefined;
	}

	return getDeterministicPortalIdForOrgId(
		ctx,
		onboardingRequest.targetOrganizationId
	);
}

export async function resolveBorrowerPortalIdForBackfill(
	ctx: PortalReaderCtx,
	borrower: Doc<"borrowers">
) {
	if (borrower.portalId) {
		return borrower.portalId;
	}

	const onboardingPortalId = await getLatestOnboardingPortalIdForUser(
		ctx,
		borrower.userId
	);
	if (onboardingPortalId) {
		return onboardingPortalId;
	}

	if (!borrower.orgId) {
		return undefined;
	}

	return getDeterministicPortalIdForOrgId(ctx, borrower.orgId);
}

export async function ensureBorrowerPortalAttribution(
	ctx: PortalWriterCtx,
	args: {
		borrower: Doc<"borrowers">;
		portalId?: Id<"portals">;
	}
) {
	if (!args.portalId) {
		return args.borrower;
	}

	if (args.borrower.portalId && args.borrower.portalId !== args.portalId) {
		throw new ConvexError(
			"A borrower linked to this user already exists in another portal for this organization"
		);
	}

	if (!args.borrower.portalId) {
		await ctx.db.patch(args.borrower._id, { portalId: args.portalId });
		return {
			...args.borrower,
			portalId: args.portalId,
		};
	}

	return args.borrower;
}
