/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
	emptyPortfolioCommandCenterFixture,
	noSuggestedOpportunitiesFixture,
	portfolioCommandCenterFixture,
	staleSuggestedOpportunitiesFixture,
	unavailableSuggestedOpportunitiesFixture,
} from "#/components/lender/portfolio/fixtures";
import {
	SuggestedOpportunities,
	type SuggestedOpportunitiesState,
} from "#/components/lender/portfolio/suggested-opportunities";

afterEach(() => {
	cleanup();
});

function renderSection(args?: {
	snapshot?: typeof portfolioCommandCenterFixture;
	state?: SuggestedOpportunitiesState;
}) {
	const snapshot = args?.snapshot ?? portfolioCommandCenterFixture;

	return render(
		<SuggestedOpportunities
			excludedOwnedMortgageCount={
				snapshot.suggestedOpportunities.excludedOwnedMortgageCount
			}
				generatedAt={snapshot.generatedAt}
				hasBrokerConstraints={snapshot.limitsStrip.hasConstraints}
				hasPositions={snapshot.positions.rows.length > 0}
				rows={snapshot.suggestedOpportunities.rows}
				state={args?.state}
				unavailableReason={snapshot.suggestedOpportunities.unavailableReason}
			/>
		);
	}

describe("SuggestedOpportunities", () => {
	it("renders suggestion cards with explanation tags, reasons, and listing deep links", () => {
		renderSection();

		expect(screen.getByTestId("suggested-opportunities-section")).toBeTruthy();
		expect(screen.getByText("Fresh Opportunity")).toBeTruthy();
		expect(screen.getByText("Matches detached allocation")).toBeTruthy();
		expect(
			screen.getByText(
				"The listing fits the current detached-home concentration."
			)
		).toBeTruthy();
		expect(
			screen.getByRole("link", { name: /Open listing/i }).getAttribute("href")
		).toBe("/listings/listing_fresh");
	});

	it("renders the empty-portfolio state without collapsing the section", () => {
		renderSection({ snapshot: emptyPortfolioCommandCenterFixture });

		expect(screen.getByTestId("suggested-opportunities-section")).toBeTruthy();
		expect(screen.getByTestId("suggested-opportunities-empty")).toBeTruthy();
		expect(screen.getByText("No portfolio-based matches yet")).toBeTruthy();
	});

	it("explains when broker constraints and already-owned exclusions remove all suggestions", () => {
		renderSection({ snapshot: noSuggestedOpportunitiesFixture });

		expect(screen.getByText("No eligible suggestions right now")).toBeTruthy();
		expect(
			screen.getByText(/Broker-imposed limits and the already-owned exclusion/)
		).toBeTruthy();
		expect(screen.getByText("Excluded 2 already-owned")).toBeTruthy();
	});

	it("renders a dedicated unavailable state when suggestion data cannot be trusted", () => {
		renderSection({
			snapshot: unavailableSuggestedOpportunitiesFixture,
			state: "unavailable",
		});

		expect(screen.getByTestId("suggested-opportunities-unavailable")).toBeTruthy();
		expect(
			screen.getByText("Suggestions are temporarily unavailable")
		).toBeTruthy();
		expect(
			screen.getByText(/could not load a reliable suggestion snapshot/i)
		).toBeTruthy();
		expect(screen.queryByRole("link", { name: /Open listing/i })).toBeNull();
	});

	it("renders loading placeholders without showing stale suggestion content", () => {
		renderSection({ state: "loading" });

		expect(screen.getByTestId("suggested-opportunities-loading")).toBeTruthy();
		expect(screen.queryByText("Fresh Opportunity")).toBeNull();
	});

	it("marks stale suggestion snapshots without hiding the current rows", () => {
		renderSection({ snapshot: staleSuggestedOpportunitiesFixture });

		expect(screen.getByTestId("suggested-opportunities-stale-badge")).toBeTruthy();
		expect(screen.getByText("Fresh Opportunity")).toBeTruthy();
	});
});
