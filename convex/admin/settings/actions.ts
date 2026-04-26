import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id, TableNames } from "../../_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../../_generated/server";
import { adminAction, convex } from "../../fluent";
import { RotessaApiClient } from "../../payments/rotessa/api";
import {
	RotessaApiError,
	RotessaRequestError,
} from "../../payments/rotessa/client";
import { buildPortalHosts } from "../../portals/helpers";
import { assertPortalRegistryInvariants } from "../../portals/invariants";
import { deleteOrphanUsersByAuthId } from "../../users/byAuthId";
import {
	addMonthsToBusinessDate,
	buildMockMortgageBankAccount,
	buildMockMortgageBorrowerEmail,
	buildMockMortgageBorrowerPhone,
	buildMockMortgageListingTitle,
	buildMockMortgageSeoSlug,
	computeAmortizedMonthlyPaymentCents,
	dollarsToCents,
	firstDayOfNextMonth,
	getLatestMockOriginationBatchSnapshot,
	MOCK_MORTGAGE_CATALOG,
	MOCK_MORTGAGE_CATALOG_VERSION,
	type MockMortgageCatalogItem,
	type MockOriginationBatchStatusSnapshot,
} from "./mockMortgages";

const mockOriginationBatchStatusValidator = v.union(
	v.literal("seeding"),
	v.literal("ready"),
	v.literal("cleaning"),
	v.literal("failed"),
	v.literal("clean_failed"),
	v.literal("cleaned")
);

const mockOriginationBatchItemStatusValidator = v.union(
	v.literal("pending"),
	v.literal("case_created"),
	v.literal("borrower_created"),
	v.literal("schedule_created"),
	v.literal("committed"),
	v.literal("published"),
	v.literal("cleanup_provider_done"),
	v.literal("cleanup_local_done"),
	v.literal("cleaned"),
	v.literal("failed")
);

const INVALID_ROTESSA_SCHEDULE_ID_RE =
	/Invalid Rotessa transaction_schedules id/i;

function slugify(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function batchLabel(batchId: Id<"mockOriginationBatches">) {
	return `mock_mortgage_batch:${String(batchId)}`;
}

function buildBootstrapToken(
	batchId: Id<"mockOriginationBatches">,
	item: MockMortgageCatalogItem
) {
	return `${batchLabel(batchId)}:${item.key}`;
}

function buildBorrowerSourceLabel(
	batchId: Id<"mockOriginationBatches">,
	item: MockMortgageCatalogItem
) {
	return `${batchLabel(batchId)}:${item.key}:borrower`;
}

function buildPadOverrideReason(
	batchId: Id<"mockOriginationBatches">,
	item: MockMortgageCatalogItem
) {
	return `Mock mortgage seed batch ${String(batchId)} for ${item.key}`;
}

function buildListingDescription(item: MockMortgageCatalogItem) {
	const lienLabel = item.lienPosition === 1 ? "first" : "second";
	return `Mock ${lienLabel}-position GTA mortgage seeded through the admin origination workflow for QA. Borrower: ${item.borrowerName}. Neighborhood: ${item.neighborhoodLabel}.`;
}

function buildMarketplaceCopy(item: MockMortgageCatalogItem) {
	return `${item.neighborhoodLabel} mock listing with curated appraisal comparables, a seeded Rotessa schedule, and canonical post-commit collections artifacts for human QA.`;
}

function buildScheduleDates(termMonths: number, now: number) {
	const termStartDate = firstDayOfNextMonth(now);
	return {
		firstPaymentDate: termStartDate,
		interestAdjustmentDate: termStartDate,
		maturityDate: addMonthsToBusinessDate(termStartDate, termMonths - 1),
		termStartDate,
		valuationDate: addMonthsToBusinessDate(termStartDate, -1),
	};
}

function normalizeMockSeedError(error: unknown) {
	if (error instanceof RotessaApiError) {
		return `${error.message} (${error.method} ${error.path})`;
	}
	if (error instanceof RotessaRequestError) {
		return `${error.message} (${error.method} ${error.path})`;
	}
	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message;
	}
	return "Mock mortgage seed failed";
}

function isRotessaDeleteNotFound(error: unknown) {
	if (error instanceof RotessaApiError) {
		return error.status === 404;
	}
	if (error instanceof RotessaRequestError) {
		return INVALID_ROTESSA_SCHEDULE_ID_RE.test(error.message);
	}
	return false;
}

async function deleteByIds<TableName extends TableNames>(
	ctx: Pick<MutationCtx, "db">,
	ids: readonly Id<TableName>[]
) {
	for (const id of ids) {
		await ctx.db.delete(id);
	}
	return ids.length;
}

function dedupeIds<TableName extends TableNames>(
	ids: readonly Id<TableName>[]
) {
	return [...new Set(ids)];
}

async function deleteRows<T extends { _id: Id<TableNames> }>(
	ctx: Pick<MutationCtx, "db">,
	rows: readonly T[]
) {
	for (const row of rows) {
		await ctx.db.delete(row._id);
	}
	return rows.length;
}

export const getSeedViewerContext = convex
	.query()
	.input({
		viewerAuthId: v.string(),
		viewerOrgId: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		if (!args.viewerOrgId) {
			throw new ConvexError(
				"Mock mortgage seeding requires an active organization context."
			);
		}

		const viewerUser = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", args.viewerAuthId))
			.unique();
		if (!viewerUser) {
			throw new ConvexError("Viewer user not found in database");
		}

		return {
			activeBatch: await getLatestMockOriginationBatchSnapshot(
				ctx,
				args.viewerOrgId
			),
			viewerUserId: viewerUser._id,
		};
	})
	.internal();

export const createMockOriginationBatch = convex
	.mutation()
	.input({
		catalogVersion: v.string(),
		createdByAuthId: v.string(),
		createdByUserId: v.id("users"),
		itemCount: v.number(),
		orgId: v.string(),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		return await ctx.db.insert("mockOriginationBatches", {
			catalogVersion: args.catalogVersion,
			createdByAuthId: args.createdByAuthId,
			createdByUserId: args.createdByUserId,
			itemCount: args.itemCount,
			orgId: args.orgId,
			startedAt: now,
			status: "seeding",
			updatedAt: now,
		});
	})
	.internal();

export const updateMockOriginationBatch = convex
	.mutation()
	.input({
		batchId: v.id("mockOriginationBatches"),
		cleanedAt: v.optional(v.number()),
		completedAt: v.optional(v.number()),
		failedAt: v.optional(v.number()),
		lastError: v.optional(v.string()),
		status: v.optional(mockOriginationBatchStatusValidator),
	})
	.handler(async (ctx, args) => {
		const patch: Record<string, unknown> = {
			updatedAt: Date.now(),
		};
		if (Object.hasOwn(args, "cleanedAt")) {
			patch.cleanedAt = args.cleanedAt;
		}
		if (Object.hasOwn(args, "completedAt")) {
			patch.completedAt = args.completedAt;
		}
		if (Object.hasOwn(args, "failedAt")) {
			patch.failedAt = args.failedAt;
		}
		if (Object.hasOwn(args, "lastError")) {
			patch.lastError = args.lastError;
		}
		if (Object.hasOwn(args, "status")) {
			patch.status = args.status;
		}
		await ctx.db.patch(args.batchId, patch);
		return ctx.db.get(args.batchId);
	})
	.internal();

export const createMockOriginationBatchItem = convex
	.mutation()
	.input({
		batchId: v.id("mockOriginationBatches"),
		bootstrapToken: v.string(),
		borrowerDisplayName: v.string(),
		catalogKey: v.string(),
		imageStorageId: v.id("_storage"),
		listingTitle: v.string(),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		return await ctx.db.insert("mockOriginationBatchItems", {
			batchId: args.batchId,
			bootstrapToken: args.bootstrapToken,
			borrowerDisplayName: args.borrowerDisplayName,
			catalogKey: args.catalogKey,
			createdAt: now,
			imageStorageId: args.imageStorageId,
			listingTitle: args.listingTitle,
			status: "pending",
			updatedAt: now,
		});
	})
	.internal();

export const updateMockOriginationBatchItem = convex
	.mutation()
	.input({
		batchItemId: v.id("mockOriginationBatchItems"),
		bankAccountId: v.optional(v.id("bankAccounts")),
		borrowerId: v.optional(v.id("borrowers")),
		caseId: v.optional(v.id("adminOriginationCases")),
		customerProfileId: v.optional(v.id("externalCustomerProfiles")),
		lastError: v.optional(v.string()),
		listingId: v.optional(v.id("listings")),
		mortgageId: v.optional(v.id("mortgages")),
		propertyId: v.optional(v.id("properties")),
		providerScheduleId: v.optional(v.id("externalProviderSchedules")),
		status: v.optional(mockOriginationBatchItemStatusValidator),
		userId: v.optional(v.id("users")),
		valuationSnapshotId: v.optional(v.id("mortgageValuationSnapshots")),
	})
	.handler(async (ctx, args) => {
		const patch: Record<string, unknown> = {
			updatedAt: Date.now(),
		};
		if (Object.hasOwn(args, "bankAccountId")) {
			patch.bankAccountId = args.bankAccountId;
		}
		if (Object.hasOwn(args, "borrowerId")) {
			patch.borrowerId = args.borrowerId;
		}
		if (Object.hasOwn(args, "caseId")) {
			patch.caseId = args.caseId;
		}
		if (Object.hasOwn(args, "customerProfileId")) {
			patch.customerProfileId = args.customerProfileId;
		}
		if (Object.hasOwn(args, "lastError")) {
			patch.lastError = args.lastError;
		}
		if (Object.hasOwn(args, "listingId")) {
			patch.listingId = args.listingId;
		}
		if (Object.hasOwn(args, "mortgageId")) {
			patch.mortgageId = args.mortgageId;
		}
		if (Object.hasOwn(args, "propertyId")) {
			patch.propertyId = args.propertyId;
		}
		if (Object.hasOwn(args, "providerScheduleId")) {
			patch.providerScheduleId = args.providerScheduleId;
		}
		if (Object.hasOwn(args, "status")) {
			patch.status = args.status;
		}
		if (Object.hasOwn(args, "userId")) {
			patch.userId = args.userId;
		}
		if (Object.hasOwn(args, "valuationSnapshotId")) {
			patch.valuationSnapshotId = args.valuationSnapshotId;
		}
		await ctx.db.patch(args.batchItemId, patch);
		return ctx.db.get(args.batchItemId);
	})
	.internal();

export const getMockOriginationBatchItems = convex
	.query()
	.input({
		batchId: v.id("mockOriginationBatches"),
	})
	.handler(async (ctx, args) =>
		ctx.db
			.query("mockOriginationBatchItems")
			.withIndex("by_batch", (query) => query.eq("batchId", args.batchId))
			.collect()
	)
	.internal();

export const ensureMockSeedBrokerPortal = convex
	.mutation()
	.input({
		orgId: v.string(),
		viewerUserId: v.id("users"),
	})
	.handler(async (ctx, args) => {
		const existingBrokerPortal = (
			await ctx.db
				.query("portals")
				.withIndex("by_org", (query) => query.eq("orgId", args.orgId))
				.collect()
		).find(
			(portal) =>
				portal.portalType === "broker" &&
				portal.status === "active" &&
				portal.isPublished &&
				portal.brokerId
		);
		if (existingBrokerPortal?.brokerId) {
			return {
				brokerId: existingBrokerPortal.brokerId,
				portalId: existingBrokerPortal._id,
			};
		}

		const broker = await ctx.db
			.query("brokers")
			.withIndex("by_org_status", (query) =>
				query.eq("orgId", args.orgId).eq("status", "active")
			)
			.first();
		if (!broker) {
			throw new ConvexError(
				"No active broker of record found for this org. Seed requires a pre-existing broker."
			);
		}
		const now = Date.now();

		const existingPortal = await ctx.db
			.query("portals")
			.withIndex("by_broker", (query) => query.eq("brokerId", broker._id))
			.first();
		if (existingPortal) {
			return {
				brokerId: broker._id,
				portalId: existingPortal._id,
			};
		}

		const slugBase = slugify(`mock-${args.orgId.slice(-10)}`);
		const hosts = buildPortalHosts(slugBase);
		const normalized = await assertPortalRegistryInvariants(ctx, {
			brokerId: broker._id,
			localHost: hosts.localHost,
			orgId: args.orgId,
			productionHost: hosts.productionHost,
			slug: slugBase,
		});
		const portalId = await ctx.db.insert("portals", {
			...normalized,
			createdAt: now,
			defaultPostAuthPath: "/",
			isPublished: true,
			publicTeaserEnabled: true,
			status: "active",
			teaserListingLimit: 12,
			updatedAt: now,
			portalType: "broker",
		});

		return {
			brokerId: broker._id,
			portalId,
		};
	})
	.internal();

export const getBorrowerSeedRefs = convex
	.query()
	.input({
		borrowerId: v.id("borrowers"),
	})
	.handler(async (ctx, args) => {
		const borrower = await ctx.db.get(args.borrowerId);
		if (!borrower) {
			throw new ConvexError(
				"Borrower disappeared during mock mortgage seeding"
			);
		}

		return {
			borrowerId: borrower._id,
			userId: borrower.userId,
		};
	})
	.internal();

export const getCommittedCaseRefs = convex
	.query()
	.input({
		caseId: v.id("adminOriginationCases"),
	})
	.handler(async (ctx, args) => {
		const caseRecord = await ctx.db.get(args.caseId);
		if (!(caseRecord?.committedListingId && caseRecord.committedMortgageId)) {
			throw new ConvexError(
				"Committed mock origination case is missing canonical links"
			);
		}

		const mortgage = await ctx.db.get(caseRecord.committedMortgageId);
		if (!mortgage) {
			throw new ConvexError("Committed mortgage no longer exists");
		}

		return {
			listingId: caseRecord.committedListingId,
			mortgageId: caseRecord.committedMortgageId,
			propertyId: mortgage.propertyId,
			valuationSnapshotId: caseRecord.committedValuationSnapshotId ?? null,
		};
	})
	.internal();

export const getProviderScheduleCleanupContext = convex
	.query()
	.input({
		providerScheduleId: v.id("externalProviderSchedules"),
	})
	.handler(async (ctx, args) => {
		const providerSchedule = await ctx.db.get(args.providerScheduleId);
		if (!providerSchedule) {
			return null;
		}

		return {
			customerProfileId: providerSchedule.externalCustomerProfileId,
			externalScheduleRef: providerSchedule.externalScheduleRef,
			providerScheduleId: providerSchedule._id,
		};
	})
	.internal();

async function deleteDealGraph(
	ctx: Pick<MutationCtx, "db">,
	mortgageId: Id<"mortgages">
) {
	const deals = await ctx.db
		.query("deals")
		.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgageId))
		.collect();
	const dealIds = deals.map((deal) => deal._id);
	const dealAccess = (
		await Promise.all(
			dealIds.map((dealId) =>
				ctx.db
					.query("dealAccess")
					.withIndex("by_deal", (query) => query.eq("dealId", dealId))
					.collect()
			)
		)
	).flat();

	await deleteRows(ctx, dealAccess);
	await deleteByIds(
		ctx,
		(
			await ctx.db
				.query("prorateEntries")
				.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgageId))
				.collect()
		).map((entry) => entry._id)
	);
	await deleteByIds(
		ctx,
		(
			await ctx.db
				.query("dealReroutes")
				.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgageId))
				.collect()
		).map((entry) => entry._id)
	);
	await deleteByIds(ctx, dealIds);
}

export const cleanupMockOriginationBatchItemLocal = convex
	.mutation()
	.input({
		batchItemId: v.id("mockOriginationBatchItems"),
	})
	.handler(async (ctx, args) => {
		const item = await ctx.db.get(args.batchItemId);
		if (!item) {
			return { cleaned: false };
		}

		const mortgageId = item.mortgageId ?? null;
		const propertyId = item.propertyId ?? null;
		const borrowerId = item.borrowerId ?? null;
		const caseId = item.caseId ?? null;
		const userId = item.userId ?? null;
		const userAuthId = userId
			? ((await ctx.db.get(userId))?.authId ?? null)
			: null;

		if (caseId) {
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("originationCaseDocumentDrafts")
						.withIndex("by_case", (query) => query.eq("caseId", caseId))
						.collect()
				).map((draft) => draft._id)
			);
		}

		if (mortgageId) {
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("mortgageDocumentBlueprints")
						.withIndex("by_mortgage_created_at", (query) =>
							query.eq("mortgageId", mortgageId)
						)
						.collect()
				).map((blueprint) => blueprint._id)
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("dealDocumentInstances")
						.withIndex("by_mortgage", (query) =>
							query.eq("mortgageId", mortgageId)
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("dealDocumentPackages")
						.withIndex("by_mortgage", (query) =>
							query.eq("mortgageId", mortgageId)
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteDealGraph(ctx, mortgageId);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("closingTeamAssignments")
						.withIndex("by_mortgage", (query) =>
							query.eq("mortgageId", mortgageId)
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("dispersalCalculationRuns")
						.withIndex("by_mortgage", (query) =>
							query.eq("mortgageId", mortgageId)
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("servicingFeeEntries")
						.withIndex("by_mortgage", (query) =>
							query.eq("mortgageId", mortgageId)
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("transferRequests")
						.withIndex("by_mortgage", (query) =>
							query.eq("mortgageId", mortgageId)
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("collectionAttempts")
						.withIndex("by_mortgage_status", (query) =>
							query.eq("mortgageId", mortgageId)
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("externalCollectionSchedules")
						.withIndex("by_mortgage", (query) =>
							query.eq("mortgageId", mortgageId)
						)
						.collect()
				).map((entry) => entry._id)
			);
			const providerSchedules = dedupeIds([
				...(
					await ctx.db
						.query("externalProviderSchedules")
						.withIndex("by_mortgage", (query) =>
							query.eq("linkedMortgageId", mortgageId)
						)
						.collect()
				).map((entry) => entry._id),
				...(caseId
					? await ctx.db
							.query("externalProviderSchedules")
							.withIndex("by_case", (query) =>
								query.eq("reservedForCaseId", caseId)
							)
							.collect()
					: []
				).map((entry) => entry._id),
				...(item.providerScheduleId ? [item.providerScheduleId] : []),
			]);
			await deleteByIds(ctx, providerSchedules);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("collectionPlanEntries")
						.withIndex("by_mortgage_status_scheduled", (query) =>
							query.eq("mortgageId", mortgageId)
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("mortgageFees")
						.withIndex("by_mortgage", (query) =>
							query.eq("mortgageId", mortgageId)
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("workoutPlans")
						.withIndex("by_mortgage", (query) =>
							query.eq("mortgageId", mortgageId)
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("obligations")
						.withIndex("by_mortgage_and_date", (query) =>
							query.eq("mortgageId", mortgageId)
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("cash_ledger_journal_entries")
						.withIndex("by_mortgage_and_sequence", (query) =>
							query.eq("mortgageId", mortgageId)
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("cash_ledger_accounts")
						.withIndex("by_mortgage", (query) =>
							query.eq("mortgageId", mortgageId)
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("auditJournal")
						.withIndex("by_mortgage", (query) =>
							query.eq("mortgageId", String(mortgageId))
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteRows(
				ctx,
				await ctx.db
					.query("ledger_reservations")
					.withIndex("by_mortgage", (query) =>
						query.eq("mortgageId", String(mortgageId))
					)
					.collect()
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("ledger_journal_entries")
						.withIndex("by_mortgage_and_time", (query) =>
							query.eq("mortgageId", String(mortgageId))
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("ledger_accounts")
						.withIndex("by_mortgage", (query) =>
							query.eq("mortgageId", String(mortgageId))
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("mortgageBorrowers")
						.withIndex("by_mortgage", (query) =>
							query.eq("mortgageId", mortgageId)
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("mortgageValuationSnapshots")
						.withIndex("by_mortgage_created_at", (query) =>
							query.eq("mortgageId", mortgageId)
						)
						.collect()
				).map((entry) => entry._id)
			);
		}

		if (propertyId) {
			const appraisals = await ctx.db
				.query("appraisals")
				.withIndex("by_property", (query) => query.eq("propertyId", propertyId))
				.collect();
			await deleteByIds(
				ctx,
				(
					await Promise.all(
						appraisals.map((appraisal) =>
							ctx.db
								.query("appraisalComparables")
								.withIndex("by_appraisal", (query) =>
									query.eq("appraisalId", appraisal._id)
								)
								.collect()
						)
					)
				)
					.flat()
					.map((entry) => entry._id)
			);
			await deleteByIds(
				ctx,
				appraisals.map((entry) => entry._id)
			);
		}

		if (item.listingId) {
			const listing = await ctx.db.get(item.listingId);
			if (listing) {
				await ctx.db.delete(item.listingId);
			}
		}

		if (mortgageId) {
			const mortgage = await ctx.db.get(mortgageId);
			if (mortgage) {
				await ctx.db.delete(mortgageId);
			}
		}

		if (propertyId) {
			const remainingMortgages = await ctx.db
				.query("mortgages")
				.withIndex("by_property", (query) => query.eq("propertyId", propertyId))
				.collect();
			if (remainingMortgages.length === 0) {
				const property = await ctx.db.get(propertyId);
				if (property) {
					await ctx.db.delete(propertyId);
				}
			}
		}

		if (borrowerId) {
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("bankAccounts")
						.withIndex("by_owner", (query) =>
							query
								.eq("ownerType", "borrower")
								.eq("ownerId", String(borrowerId))
						)
						.collect()
				).map((entry) => entry._id)
			);
			await deleteByIds(
				ctx,
				(
					await ctx.db
						.query("externalCustomerProfiles")
						.withIndex("by_borrower", (query) =>
							query.eq("borrowerId", borrowerId)
						)
						.collect()
				).map((entry) => entry._id)
			);
			const borrower = await ctx.db.get(borrowerId);
			if (borrower) {
				await ctx.db.delete(borrowerId);
			}
		}

		if (userId) {
			const [borrowers, brokers, lenders] = await Promise.all([
				ctx.db
					.query("borrowers")
					.withIndex("by_user", (query) => query.eq("userId", userId))
					.collect(),
				ctx.db
					.query("brokers")
					.withIndex("by_user", (query) => query.eq("userId", userId))
					.collect(),
				ctx.db
					.query("lenders")
					.withIndex("by_user", (query) => query.eq("userId", userId))
					.collect(),
			]);
			if (
				borrowers.length === 0 &&
				brokers.length === 0 &&
				lenders.length === 0
			) {
				const user = await ctx.db.get(userId);
				if (user) {
					await ctx.db.delete(userId);
				}
			}
		}
		if (userAuthId) {
			const duplicateCleanup = await deleteOrphanUsersByAuthId(ctx, {
				authId: userAuthId,
			});
			if (duplicateCleanup.deletedUserIds.length > 0) {
				console.warn(
					`[mock-mortgages] Deleted ${duplicateCleanup.deletedUserIds.length} orphan duplicate user row(s) for ${userAuthId} during cleanup.`
				);
			}
			if (duplicateCleanup.blockedUserIds.length > 0) {
				console.warn(
					`[mock-mortgages] Referenced duplicate user row(s) remain for ${userAuthId}: ${duplicateCleanup.blockedUserIds.join(", ")}`
				);
			}
		}

		if (caseId) {
			const caseRecord = await ctx.db.get(caseId);
			if (caseRecord) {
				await ctx.db.delete(caseId);
			}
		}

		await ctx.db.patch(args.batchItemId, {
			lastError: undefined,
			status: "cleaned",
			updatedAt: Date.now(),
		});

		return { cleaned: true };
	})
	.internal();

async function seedCatalogItem(args: {
	batchId: Id<"mockOriginationBatches">;
	batchItemId: Id<"mockOriginationBatchItems">;
	catalogItem: MockMortgageCatalogItem;
	index: number;
	orgId: string;
	brokerId: Id<"brokers">;
	portalId: Id<"portals">;
	viewerAuthId: string;
	viewerIsFairLendAdmin: boolean;
	viewerOrgId?: string;
	ctx: Pick<ActionCtx, "runAction" | "runMutation" | "runQuery">;
}) {
	const { catalogItem, ctx } = args;
	const bootstrapToken = buildBootstrapToken(args.batchId, catalogItem);
	const caseId = await ctx.runMutation(
		internal.admin.origination.cases.createCaseInternal,
		{
			bootstrapToken,
			viewerAuthId: args.viewerAuthId,
			viewerIsFairLendAdmin: args.viewerIsFairLendAdmin,
			viewerOrgId: args.viewerOrgId,
		}
	);
	await ctx.runMutation(
		internal.admin.settings.actions.updateMockOriginationBatchItem,
		{
			batchItemId: args.batchItemId,
			caseId,
			status: "case_created",
		}
	);

	const bankAccount = buildMockMortgageBankAccount(args.index);
	const borrowerProfile = await ctx.runAction(
		internal.admin.origination.collections.createCanonicalBorrowerProfile,
		{
			accountNumber: bankAccount.accountNumber,
			email: buildMockMortgageBorrowerEmail(catalogItem),
			fullName: catalogItem.borrowerName,
			institutionNumber: bankAccount.institutionNumber,
			orgId: args.orgId,
			phone: buildMockMortgageBorrowerPhone(args.index),
			portalId: args.portalId,
			sourceLabel: buildBorrowerSourceLabel(args.batchId, catalogItem),
			transitNumber: bankAccount.transitNumber,
		}
	);
	if (!borrowerProfile.bankAccountId) {
		throw new ConvexError(
			"Mock borrower creation did not return a bank account"
		);
	}
	const borrowerRefs = await ctx.runQuery(
		internal.admin.settings.actions.getBorrowerSeedRefs,
		{
			borrowerId: borrowerProfile.borrowerId,
		}
	);
	await ctx.runMutation(
		internal.admin.settings.actions.updateMockOriginationBatchItem,
		{
			batchItemId: args.batchItemId,
			bankAccountId: borrowerProfile.bankAccountId,
			borrowerId: borrowerRefs.borrowerId,
			status: "borrower_created",
			userId: borrowerRefs.userId,
		}
	);

	const dates = buildScheduleDates(catalogItem.termMonths, Date.now());
	const paymentAmount = computeAmortizedMonthlyPaymentCents({
		amortizationMonths: catalogItem.amortizationMonths,
		annualRatePercent: catalogItem.interestRatePercent,
		principalDollars: catalogItem.principalDollars,
	});
	await ctx.runMutation(internal.admin.origination.cases.patchCaseInternal, {
		caseId,
		patch: {
			currentStep: "collections",
			listingOverrides: {
				adminNotes: `Mock mortgage seed fixture ${String(args.batchId)} / ${catalogItem.key}`,
				description: buildListingDescription(catalogItem),
				displayOrder: args.index + 1,
				featured: args.index < 4,
				heroImages: [
					{
						caption: `Mock property image for ${catalogItem.neighborhoodLabel}`,
						storageId: catalogItem.heroImageStorageId,
					},
				],
				marketplaceCopy: buildMarketplaceCopy(catalogItem),
				seoSlug: buildMockMortgageSeoSlug(catalogItem),
				title: buildMockMortgageListingTitle(catalogItem),
			},
			mortgageDraft: {
				amortizationMonths: catalogItem.amortizationMonths,
				firstPaymentDate: dates.firstPaymentDate,
				fundedAt: Date.now(),
				interestAdjustmentDate: dates.interestAdjustmentDate,
				interestRate: catalogItem.interestRatePercent,
				lienPosition: catalogItem.lienPosition,
				loanType: "conventional",
				maturityDate: dates.maturityDate,
				paymentAmount,
				paymentFrequency: "monthly",
				principal: dollarsToCents(catalogItem.principalDollars),
				rateType: "fixed",
				termMonths: catalogItem.termMonths,
				termStartDate: dates.termStartDate,
			},
			participantsDraft: {
				brokerOfRecordId: args.brokerId,
				brokerOfRecordLabel: "Mock Seed Broker",
				primaryBorrower: {
					email: buildMockMortgageBorrowerEmail(catalogItem),
					existingBorrowerId: borrowerRefs.borrowerId,
					fullName: catalogItem.borrowerName,
					phone: buildMockMortgageBorrowerPhone(args.index),
				},
			},
			propertyDraft: {
				create: {
					approximateLatitude: catalogItem.address.latitude,
					approximateLongitude: catalogItem.address.longitude,
					city: catalogItem.address.city,
					postalCode: catalogItem.address.postalCode,
					propertyType: catalogItem.propertyType,
					province: catalogItem.address.province,
					streetAddress: catalogItem.address.streetAddress,
					unit: catalogItem.address.unit,
				},
			},
			valuationDraft: {
				comparables: catalogItem.comparables.map((comparable, index) => ({
					address: comparable.address,
					adjustedValue: dollarsToCents(comparable.adjustedValueDollars),
					lotSize: comparable.lotSize,
					propertyType: comparable.propertyType,
					saleDate: comparable.saleDate,
					salePrice: dollarsToCents(comparable.salePriceDollars),
					sortOrder: index,
					squareFootage: comparable.squareFootage,
					yearBuilt: comparable.yearBuilt,
				})),
				valuationDate: dates.valuationDate,
				valueAsIs: dollarsToCents(catalogItem.appraisalValueDollars),
				visibilityHint: "public",
			},
		},
		viewerAuthId: args.viewerAuthId,
		viewerIsFairLendAdmin: args.viewerIsFairLendAdmin,
		viewerOrgId: args.viewerOrgId,
	});

	const createdSchedule = await ctx.runAction(
		internal.admin.origination.collections.createRotessaScheduleForCaseInternal,
		{
			bankAccountId: borrowerProfile.bankAccountId,
			borrowerId: borrowerRefs.borrowerId,
			caseId,
			padAuthorizationOverrideReason: buildPadOverrideReason(
				args.batchId,
				catalogItem
			),
			padAuthorizationSource: "admin_override",
			viewerAuthId: args.viewerAuthId,
			viewerIsFairLendAdmin: args.viewerIsFairLendAdmin,
			viewerOrgId: args.viewerOrgId,
		}
	);
	await ctx.runMutation(
		internal.admin.settings.actions.updateMockOriginationBatchItem,
		{
			batchItemId: args.batchItemId,
			customerProfileId: createdSchedule.customerProfileId,
			providerScheduleId: createdSchedule.providerScheduleId,
			status: "schedule_created",
		}
	);

	await ctx.runMutation(internal.admin.origination.cases.patchCaseInternal, {
		caseId,
		patch: {
			collectionsDraft: {
				borrowerSource: "existing",
				executionIntent: "provider_managed_now",
				mode: "provider_managed_now",
				padAuthorizationOverrideReason: buildPadOverrideReason(
					args.batchId,
					catalogItem
				),
				padAuthorizationSource: "admin_override",
				providerCode: "pad_rotessa",
				scheduleSource: "create",
				selectedBankAccountId: borrowerProfile.bankAccountId,
				selectedBorrowerId: borrowerRefs.borrowerId,
				selectedProviderScheduleId: createdSchedule.providerScheduleId,
			},
			currentStep: "review",
		},
		viewerAuthId: args.viewerAuthId,
		viewerIsFairLendAdmin: args.viewerIsFairLendAdmin,
		viewerOrgId: args.viewerOrgId,
	});

	const committed = await ctx.runAction(
		internal.admin.origination.commit.commitCaseInternal,
		{
			caseId,
			viewerAuthId: args.viewerAuthId,
			viewerIsFairLendAdmin: args.viewerIsFairLendAdmin,
			viewerOrgId: args.viewerOrgId,
		}
	);
	if (committed.status !== "committed") {
		throw new ConvexError(
			`Mock mortgage ${catalogItem.key} did not commit successfully`
		);
	}

	const committedRefs = await ctx.runQuery(
		internal.admin.settings.actions.getCommittedCaseRefs,
		{ caseId }
	);
	await ctx.runMutation(
		internal.admin.settings.actions.updateMockOriginationBatchItem,
		{
			batchItemId: args.batchItemId,
			listingId: committedRefs.listingId,
			mortgageId: committedRefs.mortgageId,
			propertyId: committedRefs.propertyId,
			status: "committed",
			valuationSnapshotId: committedRefs.valuationSnapshotId ?? undefined,
		}
	);
	await ctx.runMutation(internal.listings.lifecycle.publishListingInternal, {
		actorAuthId: args.viewerAuthId,
		listingId: committedRefs.listingId,
	});
	await ctx.runMutation(
		internal.admin.settings.actions.updateMockOriginationBatchItem,
		{
			batchItemId: args.batchItemId,
			listingId: committedRefs.listingId,
			mortgageId: committedRefs.mortgageId,
			propertyId: committedRefs.propertyId,
			status: "published",
			valuationSnapshotId: committedRefs.valuationSnapshotId ?? undefined,
		}
	);
}

export const seedMockMortgages = adminAction
	.handler(
		async (
			ctx
		): Promise<{
			batchId: Id<"mockOriginationBatches">;
			itemCount: number;
			status: "ready";
		}> => {
			const viewerContext: {
				activeBatch: MockOriginationBatchStatusSnapshot | null;
				viewerUserId: Id<"users">;
			} = await ctx.runQuery(
				internal.admin.settings.actions.getSeedViewerContext,
				{
					viewerAuthId: ctx.viewer.authId,
					viewerOrgId: ctx.viewer.orgId,
				}
			);
			if (!ctx.viewer.orgId) {
				throw new ConvexError(
					"Mock mortgage seeding requires an active organization context."
				);
			}
			if (viewerContext.activeBatch?.activeBatchExists) {
				throw new ConvexError(
					`A mock mortgage batch already exists (${String(
						viewerContext.activeBatch.batchId
					)}). Run cleanup before seeding again.`
				);
			}

			const batchId: Id<"mockOriginationBatches"> = await ctx.runMutation(
				internal.admin.settings.actions.createMockOriginationBatch,
				{
					catalogVersion: MOCK_MORTGAGE_CATALOG_VERSION,
					createdByAuthId: ctx.viewer.authId,
					createdByUserId: viewerContext.viewerUserId,
					itemCount: MOCK_MORTGAGE_CATALOG.length,
					orgId: ctx.viewer.orgId,
				}
			);
			const brokerContext = await ctx.runMutation(
				internal.admin.settings.actions.ensureMockSeedBrokerPortal,
				{
					orgId: ctx.viewer.orgId,
					viewerUserId: viewerContext.viewerUserId,
				}
			);

			try {
				for (const [index, catalogItem] of MOCK_MORTGAGE_CATALOG.entries()) {
					const batchItemId = await ctx.runMutation(
						internal.admin.settings.actions.createMockOriginationBatchItem,
						{
							batchId,
							bootstrapToken: buildBootstrapToken(batchId, catalogItem),
							borrowerDisplayName: catalogItem.borrowerName,
							catalogKey: catalogItem.key,
							imageStorageId: catalogItem.heroImageStorageId,
							listingTitle: buildMockMortgageListingTitle(catalogItem),
						}
					);
					try {
						await seedCatalogItem({
							batchId,
							batchItemId,
							brokerId: brokerContext.brokerId,
							catalogItem,
							ctx,
							index,
							orgId: ctx.viewer.orgId,
							portalId: brokerContext.portalId,
							viewerAuthId: ctx.viewer.authId,
							viewerIsFairLendAdmin: ctx.viewer.isFairLendAdmin,
							viewerOrgId: ctx.viewer.orgId,
						});
					} catch (error) {
						const message = normalizeMockSeedError(error);
						await ctx.runMutation(
							internal.admin.settings.actions.updateMockOriginationBatchItem,
							{
								batchItemId,
								lastError: message,
								status: "failed",
							}
						);
						throw error;
					}
				}

				await ctx.runMutation(
					internal.admin.settings.actions.updateMockOriginationBatch,
					{
						batchId,
						completedAt: Date.now(),
						lastError: undefined,
						status: "ready",
					}
				);
			} catch (error) {
				const message = normalizeMockSeedError(error);
				await ctx.runMutation(
					internal.admin.settings.actions.updateMockOriginationBatch,
					{
						batchId,
						failedAt: Date.now(),
						lastError: message,
						status: "failed",
					}
				);
				throw error;
			}

			return {
				batchId,
				itemCount: MOCK_MORTGAGE_CATALOG.length,
				status: "ready" as const,
			};
		}
	)
	.public();

export const cleanupMockMortgages = adminAction
	.handler(
		async (
			ctx
		): Promise<
			| {
					batchId: Id<"mockOriginationBatches">;
					cleanedCount: number;
					status: "cleaned";
			  }
			| {
					batchId: null;
					cleanedCount: 0;
					status: "noop";
			  }
		> => {
			if (!ctx.viewer.orgId) {
				throw new ConvexError(
					"Mock mortgage cleanup requires an active organization context."
				);
			}

			const viewerContext: {
				activeBatch: MockOriginationBatchStatusSnapshot | null;
				viewerUserId: Id<"users">;
			} = await ctx.runQuery(
				internal.admin.settings.actions.getSeedViewerContext,
				{
					viewerAuthId: ctx.viewer.authId,
					viewerOrgId: ctx.viewer.orgId,
				}
			);
			const batchSnapshot: MockOriginationBatchStatusSnapshot | null =
				viewerContext.activeBatch;
			if (!(batchSnapshot?.batchId && batchSnapshot.activeBatchExists)) {
				return {
					batchId: null,
					cleanedCount: 0,
					status: "noop" as const,
				};
			}

			await ctx.runMutation(
				internal.admin.settings.actions.updateMockOriginationBatch,
				{
					batchId: batchSnapshot.batchId,
					lastError: undefined,
					status: "cleaning",
				}
			);
			const batchItems = await ctx.runQuery(
				internal.admin.settings.actions.getMockOriginationBatchItems,
				{
					batchId: batchSnapshot.batchId,
				}
			);
			const rotessa = new RotessaApiClient();
			let lastError: string | undefined;
			let cleanedCount = 0;

			for (const item of batchItems) {
				try {
					if (item.providerScheduleId) {
						const providerContext = await ctx.runQuery(
							internal.admin.settings.actions.getProviderScheduleCleanupContext,
							{
								providerScheduleId: item.providerScheduleId,
							}
						);
						if (providerContext?.externalScheduleRef) {
							try {
								await rotessa.deleteTransactionSchedule(
									providerContext.externalScheduleRef
								);
							} catch (error) {
								if (!isRotessaDeleteNotFound(error)) {
									throw error;
								}
							}
						}
					}

					await ctx.runMutation(
						internal.admin.settings.actions.updateMockOriginationBatchItem,
						{
							batchItemId: item._id,
							lastError: undefined,
							status: "cleanup_provider_done",
						}
					);
					await ctx.runMutation(
						internal.admin.settings.actions
							.cleanupMockOriginationBatchItemLocal,
						{
							batchItemId: item._id,
						}
					);
					cleanedCount += 1;
				} catch (error) {
					lastError = normalizeMockSeedError(error);
					await ctx.runMutation(
						internal.admin.settings.actions.updateMockOriginationBatchItem,
						{
							batchItemId: item._id,
							lastError,
							status: "failed",
						}
					);
				}
			}

			await ctx.runMutation(
				internal.admin.settings.actions.updateMockOriginationBatch,
				{
					batchId: batchSnapshot.batchId,
					cleanedAt: Date.now(),
					lastError,
					status: lastError ? "clean_failed" : "cleaned",
				}
			);

			if (lastError) {
				throw new ConvexError(lastError);
			}

			return {
				batchId: batchSnapshot.batchId,
				cleanedCount,
				status: "cleaned" as const,
			};
		}
	)
	.public();
