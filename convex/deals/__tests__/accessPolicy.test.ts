import { describe, expect, it } from "vitest";
import {
	classifyDealAccessFacts,
	dealPersonaToDocumentSignatoryRole,
	dealPersonaToTemplateVariablePrefix,
	legacyDocumentSignatoryRoleToDealPersona,
	legacyStorageRoleToDealPersona,
	type NormalizedDealAccessFacts,
} from "../../../src/lib/deals/access-policy/classify";
import type { DealAccessDecision } from "../../../src/lib/deals/access-policy/types";

const BASE_FACTS = {
	activeDealAccess: [],
	closingTeam: false,
	dealId: "deal_policy_1",
	intent: "deal.portal.view",
	isFairLendAdmin: false,
	lawyer: {
		hasAcceptedEngagement: false,
		hasCurrentVerification: false,
		hasOwnedOnboardingSession: false,
		invitationTargetMatchesViewer: false,
		isSelectedByAuthId: false,
		isSelectedByEmail: false,
		kind: null,
		onboardingSessionId: null,
		onboardingStatus: null,
	},
	mortgageBorrower: null,
	viewerAuthId: "viewer-auth",
	workosRoles: [],
} satisfies NormalizedDealAccessFacts;

function classify(
	overrides: Partial<NormalizedDealAccessFacts>
): DealAccessDecision {
	return classifyDealAccessFacts({ ...BASE_FACTS, ...overrides });
}

describe("canonical deal access policy", () => {
	it("does not convert a non-FairLend WorkOS admin role into fairlend_admin persona", () => {
		const decision = classify({
			isFairLendAdmin: false,
			workosRoles: ["admin"],
		});

		expect(decision).toMatchObject({
			allowed: false,
			persona: "participating_lender",
			readiness: "revoked",
			scope: "none",
		});
		expect(decision.persona).not.toBe("fairlend_admin");
	});

	it("treats buyer/seller storage fields as purchasing/selling lender shims, not personas", () => {
		const purchasing = classify({
			purchasingLenderAuthId: "viewer-auth",
		});
		const selling = classify({
			sellingLenderAuthId: "viewer-auth",
		});

		expect(purchasing).toMatchObject({
			allowed: true,
			persona: "purchasing_lender",
			readiness: "active",
			scope: "full_deal",
		});
		expect(selling).toMatchObject({
			allowed: true,
			persona: "selling_lender",
			readiness: "active",
			scope: "full_deal",
		});
		expect(selling.persona).not.toBe("primary_borrower");
		expect(selling.persona).not.toBe("borrower_primary");
		expect(selling.redirectTo).not.toBe("/borrower/deals");
	});

	it("allows invited lawyers to bootstrap onboarding without granting portal access", () => {
		const invitedPortal = classify({
			lawyer: {
				...BASE_FACTS.lawyer,
				invitationTargetMatchesViewer: true,
				isSelectedByEmail: true,
				kind: "guest_lawyer",
			},
		});
		const invitedBootstrap = classify({
			intent: "lawyer.onboarding.bootstrap",
			lawyer: {
				...BASE_FACTS.lawyer,
				invitationTargetMatchesViewer: true,
				isSelectedByEmail: true,
				kind: "guest_lawyer",
			},
		});

		expect(invitedPortal).toMatchObject({
			allowed: false,
			persona: "primary_lawyer",
			readiness: "invited",
			redirectTo: "/lawyer/deals/deal_policy_1",
			scope: "none",
		});
		expect(invitedBootstrap).toMatchObject({
			allowed: true,
			persona: "primary_lawyer",
			readiness: "invited",
			scope: "onboarding_only",
		});
		expect(invitedBootstrap.capabilities).toEqual([
			"lawyer.onboarding.bootstrap",
		]);
	});

	it("does not treat active guest lawyer dealAccess alone as full lawyer readiness", () => {
		const decision = classify({
			activeDealAccess: [
				{
					persona: "primary_lawyer",
					source: "guest_lawyer",
				},
			],
			lawyer: {
				...BASE_FACTS.lawyer,
				isSelectedByAuthId: true,
				kind: "guest_lawyer",
			},
		});

		expect(decision).toMatchObject({
			allowed: false,
			persona: "primary_lawyer",
			readiness: "verification_required",
			scope: "none",
		});
		expect(decision.capabilities).toEqual([]);
	});

	it("requires lawyer verification and engagement before document review access", () => {
		const active = classify({
			activeDealAccess: [
				{
					persona: "primary_lawyer",
					source: "platform_lawyer",
				},
			],
			intent: "lawyer.document.review",
			lawyer: {
				...BASE_FACTS.lawyer,
				hasAcceptedEngagement: true,
				hasCurrentVerification: true,
				isSelectedByAuthId: true,
				kind: "platform_lawyer",
			},
		});

		expect(active).toMatchObject({
			allowed: true,
			persona: "primary_lawyer",
			readiness: "active",
			scope: "party_limited",
		});
		expect(active.capabilities).toContain("lawyer.document.review");
	});
});

describe("deal persona boundary adapters", () => {
	it("requires deal context before refining legacy lender storage roles", () => {
		expect(
			legacyStorageRoleToDealPersona({
				role: "lender",
			})
		).toBeNull();
		expect(
			legacyStorageRoleToDealPersona({
				dealPosition: "purchasing",
				role: "lender",
			})
		).toBe("purchasing_lender");
		expect(
			legacyStorageRoleToDealPersona({
				dealPosition: "selling",
				role: "lender",
			})
		).toBe("selling_lender");
		expect(legacyStorageRoleToDealPersona({ role: "borrower" })).toBeNull();
	});

	it("keeps lawyer source values as metadata that resolve to primary_lawyer", () => {
		expect(legacyStorageRoleToDealPersona({ role: "guest_lawyer" })).toBe(
			"primary_lawyer"
		);
		expect(legacyStorageRoleToDealPersona({ role: "platform_lawyer" })).toBe(
			"primary_lawyer"
		);
	});

	it("maps document signatory aliases explicitly without selling-lender borrower bleed", () => {
		expect(dealPersonaToDocumentSignatoryRole("purchasing_lender")).toBe(
			"purchasing_lender"
		);
		expect(dealPersonaToDocumentSignatoryRole("selling_lender")).toBe(
			"selling_lender"
		);
		expect(dealPersonaToDocumentSignatoryRole("primary_borrower")).toBe(
			"primary_borrower"
		);
		expect(dealPersonaToDocumentSignatoryRole("selling_lender")).not.toBe(
			"borrower_primary"
		);
		expect(legacyDocumentSignatoryRoleToDealPersona("lender_primary")).toBe(
			"purchasing_lender"
		);
		expect(legacyDocumentSignatoryRoleToDealPersona("borrower_primary")).toBe(
			"primary_borrower"
		);
		expect(legacyDocumentSignatoryRoleToDealPersona("lawyer_primary")).toBe(
			"primary_lawyer"
		);
	});

	it("exposes canonical variable prefixes for authoring and generation", () => {
		expect(dealPersonaToTemplateVariablePrefix("purchasing_lender")).toBe(
			"purchasing_lender"
		);
		expect(dealPersonaToTemplateVariablePrefix("selling_lender")).toBe(
			"selling_lender"
		);
		expect(dealPersonaToTemplateVariablePrefix("primary_borrower")).toBe(
			"primary_borrower"
		);
		expect(dealPersonaToTemplateVariablePrefix("primary_lawyer")).toBe(
			"primary_lawyer"
		);
	});
});
