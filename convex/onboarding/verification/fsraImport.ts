import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import {
	normalizeBrokerOnboardingPersonName,
	normalizeBrokerOnboardingProvince,
} from "../../../shared/brokerOnboarding/contracts";
import type { Doc } from "../../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../../_generated/server";
import { convex } from "../../fluent";
import { DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG } from "./config";
import {
	computeFsraFreshness,
	type FsraSourceRecord,
	normalizeFsraIdentifier,
	normalizeOptionalFsraIdentifier,
} from "./fsraFixtures";
import type {
	ImportedFsraBrokerageRecord,
	ImportedFsraRegulatorProviderOptions,
	ImportedFsraRegulatorRecord,
} from "./providers/importedFsra";
import { createBrokerOnboardingVerificationRegistry } from "./registry";
import {
	fsraImportTriggerValidator,
	fsraSourceRecordValidator,
} from "./validators";

const FSRA_IMPORT_PAGE_SIZE = 100;

interface FsraSourceRecordPage {
	continueCursor: string | null;
	isDone: boolean;
	page: FsraSourceRecord[];
}

const startFsraImportRunRef = makeFunctionReference<
	"mutation",
	{ trigger: "cron" | "manual" },
	Promise<Doc<"fsraImportRuns">["_id"]>
>("onboarding/verification/fsraImport:startFsraImportRun");

const upsertFsraImportRecordsRef = makeFunctionReference<
	"mutation",
	{ records: FsraSourceRecord[]; replaceSnapshot?: boolean },
	Promise<{
		createdCount: number;
		failedCount: number;
		recordCount: number;
		updatedCount: number;
	}>
>("onboarding/verification/fsraImport:upsertFsraImportRecords");

const upsertFsraSourceRowsRef = makeFunctionReference<
	"mutation",
	{ records: FsraSourceRecord[]; replaceSnapshot?: boolean },
	Promise<{
		failedCount: number;
		recordCount: number;
	}>
>("onboarding/verification/fsraImport:upsertFsraSourceRows");

const listFsraSourceRecordsRef = makeFunctionReference<
	"query",
	{ cursor?: string | null; limit?: number },
	Promise<FsraSourceRecordPage>
>("onboarding/verification/fsraImport:listFsraSourceRecordsPage");

const finishFsraImportRunRef = makeFunctionReference<
	"mutation",
	{
		createdCount: number;
		errorMessage?: string;
		failedCount: number;
		recordCount: number;
		runId: Doc<"fsraImportRuns">["_id"];
		status: "failed" | "success";
		updatedCount: number;
	},
	Promise<Doc<"fsraImportRuns"> | null>
>("onboarding/verification/fsraImport:finishFsraImportRun");

interface FsraLookupContext {
	db: QueryCtx["db"] | MutationCtx["db"];
}

function trimToUndefined(value: string | null | undefined) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function formatFsraSourceRecordKey(record: FsraSourceRecord): string {
	const province = record.province.trim() || "missing-province";
	const licenseNumber = record.licenseNumber.trim() || "missing-license-number";
	return `${province}:${licenseNumber}`;
}

function normalizeRequiredFsraIdentifier(
	value: string,
	fieldName: string,
	record: FsraSourceRecord
): string {
	const normalized = normalizeFsraIdentifier(value);
	if (!normalized) {
		throw new ConvexError(
			`FSRA source record ${fieldName} is required for ${formatFsraSourceRecordKey(record)}`
		);
	}
	return normalized;
}

function normalizeRequiredFsraText(
	value: string,
	fieldName: string,
	record: FsraSourceRecord
): string {
	const normalized = value.trim();
	if (!normalized) {
		throw new ConvexError(
			`FSRA source record ${fieldName} is required for ${formatFsraSourceRecordKey(record)}`
		);
	}
	return normalized;
}

function normalizeFsraSourceRecord(record: FsraSourceRecord) {
	return {
		brokerageName: trimToUndefined(record.brokerageName),
		brokerageNumber:
			normalizeOptionalFsraIdentifier(record.brokerageNumber) ?? undefined,
		lastVerifiedAt: record.lastVerifiedAt,
		licenseNumber: normalizeRequiredFsraIdentifier(
			record.licenseNumber,
			"licenseNumber",
			record
		),
		licenseType: record.licenseType,
		licenseeFullName: normalizeRequiredFsraText(
			record.licenseeFullName,
			"licenseeFullName",
			record
		),
		province: normalizeRequiredFsraIdentifier(
			record.province,
			"province",
			record
		),
		rawRecord: { ...record.rawRecord },
		sourceImportedAt: record.sourceImportedAt,
		status: record.status,
	};
}

function buildNormalizedFsraKey(args: {
	licenseNumber: string;
	province: string;
}): string {
	return `${args.province}:${args.licenseNumber}`;
}

function wrapFsraSourceRecordError(
	record: FsraSourceRecord,
	error: unknown
): ConvexError<string> {
	const message = error instanceof Error ? error.message : "unknown error";
	return new ConvexError(
		`FSRA source record ${formatFsraSourceRecordKey(record)} failed: ${message}`
	);
}

function requireFsraImportRecords(
	records: FsraSourceRecord[] | undefined
): FsraSourceRecord[] {
	if (records !== undefined && records.length > 0) {
		return records;
	}

	throw new ConvexError(
		"FSRA import source records are required. Supply normalized FSRA rows to the refresh action before running a manual or scheduled import."
	);
}

function mapFsraDocToImportedLicenseRecord(
	record: Doc<"fsraLicenses">,
	now: number,
	freshnessWindowMs: number
): ImportedFsraRegulatorRecord {
	const legalName = normalizeBrokerOnboardingPersonName({
		fullName: record.licenseeFullName,
	});

	return {
		brokerageName: record.brokerageName ?? null,
		brokerageNumber: record.brokerageNumber ?? null,
		dataAsOf: record.lastVerifiedAt,
		freshness: computeFsraFreshness({
			freshnessWindowMs,
			now,
			sourceImportedAt: record.sourceImportedAt,
		}),
		legalName,
		licenseNumber: record.licenseNumber,
		licenseType: record.licenseType,
		province: record.province,
		sourceSnapshot: { ...record.rawRecord },
		status: record.status,
	};
}

function mapFsraSourceRowToSourceRecord(
	record: Doc<"fsraSourceRows">
): FsraSourceRecord {
	return {
		brokerageName: record.brokerageName ?? null,
		brokerageNumber: record.brokerageNumber ?? null,
		lastVerifiedAt: record.lastVerifiedAt,
		licenseNumber: record.licenseNumber,
		licenseType: record.licenseType,
		licenseeFullName: record.licenseeFullName,
		province: record.province,
		rawRecord: { ...record.rawRecord },
		sourceImportedAt: record.sourceImportedAt,
		status: record.status,
	};
}

function mapFsraDocToImportedBrokerageRecord(
	record: Doc<"fsraLicenses">,
	now: number,
	freshnessWindowMs: number
): ImportedFsraBrokerageRecord {
	return {
		brokerageName: record.brokerageName ?? record.licenseeFullName,
		brokerageNumber: record.brokerageNumber ?? record.licenseNumber,
		dataAsOf: record.lastVerifiedAt,
		freshness: computeFsraFreshness({
			freshnessWindowMs,
			now,
			sourceImportedAt: record.sourceImportedAt,
		}),
		province: record.province,
		sourceSnapshot: { ...record.rawRecord },
		status: record.status,
	};
}

export async function lookupImportedFsraLicenseRecord(
	ctx: FsraLookupContext,
	args: {
		freshnessWindowMs?: number;
		licenseNumber: string;
		now?: number;
		province: string;
	}
): Promise<ImportedFsraRegulatorRecord | null> {
	const now = args.now ?? Date.now();
	const freshnessWindowMs =
		args.freshnessWindowMs ??
		DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG.regulatorFreshnessWindowMs;
	const province = normalizeBrokerOnboardingProvince(args.province);
	const licenseNumber = normalizeFsraIdentifier(args.licenseNumber);

	const record = await ctx.db
		.query("fsraLicenses")
		.withIndex("by_province_license_number", (query) =>
			query.eq("province", province).eq("licenseNumber", licenseNumber)
		)
		.first();

	return record
		? mapFsraDocToImportedLicenseRecord(record, now, freshnessWindowMs)
		: null;
}

export async function lookupImportedFsraBrokerageRecord(
	ctx: FsraLookupContext,
	args: {
		brokerageNumber: string;
		freshnessWindowMs?: number;
		now?: number;
		province: string;
	}
): Promise<ImportedFsraBrokerageRecord | null> {
	const now = args.now ?? Date.now();
	const freshnessWindowMs =
		args.freshnessWindowMs ??
		DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG.regulatorFreshnessWindowMs;
	const province = normalizeBrokerOnboardingProvince(args.province);
	const brokerageNumber = normalizeFsraIdentifier(args.brokerageNumber);

	const records = await ctx.db
		.query("fsraLicenses")
		.withIndex("by_province_brokerage_number", (query) =>
			query.eq("province", province).eq("brokerageNumber", brokerageNumber)
		)
		.collect();
	const fallbackRecord =
		records.length === 0
			? await ctx.db
					.query("fsraLicenses")
					.withIndex("by_province_license_number", (query) =>
						query.eq("province", province).eq("licenseNumber", brokerageNumber)
					)
					.first()
			: null;
	const brokerageRecords =
		fallbackRecord?.licenseType === "brokerage" ? [fallbackRecord] : records;

	if (brokerageRecords.length === 0) {
		return null;
	}

	const record =
		brokerageRecords.find((entry) => entry.licenseType === "brokerage") ??
		brokerageRecords.find((entry) => entry.status === "active") ??
		brokerageRecords[0];

	return mapFsraDocToImportedBrokerageRecord(record, now, freshnessWindowMs);
}

export function createImportedFsraProviderBindings(
	ctx: FsraLookupContext,
	options: {
		freshnessWindowMs?: number;
		now?: () => number;
	} = {}
): ImportedFsraRegulatorProviderOptions {
	const now = options.now ?? Date.now;
	const freshnessWindowMs =
		options.freshnessWindowMs ??
		DEFAULT_BROKER_ONBOARDING_VERIFICATION_CONFIG.regulatorFreshnessWindowMs;

	return {
		now,
		lookupBrokerageRecord: (request) =>
			lookupImportedFsraBrokerageRecord(ctx, {
				brokerageNumber: request.brokerageNumber,
				freshnessWindowMs,
				now: now(),
				province: request.province,
			}),
		lookupRecord: (request) =>
			lookupImportedFsraLicenseRecord(ctx, {
				freshnessWindowMs,
				licenseNumber: request.licenseNumber,
				now: now(),
				province: request.province,
			}),
	};
}

export const lookupImportedFsraLicense = convex
	.query()
	.input({
		expectedBrokerageName: v.optional(v.union(v.string(), v.null())),
		expectedBrokerageNumber: v.optional(v.union(v.string(), v.null())),
		licenseNumber: v.string(),
		province: v.string(),
		requestedAt: v.optional(v.number()),
		selfReportedFullName: v.optional(v.union(v.string(), v.null())),
	})
	.handler(async (ctx, args) => {
		const requestedAt = args.requestedAt ?? Date.now();
		const registry = createBrokerOnboardingVerificationRegistry({
			configOverrides: {
				providers: { regulatorDirectory: "imported_fsra" },
			},
			importedFsra: createImportedFsraProviderBindings(ctx, {
				now: () => requestedAt,
			}),
		});

		return registry.regulatorDirectory.lookupLicense({
			expectedBrokerageName: args.expectedBrokerageName,
			expectedBrokerageNumber: args.expectedBrokerageNumber,
			licenseNumber: args.licenseNumber,
			province: args.province,
			requestedAt,
			selfReportedName: { fullName: args.selfReportedFullName ?? null },
		});
	})
	.internal();

export const lookupImportedFsraBrokerage = convex
	.query()
	.input({
		brokerageNumber: v.string(),
		province: v.string(),
		requestedAt: v.optional(v.number()),
	})
	.handler(async (ctx, args) => {
		const requestedAt = args.requestedAt ?? Date.now();
		const registry = createBrokerOnboardingVerificationRegistry({
			configOverrides: {
				providers: { regulatorDirectory: "imported_fsra" },
			},
			importedFsra: createImportedFsraProviderBindings(ctx, {
				now: () => requestedAt,
			}),
		});

		return registry.regulatorDirectory.lookupBrokerage({
			brokerageNumber: args.brokerageNumber,
			province: args.province,
			requestedAt,
		});
	})
	.internal();

export const startFsraImportRun = convex
	.mutation()
	.input({
		trigger: fsraImportTriggerValidator,
	})
	.handler(async (ctx, args) =>
		ctx.db.insert("fsraImportRuns", {
			status: "running",
			trigger: args.trigger,
			startedAt: Date.now(),
			finishedAt: undefined,
			recordCount: 0,
			createdCount: 0,
			updatedCount: 0,
			failedCount: 0,
			errorMessage: undefined,
		})
	)
	.internal();

export const upsertFsraImportRecords = convex
	.mutation()
	.input({
		records: v.array(fsraSourceRecordValidator),
		replaceSnapshot: v.optional(v.boolean()),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		let createdCount = 0;
		let updatedCount = 0;
		const failedCount = 0;
		const retainedKeys = new Set<string>();

		for (const record of args.records) {
			try {
				const normalized = normalizeFsraSourceRecord(record);
				retainedKeys.add(buildNormalizedFsraKey(normalized));
				const existing = await ctx.db
					.query("fsraLicenses")
					.withIndex("by_province_license_number", (query) =>
						query
							.eq("province", normalized.province)
							.eq("licenseNumber", normalized.licenseNumber)
					)
					.first();

				if (existing) {
					await ctx.db.patch(existing._id, {
						...normalized,
						createdAt: existing.createdAt,
						updatedAt: now,
					});
					updatedCount += 1;
					continue;
				}

				await ctx.db.insert("fsraLicenses", {
					...normalized,
					createdAt: now,
					updatedAt: now,
				});
				createdCount += 1;
			} catch (error) {
				throw wrapFsraSourceRecordError(record, error);
			}
		}

		if (args.replaceSnapshot === true) {
			const existingRecords = await ctx.db.query("fsraLicenses").collect();
			for (const existing of existingRecords) {
				if (
					!retainedKeys.has(
						buildNormalizedFsraKey({
							licenseNumber: existing.licenseNumber,
							province: existing.province,
						})
					)
				) {
					await ctx.db.delete(existing._id);
				}
			}
		}

		return {
			recordCount: args.records.length,
			createdCount,
			updatedCount,
			failedCount,
		};
	})
	.internal();

export const upsertFsraSourceRows = convex
	.mutation()
	.input({
		records: v.array(fsraSourceRecordValidator),
		replaceSnapshot: v.optional(v.boolean()),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		const failedCount = 0;
		const retainedKeys = new Set<string>();

		for (const record of args.records) {
			try {
				const normalized = normalizeFsraSourceRecord(record);
				retainedKeys.add(buildNormalizedFsraKey(normalized));
				const existing = await ctx.db
					.query("fsraSourceRows")
					.withIndex("by_province_license_number", (query) =>
						query
							.eq("province", normalized.province)
							.eq("licenseNumber", normalized.licenseNumber)
					)
					.first();

				if (existing) {
					await ctx.db.patch(existing._id, {
						...normalized,
						createdAt: existing.createdAt,
						sourceSuppliedAt: now,
						updatedAt: now,
					});
					continue;
				}

				await ctx.db.insert("fsraSourceRows", {
					...normalized,
					sourceSuppliedAt: now,
					createdAt: now,
					updatedAt: now,
				});
			} catch (error) {
				throw wrapFsraSourceRecordError(record, error);
			}
		}

		if (args.replaceSnapshot === true) {
			const existingRecords = await ctx.db.query("fsraSourceRows").collect();
			for (const existing of existingRecords) {
				if (
					!retainedKeys.has(
						buildNormalizedFsraKey({
							licenseNumber: existing.licenseNumber,
							province: existing.province,
						})
					)
				) {
					await ctx.db.delete(existing._id);
				}
			}
		}

		return {
			recordCount: args.records.length,
			failedCount,
		};
	})
	.internal();

export const listFsraSourceRecordsPage = convex
	.query()
	.input({
		cursor: v.optional(v.union(v.string(), v.null())),
		limit: v.optional(v.number()),
	})
	.handler(async (ctx, args) => {
		const result = await ctx.db
			.query("fsraSourceRows")
			.withIndex("by_province_license_number")
			.paginate({
				cursor: args.cursor ?? null,
				numItems: args.limit ?? FSRA_IMPORT_PAGE_SIZE,
			});

		return {
			continueCursor: result.continueCursor,
			isDone: result.isDone,
			page: result.page.map(mapFsraSourceRowToSourceRecord),
		};
	})
	.internal();

export const finishFsraImportRun = convex
	.mutation()
	.input({
		createdCount: v.number(),
		errorMessage: v.optional(v.string()),
		failedCount: v.number(),
		recordCount: v.number(),
		runId: v.id("fsraImportRuns"),
		status: v.union(v.literal("success"), v.literal("failed")),
		updatedCount: v.number(),
	})
	.handler(async (ctx, args) => {
		await ctx.db.patch(args.runId, {
			status: args.status,
			finishedAt: Date.now(),
			recordCount: args.recordCount,
			createdCount: args.createdCount,
			updatedCount: args.updatedCount,
			failedCount: args.failedCount,
			errorMessage: args.errorMessage,
		});

		return ctx.db.get(args.runId);
	})
	.internal();

interface FsraImportCounts {
	createdCount: number;
	failedCount: number;
	recordCount: number;
	updatedCount: number;
}

function emptyFsraImportCounts(): FsraImportCounts {
	return {
		createdCount: 0,
		failedCount: 0,
		recordCount: 0,
		updatedCount: 0,
	};
}

function addFsraImportCounts(
	current: FsraImportCounts,
	next: FsraImportCounts
): FsraImportCounts {
	return {
		createdCount: current.createdCount + next.createdCount,
		failedCount: current.failedCount + next.failedCount,
		recordCount: current.recordCount + next.recordCount,
		updatedCount: current.updatedCount + next.updatedCount,
	};
}

async function runProvidedFsraImport(
	ctx: ActionCtx,
	records: FsraSourceRecord[]
): Promise<FsraImportCounts> {
	const requiredRecords = requireFsraImportRecords(records);
	await ctx.runMutation(upsertFsraSourceRowsRef, {
		records: requiredRecords,
		replaceSnapshot: true,
	});
	const result = await ctx.runMutation(upsertFsraImportRecordsRef, {
		records: requiredRecords,
		replaceSnapshot: true,
	});

	return {
		createdCount: result.createdCount,
		failedCount: result.failedCount,
		recordCount: result.recordCount,
		updatedCount: result.updatedCount,
	};
}

async function runStoredFsraImport(ctx: ActionCtx): Promise<FsraImportCounts> {
	let cursor: string | null = null;
	let counts = emptyFsraImportCounts();
	let sawRecords = false;

	while (true) {
		const page: FsraSourceRecordPage = await ctx.runQuery(
			listFsraSourceRecordsRef,
			{
				cursor,
				limit: FSRA_IMPORT_PAGE_SIZE,
			}
		);

		if (page.page.length > 0) {
			sawRecords = true;
			const result = await ctx.runMutation(upsertFsraImportRecordsRef, {
				records: page.page,
			});
			counts = addFsraImportCounts(counts, {
				createdCount: result.createdCount,
				failedCount: result.failedCount,
				recordCount: result.recordCount,
				updatedCount: result.updatedCount,
			});
		}

		if (page.isDone) {
			break;
		}
		cursor = page.continueCursor;
	}

	if (!sawRecords) {
		requireFsraImportRecords([]);
	}

	return counts;
}

export const runFsraImportRefresh = convex
	.action()
	.input({
		trigger: fsraImportTriggerValidator,
		records: v.optional(v.array(fsraSourceRecordValidator)),
	})
	.handler(async (ctx: ActionCtx, args) => {
		const providedRecords = args.records;
		let recordCount = providedRecords?.length ?? 0;
		const runId = await ctx.runMutation(startFsraImportRunRef, {
			trigger: args.trigger,
		});

		try {
			const result =
				providedRecords !== undefined
					? await runProvidedFsraImport(ctx, providedRecords)
					: await runStoredFsraImport(ctx);
			recordCount = result.recordCount;
			const status = result.failedCount > 0 ? "failed" : "success";
			const errorMessage =
				status === "failed"
					? `${result.failedCount} FSRA records failed to import`
					: undefined;

			await ctx.runMutation(finishFsraImportRunRef, {
				createdCount: result.createdCount,
				errorMessage,
				failedCount: result.failedCount,
				recordCount: result.recordCount,
				runId,
				status,
				updatedCount: result.updatedCount,
			});

			return {
				...result,
				runId,
				status,
			};
		} catch (error) {
			await ctx.runMutation(finishFsraImportRunRef, {
				createdCount: 0,
				errorMessage:
					error instanceof Error ? error.message : "FSRA import failed",
				failedCount: recordCount,
				recordCount,
				runId,
				status: "failed",
				updatedCount: 0,
			});
			throw error;
		}
	})
	.internal();
