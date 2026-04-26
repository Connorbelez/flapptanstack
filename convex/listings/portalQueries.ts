import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { portalLenderQuery, portalPublicQuery } from "../fluent";
import {
	loadPortalPricingSelection,
	requirePortalPricingSelection,
} from "../portals/pricing";
import {
	listMarketplaceListingsSnapshot,
	marketplaceFiltersValidator,
	matchesMarketplaceFilters,
} from "./marketplace";
import {
	clampMarketplaceFiltersToLenderConstraints,
	loadLenderFilterConstraint,
} from "./portalVisibility";
import { readListingPublicDocuments } from "./publicDocuments";
import {
	getListingByIdOrNull,
	getListingWithAvailabilitySnapshot,
} from "./queries";

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
	const visibilityFilters = clampMarketplaceFiltersToLenderConstraints(
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
	if (!snapshot?.availability) {
		return null;
	}

	return {
		...snapshot,
		documents: await readListingPublicDocuments(ctx, { listingId }),
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
		const effectiveFilters = clampMarketplaceFiltersToLenderConstraints(
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
