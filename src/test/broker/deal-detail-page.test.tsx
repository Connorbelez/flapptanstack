/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrokerDealDetailPage } from "#/components/broker/deals/BrokerDealDetailPage";

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

describe("broker deal detail page", () => {
	it("renders the shared portal deal detail page for the broker audience", () => {
		render(<BrokerDealDetailPage dealId="deal_1" />);

		expect(screen.getByTestId("portal-deal-detail-page").textContent).toBe(
			"broker:deal_1"
		);
		expect(portalDealDetailPageSpy).toHaveBeenCalledWith({
			audience: "broker",
			dealId: "deal_1",
		});
	});
});
