import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { normalizePortalHost, normalizePortalSlug } from "./helpers";

type PortalRegistryCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

interface PortalRegistryCandidate {
	brokerId?: Id<"brokers">;
	currentPortalId?: Id<"portals">;
	localHost: string;
	orgId: string;
	productionHost: string;
	slug: string;
}

type NormalizedPortalRegistryCandidate = Omit<
	PortalRegistryCandidate,
	"currentPortalId"
>;

type PortalConflictField =
	| "brokerId"
	| "localHost"
	| "orgId"
	| "productionHost"
	| "slug";

type UniquePortalIndex =
	| {
			field: "slug";
			index: "by_slug";
			value: string;
	  }
	| {
			field: "productionHost";
			index: "by_production_host";
			value: string;
	  }
	| {
			field: "localHost";
			index: "by_local_host";
			value: string;
	  }
	| {
			field: "brokerId";
			index: "by_broker";
			value: Id<"brokers">;
	  }
	| {
			field: "orgId";
			index: "by_org";
			value: string;
	  };

export function normalizePortalRegistryCandidate(
	candidate: PortalRegistryCandidate
): PortalRegistryCandidate {
	const slug = normalizePortalSlug(candidate.slug);
	if (!slug) {
		throw new ConvexError("Portal slug cannot be empty");
	}

	return {
		...candidate,
		localHost: normalizePortalHost(candidate.localHost),
		productionHost: normalizePortalHost(candidate.productionHost),
		slug,
	};
}

async function assertUniquePortalClaim(
	ctx: PortalRegistryCtx,
	check: UniquePortalIndex,
	currentPortalId?: Id<"portals">
) {
	const conflictingPortal = (
		await ctx.db
			.query("portals")
			.withIndex(check.index, (query) => query.eq(check.field, check.value))
			.collect()
	).find((portal) => portal._id !== currentPortalId);

	if (conflictingPortal) {
		throw new ConvexError(
			`Portal ${check.field} "${String(check.value)}" is already claimed by ${String(conflictingPortal._id)}`
		);
	}
}

export async function assertPortalRegistryInvariants(
	ctx: PortalRegistryCtx,
	candidate: PortalRegistryCandidate
): Promise<NormalizedPortalRegistryCandidate> {
	const normalizedCandidate = normalizePortalRegistryCandidate(candidate);
	const uniqueChecks: UniquePortalIndex[] = [
		{
			field: "slug",
			index: "by_slug",
			value: normalizedCandidate.slug,
		},
		{
			field: "productionHost",
			index: "by_production_host",
			value: normalizedCandidate.productionHost,
		},
		{
			field: "localHost",
			index: "by_local_host",
			value: normalizedCandidate.localHost,
		},
		{
			field: "orgId",
			index: "by_org",
			value: normalizedCandidate.orgId,
		},
	];

	if (normalizedCandidate.brokerId) {
		uniqueChecks.push({
			field: "brokerId",
			index: "by_broker",
			value: normalizedCandidate.brokerId,
		});
	}

	for (const check of uniqueChecks) {
		await assertUniquePortalClaim(
			ctx,
			check,
			normalizedCandidate.currentPortalId
		);
	}

	const { currentPortalId: _currentPortalId, ...persistedCandidate } =
		normalizedCandidate;
	return persistedCandidate;
}

export function portalConflictFieldLabel(field: PortalConflictField) {
	switch (field) {
		case "slug":
			return "slug";
		case "productionHost":
			return "production host";
		case "localHost":
			return "local host";
		case "brokerId":
			return "broker";
		case "orgId":
			return "organization";
		default:
			return field;
	}
}
