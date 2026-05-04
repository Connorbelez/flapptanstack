import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { FAIRLEND_ADMIN, LAWYER } from "../../../src/test/auth/identities";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";

const lsoRegistryApi = anyApi.legalRepresentation.lsoRegistry;

describe("LSO registry contracts", () => {
	it("stores imported lawyer rows with search, status, and source metadata", async () => {
		const t = convexTest(schema, convexModules);
		const rowId = await t.run(async (ctx) =>
			ctx.db.insert("lsoLawyers", {
				normalizedName: "jane eligible",
				displayName: "Jane Eligible",
				barNumber: "L12345",
				jurisdiction: "ON",
				licenseeType: "lawyer",
				entitledToPractise: true,
				licensingStatus: "licensed",
				restrictionStatus: "clear",
				source: "lso_import",
				sourceSnapshot: { directoryUrl: "https://lso.ca/example" },
				sourceFetchedAt: 1_777_760_000_000,
				updatedAt: 1_777_760_000_000,
			})
		);

		const row = await t.run((ctx) => ctx.db.get(rowId));
		expect(row?.licenseeType).toBe("lawyer");
		expect(row?.entitledToPractise).toBe(true);
		expect(row?.source).toBe("lso_import");
		expect(row?.sourceSnapshot).toMatchObject({
			directoryUrl: "https://lso.ca/example",
		});
	});

	it("records LSO import batches and row errors", async () => {
		const t = convexTest(schema, convexModules);
		const batchId = await t.run(async (ctx) =>
			ctx.db.insert("lsoImportBatches", {
				checksum: "sha256:test",
				createdAt: 1_777_760_000_000,
				errorCount: 0,
				importedBy: "user_admin",
				rowCount: 1,
				sourceName: "lso-test.csv",
				status: "completed",
				updatedAt: 1_777_760_000_000,
			})
		);
		const errorId = await t.run(async (ctx) =>
			ctx.db.insert("lsoImportRowErrors", {
				batchId,
				errorCode: "invalid_status",
				message: "Unknown licensing status",
				normalizedKey: "l12345:on",
				rawRowHash: "sha256:row",
				rowNumber: 2,
			})
		);
		expect(batchId).toBeTruthy();
		expect(errorId).toBeTruthy();

		const batchByChecksum = await t.run((ctx) =>
			ctx.db
				.query("lsoImportBatches")
				.withIndex("by_checksum", (query) =>
					query.eq("checksum", "sha256:test")
				)
				.unique()
		);
		const errorByBatch = await t.run((ctx) =>
			ctx.db
				.query("lsoImportRowErrors")
				.withIndex("by_batch", (query) => query.eq("batchId", batchId))
				.unique()
		);
		expect(batchByChecksum?._id).toBe(batchId);
		expect(errorByBatch?._id).toBe(errorId);
	});

	it("records LSO lookup attempts and refresh requests with queryable indexes", async () => {
		const t = convexTest(schema, convexModules);
		const lsoLawyerId = await t.run(async (ctx) =>
			ctx.db.insert("lsoLawyers", {
				normalizedName: "jane eligible",
				displayName: "Jane Eligible",
				barNumber: "L12345",
				jurisdiction: "ON",
				licenseeType: "lawyer",
				entitledToPractise: true,
				licensingStatus: "licensed",
				restrictionStatus: "clear",
				source: "lso_import",
				sourceSnapshot: { directoryUrl: "https://lso.ca/example" },
				sourceFetchedAt: 1_777_760_000_000,
				updatedAt: 1_777_760_000_000,
			})
		);
		const lookupId = await t.run((ctx) =>
			ctx.db.insert("lsoLookupAttempts", {
				actorAuthId: "user_admin",
				createdAt: 1_777_760_000_000,
				durationMs: 42,
				provider: "lso",
				query: "Jane Eligible",
				resultCount: 1,
				selectedLsoLawyerId: lsoLawyerId,
				status: "success",
			})
		);
		const refreshId = await t.run((ctx) =>
			ctx.db.insert("lsoRefreshRequests", {
				completedAt: 1_777_760_001_000,
				createdAt: 1_777_760_000_000,
				createdBy: "user_admin",
				idempotencyKey: "lso-refresh:L12345:ON",
				lsoLawyerId,
				status: "completed",
				updatedAt: 1_777_760_001_000,
			})
		);

		const lookupByActor = await t.run((ctx) =>
			ctx.db
				.query("lsoLookupAttempts")
				.withIndex("by_actor_created", (query) =>
					query.eq("actorAuthId", "user_admin")
				)
				.unique()
		);
		const refreshByIdempotency = await t.run((ctx) =>
			ctx.db
				.query("lsoRefreshRequests")
				.withIndex("by_idempotency", (query) =>
					query.eq("idempotencyKey", "lso-refresh:L12345:ON")
				)
				.unique()
		);

		expect(lookupByActor?._id).toBe(lookupId);
		expect(refreshByIdempotency?._id).toBe(refreshId);
	});
});

describe("LSO registry behavior", () => {
	async function importLsoFixtureRows(t: ReturnType<typeof convexTest>) {
		const admin = t.withIdentity(FAIRLEND_ADMIN);
		await admin.mutation(lsoRegistryApi.importBatch, {
			rows: [
				{
					barNumber: "L12345",
					displayName: "Jane Eligible",
					entitledToPractise: true,
					jurisdiction: "ON",
					licenseeType: "lawyer",
					licensingStatus: "licensed",
					restrictionStatus: "clear",
				},
				{
					barNumber: "P22222",
					displayName: "Para Legal",
					entitledToPractise: true,
					jurisdiction: "ON",
					licenseeType: "paralegal",
					licensingStatus: "licensed",
					restrictionStatus: "clear",
				},
				{
					barNumber: "L99999",
					displayName: "Rita Restricted",
					entitledToPractise: false,
					jurisdiction: "ON",
					licenseeType: "lawyer",
					licensingStatus: "suspended",
					restrictionStatus: "suspended",
				},
			],
			sourceName: "fixture.csv",
			checksum: "sha256:fixture",
		});
		return admin;
	}

	it("searches eligible lawyers by name and bar number and excludes paralegals from selectable results", async () => {
		const t = convexTest(schema, convexModules);
		const admin = await importLsoFixtureRows(t);

		const results = await admin.query(lsoRegistryApi.searchLawyers, {
			query: "Jane",
		});
		expect(results[0]).toMatchObject({
			barNumber: "L12345",
			selectable: true,
			source: "lso_import",
		});
		expect(results[0]?.sourceFetchedAt).toEqual(expect.any(Number));

		const barResults = await admin.query(lsoRegistryApi.searchLawyers, {
			query: "L12345",
		});
		expect(barResults[0]).toMatchObject({
			displayName: "Jane Eligible",
			selectable: true,
		});

		const para = await admin.query(lsoRegistryApi.searchLawyers, {
			query: "Para",
		});
		expect(para[0]).toMatchObject({
			licenseeType: "paralegal",
			selectable: false,
		});
	});

	it("finds matching lawyers beyond the first 100 registry rows", async () => {
		const t = convexTest(schema, convexModules);
		const admin = t.withIdentity(FAIRLEND_ADMIN);
		await admin.mutation(lsoRegistryApi.importBatch, {
			rows: [
				...Array.from({ length: 101 }, (_, index) => ({
					barNumber: `L${String(index).padStart(5, "0")}`,
					displayName: `Nonmatch Lawyer ${index}`,
					entitledToPractise: true,
					jurisdiction: "ON",
					licenseeType: "lawyer" as const,
					licensingStatus: "licensed" as const,
					restrictionStatus: "clear" as const,
				})),
				{
					barNumber: "L77777",
					displayName: "Needle LateMatch",
					entitledToPractise: true,
					jurisdiction: "ON",
					licenseeType: "lawyer" as const,
					licensingStatus: "licensed" as const,
					restrictionStatus: "clear" as const,
				},
			],
			sourceName: "large-fixture.csv",
			checksum: "sha256:large-fixture",
		});

		const results = await admin.query(lsoRegistryApi.searchLawyers, {
			query: "Needle",
		});

		expect(results[0]).toMatchObject({
			barNumber: "L77777",
			displayName: "Needle LateMatch",
		});
	});

	it("indexes bounded search tokens for name and bar number lookup", async () => {
		const t = convexTest(schema, convexModules);
		const admin = t.withIdentity(FAIRLEND_ADMIN);
		await admin.mutation(lsoRegistryApi.importBatch, {
			rows: [
				{
					barNumber: "L12345",
					displayName: "Jane Eligible",
					entitledToPractise: true,
					jurisdiction: "ON",
					licenseeType: "lawyer",
					licensingStatus: "licensed",
					restrictionStatus: "clear",
				},
			],
			sourceName: "token-fixture.csv",
			checksum: "sha256:token-fixture",
		});

		const tokens = await t.run((ctx) =>
			ctx.db.query("lsoLawyerSearchTokens").collect()
		);
		expect(tokens.map((token) => token.token).sort()).toEqual([
			"12345",
			"eligible",
			"jane",
			"jane eligible",
			"l12345",
		]);

		const lastNameResults = await admin.query(lsoRegistryApi.searchLawyers, {
			query: "Eligible",
		});
		expect(lastNameResults[0]).toMatchObject({
			barNumber: "L12345",
			displayName: "Jane Eligible",
		});

		const bareNumberResults = await admin.query(lsoRegistryApi.searchLawyers, {
			query: "12345",
		});
		expect(bareNumberResults[0]).toMatchObject({
			barNumber: "L12345",
			displayName: "Jane Eligible",
		});
	});

	it("quarantines import rows with empty normalized registry keys", async () => {
		const t = convexTest(schema, convexModules);
		const admin = t.withIdentity(FAIRLEND_ADMIN);

		const result = await admin.mutation(lsoRegistryApi.importBatch, {
			rows: [
				{
					barNumber: "   ",
					displayName: "Jane Eligible",
					entitledToPractise: true,
					jurisdiction: "ON",
					licenseeType: "lawyer",
					licensingStatus: "licensed",
					restrictionStatus: "clear",
				},
				{
					barNumber: "L99999",
					displayName: "Valid Import",
					entitledToPractise: true,
					jurisdiction: "ON",
					licenseeType: "lawyer",
					licensingStatus: "licensed",
					restrictionStatus: "clear",
				},
			],
			sourceName: "fixture.csv",
			checksum: "sha256:fixture",
		});
		const diagnostics = await admin.query(lsoRegistryApi.getImportBatch, {
			batchId: result.batchId,
		});

		expect(result).toMatchObject({ errors: 1, imported: 1 });
		expect(diagnostics).toMatchObject({
			batch: {
				errorCount: 1,
				rowCount: 2,
				status: "failed",
			},
		});
		expect(diagnostics.errors).toHaveLength(1);
		expect(diagnostics.errors[0]).toMatchObject({
			errorCode: "invalid_row",
			rowNumber: 1,
		});
	});

	it("writes a refresh request and provider-shaped verification evidence", async () => {
		const t = convexTest(schema, convexModules);
		const admin = await importLsoFixtureRows(t);
		const result = await admin.mutation(lsoRegistryApi.refreshLawyer, {
			barNumber: "L12345",
			jurisdiction: "ON",
			reason: "checkout_selection",
		});
		expect(result.status).toBe("completed");
		expect(result.verificationId).toBeTruthy();

		const verification = await t.run((ctx) =>
			ctx.db.get(result.verificationId)
		);
		expect(verification).toMatchObject({
			barNumber: "L12345",
			checkType: "fresh_restriction",
			outcome: "eligible",
			provider: "lso",
			reasonCodes: ["active_license"],
		});
	});

	it("reuses the same refresh request and verification for idempotent retries", async () => {
		const t = convexTest(schema, convexModules);
		const admin = await importLsoFixtureRows(t);
		const args = {
			barNumber: "L12345",
			jurisdiction: "ON",
			reason: "checkout_selection",
		};

		const first = await admin.mutation(lsoRegistryApi.refreshLawyer, args);
		const second = await admin.mutation(lsoRegistryApi.refreshLawyer, args);

		expect(second.refreshRequestId).toBe(first.refreshRequestId);
		expect(second.verificationId).toBe(first.verificationId);
		const refreshRequests = await t.run((ctx) =>
			ctx.db.query("lsoRefreshRequests").collect()
		);
		const verifications = await t.run((ctx) =>
			ctx.db.query("lawyerVerifications").collect()
		);
		expect(refreshRequests).toHaveLength(1);
		expect(verifications).toHaveLength(1);
	});

	it("scopes refresh idempotency to the authenticated actor", async () => {
		const t = convexTest(schema, convexModules);
		const admin = await importLsoFixtureRows(t);
		const lawyer = t.withIdentity(LAWYER);
		const args = {
			barNumber: "L12345",
			jurisdiction: "ON",
			reason: "checkout_selection",
		};

		const adminRefresh = await admin.mutation(
			lsoRegistryApi.refreshLawyer,
			args
		);
		const lawyerRefresh = await lawyer.mutation(
			lsoRegistryApi.refreshLawyer,
			args
		);

		expect(lawyerRefresh.refreshRequestId).not.toBe(
			adminRefresh.refreshRequestId
		);
		expect(lawyerRefresh.verificationId).not.toBe(adminRefresh.verificationId);
		const refreshRequests = await t.run((ctx) =>
			ctx.db.query("lsoRefreshRequests").collect()
		);
		expect(refreshRequests).toHaveLength(2);
	});

	it("rejects refreshes for missing, restricted, or mismatched LSO registry rows", async () => {
		const t = convexTest(schema, convexModules);
		const admin = await importLsoFixtureRows(t);
		const restricted = await admin.query(lsoRegistryApi.searchLawyers, {
			query: "Rita",
		});

		await expect(
			admin.mutation(lsoRegistryApi.refreshLawyer, {
				barNumber: "L00000",
				jurisdiction: "ON",
				reason: "checkout_selection",
			})
		).rejects.toThrow("LSO lawyer not found");
		await expect(
			admin.mutation(lsoRegistryApi.refreshLawyer, {
				barNumber: "L99999",
				jurisdiction: "ON",
				reason: "checkout_selection",
			})
		).rejects.toThrow("LSO lawyer is not eligible for refresh");
		await expect(
			admin.mutation(lsoRegistryApi.refreshLawyer, {
				barNumber: "L12345",
				jurisdiction: "ON",
				lsoLawyerId: restricted[0].lsoLawyerId,
				reason: "checkout_selection",
			})
		).rejects.toThrow("does not match requested bar number and jurisdiction");
	});
});
