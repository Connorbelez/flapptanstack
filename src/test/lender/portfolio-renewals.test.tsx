/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	expiredPortfolioRenewalIntentFixture,
	partialExitPortfolioRenewalIntentFixture,
	portfolioRenewalIntentFixture,
	renewedPortfolioRenewalIntentFixture,
} from "#/components/lender/portfolio/fixtures";
import { PartialExitForm } from "#/components/lender/portfolio/renewals/partial-exit-form";
import { RenewalStatus } from "#/components/lender/portfolio/renewals/renewal-status";
import {
	getRenewalBlockedReasonDescription,
	getRenewalChoiceLabel,
	getRenewalRemoteStateKey,
	reconcileRenewalDraftState,
	validateRenewalPartialExit,
} from "#/components/lender/portfolio/renewals/renewal-ui-helpers";
import type { UsePortfolioRenewalActionsResult } from "#/components/lender/portfolio/renewals/use-renewal-actions";

const usePortfolioRenewalActionsMock = vi.fn();

vi.mock("#/components/lender/portfolio/renewals/use-renewal-actions", () => ({
	useAdminPortfolioRenewalActions: () => usePortfolioRenewalActionsMock(),
	usePortalPortfolioRenewalActions: () => usePortfolioRenewalActionsMock(),
}));

type RenewalActionSurfaceComponent = typeof import("#/components/lender/portfolio/renewals/renewal-actions").RenewalActionSurface;

let RenewalActionSurface: RenewalActionSurfaceComponent;

beforeAll(async () => {
	({ RenewalActionSurface } = await import(
		"#/components/lender/portfolio/renewals/renewal-actions"
	));
});

afterEach(() => {
	cleanup();
	usePortfolioRenewalActionsMock.mockReset();
	vi.clearAllMocks();
});

const MORTGAGE_ID = "mortgage_king";
const PORTAL_ID = "portal_meridian" as never;

function buildRenewalActionsResult(
	overrides: Partial<UsePortfolioRenewalActionsResult> = {}
): UsePortfolioRenewalActionsResult {
	return {
		isLoading: false,
		isSubmitting: false,
		loadErrorMessage: undefined,
		renewal: portfolioRenewalIntentFixture,
		submitErrorMessage: undefined,
		submitIntent: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

describe("renewal ui helpers", () => {
	it("formats governed renewal choices for shared rail and sheet actions", () => {
		expect(getRenewalChoiceLabel("renew")).toBe("Renew");
		expect(getRenewalChoiceLabel("exit")).toBe("Exit");
		expect(getRenewalChoiceLabel("partial_exit")).toBe("Partial Exit");
	});

	it("describes blocked renewal states that remain visible but non-actionable", () => {
		expect(
			getRenewalBlockedReasonDescription(
				expiredPortfolioRenewalIntentFixture.actionBlockedReason
			)
		).toContain("deadline has passed");
		expect(getRenewalBlockedReasonDescription("position_sold")).toContain(
			"no longer holds an actionable position"
		);
		expect(getRenewalBlockedReasonDescription(null)).toBeNull();
	});

	it("validates partial exit fractions against runtime minimums and holdings", () => {
		expect(
			validateRenewalPartialExit({
				currentHeldFractions: 600,
				minimumFractions: 100,
				value: "",
			})
		).toBe("Enter the number of fractions to exit.");
		expect(
			validateRenewalPartialExit({
				currentHeldFractions: 600,
				minimumFractions: 100,
				value: "50",
			})
		).toBe("Partial exit must be at least 100 fractions.");
		expect(
			validateRenewalPartialExit({
				currentHeldFractions: 600,
				minimumFractions: 100,
				value: "601",
			})
		).toBe("Partial exit cannot exceed the lender's current held position.");
		expect(
			validateRenewalPartialExit({
				currentHeldFractions: 600,
				minimumFractions: 100,
				value: "150",
			})
		).toBeNull();
	});

	it("drops stale partial-exit draft state when the governed intent changes elsewhere", () => {
		const initialDraftState = {
			activeChoice: "partial_exit" as const,
			partialExitFractions: "175",
			remoteStateKey: getRenewalRemoteStateKey(portfolioRenewalIntentFixture),
			validationError: "Partial exit must be at least 100 fractions.",
		};

		expect(
			reconcileRenewalDraftState({
				draftState: initialDraftState,
				renewal: renewedPortfolioRenewalIntentFixture,
			})
		).toEqual({
			activeChoice: null,
			partialExitFractions: "",
			remoteStateKey: getRenewalRemoteStateKey(
				renewedPortfolioRenewalIntentFixture
			),
			validationError: undefined,
		});
	});
});

describe("renewal ui components", () => {
	it("clears stale partial-exit UI when the governed intent changes elsewhere", async () => {
		usePortfolioRenewalActionsMock.mockReturnValue(
			buildRenewalActionsResult({
				renewal: portfolioRenewalIntentFixture,
			})
		);

		const view = render(
			<RenewalActionSurface
				mortgageId={MORTGAGE_ID}
				portalId={PORTAL_ID}
				variant="full"
			/>
		);

		fireEvent.click(
			screen.getByTestId(`renewal-choice-partial_exit-${MORTGAGE_ID}`)
		);
		fireEvent.change(screen.getByLabelText("Partial exit amount"), {
			target: { value: "175" },
		});

		expect(
			screen.getByTestId(`renewal-partial-exit-form-${MORTGAGE_ID}`)
		).toBeTruthy();

		usePortfolioRenewalActionsMock.mockReturnValue(
			buildRenewalActionsResult({
				renewal: renewedPortfolioRenewalIntentFixture,
			})
		);

		view.rerender(
			<RenewalActionSurface
				mortgageId={MORTGAGE_ID}
				portalId={PORTAL_ID}
				variant="full"
			/>
		);

		await waitFor(() => {
			expect(
				screen.queryByTestId(`renewal-partial-exit-form-${MORTGAGE_ID}`)
			).toBeNull();
		});

		expect(screen.getByText("Change mind available")).toBeTruthy();
		expect(screen.queryByLabelText("Partial exit amount")).toBeNull();
	});

	it("shows pending state only for the submitted renewal choice", async () => {
		const submitIntent = vi.fn(
			() =>
				new Promise<void>(() => {
					// Keep the submit pending so the transient choice state is visible.
				})
		);

		usePortfolioRenewalActionsMock.mockReturnValue(
			buildRenewalActionsResult({
				submitIntent,
			})
		);

		render(
			<RenewalActionSurface
				mortgageId={MORTGAGE_ID}
				portalId={PORTAL_ID}
				variant="full"
			/>
		);

		fireEvent.click(
			screen.getByTestId(`renewal-choice-partial_exit-${MORTGAGE_ID}`)
		);
		fireEvent.click(screen.getByTestId(`renewal-choice-renew-${MORTGAGE_ID}`));

		await waitFor(() => {
			expect(submitIntent).toHaveBeenCalledWith({ intent: "renew" });
			expect(
				screen.getByTestId(`renewal-choice-pending-renew-${MORTGAGE_ID}`)
			).toBeTruthy();
		});

		expect(
			screen.queryByTestId(`renewal-choice-pending-exit-${MORTGAGE_ID}`)
		).toBeNull();
		expect(
			screen.queryByTestId(`renewal-choice-pending-partial_exit-${MORTGAGE_ID}`)
		).toBeNull();
		expect(screen.getByText("Confirm partial exit")).toBeTruthy();
		expect(
			(
				screen.getByTestId(
					`renewal-submit-partial-exit-${MORTGAGE_ID}`
				) as HTMLButtonElement
			).disabled
		).toBe(true);
	});

	it("renders the governed pending state with action-required status details", () => {
		render(
			<RenewalStatus
				mortgageId={MORTGAGE_ID}
				renewal={portfolioRenewalIntentFixture}
				variant="full"
			/>
		);

		expect(screen.getByTestId(`renewal-status-full-${MORTGAGE_ID}`)).toBeTruthy();
		expect(screen.getByText("Action required")).toBeTruthy();
		expect(screen.getByText("Awaiting lender decision")).toBeTruthy();
		expect(screen.getByText("600 fractions")).toBeTruthy();
	});

	it("renders changeable intent state and the partial exit form bounds", () => {
		const onChange = vi.fn();
		const onSubmit = vi.fn();

		render(
			<>
				<RenewalStatus
					mortgageId={MORTGAGE_ID}
					renewal={renewedPortfolioRenewalIntentFixture}
					variant="full"
				/>
				<PartialExitForm
					currentHeldFractions={partialExitPortfolioRenewalIntentFixture.currentHeldFractions}
					isSubmitting={false}
					minimumFractions={partialExitPortfolioRenewalIntentFixture.partialExitMinimumFractions}
					mortgageId={MORTGAGE_ID}
					onChange={onChange}
					onSubmit={onSubmit}
					validationError="Partial exit must be at least 100 fractions."
					value="150"
					variant="full"
				/>
			</>
		);

		expect(screen.getByText("Change mind available")).toBeTruthy();
		expect(screen.getAllByText("Renew")).toHaveLength(2);
		expect(
			screen.getByText(/between 100 fractions and 600 fractions/i)
		).toBeTruthy();
		expect(
			screen.getByTestId(`renewal-partial-exit-error-${MORTGAGE_ID}`)
				.textContent
		).toContain("at least 100 fractions");

		fireEvent.change(screen.getByLabelText("Partial exit amount"), {
			target: { value: "175" },
		});
		fireEvent.click(
			screen.getByTestId(`renewal-submit-partial-exit-${MORTGAGE_ID}`)
		);

		expect(onChange).toHaveBeenCalledWith("175");
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});
});
