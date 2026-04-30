import { describe, expect, it, vi } from "vitest";
import { api, internal } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
	buildDemoGenerationResult,
	cleanupDemoDocumensoEnvelope,
	requireResettablePackage,
	toDemoSetupStatus,
} from "../../../../convex/demo/dealClosingPipeline";
import {
	createMockViewer,
	createTestConvex,
	ensureSeededIdentity,
} from "../../auth/helpers";

const FAIRLEND_STAFF_ORG_ID = "org_01KKF56VABM4NYFFSR039RTJBM";

const DEMO_LENDER = createMockViewer({
	roles: ["lender"],
	subject: "user_01KJ6BJXS10933HSV7KYJ9HXMN",
	email: "connor.belez@gmail.com",
	firstName: "Connor",
	lastName: "Belez",
});

const UNAUTHORIZED_VIEWER = createMockViewer({
	roles: ["borrower"],
	subject: "user_demo_reset_forbidden",
	email: "borrower@test.fairlend.ca",
});

const FIXED_DEMO_PACKAGE_DEFINITION_ID =
	"rd7t376j110ynd5gnvtnskhzch85vnen" as Id<"documentPackageDefinitions">;
const FIXED_DEMO_PACKAGE_VERSION_ID =
	"test-full-package-april30-v1;documentPackageVersions" as Id<"documentPackageVersions">;

interface ConvexTestDatabaseShim {
	_documents: Record<string, unknown>;
}

interface ConvexTestGlobalShim {
	Convex?: {
		components?: Record<string, { db?: ConvexTestDatabaseShim }>;
	};
}

async function seedReadyDemoPackage(t: ReturnType<typeof createTestConvex>) {
	void t;
	const rootDb = (globalThis as ConvexTestGlobalShim).Convex?.components?.[""]?.db;
	if (!rootDb) {
		throw new Error("convex-test root database is not initialized");
	}

	rootDb._documents[FIXED_DEMO_PACKAGE_DEFINITION_ID] = {
		_creationTime: 1,
		_id: FIXED_DEMO_PACKAGE_DEFINITION_ID,
		createdAt: 1,
		currentPublishedVersion: 1,
		draft: { items: [] },
		hasDraftChanges: false,
		name: "test full package april30",
		updatedAt: 1,
	};
	rootDb._documents[FIXED_DEMO_PACKAGE_VERSION_ID] = {
		_creationTime: 2,
		_id: FIXED_DEMO_PACKAGE_VERSION_ID,
		packageId: FIXED_DEMO_PACKAGE_DEFINITION_ID,
		publishedAt: 2,
		publishedBy: "test",
		snapshot: {
			envelopeBoundaries: [],
			items: [],
			name: "test full package april30",
			requiredPlatformRoles: [],
			requiredVariableKeys: [],
		},
		version: 1,
	};

	return {
		packageDefinitionId: FIXED_DEMO_PACKAGE_DEFINITION_ID,
		packageVersionId: FIXED_DEMO_PACKAGE_VERSION_ID,
	};
}

async function seedGeneratedDemoPackageWithSameTitle(
	t: ReturnType<typeof createTestConvex>
) {
	return await t.run(async (ctx) => {
		const packageDefinitionId = await ctx.db.insert(
			"documentPackageDefinitions",
			{
				createdAt: 1,
				currentPublishedVersion: 1,
				draft: { items: [] },
				hasDraftChanges: false,
				name: "test full package april30",
				updatedAt: 1,
			}
		);
		const packageVersionId = await ctx.db.insert("documentPackageVersions", {
			packageId: packageDefinitionId,
			publishedAt: 2,
			publishedBy: "test",
			snapshot: {
				envelopeBoundaries: [],
				items: [],
				name: "test full package april30",
				requiredPlatformRoles: [],
				requiredVariableKeys: [],
			},
			version: 1,
		});

		return { packageDefinitionId, packageVersionId };
	});
}

async function seedExistingDemoProviderEnvelope(
	t: ReturnType<typeof createTestConvex>,
	args: {
		dealId: Id<"deals">;
		lenderUserId: Id<"users">;
		mortgageId: Id<"mortgages">;
		providerEnvelopeId: string;
		sourceClass?: "private_static" | "private_templated_signable";
		status?: "generation_failed" | "signature_draft";
	}
) {
	return await t.run(async (ctx) => {
		const sourceClass = args.sourceClass ?? "private_static";
		const sourceBlueprintSnapshot = {
			class: sourceClass,
			displayName:
				sourceClass === "private_templated_signable"
					? "Demo Cleanup Signable Packet"
					: "Demo Cleanup Static Asset",
			displayOrder: 1,
			packageKey: "demo-cleanup-static",
			packageLabel: "Demo Cleanup",
		} as const;
		const fileRef = await (
			ctx.storage as unknown as {
				store: (blob: Blob) => Promise<Id<"_storage">>;
			}
		).store(new Blob(["demo cleanup fixture"], { type: "application/pdf" }));
		const basePdfId = await ctx.db.insert("documentBasePdfs", {
			fileHash: "demo-cleanup-base",
			fileRef,
			fileSize: 20,
			name: "Demo Cleanup Base",
			pageCount: 1,
			pageDimensions: [{ height: 792, page: 1, width: 612 }],
			uploadedAt: 1,
			uploadedBy: "test",
		});
		const templateId = await ctx.db.insert("documentTemplates", {
			basePdfHash: "demo-cleanup-base",
			basePdfId,
			createdAt: 1,
			draft: { fields: [], pdfmeSchema: [], signatories: [] },
			hasDraftChanges: false,
			name: "Demo Cleanup Template",
			updatedAt: 1,
		});
		const assetId = await ctx.db.insert("documentAssets", {
			fileHash: "demo-cleanup-asset",
			fileRef,
			fileSize: 20,
			mimeType: "application/pdf",
			name: "Demo Cleanup Static Asset",
			originalFilename: "demo-cleanup.pdf",
			source: "admin_upload",
			uploadedAt: 1,
			uploadedByUserId: args.lenderUserId,
		});
		const packageId = await ctx.db.insert("dealDocumentPackages", {
			blueprintSnapshots: [
				{
					assetId:
						sourceClass === "private_templated_signable"
							? undefined
							: assetId,
					sourceBlueprintSnapshot,
				},
			],
			createdAt: 1,
			dealId: args.dealId,
			lastError: "Previous local package failed",
			mortgageId: args.mortgageId,
			retryCount: 0,
			status: "failed",
			updatedAt: 1,
		});
		const oldInstanceId = await ctx.db.insert("dealDocumentInstances", {
			assetId:
				sourceClass === "private_templated_signable" ? undefined : assetId,
			createdAt: 1,
			dealId: args.dealId,
			kind:
				sourceClass === "private_templated_signable"
					? "generated"
					: "static_reference",
			lastError: "Previous local instance failed",
			mortgageId: args.mortgageId,
			packageId,
			sourceBlueprintSnapshot,
			status: args.status ?? "generation_failed",
			updatedAt: 1,
		});
		const generatedDocumentId = await ctx.db.insert("generatedDocuments", {
			documensoEnvelopeId: args.providerEnvelopeId,
			entityId: args.dealId,
			entityType: "deal",
			generatedAt: 1,
			generatedBy: "test",
			name: "Demo Cleanup Generated",
			pdfStorageId: fileRef,
			sensitivityTier: "private",
			signingStatus: "draft",
			templateId,
			templateVersionUsed: 1,
			updatedAt: 1,
		});
		const envelopeId = await ctx.db.insert("signatureEnvelopes", {
			createdAt: 1,
			dealId: args.dealId,
			generatedDocumentId,
			providerCode: "documenso",
			providerEnvelopeId: args.providerEnvelopeId,
			status: "draft",
			updatedAt: 1,
		});

		return { envelopeId, generatedDocumentId, oldInstanceId, packageId };
	});
}

async function seedDemoDealAuditFixture(
	t: ReturnType<typeof createTestConvex>
) {
	const lenderUserId = await ensureSeededIdentity(t, DEMO_LENDER);

	return await t.run(async (ctx) => {
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: Date.now(),
			lastTransitionAt: Date.now(),
			onboardedAt: Date.now(),
			orgId: FAIRLEND_STAFF_ORG_ID,
			status: "active",
			userId: lenderUserId,
		});
		const lenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			activatedAt: Date.now(),
			brokerId,
			createdAt: Date.now(),
			onboardingEntryPath: "admin_direct",
			orgId: FAIRLEND_STAFF_ORG_ID,
			status: "active",
			userId: lenderUserId,
		});
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: Date.now(),
			postalCode: "M5H 1J9",
			propertyType: "residential",
			province: "ON",
			streetAddress: "123 King St W",
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 300,
			brokerOfRecordId: brokerId,
			createdAt: Date.now(),
			firstPaymentDate: "2026-06-01",
			interestAdjustmentDate: "2026-05-01",
			interestRate: 9.5,
			lienPosition: 1,
			loanType: "conventional",
			maturityDate: "2027-04-30",
			orgId: FAIRLEND_STAFF_ORG_ID,
			paymentAmount: 2_450,
			paymentFrequency: "monthly",
			principal: 250_000,
			propertyId,
			rateType: "fixed",
			status: "active",
			termMonths: 12,
			termStartDate: "2026-05-01",
		});
		const dealId = await ctx.db.insert("deals", {
			buyerId: DEMO_LENDER.subject,
			closingDate: new Date("2026-05-15T12:00:00.000Z").getTime(),
			createdAt: Date.now(),
			createdBy: "demo-deal-closing-pipeline",
			fractionalShare: 2_500,
			lenderId,
			mortgageId,
			orgId: FAIRLEND_STAFF_ORG_ID,
			sellerId: "user_demo_seller",
			status: "initiated",
		});
		const timestamp = Date.now();
		await ctx.db.insert("auditJournal", {
			actorId: "demo-deal-closing-pipeline",
			actorType: "system",
			channel: "simulation",
			effectiveDate: "2026-04-30",
			entityId: dealId,
			entityType: "deal",
			eventCategory: "demo_pipeline",
			eventId: "demo_fixture_event",
			eventType: "demo_package_reset_started",
			linkedRecordIds: { entityId: dealId, mortgageId },
			mortgageId,
			newState: "initiated",
			originSystem: "convex",
			outcome: "transitioned",
			payload: { packageVersionId: "fixture_package_version" },
			previousState: "none",
			sequenceNumber: 1n,
			timestamp,
		});

		return { dealId, lenderId, lenderUserId, mortgageId };
	});
}

async function seedUnmarkedDealForDemoLender(
	t: ReturnType<typeof createTestConvex>
) {
	const lenderUserId = await ensureSeededIdentity(t, DEMO_LENDER);

	return await t.run(async (ctx) => {
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: Date.now(),
			lastTransitionAt: Date.now(),
			onboardedAt: Date.now(),
			orgId: FAIRLEND_STAFF_ORG_ID,
			status: "active",
			userId: lenderUserId,
		});
		const lenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			activatedAt: Date.now(),
			brokerId,
			createdAt: Date.now(),
			onboardingEntryPath: "admin_direct",
			orgId: FAIRLEND_STAFF_ORG_ID,
			status: "active",
			userId: lenderUserId,
		});
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: Date.now(),
			postalCode: "M5H 2N2",
			propertyType: "residential",
			province: "ON",
			streetAddress: "99 Bay St",
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 300,
			brokerOfRecordId: brokerId,
			createdAt: Date.now(),
			creationSource: "admin_direct",
			firstPaymentDate: "2026-06-01",
			interestAdjustmentDate: "2026-05-01",
			interestRate: 8.75,
			lienPosition: 1,
			loanType: "conventional",
			maturityDate: "2027-04-30",
			orgId: FAIRLEND_STAFF_ORG_ID,
			originatedByUserId: "seeded-human-originator",
			paymentAmount: 2_200,
			paymentFrequency: "monthly",
			principal: 225_000,
			propertyId,
			rateType: "fixed",
			status: "active",
			termMonths: 12,
			termStartDate: "2026-05-01",
			workflowSourceKey: "manual_seed",
		});
		const dealId = await ctx.db.insert("deals", {
			buyerId: DEMO_LENDER.subject,
			closingDate: new Date("2026-05-20T12:00:00.000Z").getTime(),
			createdAt: Date.now(),
			createdBy: "seeded-human-originator",
			fractionalShare: 1_000,
			lenderId,
			mortgageId,
			orgId: FAIRLEND_STAFF_ORG_ID,
			sellerId: "user_seeded_seller",
			status: "initiated",
		});

		return { dealId, lenderId, mortgageId };
	});
}

describe("demo/dealClosingPipeline", () => {
	it("reports setup_missing_package when the fixed package definition is absent", async () => {
		const t = createTestConvex({ includeWorkflowComponents: false });
		await ensureSeededIdentity(t, DEMO_LENDER);

		const state = await t
			.withIdentity(DEMO_LENDER)
			.query(api.demo.dealClosingPipeline.getState, {});

		expect(state.setup.status).toBe("missing_package");
		expect(state.packageDefinition).toMatchObject({
			id: "rd7t376j110ynd5gnvtnskhzch85vnen",
			expectedTitle: "test full package april30",
		});
		expect(state.canReset).toBe(false);
	});

	it("does not fall back to a same-title package when the fixed definition id is absent", async () => {
		const t = createTestConvex({ includeWorkflowComponents: false });
		await ensureSeededIdentity(t, DEMO_LENDER);
		await seedGeneratedDemoPackageWithSameTitle(t);

		const state = await t
			.withIdentity(DEMO_LENDER)
			.query(api.demo.dealClosingPipeline.getState, {});

		expect(state.setup.status).toBe("missing_package");
		expect(state.canReset).toBe(false);
		expect(state.packageDefinition).toMatchObject({
			id: "rd7t376j110ynd5gnvtnskhzch85vnen",
			expectedTitle: "test full package april30",
		});
	});

	it("exposes the fixed lender identity and audit events in the demo read model", async () => {
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDemoDealAuditFixture(t);

		const state = await t
			.withIdentity(DEMO_LENDER)
			.query(api.demo.dealClosingPipeline.getState, {});

		expect(state.lender).toMatchObject({
			authId: "user_01KJ6BJXS10933HSV7KYJ9HXMN",
			email: "connor.belez@gmail.com",
			expectedUserId: "k57ed93m3d2w0h2n3q0h8447hd81p79k",
			linkedUserId: fixture.lenderUserId,
			userId: fixture.lenderUserId,
		});
		expect(state.lender.linkedUserId).not.toBe(state.lender.expectedUserId);
		expect(state.auditTrail).toEqual([
			expect.objectContaining({
				actorId: "demo-deal-closing-pipeline",
				channel: "simulation",
				eventType: "demo_package_reset_started",
				message: expect.any(String),
			}),
		]);
	});

	it("includes Documenso provider webhook events in the demo audit trail", async () => {
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDemoDealAuditFixture(t);
		const receivedAt = new Date("2026-04-30T16:00:00.000Z").getTime();
		const processedAt = receivedAt + 1000;

		await t.run(async (ctx) => {
			await ctx.db.insert("dealEnvelopeProviderEvents", {
				attempts: 1,
				dealId: fixture.dealId,
				normalizedEventType: "document_completed",
				processedAt,
				provider: "documenso",
				providerEnvelopeId: "documenso_env_demo_completed",
				providerEventId: "documenso_event_demo_completed",
				providerRecipientId: "documenso_recipient_demo_lender",
				rawBody: JSON.stringify({ event: "DOCUMENT_COMPLETED" }),
				rawEventType: "DOCUMENT_COMPLETED",
				receivedAt,
				signatureVerified: true,
				status: "processed",
			});
		});

		const state = await t
			.withIdentity(DEMO_LENDER)
			.query(api.demo.dealClosingPipeline.getState, {});

		expect(state.auditTrail).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					actorId: "documenso",
					channel: "api_webhook",
					eventType: "documenso_document_completed",
					message: "Documenso document_completed",
					metadata: expect.objectContaining({
						providerEnvelopeId: "documenso_env_demo_completed",
						providerRecipientId: "documenso_recipient_demo_lender",
						rawEventType: "DOCUMENT_COMPLETED",
						status: "processed",
					}),
					newState: "document_completed",
					previousState: null,
					timestamp: processedAt,
				}),
			])
		);
	});

	it("ignores unmarked lender deals and bootstraps a distinct demo-marked graph", async () => {
		const previousHashChainSetting = process.env.DISABLE_GT_HASHCHAIN;
		process.env.DISABLE_GT_HASHCHAIN = "true";
		const t = createTestConvex({ includeWorkflowComponents: false });
		await seedReadyDemoPackage(t);
		const unrelated = await seedUnmarkedDealForDemoLender(t);

		try {
			const result = await t
				.withIdentity(DEMO_LENDER)
				.action(api.demo.dealClosingPipeline.resetAndRegenerate, {});

			expect(result.dealId).not.toBe(unrelated.dealId);

			const records = await t.run(async (ctx) => {
				const unrelatedDeal = await ctx.db.get(unrelated.dealId);
				const unrelatedMortgage = await ctx.db.get(unrelated.mortgageId);
				const demoDeal = await ctx.db.get(result.dealId);
				const demoMortgage = await ctx.db.get(result.mortgageId);
				const unrelatedAuditEvents = await ctx.db
					.query("auditJournal")
					.withIndex("by_entity", (query) =>
						query.eq("entityType", "deal").eq("entityId", unrelated.dealId)
					)
					.collect();
				return {
					demoDeal,
					demoMortgage,
					unrelatedAuditEvents,
					unrelatedDeal,
					unrelatedMortgage,
				};
			});

			expect(records.unrelatedDeal).toMatchObject({
				_id: unrelated.dealId,
				createdBy: "seeded-human-originator",
				status: "initiated",
			});
			expect(records.unrelatedMortgage).toMatchObject({
				_id: unrelated.mortgageId,
				creationSource: "admin_direct",
				workflowSourceKey: "manual_seed",
			});
			expect(records.unrelatedAuditEvents).toEqual([]);
			expect(records.demoDeal).toMatchObject({
				_id: result.dealId,
				createdBy: "demo-deal-closing-pipeline",
			});
			expect(records.demoMortgage).toMatchObject({
				_id: result.mortgageId,
				creationSource: "demo_deal_closing_pipeline",
				workflowSourceKey: "demo_deal_closing_pipeline",
			});
		} finally {
			if (previousHashChainSetting === undefined) {
				delete process.env.DISABLE_GT_HASHCHAIN;
			} else {
				process.env.DISABLE_GT_HASHCHAIN = previousHashChainSetting;
			}
		}
	});

	it("rejects reset for authenticated viewers outside the demo reset boundary", async () => {
		const t = createTestConvex({ includeWorkflowComponents: false });

		await expect(
			t
				.withIdentity(UNAUTHORIZED_VIEWER)
				.action(api.demo.dealClosingPipeline.resetAndRegenerate, {})
		).rejects.toThrow(/demo reset requires fairlend admin access/i);
	});

	it("rejects read model access for authenticated viewers outside the demo boundary", async () => {
		const t = createTestConvex({ includeWorkflowComponents: false });

		await expect(
			t
				.withIdentity(UNAUTHORIZED_VIEWER)
				.query(api.demo.dealClosingPipeline.getState, {})
		).rejects.toThrow(/demo read requires fairlend admin access/i);
	});

	it("normalizes Documenso cleanup 400 responses as not_deletable", async () => {
		const previousToken = process.env.DOCUMENSO_API_TOKEN;
		process.env.DOCUMENSO_API_TOKEN = "documenso_test_token";
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async () => {
				return new Response(JSON.stringify({ error: "cannot delete" }), {
					status: 400,
				});
			});

		try {
			const result = await cleanupDemoDocumensoEnvelope(
				"env_not_deletable"
			);

			expect(result).toEqual({
				error: expect.stringContaining("status 400"),
				providerEnvelopeId: "env_not_deletable",
				status: "not_deletable",
			});
			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
				"/envelope/delete"
			);
		} finally {
			fetchMock.mockRestore();
			if (previousToken === undefined) {
				delete process.env.DOCUMENSO_API_TOKEN;
			} else {
				process.env.DOCUMENSO_API_TOKEN = previousToken;
			}
		}
	});

	it("reset returns a deterministic setup error before provider work when package is absent", async () => {
		const t = createTestConvex({ includeWorkflowComponents: false });
		await ensureSeededIdentity(t, DEMO_LENDER);

		await expect(
			t
				.withIdentity(DEMO_LENDER)
				.action(api.demo.dealClosingPipeline.resetAndRegenerate, {})
		).rejects.toThrow(/test full package april30/i);
	});

	it("ready reset applies the package version, attempts generation, and records truthful audit states", async () => {
		const previousHashChainSetting = process.env.DISABLE_GT_HASHCHAIN;
		process.env.DISABLE_GT_HASHCHAIN = "true";
		const t = createTestConvex({ includeWorkflowComponents: false });
		const { packageDefinitionId, packageVersionId } =
			await seedReadyDemoPackage(t);

		try {
			const result = await t
				.withIdentity(DEMO_LENDER)
				.action(api.demo.dealClosingPipeline.resetAndRegenerate, {});
			const packageApplicationId = result.packageApplicationId;
			const mortgageId = result.mortgageId;

			expect(result).toMatchObject({
				dealId: expect.any(String),
				mortgageId: expect.any(String),
				ok: true,
				packageApplicationId: expect.any(String),
				packageDefinitionId,
				packageVersionId,
				packageGeneration: {
					error: null,
					packageId: expect.any(String),
					status: "ready",
				},
				status: "demo_package_generation_succeeded",
			});

			const packageApplication = await t.run(async (ctx) => {
				return await ctx.db.get(packageApplicationId);
			});
			expect(packageApplication).toEqual(
				expect.objectContaining({
					_id: packageApplicationId,
					mortgageId,
					packageVersionId,
					status: "active",
				})
			);

			const state = await t
				.withIdentity(DEMO_LENDER)
				.query(api.demo.dealClosingPipeline.getState, {});
			expect(state.auditTrail).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						eventType: "demo_package_reset_started",
						newState: "reset_started",
						previousState: "ready",
					}),
					expect.objectContaining({
						eventType: "demo_package_generation_succeeded",
						metadata: expect.objectContaining({
							generationStatus: "ready",
						}),
						newState: "ready",
						previousState: "reset_started",
					}),
				])
			);
		} finally {
			if (previousHashChainSetting === undefined) {
				delete process.env.DISABLE_GT_HASHCHAIN;
			} else {
				process.env.DISABLE_GT_HASHCHAIN = previousHashChainSetting;
			}
		}
	});

	it("records cleanup audit and regenerates locally when provider cleanup is not deletable", async () => {
		const previousHashChainSetting = process.env.DISABLE_GT_HASHCHAIN;
		const previousToken = process.env.DOCUMENSO_API_TOKEN;
		process.env.DISABLE_GT_HASHCHAIN = "true";
		process.env.DOCUMENSO_API_TOKEN = "documenso_test_token";
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async () => {
				return new Response(JSON.stringify({ error: "cannot delete" }), {
					status: 400,
				});
			});
		const t = createTestConvex({ includeWorkflowComponents: false });
		await seedReadyDemoPackage(t);
		const fixture = await seedDemoDealAuditFixture(t);
		const existing = await seedExistingDemoProviderEnvelope(t, {
			dealId: fixture.dealId,
			lenderUserId: fixture.lenderUserId,
			mortgageId: fixture.mortgageId,
			providerEnvelopeId: "env_reset_not_deletable",
		});

		try {
			const result = await t
				.withIdentity(DEMO_LENDER)
				.action(api.demo.dealClosingPipeline.resetAndRegenerate, {});

			expect(result).toMatchObject({
				dealId: fixture.dealId,
				packageGeneration: {
					error: null,
					packageId: existing.packageId,
					status: "ready",
				},
				status: "demo_package_generation_succeeded",
			});

			const records = await t.run(async (ctx) => {
				const generatedDocument = await ctx.db.get(
					existing.generatedDocumentId
				);
				const signatureEnvelope = await ctx.db.get(existing.envelopeId);
				const instances = await ctx.db
					.query("dealDocumentInstances")
					.withIndex("by_package", (query) =>
						query.eq("packageId", existing.packageId)
					)
					.collect();
				const cleanupAudits = await ctx.db
					.query("auditJournal")
					.withIndex("by_entity", (query) =>
						query.eq("entityType", "deal").eq("entityId", fixture.dealId)
					)
					.collect();

				return {
					cleanupAudits: cleanupAudits.filter(
						(audit) =>
							audit.eventType === "demo_provider_envelope_cleanup"
					),
					generatedDocument,
					instances,
					signatureEnvelope,
				};
			});

			expect(records.generatedDocument).toMatchObject({
				_id: existing.generatedDocumentId,
				signingStatus: "provider_error",
			});
			expect(records.generatedDocument?.documensoEnvelopeId).toBeUndefined();
			expect(records.signatureEnvelope).toMatchObject({
				_id: existing.envelopeId,
				providerEnvelopeId: "env_reset_not_deletable",
				status: "provider_error",
			});
			expect(records.instances).toContainEqual(
				expect.objectContaining({
					_id: existing.oldInstanceId,
					archivedAt: expect.any(Number),
					status: "archived",
				})
			);
			expect(
				records.instances.some(
					(instance) =>
						instance.kind === "static_reference" &&
						instance.status === "available" &&
						instance.archivedAt === undefined
				)
			).toBe(true);
			expect(records.cleanupAudits).toHaveLength(1);
			expect(records.cleanupAudits[0]).toMatchObject({
				eventType: "demo_provider_envelope_cleanup",
				payload: {
					message: expect.stringContaining("not_deletable"),
					metadata: expect.objectContaining({
						error: expect.stringContaining("status 400"),
						providerEnvelopeId: "env_reset_not_deletable",
						status: "not_deletable",
					}),
				},
			});
		} finally {
			fetchMock.mockRestore();
			if (previousHashChainSetting === undefined) {
				delete process.env.DISABLE_GT_HASHCHAIN;
			} else {
				process.env.DISABLE_GT_HASHCHAIN = previousHashChainSetting;
			}
			if (previousToken === undefined) {
				delete process.env.DOCUMENSO_API_TOKEN;
			} else {
				process.env.DOCUMENSO_API_TOKEN = previousToken;
			}
		}
	});

	it("clears local signable envelope references before retry generation", async () => {
		const previousHashChainSetting = process.env.DISABLE_GT_HASHCHAIN;
		const previousToken = process.env.DOCUMENSO_API_TOKEN;
		process.env.DISABLE_GT_HASHCHAIN = "true";
		process.env.DOCUMENSO_API_TOKEN = "documenso_test_token";
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async () => {
				return new Response(JSON.stringify({ error: "cannot delete" }), {
					status: 400,
				});
			});
		const t = createTestConvex({ includeWorkflowComponents: false });
		await seedReadyDemoPackage(t);
		const fixture = await seedDemoDealAuditFixture(t);
		const existing = await seedExistingDemoProviderEnvelope(t, {
			dealId: fixture.dealId,
			lenderUserId: fixture.lenderUserId,
			mortgageId: fixture.mortgageId,
			providerEnvelopeId: "env_stale_signable",
			sourceClass: "private_templated_signable",
			status: "signature_draft",
		});

		try {
			const result = await t
				.withIdentity(DEMO_LENDER)
				.action(api.demo.dealClosingPipeline.resetAndRegenerate, {});

			expect(result).toMatchObject({
				dealId: fixture.dealId,
				packageGeneration: {
					packageId: existing.packageId,
					status: "failed",
				},
				status: "demo_package_generation_failed",
			});
			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
				"/envelope/delete"
			);

			const records = await t.run(async (ctx) => {
				const generatedDocument = await ctx.db.get(
					existing.generatedDocumentId
				);
				const signatureEnvelope = await ctx.db.get(existing.envelopeId);
				const instances = await ctx.db
					.query("dealDocumentInstances")
					.withIndex("by_package", (query) =>
						query.eq("packageId", existing.packageId)
					)
					.collect();
				return { generatedDocument, instances, signatureEnvelope };
			});

			expect(records.generatedDocument).toMatchObject({
				_id: existing.generatedDocumentId,
				signingStatus: "provider_error",
			});
			expect(records.generatedDocument?.documensoEnvelopeId).toBeUndefined();
			expect(records.signatureEnvelope).toMatchObject({
				_id: existing.envelopeId,
				providerEnvelopeId: "env_stale_signable",
				status: "provider_error",
			});
			expect(records.instances).toContainEqual(
				expect.objectContaining({
					_id: existing.oldInstanceId,
					archivedAt: expect.any(Number),
					status: "archived",
				})
			);
		} finally {
			fetchMock.mockRestore();
			if (previousHashChainSetting === undefined) {
				delete process.env.DISABLE_GT_HASHCHAIN;
			} else {
				process.env.DISABLE_GT_HASHCHAIN = previousHashChainSetting;
			}
			if (previousToken === undefined) {
				delete process.env.DOCUMENSO_API_TOKEN;
			} else {
				process.env.DOCUMENSO_API_TOKEN = previousToken;
			}
		}
	});

	it("records provider_error cleanup audit and regenerates when Documenso cleanup is not configured", async () => {
		const previousHashChainSetting = process.env.DISABLE_GT_HASHCHAIN;
		const previousToken = process.env.DOCUMENSO_API_TOKEN;
		const previousApiKey = process.env.DOCUMENSO_API_KEY;
		process.env.DISABLE_GT_HASHCHAIN = "true";
		delete process.env.DOCUMENSO_API_TOKEN;
		delete process.env.DOCUMENSO_API_KEY;
		const t = createTestConvex({ includeWorkflowComponents: false });
		await seedReadyDemoPackage(t);
		const fixture = await seedDemoDealAuditFixture(t);
		const existing = await seedExistingDemoProviderEnvelope(t, {
			dealId: fixture.dealId,
			lenderUserId: fixture.lenderUserId,
			mortgageId: fixture.mortgageId,
			providerEnvelopeId: "env_cleanup_not_configured",
		});

		try {
			const result = await t
				.withIdentity(DEMO_LENDER)
				.action(api.demo.dealClosingPipeline.resetAndRegenerate, {});

			expect(result).toMatchObject({
				dealId: fixture.dealId,
				packageGeneration: {
					error: null,
					packageId: existing.packageId,
					status: "ready",
				},
				status: "demo_package_generation_succeeded",
			});

			const cleanupAudits = await t.run(async (ctx) => {
				const auditRows = await ctx.db
					.query("auditJournal")
					.withIndex("by_entity", (query) =>
						query.eq("entityType", "deal").eq("entityId", fixture.dealId)
					)
					.collect();
				return auditRows.filter(
					(audit) => audit.eventType === "demo_provider_envelope_cleanup"
				);
			});

			expect(cleanupAudits).toHaveLength(1);
			expect(cleanupAudits[0]).toMatchObject({
				eventType: "demo_provider_envelope_cleanup",
				payload: {
					message: expect.stringContaining("provider_error"),
					metadata: expect.objectContaining({
						error: expect.stringContaining("Missing DOCUMENSO_API"),
						providerEnvelopeId: "env_cleanup_not_configured",
						status: "provider_error",
					}),
				},
			});
		} finally {
			if (previousHashChainSetting === undefined) {
				delete process.env.DISABLE_GT_HASHCHAIN;
			} else {
				process.env.DISABLE_GT_HASHCHAIN = previousHashChainSetting;
			}
			if (previousToken === undefined) {
				delete process.env.DOCUMENSO_API_TOKEN;
			} else {
				process.env.DOCUMENSO_API_TOKEN = previousToken;
			}
			if (previousApiKey === undefined) {
				delete process.env.DOCUMENSO_API_KEY;
			} else {
				process.env.DOCUMENSO_API_KEY = previousApiKey;
			}
		}
	});

	it("preserves package row diagnostics for non-throw generation failures", () => {
		const packageId =
			"kg2syntheticfailedpackage0000000000" as Id<"dealDocumentPackages">;

		expect(
			buildDemoGenerationResult({
				generationResult: {
					packageId,
					status: "partial_failure",
				},
				packageRow: {
					lastError: "Documenso recipient resolution failed",
				},
			})
		).toEqual({
			error: "Documenso recipient resolution failed",
			packageId,
			status: "partial_failure",
		});
		expect(
			buildDemoGenerationResult({
				generationResult: {
					packageId,
					status: "failed",
				},
				packageRow: {
					lastError: undefined,
				},
			}).error
		).toContain('status "failed"');
	});

	it("reports missing_published_version from a DB-backed package lookup", async () => {
		const t = createTestConvex({ includeWorkflowComponents: false });
		const packageDefinitionId = await t.run(async (ctx) => {
			return await ctx.db.insert("documentPackageDefinitions", {
				createdAt: 1,
				currentPublishedVersion: 1,
				draft: { items: [] },
				hasDraftChanges: false,
				name: "Synthetic Demo Package",
				updatedAt: 1,
			});
		});

		const lookup = await t.query(
			internal.demo.dealClosingPipeline.lookupPackageByIdAndTitleInternal,
			{
				packageDefinitionId,
				expectedTitle: "Synthetic Demo Package",
			}
		);

		expect(toDemoSetupStatus(lookup)).toBe("missing_published_version");
		expect(lookup).toEqual({
			status: "missing_published_version",
			definition: {
				_id: packageDefinitionId,
				currentPublishedVersion: 1,
				name: "Synthetic Demo Package",
			},
		});
		expect(Object.keys(lookup.definition).sort()).toEqual([
			"_id",
			"currentPublishedVersion",
			"name",
		]);
		expect(() => requireResettablePackage(lookup)).toThrow(
			/Synthetic Demo Package.*no published version/i
		);
	});

	it("returns only the projected package definition and version keys from DB-backed lookup", async () => {
		const t = createTestConvex({ includeWorkflowComponents: false });
		const { packageDefinitionId, packageVersionId } = await t.run(
			async (ctx) => {
				const packageDefinitionId = await ctx.db.insert(
					"documentPackageDefinitions",
					{
						createdAt: 1,
						currentPublishedVersion: 1,
						description: "Extra field should not be returned",
						draft: { items: [] },
						hasDraftChanges: false,
						name: "Synthetic Demo Package",
						updatedAt: 2,
					}
				);
				const packageVersionId = await ctx.db.insert("documentPackageVersions", {
					packageId: packageDefinitionId,
					publishedAt: 3,
					publishedBy: "seed",
					snapshot: {
						description: "Extra nested field should not be returned",
						envelopeBoundaries: [],
						items: [],
						name: "Synthetic Demo Package",
						requiredPlatformRoles: [],
						requiredVariableKeys: [],
					},
					version: 1,
				});

				return { packageDefinitionId, packageVersionId };
			}
		);

		const lookup = await t.query(
			internal.demo.dealClosingPipeline.lookupPackageByIdAndTitleInternal,
			{
				packageDefinitionId,
				expectedTitle: "Synthetic Demo Package",
			}
		);

		expect(lookup).toEqual({
			status: "ready",
			definition: {
				_id: packageDefinitionId,
				currentPublishedVersion: 1,
				name: "Synthetic Demo Package",
			},
			version: {
				_id: packageVersionId,
			},
		});
		expect(Object.keys(lookup.definition).sort()).toEqual([
			"_id",
			"currentPublishedVersion",
			"name",
		]);
		expect(Object.keys(lookup.version)).toEqual(["_id"]);
	});
});
