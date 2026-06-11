import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MarketplaceListingsPage } from "#/components/listings/MarketplaceListingsPage";
import type {
	MarketplaceListingsSearchState,
	MarketplaceListingsSnapshot,
} from "#/components/listings/marketplace-types";

export const Route = createFileRoute("/e2e/marketplace-listings-mobile")({
	ssr: false,
	component: MarketplaceListingsMobileE2eRoute,
});

const e2eSnapshot = {
	continueCursor: null,
	effectiveFilters: {
		interestRate: undefined,
		ltv: undefined,
		maturityDate: undefined,
		mortgageTypes: undefined,
		principalAmount: undefined,
		propertyTypes: undefined,
		searchQuery: undefined,
	},
	isDone: true,
	page: [
		{
			approximateLatitude: 43.6532,
			approximateLongitude: -79.3832,
			availability: {
				availableFractions: 4_200_000_000,
				availablePercent: 42,
				lockedFractions: 1_800_000_000,
				lockedPercent: 18,
				soldFractions: 4_000_000_000,
				soldPercent: 40,
				totalFractions: 10_000_000_000,
				totalInvestors: 7,
			},
			displayOrder: 1,
			featured: true,
			heroImageUrl:
				"https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&q=80",
			id: "e2e-king-west",
			interestRate: 9.6,
			locationLabel: "Toronto, ON",
			ltvRatio: 0.64,
			marketplaceCopy:
				"Urban first-position bridge mortgage with balanced availability.",
			maturityDate: "2027-04-30",
			mortgageId: "e2e-mortgage-king-west",
			mortgageTypeLabel: "First",
			principal: 24_000_000,
			propertyTypeLabel: "Detached Home",
			termMonths: 18,
			title: "King West bridge opportunity",
		},
		{
			approximateLatitude: 43.2555,
			approximateLongitude: -79.8711,
			availability: {
				availableFractions: 7_500_000_000,
				availablePercent: 75,
				lockedFractions: 500_000_000,
				lockedPercent: 5,
				soldFractions: 2_000_000_000,
				soldPercent: 20,
				totalFractions: 10_000_000_000,
				totalInvestors: 3,
			},
			displayOrder: 2,
			featured: false,
			heroImageUrl:
				"https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=80",
			id: "e2e-oakwood",
			interestRate: 10.2,
			locationLabel: "Hamilton, ON",
			ltvRatio: 0.71,
			marketplaceCopy:
				"Higher-yield renewal bridge fixture for mobile filter and card checks.",
			maturityDate: "2026-09-15",
			mortgageId: "e2e-mortgage-oakwood",
			mortgageTypeLabel: "Second",
			principal: 31_000_000,
			propertyTypeLabel: "Townhouse",
			termMonths: 12,
			title: "Oakwood renewal bridge",
		},
		{
			approximateLatitude: 43.3255,
			approximateLongitude: -79.799,
			availability: {
				availableFractions: 2_300_000_000,
				availablePercent: 23,
				lockedFractions: 1_200_000_000,
				lockedPercent: 12,
				soldFractions: 6_500_000_000,
				soldPercent: 65,
				totalFractions: 10_000_000_000,
				totalInvestors: 11,
			},
			displayOrder: 3,
			featured: false,
			heroImageUrl:
				"https://images.unsplash.com/photo-1592595896616-c37162298647?w=600&q=80",
			id: "e2e-maple",
			interestRate: 8.9,
			locationLabel: "Burlington, ON",
			ltvRatio: 0.58,
			marketplaceCopy:
				"Lower-LTV allocation fixture used for mobile range filtering checks.",
			maturityDate: "2028-01-31",
			mortgageId: "e2e-mortgage-maple",
			mortgageTypeLabel: "Other",
			principal: 48_500_000,
			propertyTypeLabel: "Condo",
			termMonths: 24,
			title: "Maple Crescent MIC allocation",
		},
	],
} satisfies MarketplaceListingsSnapshot;

function MarketplaceListingsMobileE2eRoute() {
	const [search, setSearch] = useState<MarketplaceListingsSearchState>({});

	if (!import.meta.env.VITE_E2E) {
		return (
			<main className="px-6 py-12">
				<p>Marketplace listings mobile e2e route is disabled.</p>
			</main>
		);
	}

	return (
		<div className="h-dvh max-h-dvh min-h-0 overflow-hidden">
			<MarketplaceListingsPage
				description="E2E mobile fixture for visual verification of marketplace listings."
				search={search}
				setSearch={(updater) => setSearch((current) => updater(current))}
				snapshot={e2eSnapshot}
			/>
		</div>
	);
}
