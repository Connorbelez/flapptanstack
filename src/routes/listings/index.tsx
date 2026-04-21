import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MarketplaceListingsPage } from "#/components/listings/MarketplaceListingsPage";
import type { MarketplaceListingsSearchState } from "#/components/listings/marketplace-types";
import { marketplaceListingsQueryOptions } from "#/components/listings/query-options";
import {
	cleanMarketplaceListingsSearch,
	parseMarketplaceListingsSearch,
} from "#/components/listings/search";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import { Route as RootRoute } from "../__root";

export const Route = createFileRoute("/listings/")({
	component: ListingsIndexRoutePage,
	loaderDeps: ({ search }) => ({ search }),
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
	const { portalContext } = RootRoute.useRouteContext();
	const portalId = assertActivePortalId(
		portalContext,
		"Marketplace listings require an active portal host."
	);
	const { data } = useSuspenseQuery(
		marketplaceListingsQueryOptions(portalId, search)
	);

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
