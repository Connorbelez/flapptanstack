import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../_generated/api";
import { FAIRLEND_STAFF_ORG_ID } from "../../constants";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";

const modules = convexModules;

const BUYER_IDENTITY = {
	subject: "buyer-auth",
	issuer: "https://api.workos.com",
	org_id: "org_broker_test",
	organization_name: "Broker Test",
	role: "lender",
	roles: JSON.stringify(["lender"]),
	permissions: JSON.stringify(["lender:access", "deal:view"]),
	user_email: "buyer@test.fairlend.ca",
	user_first_name: "Bianca",
	user_last_name: "Buyer",
};

const SELLER_IDENTITY = {
	subject: "seller-auth",
	issuer: "https://api.workos.com",
	org_id: "org_broker_test",
	organization_name: "Broker Test",
	role: "borrower",
	roles: JSON.stringify(["borrower"]),
	permissions: JSON.stringify(["borrower:access", "deal:view"]),
	user_email: "seller@test.fairlend.ca",
	user_first_name: "Sam",
	user_last_name: "Seller",
};

const ADMIN_IDENTITY = {
	subject: "admin-auth",
	issuer: "https://api.workos.com",
	org_id: FAIRLEND_STAFF_ORG_ID,
	organization_name: "FairLend Staff",
	role: "admin",
	roles: JSON.stringify(["admin"]),
	permissions: JSON.stringify(["admin:access", "deal:view"]),
	user_email: "admin@fairlend.ca",
	user_first_name: "Ada",
	user_last_name: "Admin",
};

async function seedParticipantDeal(args?: {
	accessStatus?: "active" | "revoked";
	dealStatus?: string;
	envelopeStatus?: "sent" | "send_failed";
	includeEnvelope?: boolean;
	includeOpenException?: boolean;
	includeReceiptEvidence?: boolean;
	packageStatus?: "pending" | "ready" | "failed";
	signedArchiveStatus?: "archived" | "blocked_missing_artifacts" | "failed";
	tokenExpiresAt?: number;
}) {
	const t = convexTest(schema, modules);
	const ids = await t.run(async (ctx) => {
		const now = 1_800_000_000_000;
		const [buyerUserId, sellerUserId, brokerUserId] = await Promise.all([
			ctx.db.insert("users", {
				authId: BUYER_IDENTITY.subject,
				email: BUYER_IDENTITY.user_email,
				firstName: "Bianca",
				lastName: "Buyer",
			}),
			ctx.db.insert("users", {
				authId: SELLER_IDENTITY.subject,
				email: SELLER_IDENTITY.user_email,
				firstName: "Sam",
				lastName: "Seller",
			}),
			ctx.db.insert("users", {
				authId: "broker-auth",
				email: "broker@test.fairlend.ca",
				firstName: "Bryn",
				lastName: "Broker",
			}),
		]);
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: now,
			status: "active",
			userId: brokerUserId,
		});
		const lenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: now,
			onboardingEntryPath: "seed",
			status: "active",
			userId: buyerUserId,
		});
		await ctx.db.insert("borrowers", {
			createdAt: now,
			status: "active",
			userId: sellerUserId,
		});
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: now,
			postalCode: "M5V 1A1",
			propertyType: "residential",
			province: "ON",
			streetAddress: "123 King St W",
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 300,
			brokerOfRecordId: brokerId,
			createdAt: now,
			firstPaymentDate: "2026-02-01",
			interestAdjustmentDate: "2026-01-01",
			interestRate: 9.5,
			lienPosition: 1,
			loanType: "conventional",
			maturityDate: "2031-01-01",
			paymentAmount: 2500,
			paymentFrequency: "monthly",
			principal: 500_000,
			propertyId,
			rateType: "fixed",
			status: "funded",
			termMonths: 60,
			termStartDate: "2026-01-01",
		});
		const dealId = await ctx.db.insert("deals", {
			buyerId: BUYER_IDENTITY.subject,
			closingDate: now + 86_400_000,
			createdAt: now,
			createdBy: ADMIN_IDENTITY.subject,
			fractionalShare: 2500,
			lastTransitionAt: now + 1000,
			lenderId,
			mortgageId,
			sellerId: SELLER_IDENTITY.subject,
			status: args?.dealStatus ?? "documentReview.signed",
		});
		const accessStatus = args?.accessStatus ?? "active";
		for (const access of [
			{ role: "lender" as const, userId: BUYER_IDENTITY.subject },
			{ role: "borrower" as const, userId: SELLER_IDENTITY.subject },
		]) {
			await ctx.db.insert("dealAccess", {
				dealId,
				grantedAt: now,
				grantedBy: ADMIN_IDENTITY.subject,
				revokedAt: accessStatus === "revoked" ? now + 1 : undefined,
				role: access.role,
				status: accessStatus,
				userId: access.userId,
			});
		}
		const packageId = await ctx.db.insert("dealDocumentPackages", {
			dealId,
			mortgageId,
			readyAt: args?.packageStatus === "ready" ? now : undefined,
			retryCount: 0,
			status: args?.packageStatus ?? "ready",
			createdAt: now,
			updatedAt: now,
		});
		const instanceId = await ctx.db.insert("dealDocumentInstances", {
			packageId,
			dealId,
			mortgageId,
			sourceBlueprintSnapshot: {
				class: "private_templated_signable",
				displayName: "Closing Signature Package",
				displayOrder: 1,
				packageKey: "closing",
				packageLabel: "Closing",
			},
			kind: "generated",
			status: "signature_sent",
			createdAt: now,
			updatedAt: now,
		});
		if (args?.includeEnvelope) {
			const attemptId = await ctx.db.insert("dealEnvelopeAttempts", {
				active: true,
				attemptNumber: 1,
				createdAt: now,
				dealDocumentInstanceId: instanceId,
				dealId,
				idempotencyKey: `attempt:${dealId}`,
				packageId,
				provider: "documenso",
				providerDocumentId: "doc_123",
				providerEnvelopeId: "env_123",
				recipientRoster: [],
				status: args.envelopeStatus ?? "sent",
				terminalReason:
					args.envelopeStatus === "send_failed"
						? "Provider could not send the envelope."
						: undefined,
				updatedAt: now,
			});
			await ctx.db.insert("dealEnvelopeRecipients", {
				attemptId,
				authId: BUYER_IDENTITY.subject,
				createdAt: now,
				dealDocumentInstanceId: instanceId,
				dealId,
				documensoRole: "SIGNER",
				email: BUYER_IDENTITY.user_email,
				embeddedSigningToken: "buyer-token",
				name: "Bianca Buyer",
				packageId,
				platformRole: "lender_primary",
				providerRecipientId: "rec_buyer",
				readStatus: "available",
				required: true,
				sendStatus: "sent",
				sentAt: now,
				signingOrder: 1,
				signingStatus: "not_started",
				tokenAvailableAt: now,
				tokenExpiresAt: args.tokenExpiresAt ?? Date.now() + 60_000,
				updatedAt: now,
			});
			await ctx.db.insert("dealEnvelopeRecipients", {
				attemptId,
				authId: "lawyer-auth",
				createdAt: now,
				dealDocumentInstanceId: instanceId,
				dealId,
				documensoRole: "APPROVER",
				email: "lawyer@test.fairlend.ca",
				embeddedSigningToken: "lawyer-token",
				name: "Laura Lawyer",
				packageId,
				platformRole: "lawyer_primary",
				providerRecipientId: "rec_lawyer",
				readStatus: "available",
				required: true,
				sendStatus: "sent",
				sentAt: now,
				signingOrder: 2,
				signingStatus: "not_started",
				tokenAvailableAt: now,
				tokenExpiresAt: Date.now() + 60_000,
				updatedAt: now,
			});
			if (args.includeOpenException) {
				await ctx.db.insert("dealSigningExceptions", {
					attemptId,
					createdAt: now + 1,
					dealDocumentInstanceId: instanceId,
					dealId,
					kind: "send_failure",
					message: "Provider send failed.",
					packageId,
					severity: "blocking",
					status: "open",
					updatedAt: now + 1,
				});
			}
		}
		if (args?.includeReceiptEvidence) {
			await ctx.db.insert("dealFundsEvidence", {
				dealId,
				idempotencyKey: `funds:${dealId}`,
				manualConfirmedBy: ADMIN_IDENTITY.subject,
				receivedAt: now + 2000,
				recordedAt: now + 2000,
				recordedBy: ADMIN_IDENTITY.subject,
				source: {
					confirmedBy: ADMIN_IDENTITY.subject,
					evidenceNote: "Manual close confirmation",
					kind: "manual_admin",
					receivedAt: now + 2000,
				},
				sourceKind: "manual_admin",
			});
		}
		if (args?.signedArchiveStatus) {
			const isArchived = args.signedArchiveStatus === "archived";
			await ctx.db.insert("dealSignedArchives", {
				archivedAt: isArchived ? now + 3000 : undefined,
				assetIds: [],
				blockerKind: isArchived ? undefined : "missing_signed_artifacts",
				blockerMessage: isArchived ? undefined : "Archive unavailable.",
				createdAt: now + 3000,
				dealDocumentInstanceId: instanceId,
				dealId,
				idempotencyKey: `archive:${dealId}:${args.signedArchiveStatus}`,
				packageId,
				status: args.signedArchiveStatus,
				storageIds: [],
				updatedAt: now + 3000,
			});
		}
		return { dealId };
	});
	return { t, ...ids };
}

describe("participant deal workspace projections", () => {
	it("returns only active persona-scoped deals in My Closings", async () => {
		const { t, dealId } = await seedParticipantDeal();
		const queue = await t
			.withIdentity(BUYER_IDENTITY)
			.query(api.deals.queries.getParticipantDealQueue, {
				persona: "buyer",
			});

		expect(queue.needsAction).toHaveLength(0);
		expect(queue.inProgress).toHaveLength(1);
		expect(queue.inProgress[0]).toMatchObject({
			dealId,
			persona: "buyer",
			propertyLabel: "123 King St W, Toronto, ON",
			signingStatus: "not_started",
		});
	});

	it("denies revoked or mismatched persona workspace access", async () => {
		const { t, dealId } = await seedParticipantDeal({
			accessStatus: "revoked",
		});
		await expect(
			t
				.withIdentity(BUYER_IDENTITY)
				.query(api.deals.queries.getParticipantDealWorkspace, {
					dealId,
					persona: "buyer",
				})
		).rejects.toThrow(ConvexError);

		const active = await seedParticipantDeal();
		await expect(
			active.t
				.withIdentity(SELLER_IDENTITY)
				.query(api.deals.queries.getParticipantDealWorkspace, {
					dealId: active.dealId,
					persona: "buyer",
				})
		).rejects.toThrow(ConvexError);
	});

	it("exposes embedded signing only to the current authenticated recipient", async () => {
		const { t, dealId } = await seedParticipantDeal({ includeEnvelope: true });
		const buyerWorkspace = await t
			.withIdentity(BUYER_IDENTITY)
			.query(api.deals.queries.getParticipantDealWorkspace, {
				dealId,
				persona: "buyer",
			});

		expect(buyerWorkspace?.queueGroup).toBe("needsAction");
		expect(buyerWorkspace?.signing).toMatchObject({
			embeddedSigningToken: "buyer-token",
			recipientName: "Bianca Buyer",
			status: "ready_to_sign",
		});

		const sellerWorkspace = await t
			.withIdentity(SELLER_IDENTITY)
			.query(api.deals.queries.getParticipantDealWorkspace, {
				dealId,
				persona: "seller",
			});

		expect(sellerWorkspace?.signing.embeddedSigningToken).toBeNull();
		expect(sellerWorkspace?.signing.status).toBe("upcoming");
	});

	it("projects package and envelope blockers without leaking signing tokens", async () => {
		const pendingPackage = await seedParticipantDeal({
			packageStatus: "pending",
		});
		const pendingWorkspace = await pendingPackage.t
			.withIdentity(BUYER_IDENTITY)
			.query(api.deals.queries.getParticipantDealWorkspace, {
				dealId: pendingPackage.dealId,
				persona: "buyer",
			});
		expect(pendingWorkspace?.signing.status).toBe("package_pending");
		expect(pendingWorkspace?.blockers).toContainEqual(
			expect.objectContaining({ kind: "package_pending" })
		);

		const failedPackage = await seedParticipantDeal({
			packageStatus: "failed",
		});
		const failedWorkspace = await failedPackage.t
			.withIdentity(BUYER_IDENTITY)
			.query(api.deals.queries.getParticipantDealWorkspace, {
				dealId: failedPackage.dealId,
				persona: "buyer",
			});
		expect(failedWorkspace?.queueGroup).toBe("needsAction");
		expect(failedWorkspace?.signing.status).toBe("package_failed");
		expect(failedWorkspace?.blockers).toContainEqual(
			expect.objectContaining({ kind: "package_failed" })
		);

		const envelopeException = await seedParticipantDeal({
			includeEnvelope: true,
			includeOpenException: true,
		});
		const exceptionWorkspace = await envelopeException.t
			.withIdentity(BUYER_IDENTITY)
			.query(api.deals.queries.getParticipantDealWorkspace, {
				dealId: envelopeException.dealId,
				persona: "buyer",
			});
		expect(exceptionWorkspace?.queueGroup).toBe("needsAction");
		expect(exceptionWorkspace?.signing.embeddedSigningToken).toBeNull();
		expect(exceptionWorkspace?.signing.status).toBe("envelope_exception");
		expect(exceptionWorkspace?.blockers).toContainEqual(
			expect.objectContaining({ kind: "envelope_exception" })
		);
	});

	it("projects expired signing tokens as blocked participant action", async () => {
		const { t, dealId } = await seedParticipantDeal({
			includeEnvelope: true,
			tokenExpiresAt: Date.now() - 60_000,
		});
		const workspace = await t
			.withIdentity(BUYER_IDENTITY)
			.query(api.deals.queries.getParticipantDealWorkspace, {
				dealId,
				persona: "buyer",
			});

		expect(workspace?.queueGroup).toBe("needsAction");
		expect(workspace?.signing.embeddedSigningToken).toBeNull();
		expect(workspace?.signing.status).toBe("token_expired");
		expect(workspace?.blockers).toContainEqual(
			expect.objectContaining({ kind: "token_expired" })
		);
	});

	it("does not synthesize completion receipt from confirmed status alone", async () => {
		const withoutEvidence = await seedParticipantDeal({
			dealStatus: "confirmed",
		});
		const pendingReceipt = await withoutEvidence.t
			.withIdentity(BUYER_IDENTITY)
			.query(api.deals.queries.getParticipantDealWorkspace, {
				dealId: withoutEvidence.dealId,
				persona: "buyer",
			});

		expect(pendingReceipt?.closeReceipt.closedAt).toBeNull();
		expect(pendingReceipt?.queueGroup).toBe("inProgress");
		expect(
			pendingReceipt?.blockers.some(
				(blocker) => blocker.kind === "receipt_pending"
			)
		).toBe(true);

		const withEvidence = await seedParticipantDeal({
			dealStatus: "confirmed",
			includeReceiptEvidence: true,
		});
		const completed = await withEvidence.t
			.withIdentity(BUYER_IDENTITY)
			.query(api.deals.queries.getParticipantDealWorkspace, {
				dealId: withEvidence.dealId,
				persona: "buyer",
			});

		expect(completed?.closeReceipt.closedAt).not.toBeNull();
		expect(completed?.queueGroup).toBe("completed");
	});

	it("does not count failed or blocked signed archives as participant receipt evidence", async () => {
		for (const signedArchiveStatus of [
			"failed",
			"blocked_missing_artifacts",
		] as const) {
			const archiveOnly = await seedParticipantDeal({
				dealStatus: "confirmed",
				signedArchiveStatus,
			});
			const workspace = await archiveOnly.t
				.withIdentity(BUYER_IDENTITY)
				.query(api.deals.queries.getParticipantDealWorkspace, {
					dealId: archiveOnly.dealId,
					persona: "buyer",
				});

			expect(workspace?.closeReceipt.closedAt).toBeNull();
			expect(workspace?.closeReceipt.signedArchiveStatus).toBeNull();
			expect(workspace?.queueGroup).toBe("inProgress");
			expect(workspace?.blockers).toContainEqual(
				expect.objectContaining({ kind: "receipt_pending" })
			);
		}

		const archived = await seedParticipantDeal({
			dealStatus: "confirmed",
			signedArchiveStatus: "archived",
		});
		const completed = await archived.t
			.withIdentity(BUYER_IDENTITY)
			.query(api.deals.queries.getParticipantDealWorkspace, {
				dealId: archived.dealId,
				persona: "buyer",
			});

		expect(completed?.closeReceipt.closedAt).not.toBeNull();
		expect(completed?.closeReceipt.signedArchiveStatus).toBe("archived");
		expect(completed?.queueGroup).toBe("completed");
	});
});
