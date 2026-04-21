import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { MarketplaceListingsSearchState } from "./marketplace-types";

export function marketplaceListingsQueryOptions(
	portalId: Id<"portals">,
	search: MarketplaceListingsSearchState
) {
	return convexQuery(api.listings.marketplace.listMarketplaceListings, {
		cursor: null,
		filters: {
			interestRate:
				search.rateMin !== undefined || search.rateMax !== undefined
					? { max: search.rateMax, min: search.rateMin }
					: undefined,
			ltv:
				search.ltvMin !== undefined || search.ltvMax !== undefined
					? { max: search.ltvMax, min: search.ltvMin }
					: undefined,
			maturityDate: search.maturityBefore
				? { end: search.maturityBefore }
				: undefined,
			mortgageTypes: search.mortgageTypes,
			principalAmount:
				search.principalMin !== undefined || search.principalMax !== undefined
					? { max: search.principalMax, min: search.principalMin }
					: undefined,
			propertyTypes: search.propertyTypes,
			searchQuery: search.q,
		},
		numItems: 24,
		portalId,
	});
}

export function marketplaceListingDetailQueryOptions(
	portalId: Id<"portals">,
	listingId: string
) {
	return convexQuery(api.listings.marketplace.getMarketplaceListingDetail, {
		listingId: listingId as Id<"listings">,
		portalId,
	});
}

export function listingDocumentAccessQueryOptions(
	listingId: string,
	assetId: string
) {
	return convexQuery(api.listings.publicDocuments.refreshForListingAsset, {
		assetId: assetId as Id<"documentAssets">,
		listingId: listingId as Id<"listings">,
	});
}
