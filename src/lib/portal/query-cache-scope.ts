import type { QueryKey } from "@tanstack/react-query";

export const DEFAULT_PORTAL_CACHE_SCOPE = "portal:unresolved";

export interface PortalCacheScopeController {
	getScope: () => string;
	setScope: (nextScope: string) => void;
}

export function buildPortalScopedQueryHash(args: {
	baseHash: string;
	portalCacheScope: string;
}) {
	return `${args.portalCacheScope}::${args.baseHash}`;
}

export function createPortalCacheScopeController(
	initialScope = DEFAULT_PORTAL_CACHE_SCOPE
): PortalCacheScopeController {
	let portalCacheScope = initialScope;

	return {
		getScope: () => portalCacheScope,
		setScope: (nextScope) => {
			portalCacheScope = nextScope || DEFAULT_PORTAL_CACHE_SCOPE;
		},
	};
}

export function createPortalScopedQueryKeyHashFn(args: {
	baseHashFn: (queryKey: QueryKey) => string;
	getPortalCacheScope: () => string;
}) {
	return (queryKey: QueryKey) =>
		buildPortalScopedQueryHash({
			baseHash: args.baseHashFn(queryKey),
			portalCacheScope: args.getPortalCacheScope(),
		});
}
