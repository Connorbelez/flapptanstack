import {
	CHECKOUT_LOCK_FEE_AMOUNT_CENTS,
	CHECKOUT_LOCK_FEE_CURRENCY,
} from "./validators";

export interface HostedCheckoutMetadata {
	readonly checkoutSessionId: string;
	readonly idempotencyKey: string;
	readonly lenderAuthId: string;
	readonly lenderId: string;
	readonly listingId: string;
	readonly lockFeeAmount: string;
	readonly lockFeeCurrency: string;
	readonly mortgageId: string;
	readonly portalId: string;
	readonly requestedFractions: string;
	readonly reservationId: string;
	readonly selectedLawyerId: string;
	readonly selectedLawyerType: string;
}

export interface CreateHostedCheckoutSessionRequest {
	readonly cancelUrl: string;
	readonly idempotencyKey: string;
	readonly metadata: HostedCheckoutMetadata;
	readonly successUrl: string;
}

export interface HostedCheckoutSession {
	readonly paymentIntentId?: string;
	readonly stripeCheckoutSessionId: string;
	readonly url: string;
}

export interface RefundPaymentIntentRequest {
	readonly amount: number;
	readonly idempotencyKey: string;
	readonly paymentIntentId: string;
}

export interface RefundPaymentIntentResult {
	readonly stripeRefundId: string;
}

export interface CheckoutProvider {
	createHostedCheckoutSession(
		request: CreateHostedCheckoutSessionRequest
	): Promise<HostedCheckoutSession>;
	expireHostedCheckoutSession(
		stripeCheckoutSessionId: string
	): Promise<
		{ readonly ok: true } | { readonly ok: false; readonly error: string }
	>;
	refundPaymentIntent(
		request: RefundPaymentIntentRequest
	): Promise<RefundPaymentIntentResult>;
}

export interface StripeCheckoutProviderConfig {
	readonly apiBaseUrl?: string;
	readonly fetch?: typeof fetch;
	readonly secretKey: string;
}

interface StripeCheckoutSessionResponse {
	readonly id?: unknown;
	readonly payment_intent?: unknown;
	readonly url?: unknown;
}

interface StripeRefundResponse {
	readonly id?: unknown;
}

const STRIPE_API_VERSION = "2025-10-29.clover";
const DEFAULT_STRIPE_API_BASE_URL = "https://api.stripe.com";
const LOCK_FEE_PRODUCT_NAME = "FairLend marketplace lock fee";

function assertNonEmptyString(value: string, label: string): void {
	if (value.trim().length === 0) {
		throw new Error(`${label} must be non-empty`);
	}
}

function appendMetadata(
	params: URLSearchParams,
	prefix: string,
	metadata: HostedCheckoutMetadata
): void {
	for (const [key, value] of Object.entries(metadata)) {
		const field =
			prefix.length > 0 ? `${prefix}[metadata][${key}]` : `metadata[${key}]`;
		params.append(field, value);
	}
}

export function buildStripeCheckoutSessionParams(
	request: CreateHostedCheckoutSessionRequest
): URLSearchParams {
	assertNonEmptyString(request.successUrl, "successUrl");
	assertNonEmptyString(request.cancelUrl, "cancelUrl");
	assertNonEmptyString(request.idempotencyKey, "idempotencyKey");

	const params = new URLSearchParams();
	params.append("mode", "payment");
	params.append("success_url", request.successUrl);
	params.append("cancel_url", request.cancelUrl);
	params.append("automatic_payment_methods[enabled]", "true");
	params.append("line_items[0][quantity]", "1");
	params.append(
		"line_items[0][price_data][currency]",
		CHECKOUT_LOCK_FEE_CURRENCY.toLowerCase()
	);
	params.append(
		"line_items[0][price_data][unit_amount]",
		String(CHECKOUT_LOCK_FEE_AMOUNT_CENTS)
	);
	params.append(
		"line_items[0][price_data][product_data][name]",
		LOCK_FEE_PRODUCT_NAME
	);
	appendMetadata(params, "", request.metadata);
	appendMetadata(params, "payment_intent_data", request.metadata);
	return params;
}

function readStripeCheckoutSessionResponse(
	value: StripeCheckoutSessionResponse
): HostedCheckoutSession {
	if (typeof value.id !== "string" || value.id.trim().length === 0) {
		throw new Error("Stripe checkout response missing id");
	}
	if (typeof value.url !== "string" || value.url.trim().length === 0) {
		throw new Error("Stripe checkout response missing url");
	}
	if (
		value.payment_intent !== undefined &&
		value.payment_intent !== null &&
		typeof value.payment_intent !== "string"
	) {
		throw new Error("Stripe checkout response payment_intent must be a string");
	}
	return {
		stripeCheckoutSessionId: value.id,
		url: value.url,
		...(typeof value.payment_intent === "string"
			? { paymentIntentId: value.payment_intent }
			: {}),
	};
}

function readStripeRefundResponse(value: StripeRefundResponse) {
	if (typeof value.id !== "string" || value.id.trim().length === 0) {
		throw new Error("Stripe refund response missing id");
	}
	return { stripeRefundId: value.id };
}

async function parseStripeResponse(response: Response): Promise<unknown> {
	const body = await response.text();
	if (!response.ok) {
		throw new Error(
			`Stripe Checkout request failed with ${response.status}: ${body}`
		);
	}
	return body.length > 0 ? JSON.parse(body) : {};
}

export function createStripeCheckoutProvider(
	config: StripeCheckoutProviderConfig
): CheckoutProvider {
	const fetchImpl = config.fetch ?? fetch;
	const apiBaseUrl = config.apiBaseUrl ?? DEFAULT_STRIPE_API_BASE_URL;
	assertNonEmptyString(config.secretKey, "secretKey");

	return {
		async createHostedCheckoutSession(request) {
			const response = await fetchImpl(`${apiBaseUrl}/v1/checkout/sessions`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${config.secretKey}`,
					"Content-Type": "application/x-www-form-urlencoded",
					"Idempotency-Key": request.idempotencyKey,
					"Stripe-Version": STRIPE_API_VERSION,
				},
				body: buildStripeCheckoutSessionParams(request),
			});
			const parsed = (await parseStripeResponse(
				response
			)) as StripeCheckoutSessionResponse;
			return readStripeCheckoutSessionResponse(parsed);
		},
		async expireHostedCheckoutSession(stripeCheckoutSessionId) {
			assertNonEmptyString(stripeCheckoutSessionId, "stripeCheckoutSessionId");
			const encoded = encodeURIComponent(stripeCheckoutSessionId);
			const response = await fetchImpl(
				`${apiBaseUrl}/v1/checkout/sessions/${encoded}/expire`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${config.secretKey}`,
						"Stripe-Version": STRIPE_API_VERSION,
					},
				}
			);
			if (response.ok) {
				return { ok: true };
			}
			return {
				ok: false,
				error: `Stripe Checkout expire failed with ${response.status}: ${await response.text()}`,
			};
		},
		async refundPaymentIntent(request) {
			assertNonEmptyString(request.paymentIntentId, "paymentIntentId");
			assertNonEmptyString(request.idempotencyKey, "idempotencyKey");
			if (!Number.isInteger(request.amount) || request.amount <= 0) {
				throw new Error("Refund amount must be a positive integer");
			}
			const params = new URLSearchParams();
			params.append("payment_intent", request.paymentIntentId);
			params.append("amount", String(request.amount));
			const response = await fetchImpl(`${apiBaseUrl}/v1/refunds`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${config.secretKey}`,
					"Content-Type": "application/x-www-form-urlencoded",
					"Idempotency-Key": request.idempotencyKey,
					"Stripe-Version": STRIPE_API_VERSION,
				},
				body: params,
			});
			const parsed = (await parseStripeResponse(
				response
			)) as StripeRefundResponse;
			return readStripeRefundResponse(parsed);
		},
	};
}

export function createStripeCheckoutProviderFromEnv(): CheckoutProvider {
	const secretKey = process.env.STRIPE_SECRET_KEY;
	if (!secretKey) {
		throw new Error("STRIPE_SECRET_KEY is not configured");
	}
	return createStripeCheckoutProvider({ secretKey });
}

export function readCheckoutRedirectUrlsFromEnv(): {
	readonly cancelUrl: string;
	readonly successUrl: string;
} {
	const successUrl = process.env.STRIPE_CHECKOUT_SUCCESS_URL;
	const cancelUrl = process.env.STRIPE_CHECKOUT_CANCEL_URL;
	if (!successUrl) {
		throw new Error("STRIPE_CHECKOUT_SUCCESS_URL is not configured");
	}
	if (!cancelUrl) {
		throw new Error("STRIPE_CHECKOUT_CANCEL_URL is not configured");
	}
	return { successUrl, cancelUrl };
}
