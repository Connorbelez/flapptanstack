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
import type { PortfolioCommandCenterSnapshot } from "./portfolio-types";

const activeRailSnapshot: PortfolioCommandCenterSnapshot = {
	...portfolioCommandCenterFixture,
	actionsRequired: {
		...portfolioCommandCenterFixture.actionsRequired,
		items: [
			...portfolioCommandCenterFixture.actionsRequired.items,
			{
				dealId: "deal_follow_up",
				dueDate: "2026-05-10",
				id: "action_deal_followup",
				kind: "deal_action",
				mortgageId: "mortgage_king",
				prefillContext: {
					contextType: "deal",
					dealId: "deal_follow_up",
					mortgageId: "mortgage_king",
					propertyLabel: "123 King St W, Toronto",
					subjectId: "deal_follow_up",
					summary: "Confirm close timing for the linked deal package.",
					title: "Confirm deal closing timeline",
				},
				priority: "medium",
				status: "ready",
				summary: "Confirm close timing for the linked deal package.",
				title: "Confirm deal closing timeline",
			},
		],
	},
};

const missingBrokerSnapshot: PortfolioCommandCenterSnapshot = {
	...activeRailSnapshot,
	brokerCoordination: {
		...activeRailSnapshot.brokerCoordination,
		availabilityState: "missing_broker",
		fallbackContactCta: null,
	},
};

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
		snapshot: activeRailSnapshot,
	},
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof LenderPortfolioPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllClear: Story = {
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
		snapshot: {
			...emptyPortfolioCommandCenterFixture,
			brokerCoordination: activeRailSnapshot.brokerCoordination,
		},
	},
};

export const MissingBroker: Story = {
	args: {
		snapshot: missingBrokerSnapshot,
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
