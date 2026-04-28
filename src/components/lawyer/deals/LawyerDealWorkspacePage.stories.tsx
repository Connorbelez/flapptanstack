import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { fn } from "storybook/test";
import {
	blockedLawyerWorkspaceFixture,
	lawyerWorkspaceFixture,
	readOnlyLawyerWorkspaceFixture,
} from "#/components/deals/portal-story-fixtures";
import { LawyerDealWorkspaceContent } from "./LawyerDealWorkspacePage";

const renderBackLink = (children: ReactNode) => (
	<a href="/lawyer">{children}</a>
);

const meta = {
	title: "Deal Portals/Lawyer/Deal Workspace",
	component: LawyerDealWorkspaceContent,
	args: {
		onApproveDocuments: fn(),
		onConfirmRepresentation: fn(),
		renderBackLink,
		workspace: lawyerWorkspaceFixture,
	},
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof LawyerDealWorkspaceContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PackageReadyForApproval: Story = {};

export const PackageBlocked: Story = {
	args: {
		workspace: blockedLawyerWorkspaceFixture,
	},
};

export const ReadOnlyCompleted: Story = {
	args: {
		workspace: readOnlyLawyerWorkspaceFixture,
	},
};
