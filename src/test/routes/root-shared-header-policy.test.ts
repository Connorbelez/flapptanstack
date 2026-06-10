import { describe, expect, it } from "vitest";
import {
	type RootRoutePortalContext,
	shouldRenderSharedHeader,
} from "#/routes/__root";

const portalContext = {
	availability: "active",
	cacheKey: "portal:portal_meridian:active:local:meridian.localhost:3000",
	canonicalHost: "meridian.localhost:3000",
	kind: "portal",
	matchedHostType: "local",
	portal: {
		defaultPostAuthPath: "/",
		isPublished: true,
		landingPageId: undefined,
		localHost: "meridian.localhost:3000",
		orgId: "org_meridian",
		portalId: "portal_meridian",
		portalType: "broker",
		pricingPolicyId: "policy_meridian",
		productionHost: "meridian.fairlend.ca",
		publicTeaserEnabled: true,
		slug: "meridian",
		status: "active",
		teaserListingLimit: 12,
	},
	requestedHost: "meridian.localhost:3000",
} as RootRoutePortalContext;

const marketingContext = {
	canonicalHost: "fairlend.localhost:3000",
	kind: "marketing",
	requestedHost: "fairlend.localhost:3000",
} as RootRoutePortalContext;

describe("root shared header policy", () => {
	it("suppresses shared app chrome on public portal root", () => {
		expect(
			shouldRenderSharedHeader({ pathname: "/", portalContext })
		).toBe(false);
	});

	it("keeps shared app chrome on non-root portal paths", () => {
		expect(
			shouldRenderSharedHeader({ pathname: "/listings", portalContext })
		).toBe(true);
	});

	it("keeps shared app chrome on non-portal root hosts", () => {
		expect(
			shouldRenderSharedHeader({ pathname: "/", portalContext: marketingContext })
		).toBe(true);
	});

	it("suppresses shared app chrome on e2e routes", () => {
		expect(
			shouldRenderSharedHeader({
				pathname: "/e2e/marketplace-listings-mobile",
				portalContext: marketingContext,
			})
		).toBe(false);
	});
});
