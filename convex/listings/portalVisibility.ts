import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { DatabaseReader } from "../_generated/server";
import { getLenderByAuthId, getUserByAuthId } from "../auth/actorResolution";
import type { MarketplaceFilters } from "./marketplace";

type LenderFilterConstraintDoc = Doc<"lenderFilterConstraints">;

function clampNumericRange(
	requested: { max?: number; min?: number } | undefined,
	allowed: { max: number; min: number } | undefined
) {
	if (!(requested || allowed)) {
		return undefined;
	}

	const min = Math.max(
		requested?.min ?? allowed?.min ?? Number.NEGATIVE_INFINITY,
		allowed?.min ?? Number.NEGATIVE_INFINITY
	);
	const max = Math.min(
		requested?.max ?? allowed?.max ?? Number.POSITIVE_INFINITY,
		allowed?.max ?? Number.POSITIVE_INFINITY
	);

	return {
		max: Number.isFinite(max) ? max : undefined,
		min: Number.isFinite(min) ? min : undefined,
	};
}

function clampDateUpperBound(
	requested: MarketplaceFilters["maturityDate"],
	maxDate: string | undefined
) {
	if (!(requested?.end || maxDate)) {
		return undefined;
	}

	let effectiveEnd = requested?.end ?? maxDate;
	if (requested?.end && maxDate && requested.end >= maxDate) {
		effectiveEnd = maxDate;
	}

	return effectiveEnd ? { end: effectiveEnd } : undefined;
}

function clampEnumValues<T extends string>(
	requested: readonly T[] | undefined,
	allowed: readonly string[] | undefined
): T[] | undefined {
	if (allowed === undefined) {
		return requested ? [...requested] : undefined;
	}

	if (allowed.length === 0) {
		return [];
	}

	if (!requested?.length) {
		return [...allowed] as T[];
	}

	const allowedSet = new Set(allowed);
	return requested.filter((value) => allowedSet.has(value));
}

export function clampMarketplaceFiltersToLenderConstraints(
	requested: MarketplaceFilters | undefined,
	constraints: LenderFilterConstraintDoc | null
): MarketplaceFilters | undefined {
	if (!constraints) {
		return requested;
	}

	return {
		searchQuery: requested?.searchQuery?.trim() || undefined,
		mortgageTypes: clampEnumValues(
			requested?.mortgageTypes,
			constraints.allowedMortgageTypes
		),
		propertyTypes: clampEnumValues(
			requested?.propertyTypes,
			constraints.allowedPropertyTypes
		),
		ltv: clampNumericRange(requested?.ltv, constraints.ltvRange),
		interestRate: clampNumericRange(
			requested?.interestRate,
			constraints.interestRateRange
		),
		principalAmount: clampNumericRange(
			requested?.principalAmount,
			constraints.loanAmountRange
		),
		maturityDate: clampDateUpperBound(
			requested?.maturityDate,
			constraints.maturityDateMax
		),
	};
}

export async function loadLenderFilterConstraint(
	ctx: { db: Pick<DatabaseReader, "query"> },
	args: {
		brokerId: LenderFilterConstraintDoc["brokerId"] | undefined;
		lenderId: LenderFilterConstraintDoc["lenderId"];
	}
): Promise<LenderFilterConstraintDoc | null> {
	if (!args.brokerId) {
		return null;
	}

	const matches = (
		await ctx.db
			.query("lenderFilterConstraints")
			.withIndex("by_lender", (query) => query.eq("lenderId", args.lenderId))
			.collect()
	).filter((constraint) => constraint.brokerId === args.brokerId);

	if (matches.length > 1) {
		throw new ConvexError(
			"Ambiguous lender filter constraints for the current portal"
		);
	}

	return matches[0] ?? null;
}

export async function resolveViewerLenderConstraintForPortal(
	ctx: {
		db: DatabaseReader;
	},
	args: {
		portalId: Id<"portals">;
		viewerAuthId: string;
		viewerIsFairLendAdmin: boolean;
	}
): Promise<LenderFilterConstraintDoc | null> {
	const portal = await ctx.db.get(args.portalId);
	if (!portal) {
		throw new ConvexError("Portal no longer exists for listing visibility");
	}

	if (!portal.brokerId) {
		return null;
	}

	const lender = await getLenderByAuthId(ctx, args.viewerAuthId);
	if (!lender) {
		return null;
	}

	if (lender.brokerId !== portal.brokerId) {
		throw new ConvexError("Forbidden: lender does not belong to this portal");
	}

	const viewerUser = await getUserByAuthId(ctx, args.viewerAuthId);
	const isSamePortal =
		viewerUser?.homePortalId !== undefined &&
		viewerUser.homePortalId === args.portalId;

	if (!(isSamePortal || args.viewerIsFairLendAdmin)) {
		throw new ConvexError("Forbidden: wrong portal");
	}

	return await loadLenderFilterConstraint(ctx, {
		brokerId: portal.brokerId,
		lenderId: lender._id,
	});
}
