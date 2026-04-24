import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { FAIRLEND_STAFF_ORG_ID } from "../../constants";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";
import {
	projectFundsSourceForAdmin,
	projectFundsSourceForParticipant,
} from "../closeEvidence";

const modules = convexModules;

const ADMIN_IDENTITY = {
	subject: "admin-auth",
	issuer: "https://api.workos.com",
	org_id: FAIRLEND_STAFF_ORG_ID,
	organization_name: "FairLend Staff",
	role: "admin",
	roles: JSON.stringify(["admin"]),
	permissions: JSON.stringify(["admin:access"]),
	user_email: "admin@test.fairlend.ca",
	user_first_name: "Admin",
	user_last_name: "User",
};

async function seedDeal(t: ReturnType<typeof convexTest>) {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {
			authId: "seed-admin",
			email: "admin@test.fairlend.ca",
			firstName: "Admin",
			lastName: "User",
		});
		const propertyId = await ctx.db.insert("properties", {
			streetAddress: "123 Close St",
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
			buyerId: "buyer-auth",
			sellerId: "seller-auth",
			fractionalShare: 2500,
			closingDate: 2,
			createdAt: 1,
			createdBy: "seed-admin",
		});
		return { dealId, mortgageId, userId };
	});
}

async function seedConfirmedLeg2(
	t: ReturnType<typeof convexTest>,
	args: { dealId: Id<"deals">; mortgageId: Id<"mortgages"> }
) {
	return t.run(async (ctx) =>
		ctx.db.insert("transferRequests", {
			status: "confirmed",
			direction: "outbound",
			transferType: "deal_seller_payout",
			amount: 100_000,
			currency: "CAD",
			counterpartyType: "investor",
			counterpartyId: "seller-auth",
			providerCode: "manual",
			idempotencyKey: `pipeline:deal-closing:${args.dealId}:leg2`,
			source: { channel: "scheduler", actorType: "system" },
			createdAt: 1,
			lastTransitionAt: 1,
			mortgageId: args.mortgageId,
			dealId: args.dealId,
			confirmedAt: 2,
			settledAt: 2,
			pipelineId: `deal-closing:${args.dealId}`,
			legNumber: 2,
		})
	);
}

async function seedLeg2WithStatus(
	t: ReturnType<typeof convexTest>,
	args: {
		dealId: Id<"deals">;
		mortgageId: Id<"mortgages">;
		status: "cancelled" | "failed" | "pending";
	}
) {
	return t.run(async (ctx) =>
		ctx.db.insert("transferRequests", {
			status: args.status,
			direction: "outbound",
			transferType: "deal_seller_payout",
			amount: 100_000,
			currency: "CAD",
			counterpartyType: "investor",
			counterpartyId: "seller-auth",
			providerCode: "manual",
			idempotencyKey: `pipeline:deal-closing:${args.dealId}:leg2:${args.status}`,
			source: { channel: "scheduler", actorType: "system" },
			createdAt: 1,
			lastTransitionAt: 1,
			mortgageId: args.mortgageId,
			dealId: args.dealId,
			pipelineId: `deal-closing:${args.dealId}`,
			legNumber: 2,
		})
	);
}

async function seedCompletedEnvelopeArchive(
	t: ReturnType<typeof convexTest>,
	args: {
		dealId: Id<"deals">;
		mortgageId: Id<"mortgages">;
		userId: Id<"users">;
	}
) {
	return t.run(async (ctx) => {
		const storageId = await (
			ctx.storage as unknown as {
				store: (blob: Blob) => Promise<Id<"_storage">>;
			}
		).store(new Blob(["signed pdf"]));
		const basePdfId = await ctx.db.insert("documentBasePdfs", {
			name: "close-base.pdf",
			fileRef: storageId,
			fileHash: "close-base-hash",
			fileSize: 128,
			pageCount: 1,
			pageDimensions: [{ page: 1, width: 612, height: 792 }],
			uploadedAt: 1,
		});
		const templateId = await ctx.db.insert("documentTemplates", {
			name: "Close Package",
			basePdfId,
			basePdfHash: "close-base-hash",
			draft: { fields: [], signatories: [] },
			hasDraftChanges: false,
			createdAt: 1,
			updatedAt: 1,
		});
		const assetId = await ctx.db.insert("documentAssets", {
			name: "Signed Close Package",
			originalFilename: "signed-close-package.pdf",
			mimeType: "application/pdf",
			fileRef: storageId,
			fileHash: "signed-close-package",
			fileSize: 128,
			uploadedByUserId: args.userId,
			uploadedAt: 1,
			source: "signature_archive",
		});
		const packageId = await ctx.db.insert("dealDocumentPackages", {
			dealId: args.dealId,
			mortgageId: args.mortgageId,
			status: "ready",
			retryCount: 0,
			createdAt: 1,
			updatedAt: 1,
			readyAt: 1,
		});
		const generatedDocumentId = await ctx.db.insert("generatedDocuments", {
			name: "Signed Close Package",
			templateId,
			templateVersionUsed: 1,
			pdfStorageId: storageId,
			entityType: "deal",
			entityId: args.dealId,
			sensitivityTier: "sensitive",
			signingStatus: "completed",
			generatedBy: "documenso",
			generatedAt: 1,
			updatedAt: 1,
		});
		const dealDocumentInstanceId = await ctx.db.insert(
			"dealDocumentInstances",
			{
				packageId,
				dealId: args.dealId,
				mortgageId: args.mortgageId,
				sourceBlueprintSnapshot: {
					class: "private_templated_signable",
					displayName: "Close Package",
					displayOrder: 1,
				},
				kind: "generated",
				status: "signed",
				assetId,
				generatedDocumentId,
				createdAt: 1,
				updatedAt: 1,
			}
		);
		const attemptId = await ctx.db.insert("dealEnvelopeAttempts", {
			dealId: args.dealId,
			packageId,
			dealDocumentInstanceId,
			generatedDocumentId,
			provider: "documenso",
			providerDocumentId: "doc_123",
			providerEnvelopeId: "env_123",
			attemptNumber: 1,
			status: "completed",
			recipientRoster: [],
			active: true,
			idempotencyKey: `deal:${args.dealId}:attempt:1`,
			createdAt: 1,
			updatedAt: 2,
		});
		return { assetId, attemptId, storageId };
	});
}

describe("close evidence helpers", () => {
	it("records manual funds evidence and keeps participant projection safe", async () => {
		const t = convexTest(schema, modules);
		const { dealId } = await seedDeal(t);

		const result = await t.mutation(
			internal.deals.closeEvidence.recordFundsReceiptInternal,
			{
				dealId,
				source: {
					kind: "manual_admin",
					confirmedBy: "admin-auth",
					evidenceNote: "  Wire confirmed by trust account statement  ",
					receivedAt: 10,
				},
				recordedBy: "admin-auth",
				journalEntryId: "journal-1",
			}
		);

		expect(result.status).toBe("recorded");
		const rows = await t.run((ctx) =>
			ctx.db
				.query("dealFundsEvidence")
				.withIndex("by_deal", (query) => query.eq("dealId", dealId))
				.collect()
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].manualEvidenceNote).toBe(
			"Wire confirmed by trust account statement"
		);

		expect(
			projectFundsSourceForAdmin({
				source: rows[0].source,
				receivedAt: rows[0].receivedAt,
				recordedAt: rows[0].recordedAt,
			})
		).toMatchObject({
			evidenceNote: "Wire confirmed by trust account statement",
		});
		expect(
			projectFundsSourceForParticipant({
				source: rows[0].source,
				receivedAt: rows[0].receivedAt,
				recordedAt: rows[0].recordedAt,
			})
		).not.toHaveProperty("evidenceNote");
	});

	it("records provider evidence only for confirmed leg 2 seller payout", async () => {
		const t = convexTest(schema, modules);
		const { dealId, mortgageId } = await seedDeal(t);
		const leg2TransferId = await seedConfirmedLeg2(t, { dealId, mortgageId });

		const result = await t.mutation(
			internal.deals.closeEvidence.recordFundsReceiptInternal,
			{
				dealId,
				source: {
					kind: "transfer_pipeline",
					pipelineId: `deal-closing:${dealId}`,
					leg2TransferId,
					providerCode: "manual",
				},
				recordedBy: "system",
				journalEntryId: "journal-2",
			}
		);

		expect(result.status).toBe("recorded");
		const replay = await t.mutation(
			internal.deals.closeEvidence.recordFundsReceiptInternal,
			{
				dealId,
				source: {
					kind: "transfer_pipeline",
					pipelineId: `deal-closing:${dealId}`,
					leg2TransferId,
					providerCode: "manual",
				},
				recordedBy: "system",
				journalEntryId: "journal-2-replay",
			}
		);
		expect(replay.status).toBe("replayed");
	});

	it("records missing and invalid provider evidence as visible close exceptions", async () => {
		const t = convexTest(schema, modules);
		const { dealId, mortgageId } = await seedDeal(t);

		await t.action(
			internal.engine.effects.dealClosingEffects.confirmFundsReceipt,
			{
				effectName: "confirmFundsReceipt",
				entityId: dealId,
				entityType: "deal",
				eventType: "FUNDS_RECEIVED",
				journalEntryId: "journal-missing",
				source: { channel: "scheduler", actorType: "system" },
			}
		);
		let outcome = await t.run((ctx) =>
			ctx.db
				.query("dealCloseEffectOutcomes")
				.withIndex("by_deal_effect", (query) =>
					query.eq("dealId", dealId).eq("effectName", "funds_confirmation")
				)
				.unique()
		);
		expect(outcome).toMatchObject({
			status: "blocked",
			exceptionKind: "missing_funds_evidence",
		});

		const cancelledTransferId = await seedLeg2WithStatus(t, {
			dealId,
			mortgageId,
			status: "cancelled",
		});
		await t.action(
			internal.engine.effects.dealClosingEffects.confirmFundsReceipt,
			{
				effectName: "confirmFundsReceipt",
				entityId: dealId,
				entityType: "deal",
				eventType: "FUNDS_RECEIVED",
				journalEntryId: "journal-cancelled",
				payload: {
					fundsReceiptSource: {
						kind: "transfer_pipeline",
						pipelineId: `deal-closing:${dealId}`,
						leg2TransferId: cancelledTransferId,
						providerCode: "manual",
					},
				},
				source: { channel: "scheduler", actorType: "system" },
			}
		);
		outcome = await t.run((ctx) =>
			ctx.db
				.query("dealCloseEffectOutcomes")
				.withIndex("by_deal_effect", (query) =>
					query.eq("dealId", dealId).eq("effectName", "funds_confirmation")
				)
				.unique()
		);
		expect(outcome).toMatchObject({
			status: "failed",
			exceptionKind: "evidence_mismatch",
		});
		const evidenceRows = await t.run((ctx) =>
			ctx.db
				.query("dealFundsEvidence")
				.withIndex("by_deal", (query) => query.eq("dealId", dealId))
				.collect()
		);
		expect(evidenceRows).toHaveLength(0);
	});

	it("blocks incompatible duplicate funds evidence", async () => {
		const t = convexTest(schema, modules);
		const { dealId } = await seedDeal(t);

		await t.mutation(internal.deals.closeEvidence.recordFundsReceiptInternal, {
			dealId,
			source: {
				kind: "manual_admin",
				confirmedBy: "admin-auth",
				evidenceNote: "first note",
				receivedAt: 10,
			},
			recordedBy: "admin-auth",
		});

		const duplicate = await t.mutation(
			internal.deals.closeEvidence.recordFundsReceiptInternal,
			{
				dealId,
				source: {
					kind: "manual_admin",
					confirmedBy: "admin-auth",
					evidenceNote: "different note",
					receivedAt: 11,
				},
				recordedBy: "admin-auth",
			}
		);

		expect(duplicate.status).toBe("blocked");
		const outcomes = await t.run((ctx) =>
			ctx.db
				.query("dealCloseEffectOutcomes")
				.withIndex("by_deal_effect", (query) =>
					query.eq("dealId", dealId).eq("effectName", "funds_confirmation")
				)
				.collect()
		);
		expect(outcomes.at(-1)?.exceptionKind).toBe(
			"incompatible_duplicate_evidence"
		);
	});

	it("records a visible archive blocker when signed artifacts are missing", async () => {
		const t = convexTest(schema, modules);
		const { dealId } = await seedDeal(t);

		const result = await t.mutation(
			internal.deals.closeEvidence.recordSignedArchiveForDealInternal,
			{ dealId, journalEntryId: "journal-archive" }
		);

		expect(result.status).toBe("blocked_missing_artifacts");
		const archives = await t.run((ctx) =>
			ctx.db
				.query("dealSignedArchives")
				.withIndex("by_deal", (query) => query.eq("dealId", dealId))
				.collect()
		);
		expect(archives[0]).toMatchObject({
			status: "blocked_missing_artifacts",
			blockerKind: "missing_signed_artifacts",
		});
	});

	it("archives completed signed artifacts and exposes admin/participant projections safely", async () => {
		const t = convexTest(schema, modules);
		const { dealId, mortgageId, userId } = await seedDeal(t);
		await t.mutation(internal.deals.closeEvidence.recordFundsReceiptInternal, {
			dealId,
			source: {
				kind: "manual_admin",
				confirmedBy: "admin-auth",
				evidenceNote: "trust ledger and signed bank receipt",
				receivedAt: 10,
			},
			recordedBy: "admin-auth",
		});
		const { assetId, attemptId, storageId } =
			await seedCompletedEnvelopeArchive(t, { dealId, mortgageId, userId });

		const result = await t.mutation(
			internal.deals.closeEvidence.recordSignedArchiveForDealInternal,
			{ dealId, journalEntryId: "journal-archive-success" }
		);
		expect(result.status).toBe("archived");
		const adminProjection = await t
			.withIdentity(ADMIN_IDENTITY)
			.query(api.deals.queries.getAdminCloseEvidence, { dealId });
		expect(adminProjection?.funds).toMatchObject({
			sourceKind: "manual_admin",
			evidenceNote: "trust ledger and signed bank receipt",
		});
		expect(adminProjection?.archives[0]).toMatchObject({
			archiveId: result.archiveId,
			status: "archived",
			assetIds: [assetId],
			storageIds: [storageId],
		});
		expect(
			adminProjection?.effectOutcomes.map((row) => row.effectName)
		).toEqual(expect.arrayContaining(["funds_confirmation", "signed_archive"]));

		const participantReceipt = await t
			.withIdentity(ADMIN_IDENTITY)
			.query(api.deals.queries.getParticipantCloseReceipt, { dealId });
		expect(participantReceipt?.funds).not.toHaveProperty("evidenceNote");
		expect(participantReceipt).toMatchObject({
			signedArchiveStatus: "archived",
		});
		const replay = await t.mutation(
			internal.deals.closeEvidence.recordSignedArchiveForDealInternal,
			{ dealId, journalEntryId: "journal-archive-replay" }
		);
		expect(replay).toMatchObject({ archiveId: result.archiveId });
		expect(attemptId).toBeDefined();
	});
});
