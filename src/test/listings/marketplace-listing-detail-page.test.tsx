/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAction } from "convex/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketplaceListingDetailPage } from "#/components/listings/MarketplaceListingDetailPage";
import { buildMarketplaceListingDetailModel } from "#/components/listings/marketplace-detail-adapter";
import type { MarketplaceListingDetailSnapshot } from "#/components/listings/marketplace-types";

vi.mock("#/components/listings/ListingDetailPage", () => ({
	ListingDetailPage: ({
		backHref,
		buildSimilarListingHref,
		checkoutReturnState,
		listing,
		listingsIndexTo,
		mode,
		onStartCheckout,
		portalId,
	}: {
		backHref?: string;
		buildSimilarListingHref?: (listingId: string) => string;
		listing: { checkout?: unknown; title: string };
		listingsIndexTo?: string;
		mode?: string;
		checkoutReturnState?: string;
		onStartCheckout?: (input: {
			listingId: string;
			portalId: string;
			requestedFractions: number;
			selectedLawyer: {
				email: string;
				name: string;
				source: "manual";
				type: "guest_lawyer";
			};
		}) => Promise<unknown>;
		portalId?: string;
	}) => (
		<div
			data-back-href={backHref}
			data-checkout-return-state={checkoutReturnState}
			data-has-checkout={String(listing.checkout !== undefined)}
			data-listings-index-to={listingsIndexTo}
			data-mode={mode}
			data-portal-id={portalId}
			data-similar-href={buildSimilarListingHref?.("listing_similar_1") ??
				(listingsIndexTo
					? `${listingsIndexTo}/listing_similar_1`
					: "/demo/listings/listing_similar_1")}
			data-testid="listing-detail-props"
			data-title={listing.title}
		>
			<button
				onClick={() =>
					void onStartCheckout?.({
						listingId: "listing_123456",
						portalId: "portal_meridian",
						requestedFractions: 2,
						selectedLawyer: {
							type: "guest_lawyer",
							source: "manual",
							name: "Jordan Counsel",
							email: "jordan@example.test",
						},
					})
				}
				type="button"
			>
				Start checkout proxy
			</button>
		</div>
	),
}));

vi.mock("convex/react", () => ({
	useAction: vi.fn(() => vi.fn()),
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

function createDetailSnapshot(): NonNullable<MarketplaceListingDetailSnapshot> {
	return {
		appraisals: [
			{
				comparables: [
					{
						address: "12 Mercer Street",
						adjustedValue: 65_500_000,
						id: "comp-1",
						propertyType: "Condo",
						saleDate: "2026-02-14",
						salePrice: 64_800_000,
						squareFootage: 812,
					},
				],
				effectiveDate: "2026-02-20",
				id: "appraisal-1",
				reportDate: "2026-02-22",
				type: "desktop",
				valueAsIfComplete: 70_500_000,
				valueAsIs: 67_500_000,
			},
		],
		documents: [
			{
				assetId: "asset-1",
				blueprintId: "blueprint-1",
				class: "appraisal_report",
				contentType: "application/pdf",
				description: "Certified third-party appraisal package.",
				displayName: "Appraisal Report",
				fileName: "appraisal-report.pdf",
				kind: "pdf",
				url: "https://example.com/appraisal-report.pdf",
			},
		],
		encumbrances: [
			{
				balanceAsOfDate: "2026-01-05",
				holder: "Senior Charge Holder",
				id: "enc-1",
				outstandingBalance: 12_500_000,
				priority: 1,
				type: "mortgage",
			},
		],
		investment: {
			availableFractions: 4200,
			checkoutReady: true,
			investorCount: 3,
			lockedPercent: 12,
			soldPercent: 28,
			totalFractions: 10_000,
		},
		lawyers: [
			{
				authId: "fairlend-closing-network",
				displayName: "FairLend Closing Network",
				email: "closing@fairlend.local",
				role: "lawyer",
			},
		],
		listing: {
			approximateLatitude: 43.645,
			approximateLongitude: -79.395,
			borrowerSignal: {
				borrowerCount: 2,
				hasGuarantor: true,
				participants: [
					{ idvStatus: "verified", name: "Alex Investor", role: "primary" },
					{ idvStatus: "verified", name: "Jordan Support", role: "guarantor" },
				],
				primaryBorrowerName: "Alex Investor",
			},
			heroImages: [
				{
					caption: "Front elevation",
					id: "hero-1",
					url: "https://example.com/hero-1.jpg",
				},
			],
			id: "listing_123456",
			interestRate: 8.5,
			lienPosition: 1,
			locationLabel: "Toronto, ON",
			ltvRatio: 64,
			marketplaceCopy:
				"Strong first-position opportunity with disciplined underwriting.",
			maturityDate: "2028-03-15",
			mortgageTypeLabel: "First",
			monthlyPayment: 318_700,
			paymentFrequency: "monthly",
			paymentHistory: {
				byStatus: {
					failed: 1,
					overdue: 1,
					pending: 1,
					scheduled: 1,
					settled: 7,
					waived: 1,
				},
				months: [
					{ label: "Jan", status: "settled" },
					{ label: "Feb", status: "overdue" },
					{ label: "Mar", status: "failed" },
				],
				totalObligations: 12,
			},
			paymentSnapshot: {
				mostRecentPaymentAmount: 318_700,
				mostRecentPaymentDate: Date.parse("2026-03-15T00:00:00.000Z"),
				mostRecentPaymentStatus: "settled",
				nextUpcomingPaymentAmount: 318_700,
				nextUpcomingPaymentDate: Date.parse("2026-04-26T00:00:00.000Z"),
				nextUpcomingPaymentStatus: "provider_scheduled",
			},
			nextPaymentDue: {
				amount: 318_700,
				date: Date.parse("2026-05-01T00:00:00.000Z"),
				status: "planned",
			},
			principal: 45_000_000,
			propertyTypeLabel: "Detached Home",
			rateType: "fixed",
			readOnly: true,
			summary:
				"Strong first-position opportunity with disciplined underwriting.",
			termMonths: 24,
			title: "King West Bridge Opportunity",
		},
		similarListings: [
			{
				heroImageUrl: "https://example.com/similar-1.jpg",
				id: "listing_similar_1",
				interestRate: 9.1,
				locationLabel: "Etobicoke, ON",
				ltvRatio: 66,
				mortgageTypeLabel: "First",
				principal: 32_000_000,
				propertyTypeLabel: "Condo",
				title: "Lakeshore Condo Bridge",
			},
		],
	};
}

describe("marketplace listing detail adapter", () => {
	it("builds a read-only listing detail model from the marketplace snapshot", () => {
		const detail = createDetailSnapshot();
		const model = buildMarketplaceListingDetailModel(detail);

		expect(model.investment.availableFractions).toBe(4);
		expect(model.investment.totalFractions).toBe(10);
		expect(model.investment.perFractionAmount).toBe(45_000);
		expect(model.investment.availabilityLabel).toBe("4.2 of 10 available");
		expect(model.atAGlance).toContainEqual({
			label: "Principal",
			value: "$450,000",
		});
		expect(model.appraisal.asIs.value).toBe("$675,000");
		expect(model.keyFinancials).toContainEqual({
			label: "Monthly Payment",
			note: "Monthly",
			value: "$3,187",
		});
		expect(model.documents[0]?.url).toBe(
			"https://example.com/appraisal-report.pdf"
		);
		expect(model.documents[0]?.assetId).toBe("asset-1");
		expect(model.documents[0]?.kind).toBe("pdf");
		expect(model.badges[0]?.label).toBe("1ST MORTGAGE");
		expect(model.paymentHistory).toMatchObject({
			lateCount: 1,
			missedCount: 1,
			nextUpcoming: {
				amount: "$3,187",
				date: "May 1, 2026",
				status: "planned",
				statusLabel: "Planned",
			},
			onTimeRate: "80%",
		});
		expect(model.paymentHistory.months).toEqual([
			{ id: "Jan", label: "Jan", status: "onTime" },
			{ id: "Feb", label: "Feb", status: "late" },
			{ id: "Mar", label: "Mar", status: "missed" },
		]);
	});

	it("keeps the lock workflow visible when provider readiness is false but fractions are available", () => {
		const detail = createDetailSnapshot();
		const model = buildMarketplaceListingDetailModel({
			...detail,
			investment: {
				...detail.investment,
				checkoutReady: false,
			},
		});

		expect(model.checkout).toMatchObject({
			defaultFractions: 1,
			isEligible: true,
			maximumFractions: 4,
			minimumFractions: 1,
		});
	});

	it("hides the lock workflow when no whole fractions are available", () => {
		const detail = createDetailSnapshot();
		const model = buildMarketplaceListingDetailModel({
			...detail,
			investment: {
				...detail.investment,
				availableFractions: 0,
				checkoutReady: false,
			},
		});

		expect(model.checkout).toBeUndefined();
	});
});

describe("marketplace listing detail page", () => {
	it("passes the shared detail page an interactive listing model when checkout is eligible", () => {
		render(
			<MarketplaceListingDetailPage
				checkoutReturnState="success_pending"
				portalId={"portal_meridian" as never}
				snapshot={createDetailSnapshot()}
			/>
		);

		const rendered = screen.getByTestId("listing-detail-props");

		expect(useAction).toHaveBeenCalled();
		expect(rendered.getAttribute("data-mode")).toBe("interactive");
		expect(rendered.getAttribute("data-back-href")).toBe("/listings");
		expect(rendered.getAttribute("data-checkout-return-state")).toBe(
			"success_pending"
		);
		expect(rendered.getAttribute("data-portal-id")).toBe("portal_meridian");
		expect(rendered.getAttribute("data-title")).toBe(
			"King West Bridge Opportunity"
		);
		expect(rendered.getAttribute("data-has-checkout")).toBe("true");
		expect(rendered.getAttribute("data-similar-href")).toBe(
			"/listings/listing_similar_1"
		);
	});

	it("forwards checkout start input to the backend action with route portal authority", async () => {
		const startMarketplaceCheckout = vi.fn().mockResolvedValue({
			ok: true,
			checkoutSessionId: "checkout_123",
			expiresAt: Date.now() + 300_000,
			stripeCheckoutUrl: "https://checkout.stripe.test/session",
		});
		vi.mocked(useAction).mockReturnValue(startMarketplaceCheckout);

		render(
			<MarketplaceListingDetailPage
				portalId={"portal_meridian" as never}
				snapshot={createDetailSnapshot()}
			/>
		);

		fireEvent.click(screen.getByRole("button", { name: "Start checkout proxy" }));

		await waitFor(() => {
			expect(startMarketplaceCheckout).toHaveBeenCalledWith({
				listingId: "listing_123456",
				portalId: "portal_meridian",
				requestedFractions: 2000,
				selectedLawyer: {
					type: "guest_lawyer",
					source: "manual",
					name: "Jordan Counsel",
					email: "jordan@example.test",
				},
			});
		});
	});
});
