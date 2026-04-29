import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { roundToTwoDecimals } from "../listings/math";
import {
	type PortalAvailability,
	type PortalPricingPolicyParameters,
	validatePortalPricingPolicyContract,
	validatePortalPricingPolicyParameters,
} from "./validators";

type PortalDoc = Doc<"portals">;
export type BrokerPortalPricingSettingDoc = Doc<"brokerPortalPricingSettings">;
export type PortalPricingPolicyDoc = Doc<"portalPricingPolicies">;
interface PortalPricingReaderCtx {
	db: Pick<QueryCtx["db"], "get" | "query">;
}
interface PortalPricingWriterCtx {
	db: Pick<MutationCtx["db"], "get" | "insert" | "patch" | "query">;
}

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

export interface BrokerPortalPricingSnapshot {
	readonly brokerPortalCount: number;
	readonly brokerSplitPercent: number;
	readonly driftedBrokerPortalCount: number;
	readonly lastUpdatedAt: number | null;
	readonly updatedByAuthId: string | null;
}

export interface PortalPricingSyncSummary {
	readonly brokerPortalCount: number;
	readonly brokerPortalsUpdated: number;
	readonly fairLendPortalsUpdated: number;
	readonly setting: BrokerPortalPricingSettingDoc;
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
		validatePortalPricingPolicyContract(policy);
		return true;
	} catch (error) {
		if (error instanceof ConvexError) {
			return false;
		}
		throw error;
	}
}

function buildReadySelection(
	policy: PortalPricingPolicyDoc
): Extract<PortalPricingSelection, { kind: "ready" }> {
	return {
		kind: "ready",
		parameters: validatePortalPricingPolicyParameters(policy),
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

async function getSingleBrokerPortalPricingSetting(
	ctx: PortalPricingReaderCtx
): Promise<BrokerPortalPricingSettingDoc | null> {
	const settings = await ctx.db.query("brokerPortalPricingSettings").collect();
	if (settings.length > 1) {
		throw new ConvexError("Duplicate broker portal pricing settings rows");
	}
	return settings[0] ?? null;
}

function isReadySelectionWithBrokerSplit(
	selection: PortalPricingSelection,
	brokerSplitPercent: number
): selection is Extract<PortalPricingSelection, { kind: "ready" }> {
	return (
		selection.kind === "ready" &&
		selection.parameters.brokerSplitPercent === brokerSplitPercent
	);
}

function resolvePublishedPortalAvailability(args: {
	isPublished: boolean;
	portalType: PortalDoc["portalType"];
	portalStatus: PortalDoc["status"];
	pricingSelection?: PortalPricingSelection;
}): PortalAvailability {
	if (!args.isPublished) {
		return "unpublished";
	}

	if (args.portalStatus !== "active") {
		return args.portalStatus;
	}

	if (args.portalType === "mic") {
		return "active";
	}

	return args.pricingSelection?.kind === "ready" ? "active" : "misconfigured";
}

async function loadPortalPricingPolicies(
	ctx: PortalPricingReaderCtx,
	portalId: PortalDoc["_id"]
) {
	return await ctx.db
		.query("portalPricingPolicies")
		.withIndex("by_portal", (query) => query.eq("portalId", portalId))
		.collect();
}

export async function getBrokerPortalPricingSetting(
	ctx: PortalPricingReaderCtx
) {
	return await getSingleBrokerPortalPricingSetting(ctx);
}

export async function ensureBrokerPortalPricingSetting(
	ctx: PortalPricingWriterCtx,
	args?: { updatedByAuthId?: string }
): Promise<BrokerPortalPricingSettingDoc> {
	const existing = await getSingleBrokerPortalPricingSetting(ctx);
	if (existing) {
		return existing;
	}

	const now = Date.now();
	const settingId = await ctx.db.insert("brokerPortalPricingSettings", {
		brokerSplitPercent: 0,
		createdAt: now,
		updatedAt: now,
		updatedByAuthId: args?.updatedByAuthId,
	});
	const setting = await ctx.db.get(settingId);
	if (!setting) {
		throw new ConvexError("Broker portal pricing setting could not be created");
	}

	return setting;
}

export async function setBrokerPortalPricingSetting(
	ctx: PortalPricingWriterCtx,
	args: { brokerSplitPercent: number; updatedByAuthId?: string }
): Promise<BrokerPortalPricingSettingDoc> {
	const parameters = validatePortalPricingPolicyParameters({
		brokerSplitPercent: args.brokerSplitPercent,
	});
	const existing = await ensureBrokerPortalPricingSetting(ctx, {
		updatedByAuthId: args.updatedByAuthId,
	});

	if (existing.brokerSplitPercent === parameters.brokerSplitPercent) {
		return existing;
	}

	const now = Date.now();
	await ctx.db.patch(existing._id, {
		brokerSplitPercent: parameters.brokerSplitPercent,
		updatedAt: now,
		updatedByAuthId: args.updatedByAuthId,
	});

	const setting = await ctx.db.get(existing._id);
	if (!setting) {
		throw new ConvexError("Broker portal pricing setting could not be updated");
	}

	return setting;
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
		/** When set, skips re-fetching the portal document (caller must match `portalId`). */
		portal?: PortalDoc | null;
	}
): Promise<PortalPricingSelection> {
	const portal =
		args.portal !== undefined && args.portal !== null
			? args.portal
			: await ctx.db.get(args.portalId);
	if (!portal) {
		throw new ConvexError("Portal no longer exists for pricing selection");
	}
	if (portal._id !== args.portalId) {
		throw new ConvexError("Portal id mismatch for pricing selection");
	}

	const policies = await loadPortalPricingPolicies(ctx, args.portalId);

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

export async function ensurePortalSelectedPricingPolicy(
	ctx: PortalPricingWriterCtx,
	args: {
		brokerSplitPercent: number;
		portalId: PortalDoc["_id"];
	}
) {
	const portal = await ctx.db.get(args.portalId);
	if (!portal) {
		throw new ConvexError(
			"Portal no longer exists for pricing synchronization"
		);
	}

	const parameters = validatePortalPricingPolicyParameters({
		brokerSplitPercent: args.brokerSplitPercent,
	});
	const policies = await loadPortalPricingPolicies(ctx, args.portalId);
	const currentSelection = selectEffectivePortalPricingPolicy({
		atTime: Date.now(),
		policies,
		portal,
	});

	if (
		isReadySelectionWithBrokerSplit(
			currentSelection,
			parameters.brokerSplitPercent
		)
	) {
		const policyId = currentSelection.policy._id;
		if (portal.pricingPolicyId !== policyId) {
			const now = Date.now();
			await ctx.db.patch(portal._id, {
				pricingPolicyId: policyId,
				updatedAt: now,
			});
			return {
				brokerSplitPercent: parameters.brokerSplitPercent,
				changed: true,
				policyId,
			};
		}
		return {
			brokerSplitPercent: parameters.brokerSplitPercent,
			changed: false,
			policyId,
		};
	}

	const now = Date.now();
	// Portal pricing policies are synchronized configuration rows, not governed
	// transition entities. Superseded active rows are archived in place before a
	// new selected policy row is inserted.
	await Promise.all(
		policies.flatMap((policy) =>
			policy.status === "active"
				? [
						ctx.db.patch(policy._id, {
							effectiveTo:
								policy.effectiveFrom < now &&
								(policy.effectiveTo === undefined || policy.effectiveTo > now)
									? now
									: policy.effectiveTo,
							status: "archived",
							updatedAt: now,
						}),
					]
				: []
		)
	);

	const policyId = await ctx.db.insert("portalPricingPolicies", {
		brokerSplitPercent: parameters.brokerSplitPercent,
		createdAt: now,
		effectiveFrom: now,
		effectiveTo: undefined,
		portalId: args.portalId,
		status: "active",
		updatedAt: now,
	});

	await ctx.db.patch(args.portalId, {
		pricingPolicyId: policyId,
		updatedAt: now,
	});

	return {
		brokerSplitPercent: parameters.brokerSplitPercent,
		changed: true,
		policyId,
	};
}

export async function syncAllPortalPricingSelections(
	ctx: PortalPricingWriterCtx,
	args?: { updatedByAuthId?: string }
): Promise<PortalPricingSyncSummary> {
	const setting = await ensureBrokerPortalPricingSetting(ctx, {
		updatedByAuthId: args?.updatedByAuthId,
	});
	const portals = await ctx.db.query("portals").collect();

	let brokerPortalsUpdated = 0;
	let fairLendPortalsUpdated = 0;
	let brokerPortalCount = 0;

	for (const portal of portals) {
		if (portal.portalType === "fairlend") {
			const result = await ensurePortalSelectedPricingPolicy(ctx, {
				brokerSplitPercent: 0,
				portalId: portal._id,
			});
			if (result.changed) {
				fairLendPortalsUpdated += 1;
			}
			continue;
		}

		brokerPortalCount += 1;
		const result = await ensurePortalSelectedPricingPolicy(ctx, {
			brokerSplitPercent: setting.brokerSplitPercent,
			portalId: portal._id,
		});
		if (result.changed) {
			brokerPortalsUpdated += 1;
		}
	}

	return {
		brokerPortalCount,
		brokerPortalsUpdated,
		fairLendPortalsUpdated,
		setting,
	};
}

export async function getBrokerPortalPricingSnapshot(
	ctx: PortalPricingReaderCtx
): Promise<BrokerPortalPricingSnapshot> {
	const setting = await getSingleBrokerPortalPricingSetting(ctx);
	const brokerSplitPercent = setting?.brokerSplitPercent ?? 0;
	const portals = await ctx.db.query("portals").collect();
	const atTime = Date.now();
	let brokerPortalCount = 0;
	let driftedBrokerPortalCount = 0;

	for (const portal of portals) {
		if (portal.portalType !== "broker") {
			continue;
		}

		brokerPortalCount += 1;
		const policies = await loadPortalPricingPolicies(ctx, portal._id);
		const selection = selectEffectivePortalPricingPolicy({
			atTime,
			policies,
			portal,
		});
		if (!isReadySelectionWithBrokerSplit(selection, brokerSplitPercent)) {
			driftedBrokerPortalCount += 1;
		}
	}

	return {
		brokerPortalCount,
		brokerSplitPercent,
		driftedBrokerPortalCount,
		lastUpdatedAt: setting?.updatedAt ?? null,
		updatedByAuthId: setting?.updatedByAuthId ?? null,
	};
}

export { resolvePublishedPortalAvailability };

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
	const parameters = validatePortalPricingPolicyParameters(input);

	return {
		...listing,
		interestRate: projectBrokerCutValue(listing.interestRate, parameters),
		monthlyPayment: projectBrokerCutValue(listing.monthlyPayment, parameters),
	};
}
