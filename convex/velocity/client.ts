import type {
	VelocityConnectorCredentialContext,
	VelocityDeal,
	VelocityDealsPage,
} from "./contracts";

const DEFAULT_VELOCITY_API_BASE_URL = "https://velocity.newton.ca";
const VELOCITY_API_KEY_REDACTION_PREFIX = "sha256:";
const TRAILING_SLASHES_PATTERN = /\/+$/;

export interface VelocityClientConfig {
	apiKey: string;
	baseUrl: string;
	credentialContext: VelocityConnectorCredentialContext;
	fetchImpl: typeof fetch;
}

export interface VelocityFullDealFetchArgs {
	config: VelocityClientConfig;
	dealHref?: string;
	loanCode: string;
}

export interface VelocityFullDealFetchResult {
	deal: VelocityDeal;
	rawResponseBody: string;
	request: VelocityFullDealRequestMetadata;
	responseStatus: number;
	usedFallbackHref: boolean;
}

export interface VelocityFullDealRequestMetadata {
	dealHref?: string;
	loanCode: string;
	method: "GET";
	url: string;
	[key: string]: unknown;
}

export interface ResolveVelocityClientConfigArgs {
	apiKey?: string;
	baseUrl?: string;
	credentialId?: string;
	fetchImpl?: typeof fetch;
	scope?: string;
}

function requireNonEmpty(value: string | undefined, message: string) {
	if (!value?.trim()) {
		throw new Error(message);
	}

	return value.trim();
}

export async function sha256Hex(value: string) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value)
	);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

async function fingerprintApiKey(apiKey: string) {
	const hash = await sha256Hex(apiKey);
	return `${VELOCITY_API_KEY_REDACTION_PREFIX}${hash.slice(0, 24)}`;
}

function normalizeBaseUrl(baseUrl: string) {
	return baseUrl.replace(TRAILING_SLASHES_PATTERN, "");
}

function redactedVelocityUrl(url: URL) {
	const redactedUrl = new URL(url.toString());
	if (redactedUrl.searchParams.has("apikey")) {
		redactedUrl.searchParams.set("apikey", "REDACTED");
	}
	return redactedUrl.toString();
}

function buildRequestMetadata(args: {
	dealHref?: string;
	loanCode: string;
	url: URL;
}): VelocityFullDealRequestMetadata {
	return {
		dealHref: args.dealHref,
		loanCode: args.loanCode,
		method: "GET",
		url: redactedVelocityUrl(args.url),
	};
}

function buildDealsOutUrl(args: {
	apiKey: string;
	baseUrl: string;
	loanCode: string;
}) {
	const url = new URL(`${normalizeBaseUrl(args.baseUrl)}/v1/deals`);
	url.searchParams.set("apikey", args.apiKey);
	url.searchParams.set("loancode", args.loanCode);
	return url;
}

function buildOpaqueDealHrefUrl(args: {
	apiKey: string;
	baseUrl: string;
	dealHref: string;
}) {
	const baseUrl = new URL(`${normalizeBaseUrl(args.baseUrl)}/`);
	const hrefUrl = new URL(args.dealHref, baseUrl);
	if (hrefUrl.origin !== baseUrl.origin) {
		throw new Error("Velocity fallback deal href origin is not trusted");
	}
	if (!hrefUrl.searchParams.has("apikey")) {
		hrefUrl.searchParams.set("apikey", args.apiKey);
	}
	return hrefUrl;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toVelocityDeal(value: unknown): VelocityDeal | null {
	if (!isRecord(value)) {
		return null;
	}

	return value as VelocityDeal;
}

function toVelocityDealsPage(value: unknown): VelocityDealsPage | null {
	if (!isRecord(value)) {
		return null;
	}

	const deals = value.deals;
	if (!(deals == null || Array.isArray(deals))) {
		return null;
	}

	return {
		deals: deals?.map(toVelocityDeal).filter((deal) => deal !== null) ?? null,
		pageNumber: typeof value.pageNumber === "number" ? value.pageNumber : 1,
		totalDeals: typeof value.totalDeals === "number" ? value.totalDeals : 0,
		totalPages: typeof value.totalPages === "number" ? value.totalPages : 1,
	};
}

function selectDealFromResponse(value: unknown) {
	const directDeal = toVelocityDeal(value);
	if (directDeal?.loanCode || directDeal?.linkApplicationId) {
		return directDeal;
	}

	const page = toVelocityDealsPage(value);
	return page?.deals?.[0] ?? null;
}

async function fetchJsonDeal(args: {
	fetchImpl: typeof fetch;
	url: URL;
}): Promise<{
	deal: VelocityDeal | null;
	rawResponseBody: string;
	responseStatus: number;
}> {
	const response = await args.fetchImpl(args.url, { method: "GET" });
	const rawResponseBody = await response.text();
	if (!response.ok) {
		return {
			deal: null,
			rawResponseBody,
			responseStatus: response.status,
		};
	}

	const parsed = rawResponseBody ? JSON.parse(rawResponseBody) : null;
	return {
		deal: selectDealFromResponse(parsed),
		rawResponseBody,
		responseStatus: response.status,
	};
}

export class VelocityFullDealFetchError extends Error {
	rawResponseBody?: string;
	request: VelocityFullDealRequestMetadata;
	responseStatus?: number;

	constructor(
		message: string,
		args: {
			rawResponseBody?: string;
			request: VelocityFullDealRequestMetadata;
			responseStatus?: number;
		}
	) {
		super(message);
		this.name = "VelocityFullDealFetchError";
		this.rawResponseBody = args.rawResponseBody;
		this.request = args.request;
		this.responseStatus = args.responseStatus;
	}
}

export function isVelocityFullDealFetchError(
	error: unknown
): error is VelocityFullDealFetchError {
	return error instanceof VelocityFullDealFetchError;
}

export async function resolveVelocityClientConfig(
	args?: ResolveVelocityClientConfigArgs
): Promise<VelocityClientConfig> {
	const apiKey = requireNonEmpty(
		args?.apiKey ?? process.env.VELOCITY_API_KEY,
		"VELOCITY_API_KEY is not configured"
	);
	const baseUrl =
		args?.baseUrl ??
		process.env.VELOCITY_API_BASE_URL ??
		DEFAULT_VELOCITY_API_BASE_URL;

	return {
		apiKey,
		baseUrl,
		credentialContext: {
			apiKeyFingerprint: await fingerprintApiKey(apiKey),
			credentialId:
				args?.credentialId ?? process.env.VELOCITY_CONNECTOR_CREDENTIAL_ID,
			provider: "velocity",
			scope:
				args?.scope ??
				process.env.VELOCITY_CONNECTOR_CREDENTIAL_SCOPE ??
				"deals_out",
			usedFor: "full_deal_fetch",
		},
		fetchImpl: args?.fetchImpl ?? fetch,
	};
}

export async function fetchVelocityFullDealByLoanCode(
	args: VelocityFullDealFetchArgs
): Promise<VelocityFullDealFetchResult> {
	const loanCode = requireNonEmpty(args.loanCode, "loanCode is required");
	const primaryUrl = buildDealsOutUrl({
		apiKey: args.config.apiKey,
		baseUrl: args.config.baseUrl,
		loanCode,
	});
	const primary = await fetchJsonDeal({
		fetchImpl: args.config.fetchImpl,
		url: primaryUrl,
	});

	if (primary.deal) {
		return {
			deal: primary.deal,
			rawResponseBody: primary.rawResponseBody,
			request: buildRequestMetadata({
				loanCode,
				url: primaryUrl,
			}),
			responseStatus: primary.responseStatus,
			usedFallbackHref: false,
		};
	}

	if (!args.dealHref) {
		throw new VelocityFullDealFetchError(
			`Velocity full deal not found for loanCode ${loanCode}; no fallback href supplied`,
			{
				rawResponseBody: primary.rawResponseBody,
				request: buildRequestMetadata({
					loanCode,
					url: primaryUrl,
				}),
				responseStatus: primary.responseStatus,
			}
		);
	}

	const fallbackUrl = buildOpaqueDealHrefUrl({
		apiKey: args.config.apiKey,
		baseUrl: args.config.baseUrl,
		dealHref: args.dealHref,
	});
	const fallback = await fetchJsonDeal({
		fetchImpl: args.config.fetchImpl,
		url: fallbackUrl,
	});

	if (!fallback.deal) {
		throw new VelocityFullDealFetchError(
			"Velocity full deal fallback did not return a deal",
			{
				rawResponseBody: fallback.rawResponseBody,
				request: buildRequestMetadata({
					dealHref: args.dealHref,
					loanCode,
					url: fallbackUrl,
				}),
				responseStatus: fallback.responseStatus,
			}
		);
	}

	return {
		deal: fallback.deal,
		rawResponseBody: fallback.rawResponseBody,
		request: buildRequestMetadata({
			dealHref: args.dealHref,
			loanCode,
			url: fallbackUrl,
		}),
		responseStatus: fallback.responseStatus,
		usedFallbackHref: true,
	};
}
