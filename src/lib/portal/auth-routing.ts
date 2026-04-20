import { getReturnPathname } from "#/lib/auth-redirect";
import type { RootPortalContext } from "./host-resolution";

export const AUTH_CALLBACK_PATH = "/callback";
export const AUTH_COMPLETE_PATH = "/auth-complete";
export const DEFAULT_PUBLIC_RETURN_PATH = "/";

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
	portalContext: RootPortalContext;
	redirectTarget: unknown;
}) {
	const redirectUri = buildCallbackRedirectUri(
		args.portalContext.canonicalHost
	);

	if (requiresHostAwareAuthState(args.portalContext)) {
		if (!args.authStateToken) {
			throw new Error(
				"Host-aware auth state is required for marketing and portal hosts."
			);
		}

		return {
			redirectUri,
			returnPathname: buildAuthCompletionPath(args.authStateToken),
		};
	}

	if (args.portalContext.kind === "admin") {
		return {
			redirectUri,
			returnPathname: getReturnPathname(args.redirectTarget),
		};
	}

	throw new Error(
		`Cannot build auth routing for unsupported portal context kind "${args.portalContext.kind}".`
	);
}
