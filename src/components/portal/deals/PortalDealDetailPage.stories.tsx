import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import {
	portalArchivedDealDetailFixture,
	portalDealDetailFixture,
	portalErroredDealDetailFixture,
} from "#/components/deals/portal-story-fixtures";
import { PortalDealDetailContent } from "./PortalDealDetailPage";

const renderBackLink = (children: ReactNode) => (
	<a href="/lender">{children}</a>
);

const meta = {
	title: "Deal Portals/Broker and Lender/Deal Package Detail",
	component: PortalDealDetailContent,
	args: {
		audience: "lender",
		createEmbeddedSigningSession: async () => ({
			url: "https://sign.example.test/embedded-session",
		}),
		detail: portalDealDetailFixture,
		renderBackLink,
		syncSignableDocumentEnvelope: async () => undefined,
	},
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof PortalDealDetailContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LenderReadyPackage: Story = {};

export const BrokerReadyPackage: Story = {
	args: {
		audience: "broker",
		renderBackLink: (children) => <a href="/broker">{children}</a>,
	},
};

export const Loading: Story = {
	args: {
		detail: undefined,
	},
};

export const NotFound: Story = {
	args: {
		detail: null,
	},
};

export const ProviderError: Story = {
	args: {
		detail: portalErroredDealDetailFixture,
	},
};

export const ArchivedSignedPackage: Story = {
	args: {
		detail: portalArchivedDealDetailFixture,
	},
};
