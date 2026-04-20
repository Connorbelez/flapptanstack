import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { resolveAuthCompletionDecision } from "#/lib/portal/auth-completion";

describe("resolveAuthCompletionDecision", () => {
	const localBrokerPortal = {
		portalId: "portal_meridian",
		slug: "meridian",
		portalType: "broker" as const,
		productionHost: "meridian.fairlend.ca",
		localHost: "meridian.localhost:3000",
		status: "active" as const,
		isPublished: true,
		defaultPostAuthPath: "/",
	};

	const fairLendPortal = {
		portalId: "portal_app",
		slug: "app",
		portalType: "fairlend" as const,
		productionHost: "app.fairlend.ca",
		localHost: "app.localhost:3000",
		status: "active" as const,
		isPublished: true,
		defaultPostAuthPath: "/",
	};

	it("redirects marketing-host completions to the assigned home portal", () => {
		expect(
			resolveAuthCompletionDecision({
				authState: {
					version: 1,
					issuedAt: 1_000,
					returnPathname: "/borrower/deals",
					hostClass: "marketing",
					hostType: "local",
					requestedHost: "localhost:3000",
					canonicalHost: "localhost:3000",
				},
				currentPortalContext: {
					kind: "marketing",
					requestedHost: "localhost:3000",
					canonicalHost: "localhost:3000",
					cacheKey: "marketing:localhost:3000",
				},
				viewerAssignment: {
					userId: "user_app",
					homePortalId: "portal_app",
					homePortal: fairLendPortal,
					isFairLendAdmin: false,
				},
			})
		).toEqual({
			kind: "redirect",
			href: "http://app.localhost:3000/borrower/deals",
		});
	});

	it("keeps valid portal-host users on the initiating host", () => {
		expect(
			resolveAuthCompletionDecision({
				authState: {
					version: 1,
					issuedAt: 1_000,
					returnPathname: "/broker/pipeline",
					hostClass: "portal",
					hostType: "local",
					requestedHost: "meridian.localhost:3000",
					canonicalHost: "meridian.localhost:3000",
					portalId: "portal_meridian",
					portalSlug: "meridian",
				},
				currentPortalContext: {
					kind: "portal",
					requestedHost: "meridian.localhost:3000",
					canonicalHost: "meridian.localhost:3000",
					cacheKey:
						"portal:portal_meridian:active:local:meridian.localhost:3000",
					availability: "active",
					matchedHostType: "local",
					portal: {
						...localBrokerPortal,
						portalId: "portal_meridian" as Id<"portals">,
						publicTeaserEnabled: true,
						teaserListingLimit: 12,
					},
				},
				viewerAssignment: {
					userId: "user_meridian",
					homePortalId: "portal_meridian",
					homePortal: localBrokerPortal,
					isFairLendAdmin: false,
				},
			})
		).toEqual({
			kind: "redirect",
			href: "http://meridian.localhost:3000/broker/pipeline",
		});
	});

	it("allows FairLend admins to bypass wrong-portal rejection explicitly", () => {
		expect(
			resolveAuthCompletionDecision({
				authState: {
					version: 1,
					issuedAt: 1_000,
					returnPathname: "/broker/pipeline",
					hostClass: "portal",
					hostType: "local",
					requestedHost: "meridian.localhost:3000",
					canonicalHost: "meridian.localhost:3000",
					portalId: "portal_meridian",
					portalSlug: "meridian",
				},
				currentPortalContext: {
					kind: "portal",
					requestedHost: "meridian.localhost:3000",
					canonicalHost: "meridian.localhost:3000",
					cacheKey:
						"portal:portal_meridian:active:local:meridian.localhost:3000",
					availability: "active",
					matchedHostType: "local",
					portal: {
						...localBrokerPortal,
						portalId: "portal_meridian" as Id<"portals">,
						publicTeaserEnabled: true,
						teaserListingLimit: 12,
					},
				},
				viewerAssignment: {
					userId: "user_admin",
					homePortalId: null,
					homePortal: fairLendPortal,
					isFairLendAdmin: true,
				},
			})
		).toEqual({
			kind: "redirect",
			href: "http://meridian.localhost:3000/broker/pipeline",
		});
	});

	it("returns an explicit wrong-portal decision for non-admin users", () => {
		expect(
			resolveAuthCompletionDecision({
				authState: {
					version: 1,
					issuedAt: 1_000,
					returnPathname: "/borrower/applications",
					hostClass: "portal",
					hostType: "local",
					requestedHost: "meridian.localhost:3000",
					canonicalHost: "meridian.localhost:3000",
					portalId: "portal_meridian",
					portalSlug: "meridian",
				},
				currentPortalContext: {
					kind: "portal",
					requestedHost: "meridian.localhost:3000",
					canonicalHost: "meridian.localhost:3000",
					cacheKey:
						"portal:portal_meridian:active:local:meridian.localhost:3000",
					availability: "active",
					matchedHostType: "local",
					portal: {
						...localBrokerPortal,
						portalId: "portal_meridian" as Id<"portals">,
						publicTeaserEnabled: true,
						teaserListingLimit: 12,
					},
				},
				viewerAssignment: {
					userId: "user_app",
					homePortalId: "portal_app",
					homePortal: fairLendPortal,
					isFairLendAdmin: false,
				},
			})
		).toEqual({
			kind: "wrong-portal",
			continueHref: "http://app.localhost:3000/borrower/applications",
			currentHost: "meridian.localhost:3000",
			assignedHost: "app.localhost:3000",
			assignedPortalLabel: "FairLend",
		});
	});

	it("fails closed when the signed portal host and current host do not match", () => {
		expect(() =>
			resolveAuthCompletionDecision({
				authState: {
					version: 1,
					issuedAt: 1_000,
					returnPathname: "/",
					hostClass: "portal",
					hostType: "local",
					requestedHost: "meridian.localhost:3000",
					canonicalHost: "meridian.localhost:3000",
					portalId: "portal_meridian",
					portalSlug: "meridian",
				},
				currentPortalContext: {
					kind: "portal",
					requestedHost: "app.localhost:3000",
					canonicalHost: "app.localhost:3000",
					cacheKey: "portal:portal_app:active:local:app.localhost:3000",
					availability: "active",
					matchedHostType: "local",
					portal: {
						...fairLendPortal,
						portalId: "portal_app" as Id<"portals">,
						publicTeaserEnabled: true,
						teaserListingLimit: 12,
					},
				},
				viewerAssignment: {
					userId: "user_app",
					homePortalId: "portal_app",
					homePortal: fairLendPortal,
					isFairLendAdmin: false,
				},
			})
		).toThrow("Auth completion host does not match the signed callback host.");
	});

	it("fails closed when the authenticated user has no valid home portal", () => {
		expect(() =>
			resolveAuthCompletionDecision({
				authState: {
					version: 1,
					issuedAt: 1_000,
					returnPathname: "/",
					hostClass: "marketing",
					hostType: "local",
					requestedHost: "localhost:3000",
					canonicalHost: "localhost:3000",
				},
				currentPortalContext: {
					kind: "marketing",
					requestedHost: "localhost:3000",
					canonicalHost: "localhost:3000",
					cacheKey: "marketing:localhost:3000",
				},
				viewerAssignment: {
					userId: "user_missing",
					homePortalId: null,
					homePortal: null,
					isFairLendAdmin: false,
				},
			})
		).toThrow("Authenticated user is missing a valid home portal.");
	});
});
