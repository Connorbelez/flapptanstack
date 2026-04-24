import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { PartialExitForm } from "./partial-exit-form";

const meta = {
	title: "Lender/Portfolio/Renewals/PartialExitForm",
	component: PartialExitForm,
	args: {
		currentHeldFractions: 600,
		isSubmitting: false,
		minimumFractions: 100,
		mortgageId: "mortgage_king",
		onChange: fn(),
		onSubmit: fn(),
		value: "150",
		variant: "full",
	},
	parameters: {
		layout: "centered",
	},
} satisfies Meta<typeof PartialExitForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ValidationError: Story = {
	args: {
		validationError: "Partial exit must be at least 100 fractions.",
	},
};
