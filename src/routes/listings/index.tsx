import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MarketplaceListingsPage } from "#/components/listings/MarketplaceListingsPage";
import type {
	MarketplaceListingsSearchState,
	MarketplaceListingsSnapshot,
} from "#/components/listings/marketplace-types";
import { marketplaceListingsQueryOptions } from "#/components/listings/query-options";
import {
	cleanMarketplaceListingsSearch,
	marketplaceFiltersToSearchState,
	parseMarketplaceListingsSearch,
} from "#/components/listings/search";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import { Route as RootRoute } from "../__root";

export const Route = createFileRoute("/listings/")({
	component: ListingsIndexRoutePage,
	loaderDeps: ({ search }) => ({
		search: { ...search, q: undefined },
	}),
	loader: async ({ context, deps: { search } }) => {
		const portalId = assertActivePortalId(
			context.portalContext,
			"Marketplace listings require an active portal host."
		);
		await context.queryClient.ensureQueryData(
			marketplaceListingsQueryOptions(portalId, search)
		);
	},
	validateSearch: (search: Record<string, unknown>) =>
		parseMarketplaceListingsSearch(search),
});

export function ListingsIndexRoutePage() {
	const search = Route.useSearch();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { portalContext } = RootRoute.useRouteContext();
	const portalId = assertActivePortalId(
		portalContext,
		"Marketplace listings require an active portal host."
	);
	const unsearchedOptions = marketplaceListingsQueryOptions(portalId, {
		...search,
		q: undefined,
	});
	const queryResult = useQuery({
		...marketplaceListingsQueryOptions(portalId, search),
		placeholderData: (previousData) =>
			previousData ?? queryClient.getQueryData(unsearchedOptions.queryKey),
	});
	const data =
		queryResult.data ??
		queryClient.getQueryData<MarketplaceListingsSnapshot>(
			unsearchedOptions.queryKey
		);

	if (!data) {
		return null;
	}
	const effectiveSearch = marketplaceFiltersToSearchState(
		data.effectiveFilters,
		search.sort
	);

	return (
		<MarketplaceListingsPage
			search={effectiveSearch}
			setSearch={(updater) =>
				void navigate({
					search: (current) =>
						cleanMarketplaceListingsSearch(
							updater(current as MarketplaceListingsSearchState)
						),
					to: "/listings",
				})
			}
			snapshot={data}
		/>
	);
}
