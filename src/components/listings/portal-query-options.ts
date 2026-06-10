import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { principalDollarsToCents } from "./marketplace-adapters";
import type { MarketplaceListingsSearchState } from "./marketplace-types";

function buildMarketplaceFilters(search: MarketplaceListingsSearchState) {
	return {
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
