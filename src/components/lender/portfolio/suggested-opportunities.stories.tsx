import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	emptyPortfolioCommandCenterFixture,
	noSuggestedOpportunitiesFixture,
	portfolioCommandCenterFixture,
	staleSuggestedOpportunitiesFixture,
	unavailableSuggestedOpportunitiesFixture,
} from "./fixtures";
import {
	SuggestedOpportunities,
	type SuggestedOpportunitiesState,
} from "./suggested-opportunities";

function buildArgs(
	snapshot: typeof portfolioCommandCenterFixture,
	state?: SuggestedOpportunitiesState
) {
	return {
		excludedOwnedMortgageCount:
			snapshot.suggestedOpportunities.excludedOwnedMortgageCount,
		generatedAt: snapshot.generatedAt,
		hasBrokerConstraints: snapshot.limitsStrip.hasConstraints,
		hasPositions: snapshot.positions.rows.length > 0,
		rows: snapshot.suggestedOpportunities.rows,
		state,
		unavailableReason: snapshot.suggestedOpportunities.unavailableReason,
	};
}

const meta = {
	title: "Lender/Portfolio/SuggestedOpportunities",
	component: SuggestedOpportunities,
	args: buildArgs(portfolioCommandCenterFixture),
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof SuggestedOpportunities>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EmptyPortfolio: Story = {
	args: buildArgs(emptyPortfolioCommandCenterFixture),
};

export const NoEligibleMatches: Story = {
	args: buildArgs(noSuggestedOpportunitiesFixture),
};

export const Loading: Story = {
	args: buildArgs(portfolioCommandCenterFixture, "loading"),
};

export const Unavailable: Story = {
	args: buildArgs(unavailableSuggestedOpportunitiesFixture, "unavailable"),
};

export const Stale: Story = {
	args: buildArgs(staleSuggestedOpportunitiesFixture),
};
