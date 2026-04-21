import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { MarketplaceListingsPage } from "#/components/listings/MarketplaceListingsPage";
import type { MarketplaceListingsSearchState } from "#/components/listings/marketplace-types";
import { marketplaceListingsQueryOptions } from "#/components/listings/query-options";
import {
	cleanMarketplaceListingsSearch,
	parseMarketplaceListingsSearch,
} from "#/components/listings/search";
import { canAccessAdminPath } from "#/lib/auth";
import { buildSignInRedirect } from "#/lib/auth-redirect";
export const Route = createFileRoute("/listings")({
	beforeLoad: ({ context, location }) => {
		if (!context.userId) {
			throw redirect(buildSignInRedirect(location.href));
		}
		//TODO:  guardRouteAccess causes a race condition, canAccessAdminPath was tested and is functioning correctly. We need to re-write guardRouteAccess, and base it on canAccessAdminPath.
		if (!canAccessAdminPath(location.pathname, context)) {
			throw redirect({ to: "/unauthorized" });
		}
	},
	component: ListingsRoutePage,
	loaderDeps: ({ search }) => ({ search }),
	loader: async ({ context, deps: { search } }) => {
		await context.queryClient.ensureQueryData(
			marketplaceListingsQueryOptions(search)
		);
	},
	validateSearch: (search: Record<string, unknown>) =>
		parseMarketplaceListingsSearch(search),
});

function ListingsRoutePage() {
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
