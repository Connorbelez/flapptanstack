import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	blockedParticipantWorkspaceFixture,
	completedParticipantWorkspaceFixture,
	participantWorkspaceFixture,
} from "#/components/deals/portal-story-fixtures";
import { ParticipantDealWorkspacePage } from "./ParticipantDealWorkspacePage";

const meta = {
	title: "Deal Portals/Participant/Deal Workspace",
	component: ParticipantDealWorkspacePage,
	args: {
		backTo: "/lender/deals",
		workspace: participantWorkspaceFixture,
	},
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof ParticipantDealWorkspacePage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BuyerSigningReady: Story = {};

export const SellerBlockedSigning: Story = {
	args: {
		backTo: "/lender/deals",
		workspace: {
			...blockedParticipantWorkspaceFixture,
			persona: "selling_lender",
		},
	},
};

export const CompletedReceipt: Story = {
	args: {
		workspace: completedParticipantWorkspaceFixture,
	},
};
