import { describe, expect, it } from "vitest";
import {
	buildStripeCheckoutSessionParams,
	type CreateHostedCheckoutSessionRequest,
	createStripeCheckoutProvider,
} from "../stripe";

const request: CreateHostedCheckoutSessionRequest = {
	successUrl: "https://portal.example.com/checkout/success",
	cancelUrl: "https://portal.example.com/checkout/cancel",
	idempotencyKey: "marketplace-checkout:checkout_123",
	metadata: {
		checkoutSessionId: "checkout_123",
		reservationId: "reservation_123",
		listingId: "listing_123",
		mortgageId: "mortgage_123",
		portalId: "portal_123",
		lenderId: "lender_123",
		lenderAuthId: "user_123",
		selectedLawyerType: "platform_lawyer",
		selectedLawyerId: "lawyer_123",
		requestedFractions: "10",
		lockFeeAmount: "25000",
		lockFeeCurrency: "CAD",
		idempotencyKey: "marketplace-checkout:checkout_123",
	},
};

function response(
	body: Record<string, unknown>,
	init: ResponseInit = { status: 200 }
): Response {
	return new Response(JSON.stringify(body), init);
}

describe("Stripe Checkout provider", () => {
	it("builds hosted Checkout params with lock fee and mirrored metadata", () => {
		const params = buildStripeCheckoutSessionParams(request);

		expect(params.get("mode")).toBe("payment");
		expect(params.get("success_url")).toBe(request.successUrl);
		expect(params.get("cancel_url")).toBe(request.cancelUrl);
		expect(params.get("automatic_payment_methods[enabled]")).toBe("true");
		expect(params.get("line_items[0][quantity]")).toBe("1");
		expect(params.get("line_items[0][price_data][currency]")).toBe("cad");
		expect(params.get("line_items[0][price_data][unit_amount]")).toBe("25000");
		expect(params.get("metadata[checkoutSessionId]")).toBe("checkout_123");
		expect(params.get("metadata[reservationId]")).toBe("reservation_123");
		expect(params.get("payment_intent_data[metadata][checkoutSessionId]")).toBe(
			"checkout_123"
		);
		expect(params.get("metadata[idempotencyKey]")).toBe(
			"marketplace-checkout:checkout_123"
		);
	});

	it("creates hosted Checkout sessions with Stripe idempotency", async () => {
		const calls: RequestInit[] = [];
		const provider = createStripeCheckoutProvider({
			secretKey: "sk_test_123",
			apiBaseUrl: "https://stripe.test",
			fetch: async (_url, init) => {
				calls.push(init ?? {});
				return response({
					id: "cs_test_123",
					url: "https://checkout.stripe.test/session",
					payment_intent: "pi_test_123",
				});
			},
		});

		await expect(
			provider.createHostedCheckoutSession(request)
		).resolves.toEqual({
			stripeCheckoutSessionId: "cs_test_123",
			url: "https://checkout.stripe.test/session",
			paymentIntentId: "pi_test_123",
		});
		expect(calls).toHaveLength(1);
		expect(calls[0]?.headers).toMatchObject({
			Authorization: "Bearer sk_test_123",
			"Content-Type": "application/x-www-form-urlencoded",
			"Idempotency-Key": "marketplace-checkout:checkout_123",
		});
	});

	it("rejects malformed hosted Checkout responses", async () => {
		const provider = createStripeCheckoutProvider({
			secretKey: "sk_test_123",
			fetch: async () => response({ id: "cs_test_123" }),
		});

		await expect(provider.createHostedCheckoutSession(request)).rejects.toThrow(
			"missing url"
		);
	});

	it("surfaces Stripe provider failures", async () => {
		const provider = createStripeCheckoutProvider({
			secretKey: "sk_test_123",
			fetch: async () => new Response("timeout", { status: 504 }),
		});

		await expect(provider.createHostedCheckoutSession(request)).rejects.toThrow(
			"Stripe Checkout request failed with 504"
		);
	});

	it("expires hosted Checkout sessions when provider attach fails", async () => {
		const urls: string[] = [];
		const calls: RequestInit[] = [];
		const provider = createStripeCheckoutProvider({
			secretKey: "sk_test_123",
			apiBaseUrl: "https://stripe.test",
			fetch: async (url, init) => {
				urls.push(String(url));
				calls.push(init ?? {});
				return new Response("{}", { status: 200 });
			},
		});

		await expect(
			provider.expireHostedCheckoutSession({
				idempotencyKey: "marketplace-checkout-provider-expire:checkout_123",
				stripeCheckoutSessionId: "cs_test_123",
			})
		).resolves.toEqual({ ok: true });
		expect(urls).toEqual([
			"https://stripe.test/v1/checkout/sessions/cs_test_123/expire",
		]);
		expect(calls[0]?.headers).toMatchObject({
			Authorization: "Bearer sk_test_123",
			"Idempotency-Key": "marketplace-checkout-provider-expire:checkout_123",
		});
	});

	it("treats already-expired hosted Checkout sessions as provider expiry success", async () => {
		const provider = createStripeCheckoutProvider({
			secretKey: "sk_test_123",
			apiBaseUrl: "https://stripe.test",
			fetch: async () =>
				new Response(
					JSON.stringify({
						error: {
							message: "This Checkout Session is already expired.",
						},
					}),
					{ status: 400 }
				),
		});

		await expect(
			provider.expireHostedCheckoutSession({
				idempotencyKey: "marketplace-checkout-provider-expire:checkout_123",
				stripeCheckoutSessionId: "cs_test_123",
			})
		).resolves.toEqual({ ok: true });
	});

	it("refunds payment intents with Stripe idempotency", async () => {
		const calls: Array<{ body: string; init: RequestInit; url: string }> = [];
		const provider = createStripeCheckoutProvider({
			secretKey: "sk_test_123",
			apiBaseUrl: "https://stripe.test",
			fetch: async (url, init) => {
				calls.push({
					url: String(url),
					init: init ?? {},
					body: String(init?.body),
				});
				return response({ id: "re_test_123" });
			},
		});

		await expect(
			provider.refundPaymentIntent({
				amount: 25_000,
				idempotencyKey: "refund-key",
				paymentIntentId: "pi_test_123",
			})
		).resolves.toEqual({ stripeRefundId: "re_test_123" });
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe("https://stripe.test/v1/refunds");
		expect(calls[0]?.body).toContain("payment_intent=pi_test_123");
		expect(calls[0]?.body).toContain("amount=25000");
		expect(calls[0]?.init.headers).toMatchObject({
			Authorization: "Bearer sk_test_123",
			"Idempotency-Key": "refund-key",
		});
	});
});
