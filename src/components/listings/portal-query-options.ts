import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { MarketplaceListingsSearchState } from "./marketplace-types";

function buildMarketplaceFilters(search: MarketplaceListingsSearchState) {
	return {
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
	};
}

export function publicPortalListingsQueryOptions(
	portalId: string,
	args?: {
		numItems?: number;
		search?: MarketplaceListingsSearchState;
	}
) {
	return convexQuery(api.listings.portalQueries.listPublicPortalListings, {
		cursor: null,
		filters: args?.search ? buildMarketplaceFilters(args.search) : undefined,
		numItems: args?.numItems,
		portalId: portalId as Id<"portals">,
	});
}

export function lenderPortalListingsQueryOptions(
	portalId: string,
	search: MarketplaceListingsSearchState
) {
	return convexQuery(api.listings.portalQueries.listLenderPortalListings, {
		cursor: null,
		filters: buildMarketplaceFilters(search),
		numItems: 24,
		portalId: portalId as Id<"portals">,
	});
}

export function lenderPortalListingDetailQueryOptions(
	portalId: string,
	listingId: string
) {
	return convexQuery(api.listings.portalQueries.getLenderPortalListingDetail, {
		listingId: listingId as Id<"listings">,
		portalId: portalId as Id<"portals">,
	});
}
