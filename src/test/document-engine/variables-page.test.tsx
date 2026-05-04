/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { useMutation, useQuery } from "convex/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentEngineVariablesPage } from "#/components/document-engine/DocumentEngineVariablesPage";

vi.mock("react", async () => {
	const { createRequire } =
		await vi.importActual<typeof import("node:module")>("node:module");
	const require = createRequire(import.meta.url);
	const reactCjs = require("react") as typeof import("react");
	return {
		...reactCjs,
		default: reactCjs,
	};
});

vi.mock("convex/react", () => ({
	useMutation: vi.fn(),
	useQuery: vi.fn(),
}));

const useQueryMock = useQuery as unknown as ReturnType<typeof vi.fn>;
const useMutationMock = useMutation as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("DocumentEngineVariablesPage", () => {
	it("renders canonical variables as read-only while custom variables remain deletable", () => {
		useQueryMock.mockReturnValue([
			{
				_creationTime: 0,
				_id: "canonical:deal_investment_amount",
				availability: "computed_at_lock",
				createdAt: 0,
				description: "Amount this lender is investing.",
				key: "deal_investment_amount",
				label: "Deal Investment Amount",
				readOnly: true,
				sampleValue: "62500",
				source: "canonical",
				systemPath: "deal.fractionalShare * mortgage.principal",
				type: "currency",
			},
			{
				_creationTime: 1,
				_id: "system_variable_custom",
				availability: "custom_alias",
				createdAt: 1,
				description: "Alias maintained by admins.",
				key: "custom_servicing_fee",
				label: "Custom Servicing Fee",
				readOnly: false,
				source: "custom",
				systemPath: "mortgage.servicingFee",
				type: "currency",
			},
		]);
		useMutationMock.mockReturnValue(vi.fn());

		render(<DocumentEngineVariablesPage />);

		expect(screen.getByText("deal_investment_amount")).not.toBeNull();
		expect(screen.getByText("custom_servicing_fee")).not.toBeNull();
		expect(
			screen.queryByRole("button", {
				name: /delete deal_investment_amount/i,
			})
		).toBeNull();
		expect(
			screen.getByRole("button", {
				name: /delete custom_servicing_fee/i,
			})
		).not.toBeNull();
	});
});
