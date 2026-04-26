import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
	deleteOrphanUsersByAuthId,
	findCanonicalUserByAuthId,
} from "../users/byAuthId";
import { getDeterministicPortalIdForOrgId } from "./borrowerPortalAttribution";
import {
	FAIRLEND_PORTAL_LOCAL_HOST,
	FAIRLEND_PORTAL_PRODUCTION_HOST,
	FAIRLEND_PORTAL_SLUG,
	fairLendPortalFields,
} from "./helpers";
import { assertPortalRegistryInvariants } from "./invariants";
import { ensurePortalSelectedPricingPolicy } from "./pricing";

type PortalReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;
type PortalWriterCtx = Pick<MutationCtx, "db">;
type PortalLookupIndex =
	| "by_slug"
	| "by_production_host"
	| "by_local_host"
	| "by_broker"
	| "by_org";
type PortalLookupField =
	| "slug"
	| "productionHost"
	| "localHost"
	| "brokerId"
	| "orgId";

async function assertSinglePortal(
	ctx: PortalReaderCtx,
	tableLabel: string,
	indexName: PortalLookupIndex,
	fieldName: PortalLookupField,
	value: string | Id<"brokers">
): Promise<Doc<"portals"> | null> {
	const rows = await ctx.db
		.query("portals")
		.withIndex(indexName, (query) => query.eq(fieldName, value))
		.collect();
	if (rows.length > 1) {
		throw new Error(
			`Duplicate portal claim for ${tableLabel}:${String(value)}`
		);
	}
	return rows[0] ?? null;
}

export async function getPortalBySlug(ctx: PortalReaderCtx, slug: string) {
	return assertSinglePortal(ctx, "slug", "by_slug", "slug", slug);
}

export async function getPortalByBrokerId(
	ctx: PortalReaderCtx,
	brokerId: Id<"brokers">
) {
	return assertSinglePortal(ctx, "brokerId", "by_broker", "brokerId", brokerId);
}

export async function getPortalByOrgId(ctx: PortalReaderCtx, orgId: string) {
	return assertSinglePortal(ctx, "orgId", "by_org", "orgId", orgId);
}

export async function ensureFairLendPortal(ctx: PortalWriterCtx) {
	const now = Date.now();
	const existingPortal =
		(await getPortalBySlug(ctx, FAIRLEND_PORTAL_SLUG)) ??
		(await assertSinglePortal(
			ctx,
			"productionHost",
			"by_production_host",
			"productionHost",
			FAIRLEND_PORTAL_PRODUCTION_HOST
		)) ??
		(await assertSinglePortal(
			ctx,
			"localHost",
			"by_local_host",
			"localHost",
			FAIRLEND_PORTAL_LOCAL_HOST
		));
	const fairLendPortal = fairLendPortalFields(now);
	const normalizedPortal = await assertPortalRegistryInvariants(ctx, {
		currentPortalId: existingPortal?._id,
		localHost: fairLendPortal.localHost,
		orgId: fairLendPortal.orgId,
		productionHost: fairLendPortal.productionHost,
		slug: fairLendPortal.slug,
	});

	if (existingPortal) {
		await ctx.db.patch(existingPortal._id, {
			...fairLendPortal,
			...normalizedPortal,
			createdAt: existingPortal.createdAt,
		});
		await ensurePortalSelectedPricingPolicy(ctx, {
			brokerSplitPercent: 0,
			portalId: existingPortal._id,
		});
		return existingPortal._id;
	}

	const portalId = await ctx.db.insert("portals", {
		...fairLendPortal,
		...normalizedPortal,
	});
	await ensurePortalSelectedPricingPolicy(ctx, {
		brokerSplitPercent: 0,
		portalId,
	});
	return portalId;
}

export async function resolveUserHomePortalId(
	ctx: PortalWriterCtx,
	user: DataModel["users"]["document"]
) {
	const broker = await ctx.db
		.query("brokers")
		.withIndex("by_user", (query) => query.eq("userId", user._id))
		.first();
	if (broker) {
		const brokerPortal = await getPortalByBrokerId(ctx, broker._id);
		if (brokerPortal) {
			return brokerPortal._id;
		}
	}

	const lender = await ctx.db
		.query("lenders")
		.withIndex("by_user", (query) => query.eq("userId", user._id))
		.first();
	if (lender) {
		const lenderPortal = await getPortalByBrokerId(ctx, lender.brokerId);
		if (lenderPortal) {
			return lenderPortal._id;
		}
	}

	const borrower = await ctx.db
		.query("borrowers")
		.withIndex("by_user", (query) => query.eq("userId", user._id))
		.first();
	if (borrower?.portalId) {
		return borrower.portalId;
	}
	if (borrower?.orgId) {
		const borrowerPortalResult = await getDeterministicPortalIdForOrgId(
			ctx,
			borrower.orgId
		);
		if (borrowerPortalResult.portalId) {
			return borrowerPortalResult.portalId;
		}
		if (borrowerPortalResult.activePublishedCount > 1) {
			console.warn(
				`[portals] Multiple active+published portals found for org ${borrower.orgId} during home portal resolution. Count: ${borrowerPortalResult.activePublishedCount}. This may indicate registry corruption.`
			);
		}
	}

	const memberships = await ctx.db
		.query("organizationMemberships")
		.withIndex("byUser", (query) => query.eq("userWorkosId", user.authId))
		.collect();
	for (const membership of memberships) {
		if (membership.status !== "active" || !membership.organizationWorkosId) {
			continue;
		}
		const membershipPortal = await getPortalByOrgId(
			ctx,
			membership.organizationWorkosId
		);
		if (membershipPortal) {
			return membershipPortal._id;
		}
	}

	return ensureFairLendPortal(ctx);
}

interface HomePortalSyncResult {
	homePortalId: Id<"portals">;
	userId: Id<"users">;
}

async function syncUserHomePortalAssignment(
	ctx: PortalWriterCtx,
	user: DataModel["users"]["document"]
): Promise<HomePortalSyncResult> {
	const homePortalId = await resolveUserHomePortalId(ctx, user);
	if (user.homePortalId !== homePortalId) {
		await ctx.db.patch(user._id, { homePortalId });
	}

	return {
		homePortalId,
		userId: user._id,
	};
}

export async function syncUserHomePortalAssignmentByUserId(
	ctx: PortalWriterCtx,
	userId: Id<"users">
) {
	const user = await ctx.db.get(userId);
	if (!user) {
		return null;
	}

	return syncUserHomePortalAssignment(ctx, user);
}

export async function syncUserHomePortalAssignmentByAuthId(
	ctx: PortalWriterCtx,
	authId: string
) {
	const { canonicalUser } = await findCanonicalUserByAuthId(ctx, authId);
	const user = canonicalUser;
	if (!user) {
		return null;
	}
	const duplicateCleanup = await deleteOrphanUsersByAuthId(ctx, {
		authId,
		keepUserId: user._id,
	});
	if (duplicateCleanup.deletedUserIds.length > 0) {
		console.warn(
			`[portals] Collapsed ${duplicateCleanup.deletedUserIds.length} duplicate user row(s) for ${authId} during home portal sync.`
		);
	}
	if (duplicateCleanup.blockedUserIds.length > 0) {
		console.warn(
			`[portals] Referenced duplicate user row(s) remain for ${authId}: ${duplicateCleanup.blockedUserIds.join(", ")}`
		);
	}

	return syncUserHomePortalAssignment(ctx, user);
}
