import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../../../../convex/_generated/api";
import { buildDefaultFsraSourceRecords } from "../../../../convex/onboarding/verification/fsraFixtures";
import { createImportedFsraProviderBindings } from "../../../../convex/onboarding/verification/fsraImport";
import { createBrokerOnboardingVerificationRegistry } from "../../../../convex/onboarding/verification/registry";
import { createTestConvex } from "../../auth/helpers";

const NOW = new Date("2026-04-22T21:00:00.000Z").getTime();

describe("regulator providers", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("returns normalized imported individual lookups with brokerage linkage and stale mapping", async () => {
		const t = createTestConvex();
		const records = buildDefaultFsraSourceRecords(NOW);
		await t.action(internal.onboarding.verification.fsraImport.runFsraImportRefresh, {
			records,
			trigger: "manual",
		});

		const { active, stale } = await t.run(async (ctx) => {
			const registry = createBrokerOnboardingVerificationRegistry({
				configOverrides: {
					providers: { regulatorDirectory: "imported_fsra" },
				},
				importedFsra: createImportedFsraProviderBindings(ctx, {
					now: () => NOW,
				}),
			});

			return {
				active: await registry.regulatorDirectory.lookupLicense({
					licenseNumber: "ON-12345",
					province: "ON",
					requestedAt: NOW,
					selfReportedName: { fullName: "Francois Smith" },
					expectedBrokerageNumber: " br-001 ",
				}),
				stale: await registry.regulatorDirectory.lookupLicense({
					licenseNumber: "ON-STALE-1",
					province: "ON",
					requestedAt: NOW,
					selfReportedName: { fullName: "Stale Broker" },
					expectedBrokerageNumber: "BR-001",
				}),
			};
		});

		expect(active.status).toBe("active");
		expect(active.freshness).toBe("fresh");
		expect(active.licenseType).toBe("agent");
		expect(active.brokerageNumber).toBe("BR-001");
		expect(active.brokerageAssociation?.matched).toBe(true);
		expect(active.brokerageAssociation?.requestedBrokerageNumber).toBe("BR-001");

		expect(stale.status).toBe("active");
		expect(stale.freshness).toBe("stale");
		expect(stale.brokerageAssociation?.matched).toBe(true);
	});

	it("returns normalized imported brokerage lookups with exact status distinctions", async () => {
		const t = createTestConvex();
		const records = buildDefaultFsraSourceRecords(NOW);
		await t.action(internal.onboarding.verification.fsraImport.runFsraImportRefresh, {
			records,
			trigger: "manual",
		});

		const results = await t.run(async (ctx) => {
			const registry = createBrokerOnboardingVerificationRegistry({
				configOverrides: {
					providers: { regulatorDirectory: "imported_fsra" },
				},
				importedFsra: createImportedFsraProviderBindings(ctx, {
					now: () => NOW,
				}),
			});

			return {
				active: await registry.regulatorDirectory.lookupBrokerage({
					brokerageNumber: "BR-001",
					province: "ON",
					requestedAt: NOW,
				}),
				suspended: await registry.regulatorDirectory.lookupBrokerage({
					brokerageNumber: "BR-SUSPENDED-1",
					province: "ON",
					requestedAt: NOW,
				}),
				inactive: await registry.regulatorDirectory.lookupBrokerage({
					brokerageNumber: "BR-INACTIVE-1",
					province: "ON",
					requestedAt: NOW,
				}),
				revoked: await registry.regulatorDirectory.lookupBrokerage({
					brokerageNumber: "BR-REVOKED-1",
					province: "ON",
					requestedAt: NOW,
				}),
				missing: await registry.regulatorDirectory.lookupBrokerage({
					brokerageNumber: "BR-404",
					province: "ON",
					requestedAt: NOW,
				}),
			};
		});

		expect(results.active.status).toBe("active");
		expect(results.suspended.status).toBe("suspended");
		expect(results.inactive.status).toBe("inactive");
		expect(results.revoked.status).toBe("revoked");
		expect(results.missing.status).toBe("not_found");
	});

	it("exposes DB-backed imported FSRA lookups through internal query surfaces", async () => {
		const t = createTestConvex();
		const records = buildDefaultFsraSourceRecords(NOW);
		await t.action(internal.onboarding.verification.fsraImport.runFsraImportRefresh, {
			records,
			trigger: "manual",
		});

		const [license, brokerage] = await Promise.all([
			t.query(internal.onboarding.verification.fsraImport.lookupImportedFsraLicense, {
				expectedBrokerageNumber: "br-001",
				licenseNumber: "ON-12345",
				province: "ON",
				requestedAt: NOW,
				selfReportedFullName: "Francois Smith",
			}),
			t.query(
				internal.onboarding.verification.fsraImport.lookupImportedFsraBrokerage,
				{
					brokerageNumber: "BR-001",
					province: "ON",
					requestedAt: NOW,
				}
			),
		]);

		expect(license.status).toBe("active");
		expect(license.brokerageAssociation?.matched).toBe(true);
		expect(brokerage.status).toBe("active");
	});

	it("falls back to brokerage license numbers when brokerageNumber is absent", async () => {
		const t = createTestConvex();
		const records = buildDefaultFsraSourceRecords(NOW).map((record) =>
			record.licenseNumber === "BR-001"
				? { ...record, brokerageNumber: null }
				: record
		);
		await t.action(internal.onboarding.verification.fsraImport.runFsraImportRefresh, {
			records,
			trigger: "manual",
		});

		const result = await t.query(
			internal.onboarding.verification.fsraImport.lookupImportedFsraBrokerage,
			{
				brokerageNumber: "BR-001",
				province: "ON",
				requestedAt: NOW,
			}
		);

		expect(result.status).toBe("active");
		expect(result.brokerageNumber).toBe("BR-001");
	});

	it("keeps imported and mock providers aligned on active, stale, and brokerage-mismatch outcomes", async () => {
		const t = createTestConvex();
		const records = buildDefaultFsraSourceRecords(NOW);
		await t.action(internal.onboarding.verification.fsraImport.runFsraImportRefresh, {
			records,
			trigger: "manual",
		});

		const comparison = await t.run(async (ctx) => {
			const importedRegistry = createBrokerOnboardingVerificationRegistry({
				configOverrides: {
					providers: { regulatorDirectory: "imported_fsra" },
				},
				importedFsra: createImportedFsraProviderBindings(ctx, {
					now: () => NOW,
				}),
			});
			const mockRegistry = createBrokerOnboardingVerificationRegistry();

			return {
				importedActive: await importedRegistry.regulatorDirectory.lookupLicense({
					licenseNumber: "ON-12345",
					province: "ON",
					requestedAt: NOW,
					selfReportedName: { fullName: "Francois Smith" },
					expectedBrokerageNumber: "br-001",
				}),
				mockActive: await mockRegistry.regulatorDirectory.lookupLicense({
					licenseNumber: "ON-12345",
					province: "ON",
					requestedAt: NOW,
					selfReportedName: { fullName: "Francois Smith" },
					expectedBrokerageNumber: "br-001",
				}),
				importedMismatch:
					await importedRegistry.regulatorDirectory.lookupLicense({
						licenseNumber: "ON-MISMATCH-1",
						province: "ON",
						requestedAt: NOW,
						selfReportedName: { fullName: "Mismatched Agent" },
						expectedBrokerageNumber: "BR-001",
					}),
				mockMismatch: await mockRegistry.regulatorDirectory.lookupLicense({
					licenseNumber: "ON-MISMATCH-1",
					province: "ON",
					requestedAt: NOW,
					selfReportedName: { fullName: "Mismatched Agent" },
					expectedBrokerageNumber: "BR-001",
				}),
				importedStale: await importedRegistry.regulatorDirectory.lookupLicense({
					licenseNumber: "ON-STALE-1",
					province: "ON",
					requestedAt: NOW,
					selfReportedName: { fullName: "Stale Broker" },
					expectedBrokerageNumber: "BR-001",
				}),
				mockStale: await mockRegistry.regulatorDirectory.lookupLicense({
					licenseNumber: "ON-STALE-1",
					province: "ON",
					requestedAt: NOW,
					selfReportedName: { fullName: "Stale Broker" },
					expectedBrokerageNumber: "BR-001",
				}),
			};
		});

		expect(comparison.importedActive.status).toBe(comparison.mockActive.status);
		expect(comparison.importedActive.freshness).toBe(
			comparison.mockActive.freshness
		);
		expect(comparison.importedActive.brokerageAssociation).toEqual(
			comparison.mockActive.brokerageAssociation
		);

		expect(comparison.importedMismatch.status).toBe(
			comparison.mockMismatch.status
		);
		expect(comparison.importedMismatch.brokerageAssociation).toEqual(
			comparison.mockMismatch.brokerageAssociation
		);

		expect(comparison.importedStale.freshness).toBe(
			comparison.mockStale.freshness
		);
		expect(comparison.importedStale.status).toBe(comparison.mockStale.status);
	});
});
