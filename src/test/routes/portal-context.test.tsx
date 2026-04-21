/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { PortalStateBoundary } from "#/components/portal/portal-state-boundary";
import { resolveRootPortalContext } from "#/lib/portal/host-resolution";
import { extractTrustedRequestHost } from "#/lib/portal/request-host";

const TRUST_X_FORWARDED_HOST_ENV = "TRUST_X_FORWARDED_HOST";
const originalTrustForwardedHost = process.env.TRUST_X_FORWARDED_HOST;

afterEach(() => {
	cleanup();
	if (originalTrustForwardedHost === undefined) {
		delete process.env[TRUST_X_FORWARDED_HOST_ENV];
		return;
	}

	process.env[TRUST_X_FORWARDED_HOST_ENV] = originalTrustForwardedHost;
});

function buildResolvedPortal(overrides?: {
	availability?: "active" | "archived" | "draft" | "misconfigured" | "suspended" | "unpublished";
	isPublished?: boolean;
	requestedHost?: string;
	status?: "active" | "archived" | "draft" | "suspended";
}) {
	return {
		availability: overrides?.availability ?? "active",
		requestedHost: overrides?.requestedHost ?? "meridian.localhost:3000",
		canonicalHost: "meridian.localhost:3000",
		matchedHostType: "local" as const,
		portal: {
			portalId: "portal_meridian" as Id<"portals">,
			slug: "meridian",
			portalType: "broker" as const,
			productionHost: "meridian.fairlend.ca",
			localHost: "meridian.localhost:3000",
			status: overrides?.status ?? "active",
			isPublished: overrides?.isPublished ?? true,
			publicTeaserEnabled: true,
			teaserListingLimit: 12,
			defaultPostAuthPath: "/",
		},
	};
}

describe("portal request host extraction", () => {
	it("defaults to the direct host header when forwarded-host trust is disabled", () => {
		const request = new Request("https://internal.invalid", {
			headers: {
				"x-forwarded-host": "MERIDIAN.LocalHost:3000, proxy.example",
				host: "marketing.fairlend.ca",
			},
		});

		expect(extractTrustedRequestHost(request)).toBe("marketing.fairlend.ca");
	});

	it("prefers x-forwarded-host only when the trusted-proxy env flag is enabled", () => {
		process.env[TRUST_X_FORWARDED_HOST_ENV] = "true";
		const request = new Request("https://internal.invalid", {
			headers: {
				"x-forwarded-host": "MERIDIAN.LocalHost:3000, proxy.example",
				host: "marketing.fairlend.ca",
			},
		});

		expect(extractTrustedRequestHost(request)).toBe("meridian.localhost:3000");
	});
});

describe("resolveRootPortalContext", () => {
	it("treats www.fairlend.ca as marketing with one canonical host", async () => {
		const resolvePortalByHost = vi.fn(async () => null);

		const portalContext = await resolveRootPortalContext(
			{
				requestHost: "WWW.FairLend.ca",
				token: null,
			},
			{ resolvePortalByHost }
		);

		expect(portalContext.kind).toBe("marketing");
		expect(portalContext.canonicalHost).toBe("fairlend.ca");
		expect(portalContext.cacheKey).toBe("marketing:fairlend.ca");
		expect(resolvePortalByHost).not.toHaveBeenCalled();
	});

	it("treats localhost:3000 as the canonical marketing host in local development", async () => {
		const portalContext = await resolveRootPortalContext(
			{
				requestHost: "LOCALHOST:3000",
				token: null,
			},
			{
				resolvePortalByHost: async () => null,
			}
		);

		expect(portalContext.kind).toBe("marketing");
		expect(portalContext.canonicalHost).toBe("localhost:3000");
	});

	it("preserves the explicit admin host kind", async () => {
		const portalContext = await resolveRootPortalContext(
			{
				requestHost: "ADMIN.localhost:3000",
				token: null,
			},
			{
				resolvePortalByHost: async () => null,
			}
		);

		expect(portalContext.kind).toBe("admin");
		expect(portalContext.canonicalHost).toBe("admin.localhost:3000");
	});

	it("resolves active broker portals through the registry and exposes a stable cache key", async () => {
		const portalContext = await resolveRootPortalContext(
			{
				requestHost: "MERIDIAN.localhost:3000",
				token: null,
			},
			{
				resolvePortalByHost: async () => buildResolvedPortal(),
			}
		);

		expect(portalContext.kind).toBe("portal");
		expect(portalContext.availability).toBe("active");
		expect(portalContext.canonicalHost).toBe("meridian.localhost:3000");
		expect(portalContext.cacheKey).toBe(
			"portal:portal_meridian:active:local:meridian.localhost:3000"
		);
	});

	it("classifies reserved hosts when no portal row exists", async () => {
		const portalContext = await resolveRootPortalContext(
			{
				requestHost: "api.localhost:3000",
				token: null,
			},
			{
				resolvePortalByHost: async () => null,
			}
		);

		expect(portalContext.kind).toBe("reserved");
		expect(portalContext.reservedSlug).toBe("api");
	});

	it("marks unpublished portals as unavailable without falling back to marketing", async () => {
		const portalContext = await resolveRootPortalContext(
			{
				requestHost: "meridian.localhost:3000",
				token: null,
			},
			{
				resolvePortalByHost: async () =>
					buildResolvedPortal({
						availability: "unpublished",
						isPublished: false,
						status: "draft",
					}),
			}
		);

		expect(portalContext.kind).toBe("portal");
		expect(portalContext.availability).toBe("unpublished");
	});

	it("blocks misconfigured portals at the root boundary", async () => {
		const portalContext = await resolveRootPortalContext(
			{
				requestHost: "meridian.localhost:3000",
				token: null,
			},
			{
				resolvePortalByHost: async () =>
					buildResolvedPortal({ availability: "misconfigured" }),
			}
		);

		expect(portalContext.kind).toBe("portal");
		expect(portalContext.availability).toBe("misconfigured");

		render(
			<PortalStateBoundary portalContext={portalContext}>
				<div>portal children</div>
			</PortalStateBoundary>
		);

		expect(screen.getByText("Portal unavailable")).not.toBeNull();
		expect(screen.queryByText("portal children")).toBeNull();
	});
});

describe("PortalStateBoundary", () => {
	it("renders an explicit fail-closed state for unknown hosts", () => {
		render(
			<PortalStateBoundary
				portalContext={{
					kind: "unknown",
					requestedHost: "ghost.localhost:3000",
					canonicalHost: "ghost.localhost:3000",
					cacheKey: "unknown:ghost.localhost:3000",
				}}
			>
				<div>hidden children</div>
			</PortalStateBoundary>
		);

		expect(screen.getByText("Portal not found")).not.toBeNull();
		expect(screen.queryByText("hidden children")).toBeNull();
	});

	it("passes active portal content through unchanged", async () => {
		const portalContext = await resolveRootPortalContext(
			{
				requestHost: "meridian.localhost:3000",
				token: null,
			},
			{
				resolvePortalByHost: async () => buildResolvedPortal(),
			}
		);

		render(
			<PortalStateBoundary portalContext={portalContext}>
				<div>portal children</div>
			</PortalStateBoundary>
		);

		expect(screen.getByText("portal children")).not.toBeNull();
	});
});
