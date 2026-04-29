import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ListingDetailPage } from "./ListingDetailPage";
import type {
	ListingCheckoutReturnState,
	ListingCheckoutStartInput,
	ListingCheckoutStartResult,
} from "./listing-detail-types";
import { buildMarketplaceListingDetailModel } from "./marketplace-detail-adapter";
import type { MarketplaceListingDetailSnapshot } from "./marketplace-types";

interface MarketplaceListingDetailPageProps {
	checkoutReturnState?: ListingCheckoutReturnState;
	portalId: Id<"portals">;
	snapshot: NonNullable<MarketplaceListingDetailSnapshot>;
}

export function MarketplaceListingDetailPage({
	checkoutReturnState,
	portalId,
	snapshot,
}: MarketplaceListingDetailPageProps) {
	const startMarketplaceCheckout = useAction(
		api.checkout.actions.startMarketplaceCheckout
	);
	const listing = buildMarketplaceListingDetailModel(snapshot);

	async function handleStartCheckout(
		input: ListingCheckoutStartInput
	): Promise<ListingCheckoutStartResult> {
		return await startMarketplaceCheckout({
			listingId: input.listingId as Id<"listings">,
			portalId,
			requestedFractions: input.requestedFractions,
			selectedLawyer: input.selectedLawyer,
		});
	}

	return (
		<ListingDetailPage
			backHref="/listings"
			buildSimilarListingHref={(listingId) => `/listings/${listingId}`}
			checkoutReturnState={checkoutReturnState}
			listing={listing}
			mode={listing.checkout?.isEligible ? "interactive" : "readOnly"}
			onStartCheckout={handleStartCheckout}
			portalId={portalId}
		/>
	);
}
