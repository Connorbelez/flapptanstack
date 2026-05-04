/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	emptyPortfolioCommandCenterFixture,
	emptyPortfolioHistoricalSeriesFixture,
	portfolioCommandCenterFixture,
	portfolioHistoricalSeriesFixture,
	portfolioPaymentDetailFixture,
	portfolioPositionDetailFixture,
	portfolioTaxExportFixture,
} from "#/components/lender/portfolio/fixtures";
import { LenderPortfolioPage } from "#/components/lender/portfolio/LenderPortfolioPage";
import {
	DEFAULT_LENDER_PORTFOLIO_SEARCH,
	type LenderPortfolioSearchState,
	type PortfolioCommandCenterSnapshot,
} from "#/components/lender/portfolio/portfolio-types";
import {
	lenderPortfolioPaymentDetailQueryOptions,
	lenderPortfolioPositionDetailQueryOptions,
} from "#/components/lender/portfolio/query-options";
import { useIsMobile } from "#/hooks/use-mobile";

class ResizeObserverMock {
	disconnect() {}
	observe() {}
	unobserve() {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
	Object.defineProperty(globalThis, "ResizeObserver", {
		value: ResizeObserverMock,
		writable: true,
	});
}

vi.mock("@tanstack/react-query", () => ({
	useQuery: vi.fn(),
}));

vi.mock("#/components/lender/portfolio/query-options", () => ({
	lenderPortfolioPaymentDetailQueryOptions: vi.fn(),
	lenderPortfolioPositionDetailQueryOptions: vi.fn(),
}));

vi.mock("#/components/lender/portfolio/renewals/renewal-actions", () => ({
	RenewalActionSurface: ({
		mortgageId,
		variant,
	}: {
		mortgageId: string;
		variant: string;
	}) => (
		<div data-testid={`renewal-action-surface-mock-${variant}-${mortgageId}`} />
	),
}));

vi.mock("#/hooks/use-mobile", () => ({
	useIsMobile: vi.fn(),
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const PAYMENT_DETAIL_QUERY_OPTIONS = {
	queryKey: ["portfolio-payment-detail", "obligation_overdue"],
};
const POSITION_DETAIL_QUERY_OPTIONS = {
	queryKey: ["portfolio-position-detail", "mortgage_king"],
};
const PORTAL_ID = "portal_meridian" as never;

const activeRailSnapshot: PortfolioCommandCenterSnapshot = {
	...portfolioCommandCenterFixture,
	actionsRequired: {
		...portfolioCommandCenterFixture.actionsRequired,
		items: [
			...portfolioCommandCenterFixture.actionsRequired.items,
			{
				dealId: "deal_follow_up",
				dueDate: "2026-05-10",
				id: "action_deal_followup",
				kind: "deal_action",
				mortgageId: "mortgage_king",
				prefillContext: {
					contextType: "deal",
					dealId: "deal_follow_up",
					mortgageId: "mortgage_king",
					propertyLabel: "123 King St W, Toronto",
					subjectId: "deal_follow_up",
					summary: "Confirm close timing for the linked deal package.",
					title: "Confirm deal closing timeline",
				},
				priority: "medium",
				status: "ready",
				summary: "Confirm close timing for the linked deal package.",
				title: "Confirm deal closing timeline",
			},
		],
	},
};

const missingBrokerSnapshot: PortfolioCommandCenterSnapshot = {
	...activeRailSnapshot,
	brokerCoordination: {
		...activeRailSnapshot.brokerCoordination,
		assignedBroker: null,
		availabilityState: "missing_broker",
		fallbackContactCta: null,
	},
};

function renderPage({
	initialSearch = DEFAULT_LENDER_PORTFOLIO_SEARCH,
	snapshot = activeRailSnapshot,
}: {
	initialSearch?: LenderPortfolioSearchState;
	snapshot?: PortfolioCommandCenterSnapshot;
}) {
	let search = initialSearch;
	let view!: ReturnType<typeof render>;

	const renderNode = () => (
		<LenderPortfolioPage
			leafStateOverrides={{
				cockpit: {
					historySeries:
						snapshot.positions.rows.length === 0
							? emptyPortfolioHistoricalSeriesFixture
							: portfolioHistoricalSeriesFixture,
					historyState: "ready",
				},
				exportStrip: {
					canExportTax: true,
					exportContract: portfolioTaxExportFixture,
					exportState: "ready",
				},
			}}
			queryMode={{ kind: "portal", portalId: PORTAL_ID }}
			search={search}
			setSearch={(updater) => {
				search = updater(search);
				view.rerender(renderNode());
			}}
			snapshot={snapshot}
		/>
	);

	view = render(renderNode());

	return view;
}

function getRailQueries() {
	const railHosts = screen.getAllByTestId("sticky-rail-slot-host");
	expect(railHosts).toHaveLength(2);
	return within(railHosts[0]!);
}

describe("lender portfolio rail", () => {
	it("renders Actions Required above Broker Chat and updates the broker message draft", () => {
		vi.mocked(useIsMobile).mockReturnValue(false);

		renderPage({});

		const rail = getRailQueries();
		const headings = rail
			.getAllByRole("heading", { level: 3 })
			.map((heading) => heading.textContent);

		expect(headings).toEqual(["Actions Required", "Broker Chat"]);
		expect(rail.getByLabelText("About broker message draft")).toBeTruthy();
		expect(
			rail.getByTestId("renewal-action-surface-mock-compact-mortgage_king")
		).toBeTruthy();
		expect(rail.queryByTestId("broker-prefill-textarea")).toBeNull();
		expect(rail.getByTestId("action-item-action_renewal_king").textContent).not.toContain(
			"Broker message ready"
		);

		fireEvent.click(rail.getByTestId("action-prefill-action_payment_overdue"));

		const textarea = rail.getByTestId("broker-prefill-textarea") as HTMLTextAreaElement;
		expect(textarea.value).toContain("Investigate overdue payment");
		expect(textarea.value).toContain(
			"Collection follow-up required for overdue lender payment."
		);
		expect(rail.getByTestId("action-item-action_payment_overdue").textContent).toContain(
			"Broker message ready"
		);

		const contactLink = rail.getByTestId("broker-contact-cta") as HTMLAnchorElement;
		expect(contactLink.getAttribute("href")).toContain(
			"mailto:broker@fairlend.ca"
		);
		expect(contactLink.getAttribute("href")).toContain(
			"subject=Investigate+overdue+payment"
		);
	});

	it("keeps broker-suggested follow-up text distinct from matching action subjects", () => {
		vi.mocked(useIsMobile).mockReturnValue(false);

		renderPage({});

		const rail = getRailQueries();

		fireEvent.click(rail.getByTestId("broker-prefill-option-mortgage_king"));

		const textarea = rail.getByTestId("broker-prefill-textarea") as HTMLTextAreaElement;
		expect(textarea.value).toContain("Discuss renewal timing");
		expect(textarea.value).toContain(
			"Discuss the renewal decision for the King Street mortgage."
		);
		expect(textarea.value).not.toContain("Review King Street renewal");
		expect(rail.getByTestId("action-item-action_renewal_king").textContent).not.toContain(
			"Broker message ready"
		);
		const contactLink = rail.getByTestId("broker-contact-cta") as HTMLAnchorElement;
		expect(contactLink.getAttribute("href")).toContain(
			"subject=Discuss+renewal+timing"
		);
	});

	it("keeps the all-clear state visible instead of removing the rail", () => {
		vi.mocked(useIsMobile).mockReturnValue(false);

		renderPage({
			snapshot: {
				...emptyPortfolioCommandCenterFixture,
				brokerCoordination: activeRailSnapshot.brokerCoordination,
			},
		});

		const rail = getRailQueries();

		expect(rail.getByTestId("actions-required-all-clear")).toBeTruthy();
		expect(rail.getByTestId("broker-chat-panel")).toBeTruthy();
	});

	it("renders the unavailable-chat fallback with explicit broker contact data", () => {
		vi.mocked(useIsMobile).mockReturnValue(false);

		renderPage({});

		const rail = getRailQueries();

		expect(rail.getByTestId("broker-chat-assigned")).toBeTruthy();
		expect(rail.getByText("Fallback contact")).toBeTruthy();
		const contactLink = rail.getByTestId("broker-contact-cta") as HTMLAnchorElement;
		expect(contactLink.textContent).toContain("Email Morgan Broker");
		expect(contactLink.getAttribute("href")).toContain(
			"mailto:broker@fairlend.ca"
		);
	});

	it("disables profile fallback contact when the contract only provides a broker id", () => {
		vi.mocked(useIsMobile).mockReturnValue(false);

		renderPage({
			snapshot: {
				...activeRailSnapshot,
				brokerCoordination: {
					...activeRailSnapshot.brokerCoordination,
					assignedBroker: {
						...activeRailSnapshot.brokerCoordination.assignedBroker!,
						email: null,
						phoneNumber: null,
					},
					fallbackContactCta: {
						label: "View assigned broker",
						mode: "profile",
						value: "broker_meridian",
					},
				},
			},
		});

		const rail = getRailQueries();

		expect(rail.queryByTestId("broker-contact-cta")).toBeNull();
		const disabledCta = rail.getByTestId("broker-contact-cta-disabled");
		expect(disabledCta).toBeTruthy();
		expect(disabledCta.textContent).toContain("View assigned broker");
	});

	it("enables profile fallback contact when the contract provides an http profile URL", () => {
		vi.mocked(useIsMobile).mockReturnValue(false);

		renderPage({
			snapshot: {
				...activeRailSnapshot,
				brokerCoordination: {
					...activeRailSnapshot.brokerCoordination,
					fallbackContactCta: {
						label: "View assigned broker",
						mode: "profile",
						value: " https://fairlend.example/brokers/broker_meridian ",
					},
				},
			},
		});

		const rail = getRailQueries();

		const contactLink = rail.getByTestId("broker-contact-cta") as HTMLAnchorElement;
		expect(contactLink.textContent).toContain("View assigned broker");
		expect(contactLink.getAttribute("href")).toBe(
			"https://fairlend.example/brokers/broker_meridian"
		);
		expect(rail.queryByTestId("broker-contact-cta-disabled")).toBeNull();
	});

	it("renders the missing-broker fallback without removing the coordination surface", () => {
		vi.mocked(useIsMobile).mockReturnValue(false);

		renderPage({ snapshot: missingBrokerSnapshot });

		const rail = getRailQueries();

		expect(rail.getByTestId("actions-required-section")).toBeTruthy();
		expect(rail.getByTestId("broker-chat-missing")).toBeTruthy();
		expect(rail.queryByTestId("broker-contact-cta")).toBeNull();
		expect(rail.getByText("Broker assignment missing")).toBeTruthy();
	});

	it("opens supported detail views from rail actions and leaves deal follow-ups as broker-message only", () => {
		vi.mocked(useIsMobile).mockReturnValue(false);
		vi.mocked(lenderPortfolioPaymentDetailQueryOptions).mockReturnValue(
			PAYMENT_DETAIL_QUERY_OPTIONS as never
		);
		vi.mocked(lenderPortfolioPositionDetailQueryOptions).mockReturnValue(
			POSITION_DETAIL_QUERY_OPTIONS as never
		);
		vi.mocked(useQuery).mockImplementation((args: { queryKey: string[] }) => {
			if (args.queryKey[0] === "portfolio-payment-detail") {
				return {
					data: portfolioPaymentDetailFixture,
					error: null,
					isPending: false,
				} as never;
			}

			if (args.queryKey[0] === "portfolio-position-detail") {
				return {
					data: portfolioPositionDetailFixture,
					error: null,
					isPending: false,
				} as never;
			}

			return {
				data: undefined,
				error: null,
				isPending: false,
			} as never;
		});

		renderPage({});

		const rail = getRailQueries();

		expect(rail.queryByTestId("action-open-details-action_deal_followup")).toBeNull();

		fireEvent.click(rail.getByTestId("action-open-details-action_payment_overdue"));
		expect(screen.getByTestId("payment-detail-host")).toBeTruthy();
		expect(screen.getByText("Payment detail")).toBeTruthy();

		fireEvent.click(screen.getByLabelText("Close Payment detail"));
		fireEvent.click(rail.getByTestId("action-open-details-action_renewal_king"));
		expect(screen.getByTestId("position-detail-host")).toBeTruthy();
		expect(screen.getByText("Position detail")).toBeTruthy();
	});
});
