/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PortalFinancingStartPage } from "#/components/portal/financing/PortalFinancingStartPage";
import type { RootRoutePortalContext } from "#/routes/__root";

afterEach(() => {
	cleanup();
});

const PORTAL_CONTEXT = {
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
} satisfies Extract<RootRoutePortalContext, { kind: "portal" }>;

describe("portal financing continuation", () => {
	it("renders the public intake continuation with portal attribution and prefill", () => {
		render(
			<PortalFinancingStartPage
				kind="intake"
				portalContext={PORTAL_CONTEXT}
				prefill={{
					amountNeeded: "$650,000",
					email: "alex@example.com",
					fullName: "Alex Borrower",
				}}
			/>
		);

		expect(
			screen.getByRole("heading", { name: "Start financing with Meridian" })
		).toBeTruthy();
		expect(screen.getByText("meridian.localhost:3000")).toBeTruthy();
		expect(screen.getByText("Alex Borrower")).toBeTruthy();
		expect(screen.getByText("alex@example.com")).toBeTruthy();
		expect(screen.getByText("$650,000")).toBeTruthy();
		const continuationHref = screen
			.getByRole("link", { name: /Continue financing intake/ })
			.getAttribute("href");
		expect(continuationHref?.startsWith("/sign-up?redirect=")).toBe(true);
		expect(
			decodeURIComponent(continuationHref?.replace("/sign-up?redirect=", "") ?? "")
		).toBe(
			"/borrower/financing/start?fullName=Alex+Borrower&email=alex%40example.com&amountNeeded=%24650%2C000"
		);
		expect(
			screen.getByRole("link", { name: /Jump to pre-approval/ }).getAttribute("href")
		).toBe(
			"/financing/pre-approval?fullName=Alex+Borrower&email=alex%40example.com&amountNeeded=%24650%2C000"
		);
		expect(screen.queryByText("/borrower")).toBeNull();
	});

	it("renders the nested pre-approval continuation inside the financing family", () => {
		render(
			<PortalFinancingStartPage
				kind="pre-approval"
				portalContext={PORTAL_CONTEXT}
				prefill={{}}
			/>
		);

		expect(
			screen.getByRole("heading", {
				name: "Start pre-approval with Meridian",
			})
		).toBeTruthy();
		expect(screen.getByText("No landing-page prefill was provided.")).toBeTruthy();
		expect(
			screen
				.getByRole("link", { name: /Continue pre-approval/ })
				.getAttribute("href")
		).toBe("/sign-up?redirect=%2Fborrower%2Ffinancing%2Fpre-approval");
		expect(
			screen.getByRole("link", { name: /Use general intake/ }).getAttribute("href")
		).toBe("/financing/start");
	});

	it("shows the resolved production host instead of the local portal host", () => {
		render(
			<PortalFinancingStartPage
				kind="intake"
				portalContext={{
					...PORTAL_CONTEXT,
					canonicalHost: "meridian.fairlend.ca",
					matchedHostType: "production",
					requestedHost: "meridian.fairlend.ca",
				}}
				prefill={{}}
			/>
		);

		expect(screen.getByText("meridian.fairlend.ca")).toBeTruthy();
		expect(screen.queryByText("meridian.localhost:3000")).toBeNull();
	});
});
