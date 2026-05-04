import { describe, expect, it } from "vitest";
import {
	buildStripeCheckoutSessionParams,
	type CreateHostedCheckoutSessionRequest,
	createStripeCheckoutProvider,
	readCheckoutRedirectUrlsFromEnv,
} from "../stripe";

const request: CreateHostedCheckoutSessionRequest = {
	successUrl: "https://portal.example.com/checkout/success",
	cancelUrl: "https://portal.example.com/checkout/cancel",
	expiresAt: Date.parse("2026-05-04T16:05:00.000Z"),
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
	it("defaults hosted Checkout redirects to the in-app confirmation flow", () => {
		const originalAppUrl = process.env.FAIRLEND_APP_URL;
		const originalSuccessUrl = process.env.STRIPE_CHECKOUT_SUCCESS_URL;
		const originalCancelUrl = process.env.STRIPE_CHECKOUT_CANCEL_URL;
		process.env.FAIRLEND_APP_URL = "http://app.localhost:3000/";
		process.env.STRIPE_CHECKOUT_SUCCESS_URL = "";
		process.env.STRIPE_CHECKOUT_CANCEL_URL = "";
		try {
			expect(
				readCheckoutRedirectUrlsFromEnv({ listingId: "listing_123" })
			).toEqual({
				successUrl:
					"http://app.localhost:3000/checkout/complete?stripeCheckoutSessionId={CHECKOUT_SESSION_ID}",
				cancelUrl:
					"http://app.localhost:3000/listings/listing_123?checkout=abandoned",
			});
		} finally {
			process.env.FAIRLEND_APP_URL = originalAppUrl;
			process.env.STRIPE_CHECKOUT_SUCCESS_URL = originalSuccessUrl;
			process.env.STRIPE_CHECKOUT_CANCEL_URL = originalCancelUrl;
		}
	});

	it("keeps explicit hosted Checkout redirects when configured", () => {
		const originalSuccessUrl = process.env.STRIPE_CHECKOUT_SUCCESS_URL;
		const originalCancelUrl = process.env.STRIPE_CHECKOUT_CANCEL_URL;
		process.env.STRIPE_CHECKOUT_SUCCESS_URL = "https://portal.example.com/paid";
		process.env.STRIPE_CHECKOUT_CANCEL_URL =
			"https://portal.example.com/canceled";
		try {
			expect(readCheckoutRedirectUrlsFromEnv()).toEqual({
				successUrl: "https://portal.example.com/paid",
				cancelUrl: "https://portal.example.com/canceled",
			});
		} finally {
			process.env.STRIPE_CHECKOUT_SUCCESS_URL = originalSuccessUrl;
			process.env.STRIPE_CHECKOUT_CANCEL_URL = originalCancelUrl;
		}
	});

	it("builds hosted Checkout params with lock fee and mirrored metadata", () => {
		const params = buildStripeCheckoutSessionParams(request);

		expect(params.get("mode")).toBe("payment");
		expect(params.get("success_url")).toBe(request.successUrl);
		expect(params.get("cancel_url")).toBe(request.cancelUrl);
		expect(params.get("automatic_payment_methods[enabled]")).toBe("true");
		expect(params.has("automatic_payment_methods")).toBe(false);
		expect(params.has("payment_method_types[0]")).toBe(false);
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

	it("adds Stripe Checkout provider expiry from the prepared checkout expiry", () => {
		const params = buildStripeCheckoutSessionParams({
			...request,
			expiresAt: Date.parse("2026-05-04T16:05:30.000Z"),
		} as CreateHostedCheckoutSessionRequest & { readonly expiresAt: number });

		expect(params.get("expires_at")).toBe(
			String(Date.parse("2026-05-04T16:05:30.000Z") / 1000)
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

	it("passes timeout signals to Stripe fetch calls", async () => {
		const signals: Array<AbortSignal | null> = [];
		const provider = createStripeCheckoutProvider({
			secretKey: "sk_test_123",
			apiBaseUrl: "https://stripe.test",
			requestTimeoutMs: 1000,
			fetch: async (_url, init) => {
				signals.push(init?.signal ?? null);
				return response({
					id: "cs_test_123",
					url: "https://checkout.stripe.test/session",
				});
			},
		} as Parameters<typeof createStripeCheckoutProvider>[0] & {
			readonly requestTimeoutMs: number;
		});

		await provider.createHostedCheckoutSession(request);

		expect(signals).toHaveLength(1);
		expect(signals[0]).toBeInstanceOf(AbortSignal);
		expect(signals[0]?.aborted).toBe(false);
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
			"Stripe API request failed with 504"
		);
	});

	it("retrieves paid hosted Checkout sessions for return-page reconciliation", async () => {
		const urls: string[] = [];
		const provider = createStripeCheckoutProvider({
			secretKey: "sk_test_123",
			apiBaseUrl: "https://stripe.test",
			fetch: async (url) => {
				urls.push(String(url));
				return response({
					id: "cs_test_123",
					amount_total: 25_000,
					currency: "cad",
					metadata: request.metadata,
					payment_intent: "pi_test_123",
					payment_status: "paid",
					status: "complete",
				});
			},
		});

		await expect(
			provider.retrieveHostedCheckoutSession({
				stripeCheckoutSessionId: "cs_test_123",
			})
		).resolves.toEqual({
			amountTotal: 25_000,
			currency: "cad",
			metadata: request.metadata,
			paymentIntentId: "pi_test_123",
			paymentStatus: "paid",
			status: "complete",
			stripeCheckoutSessionId: "cs_test_123",
		});
		expect(urls).toEqual([
			"https://stripe.test/v1/checkout/sessions/cs_test_123",
		]);
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
