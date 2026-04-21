import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MarketplaceListingsPage } from "#/components/listings/MarketplaceListingsPage";
import type { MarketplaceListingsSearchState } from "#/components/listings/marketplace-types";
import { marketplaceListingsQueryOptions } from "#/components/listings/query-options";
import {
	cleanMarketplaceListingsSearch,
	parseMarketplaceListingsSearch,
} from "#/components/listings/search";

export const Route = createFileRoute("/listings/")({
	component: ListingsIndexRoutePage,
	loaderDeps: ({ search }) => ({ search }),
	loader: async ({ context, deps: { search } }) => {
		await context.queryClient.ensureQueryData(
			marketplaceListingsQueryOptions(search)
		);
	},
	validateSearch: (search: Record<string, unknown>) =>
		parseMarketplaceListingsSearch(search),
});

export function ListingsIndexRoutePage() {
	const search = Route.useSearch();
	const navigate = useNavigate();
	const { data } = useSuspenseQuery(marketplaceListingsQueryOptions(search));

	return (
		<MarketplaceListingsPage
			search={search}
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
