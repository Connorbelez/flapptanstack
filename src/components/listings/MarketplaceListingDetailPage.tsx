import { ListingDetailPage } from "./ListingDetailPage";
import { buildMarketplaceListingDetailModel } from "./marketplace-detail-adapter";
import type { MarketplaceListingDetailSnapshot } from "./marketplace-types";

interface MarketplaceListingDetailPageProps {
	snapshot: NonNullable<MarketplaceListingDetailSnapshot>;
}

export function MarketplaceListingDetailPage({
	snapshot,
}: MarketplaceListingDetailPageProps) {
	const listing = buildMarketplaceListingDetailModel(snapshot);

	return (
		<ListingDetailPage
			listing={listing}
			listingsIndexTo="/listings"
			mode="readOnly"
		/>
	);
}
