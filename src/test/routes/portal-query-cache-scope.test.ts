import { describe, expect, it } from "vitest";
import {
	buildPortalScopedQueryHash,
	createPortalCacheScopeController,
	createPortalScopedQueryKeyHashFn,
	DEFAULT_PORTAL_CACHE_SCOPE,
} from "#/lib/portal/query-cache-scope";

describe("portal query cache scope", () => {
	it("salts identical query keys with the active portal cache scope", () => {
		const controller = createPortalCacheScopeController("marketing:fairlend.ca");
		const hashQueryKey = createPortalScopedQueryKeyHashFn({
			baseHashFn: (queryKey) => JSON.stringify(queryKey),
			getPortalCacheScope: controller.getScope,
		});
		const queryKey = ["listing-detail", { listingId: "listing_123" }] as const;

		const marketingHash = hashQueryKey(queryKey);
		controller.setScope(
			"portal:portal_meridian:active:local:meridian.localhost:3000"
		);
		const brokerHash = hashQueryKey(queryKey);

		expect(marketingHash).toContain("marketing:fairlend.ca");
		expect(brokerHash).toContain(
			"portal:portal_meridian:active:local:meridian.localhost:3000"
		);
		expect(marketingHash).not.toBe(brokerHash);
	});

	it("falls back to the default unresolved cache scope for empty values", () => {
		const controller = createPortalCacheScopeController();
		controller.setScope("");

		expect(
			buildPortalScopedQueryHash({
				baseHash: '["example"]',
				portalCacheScope: controller.getScope(),
			})
		).toBe(`${DEFAULT_PORTAL_CACHE_SCOPE}::["example"]`);
	});
});
