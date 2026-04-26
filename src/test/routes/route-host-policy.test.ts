import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { resolveRouteHostDecision } from "#/lib/portal/route-host-decision";
import { resolveRouteHostPolicy } from "#/lib/portal/route-host-policy";

function buildPortalSummary(args: {
	portalId: string;
	portalType?: "broker" | "fairlend";
	slug: string;
}) {
	return {
		defaultPostAuthPath: "/",
		isPublished: true,
		localHost: `${args.slug}.localhost:3000`,
		portalId: args.portalId,
		portalType: args.portalType ?? "broker",
		productionHost: `${args.slug}.fairlend.ca`,
		slug: args.slug,
		status: "active" as const,
	};
}

function buildPortalContext(args: {
	host: string;
	portalId: string;
	slug: string;
}) {
	return {
		kind: "portal" as const,
		requestedHost: args.host,
		canonicalHost: args.host,
		cacheKey: `portal:${args.portalId}:active:local:${args.host}`,
		availability: "active" as const,
		matchedHostType: "local" as const,
		portal: {
			...buildPortalSummary(args),
			portalId: args.portalId as Id<"portals">,
			publicTeaserEnabled: true,
			teaserListingLimit: 12,
		},
	};
}

function extractGeneratedPaths() {
	const routeTreeSource = readFileSync(
		new URL("../../routeTree.gen.ts", import.meta.url),
		"utf8"
	);
	const interfaceStart = routeTreeSource.indexOf(
		"export interface FileRoutesByFullPath {"
	);
	const interfaceEnd = routeTreeSource.indexOf(
		"export interface FileRoutesByTo {"
	);
	const interfaceBody = routeTreeSource.slice(interfaceStart, interfaceEnd);

	return [...interfaceBody.matchAll(/^\s+'([^']+)':/gm)].map((match) => match[1]);
}

describe("route host policy", () => {
	it("classifies the expected route families", () => {
		expect(resolveRouteHostPolicy("/")).toBe("shared");
		expect(resolveRouteHostPolicy("/sign-out/local")).toBe("shared");
		expect(resolveRouteHostPolicy("/about")).toBe("marketing");
		expect(resolveRouteHostPolicy("/listings/abc")).toBe("portal");
		expect(resolveRouteHostPolicy("/admin/settings")).toBe("admin");
		expect(resolveRouteHostPolicy("/demo/listings")).toBeNull();
		expect(resolveRouteHostPolicy("/e2e/session")).toBeNull();
	});

	it("covers every non-demo generated app route", () => {
		const uncoveredPaths = extractGeneratedPaths().filter((path) => {
			if (path.startsWith("/demo") || path.startsWith("/e2e")) {
				return false;
			}

			return resolveRouteHostPolicy(path) === null;
		});

		expect(uncoveredPaths).toEqual([]);
	});
});

describe("route host decisions", () => {
	it("blocks marketing-host portal access behind the boundary sign-in CTA", () => {
		expect(
			resolveRouteHostDecision({
				pathname: "/listings",
				portalContext: {
					kind: "marketing",
					requestedHost: "localhost:3000",
					canonicalHost: "localhost:3000",
					cacheKey: "marketing:localhost:3000",
				},
				returnTo: "/listings?q=toronto",
				userId: null,
				viewerPortalAssignment: null,
			})
		).toEqual({
			kind: "boundary",
			boundaryKind: "portal-required",
			continueHref:
				"http://localhost:3000/sign-in?redirect=%2Flistings%3Fq%3Dtoronto",
			continueLabel: "Sign in to continue",
			currentHost: "localhost:3000",
			returnTo: "/listings?q=toronto",
		});
	});

	it("prefers the current organization portal over the home portal", () => {
		expect(
			resolveRouteHostDecision({
				pathname: "/listings",
				portalContext: {
					kind: "marketing",
					requestedHost: "localhost:3000",
					canonicalHost: "localhost:3000",
					cacheKey: "marketing:localhost:3000",
				},
				returnTo: "/listings",
				userId: "user_multi_org",
				viewerPortalAssignment: {
					userId: "user_multi_org",
					homePortalId: "portal_app",
					homePortal: buildPortalSummary({
						portalId: "portal_app",
						portalType: "fairlend",
						slug: "app",
					}),
					currentOrgPortalId: "portal_meridian",
					currentOrgPortal: buildPortalSummary({
						portalId: "portal_meridian",
						slug: "meridian",
					}),
					isFairLendAdmin: false,
				},
			})
		).toEqual({
			kind: "boundary",
			boundaryKind: "portal-required",
			continueHref: "http://meridian.localhost:3000/listings",
			continueLabel: "Continue to Meridian",
			currentHost: "localhost:3000",
			expectedHost: "meridian.localhost:3000",
			returnTo: "/listings",
		});
	});

	it("shows the wrong-portal boundary on active portal hosts for non-admin users", () => {
		expect(
			resolveRouteHostDecision({
				pathname: "/listings",
				portalContext: buildPortalContext({
					host: "meridian.localhost:3000",
					portalId: "portal_meridian",
					slug: "meridian",
				}),
				returnTo: "/listings",
				userId: "user_app",
				viewerPortalAssignment: {
					userId: "user_app",
					homePortalId: "portal_app",
					homePortal: buildPortalSummary({
						portalId: "portal_app",
						portalType: "fairlend",
						slug: "app",
					}),
					currentOrgPortalId: null,
					currentOrgPortal: null,
					isFairLendAdmin: false,
				},
			})
		).toEqual({
			kind: "boundary",
			boundaryKind: "wrong-portal",
			continueHref: "http://app.localhost:3000/listings",
			continueLabel: "Continue to FairLend",
			currentHost: "meridian.localhost:3000",
			expectedHost: "app.localhost:3000",
			returnTo: "/listings",
		});
	});

	it("keeps admin policy classification when the return target includes search params", () => {
		expect(
			resolveRouteHostDecision({
				pathname: "/admin",
				portalContext: buildPortalContext({
					host: "app.localhost:3000",
					portalId: "portal_app",
					slug: "app",
				}),
				returnTo: "/admin?detailOpen=false",
				userId: "user_app",
				viewerPortalAssignment: {
					userId: "user_app",
					homePortalId: "portal_app",
					homePortal: buildPortalSummary({
						portalId: "portal_app",
						portalType: "fairlend",
						slug: "app",
					}),
					currentOrgPortalId: null,
					currentOrgPortal: null,
					isFairLendAdmin: false,
				},
			})
		).toEqual({
			kind: "boundary",
			boundaryKind: "admin-required",
			continueHref: "http://admin.localhost:3000/admin?detailOpen=false",
			continueLabel: "Continue to FairLend admin",
			currentHost: "app.localhost:3000",
			expectedHost: "admin.localhost:3000",
			returnTo: "/admin?detailOpen=false",
		});
	});
});
