import type { Meta, StoryObj } from "@storybook/react-vite";
import { DealClosingPipelineDemo } from "./DealClosingPipelineDemo";
import { dealClosingPipelineFixture } from "./fixtures";

const meta = {
	title: "Demo/Deal Closing Pipeline",
	component: DealClosingPipelineDemo,
	args: {
		data: dealClosingPipelineFixture,
	},
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof DealClosingPipelineDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DocumentsInProgress: Story = {};
