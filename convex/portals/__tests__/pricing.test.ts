import { describe, expect, it } from "vitest";
import { createTestConvex } from "../../../src/test/auth/helpers";
import type { Id } from "../../_generated/dataModel";
import {
	loadPortalPricingSelection,
	PORTAL_PROJECTED_LISTING_FIELDS,
	type PortalPricingPolicyDoc,
	projectListingForPortal,
	requirePortalPricingSelection,
	selectEffectivePortalPricingPolicy,
} from "../pricing";

const NOW = 1_710_000_000_000;

function buildPortal(overrides?: {
	_id?: Id<"portals">;
	isPublished?: boolean;
	pricingPolicyId?: Id<"portalPricingPolicies">;
	slug?: string;
}) {
	return {
		_id: overrides?._id ?? ("portal_meridian" as Id<"portals">),
		isPublished: overrides?.isPublished ?? true,
		pricingPolicyId: overrides?.pricingPolicyId,
		slug: overrides?.slug ?? "meridian",
	};
}

function buildPolicy(overrides?: {
	_id?: Id<"portalPricingPolicies">;
	brokerSplitPercent?: number;
	effectiveFrom?: number;
	effectiveTo?: number;
	portalId?: Id<"portals">;
	status?: "active" | "archived" | "draft";
}): PortalPricingPolicyDoc {
	return {
		_id:
			overrides?._id ??
			("policy_meridian_active" as Id<"portalPricingPolicies">),
		_creationTime: NOW,
		brokerSplitPercent: overrides?.brokerSplitPercent ?? 12.5,
		createdAt: NOW - 10_000,
		effectiveFrom: overrides?.effectiveFrom ?? NOW - 5000,
		effectiveTo: overrides?.effectiveTo,
		portalId: overrides?.portalId ?? ("portal_meridian" as Id<"portals">),
		status: overrides?.status ?? "active",
		updatedAt: NOW,
	};
}

describe("portal pricing contract", () => {
	it("selects the pointed active policy while ignoring future-dated rows", () => {
		const currentPolicy = buildPolicy();
		const futurePolicy = buildPolicy({
			_id: "policy_meridian_future" as Id<"portalPricingPolicies">,
			effectiveFrom: NOW + 60_000,
		});
		const selection = selectEffectivePortalPricingPolicy({
			atTime: NOW,
			policies: [currentPolicy, futurePolicy],
			portal: buildPortal({ pricingPolicyId: currentPolicy._id }),
		});

		expect(selection.kind).toBe("ready");
		if (selection.kind !== "ready") {
			throw new Error("Expected a ready selection");
		}

		expect(selection.policy._id).toBe(currentPolicy._id);
		expect(selection.projectedFields).toEqual(PORTAL_PROJECTED_LISTING_FIELDS);
	});

	it("returns setup-optional for unpublished portals missing pricing", () => {
		const selection = selectEffectivePortalPricingPolicy({
			atTime: NOW,
			policies: [],
			portal: buildPortal({
				isPublished: false,
				pricingPolicyId: undefined,
				slug: "draft-portal",
			}),
		});

		expect(selection).toEqual({
			kind: "setup-optional",
			reason: "portal-unpublished",
		});
	});

	it("rejects ambiguous active policies when no canonical pointer is set", () => {
		const selection = selectEffectivePortalPricingPolicy({
			atTime: NOW,
			policies: [
				buildPolicy(),
				buildPolicy({
					_id: "policy_meridian_overlap" as Id<"portalPricingPolicies">,
					brokerSplitPercent: 8,
				}),
			],
			portal: buildPortal({ pricingPolicyId: undefined }),
		});

		expect(selection).toEqual({
			kind: "unavailable",
			reason: "ambiguous-active-policy",
		});
	});

	it("projects only the portal-priced listing fields and rounds to two decimals", () => {
		const projected = projectListingForPortal(
			{
				interestRate: 8.75,
				ltvRatio: 65,
				monthlyPayment: 1633.335,
				principal: 250_000,
			},
			{ brokerSplitPercent: 12.5 }
		);

		expect(projected.interestRate).toBe(7.66);
		expect(projected.monthlyPayment).toBe(1429.17);
		expect(projected.principal).toBe(250_000);
		expect(projected.ltvRatio).toBe(65);
	});

	it("loads and requires the selected pricing policy from stored portal rows", async () => {
		const t = createTestConvex();
		const portalId = await t.run(async (ctx) => {
			const portalId = await ctx.db.insert("portals", {
				brokerId: undefined,
				createdAt: NOW,
				defaultPostAuthPath: "/",
				isPublished: true,
				landingPageId: undefined,
				localHost: "meridian.localhost:3000",
				orgId: "org_meridian",
				portalType: "broker",
				pricingPolicyId: undefined,
				productionHost: "meridian.fairlend.ca",
				publicTeaserEnabled: true,
				slug: "meridian",
				status: "active",
				teaserListingLimit: 12,
				updatedAt: NOW,
			});
			const policyId = await ctx.db.insert("portalPricingPolicies", {
				brokerSplitPercent: 10,
				createdAt: NOW,
				effectiveFrom: NOW - 5000,
				effectiveTo: undefined,
				portalId,
				status: "active",
				updatedAt: NOW,
			});
			await ctx.db.patch(portalId, {
				pricingPolicyId: policyId,
				updatedAt: NOW,
			});
			return portalId;
		});

		const selection = await t.run(
			async (ctx) =>
				await loadPortalPricingSelection(ctx, { atTime: NOW, portalId })
		);
		const readySelection = requirePortalPricingSelection(selection, "meridian");

		expect(readySelection.parameters.brokerSplitPercent).toBe(10);
		expect(readySelection.policy.portalId).toBe(portalId);
	});
});
