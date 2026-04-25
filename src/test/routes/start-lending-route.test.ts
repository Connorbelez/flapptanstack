import { describe, expect, it } from "vitest";
import { Route } from "#/routes/start-lending";

const ACTIVE_PORTAL_CONTEXT = {
	availability: "active",
	cacheKey: "portal:portal_meridian:active:local:meridian.localhost:3000",
	canonicalHost: "meridian.localhost:3000",
	kind: "portal",
	matchedHostType: "local",
	portal: {
		defaultPostAuthPath: "/",
		isPublished: true,
		localHost: "meridian.localhost:3000",
		portalId: "portal_meridian",
		portalType: "broker",
		productionHost: "meridian.fairlend.ca",
		publicTeaserEnabled: true,
		slug: "meridian",
		status: "active",
		teaserListingLimit: 12,
	},
	requestedHost: "meridian.localhost:3000",
};

const FEATURED_LISTING_DEPS = {
	listingId: "listing_123",
	source: "featured-listing",
} as const;

describe("start lending route", () => {
	it("sends authenticated users directly to handoff completion", async () => {
		await expect(
			Route.options.loader?.({
				context: {
					portalContext: ACTIVE_PORTAL_CONTEXT,
					userId: "user_lender",
				},
				deps: FEATURED_LISTING_DEPS,
				location: { pathname: "/start-lending" },
			} as never)
		).rejects.toMatchObject({
			options: {
				href: "/start-lending/complete?source=featured-listing&listingId=listing_123",
				statusCode: 307,
			},
		});
	});

	it("sends unauthenticated users through host-aware sign-up", async () => {
		await expect(
			Route.options.loader?.({
				context: {
					portalContext: ACTIVE_PORTAL_CONTEXT,
					userId: null,
				},
				deps: FEATURED_LISTING_DEPS,
				location: { pathname: "/start-lending" },
			} as never)
		).rejects.toMatchObject({
			options: {
				search: {
					redirect:
						"/start-lending/complete?source=featured-listing&listingId=listing_123",
				},
				statusCode: 307,
				to: "/sign-up",
			},
		});
	});
});
