/**
 * @vitest-environment jsdom
 */

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { useMutation } from "convex/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	BrokerPortalPricingCard,
	FairLendMicPortalCard,
} from "#/components/admin/settings/AdminSettingsPage";
import { toast } from "sonner";

vi.mock("convex/react", () => ({
	useAction: vi.fn(),
	useMutation: vi.fn(),
	useQuery: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

function buildBrokerPortalPricingSnapshot() {
	return {
		brokerPortalCount: 2,
		brokerSplitPercent: 0,
		driftedBrokerPortalCount: 1,
		lastUpdatedAt: 1_710_001_000_000,
		updatedByAuthId: "user_fairlend_admin",
	};
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("admin settings page", () => {
	it("renders broker portal pricing and saves the updated value", async () => {
		const saveBrokerPricing = vi.fn().mockResolvedValue({
			brokerPortalCount: 2,
			brokerPortalsUpdated: 2,
			brokerSplitPercent: 7.5,
			fairLendPortalsUpdated: 0,
			lastUpdatedAt: 1_710_001_500_000,
		});
		vi.mocked(useMutation).mockReturnValue(saveBrokerPricing);

		render(
			<BrokerPortalPricingCard
				brokerPortalPricing={buildBrokerPortalPricingSnapshot()}
			/>
		);

		expect(screen.getByText("Broker portal pricing")).toBeTruthy();

		fireEvent.change(
			screen.getByLabelText("Broker portal price adjustment (%)"),
			{
				target: { value: "7.5" },
			}
		);
		fireEvent.submit(
			screen.getByRole("button", { name: "Save broker pricing" }).closest("form")!
		);

		await waitFor(() => {
			expect(saveBrokerPricing).toHaveBeenCalledWith({
				brokerSplitPercent: 7.5,
			});
		});
	});

	it("rejects invalid broker pricing input without calling the mutation", () => {
		const saveBrokerPricing = vi.fn();
		vi.mocked(useMutation).mockReturnValue(saveBrokerPricing);

		render(
			<BrokerPortalPricingCard
				brokerPortalPricing={buildBrokerPortalPricingSnapshot()}
			/>
		);

		fireEvent.change(
			screen.getByLabelText("Broker portal price adjustment (%)"),
			{
				target: { value: "-5" },
			}
		);
		fireEvent.submit(
			screen.getByRole("button", { name: "Save broker pricing" }).closest("form")!
		);

		expect(saveBrokerPricing).not.toHaveBeenCalled();
	});

	it("runs the FairLend MIC portal repair mutation", async () => {
		const repairMicPortal = vi.fn().mockResolvedValue({
			lenderId: "lender_fairlend_mic",
			micLenderAuthId: "seed_fairlend_mic_lender_fairlend_ca",
			orgId: "org_mic",
			portalId: "portal_mic",
			wasCreated: false,
		});
		vi.mocked(useMutation).mockReturnValue(repairMicPortal);

		render(<FairLendMicPortalCard />);

		fireEvent.click(screen.getByRole("button", { name: "Repair MIC portal" }));

		await waitFor(() => {
			expect(repairMicPortal).toHaveBeenCalledWith({});
		});
		expect(toast.success).toHaveBeenCalledWith(
			"MIC portal ready at mic.localhost:3000 with lender mapping seed_fairlend_mic_lender_fairlend_ca."
		);
	});
});
