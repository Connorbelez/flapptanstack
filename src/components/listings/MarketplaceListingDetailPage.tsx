import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ListingDetailPage } from "./ListingDetailPage";
import { buildMarketplaceListingDetailModel } from "./marketplace-detail-adapter";
import type { MarketplaceListingDetailSnapshot } from "./marketplace-types";

interface MarketplaceListingDetailPageProps {
	portalId: Id<"portals">;
	snapshot: NonNullable<MarketplaceListingDetailSnapshot>;
}

export function MarketplaceListingDetailPage({
	portalId,
	snapshot,
}: MarketplaceListingDetailPageProps) {
	const startCheckout = useAction(
		api.checkout.actions.startMarketplaceCheckout
	);
	const listing = buildMarketplaceListingDetailModel(snapshot);

	return (
		<ListingDetailPage
			backHref="/listings"
			buildSimilarListingHref={(listingId) => `/listings/${listingId}`}
			listing={listing}
			mode={listing.checkout ? "interactive" : "readOnly"}
			onStartCheckout={
				listing.checkout
					? async (selection) => {
							return await startCheckout({
								listingId: selection.listingId as Id<"listings">,
								portalId: selection.portalId as Id<"portals">,
								requestedFractions: selection.requestedFractions,
								selectedLawyer: selection.selectedLawyer,
							});
						}
					: undefined
			}
			portalId={portalId}
		/>
	);
}
