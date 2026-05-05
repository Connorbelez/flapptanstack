import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	emptyParticipantQueueFixture,
	participantPurchasingLenderQueueFixture,
	participantSellingLenderQueueFixture,
} from "#/components/deals/portal-story-fixtures";
import { ParticipantDealsQueuePage } from "./ParticipantDealsQueuePage";

const meta = {
	title: "Deal Portals/Participant/Deals Queue",
	component: ParticipantDealsQueuePage,
	args: {
		queue: participantPurchasingLenderQueueFixture,
	},
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof ParticipantDealsQueuePage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PurchasingLenderMixedQueue: Story = {};

export const SellingLenderNeedsAction: Story = {
	args: {
		queue: participantSellingLenderQueueFixture,
	},
};

export const EmptyQueue: Story = {
	args: {
		queue: emptyParticipantQueueFixture,
	},
};
