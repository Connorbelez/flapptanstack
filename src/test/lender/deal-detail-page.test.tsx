/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LenderDealDetailPage } from "#/components/lender/deals/LenderDealDetailPage";

const { portalDealDetailPageSpy } = vi.hoisted(() => ({
	portalDealDetailPageSpy: vi.fn(
		(props: { audience: string; dealId: string }) => (
			<div data-testid="portal-deal-detail-page">
				{props.audience}:{props.dealId}
			</div>
		)
	),
}));

vi.mock("#/components/portal/deals/PortalDealDetailPage", () => ({
	PortalDealDetailPage: (props: { audience: string; dealId: string }) =>
		portalDealDetailPageSpy(props),
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("lender deal detail page", () => {
	it("renders the shared portal deal detail page for the lender audience", () => {
		render(<LenderDealDetailPage dealId="deal_1" />);

		expect(screen.getByTestId("portal-deal-detail-page").textContent).toBe(
			"lender:deal_1"
		);
		expect(portalDealDetailPageSpy).toHaveBeenCalledWith({
			audience: "lender",
			dealId: "deal_1",
		});
	});
});
