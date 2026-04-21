import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { portalLenderQuery, portalPublicQuery } from "../fluent";
import {
	loadPortalPricingSelection,
	requirePortalPricingSelection,
} from "../portals/pricing";
import {
	listMarketplaceListingsSnapshot,
	type MarketplaceFilters,
	marketplaceFiltersValidator,
	matchesMarketplaceFilters,
} from "./marketplace";
import { readListingPublicDocuments } from "./publicDocuments";
import {
	getListingByIdOrNull,
	getListingWithAvailabilitySnapshot,
} from "./queries";

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
	if (!allowed?.length) {
		return requested ? [...requested] : undefined;
	}

	if (!requested?.length) {
		return [...allowed] as T[];
	}

	const allowedSet = new Set(allowed);
	return requested.filter((value) => allowedSet.has(value));
}

function clampFiltersToLenderConstraints(
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

async function loadLenderFilterConstraint(
	ctx: Pick<QueryCtx, "db">,
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

async function loadRequiredPortalPricingPolicy(
	ctx: Pick<QueryCtx, "db"> & {
		portal: { portalId: Id<"portals">; slug: string };
	}
) {
	const selection = await loadPortalPricingSelection(ctx, {
		atTime: Date.now(),
		portalId: ctx.portal.portalId,
	});
	return requirePortalPricingSelection(selection, ctx.portal.slug).policy;
}

async function getVisibleLenderPortalListingDetail(
	ctx: Pick<QueryCtx, "db" | "storage"> & {
		lender: { _id: Id<"lenders"> };
		portal: {
			brokerId?: Id<"brokers"> | undefined;
			portalId: Id<"portals">;
			slug: string;
		};
	},
	listingId: Id<"listings">
) {
	const listing = await getListingByIdOrNull(ctx, listingId);
	if (!(listing && listing.status === "published")) {
		return null;
	}

	const constraint = await loadLenderFilterConstraint(ctx, {
		brokerId: ctx.portal.brokerId,
		lenderId: ctx.lender._id,
	});
	const visibilityFilters = clampFiltersToLenderConstraints(
		undefined,
		constraint
	);
	if (!matchesMarketplaceFilters(listing, visibilityFilters)) {
		return null;
	}

	const snapshot = await getListingWithAvailabilitySnapshot(ctx, {
		listingId,
		portalId: ctx.portal.portalId,
	});
	if (!snapshot) {
		return null;
	}

	return {
		...snapshot,
		documents: await readListingPublicDocuments(ctx, listingId),
	};
}

export const listPublicPortalListings = portalPublicQuery({
	cursor: v.optional(v.union(v.string(), v.null())),
	filters: v.optional(marketplaceFiltersValidator),
	numItems: v.optional(v.number()),
})
	.handler(async (ctx, args) => {
		if (!ctx.portal.publicTeaserEnabled) {
			return {
				continueCursor: null,
				isDone: true,
				page: [],
				teaserEnabled: false,
				teaserListingLimit: ctx.portal.teaserListingLimit,
			};
		}

		const pricingPolicy = await loadRequiredPortalPricingPolicy(ctx);
		const snapshot = await listMarketplaceListingsSnapshot(
			ctx,
			{
				cursor: args.cursor,
				filters: args.filters,
				numItems: args.numItems,
			},
			{
				pageSizeCap: ctx.portal.teaserListingLimit,
				pricingPolicy,
			}
		);

		return {
			...snapshot,
			teaserEnabled: true,
			teaserListingLimit: ctx.portal.teaserListingLimit,
		};
	})
	.public();

export const listLenderPortalListings = portalLenderQuery({
	cursor: v.optional(v.union(v.string(), v.null())),
	filters: v.optional(marketplaceFiltersValidator),
	numItems: v.optional(v.number()),
})
	.handler(async (ctx, args) => {
		const pricingPolicy = await loadRequiredPortalPricingPolicy(ctx);
		const constraint = await loadLenderFilterConstraint(ctx, {
			brokerId: ctx.portal.brokerId,
			lenderId: ctx.lender._id,
		});
		const effectiveFilters = clampFiltersToLenderConstraints(
			args.filters,
			constraint
		);
		const snapshot = await listMarketplaceListingsSnapshot(
			ctx,
			{
				cursor: args.cursor,
				filters: effectiveFilters,
				numItems: args.numItems,
			},
			{ pricingPolicy }
		);

		return {
			...snapshot,
			effectiveFilters,
		};
	})
	.public();

export const getLenderPortalListingDetail = portalLenderQuery({
	listingId: v.id("listings"),
})
	.handler(
		async (ctx, args) =>
			await getVisibleLenderPortalListingDetail(ctx, args.listingId)
	)
	.public();
