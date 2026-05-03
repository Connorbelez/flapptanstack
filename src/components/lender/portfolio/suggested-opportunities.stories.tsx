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

const STORY_NOW_MS = Date.parse("2026-04-23T15:00:00.000Z");
const FRESH_STORY_GENERATED_AT = Date.parse("2026-04-23T14:00:00.000Z");

function buildArgs(
	snapshot: typeof portfolioCommandCenterFixture,
	state?: SuggestedOpportunitiesState,
	generatedAt = FRESH_STORY_GENERATED_AT
) {
	return {
		excludedOwnedMortgageCount:
			snapshot.suggestedOpportunities.excludedOwnedMortgageCount,
		generatedAt,
		hasBrokerConstraints: snapshot.limitsStrip.hasConstraints,
		hasPositions: snapshot.positions.rows.length > 0,
		nowMs: STORY_NOW_MS,
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
	args: buildArgs(
		staleSuggestedOpportunitiesFixture,
		undefined,
		staleSuggestedOpportunitiesFixture.generatedAt
	),
};
