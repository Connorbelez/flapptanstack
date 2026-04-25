export type RouteHostPolicyKind = "shared" | "marketing" | "portal" | "admin";

const POLICY_EXEMPT_PREFIXES = ["/demo", "/e2e"] as const;

const ROUTE_HOST_POLICY_REGISTRY = [
	{ prefix: "/sign-out/local", policy: "shared" },
	{ prefix: "/auth-complete", policy: "shared" },
	{ prefix: "/host-boundary", policy: "shared" },
	{ prefix: "/sign-in", policy: "shared" },
	{ prefix: "/sign-out", policy: "shared" },
	{ prefix: "/sign-up", policy: "shared" },
	{ prefix: "/unauthorized", policy: "shared" },
	{ prefix: "/callback", policy: "shared" },
	{ prefix: "/authenticated", policy: "shared" },
	{ prefix: "/about", policy: "marketing" },
	{ prefix: "/admin", policy: "admin" },
	{ prefix: "/financing", policy: "portal" },
	{ prefix: "/listings", policy: "portal" },
	{ prefix: "/broker", policy: "portal" },
	{ prefix: "/borrower", policy: "portal" },
	{ prefix: "/lender", policy: "portal" },
	{ prefix: "/start-lending", policy: "portal" },
	{ prefix: "/lawyer", policy: "portal" },
	{ prefix: "/onboard", policy: "portal" },
	{ prefix: "/", policy: "shared" },
] as const satisfies ReadonlyArray<{
	policy: RouteHostPolicyKind;
	prefix: string;
}>;

function normalizePolicyPathname(pathname: string) {
	if (!pathname || pathname === "/") {
		return "/";
	}

	return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function matchesRoutePrefix(pathname: string, prefix: string) {
	if (prefix === "/") {
		return pathname === "/";
	}

	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isRouteHostPolicyExempt(pathname: string) {
	const normalizedPathname = normalizePolicyPathname(pathname);
	return POLICY_EXEMPT_PREFIXES.some((prefix) =>
		matchesRoutePrefix(normalizedPathname, prefix)
	);
}

export function resolveRouteHostPolicy(pathname: string) {
	const normalizedPathname = normalizePolicyPathname(pathname);
	if (isRouteHostPolicyExempt(normalizedPathname)) {
		return null;
	}

	const matchedPolicy = ROUTE_HOST_POLICY_REGISTRY.find(({ prefix }) =>
		matchesRoutePrefix(normalizedPathname, prefix)
	);
	return matchedPolicy?.policy ?? null;
}
