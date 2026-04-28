import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	emptyParticipantQueueFixture,
	participantBuyerQueueFixture,
	participantSellerQueueFixture,
} from "#/components/deals/portal-story-fixtures";
import { ParticipantDealsQueuePage } from "./ParticipantDealsQueuePage";

const meta = {
	title: "Deal Portals/Participant/Deals Queue",
	component: ParticipantDealsQueuePage,
	args: {
		queue: participantBuyerQueueFixture,
	},
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof ParticipantDealsQueuePage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BuyerMixedQueue: Story = {};

export const SellerNeedsAction: Story = {
	args: {
		queue: participantSellerQueueFixture,
	},
};

export const EmptyQueue: Story = {
	args: {
		queue: emptyParticipantQueueFixture,
	},
};
