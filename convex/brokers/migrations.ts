import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { FAIRLEND_STAFF_ORG_ID } from "../constants";
import { adminMutation, adminQuery } from "../fluent";
import { orgIdFromMortgageId } from "../lib/orgScope";
import {
	resolveBorrowerPortalIdForBackfill,
	resolveOnboardingRequestPortalIdForBackfill,
} from "../portals/borrowerPortalAttribution";
import {
	buildPortalHosts,
	DEFAULT_PORTAL_POST_AUTH_PATH,
	DEFAULT_PORTAL_TEASER_LIMIT,
	FAIRLEND_PORTAL_SLUG,
	isReservedPortalSlug,
	normalizePortalSlug,
} from "../portals/helpers";
import {
	ensureFairLendPortal,
	getPortalByBrokerId,
	getPortalBySlug,
	syncUserHomePortalAssignmentByUserId,
} from "../portals/homePortalAssignment";
import { assertPortalRegistryInvariants } from "../portals/invariants";
import {
	ensureBrokerPortalPricingSetting,
	ensurePortalSelectedPricingPolicy,
	syncAllPortalPricingSelections,
} from "../portals/pricing";

const migrations = new Migrations<DataModel>(components.migrations);

type PortalReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

const migrationRefs = internal as unknown as {
	brokers: {
		migrations: {
			backfillBrokerOrgId: never;
			backfillLenderOrgId: never;
			backfillAuditJournalOrganizationId: never;
			backfillBrokerPortals: never;
			backfillOnboardingRequestPortalId: never;
			backfillBorrowerPortalId: never;
			backfillUserHomePortalId: never;
		};
	};
};

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

		const setting = await ensureBrokerPortalPricingSetting(ctx);
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
			await ensurePortalSelectedPricingPolicy(ctx, {
				brokerSplitPercent: setting.brokerSplitPercent,
				portalId: existingPortal._id,
			});
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
		const portalId = await ctx.db.insert("portals", {
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
		await ensurePortalSelectedPricingPolicy(ctx, {
			brokerSplitPercent: setting.brokerSplitPercent,
			portalId,
		});
	},
});

export const backfillOnboardingRequestPortalId = migrations.define({
	table: "onboardingRequests",
	migrateOne: async (ctx, onboardingRequest) => {
		if (onboardingRequest.portalId) {
			return;
		}

		const portalId = await resolveOnboardingRequestPortalIdForBackfill(
			ctx,
			onboardingRequest
		);
		if (!portalId) {
			return;
		}

		await ctx.db.patch(onboardingRequest._id, { portalId });
	},
});

export const backfillBorrowerPortalId = migrations.define({
	table: "borrowers",
	migrateOne: async (ctx, borrower) => {
		if (borrower.portalId) {
			return;
		}

		const portalId = await resolveBorrowerPortalIdForBackfill(ctx, borrower);
		if (!portalId) {
			return;
		}

		await ctx.db.patch(borrower._id, { portalId });
	},
});

export const backfillUserHomePortalId = migrations.define({
	table: "users",
	migrateOne: async (ctx, user) => {
		await syncUserHomePortalAssignmentByUserId(ctx, user._id);
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
			migrationRefs.brokers.migrations.backfillOnboardingRequestPortalId
		);
		await migrations.runOne(
			ctx,
			migrationRefs.brokers.migrations.backfillBorrowerPortalId
		);
		await migrations.runOne(
			ctx,
			migrationRefs.brokers.migrations.backfillUserHomePortalId
		);
		await syncAllPortalPricingSelections(ctx, {
			updatedByAuthId: ctx.viewer.authId,
		});
		return getPortalRegistryBackfillStatusSnapshot(ctx);
	})
	.public();

async function getPortalRegistryBackfillStatusSnapshot(ctx: PortalReaderCtx) {
	const fairLendPortal = await getPortalBySlug(ctx, FAIRLEND_PORTAL_SLUG);
	const brokers = await ctx.db.query("brokers").collect();
	const onboardingRequests = await ctx.db.query("onboardingRequests").collect();
	const borrowers = await ctx.db.query("borrowers").collect();
	const users = await ctx.db.query("users").collect();
	const portals = await ctx.db.query("portals").collect();

	let brokersMissingOrgIdCount = 0;
	let brokersMissingPortalCount = 0;
	for (const broker of brokers) {
		if (!broker.orgId) {
			brokersMissingOrgIdCount += 1;
			continue;
		}

		const brokerPortal = await getPortalByBrokerId(ctx, broker._id);
		if (!brokerPortal) {
			brokersMissingPortalCount += 1;
		}
	}

	const onboardingRequestsMissingPortal = onboardingRequests.filter(
		(request) => !request.portalId
	);
	const unresolvedOnboardingRequestIds: Id<"onboardingRequests">[] = [];
	for (const onboardingRequest of onboardingRequestsMissingPortal) {
		const resolvedPortalId = await resolveOnboardingRequestPortalIdForBackfill(
			ctx,
			onboardingRequest
		);
		if (!resolvedPortalId) {
			unresolvedOnboardingRequestIds.push(onboardingRequest._id);
		}
	}

	const borrowersMissingPortal = borrowers.filter(
		(borrower) => !borrower.portalId
	);
	const unresolvedBorrowerIds: Id<"borrowers">[] = [];
	for (const borrower of borrowersMissingPortal) {
		const resolvedPortalId = await resolveBorrowerPortalIdForBackfill(
			ctx,
			borrower
		);
		if (!resolvedPortalId) {
			unresolvedBorrowerIds.push(borrower._id);
		}
	}

	let usersMissingHomePortalCount = 0;
	for (const user of users) {
		if (user.homePortalId) {
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
		onboardingRequestsMissingPortalCount:
			onboardingRequestsMissingPortal.length,
		unresolvedOnboardingRequestCount: unresolvedOnboardingRequestIds.length,
		unresolvedOnboardingRequestIds,
		borrowersMissingPortalCount: borrowersMissingPortal.length,
		unresolvedBorrowerCount: unresolvedBorrowerIds.length,
		unresolvedBorrowerIds,
		usersMissingHomePortalCount,
	};
}

export const getPortalRegistryBackfillStatus = adminQuery
	.input({})
	.handler(async (ctx) => getPortalRegistryBackfillStatusSnapshot(ctx))
	.public();
