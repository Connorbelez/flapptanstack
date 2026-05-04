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
	const startCheckout = useAction(api.dealLocks.actions.startCheckout);
	const listing = buildMarketplaceListingDetailModel(snapshot);

	return (
		<ListingDetailPage
			listing={listing}
			listingsIndexTo="/listings"
			mode={listing.checkout ? "interactive" : "readOnly"}
			onStartCheckout={
				listing.checkout
					? async (selection) => {
							const result = await startCheckout({
								fractionalShareUnits: selection.fractionalShareUnits,
								listingId: snapshot.listing.id as Id<"listings">,
								portalId,
								selectedLawyerAuthId: selection.selectedLawyerAuthId,
								selectedLawyerType: selection.selectedLawyerType,
							});
							window.location.assign(result.url);
						}
					: undefined
			}
		/>
	);
}
