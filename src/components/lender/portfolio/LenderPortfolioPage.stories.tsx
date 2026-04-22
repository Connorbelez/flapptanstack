import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import {
	emptyPortfolioCommandCenterFixture,
	portfolioCommandCenterFixture,
} from "./fixtures";
import { LenderPortfolioPage } from "./LenderPortfolioPage";

const meta = {
	title: "Lender/Portfolio/LenderPortfolioPage",
	component: LenderPortfolioPage,
	args: {
		portalId: "portal_meridian" as never,
		search: {
			paymentSort: "due-desc",
			positionSort: "next-payment-soonest",
		},
		setSearch: fn(),
		snapshot: portfolioCommandCenterFixture,
	},
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof LenderPortfolioPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
	args: {
		snapshot: emptyPortfolioCommandCenterFixture,
	},
};
