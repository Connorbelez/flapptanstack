import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../../../convex/_generated/api";
import {
	buildDefaultFsraSourceRecords,
	type FsraSourceRecord,
} from "../../../../convex/onboarding/verification/fsraFixtures";
import { createTestConvex, ensureSeededIdentity } from "../../auth/helpers";
import {
	EXTERNAL_ORG_ADMIN,
	FAIRLEND_ADMIN,
	MEMBER,
} from "../../auth/identities";

const NOW = new Date("2026-04-22T21:00:00.000Z").getTime();

function buildBulkFsraSourceRecords(count: number): FsraSourceRecord[] {
	return Array.from({ length: count }, (_, index) => ({
		brokerageName: "FairLend Brokerage",
		brokerageNumber: "BR-001",
		lastVerifiedAt: NOW,
		licenseNumber: `ON-BULK-${index.toString().padStart(3, "0")}`,
		licenseType: "agent",
		licenseeFullName: `Bulk Broker ${index}`,
		province: "ON",
		rawRecord: {
			brokerageName: "FairLend Brokerage",
			brokerageNumber: "BR-001",
			licenseNumber: `ON-BULK-${index.toString().padStart(3, "0")}`,
			licenseType: "agent",
			licenseeFullName: `Bulk Broker ${index}`,
			province: "ON",
			status: "active",
		},
		sourceImportedAt: NOW,
		status: "active",
	}));
}

describe("FSRA import refresh", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("imports default FSRA fixtures and records a successful run", async () => {
		const t = createTestConvex();
		const records = buildDefaultFsraSourceRecords(NOW);

		const result = await t.action(
			internal.onboarding.verification.fsraImport.runFsraImportRefresh,
			{
				records,
				trigger: "manual",
			}
		);

		expect(result.status).toBe("success");
		expect(result.recordCount).toBeGreaterThan(0);
		expect(result.createdCount).toBe(result.recordCount);
		expect(result.updatedCount).toBe(0);
		expect(result.failedCount).toBe(0);

		const state = await t.run(async (ctx) => {
			const licenses = await ctx.db.query("fsraLicenses").collect();
			const latestRun = await ctx.db
				.query("fsraImportRuns")
				.withIndex("by_started_at")
				.order("desc")
				.first();
			return { latestRun, licenses };
		});

		expect(state.licenses).toHaveLength(result.recordCount);
		expect(state.latestRun?.trigger).toBe("manual");
		expect(state.latestRun?.status).toBe("success");
		expect(state.latestRun?.recordCount).toBe(result.recordCount);
		expect(state.latestRun?.createdCount).toBe(result.createdCount);
		expect(state.latestRun?.updatedCount).toBe(result.updatedCount);
	});

	it("upserts existing rows instead of duplicating them", async () => {
		const t = createTestConvex();
		const records = buildDefaultFsraSourceRecords(NOW);

		const firstRun = await t.action(
			internal.onboarding.verification.fsraImport.runFsraImportRefresh,
			{
				records,
				trigger: "manual",
			}
		);
		const secondRun = await t.action(
			internal.onboarding.verification.fsraImport.runFsraImportRefresh,
			{
				records,
				trigger: "manual",
			}
		);

		expect(firstRun.createdCount).toBe(firstRun.recordCount);
		expect(secondRun.createdCount).toBe(0);
		expect(secondRun.updatedCount).toBe(secondRun.recordCount);
		expect(secondRun.failedCount).toBe(0);

		const licenseCount = await t.run(async (ctx) =>
			ctx.db.query("fsraLicenses").collect()
		);
		expect(licenseCount).toHaveLength(firstRun.recordCount);
	});

	it("runs scheduled imports from paged staged FSRA source rows", async () => {
		const t = createTestConvex();
		const records = buildBulkFsraSourceRecords(125);

		const manualRun = await t.action(
			internal.onboarding.verification.fsraImport.runFsraImportRefresh,
			{
				records,
				trigger: "manual",
			}
		);

		await t.run(async (ctx) => {
			const licenses = await ctx.db.query("fsraLicenses").collect();
			for (const license of licenses) {
				await ctx.db.delete(license._id);
			}
		});

		const scheduledRun = await t.action(
			internal.onboarding.verification.fsraImport.runFsraImportRefresh,
			{
				trigger: "cron",
			}
		);

		expect(manualRun.status).toBe("success");
		expect(scheduledRun.status).toBe("success");
		expect(scheduledRun.recordCount).toBe(records.length);
		expect(scheduledRun.createdCount).toBe(records.length);
		expect(scheduledRun.failedCount).toBe(0);

		const state = await t.run(async (ctx) => {
			const latestRun = await ctx.db
				.query("fsraImportRuns")
				.withIndex("by_started_at")
				.order("desc")
				.first();
			const licenses = await ctx.db.query("fsraLicenses").collect();
			const sourceRows = await ctx.db.query("fsraSourceRows").collect();
			return { latestRun, licenses, sourceRows };
		});

		expect(state.latestRun?.trigger).toBe("cron");
		expect(state.latestRun?.status).toBe("success");
		expect(state.licenses).toHaveLength(records.length);
		expect(state.sourceRows).toHaveLength(records.length);
	});

	it("treats provided FSRA rows as a replacement snapshot", async () => {
		const t = createTestConvex();
		const records = buildDefaultFsraSourceRecords(NOW);
		const retiredLicenseNumber = "ON-MISMATCH-1";
		const replacementRecords = records.filter(
			(record) => record.licenseNumber !== retiredLicenseNumber
		);

		await t.action(
			internal.onboarding.verification.fsraImport.runFsraImportRefresh,
			{
				records,
				trigger: "manual",
			}
		);
		const result = await t.action(
			internal.onboarding.verification.fsraImport.runFsraImportRefresh,
			{
				records: replacementRecords,
				trigger: "manual",
			}
		);

		expect(result.status).toBe("success");
		expect(result.recordCount).toBe(replacementRecords.length);

		const state = await t.run(async (ctx) => {
			const licenses = await ctx.db.query("fsraLicenses").collect();
			const sourceRows = await ctx.db.query("fsraSourceRows").collect();
			return { licenses, sourceRows };
		});

		expect(state.licenses).toHaveLength(replacementRecords.length);
		expect(state.sourceRows).toHaveLength(replacementRecords.length);
		expect(
			state.licenses.some(
				(record) => record.licenseNumber === retiredLicenseNumber
			)
		).toBe(false);
		expect(
			state.sourceRows.some(
				(record) => record.licenseNumber === retiredLicenseNumber
			)
		).toBe(false);
	});

	it("records a failed run when no FSRA source rows are provided", async () => {
		const t = createTestConvex();

		await expect(
			t.action(internal.onboarding.verification.fsraImport.runFsraImportRefresh, {
				trigger: "manual",
			})
		).rejects.toThrow(/FSRA import source records are required/i);

		const latestRun = await t.run(async (ctx) =>
			ctx.db
				.query("fsraImportRuns")
				.withIndex("by_started_at")
				.order("desc")
				.first()
		);

		expect(latestRun?.status).toBe("failed");
		expect(latestRun?.recordCount).toBe(0);
		expect(latestRun?.failedCount).toBe(0);
		expect(latestRun?.errorMessage).toMatch(
			/FSRA import source records are required/i
		);
	});

	it("rejects blank stable identifiers instead of importing corrupt rows", async () => {
		const t = createTestConvex();
		const record = buildDefaultFsraSourceRecords(NOW)[0];
		if (!record) {
			throw new Error("Expected default FSRA fixture");
		}

		await expect(
			t.action(internal.onboarding.verification.fsraImport.runFsraImportRefresh, {
				records: [{ ...record, licenseNumber: "  " }],
				trigger: "manual",
			})
		).rejects.toThrow(/licenseNumber is required/i);

		const state = await t.run(async (ctx) => {
			const licenses = await ctx.db.query("fsraLicenses").collect();
			const latestRun = await ctx.db
				.query("fsraImportRuns")
				.withIndex("by_started_at")
				.order("desc")
				.first();
			return { latestRun, licenses };
		});

		expect(state.licenses).toHaveLength(0);
		expect(state.latestRun?.status).toBe("failed");
		expect(state.latestRun?.errorMessage).toMatch(/missing-license-number/i);
	});

	it("requires FairLend admin and onboarding:manage for the public manual refresh action", async () => {
		const t = createTestConvex();
		const records = buildDefaultFsraSourceRecords(NOW);
		await ensureSeededIdentity(t, MEMBER);
		await ensureSeededIdentity(t, EXTERNAL_ORG_ADMIN);
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);

		await expect(
			t.withIdentity(MEMBER).action(
				api.onboarding.verification.actions.refreshFsraImportedDataNow,
				{ records }
			)
		).rejects.toThrow(/fair lend admin/i);

		await expect(
			t.withIdentity(EXTERNAL_ORG_ADMIN).action(
				api.onboarding.verification.actions.refreshFsraImportedDataNow,
				{ records }
			)
		).rejects.toThrow(/fair lend admin/i);

		const result = await t.withIdentity(FAIRLEND_ADMIN).action(
			api.onboarding.verification.actions.refreshFsraImportedDataNow,
			{ records }
		);

		expect(result.status).toBe("success");
		expect(result.failedCount).toBe(0);

		const latestRun = await t.run(async (ctx) =>
			ctx.db
				.query("fsraImportRuns")
				.withIndex("by_started_at")
				.order("desc")
				.first()
		);
		expect(latestRun?.trigger).toBe("manual");
		expect(latestRun?.status).toBe("success");
	});
});
