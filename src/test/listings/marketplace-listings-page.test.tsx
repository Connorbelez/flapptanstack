/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { MarketplaceListingsPage } from "#/components/listings/MarketplaceListingsPage";
import { parseMarketplaceListingsSearch } from "#/components/listings/search";

vi.mock("#/components/listings/filter-modal", () => ({
	default: () => <div data-testid="filter-modal" />,
}));

vi.mock("#/components/listings/ListingGridShell", () => ({
	ListingGridShell: ({
		items,
		renderCard,
		toolbar,
	}: {
		items: Array<{ id: string }>;
		renderCard: (item: { id: string }) => ReactNode;
		toolbar?: ReactNode;
	}) => (
		<div>
			{toolbar}
			<div data-testid="listing-grid-shell">
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
				detailRoute="/lender/listings/$listingId"
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
		).toBe("/lender/listings/listing_1");
	});
});
