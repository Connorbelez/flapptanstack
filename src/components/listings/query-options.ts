import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { principalDollarsToCents } from "./marketplace-adapters";
import type { MarketplaceListingsSearchState } from "./marketplace-types";

export function marketplaceListingsQueryOptions(
	portalId: Id<"portals">,
	search: MarketplaceListingsSearchState
) {
	return convexQuery(api.listings.marketplace.listMarketplaceListings, {
		cursor: null,
		filters: {
			availabilityPercent:
				search.availableMin !== undefined || search.availableMax !== undefined
					? { max: search.availableMax, min: search.availableMin }
					: undefined,
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
			minimumInvestmentAmount:
				search.minimumInvestmentMin !== undefined ||
				search.minimumInvestmentMax !== undefined
					? {
							max:
								search.minimumInvestmentMax !== undefined
									? principalDollarsToCents(search.minimumInvestmentMax)
									: undefined,
							min:
								search.minimumInvestmentMin !== undefined
									? principalDollarsToCents(search.minimumInvestmentMin)
									: undefined,
						}
					: undefined,
			principalAmount:
				search.principalMin !== undefined || search.principalMax !== undefined
					? {
							max:
								search.principalMax !== undefined
									? principalDollarsToCents(search.principalMax)
									: undefined,
							min:
								search.principalMin !== undefined
									? principalDollarsToCents(search.principalMin)
									: undefined,
						}
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
