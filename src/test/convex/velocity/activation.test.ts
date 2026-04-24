import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type {
	VelocityConnectorCredentialContext,
	VelocityDeal,
} from "../../../../convex/velocity/contracts";
import { buildVelocityActivationHandoff } from "../../../../convex/velocity/activationMapper";
import { createTestConvex, ensureSeededIdentity } from "../../auth/helpers";
import { FAIRLEND_ADMIN } from "../../auth/identities";

type ConvexTest = ReturnType<typeof createTestConvex>;

const ORIGINAL_ROTESSA_API_KEY = process.env.ROTESSA_API_KEY;
const ORIGINAL_ROTESSA_API_BASE_URL = process.env.ROTESSA_API_BASE_URL;

const activateVelocityPackageRef = makeFunctionReference<
	"action",
	{
		reviewedSnapshotHash: string;
		reviewedSnapshotId: Id<"velocityPackageSnapshots">;
		workspaceId: Id<"velocityPackageWorkspaces">;
	},
	Promise<{
		activationAttemptId: Id<"velocityActivationAttempts">;
		mortgageId?: Id<"mortgages">;
		status: string;
	}>
>("velocity/activation:activateVelocityPackage");

const startVelocityPackageActivationRef = makeFunctionReference<
	"mutation",
	{
		actorAuthId: string;
		reviewedSnapshotHash: string;
		reviewedSnapshotId: Id<"velocityPackageSnapshots">;
		workspaceId: Id<"velocityPackageWorkspaces">;
	},
	Promise<{
		activationAttemptId: Id<"velocityActivationAttempts">;
		mortgageId?: Id<"mortgages">;
		status: string;
	}>
>("velocity/activation:startVelocityPackageActivation");

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

async function seedPdfAsset(t: ConvexTest) {
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
		).store(new Blob(["PAD"], { type: "application/pdf" }));

		return ctx.db.insert("documentAssets", {
			description: "PAD Authorization",
			fileHash: "hash-pad-authorization",
			fileRef,
			fileSize: 128,
			mimeType: "application/pdf",
			name: "PAD Authorization",
			originalFilename: "pad-authorization.pdf",
			pageCount: 1,
			source: "admin_upload",
			uploadedAt: Date.now(),
			uploadedByUserId: adminUser._id,
		});
	});
}

async function seedReadyReviewedWorkspace(t: ConvexTest) {
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

	const initial = await t.run(async (ctx) => {
		const workspace = await ctx.db.get(workspaceId);
		const snapshot = await ctx.db
			.query("velocityPackageSnapshots")
			.withIndex("by_workspace_created_at", (query) =>
				query.eq("workspaceId", workspaceId)
			)
			.first();
		if (!workspace || !snapshot) {
			throw new Error("Expected workspace and snapshot");
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

	return {
		reviewedSnapshotHash: confirmed.finalReview.reviewedSnapshotHash,
		reviewedSnapshotId: confirmed.finalReview.reviewedSnapshotId,
		workspaceId,
	};
}

async function readActivationState(t: ConvexTest) {
	return await t.run(async (ctx) => ({
		auditJournal: await ctx.db.query("auditJournal").collect(),
		attempts: await ctx.db.query("velocityActivationAttempts").collect(),
		exceptions: await ctx.db.query("velocityPackageExceptions").collect(),
		externalCollectionSchedules: await ctx.db
			.query("externalCollectionSchedules")
			.collect(),
		planEntries: await ctx.db.query("collectionPlanEntries").collect(),
		mortgages: await ctx.db.query("mortgages").collect(),
		workspace:
			(await ctx.db
				.query("velocityPackageWorkspaces")
				.collect()
				.then(
					(workspaces) =>
						workspaces.find(
							(workspace) => workspace.linkApplicationId === "LINK-1001"
						) ?? null
				)) ?? null,
	}));
}

describe("Velocity package activation", () => {
	beforeEach(() => {
		process.env.ROTESSA_API_KEY = "rotessa_test_key";
		process.env.ROTESSA_API_BASE_URL = "https://rotessa.test";
	});

	afterEach(() => {
		vi.restoreAllMocks();
		if (ORIGINAL_ROTESSA_API_KEY === undefined) {
			delete process.env.ROTESSA_API_KEY;
		} else {
			process.env.ROTESSA_API_KEY = ORIGINAL_ROTESSA_API_KEY;
		}
		if (ORIGINAL_ROTESSA_API_BASE_URL === undefined) {
			delete process.env.ROTESSA_API_BASE_URL;
		} else {
			process.env.ROTESSA_API_BASE_URL = ORIGINAL_ROTESSA_API_BASE_URL;
		}
	});

	it("maps reviewed package state into the canonical Velocity activation handoff", async () => {
		const t = createTestConvex();
		const reviewed = await seedReadyReviewedWorkspace(t);
		const started = await t.mutation(startVelocityPackageActivationRef, {
			actorAuthId: FAIRLEND_ADMIN.subject,
			reviewedSnapshotHash: reviewed.reviewedSnapshotHash,
			reviewedSnapshotId: reviewed.reviewedSnapshotId,
			workspaceId: reviewed.workspaceId,
		});
		const records = await t.run(async (ctx) => {
			const actor = await ctx.db
				.query("users")
				.withIndex("authId", (query) => query.eq("authId", FAIRLEND_ADMIN.subject))
				.unique();
			if (!actor) {
				throw new Error("Expected actor");
			}
			const brokerUserId = await ctx.db.insert("users", {
				authId: "velocity-broker",
				email: "velocity-broker@example.test",
				firstName: "Velocity",
				lastName: "Broker",
			});
			const brokerId = await ctx.db.insert("brokers", {
				createdAt: Date.now(),
				status: "active",
				userId: brokerUserId,
			});
			const borrowerUserId = await ctx.db.insert("users", {
				authId: "velocity-borrower",
				email: "borrower@example.test",
				firstName: "Borrower",
				lastName: "One",
			});
			const borrowerId = await ctx.db.insert("borrowers", {
				createdAt: Date.now(),
				status: "active",
				userId: borrowerUserId,
			});
			const bankAccountId = await ctx.db.insert("bankAccounts", {
				accountLast4: "6789",
				accountNumber: "123456789",
				country: "CA",
				createdAt: Date.now(),
				currency: "CAD",
				institutionNumber: "001",
				mandateStatus: "active",
				ownerId: String(borrowerId),
				ownerType: "borrower",
				status: "validated",
				transitNumber: "00011",
				updatedAt: Date.now(),
				validationMethod: "manual",
			});
			const workspace = await ctx.db.get(reviewed.workspaceId);
			const snapshot = await ctx.db.get(reviewed.reviewedSnapshotId);
			if (!workspace || !snapshot) {
				throw new Error("Expected workspace and snapshot");
			}
			return {
				actorUserId: actor._id,
				bankAccountId,
				borrowerId,
				brokerId,
				snapshot,
				workspace,
			};
		});

		const handoff = buildVelocityActivationHandoff({
			activationAttemptId: started.activationAttemptId,
			actorAuthId: FAIRLEND_ADMIN.subject,
			actorType: "admin",
			bankAccountId: records.bankAccountId,
			borrowerLinks: [{ borrowerId: records.borrowerId, role: "primary" }],
			brokerOfRecordId: records.brokerId,
			reviewedSnapshot: records.snapshot,
			viewerUserId: records.actorUserId,
			workspace: records.workspace,
		});

		expect(handoff).toMatchObject({
			activationAttemptId: started.activationAttemptId,
			brokerOfRecordId: records.brokerId,
			collectionsDraft: {
				activationStatus: "pending",
				mode: "provider_managed_now",
				providerCode: "pad_rotessa",
				selectedBankAccountId: records.bankAccountId,
			},
			mortgageDraft: {
				loanType: "conventional",
				lienPosition: 1,
				paymentFrequency: "monthly",
				principal: 250_000,
			},
			source: {
				creationSource: "velocity_package",
				originationPath: "velocity",
				workflowSourceKey: "velocity_package:mortgage:LINK-1001",
				workflowSourceType: "velocity_package",
			},
		});
	});

	it("starts activation attempts idempotently after reviewed readiness passes", async () => {
		const t = createTestConvex();
		const reviewed = await seedReadyReviewedWorkspace(t);

		const first = await t.mutation(startVelocityPackageActivationRef, {
			actorAuthId: FAIRLEND_ADMIN.subject,
			reviewedSnapshotHash: reviewed.reviewedSnapshotHash,
			reviewedSnapshotId: reviewed.reviewedSnapshotId,
			workspaceId: reviewed.workspaceId,
		});
		const second = await t.mutation(startVelocityPackageActivationRef, {
			actorAuthId: FAIRLEND_ADMIN.subject,
			reviewedSnapshotHash: reviewed.reviewedSnapshotHash,
			reviewedSnapshotId: reviewed.reviewedSnapshotId,
			workspaceId: reviewed.workspaceId,
		});
		const state = await t.run(async (ctx) => ({
			audits: await ctx.db.query("auditJournal").collect(),
			attempts: await ctx.db.query("velocityActivationAttempts").collect(),
			workspace: await ctx.db.get(reviewed.workspaceId),
		}));

		expect(first).toMatchObject({ status: "validating" });
		expect(second.activationAttemptId).toBe(first.activationAttemptId);
		expect(state.attempts).toHaveLength(1);
		expect(state.attempts[0]).toMatchObject({
			actorAuthId: FAIRLEND_ADMIN.subject,
			idempotencyKey: expect.stringContaining("velocity:activation:"),
			reviewedSnapshotHash: reviewed.reviewedSnapshotHash,
			status: "validating",
			workspaceId: reviewed.workspaceId,
		});
		expect(state.workspace).toMatchObject({
			state: "activating",
		});
		expect(state.audits.map((audit) => audit.eventType)).toEqual(
			expect.arrayContaining([
				"velocity_activation_attempt_started",
				"velocity_activation_stage_changed",
			])
		);
	});

	it("refuses activation when Velocity-owned core data changed after final review", async () => {
		const t = createTestConvex();
		const reviewed = await seedReadyReviewedWorkspace(t);

		await applyFullDealSync(
			t,
			makeDeal({
				mortgageRequest: {
					payment: 1300,
				},
			})
		);

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(activateVelocityPackageRef, {
				reviewedSnapshotHash: reviewed.reviewedSnapshotHash,
				reviewedSnapshotId: reviewed.reviewedSnapshotId,
				workspaceId: reviewed.workspaceId,
			})
		).rejects.toThrow(/review|hash|changed|ready/i);

		const state = await readActivationState(t);
		expect(state.attempts).toHaveLength(0);
		expect(state.mortgages).toHaveLength(0);
	});

	it("refuses activation until package-owned remediation inputs are complete", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const sync = await applyFullDealSync(t, makeDeal());
		if (!sync.workspaceId) {
			throw new Error("Expected Velocity workspace");
		}
		const snapshot = await t.run(async (ctx) =>
			ctx.db
				.query("velocityPackageSnapshots")
				.withIndex("by_workspace_created_at", (query) =>
					query.eq(
						"workspaceId",
						sync.workspaceId as Id<"velocityPackageWorkspaces">
					)
				)
				.first()
		);
		if (!snapshot) {
			throw new Error("Expected Velocity snapshot");
		}

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(activateVelocityPackageRef, {
				reviewedSnapshotHash: snapshot.normalizedCoreHash,
				reviewedSnapshotId: snapshot._id,
				workspaceId: sync.workspaceId as Id<"velocityPackageWorkspaces">,
			})
		).rejects.toThrow(/loan type|lien position|ready|final review/i);

		const state = await readActivationState(t);
		expect(state.attempts).toHaveLength(0);
		expect(state.mortgages).toHaveLength(0);
	});

	it("does not create a live mortgage when provider schedule creation fails", async () => {
		const t = createTestConvex();
		const reviewed = await seedReadyReviewedWorkspace(t);
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = new URL(String(input));
				if (url.pathname === "/customers") {
					return Response.json({
						id: 501,
						name: "Borrower One",
						email: "borrower@example.test",
						account_number: "123456789",
						authorization_type: "Online",
						bank_account_type: "Checking",
						custom_identifier: "velocity_package:LINK-1001:borrower:borrower@example.test:bank",
						institution_number: "001",
						transit_number: "00011",
					});
				}
				if (url.pathname === "/transaction_schedules") {
					return Response.json(
						{ errors: [{ detail: "Rotessa unavailable" }] },
						{ status: 503 }
					);
				}
				throw new Error(`Unexpected Rotessa path: ${url.pathname}`);
			});

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(activateVelocityPackageRef, {
				reviewedSnapshotHash: reviewed.reviewedSnapshotHash,
				reviewedSnapshotId: reviewed.reviewedSnapshotId,
				workspaceId: reviewed.workspaceId,
			})
		).rejects.toThrow(/Rotessa|503|unavailable|schedule/i);

		const state = await readActivationState(t);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(state.mortgages).toHaveLength(0);
		expect(state.externalCollectionSchedules).toHaveLength(0);
		expect(state.attempts).toHaveLength(1);
		expect(state.attempts[0]).toMatchObject({
			rotessaCustomerRef: "501",
			status: "failed",
		});
		expect(state.workspace).toMatchObject({
			state: "activation_failed_remediation",
		});
		expect(state.exceptions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "activation_exception",
					sourceActivationAttemptId: state.attempts[0]?._id,
					status: "open",
				}),
			])
		);
		expect(state.auditJournal.map((entry) => entry.eventType)).toEqual(
			expect.arrayContaining(["velocity_activation_failed"])
		);
	});

	it("retries with provider artifact reuse before creating the canonical mortgage", async () => {
		const t = createTestConvex();
		const reviewed = await seedReadyReviewedWorkspace(t);
		let scheduleAttempts = 0;
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = new URL(String(input));
				if (url.pathname === "/customers") {
					return Response.json({
						id: 501,
						name: "Borrower One",
						email: "borrower@example.test",
						account_number: "123456789",
						authorization_type: "Online",
						bank_account_type: "Checking",
						custom_identifier: "velocity_package:LINK-1001:borrower:borrower@example.test:bank",
						institution_number: "001",
						transit_number: "00011",
					});
				}
				if (url.pathname === "/transaction_schedules") {
					scheduleAttempts += 1;
					if (scheduleAttempts === 1) {
						return Response.json(
							{ errors: [{ detail: "Temporary Rotessa outage" }] },
							{ status: 503 }
						);
					}
					return Response.json({
						id: 701,
						amount: "1250.00",
						comment: "velocity_package:LINK-1001",
						frequency: "Monthly",
						installments: 12,
						next_process_date: "2026-06-01",
						process_date: "2026-06-01",
					});
				}
				throw new Error(`Unexpected Rotessa path: ${url.pathname}`);
			});

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(activateVelocityPackageRef, {
				reviewedSnapshotHash: reviewed.reviewedSnapshotHash,
				reviewedSnapshotId: reviewed.reviewedSnapshotId,
				workspaceId: reviewed.workspaceId,
			})
		).rejects.toThrow(/Rotessa|503|Temporary/i);

		const retry = await t.withIdentity(FAIRLEND_ADMIN).action(
			activateVelocityPackageRef,
			{
				reviewedSnapshotHash: reviewed.reviewedSnapshotHash,
				reviewedSnapshotId: reviewed.reviewedSnapshotId,
				workspaceId: reviewed.workspaceId,
			}
		);

		const state = await readActivationState(t);
		const customerCreates = fetchMock.mock.calls.filter(
			([input]) => new URL(String(input)).pathname === "/customers"
		);
		const scheduleCreates = fetchMock.mock.calls.filter(
			([input]) => new URL(String(input)).pathname === "/transaction_schedules"
		);
		expect(customerCreates).toHaveLength(1);
		expect(scheduleCreates).toHaveLength(2);
		expect(retry).toMatchObject({ status: "succeeded" });
		expect(state.mortgages).toHaveLength(1);
		expect(state.mortgages[0]).toMatchObject({
			collectionExecutionMode: "provider_managed",
			collectionExecutionProviderCode: "pad_rotessa",
			creationSource: "velocity_package",
			workflowSourceKey: "velocity_package:mortgage:LINK-1001",
		});
		expect(state.externalCollectionSchedules).toHaveLength(1);
		expect(state.externalCollectionSchedules[0]).toMatchObject({
			activationIdempotencyKey: expect.stringContaining("velocity:activation:"),
			externalScheduleRef: "701",
			providerCode: "pad_rotessa",
			status: "active",
		});
		expect(state.planEntries.length).toBeGreaterThan(0);
		expect(
			state.planEntries.every(
				(entry) =>
					entry.status === "provider_scheduled" &&
					entry.executionMode === "provider_managed" &&
					entry.externalCollectionScheduleId ===
						state.externalCollectionSchedules[0]?._id
			)
		).toBe(true);
		expect(state.attempts).toHaveLength(1);
		expect(state.attempts[0]).toMatchObject({
			mortgageId: state.mortgages[0]?._id,
			rotessaCustomerRef: "501",
			rotessaScheduleRef: "701",
			status: "succeeded",
		});
		expect(state.workspace).toMatchObject({
			activation: {
				activationAttemptId: state.attempts[0]?._id,
				mortgageId: state.mortgages[0]?._id,
			},
			state: "activated",
		});
		expect(state.auditJournal.map((entry) => entry.eventType)).toEqual(
			expect.arrayContaining([
				"velocity_activation_failed",
				"velocity_activation_provider_artifact_recorded",
				"velocity_activation_provider_artifact_reused",
				"velocity_activation_succeeded",
				"VELOCITY_PACKAGE_ACTIVATED",
			])
		);
	});

	it("records post-live Velocity drift without mutating the canonical mortgage", async () => {
		const t = createTestConvex();
		const reviewed = await seedReadyReviewedWorkspace(t);
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = new URL(String(input));
			if (url.pathname === "/customers") {
				return Response.json({
					id: 501,
					name: "Borrower One",
					email: "borrower@example.test",
					account_number: "123456789",
					authorization_type: "Online",
					bank_account_type: "Checking",
					custom_identifier: "velocity_package:LINK-1001:borrower:borrower@example.test:bank",
					institution_number: "001",
					transit_number: "00011",
				});
			}
			if (url.pathname === "/transaction_schedules") {
				return Response.json({
					id: 701,
					amount: "1250.00",
					comment: "velocity_package:LINK-1001",
					frequency: "Monthly",
					installments: 12,
					next_process_date: "2026-06-01",
					process_date: "2026-06-01",
				});
			}
			throw new Error(`Unexpected Rotessa path: ${url.pathname}`);
		});
		const activated = await t.withIdentity(FAIRLEND_ADMIN).action(
			activateVelocityPackageRef,
			{
				reviewedSnapshotHash: reviewed.reviewedSnapshotHash,
				reviewedSnapshotId: reviewed.reviewedSnapshotId,
				workspaceId: reviewed.workspaceId,
			}
		);
		const beforeDrift = await t.run(async (ctx) => {
			if (!activated.mortgageId) {
				throw new Error("Expected activated mortgage");
			}
			const mortgage = await ctx.db.get(activated.mortgageId);
			const workspace = await ctx.db.get(reviewed.workspaceId);
			if (!mortgage || !workspace) {
				throw new Error("Expected mortgage and workspace");
			}
			return {
				mortgagePaymentAmount: mortgage.paymentAmount,
				workspaceHash: workspace.normalizedCoreHash,
			};
		});

		const driftSync = await applyFullDealSync(
			t,
			makeDeal({
				mortgageRequest: {
					payment: 1300,
				},
			})
		);

		const afterDrift = await t.run(async (ctx) => {
			if (!activated.mortgageId) {
				throw new Error("Expected activated mortgage");
			}
			const mortgage = await ctx.db.get(activated.mortgageId);
			const workspace = await ctx.db.get(reviewed.workspaceId);
			return {
				auditTypes: (await ctx.db.query("auditJournal").collect()).map(
					(entry) => entry.eventType
				),
				exceptions: await ctx.db.query("velocityPackageExceptions").collect(),
				mortgage,
				postLiveSnapshots: (
					await ctx.db.query("velocityPackageSnapshots").collect()
				).filter((snapshot) => snapshot.snapshotType === "post_live_drift"),
				workspace,
			};
		});

		expect(driftSync).toMatchObject({ result: "exception" });
		expect(afterDrift.mortgage).toMatchObject({
			paymentAmount: beforeDrift.mortgagePaymentAmount,
		});
		expect(afterDrift.workspace).toMatchObject({
			exceptionKind: "live_drift_exception",
			normalizedCoreHash: beforeDrift.workspaceHash,
			state: "activated",
		});
		expect(afterDrift.postLiveSnapshots).toHaveLength(1);
		expect(afterDrift.exceptions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "live_drift_exception",
					status: "open",
				}),
			])
		);
		expect(afterDrift.auditTypes).toEqual(
			expect.arrayContaining(["velocity_post_live_drift_detected"])
		);
	});
});
