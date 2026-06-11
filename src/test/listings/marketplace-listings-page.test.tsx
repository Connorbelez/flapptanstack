/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Horizontal } from "#/components/listings/listing-card-horizontal";
import { MarketplaceListingsPage } from "#/components/listings/MarketplaceListingsPage";
import {
	filterStateToSearchState,
	searchStateToFilterState,
} from "#/components/listings/marketplace-adapters";
import {
	marketplaceFiltersToSearchState,
	parseMarketplaceListingsSearch,
} from "#/components/listings/search";

vi.mock("#/components/listings/filter-modal", () => ({
	default: () => <div data-testid="filter-modal" />,
}));

vi.mock("#/components/listings/ListingGridShell", () => ({
	ListingGridShell: ({
		items,
		mobilePresentation,
		renderCard,
		toolbar,
	}: {
		items: Array<{ id: string }>;
		mobilePresentation?: string;
		renderCard: (item: { id: string }) => ReactNode;
		toolbar?: ReactNode;
	}) => (
		<div>
			{toolbar}
			<div
				data-mobile-presentation={mobilePresentation}
				data-testid="listing-grid-shell"
			>
				{items.map((item) => (
					<div key={item.id}>{renderCard(item)}</div>
				))}
			</div>
		</div>
	),
}));

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
		"@tanstack/react-router"
	);

	return {
		...actual,
		Link: (props: {
			children: ReactNode;
			className?: string;
			params?: { listingId?: string };
			to: string;
		}) => (
			<a
				className={props.className}
				href={
					props.params?.listingId
						? props.to.replace("$listingId", props.params.listingId)
						: props.to
				}
			>
				{props.children}
			</a>
		),
	};
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("marketplace listings search", () => {
	it("normalizes search params into route state", () => {
		expect(
			parseMarketplaceListingsSearch({
				mortgageTypes: "First,Second",
				propertyTypes: "Detached Home,Condo",
				q: "toronto",
				sort: "featured",
			})
		).toMatchObject({
			mortgageTypes: ["First", "Second"],
			propertyTypes: ["Detached Home", "Condo"],
			q: "toronto",
			sort: "featured",
		});
	});

	it("normalizes availability and minimum investment search params", () => {
		expect(
			parseMarketplaceListingsSearch({
				availableMax: "100",
				availableMin: "50",
				minimumInvestmentMax: "25000",
				minimumInvestmentMin: "0",
			})
		).toMatchObject({
			availableMax: 100,
			availableMin: 50,
			minimumInvestmentMax: 25000,
			minimumInvestmentMin: 0,
		});
	});

	it("maps availability and minimum investment filters to route search state", () => {
		const filters = searchStateToFilterState({
			availableMin: 50,
			minimumInvestmentMax: 25_000,
		});

		expect(filters.availablePercentRange).toEqual([50, 100]);
		expect(filters.minimumInvestmentRange).toEqual([0, 25_000]);
		expect(filterStateToSearchState(filters, "featured")).toMatchObject({
			availableMin: 50,
			minimumInvestmentMax: 25_000,
		});
	});

	it("maps effective minimum investment filters from cents back to URL dollars", () => {
		expect(
			marketplaceFiltersToSearchState(
				{
					minimumInvestmentAmount: {
						max: 2_500_000,
						min: 500_000,
					},
				},
				"featured"
			)
		).toMatchObject({
			minimumInvestmentMax: 25_000,
			minimumInvestmentMin: 5000,
		});
	});
});

describe("marketplace listings page", () => {
	it("renders the empty state when no listings match", () => {
		render(
			<MarketplaceListingsPage
				search={{}}
				setSearch={() => undefined}
				snapshot={{ continueCursor: null, isDone: true, page: [] }}
			/>
		);

		expect(screen.getByText("No listings match these filters")).toBeTruthy();
		expect(screen.getByText("10/10 fractions available")).toBeTruthy();
	});

	it("routes listing cards through the configured detail route", () => {
		render(
			<MarketplaceListingsPage
				detailRoute="/listings/$listingId"
				search={{}}
				setSearch={() => undefined}
				snapshot={{
					continueCursor: null,
					isDone: true,
					page: [
						{
							approximateLatitude: 43.6532,
							approximateLongitude: -79.3832,
							availability: {
								availablePercent: 42,
								lockedPercent: 18,
								soldPercent: 40,
							},
							heroImageUrl: undefined,
							id: "listing_1",
							interestRate: 8.5,
							locationLabel: "Toronto, ON",
							ltvRatio: 0.62,
							maturityDate: "2027-04-30",
							mortgageTypeLabel: "First",
							principal: 250000,
							propertyTypeLabel: "Detached Home",
							title: "King West bridge opportunity",
						},
					],
				}}
			/>
		);

		expect(
			screen.getByRole("link", { name: /king west bridge opportunity/i }).getAttribute(
				"href"
			)
		).toBe("/listings/listing_1");
		expect(screen.getByTestId("listing-grid-shell").dataset.mobilePresentation).toBe(
			"nativeList"
		);
	});

	it("renders the native mobile card variant with marketplace economics", () => {
		render(
			<Horizontal
				address="Toronto, ON"
				apr={9.6}
				availablePercent={42}
				fractionsSummary="4.2 / 10 fractions (10% each)"
				ltv={0.64}
				maturityDate="2027-04-30"
				principal={240_000}
				propertyType="Detached Home"
				title="King West bridge opportunity"
				variant="nativeMobile"
			/>
		);

		expect(screen.getByText("King West bridge opportunity")).toBeTruthy();
		expect(screen.getByText("64%")).toBeTruthy();
		expect(screen.getByText("9.6%")).toBeTruthy();
		expect(screen.getByText("$240K")).toBeTruthy();
		expect(screen.getByText("$2K")).toBeTruthy();
		expect(screen.getByText("42%")).toBeTruthy();
	});

	it("filters loaded listings immediately while debouncing route search updates", () => {
		vi.useFakeTimers();
		const setSearch = vi.fn();

		render(
			<MarketplaceListingsPage
				search={{}}
				setSearch={setSearch}
				snapshot={{
					continueCursor: null,
					isDone: true,
					page: [
						{
							approximateLatitude: 43.6532,
							approximateLongitude: -79.3832,
							availability: {
								availableFractions: 10_000,
								availablePercent: 100,
								lockedFractions: 0,
								lockedPercent: 0,
								soldFractions: 0,
								soldPercent: 0,
								totalFractions: 10_000,
								totalInvestors: 0,
							},
							displayOrder: 1,
							featured: true,
							heroImageUrl: undefined,
							id: "listing_toronto",
							interestRate: 8.5,
							locationLabel: "Toronto, ON",
							ltvRatio: 0.62,
							marketplaceCopy: "",
							maturityDate: "2027-04-30",
							mortgageId: null,
							mortgageTypeLabel: "First",
							principal: 250_000,
							propertyTypeLabel: "Detached Home",
							termMonths: 12,
							title: "Toronto bridge mortgage",
						},
						{
							approximateLatitude: 43.2555,
							approximateLongitude: -79.8711,
							availability: {
								availableFractions: 5_000,
								availablePercent: 50,
								lockedFractions: 0,
								lockedPercent: 0,
								soldFractions: 5_000,
								soldPercent: 50,
								totalFractions: 10_000,
								totalInvestors: 1,
							},
							displayOrder: 2,
							featured: false,
							heroImageUrl: undefined,
							id: "listing_hamilton",
							interestRate: 9.5,
							locationLabel: "Hamilton, ON",
							ltvRatio: 0.7,
							marketplaceCopy: "",
							maturityDate: "2027-05-30",
							mortgageId: null,
							mortgageTypeLabel: "Second",
							principal: 500_000,
							propertyTypeLabel: "Condo",
							termMonths: 12,
							title: "Hamilton renewal mortgage",
						},
					],
				}}
			/>
		);

		fireEvent.change(screen.getByPlaceholderText("Search address, city, type"), {
			target: { value: "ham" },
		});

		expect(screen.queryAllByText("Toronto bridge mortgage")).toHaveLength(0);
		expect(screen.getAllByText("Hamilton renewal mortgage").length).toBeGreaterThan(
			0
		);
		expect(setSearch).not.toHaveBeenCalled();

		vi.advanceTimersByTime(349);
		expect(setSearch).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(setSearch).toHaveBeenCalledTimes(1);
	});
});
