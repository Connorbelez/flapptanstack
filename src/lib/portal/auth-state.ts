import { createHmac, timingSafeEqual } from "node:crypto";
import { getReturnPathname, sanitizeRedirectPath } from "#/lib/auth-redirect";
import type { PortalHostMatchType } from "../../../shared/portal/contracts";
import { resolvePortalHostTypeFromHost } from "./auth-routing";
import type { RootPortalContext } from "./host-resolution";

export const PORTAL_AUTH_STATE_VERSION = 1;
export const DEFAULT_PORTAL_AUTH_STATE_MAX_AGE_MS = 15 * 60 * 1000;

type SupportedPortalContext = Extract<
	RootPortalContext,
	{ kind: "admin" | "marketing" | "portal" }
>;

export type PortalAuthHostClass = "marketing" | "portal";

export interface PortalAuthStatePayload {
	canonicalHost: string;
	hasExplicitReturnPath?: boolean;
	hostClass: PortalAuthHostClass;
	hostType: PortalHostMatchType;
	issuedAt: number;
	portalId?: string;
	portalSlug?: string;
	requestedHost: string;
	returnPathname: string;
	version: typeof PORTAL_AUTH_STATE_VERSION;
}

export type PortalAuthStateErrorCode =
	| "expired"
	| "invalid-payload"
	| "invalid-signature"
	| "malformed-token"
	| "missing-secret";

export class PortalAuthStateError extends Error {
	readonly code: PortalAuthStateErrorCode;

	constructor(code: PortalAuthStateErrorCode, message: string) {
		super(message);
		this.code = code;
		this.name = "PortalAuthStateError";
	}
}

function encodePayload(payload: PortalAuthStatePayload) {
	return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function signEncodedPayload(encodedPayload: string, secret: string) {
	return createHmac("sha256", secret)
		.update(encodedPayload)
		.digest("base64url");
}

function parsePayload(parsed: unknown): PortalAuthStatePayload {
	if (!parsed || typeof parsed !== "object") {
		throw new PortalAuthStateError(
			"invalid-payload",
			"Portal auth state payload must be an object."
		);
	}

	const candidate = parsed as Record<string, unknown>;
	const {
		canonicalHost,
		hostClass,
		hostType,
		issuedAt,
		hasExplicitReturnPath,
		portalId,
		portalSlug,
		requestedHost,
		returnPathname,
		version,
	} = candidate;

	if (version !== PORTAL_AUTH_STATE_VERSION) {
		throw new PortalAuthStateError(
			"invalid-payload",
			"Portal auth state version is not supported."
		);
	}

	if (hostClass !== "marketing" && hostClass !== "portal") {
		throw new PortalAuthStateError(
			"invalid-payload",
			"Portal auth state host class is invalid."
		);
	}

	if (hostType !== "local" && hostType !== "production") {
		throw new PortalAuthStateError(
			"invalid-payload",
			"Portal auth state host type is invalid."
		);
	}

	if (
		typeof issuedAt !== "number" ||
		!Number.isFinite(issuedAt) ||
		issuedAt <= 0
	) {
		throw new PortalAuthStateError(
			"invalid-payload",
			"Portal auth state issuedAt must be a positive number."
		);
	}

	if (
		hasExplicitReturnPath !== undefined &&
		typeof hasExplicitReturnPath !== "boolean"
	) {
		throw new PortalAuthStateError(
			"invalid-payload",
			"Portal auth state hasExplicitReturnPath must be a boolean when present."
		);
	}

	if (
		typeof requestedHost !== "string" ||
		requestedHost.length === 0 ||
		typeof canonicalHost !== "string" ||
		canonicalHost.length === 0
	) {
		throw new PortalAuthStateError(
			"invalid-payload",
			"Portal auth state hosts must be non-empty strings."
		);
	}

	if (typeof returnPathname !== "string" || !returnPathname.startsWith("/")) {
		throw new PortalAuthStateError(
			"invalid-payload",
			"Portal auth state returnPathname must be a safe internal path."
		);
	}

	if (
		hostClass === "portal" &&
		(typeof portalId !== "string" ||
			portalId.length === 0 ||
			typeof portalSlug !== "string" ||
			portalSlug.length === 0)
	) {
		throw new PortalAuthStateError(
			"invalid-payload",
			"Portal auth state for portal hosts requires portalId and portalSlug."
		);
	}

	return {
		version,
		issuedAt,
		returnPathname,
		hasExplicitReturnPath:
			typeof hasExplicitReturnPath === "boolean"
				? hasExplicitReturnPath
				: undefined,
		hostClass,
		hostType,
		requestedHost,
		canonicalHost,
		portalId: typeof portalId === "string" ? portalId : undefined,
		portalSlug: typeof portalSlug === "string" ? portalSlug : undefined,
	};
}

export function getPortalAuthStateSecret() {
	const secret =
		process.env.WORKOS_AUTH_STATE_SECRET ?? process.env.WORKOS_COOKIE_PASSWORD;
	if (!secret) {
		throw new PortalAuthStateError(
			"missing-secret",
			"Missing WORKOS_AUTH_STATE_SECRET or WORKOS_COOKIE_PASSWORD."
		);
	}
	return secret;
}

export function buildPortalAuthStatePayload(args: {
	portalContext: SupportedPortalContext;
	redirectTarget: unknown;
	issuedAt?: number;
}): PortalAuthStatePayload {
	const { portalContext } = args;
	const explicitReturnPath = sanitizeRedirectPath(args.redirectTarget);
	const returnPathname =
		explicitReturnPath ?? getReturnPathname(args.redirectTarget);
	const hasExplicitReturnPath = explicitReturnPath !== undefined;

	if (portalContext.kind === "marketing") {
		return {
			version: PORTAL_AUTH_STATE_VERSION,
			issuedAt: args.issuedAt ?? Date.now(),
			returnPathname,
			hasExplicitReturnPath,
			hostClass: "marketing",
			hostType: resolvePortalHostTypeFromHost(portalContext.canonicalHost),
			requestedHost: portalContext.requestedHost,
			canonicalHost: portalContext.canonicalHost,
		};
	}

	if (portalContext.kind === "admin") {
		return {
			version: PORTAL_AUTH_STATE_VERSION,
			issuedAt: args.issuedAt ?? Date.now(),
			returnPathname,
			hasExplicitReturnPath,
			hostClass: "marketing",
			hostType: resolvePortalHostTypeFromHost(portalContext.canonicalHost),
			requestedHost: portalContext.requestedHost,
			canonicalHost: portalContext.canonicalHost,
		};
	}

	return {
		version: PORTAL_AUTH_STATE_VERSION,
		issuedAt: args.issuedAt ?? Date.now(),
		returnPathname,
		hasExplicitReturnPath,
		hostClass: "portal",
		hostType: portalContext.matchedHostType,
		requestedHost: portalContext.requestedHost,
		canonicalHost: portalContext.canonicalHost,
		portalId: String(portalContext.portal.portalId),
		portalSlug: portalContext.portal.slug,
	};
}

export function signPortalAuthState(
	payload: PortalAuthStatePayload,
	secret: string
) {
	const encodedPayload = encodePayload(payload);
	const signature = signEncodedPayload(encodedPayload, secret);
	return `${encodedPayload}.${signature}`;
}

export function verifyPortalAuthState(
	token: string,
	secret: string,
	options?: {
		maxAgeMs?: number;
		now?: number;
	}
) {
	const [encodedPayload, providedSignature] = token.split(".");

	if (!(encodedPayload && providedSignature)) {
		throw new PortalAuthStateError(
			"malformed-token",
			"Portal auth state token is malformed."
		);
	}

	const expectedSignature = signEncodedPayload(encodedPayload, secret);
	const providedSignatureBytes = Buffer.from(providedSignature);
	const expectedSignatureBytes = Buffer.from(expectedSignature);

	if (
		providedSignatureBytes.length !== expectedSignatureBytes.length ||
		!timingSafeEqual(providedSignatureBytes, expectedSignatureBytes)
	) {
		throw new PortalAuthStateError(
			"invalid-signature",
			"Portal auth state signature is invalid."
		);
	}

	let parsedJson: unknown;
	try {
		parsedJson = JSON.parse(
			Buffer.from(encodedPayload, "base64url").toString("utf8")
		);
	} catch {
		throw new PortalAuthStateError(
			"invalid-payload",
			"Portal auth state payload could not be decoded."
		);
	}

	const payload = parsePayload(parsedJson);
	const now = options?.now ?? Date.now();
	const maxAgeMs = options?.maxAgeMs ?? DEFAULT_PORTAL_AUTH_STATE_MAX_AGE_MS;
	if (payload.issuedAt + maxAgeMs < now) {
		throw new PortalAuthStateError("expired", "Portal auth state has expired.");
	}

	return payload;
}
