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
	readonly expiresAt: number;
	readonly idempotencyKey: string;
	readonly metadata: HostedCheckoutMetadata;
	readonly successUrl: string;
}

export interface HostedCheckoutSession {
	readonly paymentIntentId?: string;
	readonly stripeCheckoutSessionId: string;
	readonly url: string;
}

export interface RetrievedHostedCheckoutSession {
	readonly amountTotal?: number;
	readonly currency?: string;
	readonly metadata: Record<string, string>;
	readonly paymentIntentId?: string;
	readonly paymentStatus?: string;
	readonly status?: string;
	readonly stripeCheckoutSessionId: string;
}

export interface RefundPaymentIntentRequest {
	readonly amount: number;
	readonly idempotencyKey: string;
	readonly paymentIntentId: string;
}

export interface RefundPaymentIntentResult {
	readonly stripeRefundId: string;
}

export interface ExpireHostedCheckoutSessionRequest {
	readonly idempotencyKey: string;
	readonly stripeCheckoutSessionId: string;
}

export interface CheckoutProvider {
	createHostedCheckoutSession(
		request: CreateHostedCheckoutSessionRequest
	): Promise<HostedCheckoutSession>;
	expireHostedCheckoutSession(
		request: ExpireHostedCheckoutSessionRequest
	): Promise<
		{ readonly ok: true } | { readonly ok: false; readonly error: string }
	>;
	refundPaymentIntent(
		request: RefundPaymentIntentRequest
	): Promise<RefundPaymentIntentResult>;
	retrieveHostedCheckoutSession(request: {
		readonly stripeCheckoutSessionId: string;
	}): Promise<RetrievedHostedCheckoutSession>;
}

export interface StripeCheckoutProviderConfig {
	readonly apiBaseUrl?: string;
	readonly fetch?: typeof fetch;
	readonly requestTimeoutMs?: number;
	readonly secretKey: string;
}

interface StripeCheckoutSessionResponse {
	readonly amount_total?: unknown;
	readonly currency?: unknown;
	readonly id?: unknown;
	readonly metadata?: unknown;
	readonly payment_intent?: unknown;
	readonly payment_status?: unknown;
	readonly status?: unknown;
	readonly url?: unknown;
}

interface StripeRefundResponse {
	readonly id?: unknown;
}

const STRIPE_API_VERSION = "2025-10-29.clover";
const DEFAULT_STRIPE_API_BASE_URL = "https://api.stripe.com";
const DEFAULT_STRIPE_REQUEST_TIMEOUT_MS = 15_000;
const LOCK_FEE_PRODUCT_NAME = "FairLend marketplace lock fee";
const STRIPE_CHECKOUT_SESSION_ID_TEMPLATE = "{CHECKOUT_SESSION_ID}";
const TRAILING_SLASH_PATTERN = /\/$/;

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

function stripeExpiresAtSeconds(expiresAt: number): string {
	if (!Number.isInteger(expiresAt) || expiresAt <= 0) {
		throw new Error("expiresAt must be a positive integer timestamp");
	}
	return String(Math.ceil(expiresAt / 1000));
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
	params.append("expires_at", stripeExpiresAtSeconds(request.expiresAt));
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

function readStripeMetadata(value: unknown): Record<string, string> {
	if (value === undefined || value === null) {
		return {};
	}
	if (typeof value !== "object") {
		throw new Error("Stripe checkout response metadata must be an object");
	}
	const metadata: Record<string, string> = {};
	for (const [key, item] of Object.entries(value)) {
		if (typeof item !== "string") {
			throw new Error(
				"Stripe checkout response metadata values must be strings"
			);
		}
		metadata[key] = item;
	}
	return metadata;
}

function optionalNumber(value: unknown, label: string): number | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}
	if (typeof value !== "number") {
		throw new Error(`Stripe checkout response ${label} must be a number`);
	}
	return value;
}

function optionalString(value: unknown, label: string): string | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}
	if (typeof value !== "string") {
		throw new Error(`Stripe checkout response ${label} must be a string`);
	}
	return value;
}

function readRetrievedStripeCheckoutSessionResponse(
	value: StripeCheckoutSessionResponse
): RetrievedHostedCheckoutSession {
	if (typeof value.id !== "string" || value.id.trim().length === 0) {
		throw new Error("Stripe checkout response missing id");
	}
	const paymentIntentId = optionalString(
		value.payment_intent,
		"payment_intent"
	);
	return {
		amountTotal: optionalNumber(value.amount_total, "amount_total"),
		currency: optionalString(value.currency, "currency"),
		metadata: readStripeMetadata(value.metadata),
		paymentStatus: optionalString(value.payment_status, "payment_status"),
		status: optionalString(value.status, "status"),
		stripeCheckoutSessionId: value.id,
		...(paymentIntentId ? { paymentIntentId } : {}),
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
			`Stripe API request failed with ${response.status}: ${body}`
		);
	}
	return body.length > 0 ? JSON.parse(body) : {};
}

function checkoutSessionAlreadyExpired(body: string): boolean {
	return body.toLowerCase().includes("already expired");
}

async function fetchStripeWithTimeout(
	fetchImpl: typeof fetch,
	url: string,
	init: RequestInit,
	timeoutMs: number
): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetchImpl(url, {
			...init,
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timeout);
	}
}

export function createStripeCheckoutProvider(
	config: StripeCheckoutProviderConfig
): CheckoutProvider {
	const fetchImpl = config.fetch ?? fetch;
	const apiBaseUrl = config.apiBaseUrl ?? DEFAULT_STRIPE_API_BASE_URL;
	const requestTimeoutMs =
		config.requestTimeoutMs ?? DEFAULT_STRIPE_REQUEST_TIMEOUT_MS;
	assertNonEmptyString(config.secretKey, "secretKey");
	if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs <= 0) {
		throw new Error("requestTimeoutMs must be a positive integer");
	}

	return {
		async createHostedCheckoutSession(request) {
			const response = await fetchStripeWithTimeout(
				fetchImpl,
				`${apiBaseUrl}/v1/checkout/sessions`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${config.secretKey}`,
						"Content-Type": "application/x-www-form-urlencoded",
						"Idempotency-Key": request.idempotencyKey,
						"Stripe-Version": STRIPE_API_VERSION,
					},
					body: buildStripeCheckoutSessionParams(request),
				},
				requestTimeoutMs
			);
			const parsed = (await parseStripeResponse(
				response
			)) as StripeCheckoutSessionResponse;
			return readStripeCheckoutSessionResponse(parsed);
		},
		async retrieveHostedCheckoutSession(request) {
			assertNonEmptyString(
				request.stripeCheckoutSessionId,
				"stripeCheckoutSessionId"
			);
			const encoded = encodeURIComponent(request.stripeCheckoutSessionId);
			const response = await fetchStripeWithTimeout(
				fetchImpl,
				`${apiBaseUrl}/v1/checkout/sessions/${encoded}`,
				{
					headers: {
						Authorization: `Bearer ${config.secretKey}`,
						"Stripe-Version": STRIPE_API_VERSION,
					},
					method: "GET",
				},
				requestTimeoutMs
			);
			const parsed = (await parseStripeResponse(
				response
			)) as StripeCheckoutSessionResponse;
			return readRetrievedStripeCheckoutSessionResponse(parsed);
		},
		async expireHostedCheckoutSession(request) {
			assertNonEmptyString(
				request.stripeCheckoutSessionId,
				"stripeCheckoutSessionId"
			);
			assertNonEmptyString(request.idempotencyKey, "idempotencyKey");
			const encoded = encodeURIComponent(request.stripeCheckoutSessionId);
			const response = await fetchStripeWithTimeout(
				fetchImpl,
				`${apiBaseUrl}/v1/checkout/sessions/${encoded}/expire`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${config.secretKey}`,
						"Idempotency-Key": request.idempotencyKey,
						"Stripe-Version": STRIPE_API_VERSION,
					},
				},
				requestTimeoutMs
			);
			if (response.ok) {
				return { ok: true };
			}
			const body = await response.text();
			if (checkoutSessionAlreadyExpired(body)) {
				return { ok: true };
			}
			return {
				ok: false,
				error: `Stripe Checkout expire failed with ${response.status}: ${body}`,
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
			const response = await fetchStripeWithTimeout(
				fetchImpl,
				`${apiBaseUrl}/v1/refunds`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${config.secretKey}`,
						"Content-Type": "application/x-www-form-urlencoded",
						"Idempotency-Key": request.idempotencyKey,
						"Stripe-Version": STRIPE_API_VERSION,
					},
					body: params,
				},
				requestTimeoutMs
			);
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

function readAppBaseUrlFromEnv(): string {
	return (
		process.env.FAIRLEND_APP_URL ??
		process.env.SITE_URL ??
		process.env.VITE_APP_URL ??
		"http://app.localhost:3000"
	).replace(TRAILING_SLASH_PATTERN, "");
}

function defaultCheckoutSuccessUrl(): string {
	return `${readAppBaseUrlFromEnv()}/checkout/complete?stripeCheckoutSessionId=${STRIPE_CHECKOUT_SESSION_ID_TEMPLATE}`;
}

function defaultCheckoutCancelUrl(listingId?: string): string {
	const listingPath =
		listingId && listingId.trim().length > 0
			? `/listings/${encodeURIComponent(listingId)}`
			: "/listings";
	return `${readAppBaseUrlFromEnv()}${listingPath}?checkout=abandoned`;
}

function configuredUrl(value: string | undefined): string | undefined {
	return value && value.trim().length > 0 ? value : undefined;
}

export function readCheckoutRedirectUrlsFromEnv(args?: {
	readonly listingId?: string;
}): {
	readonly cancelUrl: string;
	readonly successUrl: string;
} {
	const successUrl =
		configuredUrl(process.env.STRIPE_CHECKOUT_SUCCESS_URL) ??
		defaultCheckoutSuccessUrl();
	const cancelUrl =
		configuredUrl(process.env.STRIPE_CHECKOUT_CANCEL_URL) ??
		defaultCheckoutCancelUrl(args?.listingId);
	return { successUrl, cancelUrl };
}
