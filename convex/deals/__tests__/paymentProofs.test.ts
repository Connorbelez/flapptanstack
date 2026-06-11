import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDealAccessDecision } from "../../../src/lib/deals/access-policy/resolve";
import { FAIRLEND_ADMIN } from "../../../src/test/auth/identities";
import { registerAuditLogComponent } from "../../../src/test/convex/registerAuditLogComponent";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { getOrCreateCashAccount } from "../../payments/cashLedger/accounts";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";

const paymentProofsApi = anyApi.deals.paymentProofs;
const UPLOAD_FORBIDDEN_ERROR =
	/Only purchasing lender, ready primary lawyer, or admin/i;
const ATTACHMENT_SOURCE_ERROR = /payment proof upload/i;
const ATTACHMENT_OWNER_ERROR = /own uploaded payment proof/i;
const INVALID_TRANSFER_DATE_ERROR = /Transfer date/i;
const PENDING_REVIEW_CONFLICT_ERROR = /already pending review/i;
const ADMIN_REQUIRED_ERROR = /fair lend admin role required/i;
const REJECTED_APPROVAL_ERROR = /Rejected payment proofs cannot be approved/i;
const ORIGINAL_DISABLE_GT_HASHCHAIN = process.env.DISABLE_GT_HASHCHAIN;
const ORIGINAL_DISABLE_CASH_LEDGER_HASHCHAIN =
	process.env.DISABLE_CASH_LEDGER_HASHCHAIN;
const ADMIN_REVIEW_SOURCE = {
	actorId: FAIRLEND_ADMIN.subject,
	actorType: "admin" as const,
	channel: "admin_dashboard" as const,
};
const LENDER_IDENTITY = {
	subject: "lender-auth",
	issuer: "https://api.workos.com",
	org_id: "org_lender",
	role: "member",
	roles: JSON.stringify(["member"]),
	permissions: JSON.stringify(["deal:view"]),
	user_email: "lender@example.test",
	user_email_verified: true,
};

const SELLER_IDENTITY = {
	subject: "seller-auth",
	issuer: "https://api.workos.com",
	org_id: "org_seller",
	role: "member",
	roles: JSON.stringify(["member"]),
	permissions: JSON.stringify(["deal:view"]),
	user_email: "seller@example.test",
	user_email_verified: true,
};

const BROKER_IDENTITY = {
	subject: "broker-auth",
	issuer: "https://api.workos.com",
	org_id: "org_broker",
	role: "broker",
	roles: JSON.stringify(["broker"]),
	permissions: JSON.stringify(["deal:view"]),
	user_email: "broker@example.test",
	user_email_verified: true,
};
const PLATFORM_LAWYER_IDENTITY = {
	subject: "platform-lawyer-auth",
	issuer: "https://api.workos.com",
	org_id: "org_lawyer",
	role: "lawyer",
	roles: JSON.stringify(["lawyer"]),
	permissions: JSON.stringify(["deal:view"]),
	user_email: "platform-lawyer@example.test",
	user_email_verified: true,
};
const GUEST_LAWYER_IDENTITY = {
	subject: "guest-lawyer-auth",
	issuer: "https://api.workos.com",
	org_id: "org_guest_lawyer",
	role: "lawyer",
	roles: JSON.stringify(["lawyer"]),
	permissions: JSON.stringify(["deal:view"]),
	user_email: "guest-lawyer@example.test",
	user_email_verified: true,
};

function lawyerViewerFromIdentity(
	identity: typeof GUEST_LAWYER_IDENTITY | typeof PLATFORM_LAWYER_IDENTITY
) {
	return {
		authId: identity.subject,
		email: identity.user_email,
		firstName: undefined,
		isFairLendAdmin: false,
		lastName: undefined,
		orgId: identity.org_id,
		orgName: undefined,
		permissions: new Set(["deal:view"]),
		role: "lawyer",
		roles: new Set(["lawyer"]),
		verifiedEmail: identity.user_email,
	};
}

function createHarness() {
	process.env.DISABLE_GT_HASHCHAIN = "true";
	process.env.DISABLE_CASH_LEDGER_HASHCHAIN = "true";
	const t = convexTest(schema, convexModules);
	registerAuditLogComponent(t, "auditLog");
	return t;
}

function restoreEnvVar(name: string, value: string | undefined) {
	if (value === undefined) {
		delete process.env[name];
		return;
	}
	process.env[name] = value;
}

afterEach(() => {
	restoreEnvVar("DISABLE_GT_HASHCHAIN", ORIGINAL_DISABLE_GT_HASHCHAIN);
	restoreEnvVar(
		"DISABLE_CASH_LEDGER_HASHCHAIN",
		ORIGINAL_DISABLE_CASH_LEDGER_HASHCHAIN
	);
});

async function seedUser(
	t: ReturnType<typeof createHarness>,
	args: {
		authId: string;
		email: string;
		firstName?: string;
		lastName?: string;
	}
) {
	return await t.run(async (ctx) => {
		const existing = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", args.authId))
			.first();
		if (existing) {
			return existing._id;
		}
		return await ctx.db.insert("users", {
			authId: args.authId,
			email: args.email,
			firstName: args.firstName ?? "Test",
			lastName: args.lastName ?? "User",
		});
	});
}

async function seedDocumentAsset(
	t: ReturnType<typeof createHarness>,
	args: {
		uploadedByUserId: Id<"users">;
		name: string;
		source?: "admin_upload" | "external_import" | "payment_proof_upload";
		mimeType?: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
	}
) {
	return await t.run(async (ctx) => {
		const mimeType = args.mimeType ?? "application/pdf";
		const fileRef = await (
			ctx.storage as unknown as { store: (blob: Blob) => Promise<string> }
		).store(new Blob([args.name], { type: mimeType }));
		return await ctx.db.insert("documentAssets", {
			name: args.name,
			description: "Wire proof",
			originalFilename: args.name,
			mimeType,
			fileRef: fileRef as never,
			fileHash: `${args.name}-hash`,
			fileSize: 10,
			pageCount: 1,
			uploadedByUserId: args.uploadedByUserId,
			uploadedAt: 1,
			source: args.source ?? "payment_proof_upload",
		});
	});
}

async function seedFundsPendingDeal(t: ReturnType<typeof createHarness>) {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {
			authId: "lender-auth",
			email: "lender@example.test",
			firstName: "Lena",
			lastName: "Lender",
		});
		const propertyId = await ctx.db.insert("properties", {
			streetAddress: "88 Proof Ave",
			city: "Toronto",
			province: "ON",
			postalCode: "M5V 1A1",
			propertyType: "residential",
			createdAt: 1,
		});
		const brokerId = await ctx.db.insert("brokers", {
			status: "active",
			userId,
			createdAt: 1,
		});
		const lenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: 1,
			onboardingEntryPath: "test",
			status: "active",
			userId,
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			status: "funded",
			propertyId,
			principal: 500_000,
			interestRate: 9.5,
			rateType: "fixed",
			termMonths: 60,
			amortizationMonths: 300,
			paymentAmount: 2500,
			paymentFrequency: "monthly",
			loanType: "conventional",
			lienPosition: 1,
			interestAdjustmentDate: "2026-01-01",
			termStartDate: "2026-01-01",
			maturityDate: "2031-01-01",
			firstPaymentDate: "2026-02-01",
			brokerOfRecordId: brokerId,
			createdAt: 1,
		});
		const dealId = await ctx.db.insert("deals", {
			status: "fundsTransfer.pending",
			mortgageId,
			buyerId: "lender-auth",
			sellerId: "seller-auth",
			lenderId,
			fractionalShare: 2500,
			closingDate: 2,
			createdAt: 1,
			createdBy: "seed",
			purchasingLenderAuthId: "lender-auth",
			sellingLenderAuthId: "seller-auth",
		});
		await ctx.db.insert("dealAccess", {
			dealId,
			userId: "lender-auth",
			role: "lender",
			persona: "purchasing_lender",
			status: "active",
			grantedAt: 1,
			grantedBy: "seed",
		});
		const fileRef = await (
			ctx.storage as unknown as { store: (blob: Blob) => Promise<string> }
		).store(new Blob(["wire proof"], { type: "application/pdf" }));
		const assetId = await ctx.db.insert("documentAssets", {
			name: "wire-proof.pdf",
			description: "Wire proof",
			originalFilename: "wire-proof.pdf",
			mimeType: "application/pdf",
			fileRef: fileRef as never,
			fileHash: "wire-proof-hash",
			fileSize: 10,
			pageCount: 1,
			uploadedByUserId: userId,
			uploadedAt: 1,
			source: "payment_proof_upload",
		});
		return { assetId, dealId, lenderUserId: userId };
	});
}

async function seedDealClosingPayoutBalances(
	t: ReturnType<typeof createHarness>,
	dealId: Id<"deals">,
	amount: number
) {
	await t.run(async (ctx) => {
		const deal = await ctx.db.get(dealId);
		if (!deal?.lenderId) {
			throw new Error("Seeded deal must have lenderId");
		}

		const trustCashAccount = await getOrCreateCashAccount(ctx, {
			family: "TRUST_CASH",
			mortgageId: deal.mortgageId,
		});
		await ctx.db.patch(trustCashAccount._id, {
			cumulativeDebits: BigInt(amount),
		});

		const lenderPayableAccount = await getOrCreateCashAccount(ctx, {
			family: "LENDER_PAYABLE",
			mortgageId: deal.mortgageId,
			lenderId: deal.lenderId,
		});
		await ctx.db.patch(lenderPayableAccount._id, {
			cumulativeCredits: BigInt(amount),
		});
	});
}

async function grantDealAccess(
	t: ReturnType<typeof createHarness>,
	args: {
		dealId: Id<"deals">;
		userId: string;
		role: "guest_lawyer" | "lender" | "platform_lawyer" | "broker_of_record";
	}
) {
	await t.run(async (ctx) => {
		let persona: "broker_of_record" | "primary_lawyer" | "purchasing_lender";
		if (args.role === "guest_lawyer" || args.role === "platform_lawyer") {
			persona = "primary_lawyer";
		} else if (args.role === "lender") {
			persona = "purchasing_lender";
		} else {
			persona = "broker_of_record";
		}
		await ctx.db.insert("dealAccess", {
			dealId: args.dealId,
			userId: args.userId,
			role: args.role,
			persona,
			status: "active",
			grantedAt: 1,
			grantedBy: "seed",
		});
	});
}

async function seedReadyPrimaryLawyer(
	t: ReturnType<typeof createHarness>,
	args: {
		dealId: Id<"deals">;
		identity: typeof GUEST_LAWYER_IDENTITY | typeof PLATFORM_LAWYER_IDENTITY;
		role: "guest_lawyer" | "platform_lawyer";
	}
) {
	await grantDealAccess(t, {
		dealId: args.dealId,
		role: args.role,
		userId: args.identity.subject,
	});
	await t.run(async (ctx) => {
		await ctx.db.patch(args.dealId, {
			lawyerId: args.identity.subject,
			lawyerType: args.role,
		});
		await ctx.db.insert("lawyerVerifications", {
			authId: args.identity.subject,
			checkType: "manual_admin",
			createdAt: 1,
			createdBy: "seed",
			dealId: args.dealId,
			outcome: "eligible",
			provider: "manual_admin",
			reasonCodes: ["manual_override"],
			sourceSnapshot: { source: "payment_proof_test" },
		});
		await ctx.db.insert("representationEngagements", {
			createdAt: 1,
			dealId: args.dealId,
			evidenceHash: `seed:${String(args.dealId)}:${args.identity.subject}`,
			lawyerAuthId: args.identity.subject,
			provider: "manual_admin",
			signedAt: 1,
			status: "signed",
			updatedAt: 1,
		});
	});
}

function validUploadArgs(
	seeded: Awaited<ReturnType<typeof seedFundsPendingDeal>>
) {
	return {
		dealId: seeded.dealId,
		amount: 125_000,
		currency: "CAD" as const,
		transferDate: 1_777_680_000_000,
		sendingParty: "lender",
		referenceNumber: "WIRE-123",
		institutionName: "Test Bank",
		note: "Wire receipt uploaded by lender",
		attachmentIds: [seeded.assetId],
	};
}

async function readRowsAfterProofAction(
	t: ReturnType<typeof createHarness>,
	args: {
		dealId: Id<"deals">;
		proofId?: Id<"dealPaymentProofs">;
	}
) {
	return await t.run(async (ctx) => ({
		deal: await ctx.db.get(args.dealId),
		proof: args.proofId ? await ctx.db.get(args.proofId) : null,
		proofs: await ctx.db
			.query("dealPaymentProofs")
			.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
			.collect(),
		transferRequests: await ctx.db.query("transferRequests").collect(),
		fundsEvidence: await ctx.db.query("dealFundsEvidence").collect(),
		cashLedgerJournalEntries: await ctx.db
			.query("cash_ledger_journal_entries")
			.collect(),
	}));
}

async function drainScheduledFunctions(t: ReturnType<typeof createHarness>) {
	await t.finishAllScheduledFunctions(vi.runAllTimers);
}

async function cashLedgerIdsForTransfers(
	t: ReturnType<typeof createHarness>,
	transferIds: Id<"transferRequests">[]
) {
	return await t.run(async (ctx) => {
		const entries = (
			await Promise.all(
				transferIds.map((transferId) =>
					ctx.db
						.query("cash_ledger_journal_entries")
						.withIndex("by_transfer_request", (query) =>
							query.eq("transferRequestId", transferId)
						)
						.collect()
				)
			)
		).flat();
		return entries.map((entry) => entry._id);
	});
}

async function completeTransferPipelineWithoutProofApproval(
	t: ReturnType<typeof createHarness>,
	args: {
		dealId: Id<"deals">;
		proofId: Id<"dealPaymentProofs">;
	}
) {
	const seededRows = await t.run(async (ctx) => {
		const proof = await ctx.db.get(args.proofId);
		const deal = await ctx.db.get(args.dealId);
		if (!(proof && deal?.lenderId)) {
			throw new Error("Seeded proof and deal with lenderId are required");
		}
		return { deal, proof };
	});
	const pipelineId = `deal-closing:${args.dealId}`;
	const settlement = {
		instrumentType: "wire" as const,
		settlementOccurredAt: seededRows.proof.transferDate,
		externalReference: seededRows.proof.referenceNumber,
		enteredBy: FAIRLEND_ADMIN.subject,
		location: seededRows.proof.institutionName,
		evidenceAttachmentIds: seededRows.proof.attachmentIds.map(String),
	};

	const leg1 = await t.action(
		internal.payments.transfers.pipeline.createDealClosingPipeline,
		{
			dealId: args.dealId,
			pipelineId,
			buyerId: seededRows.deal.buyerId,
			sellerId: seededRows.deal.sellerId,
			lenderId: seededRows.deal.lenderId,
			mortgageId: seededRows.deal.mortgageId,
			leg1Amount: seededRows.proof.amount,
			leg2Amount: seededRows.proof.amount,
			providerCode: "manual_review",
		}
	);
	await t.mutation(
		internal.payments.transfers.mutations.confirmManualTransferInternal,
		{
			transferId: leg1.leg1TransferId,
			providerRef: `payment-proof:${args.proofId}:${leg1.leg1TransferId}`,
			manualSettlement: settlement,
			source: ADMIN_REVIEW_SOURCE,
		}
	);
	const leg2 = await t.action(
		internal.payments.transfers.pipeline.createAndInitiateLeg2,
		{
			pipelineId,
			dealId: args.dealId,
			sellerId: seededRows.deal.sellerId,
			lenderId: seededRows.deal.lenderId,
			mortgageId: seededRows.deal.mortgageId,
			leg2Amount: seededRows.proof.amount,
			providerCode: "manual_review",
		}
	);
	await t.mutation(
		internal.payments.transfers.mutations.confirmManualTransferInternal,
		{
			transferId: leg2.leg2TransferId,
			providerRef: `payment-proof:${args.proofId}:${leg2.leg2TransferId}`,
			manualSettlement: settlement,
			source: ADMIN_REVIEW_SOURCE,
		}
	);

	return {
		pipelineId,
		leg1TransferId: leg1.leg1TransferId,
		leg2TransferId: leg2.leg2TransferId,
	};
}

function expectNoFundsSideEffects(
	rows: Awaited<ReturnType<typeof readRowsAfterProofAction>>
) {
	expect(rows.deal?.status).toBe("fundsTransfer.pending");
	expect(rows.transferRequests).toHaveLength(0);
	expect(rows.fundsEvidence).toHaveLength(0);
	expect(rows.cashLedgerJournalEntries).toHaveLength(0);
}

describe("deal payment proof schema", () => {
	it("lets ready lawyers create payment proof upload assets without document upload admin permissions", async () => {
		const t = createHarness();
		const seeded = await seedFundsPendingDeal(t);
		await seedReadyPrimaryLawyer(t, {
			dealId: seeded.dealId,
			identity: GUEST_LAWYER_IDENTITY,
			role: "guest_lawyer",
		});
		await seedUser(t, {
			authId: GUEST_LAWYER_IDENTITY.subject,
			email: GUEST_LAWYER_IDENTITY.user_email,
		});
		const fileRef = await t.run(async (ctx) => {
			const stored = await (
				ctx.storage as unknown as { store: (blob: Blob) => Promise<string> }
			).store(
				new Blob(["guest lawyer wire proof"], { type: "application/pdf" })
			);
			return stored as Id<"_storage">;
		});

		const uploadUrl = await t
			.withIdentity(GUEST_LAWYER_IDENTITY)
			.mutation(paymentProofsApi.generatePaymentProofUploadUrl, {
				dealId: seeded.dealId,
			});
		const created = await t
			.withIdentity(GUEST_LAWYER_IDENTITY)
			.mutation(paymentProofsApi.createPaymentProofAsset, {
				dealId: seeded.dealId,
				fileHash: "guest-lawyer-wire-proof-hash",
				fileRef,
				fileSize: 23,
				mimeType: "application/pdf",
				name: "Guest lawyer wire proof",
				originalFilename: "guest-lawyer-wire-proof.pdf",
			});

		expect(uploadUrl.uploadUrl).toEqual(expect.any(String));
		const asset = await t.run((ctx) => ctx.db.get(created.assetId));
		expect(asset).toMatchObject({
			fileHash: "guest-lawyer-wire-proof-hash",
			source: "payment_proof_upload",
			uploadedByUserId: expect.any(String),
		});
	});

	it("blocks non-upload personas from creating payment proof upload assets", async () => {
		const t = createHarness();
		const seeded = await seedFundsPendingDeal(t);
		await grantDealAccess(t, {
			dealId: seeded.dealId,
			role: "broker_of_record",
			userId: BROKER_IDENTITY.subject,
		});

		await expect(
			t
				.withIdentity(BROKER_IDENTITY)
				.mutation(paymentProofsApi.generatePaymentProofUploadUrl, {
					dealId: seeded.dealId,
				})
		).rejects.toThrow(UPLOAD_FORBIDDEN_ERROR);
	});

	it("creates a pending proof without advancing the deal", async () => {
		const t = createHarness();
		const seeded = await seedFundsPendingDeal(t);

		const result = await t
			.withIdentity(LENDER_IDENTITY)
			.mutation(
				paymentProofsApi.uploadManualPaymentProof,
				validUploadArgs(seeded)
			);

		const rows = await readRowsAfterProofAction(t, {
			dealId: seeded.dealId,
			proofId: result.proofId,
		});
		expect(rows.deal?.status).toBe("fundsTransfer.pending");
		expect(rows.proof).toMatchObject({
			status: "pending_review",
			submittedBy: "lender-auth",
			submittedByPersona: "purchasing_lender",
			submittedByRole: "purchasing_lender",
			amount: 125_000,
			currency: "CAD",
		});
		expectNoFundsSideEffects(rows);
	});

	it("blocks broker and seller uploads", async () => {
		const t = createHarness();
		const seeded = await seedFundsPendingDeal(t);

		await t.run(async (ctx) => {
			await ctx.db.insert("dealAccess", {
				dealId: seeded.dealId,
				userId: "broker-auth",
				role: "broker_of_record",
				status: "active",
				grantedAt: 1,
				grantedBy: "seed",
			});
		});

		await expect(
			t
				.withIdentity(BROKER_IDENTITY)
				.mutation(
					paymentProofsApi.uploadManualPaymentProof,
					validUploadArgs(seeded)
				)
		).rejects.toThrow(UPLOAD_FORBIDDEN_ERROR);
		await expect(
			t
				.withIdentity(SELLER_IDENTITY)
				.mutation(
					paymentProofsApi.uploadManualPaymentProof,
					validUploadArgs(seeded)
				)
		).rejects.toThrow(UPLOAD_FORBIDDEN_ERROR);
	});

	it("rejects proof and keeps deal in fundsTransfer.pending", async () => {
		const t = createHarness();
		const seeded = await seedFundsPendingDeal(t);

		const result = await t
			.withIdentity(LENDER_IDENTITY)
			.mutation(
				paymentProofsApi.uploadManualPaymentProof,
				validUploadArgs(seeded)
			);

		await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(paymentProofsApi.rejectManualPaymentProof, {
				proofId: result.proofId,
				reason: "Uploaded receipt does not match expected transfer amount.",
			});

		const rows = await readRowsAfterProofAction(t, {
			dealId: seeded.dealId,
			proofId: result.proofId,
		});
		expect(rows.deal?.status).toBe("fundsTransfer.pending");
		expect(rows.proof).toMatchObject({
			status: "rejected",
			reviewedBy: FAIRLEND_ADMIN.subject,
			reviewReason: "Uploaded receipt does not match expected transfer amount.",
		});
		expectNoFundsSideEffects(rows);
	});

	it("approves a manual payment proof through transfer rails, cash ledger, and deal confirmation", async () => {
		vi.useFakeTimers();
		const t = createHarness();
		const seeded = await seedFundsPendingDeal(t);

		try {
			const uploaded = await t
				.withIdentity(LENDER_IDENTITY)
				.mutation(
					paymentProofsApi.uploadManualPaymentProof,
					validUploadArgs(seeded)
				);
			await seedDealClosingPayoutBalances(t, seeded.dealId, 125_000);

			const approved = await t
				.withIdentity(FAIRLEND_ADMIN)
				.action(paymentProofsApi.approveManualPaymentProof, {
					proofId: uploaded.proofId,
					reviewNote: "Wire proof matches the expected manual transfer.",
				});

			await drainScheduledFunctions(t);

			const rows = await readRowsAfterProofAction(t, {
				dealId: seeded.dealId,
				proofId: uploaded.proofId,
			});
			const transferTypes = rows.transferRequests.map(
				(transfer) => transfer.transferType
			);

			expect(rows.deal?.status).toBe("confirmed");
			expect(rows.proof).toMatchObject({
				status: "approved",
				reviewedBy: FAIRLEND_ADMIN.subject,
				reviewReason: "Wire proof matches the expected manual transfer.",
				leg1TransferId: approved.leg1TransferId,
				leg2TransferId: approved.leg2TransferId,
				fundsEvidenceId: approved.fundsEvidenceId,
			});
			expect(approved.proofId).toBe(uploaded.proofId);
			expect(approved.leg1TransferId).toBeDefined();
			expect(approved.leg2TransferId).toBeDefined();
			expect(approved.cashLedgerJournalEntryIds.length).toBeGreaterThan(0);
			expect(approved.fundsEvidenceId).toBeDefined();
			expect(rows.proof?.cashLedgerJournalEntryIds?.length).toBeGreaterThan(0);
			expect(transferTypes).toEqual(
				expect.arrayContaining([
					"deal_principal_transfer",
					"deal_seller_payout",
				])
			);
			expect(
				rows.transferRequests.filter(
					(transfer) => transfer.transferType === "deal_principal_transfer"
				)
			).toHaveLength(1);
			expect(
				rows.transferRequests.filter(
					(transfer) => transfer.transferType === "deal_seller_payout"
				)
			).toHaveLength(1);
			expect(
				rows.cashLedgerJournalEntries.filter(
					(entry) => entry.dealId === seeded.dealId
				).length
			).toBeGreaterThan(0);
			expect(rows.fundsEvidence).toHaveLength(1);
			expect(rows.fundsEvidence[0]?._id).toBe(approved.fundsEvidenceId);
		} finally {
			vi.useRealTimers();
		}
	});

	it("returns existing transfer and ledger links when approving an already-approved proof", async () => {
		vi.useFakeTimers();
		const t = createHarness();
		const seeded = await seedFundsPendingDeal(t);

		try {
			const uploaded = await t
				.withIdentity(LENDER_IDENTITY)
				.mutation(
					paymentProofsApi.uploadManualPaymentProof,
					validUploadArgs(seeded)
				);
			await seedDealClosingPayoutBalances(t, seeded.dealId, 125_000);

			const first = await t
				.withIdentity(FAIRLEND_ADMIN)
				.action(paymentProofsApi.approveManualPaymentProof, {
					proofId: uploaded.proofId,
					reviewNote: "Wire proof matches the expected manual transfer.",
				});
			await drainScheduledFunctions(t);
			const beforeSecondApproval = await readRowsAfterProofAction(t, {
				dealId: seeded.dealId,
				proofId: uploaded.proofId,
			});

			const second = await t
				.withIdentity(FAIRLEND_ADMIN)
				.action(paymentProofsApi.approveManualPaymentProof, {
					proofId: uploaded.proofId,
					reviewNote: "Second click should be idempotent.",
				});
			await drainScheduledFunctions(t);
			const afterSecondApproval = await readRowsAfterProofAction(t, {
				dealId: seeded.dealId,
				proofId: uploaded.proofId,
			});

			expect(second).toEqual(first);
			expect(afterSecondApproval.transferRequests).toHaveLength(
				beforeSecondApproval.transferRequests.length
			);
			expect(afterSecondApproval.cashLedgerJournalEntries).toHaveLength(
				beforeSecondApproval.cashLedgerJournalEntries.length
			);
			expect(afterSecondApproval.fundsEvidence).toHaveLength(
				beforeSecondApproval.fundsEvidence.length
			);
			expect(afterSecondApproval.proof?.reviewReason).toBe(
				"Wire proof matches the expected manual transfer."
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it("recovers a pending proof after transfer effects already confirmed the deal", async () => {
		vi.useFakeTimers();
		const t = createHarness();
		const seeded = await seedFundsPendingDeal(t);

		try {
			const uploaded = await t
				.withIdentity(LENDER_IDENTITY)
				.mutation(
					paymentProofsApi.uploadManualPaymentProof,
					validUploadArgs(seeded)
				);
			await seedDealClosingPayoutBalances(t, seeded.dealId, 125_000);

			const completed = await completeTransferPipelineWithoutProofApproval(t, {
				dealId: seeded.dealId,
				proofId: uploaded.proofId,
			});
			await drainScheduledFunctions(t);

			const beforeRecovery = await readRowsAfterProofAction(t, {
				dealId: seeded.dealId,
				proofId: uploaded.proofId,
			});
			expect(beforeRecovery.deal?.status).toBe("confirmed");
			expect(beforeRecovery.proof?.status).toBe("pending_review");

			const recovered = await t
				.withIdentity(FAIRLEND_ADMIN)
				.action(paymentProofsApi.approveManualPaymentProof, {
					proofId: uploaded.proofId,
					reviewNote: "Recover approval after transfer pipeline completed.",
				});

			const rows = await readRowsAfterProofAction(t, {
				dealId: seeded.dealId,
				proofId: uploaded.proofId,
			});
			expect(recovered.leg1TransferId).toBe(completed.leg1TransferId);
			expect(recovered.leg2TransferId).toBe(completed.leg2TransferId);
			expect(rows.proof?.status).toBe("approved");
			expect(rows.proof?.fundsEvidenceId).toBeDefined();
			expect(rows.transferRequests).toHaveLength(2);
			expect(rows.fundsEvidence).toHaveLength(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("repairs an approved proof whose scheduled deal close did not run", async () => {
		vi.useFakeTimers();
		const t = createHarness();
		const seeded = await seedFundsPendingDeal(t);

		try {
			const uploaded = await t
				.withIdentity(LENDER_IDENTITY)
				.mutation(
					paymentProofsApi.uploadManualPaymentProof,
					validUploadArgs(seeded)
				);
			await seedDealClosingPayoutBalances(t, seeded.dealId, 125_000);

			const completed = await completeTransferPipelineWithoutProofApproval(t, {
				dealId: seeded.dealId,
				proofId: uploaded.proofId,
			});
			const evidence = await t.mutation(
				internal.deals.closeEvidence.recordFundsReceiptInternal,
				{
					dealId: seeded.dealId,
					source: {
						kind: "transfer_pipeline",
						pipelineId: completed.pipelineId,
						leg2TransferId: completed.leg2TransferId,
						providerCode: "manual_review",
					},
					recordedBy: FAIRLEND_ADMIN.subject,
				}
			);
			const cashLedgerJournalEntryIds = await cashLedgerIdsForTransfers(t, [
				completed.leg1TransferId,
				completed.leg2TransferId,
			]);
			await t.run(async (ctx) => {
				await ctx.db.patch(uploaded.proofId, {
					status: "approved",
					reviewedBy: FAIRLEND_ADMIN.subject,
					reviewedAt: Date.now(),
					reviewReason: "Simulated approval before scheduled close.",
					leg1TransferId: completed.leg1TransferId,
					leg2TransferId: completed.leg2TransferId,
					cashLedgerJournalEntryIds,
					fundsEvidenceId: evidence.evidenceId ?? undefined,
					updatedAt: Date.now(),
				});
			});

			const beforeRetry = await readRowsAfterProofAction(t, {
				dealId: seeded.dealId,
				proofId: uploaded.proofId,
			});
			expect(beforeRetry.deal?.status).toBe("fundsTransfer.pending");
			expect(beforeRetry.proof?.status).toBe("approved");

			const repaired = await t
				.withIdentity(FAIRLEND_ADMIN)
				.action(paymentProofsApi.approveManualPaymentProof, {
					proofId: uploaded.proofId,
					reviewNote: "Repair scheduled close.",
				});

			const rows = await readRowsAfterProofAction(t, {
				dealId: seeded.dealId,
				proofId: uploaded.proofId,
			});
			expect(repaired.proofId).toBe(uploaded.proofId);
			expect(rows.deal?.status).toBe("confirmed");
			expect(rows.transferRequests).toHaveLength(2);
			expect(rows.fundsEvidence).toHaveLength(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("blocks approval of rejected payment proof", async () => {
		const t = createHarness();
		const seeded = await seedFundsPendingDeal(t);

		const uploaded = await t
			.withIdentity(LENDER_IDENTITY)
			.mutation(
				paymentProofsApi.uploadManualPaymentProof,
				validUploadArgs(seeded)
			);

		await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(paymentProofsApi.rejectManualPaymentProof, {
				proofId: uploaded.proofId,
				reason: "Uploaded receipt does not match expected transfer amount.",
			});

		await expect(
			t
				.withIdentity(FAIRLEND_ADMIN)
				.action(paymentProofsApi.approveManualPaymentProof, {
					proofId: uploaded.proofId,
					reviewNote: "Should not approve rejected proof.",
				})
		).rejects.toThrow(REJECTED_APPROVAL_ERROR);
	});

	it("allows platform lawyer, guest lawyer, and admin uploads", async () => {
		const t = createHarness();
		const platformSeeded = await seedFundsPendingDeal(t);
		await seedReadyPrimaryLawyer(t, {
			dealId: platformSeeded.dealId,
			identity: PLATFORM_LAWYER_IDENTITY,
			role: "platform_lawyer",
		});
		const platformLawyerUserId = await seedUser(t, {
			authId: PLATFORM_LAWYER_IDENTITY.subject,
			email: PLATFORM_LAWYER_IDENTITY.user_email,
		});
		const platformLawyerAssetId = await seedDocumentAsset(t, {
			uploadedByUserId: platformLawyerUserId,
			name: "platform-lawyer-proof.pdf",
		});
		const platformSeed = await t.run(async (ctx) => ({
			access: await ctx.db
				.query("dealAccess")
				.withIndex("by_user_and_deal", (query) =>
					query
						.eq("userId", PLATFORM_LAWYER_IDENTITY.subject)
						.eq("dealId", platformSeeded.dealId)
				)
				.collect(),
			deal: await ctx.db.get(platformSeeded.dealId),
		}));
		expect(platformSeed.deal).toMatchObject({
			lawyerId: PLATFORM_LAWYER_IDENTITY.subject,
			lawyerType: "platform_lawyer",
		});
		expect(platformSeed.access).toEqual([
			expect.objectContaining({
				persona: "primary_lawyer",
				role: "platform_lawyer",
				status: "active",
			}),
		]);
		const platformDecision = await t.run((ctx) =>
			resolveDealAccessDecision(ctx, {
				dealId: platformSeeded.dealId,
				intent: "deal.payment_proof.upload",
				viewer: lawyerViewerFromIdentity(PLATFORM_LAWYER_IDENTITY),
			})
		);
		expect(platformDecision).toMatchObject({
			allowed: true,
			persona: "primary_lawyer",
			readiness: "active",
		});
		const platformResult = await t
			.withIdentity(PLATFORM_LAWYER_IDENTITY)
			.mutation(paymentProofsApi.uploadManualPaymentProof, {
				...validUploadArgs(platformSeeded),
				attachmentIds: [platformLawyerAssetId],
			});

		const guestSeeded = await seedFundsPendingDeal(t);
		await seedReadyPrimaryLawyer(t, {
			dealId: guestSeeded.dealId,
			identity: GUEST_LAWYER_IDENTITY,
			role: "guest_lawyer",
		});
		const guestLawyerUserId = await seedUser(t, {
			authId: GUEST_LAWYER_IDENTITY.subject,
			email: GUEST_LAWYER_IDENTITY.user_email,
		});
		const guestLawyerAssetId = await seedDocumentAsset(t, {
			uploadedByUserId: guestLawyerUserId,
			name: "guest-lawyer-proof.pdf",
		});
		const guestDecision = await t.run((ctx) =>
			resolveDealAccessDecision(ctx, {
				dealId: guestSeeded.dealId,
				intent: "deal.payment_proof.upload",
				viewer: lawyerViewerFromIdentity(GUEST_LAWYER_IDENTITY),
			})
		);
		expect(guestDecision).toMatchObject({
			allowed: true,
			persona: "primary_lawyer",
			readiness: "active",
		});
		const guestResult = await t
			.withIdentity(GUEST_LAWYER_IDENTITY)
			.mutation(paymentProofsApi.uploadManualPaymentProof, {
				...validUploadArgs(guestSeeded),
				attachmentIds: [guestLawyerAssetId],
			});

		const adminSeeded = await seedFundsPendingDeal(t);
		const adminResult = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(
				paymentProofsApi.uploadManualPaymentProof,
				validUploadArgs(adminSeeded)
			);

		const rows = await t.run(async (ctx) => ({
			platformProof: await ctx.db.get(platformResult.proofId),
			guestProof: await ctx.db.get(guestResult.proofId),
			adminProof: await ctx.db.get(adminResult.proofId),
		}));
		expect(rows.platformProof).toMatchObject({
			submittedByPersona: "primary_lawyer",
			submittedByRole: "primary_lawyer",
		});
		expect(rows.guestProof).toMatchObject({
			submittedByPersona: "primary_lawyer",
			submittedByRole: "primary_lawyer",
		});
		expect(rows.adminProof).toMatchObject({
			submittedByPersona: "fairlend_admin",
			submittedByRole: "fairlend_admin",
		});
	});

	it("rejects attachments that are not payment proof uploads", async () => {
		const t = createHarness();
		const seeded = await seedFundsPendingDeal(t);
		const adminAssetId = await seedDocumentAsset(t, {
			uploadedByUserId: seeded.lenderUserId,
			name: "admin-upload-proof.pdf",
			source: "admin_upload",
		});

		await expect(
			t
				.withIdentity(LENDER_IDENTITY)
				.mutation(paymentProofsApi.uploadManualPaymentProof, {
					...validUploadArgs(seeded),
					attachmentIds: [adminAssetId],
				})
		).rejects.toThrow(ATTACHMENT_SOURCE_ERROR);
	});

	it("rejects non-admin attachments uploaded by another user", async () => {
		const t = createHarness();
		const seeded = await seedFundsPendingDeal(t);
		const otherUserId = await seedUser(t, {
			authId: "other-uploader-auth",
			email: "other-uploader@example.test",
		});
		const otherAssetId = await seedDocumentAsset(t, {
			uploadedByUserId: otherUserId,
			name: "other-uploader-proof.pdf",
		});

		await expect(
			t
				.withIdentity(LENDER_IDENTITY)
				.mutation(paymentProofsApi.uploadManualPaymentProof, {
					...validUploadArgs(seeded),
					attachmentIds: [otherAssetId],
				})
		).rejects.toThrow(ATTACHMENT_OWNER_ERROR);
	});

	it("rejects invalid transfer dates", async () => {
		const t = createHarness();
		const seeded = await seedFundsPendingDeal(t);

		for (const transferDate of [
			0,
			-1,
			1_777_680_000_000.5,
			Date.UTC(1999, 11, 31),
			Date.now() + 8 * 24 * 60 * 60 * 1000,
		]) {
			await expect(
				t
					.withIdentity(LENDER_IDENTITY)
					.mutation(paymentProofsApi.uploadManualPaymentProof, {
						...validUploadArgs(seeded),
						transferDate,
					})
			).rejects.toThrow(INVALID_TRANSFER_DATE_ERROR);
		}
	});

	it("returns the same pending proof for identical double-submit", async () => {
		const t = createHarness();
		const seeded = await seedFundsPendingDeal(t);
		const args = validUploadArgs(seeded);

		const first = await t
			.withIdentity(LENDER_IDENTITY)
			.mutation(paymentProofsApi.uploadManualPaymentProof, args);
		const second = await t
			.withIdentity(LENDER_IDENTITY)
			.mutation(paymentProofsApi.uploadManualPaymentProof, args);

		const rows = await readRowsAfterProofAction(t, {
			dealId: seeded.dealId,
			proofId: first.proofId,
		});
		expect(second.proofId).toBe(first.proofId);
		expect(rows.proofs).toHaveLength(1);
		expectNoFundsSideEffects(rows);
	});

	it("blocks conflicting pending proof submissions for the same deal", async () => {
		const t = createHarness();
		const seeded = await seedFundsPendingDeal(t);
		const args = validUploadArgs(seeded);

		const first = await t
			.withIdentity(LENDER_IDENTITY)
			.mutation(paymentProofsApi.uploadManualPaymentProof, args);

		await expect(
			t
				.withIdentity(LENDER_IDENTITY)
				.mutation(paymentProofsApi.uploadManualPaymentProof, {
					...args,
					referenceNumber: "WIRE-DIFFERENT",
				})
		).rejects.toThrow(PENDING_REVIEW_CONFLICT_ERROR);

		const rows = await readRowsAfterProofAction(t, {
			dealId: seeded.dealId,
			proofId: first.proofId,
		});
		expect(rows.proofs).toHaveLength(1);
		expect(rows.proofs[0]?._id).toBe(first.proofId);
		expectNoFundsSideEffects(rows);
	});

	it("blocks non-admin proof rejection", async () => {
		const t = createHarness();
		const seeded = await seedFundsPendingDeal(t);

		const result = await t
			.withIdentity(LENDER_IDENTITY)
			.mutation(
				paymentProofsApi.uploadManualPaymentProof,
				validUploadArgs(seeded)
			);

		await expect(
			t
				.withIdentity(LENDER_IDENTITY)
				.mutation(paymentProofsApi.rejectManualPaymentProof, {
					proofId: result.proofId,
					reason: "No",
				})
		).rejects.toThrow(ADMIN_REQUIRED_ERROR);
	});
});
