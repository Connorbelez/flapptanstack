import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import {
	type LawyerMatterStoryItem,
	lawyerMattersFixture,
} from "#/components/deals/portal-story-fixtures";
import { LawyerAssignedClosingsPage } from "./LawyerAssignedClosingsPage";

const renderMatterLink = (
	matter: LawyerMatterStoryItem,
	children: ReactNode
) => <a href={`/lawyer/deals/${String(matter.dealId)}`}>{children}</a>;

const meta = {
	title: "Deal Portals/Lawyer/Assigned Closings",
	component: LawyerAssignedClosingsPage,
	args: {
		matters: lawyerMattersFixture,
		renderMatterLink,
	},
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof LawyerAssignedClosingsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GroupedMatters: Story = {};

export const Empty: Story = {
	args: {
		matters: [],
	},
};
