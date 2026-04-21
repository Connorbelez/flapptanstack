import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Outlet,
	useMatch,
	useNavigate,
} from "@tanstack/react-router";
import { MarketplaceListingsPage } from "#/components/listings/MarketplaceListingsPage";
import type { MarketplaceListingsSearchState } from "#/components/listings/marketplace-types";
import { lenderPortalListingsQueryOptions } from "#/components/listings/portal-query-options";
import {
	cleanMarketplaceListingsSearch,
	marketplaceFiltersToSearchState,
	parseMarketplaceListingsSearch,
} from "#/components/listings/search";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Route as RootRoute } from "./__root";

export const Route = createFileRoute("/lender/listings")({
	validateSearch: (search: Record<string, unknown>) =>
		parseMarketplaceListingsSearch(search),
	component: LenderListingsRouteComponent,
});

export function LenderListingsRouteComponent() {
	const listingId = useMatch({
		from: "/lender/listings/$listingId",
		select: (match) => match.params.listingId,
		shouldThrow: false,
	});
	const search = Route.useSearch();
	const { portalContext } = RootRoute.useRouteContext();

	if (listingId) {
		return <Outlet />;
	}

	if (portalContext.kind !== "portal") {
		return (
			<div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
				<Card>
					<CardHeader>
						<CardTitle>Portal host required</CardTitle>
					</CardHeader>
					<CardContent className="text-muted-foreground text-sm">
						The lender listings workspace is only available on an active portal
						host.
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<PortalListingsContent
			portalId={String(portalContext.portal.portalId)}
			portalSlug={portalContext.portal.slug}
			search={search}
		/>
	);
}

function PortalListingsContent({
	portalId,
	portalSlug,
	search,
}: {
	portalId: string;
	portalSlug: string;
	search: MarketplaceListingsSearchState;
}) {
	const navigate = useNavigate();
	const listingsQuery = useQuery(
		lenderPortalListingsQueryOptions(portalId, search)
	);

	if (listingsQuery.isPending) {
		return (
			<div className="flex min-h-[50vh] items-center justify-center">
				<p className="text-muted-foreground text-sm">
					Loading portal listings...
				</p>
			</div>
		);
	}

	if (listingsQuery.error || !listingsQuery.data) {
		return (
			<div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
				<Card>
					<CardHeader>
						<CardTitle>Unable to load portal listings</CardTitle>
					</CardHeader>
					<CardContent className="text-muted-foreground text-sm">
						The portal lender listings surface could not be loaded for this
						host.
					</CardContent>
				</Card>
			</div>
		);
	}

	const effectiveSearch = marketplaceFiltersToSearchState(
		listingsQuery.data.effectiveFilters,
		search.sort
	);

	return (
		<MarketplaceListingsPage
			description="Projected values and visible opportunities are constrained to this portal and your lender profile."
			detailRoute="/lender/listings/$listingId"
			eyebrow={`${portalSlug} portal`}
			heading="Browse broker portal opportunities"
			search={effectiveSearch}
			setSearch={(updater) =>
				void navigate({
					search: (current) =>
						cleanMarketplaceListingsSearch(
							updater(current as MarketplaceListingsSearchState)
						),
					to: "/lender/listings",
				})
			}
			snapshot={listingsQuery.data}
		/>
	);
}
