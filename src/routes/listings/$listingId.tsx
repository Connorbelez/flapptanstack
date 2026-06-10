import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft } from "lucide-react";
import type { ListingCheckoutReturnState } from "#/components/listings/listing-detail-types";
import { MarketplaceListingDetailPage } from "#/components/listings/MarketplaceListingDetailPage";
import { marketplaceListingDetailQueryOptions } from "#/components/listings/query-options";
import { guardRouteAccess } from "#/lib/auth";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import { Route as RootRoute } from "../__root";

const LISTING_CHECKOUT_RETURN_STATES = new Set<ListingCheckoutReturnState>([
	"abandoned",
	"error",
	"expired",
	"provider_start_failed",
	"success_pending",
]);

export function parseListingCheckoutReturnState(
	search: Record<string, unknown>
): ListingCheckoutReturnState | undefined {
	const checkout = search.checkout;
	if (typeof checkout !== "string") {
		return undefined;
	}
	return LISTING_CHECKOUT_RETURN_STATES.has(
		checkout as ListingCheckoutReturnState
	)
		? (checkout as ListingCheckoutReturnState)
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
});

function RouteComponent() {
	const { listingId } = Route.useLoaderData();
	const checkoutReturnState = parseListingCheckoutReturnState(
		Route.useSearch() as Record<string, unknown>
	);
	const { portalContext } = RootRoute.useRouteContext();
	const portalId = assertActivePortalId(
		portalContext,
		"Marketplace listings require an active portal host."
	);
	const { data } = useSuspenseQuery(
		marketplaceListingDetailQueryOptions(portalId, listingId)
	);

	if (!data) {
		throw notFound();
	}

	return (
		<MarketplaceListingDetailPage
			checkoutReturnState={checkoutReturnState}
			portalId={portalId}
			snapshot={data}
		/>
	);
}

function MarketplaceListingNotFoundComponent() {
	const { listingId } = Route.useParams();

	return (
		<div className="min-h-full px-4 py-16 text-foreground sm:px-6">
			<div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card px-8 py-10 text-card-foreground shadow-sm">
				<div className="flex items-center gap-3">
					<div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
						<AlertCircle className="size-5" />
					</div>
					<div>
						<h1 className="font-semibold text-2xl tracking-tight">
							Listing unavailable
						</h1>
						<p className="mt-1 text-muted-foreground text-sm">
							No published listing matches <code>{listingId}</code>.
						</p>
					</div>
				</div>

				<Link
					className="mt-8 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 font-medium text-sm hover:bg-muted/50"
					to="/listings"
					viewTransition
				>
					<ArrowLeft className="size-4" />
					Back to listings
				</Link>
			</div>
		</div>
	);
}
