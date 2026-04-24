import { describe, expect, it } from "vitest";
import { api, internal } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type {
	VelocityConnectorCredentialContext,
	VelocityDeal,
} from "../../../../convex/velocity/contracts";
import { createTestConvex, ensureSeededIdentity } from "../../auth/helpers";
import { FAIRLEND_ADMIN } from "../../auth/identities";

type ConvexTest = ReturnType<typeof createTestConvex>;

const FETCH_CREDENTIAL = {
	apiKeyFingerprint: "sha256:test-api-key",
	credentialId: "velocity-fetch-credential",
	provider: "velocity",
	scope: "deals_out",
	usedFor: "full_deal_fetch",
} satisfies VelocityConnectorCredentialContext;

function makeDeal(overrides: Partial<VelocityDeal> = {}): VelocityDeal {
	const mortgageRequest: NonNullable<VelocityDeal["mortgageRequest"]> = {
		amortizationMonths: 300,
		firstPaymentDate: "2026-06-01",
		interestAdjustmentDate: "2026-05-01",
		lenderName: "Velocity Test Lender",
		maturityDate: "2027-05-01",
		mortgages: [{ amount: 250_000 }],
		payment: 1250,
		paymentFrequency: 3,
		purpose: 10,
		rate: 8.25,
		rateType: 4,
		termInMonths: 12,
	};
	const subjectProperty: NonNullable<VelocityDeal["subjectProperty"]> = {
		city: "Toronto",
		intendedUse: 1,
		postalCode: "M5V 1A1",
		propertyType: "residential",
		province: 9,
		purchasePrice: 350_000,
		streetName: "King",
		streetNumber: "123",
		unitNumber: "1201",
	};

	return {
		agent: "Velocity Agent",
		borrowers: [
			{
				cellPhone: "4165550100",
				email: "borrower@example.test",
				firstName: "Borrower",
				lastName: "One",
			},
		],
		closingDate: "2026-05-01",
		conditions: [{ isApproved: false, isSent: true, name: "PAD evidence" }],
		dateCreated: "2026-04-23T15:00:00.000Z",
		isConfirmedCompliant: true,
		lenderConditions: ["Condition A"],
		lenderReferenceNumber: "LENDER-REF-1001",
		linkApplicationId: "LINK-1001",
		loanCode: "LC-1001",
		mortgageRequest: {
			...mortgageRequest,
			...(overrides.mortgageRequest ?? {}),
		},
		notes: [{ dateCreated: "2026-04-23", text: "Initial note" }],
		status: 6,
		subjectProperty: {
			...subjectProperty,
			...(overrides.subjectProperty ?? {}),
		},
		...overrides,
	};
}

async function applyFullDealSync(t: ConvexTest, deal: VelocityDeal) {
	const loanCode = deal.loanCode ?? "LC-1001";
	return await t.mutation(internal.velocity.sync.applyVelocityFullDealSync, {
		fetchCredentialContext: FETCH_CREDENTIAL,
		loanCode,
		rawDeal: deal,
		rawResponseBody: JSON.stringify({ deals: [deal] }),
		request: {
			loanCode,
			method: "GET",
			url: `https://velocity.test/v1/deals?loancode=${loanCode}`,
		},
		responseStatus: 200,
		startedAt: Date.now(),
		trigger: "webhook",
	});
}

async function seedPdfAsset(t: ConvexTest, name = "PAD Authorization") {
	return await t.run(async (ctx) => {
		const adminUser = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", FAIRLEND_ADMIN.subject))
			.unique();
		if (!adminUser) {
			throw new Error("Admin user not found");
		}
		const fileRef = await (
			ctx.storage as unknown as { store: (blob: Blob) => Promise<Id<"_storage">> }
		).store(new Blob([name], { type: "application/pdf" }));

		return ctx.db.insert("documentAssets", {
			description: name,
			fileHash: `hash-${name.toLowerCase().replace(/\s+/g, "-")}`,
			fileRef,
			fileSize: 128,
			mimeType: "application/pdf",
			name,
			originalFilename: `${name.toLowerCase().replace(/\s+/g, "-")}.pdf`,
			pageCount: 1,
			source: "admin_upload",
			uploadedAt: Date.now(),
			uploadedByUserId: adminUser._id,
		});
	});
}

async function seedReadyWorkspace(t: ConvexTest) {
	await ensureSeededIdentity(t, FAIRLEND_ADMIN);
	const sync = await applyFullDealSync(t, makeDeal());
	if (!sync.workspaceId) {
		throw new Error("Expected Velocity workspace");
	}
	const workspaceId = sync.workspaceId as Id<"velocityPackageWorkspaces">;
	const padAssetId = await seedPdfAsset(t);

	await t.withIdentity(FAIRLEND_ADMIN).mutation(
		api.velocity.workspaces.updateVelocityPackageFairLendFields,
		{
			patch: {
				activationRemediation: {
					lienPosition: 1,
					loanType: "conventional",
				},
				bankInput: {
					accountHolderName: "Borrower One",
					accountNumber: "123456789",
					institutionNumber: "001",
					transitNumber: "00011",
				},
				staffNotes: "Ready for review",
			},
			workspaceId,
		}
	);
	await t.withIdentity(FAIRLEND_ADMIN).mutation(
		api.velocity.documents.linkVelocityPackageDocument,
		{
			documentAssetId: padAssetId,
			role: "pad_evidence",
			workspaceId,
		}
	);

	return { padAssetId, workspaceId };
}

describe("Velocity package workspace backend", () => {
	it("lists board rows and detail payloads with immutable Velocity data separated from FairLend enrichment", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const sync = await applyFullDealSync(t, makeDeal());
		const workspaceId = sync.workspaceId as Id<"velocityPackageWorkspaces">;

		const boardRows = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(api.velocity.workspaces.listVelocityPackageWorkspaces, {});
		const detail = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(api.velocity.workspaces.getVelocityPackageWorkspace, {
				workspaceId,
			});

		expect(boardRows).toHaveLength(1);
		expect(boardRows[0]).toMatchObject({
			currentVelocityStage: { code: 6, label: "Funded" },
			fairlendActionState: "needs_fairlend_data",
			linkApplicationId: "LINK-1001",
			loanCode: "LC-1001",
			primaryBorrowerName: "Borrower One",
			readiness: {
				canActivate: false,
				canFinalReview: false,
			},
		});
		expect(detail).toMatchObject({
			fairlendOwned: {
				enrichment: {},
				state: "needs_fairlend_data",
			},
			velocityOwned: {
				identity: {
					linkApplicationId: "LINK-1001",
					loanCode: "LC-1001",
				},
				mortgageRequest: {
					requestedPrincipal: 250_000,
				},
			},
		});
		expect(detail?.fairlendOwned.enrichment).not.toHaveProperty(
			"normalizedCore"
		);
	});

	it("patches only FairLend-owned enrichment, recomputes readiness, and writes package audit entries", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const sync = await applyFullDealSync(t, makeDeal());
		const workspaceId = sync.workspaceId as Id<"velocityPackageWorkspaces">;

		const result = await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.velocity.workspaces.updateVelocityPackageFairLendFields,
			{
				patch: {
					activationRemediation: {
						lienPosition: 1,
						loanType: "conventional",
					},
					bankInput: {
						accountHolderName: "Borrower One",
						accountNumber: "123456789",
						institutionNumber: "001",
						transitNumber: "00011",
					},
				},
				workspaceId,
			}
		);
		const state = await t.run(async (ctx) => ({
			audits: await ctx.db.query("auditJournal").collect(),
			workspace: await ctx.db.get(workspaceId),
		}));

		expect(result.readiness.blockers.map((blocker) => blocker.code)).toEqual([
			"missing_pad_pdf",
		]);
		expect(state.workspace).toMatchObject({
			fairlendEnrichment: {
				activationRemediation: {
					lienPosition: 1,
					loanType: "conventional",
				},
				bankInput: {
					accountLast4: "6789",
					country: "CA",
					currency: "CAD",
				},
			},
			normalizedCore: {
				mortgageRequest: {
					requestedPrincipal: 250_000,
				},
			},
			state: "needs_fairlend_data",
		});
		expect(state.audits.map((audit) => audit.eventType)).toEqual(
			expect.arrayContaining([
				"velocity_fairlend_enrichment_updated",
				"velocity_readiness_recomputed",
			])
		);

		await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.velocity.workspaces.updateVelocityPackageFairLendFields,
			{
				patch: {
					bankInput: {
						accountNumber: "987654321",
					},
				},
				workspaceId,
			}
		);
		const updated = await t.run(async (ctx) => ({
			workspace: await ctx.db.get(workspaceId),
		}));
		const detail = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(api.velocity.workspaces.getVelocityPackageWorkspace, {
				workspaceId,
			});

		expect(updated.workspace?.fairlendEnrichment.bankInput).toMatchObject({
			accountLast4: "4321",
			accountNumber: "987654321",
		});
		expect(detail?.fairlendOwned.enrichment.bankInput).toMatchObject({
			accountLast4: "4321",
		});
		expect(detail?.fairlendOwned.enrichment.bankInput).not.toHaveProperty(
			"accountNumber"
		);
	});

	it("filters board rows from open exceptions instead of stale workspace summaries", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const sync = await applyFullDealSync(t, makeDeal());
		const workspaceId = sync.workspaceId as Id<"velocityPackageWorkspaces">;

		await t.run(async (ctx) => {
			await ctx.db.insert("velocityPackageExceptions", {
				kind: "activation_exception",
				message: "Activation needs staff remediation.",
				openedAt: Date.now(),
				severity: "blocking",
				status: "open",
				title: "Activation blocker",
				workspaceId,
			});
		});

		const boardRows = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(api.velocity.workspaces.listVelocityPackageWorkspaces, {
				exceptionKind: "activation_exception",
			});

		expect(boardRows).toHaveLength(1);
		expect(boardRows[0]).toMatchObject({
			exception: {
				hasOpenException: true,
				kind: "activation_exception",
				summary: "Activation blocker",
			},
			workspaceId,
		});
	});

	it("links package documents by role, supersedes prior role links, and uses PAD evidence for readiness", async () => {
		const t = createTestConvex();
		const { workspaceId } = await seedReadyWorkspace(t);
		const replacementPadAssetId = await seedPdfAsset(t, "Replacement PAD");

		const replacement = await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.velocity.documents.linkVelocityPackageDocument,
			{
				documentAssetId: replacementPadAssetId,
				role: "pad_evidence",
				workspaceId,
			}
		);
		const detail = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(api.velocity.workspaces.getVelocityPackageWorkspace, {
				workspaceId,
			});

		expect(replacement.readiness.blockers).toHaveLength(0);
		expect(replacement.state).toBe("ready_for_review");
		expect(detail?.documents.filter((link) => link.role === "pad_evidence")).toHaveLength(2);
		expect(
			detail?.documents.filter(
				(link) => link.role === "pad_evidence" && link.supersededAt === null
			)
		).toHaveLength(1);
		expect(detail?.fairlendOwned.enrichment.padEvidence).toMatchObject({
			documentAssetId: replacementPadAssetId,
			mimeType: "application/pdf",
			originalFilename: "replacement-pad.pdf",
		});
	});

	it("rejects package document links that do not reference an existing document asset", async () => {
		const t = createTestConvex();
		const { workspaceId } = await seedReadyWorkspace(t);

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).mutation(
				api.velocity.documents.linkVelocityPackageDocument,
				{
					documentAssetId: "99999;documentAssets" as Id<"documentAssets">,
					role: "supporting_document",
					workspaceId,
				}
			)
		).rejects.toThrow("Document asset not found");
	});

	it("persists final-review snapshots and invalidates activation readiness when Velocity core drifts", async () => {
		const t = createTestConvex();
		const { workspaceId } = await seedReadyWorkspace(t);
		const initial = await t.run(async (ctx) => {
			const workspace = await ctx.db.get(workspaceId);
			const snapshot = await ctx.db
				.query("velocityPackageSnapshots")
				.withIndex("by_workspace_created_at", (query) =>
					query.eq("workspaceId", workspaceId)
				)
				.first();
			if (!workspace || !snapshot) {
				throw new Error("Expected workspace and upstream snapshot");
			}
			return { snapshot, workspace };
		});

		const confirmed = await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.velocity.review.confirmVelocityPackageFinalReview,
			{
				normalizedCoreHash: initial.workspace.normalizedCoreHash,
				snapshotId: initial.snapshot._id,
				workspaceId,
			}
		);
		expect(confirmed.state).toBe("ready_to_activate");
		expect(confirmed.readiness.canActivate).toBe(true);

		await applyFullDealSync(
			t,
			makeDeal({
				mortgageRequest: {
					payment: 1300,
				},
			})
		);
		const drifted = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(api.velocity.workspaces.getVelocityPackageWorkspace, {
				workspaceId,
			});

		expect(drifted?.fairlendOwned.state).toBe("final_review_required");
		expect(drifted?.readiness.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "upstream_changed_after_review" }),
			])
		);
		expect(
			drifted?.snapshots.filter(
				(snapshot) => snapshot.snapshotType === "final_review"
			)
		).toHaveLength(1);
	});

	it("exposes latest activation attempt remediation state without leaking full bank details", async () => {
		const t = createTestConvex();
		const { workspaceId } = await seedReadyWorkspace(t);
		const attempt = await t.run(async (ctx) => {
			const actor = await ctx.db
				.query("users")
				.withIndex("authId", (query) => query.eq("authId", FAIRLEND_ADMIN.subject))
				.unique();
			const snapshot = await ctx.db
				.query("velocityPackageSnapshots")
				.withIndex("by_workspace_created_at", (query) =>
					query.eq("workspaceId", workspaceId)
				)
				.first();
			if (!actor || !snapshot) {
				throw new Error("Expected actor and workspace snapshot");
			}

			return await ctx.db.insert("velocityActivationAttempts", {
				actorAuthId: FAIRLEND_ADMIN.subject,
				actorUserId: actor._id,
				failedAt: Date.now(),
				failureCode: "rotessa_request_failed",
				failureMessage: "Rotessa schedule creation failed.",
				idempotencyKey: "velocity:activation:test-remediation",
				reviewedSnapshotHash: snapshot.normalizedCoreHash,
				reviewedSnapshotId: snapshot._id,
				rotessaCustomerRef: "501",
				startedAt: Date.now(),
				status: "failed",
				workspaceId,
			});
		});

		const detail = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(api.velocity.workspaces.getVelocityPackageWorkspace, {
				workspaceId,
			});

		expect(detail?.activationAttempt).toMatchObject({
			activationAttemptId: attempt,
			failureCode: "rotessa_request_failed",
			failureMessage: "Rotessa schedule creation failed.",
			idempotencyKey: "velocity:activation:test-remediation",
			rotessaCustomerRef: "501",
			status: "failed",
		});
		expect(detail?.activationAttempt?.rotessaScheduleRef).toBeNull();
		expect(detail?.fairlendOwned.enrichment.bankInput).toMatchObject({
			accountLast4: "6789",
		});
		expect(detail?.fairlendOwned.enrichment.bankInput).not.toHaveProperty(
			"accountNumber"
		);
	});

	it("resolves package exceptions with audit while preserving still-active readiness blockers", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const sync = await applyFullDealSync(
			t,
			makeDeal({
				mortgageRequest: {
					paymentFrequency: 4,
				},
			})
		);
		const state = await t.run(async (ctx) => {
			const exception = await ctx.db
				.query("velocityPackageExceptions")
				.filter((query) => query.eq(query.field("workspaceId"), sync.workspaceId))
				.first();
			if (!exception || !sync.workspaceId) {
				throw new Error("Expected workspace exception");
			}
			return { exception, workspaceId: sync.workspaceId };
		});

		const resolved = await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.velocity.exceptions.resolveVelocityPackageException,
			{
				exceptionId: state.exception._id,
				resolutionNote: "Reviewed with staff; blocker remains visible in readiness.",
			}
		);
		const after = await t.run(async (ctx) => ({
			audits: await ctx.db.query("auditJournal").collect(),
			exception: await ctx.db.get(state.exception._id),
			workspace: await ctx.db.get(state.workspaceId),
		}));

		expect(resolved).toMatchObject({
			exceptionId: state.exception._id,
			status: "resolved",
			workspaceId: state.workspaceId,
		});
		expect(after.exception).toMatchObject({
			details: {
				resolutionNote:
					"Reviewed with staff; blocker remains visible in readiness.",
			},
			status: "resolved",
		});
		expect(after.workspace?.readiness.blockers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "unsupported_payment_frequency" }),
			])
		);
		expect(after.audits.map((audit) => audit.eventType)).toContain(
			"velocity_exception_resolved"
		);
	});
});
