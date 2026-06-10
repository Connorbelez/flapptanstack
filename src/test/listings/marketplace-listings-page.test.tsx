/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Horizontal } from "#/components/listings/listing-card-horizontal";
import { MarketplaceListingsPage } from "#/components/listings/MarketplaceListingsPage";
import { parseMarketplaceListingsSearch } from "#/components/listings/search";

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
});
