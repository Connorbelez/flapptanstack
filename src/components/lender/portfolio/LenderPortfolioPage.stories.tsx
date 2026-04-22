import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import {
	emptyPortfolioCommandCenterFixture,
	emptyPortfolioHistoricalSeriesFixture,
	portfolioCommandCenterFixture,
	portfolioHistoricalSeriesFixture,
	portfolioTaxExportFixture,
	unavailablePortfolioTaxExportFixture,
} from "./fixtures";
import { LenderPortfolioPage } from "./LenderPortfolioPage";

const meta = {
	title: "Lender/Portfolio/LenderPortfolioPage",
	component: LenderPortfolioPage,
	args: {
		leafStateOverrides: {
			cockpit: {
				historySeries: portfolioHistoricalSeriesFixture,
				historyState: "ready",
			},
			exportStrip: {
				canExportTax: true,
				exportContract: portfolioTaxExportFixture,
				exportState: "ready",
			},
		},
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
		leafStateOverrides: {
			cockpit: {
				historySeries: emptyPortfolioHistoricalSeriesFixture,
				historyState: "ready",
			},
			exportStrip: {
				canExportTax: false,
				exportContract: null,
				exportState: "forbidden",
			},
		},
		snapshot: emptyPortfolioCommandCenterFixture,
	},
};

export const ExportUnavailable: Story = {
	args: {
		leafStateOverrides: {
			cockpit: {
				historySeries: portfolioHistoricalSeriesFixture,
				historyState: "ready",
			},
			exportStrip: {
				canExportTax: true,
				exportContract: unavailablePortfolioTaxExportFixture,
				exportState: "ready",
			},
		},
	},
};
