import { Migrations } from "@convex-dev/migrations";
import { ConvexError } from "convex/values";
import { components, internal } from "../_generated/api";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { FAIRLEND_STAFF_ORG_ID } from "../constants";
import { adminMutation, adminQuery } from "../fluent";
import { orgIdFromMortgageId } from "../lib/orgScope";
import {
	buildPortalHosts,
	DEFAULT_PORTAL_POST_AUTH_PATH,
	DEFAULT_PORTAL_TEASER_LIMIT,
	FAIRLEND_PORTAL_LOCAL_HOST,
	FAIRLEND_PORTAL_PRODUCTION_HOST,
	FAIRLEND_PORTAL_SLUG,
	fairLendPortalFields,
	isReservedPortalSlug,
	normalizePortalSlug,
} from "../portals/helpers";
import { assertPortalRegistryInvariants } from "../portals/invariants";

const migrations = new Migrations<DataModel>(components.migrations);

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

const migrationRefs = internal as unknown as {
	brokers: {
		migrations: {
			backfillBrokerOrgId: never;
			backfillLenderOrgId: never;
			backfillAuditJournalOrganizationId: never;
			backfillBrokerPortals: never;
			backfillUserHomePortalId: never;
		};
	};
};

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
		.take(2);
	if (rows.length > 1) {
		throw new ConvexError(
			`Duplicate portal claim for ${tableLabel}:${String(value)}`
		);
	}
	return rows[0] ?? null;
}

async function getPortalBySlug(ctx: PortalReaderCtx, slug: string) {
	return assertSinglePortal(ctx, "slug", "by_slug", "slug", slug);
}

async function getPortalByBrokerId(
	ctx: PortalReaderCtx,
	brokerId: Id<"brokers">
) {
	return assertSinglePortal(ctx, "brokerId", "by_broker", "brokerId", brokerId);
}

async function getPortalByOrgId(ctx: PortalReaderCtx, orgId: string) {
	return assertSinglePortal(ctx, "orgId", "by_org", "orgId", orgId);
}

async function ensureFairLendPortal(ctx: PortalWriterCtx) {
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

function brokerSlugFallback(broker: DataModel["brokers"]["document"]) {
	const baseFromName = normalizePortalSlug(broker.brokerageName ?? "");
	if (baseFromName && !isReservedPortalSlug(baseFromName)) {
		return baseFromName;
	}

	const brokerIdSuffix = normalizePortalSlug(String(broker._id).slice(-8));
	return brokerIdSuffix ? `broker-${brokerIdSuffix}` : "broker-portal";
}

async function deriveBrokerPortalSlug(
	ctx: PortalReaderCtx,
	broker: DataModel["brokers"]["document"]
) {
	const onboardings = await ctx.db
		.query("lenderOnboardings")
		.withIndex("by_broker", (query) => query.eq("brokerId", broker._id))
		.collect();

	const candidates = [
		...onboardings
			.map((row) => normalizePortalSlug(row.subdomain ?? ""))
			.filter(Boolean),
		normalizePortalSlug(broker.brokerageName ?? ""),
		brokerSlugFallback(broker),
	];

	const seen = new Set<string>();
	for (const candidate of candidates) {
		if (!candidate || seen.has(candidate)) {
			continue;
		}
		seen.add(candidate);

		const safeSlug = isReservedPortalSlug(candidate)
			? `${candidate}-broker`
			: candidate;
		const existing = await getPortalBySlug(ctx, safeSlug);
		if (!existing || existing.brokerId === broker._id) {
			return safeSlug;
		}
	}

	let suffix = 1;
	const baseSlug = brokerSlugFallback(broker);
	while (true) {
		const candidate = `${baseSlug}-${suffix}`;
		const existing = await getPortalBySlug(ctx, candidate);
		if (!existing || existing.brokerId === broker._id) {
			return candidate;
		}
		suffix += 1;
	}
}

async function isFairLendStaffAdminUser(ctx: PortalReaderCtx, authId: string) {
	const memberships = await ctx.db
		.query("organizationMemberships")
		.withIndex("byUser", (query) => query.eq("userWorkosId", authId))
		.collect();

	return memberships.some(
		(membership) =>
			membership.organizationWorkosId === FAIRLEND_STAFF_ORG_ID &&
			membership.status === "active" &&
			(membership.roleSlug === "admin" ||
				membership.roleSlugs?.includes("admin") === true)
	);
}

async function resolveUserHomePortalId(
	ctx: PortalWriterCtx,
	user: DataModel["users"]["document"]
) {
	if (await isFairLendStaffAdminUser(ctx, user.authId)) {
		return undefined;
	}

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
		memberships.find(
			(membership) =>
				membership.status === "active" &&
				membership.organizationWorkosId !== FAIRLEND_STAFF_ORG_ID
		) ??
		memberships.find(
			(membership) => membership.organizationWorkosId !== FAIRLEND_STAFF_ORG_ID
		);
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

/**
 * Sets `brokers.orgId` from the broker user's WorkOS organization membership
 * when missing (legacy rows). Uses `users.authId` as `userWorkosId` on
 * `organizationMemberships`, matching WorkOS-synced accounts.
 */
export const backfillBrokerOrgId = migrations.define({
	table: "brokers",
	migrateOne: async (ctx, broker) => {
		if (broker.orgId) {
			return;
		}
		const user = await ctx.db.get(broker.userId);
		if (!user) {
			return;
		}
		const memberships = await ctx.db
			.query("organizationMemberships")
			.withIndex("byUser", (q) => q.eq("userWorkosId", user.authId))
			.collect();
		const preferred =
			memberships.find((m) => m.status === "active") ?? memberships[0];
		if (!preferred?.organizationWorkosId) {
			return;
		}
		await ctx.db.patch(broker._id, {
			orgId: preferred.organizationWorkosId,
		});
	},
});

/** Copies `orgId` from the lender's broker when the lender row is missing it. */
export const backfillLenderOrgId = migrations.define({
	table: "lenders",
	migrateOne: async (ctx, lender) => {
		if (lender.orgId) {
			return;
		}
		const broker = await ctx.db.get(lender.brokerId);
		if (!broker?.orgId) {
			return;
		}
		await ctx.db.patch(lender._id, { orgId: broker.orgId });
	},
});

/** Best-effort `organizationId` on legacy audit journal rows for org-scoped indexes. */
export const backfillAuditJournalOrganizationId = migrations.define({
	table: "auditJournal",
	migrateOne: async (ctx, row) => {
		if (row.organizationId) {
			return;
		}

		const entityId = row.entityId;

		if (row.entityType === "broker") {
			const broker = await ctx.db.get(entityId as Id<"brokers">);
			if (broker?.orgId) {
				await ctx.db.patch(row._id, {
					organizationId: broker.orgId,
				});
			}
			return;
		}

		if (row.entityType === "mortgage") {
			const orgId = await orgIdFromMortgageId(ctx, entityId as Id<"mortgages">);
			if (orgId) {
				await ctx.db.patch(row._id, { organizationId: orgId });
			}
			return;
		}

		if (row.entityType === "obligation") {
			const obl = await ctx.db.get(entityId as Id<"obligations">);
			if (!obl) {
				return;
			}
			const orgId =
				obl.orgId ?? (await orgIdFromMortgageId(ctx, obl.mortgageId));
			if (orgId) {
				await ctx.db.patch(row._id, { organizationId: orgId });
			}
			return;
		}

		if (row.entityType === "lender") {
			const lender = await ctx.db.get(entityId as Id<"lenders">);
			if (!lender) {
				return;
			}
			const broker = await ctx.db.get(lender.brokerId);
			const orgId = lender.orgId ?? broker?.orgId;
			if (orgId) {
				await ctx.db.patch(row._id, { organizationId: orgId });
			}
		}
	},
});

export const backfillBrokerPortals = migrations.define({
	table: "brokers",
	migrateOne: async (ctx, broker) => {
		if (!broker.orgId) {
			return;
		}

		const existingPortal = await getPortalByBrokerId(ctx, broker._id);
		if (existingPortal) {
			const normalizedPortal = await assertPortalRegistryInvariants(ctx, {
				brokerId: broker._id,
				currentPortalId: existingPortal._id,
				localHost: existingPortal.localHost,
				orgId: broker.orgId,
				productionHost: existingPortal.productionHost,
				slug: existingPortal.slug,
			});
			if (
				existingPortal.orgId !== normalizedPortal.orgId ||
				existingPortal.slug !== normalizedPortal.slug ||
				existingPortal.productionHost !== normalizedPortal.productionHost ||
				existingPortal.localHost !== normalizedPortal.localHost
			) {
				await ctx.db.patch(existingPortal._id, {
					localHost: normalizedPortal.localHost,
					orgId: normalizedPortal.orgId,
					productionHost: normalizedPortal.productionHost,
					slug: normalizedPortal.slug,
					updatedAt: Date.now(),
				});
			}
			return;
		}

		const slug = await deriveBrokerPortalSlug(ctx, broker);
		const now = Date.now();
		const normalizedPortal = await assertPortalRegistryInvariants(ctx, {
			brokerId: broker._id,
			...buildPortalHosts(slug),
			orgId: broker.orgId,
			slug,
		});
		await ctx.db.insert("portals", {
			...normalizedPortal,
			portalType: "broker",
			brokerId: broker._id,
			status: "active",
			isPublished: true,
			publicTeaserEnabled: true,
			teaserListingLimit: DEFAULT_PORTAL_TEASER_LIMIT,
			defaultPostAuthPath: DEFAULT_PORTAL_POST_AUTH_PATH,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const backfillUserHomePortalId = migrations.define({
	table: "users",
	migrateOne: async (ctx, user) => {
		if (user.homePortalId) {
			return;
		}

		const homePortalId = await resolveUserHomePortalId(ctx, user);
		if (!homePortalId) {
			return;
		}

		await ctx.db.patch(user._id, { homePortalId });
	},
});

export const runOrgScopeEntityBackfill = adminMutation
	.input({})
	.handler(async (ctx) => {
		await migrations.runOne(
			ctx,
			migrationRefs.brokers.migrations.backfillBrokerOrgId
		);
		await migrations.runOne(
			ctx,
			migrationRefs.brokers.migrations.backfillLenderOrgId
		);
		await migrations.runOne(
			ctx,
			migrationRefs.brokers.migrations.backfillAuditJournalOrganizationId
		);
	})
	.public();

export const getOrgScopeBackfillStatus = adminQuery
	.input({})
	.handler(async (ctx) => {
		const brokers = await ctx.db.query("brokers").collect();
		const lenders = await ctx.db.query("lenders").collect();
		const journals = await ctx.db.query("auditJournal").collect();

		return {
			brokersMissingOrgId: brokers.filter((b) => !b.orgId).length,
			lendersMissingOrgId: lenders.filter((l) => !l.orgId).length,
			auditJournalMissingOrgId: journals.filter((j) => !j.organizationId)
				.length,
		};
	})
	.public();

export const runPortalRegistryBackfill = adminMutation
	.input({})
	.handler(async (ctx) => {
		await ensureFairLendPortal(ctx);
		await migrations.runOne(
			ctx,
			migrationRefs.brokers.migrations.backfillBrokerOrgId
		);
		await migrations.runOne(
			ctx,
			migrationRefs.brokers.migrations.backfillLenderOrgId
		);
		await migrations.runOne(
			ctx,
			migrationRefs.brokers.migrations.backfillBrokerPortals
		);
		await migrations.runOne(
			ctx,
			migrationRefs.brokers.migrations.backfillUserHomePortalId
		);
	})
	.public();

export const getPortalRegistryBackfillStatus = adminQuery
	.input({})
	.handler(async (ctx) => {
		const fairLendPortal = await getPortalBySlug(ctx, FAIRLEND_PORTAL_SLUG);
		const brokers = await ctx.db.query("brokers").collect();
		const users = await ctx.db.query("users").collect();
		const portals = await ctx.db.query("portals").collect();

		const brokerIdsWithPortal = new Set(
			portals
				.filter(
					(portal) =>
						portal.portalType === "broker" && portal.brokerId !== undefined
				)
				.map((portal) => portal.brokerId as NonNullable<(typeof portal)["brokerId"]>)
		);

		const fairLendStaffAdminAuthIds = new Set<string>();
		const staffMemberships = await ctx.db
			.query("organizationMemberships")
			.withIndex("byOrganization", (query) =>
				query.eq("organizationWorkosId", FAIRLEND_STAFF_ORG_ID)
			)
			.collect();
		for (const membership of staffMemberships) {
			if (
				membership.status === "active" &&
				(membership.roleSlug === "admin" ||
					membership.roleSlugs?.includes("admin") === true)
			) {
				fairLendStaffAdminAuthIds.add(membership.userWorkosId);
			}
		}

		let brokersMissingOrgIdCount = 0;
		let brokersMissingPortalCount = 0;
		for (const broker of brokers) {
			if (!broker.orgId) {
				brokersMissingOrgIdCount += 1;
				continue;
			}

			if (!brokerIdsWithPortal.has(broker._id)) {
				brokersMissingPortalCount += 1;
			}
		}

		let usersMissingHomePortalCount = 0;
		for (const user of users) {
			if (user.homePortalId) {
				continue;
			}
			if (fairLendStaffAdminAuthIds.has(user.authId)) {
				continue;
			}
			usersMissingHomePortalCount += 1;
		}

		return {
			fairLendPortalExists: fairLendPortal !== null,
			portalCount: portals.length,
			brokerPortalCount: portals.filter(
				(portal) => portal.portalType === "broker"
			).length,
			brokersMissingOrgIdCount,
			brokersMissingPortalCount,
			usersMissingHomePortalCount,
		};
	})
	.public();
