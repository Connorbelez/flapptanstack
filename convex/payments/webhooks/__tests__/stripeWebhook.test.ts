import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWebhookTestHarness } from "../../../../src/test/convex/payments/webhooks/convexTestHarness";
import { internal } from "../../../_generated/api";
import { buildCheckoutStripeMetadata } from "../../../checkout/metadata";
import { CHECKOUT_LOCK_FEE_AMOUNT_CENTS } from "../../../checkout/validators";
import { DEAL_LOCK_FEE_AMOUNT_CENTS } from "../../../dealLocks/validators";
import type { StripeWebhookEvent } from "../stripe";
import {
	buildReversalCode,
	buildReversalReason,
	CHECKOUT_SUCCESS_EVENT_TYPES,
	extractProviderRef,
	REVERSAL_EVENT_TYPES,
	toPayload,
} from "../stripe";

// ── Helpers ──────────────────────────────────────────────────────────

function makeEvent(
	overrides: Partial<StripeWebhookEvent> & { type: string }
): StripeWebhookEvent {
	return {
		id: overrides.id ?? "evt_test_001",
		type: overrides.type,
		created: overrides.created ?? 1_711_929_600, // 2024-04-01 00:00:00 UTC
		data: overrides.data ?? {
			object: {
				id: "ch_test_001",
				amount: 5000,
			},
		},
	};
}

function createHarness() {
	return createWebhookTestHarness();
}

const TEST_STRIPE_SECRET = "whsec_test_stripe_webhook_secret";
const TEST_TIMESTAMP = 1_711_929_600;
const testEnvRestorers: Array<() => void> = [];

function setTestEnv(key: string, value: string) {
	const previous = process.env[key];
	process.env[key] = value;
	testEnvRestorers.push(() => {
		if (previous === undefined) {
			delete process.env[key];
			return;
		}
		process.env[key] = previous;
	});
}

function buildStripeSignature(body: string) {
	const payload = `${TEST_TIMESTAMP}.${body}`;
	return `t=${TEST_TIMESTAMP},v1=${createHmac("sha256", TEST_STRIPE_SECRET)
		.update(payload)
		.digest("hex")}`;
}

async function insertHostedMarketplaceCheckout(
	t: ReturnType<typeof createHarness>
) {
	return await t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {
			authId: "checkout-buyer-auth",
			email: "checkout-buyer@test.fairlend.ca",
			firstName: "Checkout",
			lastName: "Buyer",
		});
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: Date.now(),
			orgId: "org_checkout_webhook",
			status: "active",
			userId,
		});
		const lenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: Date.now(),
			onboardingEntryPath: "self_signup",
			orgId: "org_checkout_webhook",
			status: "active",
			userId,
		});
		const portalId = await ctx.db.insert("portals", {
			brokerId,
			createdAt: Date.now(),
			defaultPostAuthPath: "/listings",
			isPublished: true,
			localHost: "checkout-webhook.localhost:3000",
			orgId: "org_checkout_webhook",
			portalType: "broker",
			productionHost: "checkout-webhook.fairlend.ca",
			publicTeaserEnabled: true,
			slug: "checkout-webhook",
			status: "active",
			teaserListingLimit: 12,
			updatedAt: Date.now(),
		});
		const brokerUserId = await ctx.db.insert("users", {
			authId: "checkout-broker-auth",
			email: "checkout-broker@test.fairlend.ca",
			firstName: "Checkout",
			lastName: "Broker",
		});
		const brokerOfRecordId = await ctx.db.insert("brokers", {
			createdAt: Date.now(),
			orgId: "org_checkout_webhook",
			status: "active",
			userId: brokerUserId,
		});
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: Date.now(),
			postalCode: "M5V 1A1",
			propertyType: "residential",
			province: "ON",
			streetAddress: "123 King St W",
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 300,
			brokerOfRecordId,
			createdAt: Date.now(),
			firstPaymentDate: "2026-02-01",
			interestAdjustmentDate: "2026-01-01",
			interestRate: 9.5,
			lienPosition: 1,
			loanType: "conventional",
			maturityDate: "2031-01-01",
			orgId: "org_checkout_webhook",
			paymentAmount: 2500,
			paymentFrequency: "monthly",
			principal: 500_000,
			propertyId,
			rateType: "fixed",
			status: "active",
			termMonths: 60,
			termStartDate: "2026-01-01",
		});
		const listingId = await ctx.db.insert("listings", {
			city: "Toronto",
			createdAt: Date.now(),
			dataSource: "mortgage_pipeline",
			featured: false,
			heroImages: [],
			interestRate: 9.5,
			lienPosition: 1,
			loanType: "conventional",
			ltvRatio: 65,
			marketplacePropertyType: "Detached Home",
			maturityDate: "2031-01-01",
			monthlyPayment: 2500,
			mortgageId,
			paymentFrequency: "monthly",
			principal: 500_000,
			propertyId,
			propertyType: "residential",
			province: "ON",
			publicDocumentIds: [],
			rateType: "fixed",
			status: "published",
			termMonths: 60,
			title: "King West Mortgage",
			updatedAt: Date.now(),
			viewCount: 0,
		});
		const sellerAccountId = await ctx.db.insert("ledger_accounts", {
			createdAt: Date.now(),
			cumulativeCredits: 0n,
			cumulativeDebits: 10_000n,
			lenderId: "seed_maple_mic_lender_fairlend_ca",
			mortgageId: String(mortgageId),
			pendingCredits: 0n,
			pendingDebits: 2500n,
			type: "POSITION",
		});
		const buyerAccountId = await ctx.db.insert("ledger_accounts", {
			createdAt: Date.now(),
			cumulativeCredits: 0n,
			cumulativeDebits: 0n,
			lenderId: String(lenderId),
			mortgageId: String(mortgageId),
			pendingCredits: 2500n,
			pendingDebits: 0n,
			type: "POSITION",
		});
		const reserveJournalEntryId = await ctx.db.insert(
			"ledger_journal_entries",
			{
				amount: 2500,
				creditAccountId: buyerAccountId,
				debitAccountId: sellerAccountId,
				effectiveDate: "2026-04-24",
				entryType: "SHARES_RESERVED",
				idempotencyKey: "checkout:http-webhook:reserve:journal",
				mortgageId: String(mortgageId),
				sequenceNumber: 1n,
				source: { type: "webhook", channel: "test" },
				timestamp: Date.now(),
			}
		);
		const reservationId = await ctx.db.insert("ledger_reservations", {
			amount: 2500,
			buyerAccountId,
			createdAt: Date.now(),
			mortgageId: String(mortgageId),
			reserveJournalEntryId,
			sellerAccountId,
			status: "pending",
		});
		const selectedLawyer = {
			type: "platform_lawyer" as const,
			lawyerId: "lawyer-auth",
			name: "Lawyer Auth",
			email: "lawyer@test.fairlend.ca",
		};
		const checkoutSessionId = await ctx.db.insert("checkoutSessions", {
			status: "hosted_checkout_open",
			listingId,
			mortgageId,
			portalId,
			lenderId,
			lenderAuthId: "checkout-buyer-auth",
			sellerAccountId,
			buyerAccountId,
			reservationId,
			requestedFractions: 2500,
			lockFeeAmount: CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
			lockFeeCurrency: "CAD",
			selectedLawyer,
			stripeCheckoutSessionId: "cs_test_http_checkout",
			stripePaymentIntentId: "pi_test_http_checkout",
			startedAt: Date.now(),
			expiresAt: Date.now() + 300_000,
			idempotencyKey: "marketplace-checkout:http-webhook",
			createdBy: "checkout-buyer-auth",
			updatedAt: Date.now(),
		});
		const metadata = buildCheckoutStripeMetadata({
			checkoutSessionId: String(checkoutSessionId),
			idempotencyKey: "marketplace-checkout:http-webhook",
			lenderAuthId: "checkout-buyer-auth",
			lenderId,
			listingId,
			mortgageId,
			portalId,
			requestedFractions: 2500,
			reservationId,
			selectedLawyer,
		});
		return { checkoutSessionId, metadata };
	});
}

beforeEach(() => {
	testEnvRestorers.length = 0;
	setTestEnv("STRIPE_WEBHOOK_SECRET", TEST_STRIPE_SECRET);
	setTestEnv("WORKOS_CLIENT_ID", "client_test_webhook");
	setTestEnv("WORKOS_API_KEY", "sk_test_webhook");
	setTestEnv("WORKOS_WEBHOOK_SECRET", "whsec_test_workos");
	vi.useFakeTimers();
	vi.setSystemTime(new Date(TEST_TIMESTAMP * 1000));
});

afterEach(() => {
	while (testEnvRestorers.length > 0) {
		testEnvRestorers.pop()?.();
	}
	vi.clearAllTimers();
	vi.useRealTimers();
});

// ── Tests ────────────────────────────────────────────────────────────

describe("Stripe webhook handler", () => {
	// ── Event filtering ──────────────────────────────────────────────

	describe("event type filtering", () => {
		it("recognizes charge.refunded as a reversal event", () => {
			expect(REVERSAL_EVENT_TYPES.has("charge.refunded")).toBe(true);
		});

		it("recognizes charge.dispute.created as a reversal event", () => {
			expect(REVERSAL_EVENT_TYPES.has("charge.dispute.created")).toBe(true);
		});

		it("recognizes payment_intent.payment_failed as a reversal event", () => {
			expect(REVERSAL_EVENT_TYPES.has("payment_intent.payment_failed")).toBe(
				true
			);
		});

		it("does not recognize charge.succeeded as a reversal event", () => {
			expect(REVERSAL_EVENT_TYPES.has("charge.succeeded")).toBe(false);
		});

		it("does not recognize payment_intent.succeeded as a reversal event", () => {
			expect(REVERSAL_EVENT_TYPES.has("payment_intent.succeeded")).toBe(false);
		});

		it("contains exactly 3 event types", () => {
			expect(REVERSAL_EVENT_TYPES.size).toBe(3);
		});

		it("recognizes checkout.session.completed as a checkout success event", () => {
			expect(
				CHECKOUT_SUCCESS_EVENT_TYPES.has("checkout.session.completed")
			).toBe(true);
		});

		it("recognizes checkout.session.async_payment_succeeded as a checkout success event", () => {
			expect(
				CHECKOUT_SUCCESS_EVENT_TYPES.has(
					"checkout.session.async_payment_succeeded"
				)
			).toBe(true);
		});
	});

	// ── Provider ref extraction ──────────────────────────────────────

	describe("extractProviderRef", () => {
		it("extracts providerRef from metadata.provider_ref for charge.refunded", () => {
			const event = makeEvent({
				type: "charge.refunded",
				data: {
					object: {
						id: "ch_abc",
						amount: 5000,
						metadata: { provider_ref: "ref_from_metadata" },
					},
				},
			});
			expect(extractProviderRef(event)).toBe("ref_from_metadata");
		});

		it("extracts providerRef from metadata.providerRef (camelCase) for charge.refunded", () => {
			const event = makeEvent({
				type: "charge.refunded",
				data: {
					object: {
						id: "ch_abc",
						amount: 5000,
						metadata: { providerRef: "ref_camel_case" },
					},
				},
			});
			expect(extractProviderRef(event)).toBe("ref_camel_case");
		});

		it("falls back to object ID when metadata missing for charge.refunded", () => {
			const event = makeEvent({
				type: "charge.refunded",
				data: {
					object: {
						id: "ch_fallback",
						amount: 5000,
					},
				},
			});
			expect(extractProviderRef(event)).toBe("ch_fallback");
		});

		it("falls back to object ID when metadata has no provider_ref", () => {
			const event = makeEvent({
				type: "charge.refunded",
				data: {
					object: {
						id: "ch_no_ref",
						amount: 5000,
						metadata: { other_key: "other_value" },
					},
				},
			});
			expect(extractProviderRef(event)).toBe("ch_no_ref");
		});

		it("uses charge field for dispute providerRef", () => {
			const event = makeEvent({
				type: "charge.dispute.created",
				data: {
					object: {
						id: "dp_001",
						amount: 3000,
						charge: "ch_disputed_charge",
					},
				},
			});
			expect(extractProviderRef(event)).toBe("ch_disputed_charge");
		});

		it("falls back to dispute object ID when charge missing", () => {
			const event = makeEvent({
				type: "charge.dispute.created",
				data: {
					object: {
						id: "dp_002",
						amount: 3000,
					},
				},
			});
			expect(extractProviderRef(event)).toBe("dp_002");
		});

		it("uses object ID for payment_intent.payment_failed", () => {
			const event = makeEvent({
				type: "payment_intent.payment_failed",
				data: {
					object: {
						id: "pi_failed_001",
						amount: 7500,
					},
				},
			});
			expect(extractProviderRef(event)).toBe("pi_failed_001");
		});

		it("uses object ID for unknown event types", () => {
			const event = makeEvent({
				type: "some.unknown.event",
				data: {
					object: {
						id: "obj_unknown",
						amount: 1000,
					},
				},
			});
			expect(extractProviderRef(event)).toBe("obj_unknown");
		});
	});

	// ── Payload mapping ──────────────────────────────────────────────

	describe("toPayload", () => {
		it("converts Stripe timestamp to YYYY-MM-DD date", () => {
			// 1711929600 = 2024-04-01T00:00:00Z
			const event = makeEvent({
				type: "charge.refunded",
				created: 1_711_929_600,
			});
			const payload = toPayload(event);
			expect(payload.reversalDate).toBe("2024-04-01");
		});

		it("sets provider to stripe", () => {
			const event = makeEvent({ type: "charge.refunded" });
			const payload = toPayload(event);
			expect(payload.provider).toBe("stripe");
		});

		it("uses event.id as providerEventId", () => {
			const event = makeEvent({
				type: "charge.refunded",
				id: "evt_unique_123",
			});
			const payload = toPayload(event);
			expect(payload.providerEventId).toBe("evt_unique_123");
		});

		it("passes amount directly (Stripe already uses cents)", () => {
			const event = makeEvent({
				type: "charge.refunded",
				data: {
					object: {
						id: "ch_001",
						amount: 15_075,
					},
				},
			});
			const payload = toPayload(event);
			expect(payload.originalAmount).toBe(15_075);
		});
	});

	// ── Reversal reason ──────────────────────────────────────────────

	describe("buildReversalReason", () => {
		it("formats ACH Return reason for charge.refunded", () => {
			const event = makeEvent({
				type: "charge.refunded",
				data: {
					object: {
						id: "ch_001",
						amount: 5000,
						reason: "fraudulent",
					},
				},
			});
			expect(buildReversalReason(event)).toBe("ACH Return: fraudulent");
		});

		it("falls back to status for charge.refunded when no reason", () => {
			const event = makeEvent({
				type: "charge.refunded",
				data: {
					object: {
						id: "ch_001",
						amount: 5000,
						status: "refunded",
					},
				},
			});
			expect(buildReversalReason(event)).toBe("ACH Return: refunded");
		});

		it("defaults to 'refunded' when no reason or status for charge.refunded", () => {
			const event = makeEvent({
				type: "charge.refunded",
				data: {
					object: {
						id: "ch_001",
						amount: 5000,
					},
				},
			});
			expect(buildReversalReason(event)).toBe("ACH Return: refunded");
		});

		it("formats dispute reason", () => {
			const event = makeEvent({
				type: "charge.dispute.created",
				data: {
					object: {
						id: "dp_001",
						amount: 3000,
						reason: "product_not_received",
					},
				},
			});
			expect(buildReversalReason(event)).toBe("Dispute: product_not_received");
		});

		it("defaults to 'opened' for dispute when no reason", () => {
			const event = makeEvent({
				type: "charge.dispute.created",
				data: {
					object: {
						id: "dp_001",
						amount: 3000,
					},
				},
			});
			expect(buildReversalReason(event)).toBe("Dispute: opened");
		});

		it("formats ACH Failure with failure_code and failure_message", () => {
			const event = makeEvent({
				type: "payment_intent.payment_failed",
				data: {
					object: {
						id: "pi_001",
						amount: 7500,
						failure_code: "insufficient_funds",
						failure_message: "The account has insufficient funds.",
					},
				},
			});
			expect(buildReversalReason(event)).toBe(
				"ACH Failure: insufficient_funds — The account has insufficient funds."
			);
		});

		it("defaults to 'unknown' for failed payment when no failure_code", () => {
			const event = makeEvent({
				type: "payment_intent.payment_failed",
				data: {
					object: {
						id: "pi_001",
						amount: 7500,
					},
				},
			});
			expect(buildReversalReason(event)).toBe("ACH Failure: unknown — ");
		});

		it("returns 'Unknown reversal' for unrecognized event types", () => {
			const event = makeEvent({
				type: "some.other.event",
			});
			expect(buildReversalReason(event)).toBe("Unknown reversal");
		});
	});

	// ── Reversal code ────────────────────────────────────────────────

	describe("buildReversalCode", () => {
		it("sets reversalCode to reason for charge.refunded", () => {
			const event = makeEvent({
				type: "charge.refunded",
				data: {
					object: {
						id: "ch_001",
						amount: 5000,
						reason: "fraudulent",
					},
				},
			});
			expect(buildReversalCode(event)).toBe("fraudulent");
		});

		it("defaults to REFUND when no reason for charge.refunded", () => {
			const event = makeEvent({
				type: "charge.refunded",
				data: {
					object: {
						id: "ch_001",
						amount: 5000,
					},
				},
			});
			expect(buildReversalCode(event)).toBe("REFUND");
		});

		it("sets reversalCode to DISPUTE for dispute events", () => {
			const event = makeEvent({
				type: "charge.dispute.created",
				data: {
					object: {
						id: "dp_001",
						amount: 3000,
					},
				},
			});
			expect(buildReversalCode(event)).toBe("DISPUTE");
		});

		it("maps failure_code for failed payments", () => {
			const event = makeEvent({
				type: "payment_intent.payment_failed",
				data: {
					object: {
						id: "pi_001",
						amount: 7500,
						failure_code: "insufficient_funds",
					},
				},
			});
			expect(buildReversalCode(event)).toBe("insufficient_funds");
		});

		it("returns undefined failure_code when missing for failed payments", () => {
			const event = makeEvent({
				type: "payment_intent.payment_failed",
				data: {
					object: {
						id: "pi_001",
						amount: 7500,
					},
				},
			});
			expect(buildReversalCode(event)).toBeUndefined();
		});

		it("returns undefined for unknown event types", () => {
			const event = makeEvent({
				type: "charge.succeeded",
			});
			expect(buildReversalCode(event)).toBeUndefined();
		});
	});
});

describe("stripe webhook persistence bridge", () => {
	it("marks persisted unsupported stripe reversal events failed", async () => {
		const t = createHarness();

		const webhookEventId = await t.run(async (ctx) => {
			return ctx.db.insert("webhookEvents", {
				provider: "stripe",
				providerEventId: "evt_stripe_unsupported_001",
				rawBody: '{"id":"evt_stripe_unsupported_001"}',
				status: "pending",
				receivedAt: Date.now(),
				attempts: 0,
				signatureVerified: true,
				normalizedEventType: "TRANSFER_REVERSED",
			});
		});

		const result = await t.action(
			internal.payments.webhooks.stripe.processUnsupportedStripeWebhook,
			{
				providerEventId: "evt_stripe_unsupported_001",
				webhookEventId,
			}
		);

		const webhook = await t.run(async (ctx) => ctx.db.get(webhookEventId));

		expect(result).toMatchObject({
			success: false,
			reason: "unsupported_provider",
			providerEventId: "evt_stripe_unsupported_001",
		});
		expect(webhook?.status).toBe("failed");
		expect(webhook?.error).toBe("unsupported_provider");
		expect(webhook?.attempts).toBe(1);
	});

	it("persists, schedules, and processes unsupported reversal events through the HTTP bridge", async () => {
		const t = createHarness();
		const event = makeEvent({
			type: "charge.refunded",
			id: "evt_stripe_bridge_001",
			data: {
				object: {
					id: "ch_stripe_bridge_001",
					amount: 15_075,
					reason: "fraudulent",
				},
			},
		});
		const body = JSON.stringify(event);
		const signature = buildStripeSignature(body);

		const response = await t.fetch("/webhooks/stripe", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"stripe-signature": signature,
			},
			body,
		});
		const payload = (await response.json()) as {
			accepted?: boolean;
			processing?: string;
			providerEventId?: string;
			reason?: string;
		};

		const persisted = await t.run(async (ctx) =>
			ctx.db
				.query("webhookEvents")
				.withIndex("by_provider_event", (q) =>
					q.eq("provider", "stripe").eq("providerEventId", event.id)
				)
				.unique()
		);

		expect(response.status).toBe(200);
		expect(payload).toMatchObject({
			accepted: true,
			processing: "deferred",
			providerEventId: event.id,
			reason: "unsupported_provider",
		});
		expect(persisted).toMatchObject({
			provider: "stripe",
			providerEventId: event.id,
			normalizedEventType: "TRANSFER_REVERSED",
			signatureVerified: true,
			status: "pending",
		});

		await t.finishAllScheduledFunctions(() => vi.runAllTimers());

		if (!persisted) {
			throw new Error("Expected persisted webhook event to exist");
		}

		const processed = await t.run(async (ctx) => ctx.db.get(persisted._id));
		expect(processed).toMatchObject({
			status: "failed",
			error: "unsupported_provider",
			attempts: 1,
		});
	});

	it("persists and reconciles marketplace checkout success through the HTTP bridge", async () => {
		const t = createHarness();
		const { checkoutSessionId, metadata } =
			await insertHostedMarketplaceCheckout(t);
		const event = makeEvent({
			type: "checkout.session.completed",
			id: "evt_checkout_success_new_001",
			data: {
				object: {
					id: "cs_test_http_checkout",
					amount: CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
					amount_total: CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
					currency: "cad",
					metadata,
					payment_intent: "pi_test_http_checkout",
					payment_status: "paid",
				},
			},
		});
		const body = JSON.stringify(event);
		const signature = buildStripeSignature(body);

		const response = await t.fetch("/webhooks/stripe", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"stripe-signature": signature,
			},
			body,
		});
		const payload = (await response.json()) as {
			accepted?: boolean;
			processing?: string;
			providerEventId?: string;
			result?: { status?: string };
		};

		const state = await t.run(async (ctx) => {
			const session = await ctx.db.get(checkoutSessionId);
			const deals = await ctx.db.query("deals").collect();
			const transferRequests = await ctx.db.query("transferRequests").collect();
			const webhook = await ctx.db
				.query("webhookEvents")
				.withIndex("by_provider_event", (q) =>
					q.eq("provider", "stripe").eq("providerEventId", event.id)
				)
				.unique();
			return { deals, session, transferRequests, webhook };
		});

		expect(response.status).toBe(200);
		expect(payload).toMatchObject({
			accepted: true,
			processing: "processed",
			providerEventId: event.id,
			result: { status: "completed" },
		});
		expect(state.session).toMatchObject({
			status: "completed",
			stripeCheckoutSessionId: "cs_test_http_checkout",
			stripePaymentIntentId: "pi_test_http_checkout",
			lockFeeTransferRequestId: state.transferRequests[0]?._id,
		});
		expect(state.transferRequests).toHaveLength(1);
		expect(state.transferRequests[0]).toMatchObject({
			amount: CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
			providerCode: "stripe",
			status: "confirmed",
			transferType: "locking_fee_collection",
		});
		expect(state.deals).toHaveLength(0);
		expect(state.webhook).toMatchObject({
			attempts: 1,
			provider: "stripe",
			providerEventId: event.id,
			signatureVerified: true,
			status: "processed",
		});
	});

	it("persists and reconciles async marketplace checkout success through the HTTP bridge", async () => {
		const t = createHarness();
		const { checkoutSessionId, metadata } =
			await insertHostedMarketplaceCheckout(t);
		const event = makeEvent({
			type: "checkout.session.async_payment_succeeded",
			id: "evt_checkout_async_success_001",
			data: {
				object: {
					id: "cs_test_http_checkout",
					amount: CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
					amount_total: CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
					currency: "cad",
					metadata,
					payment_intent: "pi_test_http_checkout",
					payment_status: "paid",
				},
			},
		});
		const body = JSON.stringify(event);
		const signature = buildStripeSignature(body);

		const response = await t.fetch("/webhooks/stripe", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"stripe-signature": signature,
			},
			body,
		});
		const payload = (await response.json()) as {
			accepted?: boolean;
			processing?: string;
			providerEventId?: string;
			result?: { status?: string };
		};

		const state = await t.run(async (ctx) => {
			const session = await ctx.db.get(checkoutSessionId);
			const transferRequests = await ctx.db.query("transferRequests").collect();
			const webhook = await ctx.db
				.query("webhookEvents")
				.withIndex("by_provider_event", (q) =>
					q.eq("provider", "stripe").eq("providerEventId", event.id)
				)
				.unique();
			return { session, transferRequests, webhook };
		});

		expect(response.status).toBe(200);
		expect(payload).toMatchObject({
			accepted: true,
			processing: "processed",
			providerEventId: event.id,
			result: { status: "completed" },
		});
		expect(state.session).toMatchObject({
			status: "completed",
			stripeCheckoutSessionId: "cs_test_http_checkout",
			stripePaymentIntentId: "pi_test_http_checkout",
			lockFeeTransferRequestId: state.transferRequests[0]?._id,
		});
		expect(state.transferRequests).toHaveLength(1);
		expect(state.webhook).toMatchObject({
			attempts: 1,
			provider: "stripe",
			providerEventId: event.id,
			signatureVerified: true,
			status: "processed",
		});
	});

	it("persists and processes deal-lock checkout success through the HTTP bridge", async () => {
		const t = createHarness();

		const checkoutSessionId = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {
				authId: "broker-auth",
				email: "broker@test.fairlend.ca",
				firstName: "Bryn",
				lastName: "Broker",
			});
			const brokerId = await ctx.db.insert("brokers", {
				createdAt: Date.now(),
				status: "active",
				userId,
			});
			const propertyId = await ctx.db.insert("properties", {
				city: "Toronto",
				createdAt: Date.now(),
				postalCode: "M5V 1A1",
				propertyType: "residential",
				province: "ON",
				streetAddress: "123 King St W",
			});
			const mortgageId = await ctx.db.insert("mortgages", {
				amortizationMonths: 300,
				brokerOfRecordId: brokerId,
				createdAt: Date.now(),
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
			const listingId = await ctx.db.insert("listings", {
				city: "Toronto",
				createdAt: Date.now(),
				dataSource: "mortgage_pipeline",
				featured: false,
				heroImages: [],
				interestRate: 9.5,
				lienPosition: 1,
				loanType: "conventional",
				ltvRatio: 65,
				marketplacePropertyType: "Detached Home",
				maturityDate: "2031-01-01",
				monthlyPayment: 2500,
				mortgageId,
				paymentFrequency: "monthly",
				principal: 500_000,
				propertyId,
				propertyType: "residential",
				province: "ON",
				publicDocumentIds: [],
				rateType: "fixed",
				status: "published",
				termMonths: 60,
				title: "King West Mortgage",
				updatedAt: Date.now(),
				viewCount: 0,
			});
			const sellerAccountId = await ctx.db.insert("ledger_accounts", {
				createdAt: Date.now(),
				cumulativeCredits: 0n,
				cumulativeDebits: 10_000n,
				lenderId: "seed_maple_mic_lender_fairlend_ca",
				mortgageId: String(mortgageId),
				pendingCredits: 0n,
				pendingDebits: 2500n,
				type: "POSITION",
			});
			const buyerAccountId = await ctx.db.insert("ledger_accounts", {
				createdAt: Date.now(),
				cumulativeCredits: 0n,
				cumulativeDebits: 0n,
				lenderId: "buyer-auth",
				mortgageId: String(mortgageId),
				pendingCredits: 2500n,
				pendingDebits: 0n,
				type: "POSITION",
			});
			const reserveJournalEntryId = await ctx.db.insert(
				"ledger_journal_entries",
				{
					amount: 2500,
					creditAccountId: buyerAccountId,
					debitAccountId: sellerAccountId,
					effectiveDate: "2026-04-24",
					entryType: "SHARES_RESERVED",
					idempotencyKey: "deal-lock:http-webhook:reserve:journal",
					mortgageId: String(mortgageId),
					sequenceNumber: 1n,
					source: { type: "webhook", channel: "test" },
					timestamp: Date.now(),
				}
			);
			const reservationId = await ctx.db.insert("ledger_reservations", {
				amount: 2500,
				buyerAccountId,
				createdAt: Date.now(),
				mortgageId: String(mortgageId),
				reserveJournalEntryId,
				sellerAccountId,
				status: "pending",
			});

			return await ctx.db.insert("dealLockCheckoutSessions", {
				buyerAuthId: "buyer-auth",
				createdAt: Date.now(),
				expiresAt: Date.now() + 300_000,
				fractionalShareUnits: 2500,
				idempotencyKey: "deal-lock:http-webhook",
				listingId,
				lockFeeAmountCents: DEAL_LOCK_FEE_AMOUNT_CENTS,
				lockFeeCurrency: "cad",
				mortgageId,
				refundStatus: "none",
				reservationId,
				selectedLawyerAuthId: "lawyer-auth",
				selectedLawyerType: "platform_lawyer",
				sellerAuthId: "seed_maple_mic_lender_fairlend_ca",
				status: "created",
				stripeCheckoutSessionId: "cs_test_http_deal_lock",
				stripeCheckoutUrl:
					"https://checkout.stripe.test/cs_test_http_deal_lock",
				updatedAt: Date.now(),
			});
		});

		const event = makeEvent({
			type: "checkout.session.completed",
			id: "evt_checkout_success_001",
			data: {
				object: {
					id: "cs_test_http_deal_lock",
					amount: DEAL_LOCK_FEE_AMOUNT_CENTS,
					amount_total: DEAL_LOCK_FEE_AMOUNT_CENTS,
					payment_intent: "pi_test_http_deal_lock",
					payment_status: "paid",
				},
			},
		});
		const body = JSON.stringify(event);
		const signature = buildStripeSignature(body);

		const response = await t.fetch("/webhooks/stripe", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"stripe-signature": signature,
			},
			body,
		});
		const payload = (await response.json()) as {
			accepted?: boolean;
			processing?: string;
			providerEventId?: string;
			result?: { outcome?: string; dealId?: string };
		};

		const state = await t.run(async (ctx) => {
			const session = await ctx.db.get(checkoutSessionId);
			const deals = await ctx.db.query("deals").collect();
			const webhook = await ctx.db
				.query("webhookEvents")
				.withIndex("by_provider_event", (q) =>
					q.eq("provider", "stripe").eq("providerEventId", event.id)
				)
				.unique();
			return { deals, session, webhook };
		});

		expect(response.status).toBe(200);
		expect(payload).toMatchObject({
			accepted: true,
			processing: "processed",
			providerEventId: event.id,
			result: { outcome: "deal_created" },
		});
		expect(state.session).toMatchObject({
			status: "paid",
			stripePaymentIntentId: "pi_test_http_deal_lock",
			stripePaymentStatus: "paid",
		});
		expect(state.deals).toHaveLength(1);
		expect(state.deals[0]).toMatchObject({
			dealLockCheckoutSessionId: checkoutSessionId,
			lockFeeCollectionProvider: "stripe_checkout",
			lockFeeCollectionStatus: "collected",
			status: "lawyerOnboarding.pending",
			stripeCheckoutSessionId: "cs_test_http_deal_lock",
		});
		expect(state.webhook).toMatchObject({
			provider: "stripe",
			providerEventId: event.id,
			signatureVerified: true,
			status: "processed",
		});
	});

	it("rejects unpaid deal-lock checkout completion before creating a deal", async () => {
		const t = createHarness();
		const event = makeEvent({
			type: "checkout.session.completed",
			id: "evt_checkout_unpaid_001",
			data: {
				object: {
					id: "cs_test_http_unpaid",
					amount: DEAL_LOCK_FEE_AMOUNT_CENTS,
					amount_total: DEAL_LOCK_FEE_AMOUNT_CENTS,
					payment_intent: "pi_test_http_unpaid",
					payment_status: "unpaid",
				},
			},
		});
		const body = JSON.stringify(event);
		const signature = buildStripeSignature(body);

		const response = await t.fetch("/webhooks/stripe", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"stripe-signature": signature,
			},
			body,
		});
		const payload = (await response.json()) as {
			accepted?: boolean;
			error?: string;
			processing?: string;
		};
		const state = await t.run(async (ctx) => {
			const deals = await ctx.db.query("deals").collect();
			const webhook = await ctx.db
				.query("webhookEvents")
				.withIndex("by_provider_event", (q) =>
					q.eq("provider", "stripe").eq("providerEventId", event.id)
				)
				.unique();
			return { deals, webhook };
		});

		expect(response.status).toBe(400);
		expect(payload).toMatchObject({
			accepted: false,
			error: "checkout_payment_not_paid",
			processing: "failed",
		});
		expect(state.deals).toHaveLength(0);
		expect(state.webhook).toMatchObject({
			provider: "stripe",
			providerEventId: event.id,
			signatureVerified: true,
			status: "failed",
		});
	});
});
