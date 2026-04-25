import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft } from "lucide-react";
import type { ListingCheckoutReturnState } from "#/components/listings/listing-detail-types";
import { MarketplaceListingDetailPage } from "#/components/listings/MarketplaceListingDetailPage";
import { marketplaceListingDetailQueryOptions } from "#/components/listings/query-options";
import { guardRouteAccess } from "#/lib/auth";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import { Route as RootRoute } from "../__root";

const CHECKOUT_RETURN_STATES = new Set([
	"abandoned",
	"error",
	"expired",
	"provider_start_failed",
	"success_pending",
]);

export function parseListingCheckoutReturnState(
	search: Record<string, unknown>
): ListingCheckoutReturnState | undefined {
	return typeof search.checkout === "string" &&
		CHECKOUT_RETURN_STATES.has(search.checkout)
		? (search.checkout as ListingCheckoutReturnState)
		: undefined;
}

export const Route = createFileRoute("/listings/$listingId")({
	beforeLoad: guardRouteAccess("listings"),
	loader: async ({ context, params }) => {
		const portalId = assertActivePortalId(
			context.portalContext,
			"Marketplace listings require an active portal host."
		);
		const detail = await context.queryClient.ensureQueryData(
			marketplaceListingDetailQueryOptions(portalId, params.listingId)
		);
		if (!detail) {
			throw notFound();
		}

		return { listingId: params.listingId };
	},
	component: RouteComponent,
	notFoundComponent: MarketplaceListingNotFoundComponent,
	validateSearch: (search: Record<string, unknown>) => ({
		checkout: parseListingCheckoutReturnState(search),
	}),
});

function RouteComponent() {
	const { listingId } = Route.useLoaderData();
	const { portalContext } = RootRoute.useRouteContext();
	const portalId = assertActivePortalId(
		portalContext,
		"Marketplace listings require an active portal host."
	);
	const { data } = useSuspenseQuery(
		marketplaceListingDetailQueryOptions(portalId, listingId)
	);
	const search = Route.useSearch();

	if (!data) {
		throw notFound();
	}

	return (
		<MarketplaceListingDetailPage
			checkoutReturnState={
				search.checkout as ListingCheckoutReturnState | undefined
			}
			portalId={portalId}
			snapshot={data}
		/>
	);
}

function MarketplaceListingNotFoundComponent() {
	const { listingId } = Route.useParams();

	return (
		<div className="min-h-full px-4 py-16 text-foreground sm:px-6">
			<div className="mx-auto max-w-2xl rounded-3xl border border-[#E7E5E4] bg-white px-8 py-10 shadow-sm">
				<div className="flex items-center gap-3">
					<div className="flex size-10 items-center justify-center rounded-full bg-[#F8EAEA] text-[#B42318]">
						<AlertCircle className="size-5" />
					</div>
					<div>
						<h1 className="font-semibold text-2xl tracking-tight">
							Unable to load listing
						</h1>
						<p className="mt-1 text-[#6B6B68] text-sm">
							We could not find a published listing for <code>{listingId}</code>
							.
						</p>
					</div>
				</div>

				<Link
					className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] px-4 py-2 font-medium text-sm hover:bg-[#FBFAF8]"
					to="/listings"
					viewTransition
				>
					<ArrowLeft className="size-4" />
					Back to Listings
				</Link>
			</div>
		</div>
	);
}
