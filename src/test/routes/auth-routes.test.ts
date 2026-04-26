import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import {
	buildSignInRedirect,
	buildSignUpRedirect,
	getReturnOnlyPathname,
	getReturnPathname,
	sanitizeRedirectPath,
} from "#/lib/auth-redirect";
import {
	buildPortalAuthStatePayload,
	signPortalAuthState,
	verifyPortalAuthState,
} from "#/lib/portal/auth-state";
import {
	buildAuthCompletionPath,
	buildHostAwareAuthRequest,
	buildLocalSessionSignOutHref,
	buildHostOrigin,
	buildHostAwareSignOutReturnTo,
	resolveLocalSessionSignOutReturnTo,
} from "#/lib/portal/auth-routing";

describe("auth redirect helpers", () => {
	describe("sanitizeRedirectPath", () => {
		it("keeps safe internal redirects including search and hash", () => {
			expect(sanitizeRedirectPath("/admin?tab=users#members")).toBe(
				"/admin?tab=users#members"
			);
		});

		it("rejects absolute URLs", () => {
			expect(
				sanitizeRedirectPath("https://evil.example/phish")
			).toBeUndefined();
		});

		it("rejects scheme-relative redirects", () => {
			expect(sanitizeRedirectPath("//evil.example/phish")).toBeUndefined();
		});
	});

	describe("getReturnPathname", () => {
		it("falls back to the homepage when the redirect is invalid", () => {
			expect(getReturnPathname("https://evil.example/phish")).toBe("/");
		});
	});

	describe("getReturnOnlyPathname", () => {
		it("strips search and hash while preserving the internal pathname", () => {
			expect(getReturnOnlyPathname("/admin?detailOpen=false#sheet")).toBe(
				"/admin"
			);
		});

		it("falls back to the homepage when the redirect is invalid", () => {
			expect(getReturnOnlyPathname("https://evil.example/phish")).toBe("/");
		});
	});

	describe("buildSignInRedirect", () => {
		it("builds a sign-in redirect using the redirect search key", () => {
			expect(buildSignInRedirect("/broker?view=pipeline")).toEqual({
				to: "/sign-in",
				search: { redirect: "/broker?view=pipeline" },
			});
		});
	});

	describe("buildSignUpRedirect", () => {
		it("builds a sign-up redirect using the redirect search key", () => {
			expect(buildSignUpRedirect("/borrower#documents")).toEqual({
				to: "/sign-up",
				search: { redirect: "/borrower#documents" },
			});
		});
	});
});

describe("portal auth state helpers", () => {
	const marketingContext = {
		kind: "marketing" as const,
		requestedHost: "localhost:3000",
		canonicalHost: "localhost:3000",
		cacheKey: "marketing:localhost:3000",
	};

	const portalContext = {
		kind: "portal" as const,
		requestedHost: "meridian.localhost:3000",
		canonicalHost: "meridian.localhost:3000",
		cacheKey: "portal:portal_meridian:active:local:meridian.localhost:3000",
		availability: "active" as const,
		matchedHostType: "local" as const,
		portal: {
			portalId: "portal_meridian" as Id<"portals">,
			slug: "meridian",
			portalType: "broker" as const,
			productionHost: "meridian.fairlend.ca",
			localHost: "meridian.localhost:3000",
			status: "active" as const,
			isPublished: true,
			publicTeaserEnabled: true,
			teaserListingLimit: 12,
			defaultPostAuthPath: "/",
		},
	};

	it("builds marketing-host auth state using a sanitized return path", () => {
		expect(
			buildPortalAuthStatePayload({
				portalContext: marketingContext,
				redirectTarget: "https://evil.example/phish",
				issuedAt: 123,
			})
		).toEqual({
			version: 1,
			issuedAt: 123,
			returnPathname: "/",
			hasExplicitReturnPath: false,
			hostClass: "marketing",
			hostType: "local",
			requestedHost: "localhost:3000",
			canonicalHost: "localhost:3000",
		});
	});

	it("builds portal-host auth state with portal identity hints", () => {
		expect(
			buildPortalAuthStatePayload({
				portalContext,
				redirectTarget: "/borrower/deals?tab=open",
				issuedAt: 123,
			})
		).toEqual({
			version: 1,
			issuedAt: 123,
			returnPathname: "/borrower/deals?tab=open",
			hasExplicitReturnPath: true,
			hostClass: "portal",
			hostType: "local",
			requestedHost: "meridian.localhost:3000",
			canonicalHost: "meridian.localhost:3000",
			portalId: "portal_meridian",
			portalSlug: "meridian",
		});
	});

	it("round-trips a signed auth state token", () => {
		const token = signPortalAuthState(
			buildPortalAuthStatePayload({
				portalContext,
				redirectTarget: "/broker#pipeline",
				issuedAt: 1_000,
			}),
			"test-secret"
		);

		expect(
			verifyPortalAuthState(token, "test-secret", {
				now: 1_000 + 5_000,
			})
			).toMatchObject({
				hostClass: "portal",
				hasExplicitReturnPath: true,
				returnPathname: "/broker#pipeline",
				portalId: "portal_meridian",
				portalSlug: "meridian",
			});
		});

	it("preserves legacy tokens that omit hasExplicitReturnPath", () => {
		const token = signPortalAuthState(
			{
				version: 1,
				issuedAt: 1_000,
				returnPathname: "/",
				hostClass: "marketing",
				hostType: "local",
				requestedHost: "localhost:3000",
				canonicalHost: "localhost:3000",
			},
			"test-secret"
		);

		expect(
			verifyPortalAuthState(token, "test-secret", {
				now: 1_000 + 5_000,
			})
		).toMatchObject({
			hostClass: "marketing",
			returnPathname: "/",
		});
		expect(
			verifyPortalAuthState(token, "test-secret", {
				now: 1_000 + 5_000,
			}).hasExplicitReturnPath
		).toBeUndefined();
	});

	it("rejects a tampered auth state token", () => {
		const token = signPortalAuthState(
			buildPortalAuthStatePayload({
				portalContext: marketingContext,
				redirectTarget: "/",
				issuedAt: 1_000,
			}),
			"test-secret"
		);
		const tamperedToken = `${token}tampered`;

		expect(() =>
			verifyPortalAuthState(tamperedToken, "test-secret", {
				now: 1_000 + 5_000,
			})
		).toThrow("Portal auth state signature is invalid.");
	});

	it("rejects an expired auth state token", () => {
		const token = signPortalAuthState(
			buildPortalAuthStatePayload({
				portalContext: marketingContext,
				redirectTarget: "/",
				issuedAt: 1_000,
			}),
			"test-secret"
		);

		expect(() =>
			verifyPortalAuthState(token, "test-secret", {
				now: 1_000 + 16 * 60 * 1_000,
			})
		).toThrow("Portal auth state has expired.");
	});
});

describe("portal auth routing helpers", () => {
	const marketingContext = {
		kind: "marketing" as const,
		requestedHost: "localhost:3000",
		canonicalHost: "localhost:3000",
		cacheKey: "marketing:localhost:3000",
	};

	const adminContext = {
		kind: "admin" as const,
		requestedHost: "admin.localhost:3000",
		canonicalHost: "admin.localhost:3000",
		cacheKey: "admin:admin.localhost:3000",
	};

	it("builds host origins for local and production hosts", () => {
		expect(buildHostOrigin("localhost:3000")).toBe("http://localhost:3000");
		expect(buildHostOrigin("app.fairlend.ca")).toBe("https://app.fairlend.ca");
	});

	it("builds an auth completion path carrying the signed state token", () => {
		expect(buildAuthCompletionPath("token-123")).toBe(
			"/auth-complete?authState=token-123"
		);
	});

	it("routes marketing-host auth through same-host callback completion", () => {
		expect(
			buildHostAwareAuthRequest({
				authStateToken: "signed-token",
				portalContext: marketingContext,
				redirectTarget: "/borrower",
			})
		).toEqual({
			redirectUri: "http://localhost:3000/callback",
			returnPathname: "/auth-complete?authState=signed-token",
		});
	});

	it("keeps admin-host auth on the same host without signed portal state", () => {
		expect(
			buildHostAwareAuthRequest({
				portalContext: adminContext,
				redirectTarget: "/admin/financial-ledger",
			})
		).toEqual({
			redirectUri: "http://admin.localhost:3000/callback",
			returnPathname: "/admin/financial-ledger",
		});
	});

	it("builds same-host sign-out return URLs for canonical portal hosts", () => {
		expect(buildHostAwareSignOutReturnTo(marketingContext)).toBe(
			"http://localhost:3000/"
		);
		expect(buildHostAwareSignOutReturnTo(adminContext)).toBe(
			"http://admin.localhost:3000/"
		);
		expect(
			buildHostAwareSignOutReturnTo({
				kind: "portal",
				requestedHost: "meridian.localhost:3000",
				canonicalHost: "meridian.localhost:3000",
			})
		).toBe("http://meridian.localhost:3000/");
	});

	it("fails closed to the requested host for unclassified sign-out contexts", () => {
		expect(
			buildHostAwareSignOutReturnTo({
				kind: "unknown",
				requestedHost: "mystery.localhost:3000",
				canonicalHost: "mystery.localhost:3000",
			})
		).toBe("http://mystery.localhost:3000/");
	});

	it("builds a same-host local session sign-out URL for localhost flows", () => {
		expect(
			buildLocalSessionSignOutHref("http://app.localhost:3000/")
		).toBe(
			"http://app.localhost:3000/sign-out/local?returnTo=http%3A%2F%2Fapp.localhost%3A3000%2F"
		);
	});

	it("keeps local session sign-out returns on the current host", () => {
		expect(
			resolveLocalSessionSignOutReturnTo({
				requestUrl: "http://app.localhost:3000/sign-out/local",
				returnTo: "/borrower/home",
			})
		).toBe("http://app.localhost:3000/borrower/home");
		expect(
			resolveLocalSessionSignOutReturnTo({
				requestUrl: "http://app.localhost:3000/sign-out/local",
				returnTo: "http://evil.localhost:3000/",
			})
		).toBe("http://app.localhost:3000/");
	});
});
