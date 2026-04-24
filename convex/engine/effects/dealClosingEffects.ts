import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { parseFundsReceiptSource } from "../../deals/closeEvidence";
import { effectPayloadValidator } from "../validators";

const dealEffectPayloadValidator = {
	...effectPayloadValidator,
	entityId: v.id("deals"),
	entityType: v.literal("deal"),
};

/**
 * Stub: notifies buyer, seller, and lawyer that a deal has been locked.
 * // TODO: Phase 2 — replace with real implementation (email via Resend)
 */
export const notifyAllParties = internalAction({
	args: dealEffectPayloadValidator,
	handler: async (_ctx, args) => {
		console.info(
			`[stub] notifyAllParties: Would notify buyer, seller, lawyer for ${args.entityType} ${args.entityId}`
		);
	},
});

/**
 * Stub: notifies all parties that a deal has been cancelled.
 * // TODO: Phase 2 — replace with real implementation (email via Resend)
 */
export const notifyCancellation = internalAction({
	args: dealEffectPayloadValidator,
	handler: async (_ctx, args) => {
		console.info(
			`[stub] notifyCancellation: Would notify all parties of cancellation for ${args.entityType} ${args.entityId}`
		);
	},
});

export const createDocumentPackage = internalAction({
	args: dealEffectPayloadValidator,
	handler: async (ctx, args) => {
		const deal = await ctx
			.runQuery(internal.deals.queries.getInternalDeal, {
				dealId: args.entityId,
			})
			.catch(() => null);
		if (deal?.checkoutSessionId) {
			const existingPackage = await ctx.runQuery(
				internal.documents.dealPackages.getPackageByDealInternal,
				{ dealId: args.entityId }
			);
			if (existingPackage) {
				console.info(
					`[createDocumentPackage] Deal ${args.entityId} was created by checkout handoff and already has package ${existingPackage._id}; skipping duplicate scheduled generation`
				);
				return;
			}
		}
		await ctx.runAction(
			internal.documents.dealPackages.runCreateDocumentPackageInternal,
			{
				dealId: args.entityId,
				retry: false,
			}
		);
	},
});

export const archiveSignedDocuments = internalAction({
	args: dealEffectPayloadValidator,
	handler: async (ctx, args) => {
		await ctx.runAction(
			internal.documents.dealPackages.archiveCompletedSignableDocumentsInternal,
			{
				dealId: args.entityId,
			}
		);

		const result = await ctx.runMutation(
			internal.deals.closeEvidence.recordSignedArchiveForDealInternal,
			{
				dealId: args.entityId,
				journalEntryId: args.journalEntryId,
			}
		);
		if (result.status !== "archived") {
			console.error(
				`[archiveSignedDocuments] Signed archive blocked for deal ${args.entityId}: ${result.status}`
			);
			return;
		}
		console.info(
			`[archiveSignedDocuments] Signed archive recorded for deal ${args.entityId}`
		);
	},
});

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const confirmFundsReceipt = internalAction({
	args: dealEffectPayloadValidator,
	handler: async (ctx, args) => {
		const payloadSource = parseFundsReceiptSource(
			isRecord(args.payload) ? args.payload.fundsReceiptSource : undefined
		);
		const source =
			payloadSource ??
			(await ctx.runQuery(
				internal.deals.closeEvidence.resolveProviderFundsSourceForDealInternal,
				{ dealId: args.entityId }
			));

		if (!source) {
			await ctx.runMutation(
				internal.deals.closeEvidence.recordCloseEffectOutcomeInternal,
				{
					dealId: args.entityId,
					effectName: "funds_confirmation",
					status: "blocked",
					exceptionKind: "missing_funds_evidence",
					message:
						"FUNDS_RECEIVED did not include manual evidence and no completed provider leg 2 evidence was found.",
					metadata: { journalEntryId: args.journalEntryId },
				}
			);
			console.error(
				`[confirmFundsReceipt] Missing funds evidence for deal ${args.entityId}`
			);
			return;
		}

		const result = await ctx
			.runMutation(internal.deals.closeEvidence.recordFundsReceiptInternal, {
				dealId: args.entityId,
				source,
				journalEntryId: args.journalEntryId,
				recordedBy: args.source.actorId ?? "system",
			})
			.catch(async (error: unknown) => {
				await ctx.runMutation(
					internal.deals.closeEvidence.recordCloseEffectOutcomeInternal,
					{
						dealId: args.entityId,
						effectName: "funds_confirmation",
						status: "failed",
						exceptionKind: "evidence_mismatch",
						message: "FUNDS_RECEIVED evidence failed validation.",
						error: error instanceof Error ? error.message : String(error),
						metadata: { journalEntryId: args.journalEntryId },
					}
				);
				console.error(
					`[confirmFundsReceipt] Funds evidence validation failed for deal ${args.entityId}:`,
					error
				);
				return null;
			});

		if (!result) {
			return;
		}

		if (result.status === "blocked") {
			console.error(
				`[confirmFundsReceipt] Funds evidence blocked for deal ${args.entityId}`
			);
			return;
		}

		console.info(
			`[confirmFundsReceipt] Funds evidence ${result.status} for deal ${args.entityId}`
		);
	},
});

/**
 * Collects a locking fee from the buyer when a deal enters the locked state.
 * Locking fees credit UNAPPLIED_CASH (not BORROWER_RECEIVABLE) and have no obligation reference.
 * Resilient: logs and returns on missing deal or zero/undefined fee amount.
 */
export const collectLockingFee = internalAction({
	args: dealEffectPayloadValidator,
	handler: async (ctx, args) => {
		const deal = await ctx
			.runQuery(internal.deals.queries.getInternalDeal, {
				dealId: args.entityId,
			})
			.catch(() => null);

		if (!deal) {
			console.error(
				`[collectLockingFee] Deal ${args.entityId} not found — skipping`
			);
			return;
		}

		if (
			deal.lockFeeCollectionProvider === "stripe_checkout" &&
			deal.lockFeeCollectionStatus === "collected"
		) {
			console.info(
				`[collectLockingFee] Locking fee already collected by Stripe for deal ${args.entityId} — skipping`
			);
			return;
		}

		if (deal.lockingFeeAmount === undefined || deal.lockingFeeAmount <= 0) {
			console.info(
				`[collectLockingFee] No locking fee configured for deal ${args.entityId} — skipping`
			);
			return;
		}

		if (deal.lockFeeTransferRequestId) {
			console.info(
				`[collectLockingFee] Deal ${args.entityId} already has lock-fee transfer ${deal.lockFeeTransferRequestId} — skipping duplicate collection`
			);
			return;
		}

		// Validate amount is a safe integer (cents). createTransferRequestInternal
		// enforces this too, but catching it here avoids a scheduler retry loop on
		// misconfigured fee values like 12.34.
		if (
			!(
				Number.isInteger(deal.lockingFeeAmount) &&
				Number.isSafeInteger(deal.lockingFeeAmount)
			)
		) {
			console.error(
				`[collectLockingFee] Invalid lockingFeeAmount ${deal.lockingFeeAmount} for deal ${args.entityId} — ` +
					"must be a safe integer (cents). Skipping."
			);
			return;
		}

		const idempotencyKey = `locking-fee:${args.entityId}`;

		try {
			const transferId = await ctx.runMutation(
				internal.payments.transfers.mutations.createTransferRequestInternal,
				{
					direction: "inbound",
					transferType: "locking_fee_collection",
					amount: deal.lockingFeeAmount,
					counterpartyType: "borrower",
					counterpartyId: deal.buyerId,
					mortgageId: deal.mortgageId,
					dealId: args.entityId,
					providerCode: "manual",
					idempotencyKey,
				}
			);

			await ctx.runAction(
				internal.payments.transfers.mutations.initiateTransferInternal,
				{ transferId }
			);

			console.info(
				`[collectLockingFee] Created and initiated locking fee transfer ${transferId} for deal ${args.entityId}`
			);
		} catch (error) {
			console.error(
				`[collectLockingFee] Failed to create/initiate locking fee transfer for deal ${args.entityId}:`,
				error
			);
			// Graceful failure — do not propagate to scheduler to avoid retry loops.
			// The deal remains locked; admin can retry the fee collection manually.
		}
	},
});
