import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { roundToTwoDecimals } from "../listings/math";
import type { PortalPricingPolicyParameters } from "./validators";

type PortalDoc = Doc<"portals">;
export type PortalPricingPolicyDoc = Doc<"portalPricingPolicies">;
type PortalPricingReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

export const PORTAL_PROJECTED_LISTING_FIELDS = [
	"interestRate",
	"monthlyPayment",
] as const;

export type PortalProjectedListingField =
	(typeof PORTAL_PROJECTED_LISTING_FIELDS)[number];

export interface PortalProjectableListing {
	interestRate: number;
	monthlyPayment: number;
}

export type PortalPricingUnavailableReason =
	| "missing-active-policy"
	| "invalid-selected-policy"
	| "ambiguous-active-policy"
	| "invalid-policy";

export type PortalPricingSelection =
	| {
			kind: "ready";
			parameters: PortalPricingPolicyParameters;
			policy: PortalPricingPolicyDoc;
			projectedFields: readonly PortalProjectedListingField[];
	  }
	| {
			kind: "setup-optional";
			reason: "portal-unpublished";
	  }
	| {
			kind: "unavailable";
			reason: PortalPricingUnavailableReason;
	  };

function normalizePortalPricingParameters(input: {
	brokerSplitPercent: number;
}): PortalPricingPolicyParameters {
	if (!Number.isFinite(input.brokerSplitPercent)) {
		throw new ConvexError("Portal pricing brokerSplitPercent must be finite");
	}
	if (input.brokerSplitPercent < 0 || input.brokerSplitPercent > 100) {
		throw new ConvexError(
			"Portal pricing brokerSplitPercent must stay between 0 and 100"
		);
	}

	return {
		brokerSplitPercent: input.brokerSplitPercent,
	};
}

function hasValidPolicyWindow(policy: PortalPricingPolicyDoc) {
	return (
		policy.effectiveTo === undefined ||
		policy.effectiveTo > policy.effectiveFrom
	);
}

function isPolicyActiveAt(policy: PortalPricingPolicyDoc, atTime: number) {
	return (
		policy.status === "active" &&
		policy.effectiveFrom <= atTime &&
		(policy.effectiveTo === undefined || atTime < policy.effectiveTo)
	);
}

function hasValidPolicyConfiguration(policy: PortalPricingPolicyDoc) {
	try {
		normalizePortalPricingParameters(policy);
		return hasValidPolicyWindow(policy);
	} catch {
		return false;
	}
}

function buildReadySelection(
	policy: PortalPricingPolicyDoc
): Extract<PortalPricingSelection, { kind: "ready" }> {
	return {
		kind: "ready",
		parameters: normalizePortalPricingParameters(policy),
		policy,
		projectedFields: PORTAL_PROJECTED_LISTING_FIELDS,
	};
}

function buildUnavailableSelection(
	reason: PortalPricingUnavailableReason
): Extract<PortalPricingSelection, { kind: "unavailable" }> {
	return {
		kind: "unavailable",
		reason,
	};
}

export function selectEffectivePortalPricingPolicy(args: {
	atTime: number;
	policies: PortalPricingPolicyDoc[];
	portal: Pick<PortalDoc, "_id" | "isPublished" | "pricingPolicyId" | "slug">;
}): PortalPricingSelection {
	const policiesForPortal = args.policies.filter(
		(policy) => policy.portalId === args.portal._id
	);
	const activePolicies = policiesForPortal.filter(
		(policy) =>
			hasValidPolicyConfiguration(policy) &&
			isPolicyActiveAt(policy, args.atTime)
	);

	if (args.portal.pricingPolicyId) {
		const selectedPolicy =
			policiesForPortal.find(
				(policy) => policy._id === args.portal.pricingPolicyId
			) ?? null;

		if (!selectedPolicy) {
			return args.portal.isPublished
				? buildUnavailableSelection("invalid-selected-policy")
				: { kind: "setup-optional", reason: "portal-unpublished" };
		}

		if (
			!(
				hasValidPolicyConfiguration(selectedPolicy) &&
				isPolicyActiveAt(selectedPolicy, args.atTime)
			)
		) {
			return args.portal.isPublished
				? buildUnavailableSelection("invalid-selected-policy")
				: { kind: "setup-optional", reason: "portal-unpublished" };
		}

		const competingActivePolicies = activePolicies.filter(
			(policy) => policy._id !== selectedPolicy._id
		);
		if (competingActivePolicies.length > 0) {
			return buildUnavailableSelection("ambiguous-active-policy");
		}

		return buildReadySelection(selectedPolicy);
	}

	if (activePolicies.length === 1) {
		return buildReadySelection(activePolicies[0]);
	}

	if (activePolicies.length > 1) {
		return buildUnavailableSelection("ambiguous-active-policy");
	}

	if (!args.portal.isPublished) {
		return { kind: "setup-optional", reason: "portal-unpublished" };
	}

	return buildUnavailableSelection(
		policiesForPortal.some((policy) => !hasValidPolicyConfiguration(policy))
			? "invalid-policy"
			: "missing-active-policy"
	);
}

export async function loadPortalPricingSelection(
	ctx: PortalPricingReaderCtx,
	args: {
		atTime: number;
		portalId: PortalDoc["_id"];
	}
): Promise<PortalPricingSelection> {
	const portal = await ctx.db.get(args.portalId);
	if (!portal) {
		throw new ConvexError("Portal no longer exists for pricing selection");
	}

	const policies = await ctx.db
		.query("portalPricingPolicies")
		.withIndex("by_portal", (query) => query.eq("portalId", args.portalId))
		.collect();

	return selectEffectivePortalPricingPolicy({
		atTime: args.atTime,
		policies,
		portal,
	});
}

export function requirePortalPricingSelection(
	selection: PortalPricingSelection,
	portalSlug: string
): Extract<PortalPricingSelection, { kind: "ready" }> {
	switch (selection.kind) {
		case "ready":
			return selection;
		case "setup-optional":
			throw new ConvexError(
				`Portal pricing for ${portalSlug} is optional while the portal remains unpublished`
			);
		case "unavailable":
			throw new ConvexError(
				`Portal pricing unavailable for ${portalSlug}: ${selection.reason}`
			);
		default:
			throw new ConvexError("Portal pricing selection is in an unknown state");
	}
}

function projectBrokerCutValue(
	value: number,
	parameters: PortalPricingPolicyParameters
) {
	if (!Number.isFinite(value) || value < 0) {
		throw new ConvexError(
			"Portal pricing expects non-negative finite listing values"
		);
	}

	const multiplier = 1 - parameters.brokerSplitPercent / 100;
	const projected = value * multiplier;
	if (!Number.isFinite(projected) || projected < 0) {
		throw new ConvexError("Portal pricing produced an invalid projected value");
	}

	return roundToTwoDecimals(projected);
}

export function projectListingForPortal<T extends PortalProjectableListing>(
	listing: T,
	input:
		| PortalPricingPolicyParameters
		| Pick<PortalPricingPolicyDoc, "brokerSplitPercent">
): T {
	const parameters = normalizePortalPricingParameters(input);

	return {
		...listing,
		interestRate: projectBrokerCutValue(listing.interestRate, parameters),
		monthlyPayment: projectBrokerCutValue(listing.monthlyPayment, parameters),
	};
}
