import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
	FAIRLEND_PORTAL_LOCAL_HOST,
	FAIRLEND_PORTAL_PRODUCTION_HOST,
	FAIRLEND_PORTAL_SLUG,
	fairLendPortalFields,
} from "./helpers";
import { assertPortalRegistryInvariants } from "./invariants";

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
		return existingPortal._id;
	}

	return ctx.db.insert("portals", {
		...fairLendPortal,
		...normalizedPortal,
	});
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
	if (borrower?.orgId) {
		const borrowerPortal = await getPortalByOrgId(ctx, borrower.orgId);
		if (borrowerPortal) {
			return borrowerPortal._id;
		}
	}

	const memberships = await ctx.db
		.query("organizationMemberships")
		.withIndex("byUser", (query) => query.eq("userWorkosId", user.authId))
		.collect();
	const preferredMembership =
		memberships.find((membership) => membership.status === "active") ??
		memberships[0];
	if (preferredMembership?.organizationWorkosId) {
		const membershipPortal = await getPortalByOrgId(
			ctx,
			preferredMembership.organizationWorkosId
		);
		if (membershipPortal) {
			return membershipPortal._id;
		}
	}

	return ensureFairLendPortal(ctx);
}
