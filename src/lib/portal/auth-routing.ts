import { getReturnPathname } from "#/lib/auth-redirect";
import type { RootPortalContext } from "./host-resolution";

export const AUTH_CALLBACK_PATH = "/callback";
export const AUTH_COMPLETE_PATH = "/auth-complete";
export const DEFAULT_PUBLIC_RETURN_PATH = "/";
export const LOCAL_SESSION_SIGN_OUT_PATH = "/sign-out/local";

interface PortalHostTarget {
	localHost: string;
	productionHost: string;
}

export function resolvePortalHostTypeFromHost(host: string) {
	return host.includes("localhost")
		? ("local" as const)
		: ("production" as const);
}

export function buildHostOrigin(host: string) {
	const protocol =
		resolvePortalHostTypeFromHost(host) === "local" ? "http" : "https";
	return `${protocol}://${host}`;
}

export function buildAbsoluteHostUrl(host: string, path: string) {
	return new URL(path, buildHostOrigin(host)).toString();
}

export function buildCallbackRedirectUri(host: string) {
	return buildAbsoluteHostUrl(host, AUTH_CALLBACK_PATH);
}

export function buildAuthCompletionPath(authStateToken: string) {
	const url = new URL(AUTH_COMPLETE_PATH, "https://fairlend.local");
	url.searchParams.set("authState", authStateToken);
	return `${url.pathname}${url.search}`;
}

export function selectPortalHost(
	target: PortalHostTarget,
	hostType: "local" | "production"
) {
	return hostType === "local" ? target.localHost : target.productionHost;
}

export function buildPortalAbsoluteUrl(
	target: PortalHostTarget,
	hostType: "local" | "production",
	path: string
) {
	return buildAbsoluteHostUrl(selectPortalHost(target, hostType), path);
}

export function buildHostAwareSignOutReturnTo(
	portalContext: Pick<
		RootPortalContext,
		"canonicalHost" | "kind" | "requestedHost"
	>
) {
	switch (portalContext.kind) {
		case "admin":
		case "marketing":
		case "portal":
			return buildAbsoluteHostUrl(
				portalContext.canonicalHost,
				DEFAULT_PUBLIC_RETURN_PATH
			);
		default:
			return buildAbsoluteHostUrl(
				portalContext.requestedHost,
				DEFAULT_PUBLIC_RETURN_PATH
			);
	}
}

export function buildLocalSessionSignOutHref(returnTo: string) {
	const url = new URL(LOCAL_SESSION_SIGN_OUT_PATH, returnTo);
	url.searchParams.set("returnTo", returnTo);
	return url.toString();
}

export function resolveLocalSessionSignOutReturnTo(args: {
	requestUrl: string | URL;
	returnTo: string | null | undefined;
}) {
	const requestUrl =
		typeof args.requestUrl === "string"
			? new URL(args.requestUrl)
			: args.requestUrl;
	const fallbackReturnTo = buildAbsoluteHostUrl(
		requestUrl.host,
		DEFAULT_PUBLIC_RETURN_PATH
	);

	if (!args.returnTo) {
		return fallbackReturnTo;
	}

	try {
		const candidate = new URL(args.returnTo, requestUrl);
		if (candidate.origin !== requestUrl.origin) {
			return fallbackReturnTo;
		}

		return candidate.toString();
	} catch {
		return fallbackReturnTo;
	}
}

export function requiresHostAwareAuthState(
	portalContext: RootPortalContext
): portalContext is Extract<
	RootPortalContext,
	{ kind: "marketing" | "portal" }
> {
	return portalContext.kind === "marketing" || portalContext.kind === "portal";
}

export function buildHostAwareAuthRequest(args: {
	authStateToken?: string;
	invitationToken?: string;
	portalContext: RootPortalContext;
	redirectTarget: unknown;
}) {
	const redirectUri = buildCallbackRedirectUri(
		args.portalContext.canonicalHost
	);
	const invitationToken =
		args.invitationToken && args.invitationToken.trim().length > 0
			? args.invitationToken
			: undefined;

	if (
		args.authStateToken &&
		(args.portalContext.kind === "admin" ||
			requiresHostAwareAuthState(args.portalContext))
	) {
		return {
			...(invitationToken ? { invitationToken } : {}),
			redirectUri,
			returnPathname: buildAuthCompletionPath(args.authStateToken),
		};
	}

	if (args.portalContext.kind === "admin") {
		return {
			...(invitationToken ? { invitationToken } : {}),
			redirectUri,
			returnPathname: getReturnPathname(args.redirectTarget),
		};
	}

	throw new Error(
		`Cannot build auth routing for unsupported portal context kind "${args.portalContext.kind}".`
	);
}
