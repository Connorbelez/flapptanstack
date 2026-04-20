import type { RootPortalContextSeed } from "./host-resolution";

export function buildPortalCacheKey(
	portalContext: RootPortalContextSeed
): string {
	switch (portalContext.kind) {
		case "marketing":
			return `marketing:${portalContext.canonicalHost}`;
		case "admin":
			return `admin:${portalContext.canonicalHost}`;
		case "reserved":
			return `reserved:${portalContext.reservedSlug}:${portalContext.canonicalHost}`;
		case "unknown":
			return `unknown:${portalContext.canonicalHost}`;
		case "portal":
			return [
				"portal",
				String(portalContext.portal.portalId),
				portalContext.availability,
				portalContext.matchedHostType,
				portalContext.canonicalHost,
			].join(":");
		default: {
			const exhaustivePortalContext: never = portalContext;
			return exhaustivePortalContext;
		}
	}
}
