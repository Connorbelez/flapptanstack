import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { adminMutation, authedMutation, listingQuery } from "../fluent";
import {
	normalizeBarNumber,
	normalizeJurisdiction,
	normalizeLawyerName,
	normalizeLegalWhitespace,
} from "./normalization";
import {
	lsoLicenseeTypeValidator,
	lsoLicensingStatusValidator,
	lsoRestrictionStatusValidator,
} from "./validators";
import { recordLawyerVerificationRow } from "./verifications";

const BAR_LETTER_PREFIX = /^[A-Z]+/;
const SEARCH_TOKEN_SPLIT_PATTERN = /[^\p{L}\p{N}]+/u;
const SEARCH_TOKEN_SCAN_LIMIT = 100;
const SEARCH_PREFIX_LIMIT = 5;
const SEARCH_PREFIX_SUFFIX = "\uffff";

function normalizeName(value: string): string {
	return normalizeLawyerName(value);
}

function normalizeBarToken(value: string): string {
	return normalizeBarNumber(value).toLocaleLowerCase("en-CA");
}

function stripBarLetterPrefix(value: string): string {
	return value.replace(BAR_LETTER_PREFIX, "");
}

function addSearchToken(
	tokens: Map<string, "name" | "bar_number" | "bar_digits">,
	token: string,
	tokenKind: "name" | "bar_number" | "bar_digits"
) {
	if (token.length === 0 || tokens.has(token)) {
		return;
	}
	tokens.set(token, tokenKind);
}

function addSearchPrefix(prefixes: Set<string>, prefix: string) {
	if (prefix.length > 0) {
		prefixes.add(prefix);
	}
}

function buildLawyerSearchTokens(args: {
	readonly barNumber: string;
	readonly displayName: string;
}): Array<{
	readonly token: string;
	readonly tokenKind: "name" | "bar_number" | "bar_digits";
}> {
	const tokens = new Map<string, "name" | "bar_number" | "bar_digits">();
	const normalizedName = normalizeName(args.displayName);
	addSearchToken(tokens, normalizedName, "name");
	for (const token of normalizedName.split(SEARCH_TOKEN_SPLIT_PATTERN)) {
		addSearchToken(tokens, token, "name");
	}
	const barNumberToken = args.barNumber.toLocaleLowerCase("en-CA");
	addSearchToken(tokens, barNumberToken, "bar_number");
	addSearchToken(
		tokens,
		stripBarLetterPrefix(args.barNumber).toLocaleLowerCase("en-CA"),
		"bar_digits"
	);
	return Array.from(tokens, ([token, tokenKind]) => ({ token, tokenKind }));
}

function buildSearchPrefixes(value: string): string[] {
	const prefixes = new Set<string>();
	const normalizedName = normalizeName(value);
	addSearchPrefix(prefixes, normalizedName);
	for (const token of normalizedName.split(SEARCH_TOKEN_SPLIT_PATTERN)) {
		addSearchPrefix(prefixes, token);
	}
	const normalizedBar = normalizeBarToken(value);
	addSearchPrefix(prefixes, normalizedBar);
	addSearchPrefix(
		prefixes,
		stripBarLetterPrefix(normalizeBarNumber(value)).toLocaleLowerCase("en-CA")
	);
	return Array.from(prefixes).slice(0, SEARCH_PREFIX_LIMIT);
}

function isSelectableLsoLawyer(row: {
	readonly entitledToPractise: boolean;
	readonly licenseeType: string;
	readonly licensingStatus: string;
	readonly restrictionStatus: string;
}) {
	return (
		row.licenseeType === "lawyer" &&
		row.entitledToPractise &&
		row.licensingStatus === "licensed" &&
		row.restrictionStatus === "clear"
	);
}

async function searchTokenPrefixRows(
	ctx: Pick<QueryCtx, "db">,
	prefix: string
): Promise<Doc<"lsoLawyerSearchTokens">[]> {
	return await ctx.db
		.query("lsoLawyerSearchTokens")
		.withIndex("by_token", (query) =>
			query.gte("token", prefix).lt("token", `${prefix}${SEARCH_PREFIX_SUFFIX}`)
		)
		.take(SEARCH_TOKEN_SCAN_LIMIT);
}

function searchResultScore(args: {
	readonly normalizedBarQuery: string;
	readonly normalizedQuery: string;
	readonly row: Doc<"lsoLawyers">;
}): number {
	const rowBarNumber = args.row.barNumber.toLocaleLowerCase("en-CA");
	const rowBarDigits = stripBarLetterPrefix(
		args.row.barNumber
	).toLocaleLowerCase("en-CA");
	if (
		args.normalizedBarQuery.length > 0 &&
		(rowBarNumber === args.normalizedBarQuery ||
			rowBarDigits === args.normalizedBarQuery)
	) {
		return 0;
	}
	if (args.row.normalizedName === args.normalizedQuery) {
		return 1;
	}
	if (
		args.normalizedQuery.length > 0 &&
		args.row.normalizedName.startsWith(args.normalizedQuery)
	) {
		return 2;
	}
	if (
		args.normalizedQuery.length > 0 &&
		args.row.normalizedName
			.split(SEARCH_TOKEN_SPLIT_PATTERN)
			.some((token) => token.startsWith(args.normalizedQuery))
	) {
		return 3;
	}
	if (
		args.normalizedBarQuery.length > 0 &&
		(rowBarNumber.startsWith(args.normalizedBarQuery) ||
			rowBarDigits.startsWith(args.normalizedBarQuery))
	) {
		return 4;
	}
	return 5;
}

function projectSearchResult(row: Doc<"lsoLawyers">) {
	return {
		barNumber: row.barNumber,
		displayName: row.displayName,
		email: row.primaryEmail ?? null,
		firmName: row.firmName ?? null,
		jurisdiction: row.jurisdiction,
		licenseeType: row.licenseeType,
		licensingStatus: row.licensingStatus,
		lsoLawyerId: row._id,
		restrictionStatus: row.restrictionStatus,
		restrictionSummary: row.restrictionSummary ?? null,
		selectable: isSelectableLsoLawyer(row),
		source: row.source,
		sourceFetchedAt: row.sourceFetchedAt,
	};
}

function requireNormalizedText(value: string, fieldName: string): string {
	const normalized = normalizeLegalWhitespace(value);
	if (normalized.length === 0) {
		throw new ConvexError(`${fieldName} is required`);
	}
	return normalized;
}

function requireNormalizedBarNumber(value: string): string {
	const normalized = normalizeBarNumber(value);
	if (normalized.length === 0) {
		throw new ConvexError("barNumber is required");
	}
	return normalized;
}

function requireNormalizedJurisdiction(value: string): string {
	const normalized = normalizeJurisdiction(value);
	if (normalized.length === 0) {
		throw new ConvexError("jurisdiction is required");
	}
	return normalized;
}

async function getRefreshTargetLsoLawyer(
	ctx: Pick<MutationCtx, "db">,
	args: {
		readonly barNumber: string;
		readonly jurisdiction: string;
		readonly lsoLawyerId?: Id<"lsoLawyers">;
	}
): Promise<Doc<"lsoLawyers">> {
	if (args.lsoLawyerId !== undefined) {
		const row = await ctx.db.get(args.lsoLawyerId);
		if (!row) {
			throw new ConvexError("LSO lawyer not found");
		}
		if (
			row.barNumber !== args.barNumber ||
			row.jurisdiction !== args.jurisdiction
		) {
			throw new ConvexError(
				"LSO lawyer does not match requested bar number and jurisdiction"
			);
		}
		return row;
	}
	const rows = await ctx.db
		.query("lsoLawyers")
		.withIndex("by_bar_jurisdiction", (query) =>
			query
				.eq("barNumber", args.barNumber)
				.eq("jurisdiction", args.jurisdiction)
		)
		.collect();
	if (rows.length === 0) {
		throw new ConvexError("LSO lawyer not found");
	}
	const selectableRow = rows.find(isSelectableLsoLawyer);
	return selectableRow ?? rows[0];
}

export const importBatch = adminMutation
	.input({
		checksum: v.string(),
		rows: v.array(
			v.object({
				barNumber: v.string(),
				displayName: v.string(),
				email: v.optional(v.string()),
				entitledToPractise: v.boolean(),
				firmName: v.optional(v.string()),
				jurisdiction: v.string(),
				licenseeType: lsoLicenseeTypeValidator,
				licensingStatus: lsoLicensingStatusValidator,
				restrictionStatus: lsoRestrictionStatusValidator,
				restrictionSummary: v.optional(v.string()),
			})
		),
		sourceName: v.string(),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		const checksum = requireNormalizedText(args.checksum, "checksum");
		const sourceName = requireNormalizedText(args.sourceName, "sourceName");
		const batchId = await ctx.db.insert("lsoImportBatches", {
			checksum,
			createdAt: now,
			errorCount: 0,
			importedBy: ctx.viewer.authId,
			rowCount: args.rows.length,
			sourceName,
			status: "completed",
			updatedAt: now,
		});
		for (const row of args.rows) {
			const barNumber = requireNormalizedBarNumber(row.barNumber);
			const displayName = requireNormalizedText(row.displayName, "displayName");
			const jurisdiction = requireNormalizedJurisdiction(row.jurisdiction);
			const lsoLawyerId = await ctx.db.insert("lsoLawyers", {
				barNumber,
				displayName,
				entitledToPractise: row.entitledToPractise,
				firmName: row.firmName,
				jurisdiction,
				licenseeType: row.licenseeType,
				licensingStatus: row.licensingStatus,
				normalizedName: normalizeName(displayName),
				primaryEmail: row.email,
				restrictionStatus: row.restrictionStatus,
				restrictionSummary: row.restrictionSummary,
				source: "lso_import",
				sourceFetchedAt: now,
				sourceSnapshot: {
					batchId: String(batchId),
					sourceName,
				},
				updatedAt: now,
			});
			await Promise.all(
				buildLawyerSearchTokens({ barNumber, displayName }).map((token) =>
					ctx.db.insert("lsoLawyerSearchTokens", {
						createdAt: now,
						lsoLawyerId,
						token: token.token,
						tokenKind: token.tokenKind,
					})
				)
			);
		}
		return { batchId, imported: args.rows.length };
	})
	.public();

export const searchLawyers = listingQuery
	.input({ limit: v.optional(v.number()), query: v.string() })
	.handler(async (ctx, args) => {
		const normalizedQuery = normalizeName(args.query);
		const normalizedBarQuery = normalizeBarNumber(args.query).toLocaleLowerCase(
			"en-CA"
		);
		const limit = Math.min(Math.max(args.limit ?? 10, 1), 25);
		const prefixes = buildSearchPrefixes(args.query);
		if (prefixes.length === 0) {
			return [];
		}
		const tokenRows = (
			await Promise.all(
				prefixes.map((prefix) => searchTokenPrefixRows(ctx, prefix))
			)
		).flat();
		const candidateIds = new Set<Id<"lsoLawyers">>();
		for (const tokenRow of tokenRows) {
			candidateIds.add(tokenRow.lsoLawyerId);
		}
		const rows = (
			await Promise.all(
				Array.from(candidateIds).map((lsoLawyerId) => ctx.db.get(lsoLawyerId))
			)
		).filter((row): row is Doc<"lsoLawyers"> => row !== null);
		return rows
			.sort((left, right) => {
				const leftScore = searchResultScore({
					normalizedBarQuery,
					normalizedQuery,
					row: left,
				});
				const rightScore = searchResultScore({
					normalizedBarQuery,
					normalizedQuery,
					row: right,
				});
				if (leftScore !== rightScore) {
					return leftScore - rightScore;
				}
				const nameSort = left.displayName.localeCompare(right.displayName);
				if (nameSort !== 0) {
					return nameSort;
				}
				return left.barNumber.localeCompare(right.barNumber);
			})
			.slice(0, limit)
			.map(projectSearchResult);
	})
	.public();

export const refreshLawyer = authedMutation
	.input({
		barNumber: v.string(),
		dealId: v.optional(v.id("deals")),
		jurisdiction: v.string(),
		lsoLawyerId: v.optional(v.id("lsoLawyers")),
		reason: v.string(),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		const normalizedBarNumber = requireNormalizedBarNumber(args.barNumber);
		const normalizedJurisdiction = requireNormalizedJurisdiction(
			args.jurisdiction
		);
		const reason = requireNormalizedText(args.reason, "reason");
		const lsoLawyer = await getRefreshTargetLsoLawyer(ctx, {
			barNumber: normalizedBarNumber,
			jurisdiction: normalizedJurisdiction,
			lsoLawyerId: args.lsoLawyerId,
		});
		if (!isSelectableLsoLawyer(lsoLawyer)) {
			throw new ConvexError("LSO lawyer is not eligible for refresh");
		}
		const idempotencyKey = [
			"lso-refresh",
			ctx.viewer.authId,
			String(lsoLawyer._id),
			normalizedBarNumber,
			normalizedJurisdiction,
			args.dealId ?? "none",
			reason,
		].join(":");
		const existing = await ctx.db
			.query("lsoRefreshRequests")
			.withIndex("by_idempotency", (query) =>
				query.eq("idempotencyKey", idempotencyKey)
			)
			.unique();
		if (existing?.verificationId !== undefined) {
			return {
				refreshRequestId: existing._id,
				status: existing.status,
				verificationId: existing.verificationId,
			};
		}
		const refreshRequestId = await ctx.db.insert("lsoRefreshRequests", {
			completedAt: now,
			createdAt: now,
			createdBy: ctx.viewer.authId,
			dealId: args.dealId,
			idempotencyKey,
			lsoLawyerId: lsoLawyer._id,
			status: "completed",
			updatedAt: now,
		});
		const verificationId = await recordLawyerVerificationRow(ctx, {
			barNumber: normalizedBarNumber,
			checkType: "fresh_restriction",
			createdAt: now,
			createdBy: ctx.viewer.authId,
			dealId: args.dealId,
			jurisdiction: normalizedJurisdiction,
			lsoLawyerId: lsoLawyer._id,
			providerResult: {
				expiresAt: now + 1000 * 60 * 60 * 24 * 30,
				outcome: "eligible",
				provider: "lso",
				reasonCodes: ["active_license"],
				sourceSnapshot: {
					reason,
					refreshRequestId: String(refreshRequestId),
				},
			},
		});
		await ctx.db.patch(refreshRequestId, { verificationId });
		return { refreshRequestId, status: "completed" as const, verificationId };
	})
	.public();
