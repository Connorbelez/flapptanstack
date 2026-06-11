import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { verifyDocumensoSecret } from "../../payments/webhooks/verification";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";
import {
	canExposeEmbeddedSigningToken,
	summarizeRequiredRecipientCompletion,
} from "../envelopes";
import {
	normalizeDocumensoEventType,
	parseDocumensoWebhookEvent,
} from "../envelopeWebhooks";

const modules = convexModules;

function dealViewer(authId: string, email: string) {
	return {
		subject: authId,
		issuer: "https://api.workos.com",
		role: "member",
		roles: JSON.stringify(["member"]),
		permissions: JSON.stringify(["deal:view", "deal:manage"]),
		user_email: email,
		user_first_name: "Deal",
		user_last_name: "Viewer",
	};
}

async function seedEnvelopeFixture(args?: {
	includeLawyer?: boolean;
	requiredPlatformRoles?: string[];
}) {
	const t = convexTest(schema, modules);
	const includeLawyer = args?.includeLawyer ?? true;
	const requiredPlatformRoles = args?.requiredPlatformRoles ?? [
		"lender_primary",
		"lawyer_primary",
	];

	const ids = await t.run(async (ctx) => {
		const [buyerUserId, sellerUserId, _lawyerUserId, brokerUserId] =
			await Promise.all([
				ctx.db.insert("users", {
					authId: "buyer-auth",
					email: "buyer@test.fairlend.ca",
					firstName: "Bianca",
					lastName: "Buyer",
				}),
				ctx.db.insert("users", {
					authId: "seller-auth",
					email: "seller@test.fairlend.ca",
					firstName: "Sam",
					lastName: "Seller",
				}),
				ctx.db.insert("users", {
					authId: "lawyer-auth",
					email: "lawyer@test.fairlend.ca",
					firstName: "Laura",
					lastName: "Lawyer",
				}),
				ctx.db.insert("users", {
					authId: "broker-auth",
					email: "broker@test.fairlend.ca",
					firstName: "Bryn",
					lastName: "Broker",
				}),
			]);
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: 1,
			status: "active",
			userId: brokerUserId,
		});
		const buyerLenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: 1,
			onboardingEntryPath: "seed",
			status: "active",
			userId: buyerUserId,
		});
		await ctx.db.insert("borrowers", {
			createdAt: 1,
			status: "active",
			userId: sellerUserId,
		});
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: 1,
			postalCode: "M5V 1A1",
			propertyType: "residential",
			province: "ON",
			streetAddress: "123 King St W",
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 300,
			brokerOfRecordId: brokerId,
			createdAt: 1,
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
			buyerId: "buyer-auth",
			createdAt: 1,
			createdBy: "admin-auth",
			fractionalShare: 2500,
			lawyerId: includeLawyer ? "lawyer-auth" : undefined,
			lawyerType: includeLawyer ? "guest_lawyer" : undefined,
			lenderId: buyerLenderId,
			mortgageId,
			sellerId: "seller-auth",
			status: "documentReview.signed",
		});
		for (const access of [
			{ userId: "buyer-auth", role: "lender" as const },
			{ userId: "seller-auth", role: "borrower" as const },
			...(includeLawyer
				? [{ userId: "lawyer-auth", role: "guest_lawyer" as const }]
				: []),
		]) {
			await ctx.db.insert("dealAccess", {
				dealId,
				grantedAt: 1,
				grantedBy: "admin-auth",
				role: access.role,
				status: "active",
				userId: access.userId,
			});
		}
		const blueprintId = await ctx.db.insert("mortgageDocumentBlueprints", {
			mortgageId,
			class: "private_templated_signable",
			sourceKind: "template_version",
			status: "active",
			displayName: "Closing Signature Package",
			displayOrder: 1,
			packageKey: "closing",
			packageLabel: "Closing",
			templateSnapshotMeta: {
				containsSignableFields: true,
				requiredPlatformRoles,
				requiredVariableKeys: [],
				templateName: "Closing Signature Package",
			},
			createdByUserId: buyerUserId,
			createdAt: 1,
		});
		const packageId = await ctx.db.insert("dealDocumentPackages", {
			dealId,
			mortgageId,
			status: "ready",
			retryCount: 0,
			createdAt: 1,
			updatedAt: 1,
			readyAt: 1,
		});
		const instanceId = await ctx.db.insert("dealDocumentInstances", {
			packageId,
			dealId,
			mortgageId,
			sourceBlueprintId: blueprintId,
			sourceBlueprintSnapshot: {
				class: "private_templated_signable",
				displayName: "Closing Signature Package",
				displayOrder: 1,
				packageKey: "closing",
				packageLabel: "Closing",
			},
			kind: "generated",
			status: "signature_pending_recipient_resolution",
			createdAt: 1,
			updatedAt: 1,
		});

		return { dealId, instanceId };
	});

	return { t, ...ids };
}

describe("deal envelope helpers", () => {
	it("summarizes required recipient completion and token visibility", () => {
		expect(
			summarizeRequiredRecipientCompletion([
				{ required: true, signingStatus: "completed" },
				{ required: true, signingStatus: "not_started" },
				{ required: false, signingStatus: "completed" },
			])
		).toEqual({
			completedRequiredCount: 1,
			isComplete: false,
			requiredCount: 2,
		});

		expect(
			canExposeEmbeddedSigningToken({
				recipient: {
					authId: "buyer-auth",
					email: "buyer@test.fairlend.ca",
					tokenExpiresAt: 200,
				},
				viewerAuthId: "buyer-auth",
				viewerEmail: "buyer@test.fairlend.ca",
				now: 100,
			})
		).toBe(true);
		expect(
			canExposeEmbeddedSigningToken({
				recipient: {
					authId: "buyer-auth",
					email: "buyer@test.fairlend.ca",
					tokenExpiresAt: 50,
				},
				viewerAuthId: "buyer-auth",
				viewerEmail: "buyer@test.fairlend.ca",
				now: 100,
			})
		).toBe(false);
	});

	it("normalizes Documenso event names and verifies provider secrets", () => {
		expect(normalizeDocumensoEventType("document.completed")).toBe(
			"document_completed"
		);
		expect(normalizeDocumensoEventType("recipient.opened")).toBe(
			"recipient_opened"
		);
		expect(verifyDocumensoSecret("secret", "secret")).toBe(true);
		expect(verifyDocumensoSecret("secret", "wrong")).toBe(false);
		expect(verifyDocumensoSecret("secret", "secret-with-suffix")).toBe(false);
	});

	it("parses Documenso provider payload document and recipient ids", () => {
		const parsed = parseDocumensoWebhookEvent(
			JSON.stringify({
				event: "DOCUMENT_RECIPIENT_COMPLETED",
				payload: {
					id: 123,
					recipients: [
						{
							email: "pending@test.fairlend.ca",
							id: 10,
							signingStatus: "PENDING",
						},
						{
							email: "signed@test.fairlend.ca",
							id: 11,
							signingStatus: "SIGNED",
						},
					],
				},
			})
		);

		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.event.providerDocumentId).toBe("123");
			expect(parsed.event.providerRecipientId).toBe("11");
			expect(parsed.event.normalizedEventType).toBe("recipient_completed");
		}
	});

	it("parses nested Documenso data payload provider identifiers", () => {
		const parsed = parseDocumensoWebhookEvent(
			JSON.stringify({
				type: "document.declined",
				data: {
					eventId: "evt_nested_decline",
					document: {
						id: "doc_nested",
					},
					envelope: {
						id: "env_nested",
					},
					recipient: {
						id: "rec_nested",
					},
				},
			})
		);

		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.event).toMatchObject({
				normalizedEventType: "document_declined",
				providerDocumentId: "doc_nested",
				providerEnvelopeId: "env_nested",
				providerEventId: "evt_nested_decline",
				providerRecipientId: "rec_nested",
			});
		}
	});
});

describe("deal envelope attempts", () => {
	it("creates ordered recipients and only exposes a signing token to the current recipient", async () => {
		const { t, dealId, instanceId } = await seedEnvelopeFixture();

		const result = await t.mutation(
			internal.deals.envelopes.createEnvelopeAttemptInternal,
			{
				dealId,
				dealDocumentInstanceId: instanceId,
				provider: "documenso",
				providerDocumentId: "doc_123",
				status: "sent",
				recipientTokens: [
					{
						platformRole: "lender_primary",
						providerRecipientId: "rec_buyer",
						embeddedSigningToken: "buyer-token",
						tokenExpiresAt: Date.now() + 60_000,
					},
					{
						platformRole: "lawyer_primary",
						providerRecipientId: "rec_lawyer",
						embeddedSigningToken: "lawyer-token",
						tokenExpiresAt: Date.now() + 60_000,
					},
				],
			}
		);

		expect(result.status).toBe("sent");
		const buyerView = await t
			.withIdentity(dealViewer("buyer-auth", "buyer@test.fairlend.ca"))
			.query(api.deals.envelopes.listEnvelopeProjection, { dealId });

		expect(buyerView).toHaveLength(1);
		expect(buyerView[0]?.recipients).toHaveLength(2);
		expect(
			buyerView[0]?.recipients.find(
				(recipient) => recipient.platformRole === "lender_primary"
			)?.embeddedSigningToken
		).toBe("buyer-token");
		expect(
			buyerView[0]?.recipients.find(
				(recipient) => recipient.platformRole === "lawyer_primary"
			)?.embeddedSigningToken
		).toBeUndefined();
	});

	it("creates a configuration exception when required signatory mapping is missing", async () => {
		const { t, dealId, instanceId } = await seedEnvelopeFixture({
			includeLawyer: false,
			requiredPlatformRoles: ["lawyer_primary"],
		});

		const result = await t.mutation(
			internal.deals.envelopes.createEnvelopeAttemptInternal,
			{
				dealId,
				dealDocumentInstanceId: instanceId,
				provider: "documenso",
				status: "sent",
			}
		);

		expect(result.status).toBe("configuration_error");
		const exceptions = await t.run((ctx) =>
			ctx.db
				.query("dealSigningExceptions")
				.withIndex("by_deal", (query) =>
					query.eq("dealId", dealId).eq("status", "open")
				)
				.collect()
		);
		expect(exceptions).toHaveLength(1);
		expect(exceptions[0]?.kind).toBe("pre_send_configuration_failure");
	});

	it("reissues attempts with supersede lineage while preserving history", async () => {
		const { t, dealId, instanceId } = await seedEnvelopeFixture();
		const first = await t.mutation(
			internal.deals.envelopes.createEnvelopeAttemptInternal,
			{
				dealId,
				dealDocumentInstanceId: instanceId,
				provider: "documenso",
				providerDocumentId: "doc_old",
				status: "sent",
				recipientTokens: [
					{ platformRole: "lender_primary", providerRecipientId: "rec_buyer" },
					{ platformRole: "lawyer_primary", providerRecipientId: "rec_lawyer" },
				],
			}
		);

		const second = await t
			.withIdentity(dealViewer("buyer-auth", "buyer@test.fairlend.ca"))
			.mutation(api.deals.envelopes.reissueEnvelopeAttempt, {
				attemptId: first.attemptId as Id<"dealEnvelopeAttempts">,
				provider: "documenso",
			});

		await expect(
			t
				.withIdentity(dealViewer("buyer-auth", "buyer@test.fairlend.ca"))
				.mutation(api.deals.envelopes.reissueEnvelopeAttempt, {
					attemptId: first.attemptId as Id<"dealEnvelopeAttempts">,
					provider: "documenso",
				})
		).rejects.toThrow("Only the active envelope attempt can be reissued");

		const attempts = await t.run((ctx) =>
			ctx.db
				.query("dealEnvelopeAttempts")
				.withIndex("by_instance", (query) =>
					query.eq("dealDocumentInstanceId", instanceId)
				)
				.collect()
		);
		const oldAttempt = attempts.find((row) => row._id === first.attemptId);
		const newAttempt = attempts.find((row) => row._id === second.attemptId);

		expect(oldAttempt?.active).toBe(false);
		expect(oldAttempt?.status).toBe("reissue_required");
		expect(oldAttempt?.supersededByAttemptId).toBe(second.attemptId);
		expect(newAttempt?.active).toBe(true);
		expect(newAttempt?.status).toBe("draft");
		expect(newAttempt?.supersedesAttemptId).toBe(first.attemptId);
		expect(attempts).toHaveLength(2);
	});
});

describe("deal envelope webhooks", () => {
	it("dedupes provider events and updates recipient progress idempotently", async () => {
		const { t, dealId, instanceId } = await seedEnvelopeFixture();
		const attempt = await t.mutation(
			internal.deals.envelopes.createEnvelopeAttemptInternal,
			{
				dealId,
				dealDocumentInstanceId: instanceId,
				provider: "documenso",
				providerDocumentId: "doc_456",
				status: "sent",
				recipientTokens: [
					{ platformRole: "lender_primary", providerRecipientId: "rec_buyer" },
					{ platformRole: "lawyer_primary", providerRecipientId: "rec_lawyer" },
				],
			}
		);

		const first = await t.mutation(
			internal.deals.envelopeWebhooks.persistDocumensoProviderEvent,
			{
				providerEventId: "evt_buyer_signed",
				providerDocumentId: "doc_456",
				providerRecipientId: "rec_buyer",
				rawBody: "{}",
				rawEventType: "recipient.signed",
				normalizedEventType: "recipient_signed",
			}
		);
		const duplicate = await t.mutation(
			internal.deals.envelopeWebhooks.persistDocumensoProviderEvent,
			{
				providerEventId: "evt_buyer_signed",
				providerDocumentId: "doc_456",
				providerRecipientId: "rec_buyer",
				rawBody: "{}",
				rawEventType: "recipient.signed",
				normalizedEventType: "recipient_signed",
			}
		);
		expect(duplicate).toEqual({
			duplicate: true,
			webhookEventId: first.webhookEventId,
		});

		const processed = await t.mutation(
			internal.deals.envelopeWebhooks.processDocumensoProviderEvent,
			{ webhookEventId: first.webhookEventId }
		);
		expect(processed.shouldEmitAllPartiesSigned).toBe(false);

		const buyerRecipient = await t.run(async (ctx) =>
			ctx.db
				.query("dealEnvelopeRecipients")
				.withIndex("by_attempt_provider_recipient", (query) =>
					query
						.eq("attemptId", attempt.attemptId as Id<"dealEnvelopeAttempts">)
						.eq("providerRecipientId", "rec_buyer")
				)
				.first()
		);
		expect(buyerRecipient?.signingStatus).toBe("completed");
	});

	it("claims completion emission once and marks the document instance signed", async () => {
		const { t, dealId, instanceId } = await seedEnvelopeFixture();
		await t.mutation(internal.deals.envelopes.createEnvelopeAttemptInternal, {
			dealId,
			dealDocumentInstanceId: instanceId,
			provider: "documenso",
			providerDocumentId: "doc_complete",
			status: "sent",
			recipientTokens: [
				{ platformRole: "lender_primary", providerRecipientId: "rec_buyer" },
				{ platformRole: "lawyer_primary", providerRecipientId: "rec_lawyer" },
			],
		});

		for (const [providerEventId, providerRecipientId] of [
			["evt_buyer_done", "rec_buyer"],
			["evt_lawyer_done", "rec_lawyer"],
		] as const) {
			const persisted = await t.mutation(
				internal.deals.envelopeWebhooks.persistDocumensoProviderEvent,
				{
					providerEventId,
					providerDocumentId: "doc_complete",
					providerRecipientId,
					rawBody: "{}",
					rawEventType: "recipient.completed",
					normalizedEventType: "recipient_completed",
				}
			);
			const processed = await t.mutation(
				internal.deals.envelopeWebhooks.processDocumensoProviderEvent,
				{ webhookEventId: persisted.webhookEventId }
			);
			if (providerRecipientId === "rec_buyer") {
				expect(processed.shouldEmitAllPartiesSigned).toBe(false);
			} else {
				expect(processed.shouldEmitAllPartiesSigned).toBe(true);
			}
		}

		const duplicateCompletion = await t.mutation(
			internal.deals.envelopeWebhooks.persistDocumensoProviderEvent,
			{
				providerEventId: "evt_doc_done",
				providerDocumentId: "doc_complete",
				rawBody: "{}",
				rawEventType: "DOCUMENT_COMPLETED",
				normalizedEventType: "document_completed",
			}
		);
		const duplicateProcessed = await t.mutation(
			internal.deals.envelopeWebhooks.processDocumensoProviderEvent,
			{ webhookEventId: duplicateCompletion.webhookEventId }
		);
		expect(duplicateProcessed.shouldEmitAllPartiesSigned).toBe(false);

		const instance = await t.run((ctx) => ctx.db.get(instanceId));
		expect(instance?.status).toBe("signed");
	});

	it("marks unmatched provider events failed instead of mutating envelope truth", async () => {
		const { t } = await seedEnvelopeFixture();
		const persisted = await t.mutation(
			internal.deals.envelopeWebhooks.persistDocumensoProviderEvent,
			{
				providerEventId: "evt_missing_attempt",
				providerDocumentId: "doc_missing",
				rawBody: "{}",
				rawEventType: "document.completed",
				normalizedEventType: "document_completed",
			}
		);

		await t.mutation(
			internal.deals.envelopeWebhooks.processDocumensoProviderEvent,
			{ webhookEventId: persisted.webhookEventId }
		);

		const event = await t.run((ctx) => ctx.db.get(persisted.webhookEventId));
		expect(event?.status).toBe("failed");
		expect(event?.error).toContain("No active envelope attempt");
	});

	it("records rejection and void exceptions without requesting completion emission", async () => {
		const { t, dealId, instanceId } = await seedEnvelopeFixture();
		await t.mutation(internal.deals.envelopes.createEnvelopeAttemptInternal, {
			dealId,
			dealDocumentInstanceId: instanceId,
			provider: "documenso",
			providerDocumentId: "doc_exception",
			status: "sent",
			recipientTokens: [
				{ platformRole: "lender_primary", providerRecipientId: "rec_buyer" },
				{ platformRole: "lawyer_primary", providerRecipientId: "rec_lawyer" },
			],
		});

		const declined = await t.mutation(
			internal.deals.envelopeWebhooks.persistDocumensoProviderEvent,
			{
				providerEventId: "evt_declined",
				providerDocumentId: "doc_exception",
				providerRecipientId: "rec_buyer",
				rawBody: "{}",
				rawEventType: "document.declined",
				normalizedEventType: "document_declined",
			}
		);
		const declinedResult = await t.mutation(
			internal.deals.envelopeWebhooks.processDocumensoProviderEvent,
			{ webhookEventId: declined.webhookEventId }
		);
		expect(declinedResult.shouldEmitAllPartiesSigned).toBe(false);

		const reissue = await t
			.withIdentity(dealViewer("buyer-auth", "buyer@test.fairlend.ca"))
			.mutation(api.deals.envelopes.reissueEnvelopeAttempt, {
				attemptId: declinedResult.attemptId as Id<"dealEnvelopeAttempts">,
				provider: "documenso",
			});
		await t.run(async (ctx) => {
			await ctx.db.patch(reissue.attemptId as Id<"dealEnvelopeAttempts">, {
				providerDocumentId: "doc_void",
				status: "sent",
				updatedAt: Date.now(),
			});
			const recipients = await ctx.db
				.query("dealEnvelopeRecipients")
				.withIndex("by_attempt", (query) =>
					query.eq("attemptId", reissue.attemptId as Id<"dealEnvelopeAttempts">)
				)
				.collect();
			for (const recipient of recipients) {
				await ctx.db.patch(recipient._id, {
					providerRecipientId:
						recipient.platformRole === "lender_primary"
							? "rec_buyer_2"
							: "rec_lawyer_2",
				});
			}
		});
		const voided = await t.mutation(
			internal.deals.envelopeWebhooks.persistDocumensoProviderEvent,
			{
				providerEventId: "evt_voided",
				providerDocumentId: "doc_void",
				rawBody: "{}",
				rawEventType: "document.voided",
				normalizedEventType: "document_voided",
			}
		);
		const voidedResult = await t.mutation(
			internal.deals.envelopeWebhooks.processDocumensoProviderEvent,
			{ webhookEventId: voided.webhookEventId }
		);
		expect(voidedResult.shouldEmitAllPartiesSigned).toBe(false);

		for (const [providerEventId, providerRecipientId] of [
			["evt_void_buyer_done", "rec_buyer_2"],
			["evt_void_lawyer_done", "rec_lawyer_2"],
		] as const) {
			const completedAfterVoid = await t.mutation(
				internal.deals.envelopeWebhooks.persistDocumensoProviderEvent,
				{
					providerEventId,
					providerDocumentId: "doc_void",
					providerRecipientId,
					rawBody: "{}",
					rawEventType: "DOCUMENT_RECIPIENT_COMPLETED",
					normalizedEventType: "recipient_completed",
				}
			);
			const processedAfterVoid = await t.mutation(
				internal.deals.envelopeWebhooks.processDocumensoProviderEvent,
				{ webhookEventId: completedAfterVoid.webhookEventId }
			);
			expect(processedAfterVoid.shouldEmitAllPartiesSigned).toBe(false);
		}

		const [exceptions, reissuedAttempt] = await t.run(async (ctx) => {
			const exceptionRows = await ctx.db
				.query("dealSigningExceptions")
				.withIndex("by_deal", (query) =>
					query.eq("dealId", dealId).eq("status", "open")
				)
				.collect();
			const attempt = await ctx.db.get(
				reissue.attemptId as Id<"dealEnvelopeAttempts">
			);
			return [exceptionRows, attempt] as const;
		});

		expect(exceptions.map((row) => row.kind).sort()).toEqual([
			"envelope_cancelled_or_voided",
			"recipient_rejection",
		]);
		expect(reissuedAttempt?.status).toBe("voided");
	});
});
