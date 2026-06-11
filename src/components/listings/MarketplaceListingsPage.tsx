import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	MarketplaceFilterBar,
	type MarketplaceFilterChangeMode,
} from "./filter-bar";
import { ListingGridShell } from "./ListingGridShell";
import { Horizontal } from "./listing-card-horizontal";
import { ListingMapPopup } from "./listing-map-popup";
import {
	applyMarketplaceListingFilters,
	buildFilterMetricItems,
	buildMarketplaceListingCardItems,
	filterStateToSearchState,
	searchStateToFilterState,
} from "./marketplace-adapters";
import type {
	MarketplaceListingCardItem,
	MarketplaceListingsSearchState,
	MarketplaceListingsSnapshot,
} from "./marketplace-types";
import type { MobileListingSection } from "./mobile-listing-scroller";

const FILTER_SYNC_DEBOUNCE_MS = 350;

function groupItemsForMobile(items: readonly MarketplaceListingCardItem[]) {
	const firstMortgages = items.filter((item) => item.mortgageType === "First");
	const secondMortgages = items.filter(
		(item) => item.mortgageType === "Second"
	);
	const otherMortgages = items.filter(
		(item) => item.mortgageType !== "First" && item.mortgageType !== "Second"
	);

	const sections: MobileListingSection<MarketplaceListingCardItem>[] = [];

	if (firstMortgages.length > 0) {
		sections.push({ items: firstMortgages, title: "1st Mortgages" });
	}
	if (secondMortgages.length > 0) {
		sections.push({ items: secondMortgages, title: "2nd Mortgages" });
	}
	if (otherMortgages.length > 0) {
		sections.push({ items: otherMortgages, title: "Other Opportunities" });
	}

	return sections;
}

interface MarketplaceListingsPageProps {
	description?: string;
	detailRoute?: "/listings/$listingId";
	eyebrow?: string;
	heading?: string;
	search: MarketplaceListingsSearchState;
	setSearch: (
		updater: (
			current: MarketplaceListingsSearchState
		) => MarketplaceListingsSearchState
	) => void;
	snapshot: MarketplaceListingsSnapshot;
}

export function MarketplaceListingsPage({
	snapshot,
	search,
	setSearch,
	description = "",
	detailRoute = "/listings/$listingId",
	eyebrow = "Lender Marketplace",
	heading = "Browse fractional mortgage opportunities",
}: MarketplaceListingsPageProps) {
	const committedFilterState = useMemo(
		() => searchStateToFilterState(search),
		[search]
	);
	const [draftFilters, setDraftFilters] = useState(committedFilterState);
	const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		setDraftFilters(committedFilterState);
	}, [committedFilterState]);

	useEffect(
		() => () => {
			if (syncTimerRef.current) {
				clearTimeout(syncTimerRef.current);
			}
		},
		[]
	);

	const filterMetrics = buildFilterMetricItems(snapshot.page);
	const allItems = useMemo(
		() => buildMarketplaceListingCardItems(snapshot.page),
		[snapshot.page]
	);
	const items = useMemo(
		() => applyMarketplaceListingFilters(allItems, draftFilters),
		[allItems, draftFilters]
	);

	const commitFilters = useCallback(
		(nextFilters: typeof draftFilters) => {
			setSearch(() => filterStateToSearchState(nextFilters, search.sort));
		},
		[search.sort, setSearch]
	);

	const handleFiltersChange = useCallback(
		(
			nextFilters: typeof draftFilters,
			options?: { mode?: MarketplaceFilterChangeMode }
		) => {
			setDraftFilters(nextFilters);

			if (syncTimerRef.current) {
				clearTimeout(syncTimerRef.current);
				syncTimerRef.current = null;
			}

			if (options?.mode === "debounced") {
				syncTimerRef.current = setTimeout(() => {
					commitFilters(nextFilters);
					syncTimerRef.current = null;
				}, FILTER_SYNC_DEBOUNCE_MS);
				return;
			}

			commitFilters(nextFilters);
		},
		[commitFilters]
	);

	const toolbar = (
		<div className="space-y-3">
			<div className="hidden flex-wrap items-center gap-2 md:flex">
				<Badge className="rounded-full px-3 py-1" variant="secondary">
					{snapshot.page.length} opportunities
				</Badge>
			</div>
			<MarketplaceFilterBar
				filters={draftFilters}
				items={filterMetrics}
				onFiltersChange={handleFiltersChange}
			/>
		</div>
	);

	if (snapshot.page.length === 0) {
		return (
			<section className="mx-auto flex min-h-[50vh] max-w-4xl flex-col items-center justify-center gap-6 px-6 py-16">
				<div className="w-full">{toolbar}</div>
				<div className="space-y-3 text-center">
					<p className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.24em]">
						Marketplace
					</p>
					<h1 className="font-semibold text-3xl tracking-tight">
						No listings match these filters
					</h1>
					<p className="max-w-xl text-center text-muted-foreground text-sm leading-6">
						Clear the current filters or widen the search ranges to reveal more
						published mortgage opportunities.
					</p>
				</div>
				<Button
					className="rounded-full"
					onClick={() =>
						setSearch((current) => ({ sort: current.sort ?? "featured" }))
					}
					type="button"
					variant="outline"
				>
					Clear filters
				</Button>
			</section>
		);
	}

	return (
		<div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden bg-[#F4F5F7] md:bg-transparent">
			<div className="shrink-0 space-y-3 px-4 pt-3 sm:px-8 md:pt-0">
				<div className="md:hidden">
					<p className="font-semibold text-[11px] text-muted-foreground uppercase">
						FairLend MIC
					</p>
					<div className="mt-0.5 flex items-end justify-between gap-3">
						<h1 className="font-semibold text-[28px] leading-none tracking-normal">
							Listings
						</h1>
						<Badge className="rounded-full px-3 py-1" variant="secondary">
							{snapshot.page.length} live
						</Badge>
					</div>
				</div>
				<p className="hidden font-medium text-[11px] text-muted-foreground uppercase tracking-[0.24em] md:block">
					{eyebrow}
				</p>
				<div className="hidden flex-col gap-2 md:flex xl:flex-row xl:items-end xl:justify-between">
					<div className="space-y-2">
						<h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">
							{heading}
						</h1>
						<p className="max-w-3xl text-muted-foreground text-sm leading-6 sm:text-base">
							{description}
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Badge className="rounded-full px-3 py-1" variant="secondary">
							{snapshot.page.length} live listings
						</Badge>
						{snapshot.isDone ? null : (
							<Badge className="rounded-full px-3 py-1" variant="outline">
								More results available
							</Badge>
						)}
					</div>
				</div>
			</div>

			<ListingGridShell
				groupItemsForMobile={groupItemsForMobile}
				items={items}
				mapProps={{
					initialCenter: { lat: 43.6532, lng: -79.3832 },
					initialZoom: 10,
				}}
				mobilePresentation="nativeList"
				renderCard={(listing) => (
					<Link
						className="block w-full min-w-0 max-w-full"
						params={{ listingId: listing.id }}
						search={{ checkout: undefined }}
						to={detailRoute}
					>
						<div className="md:hidden">
							<Horizontal
								address={listing.address}
								apr={listing.apr}
								availablePercent={listing.availablePercent}
								fractionsSummary={listing.fractionsSummary}
								imageSrc={listing.imageSrc}
								lockedPercent={listing.lockedPercent}
								ltv={listing.ltv}
								maturityDate={listing.maturityDate.toLocaleDateString("en-CA")}
								principal={listing.principal}
								propertyType={listing.propertyType}
								soldPercent={listing.soldPercent}
								title={listing.title}
								variant="nativeMobile"
							/>
						</div>
						<div className="hidden md:block">
							<Horizontal
								address={listing.address}
								apr={listing.apr}
								availablePercent={listing.availablePercent}
								fractionsSummary={listing.fractionsSummary}
								imageSrc={listing.imageSrc}
								lockedPercent={listing.lockedPercent}
								ltv={listing.ltv}
								maturityDate={listing.maturityDate.toLocaleDateString("en-CA")}
								principal={listing.principal}
								propertyType={listing.propertyType}
								soldPercent={listing.soldPercent}
								title={listing.title}
							/>
						</div>
					</Link>
				)}
				renderMapPopup={(listing) => (
					<ListingMapPopup
						address={listing.address}
						apr={listing.apr}
						imageSrc={listing.imageSrc}
						principal={listing.principal}
						title={listing.title}
					/>
				)}
				toolbar={toolbar}
			/>
		</div>
	);
}
