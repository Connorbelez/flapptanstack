import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	expiredPortfolioRenewalIntentFixture,
	partialExitPortfolioRenewalIntentFixture,
	portfolioRenewalIntentFixture,
	renewedPortfolioRenewalIntentFixture,
} from "../fixtures";
import { RenewalStatus } from "./renewal-status";

const meta = {
	title: "Lender/Portfolio/Renewals/RenewalStatus",
	component: RenewalStatus,
	args: {
		mortgageId: "mortgage_king",
		renewal: portfolioRenewalIntentFixture,
		variant: "full",
	},
	parameters: {
		layout: "centered",
	},
} satisfies Meta<typeof RenewalStatus>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PendingSignal: Story = {};

export const Renewed: Story = {
	args: {
		renewal: renewedPortfolioRenewalIntentFixture,
	},
};

export const PartialExit: Story = {
	args: {
		renewal: partialExitPortfolioRenewalIntentFixture,
	},
};

export const Expired: Story = {
	args: {
		renewal: expiredPortfolioRenewalIntentFixture,
	},
};
