import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import {
	canonicalMarketingHost,
	isAdminPortalHost,
	isMarketingPortalHost,
	isReservedPortalSlug,
	normalizePortalHost,
	parsePortalHostCandidate,
} from "../../../shared/portal/contracts";
import { buildPortalCacheKey } from "./portal-cache-key";

type ResolvedPortalLookup = NonNullable<
	FunctionReturnType<typeof api.portals.queries.resolvePortalByHost>
>;
type PortalSummary = ResolvedPortalLookup["portal"];
export type PortalAvailability = ResolvedPortalLookup["availability"];
type PortalMatchedHostType = ResolvedPortalLookup["matchedHostType"];

interface RootPortalContextBase {
	canonicalHost: string;
	requestedHost: string;
}

export type RootPortalContextSeed =
	| (RootPortalContextBase & {
			kind: "marketing";
	  })
	| (RootPortalContextBase & {
			kind: "admin";
	  })
	| (RootPortalContextBase & {
			kind: "reserved";
			reservedSlug: string;
	  })
	| (RootPortalContextBase & {
			kind: "unknown";
	  })
	| (RootPortalContextBase & {
			availability: PortalAvailability;
			kind: "portal";
			matchedHostType: PortalMatchedHostType;
			portal: PortalSummary;
	  });

export type RootPortalContext = RootPortalContextSeed & {
	cacheKey: string;
};

export interface RootPortalContextDeps {
	resolvePortalByHost?: (
		host: string
	) => Promise<
		FunctionReturnType<typeof api.portals.queries.resolvePortalByHost>
	>;
}

function portalContextWithCacheKey(
	portalContext: RootPortalContextSeed
): RootPortalContext {
	return {
		...portalContext,
		cacheKey: buildPortalCacheKey(portalContext),
	};
}

function buildPortalLookup(token: string | null) {
	const convexUrl = import.meta.env.VITE_CONVEX_URL;
	if (!convexUrl) {
		throw new Error("missing VITE_CONVEX_URL env var");
	}

	const client = new ConvexHttpClient(convexUrl);
	if (token) {
		client.setAuth(token);
	}

	return async (host: string) =>
		client.query(api.portals.queries.resolvePortalByHost, { host });
}

/**
 * Mirrors the root route’s “blocked portal host” gate: marketing/admin hosts and
 * published active portals are routable; reserved/unknown hosts and non-active
 * portal rows are treated as inaccessible for the main app shell.
 */
export function isActivePortalContext(portalContext: RootPortalContext) {
	if (portalContext.kind === "marketing" || portalContext.kind === "admin") {
		return true;
	}
	if (portalContext.kind === "portal") {
		return portalContext.availability === "active";
	}
	return false;
}

export async function resolveRootPortalContext(
	args: {
		requestHost: string;
		token: string | null;
	},
	deps: RootPortalContextDeps = {}
): Promise<RootPortalContext> {
	const requestedHost = normalizePortalHost(args.requestHost);

	if (isMarketingPortalHost(requestedHost)) {
		return portalContextWithCacheKey({
			kind: "marketing",
			requestedHost,
			canonicalHost: canonicalMarketingHost(requestedHost),
		});
	}

	if (isAdminPortalHost(requestedHost)) {
		return portalContextWithCacheKey({
			kind: "admin",
			requestedHost,
			canonicalHost: requestedHost,
		});
	}

	const resolvePortalByHost =
		deps.resolvePortalByHost ?? buildPortalLookup(args.token);
	const resolvedPortal = await resolvePortalByHost(requestedHost);
	if (resolvedPortal) {
		return portalContextWithCacheKey({
			kind: "portal",
			requestedHost,
			canonicalHost: resolvedPortal.canonicalHost,
			matchedHostType: resolvedPortal.matchedHostType,
			portal: resolvedPortal.portal,
			availability: resolvedPortal.availability,
		});
	}

	const portalHostCandidate = parsePortalHostCandidate(requestedHost);
	if (portalHostCandidate && isReservedPortalSlug(portalHostCandidate.slug)) {
		return portalContextWithCacheKey({
			kind: "reserved",
			requestedHost,
			canonicalHost: requestedHost,
			reservedSlug: portalHostCandidate.slug,
		});
	}

	return portalContextWithCacheKey({
		kind: "unknown",
		requestedHost,
		canonicalHost: requestedHost,
	});
}
