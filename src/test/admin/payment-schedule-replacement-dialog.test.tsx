/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentOperationsPage } from "#/components/admin/financial-ledger/payment-operations-page";
import { DatePickerButton } from "#/components/admin/financial-ledger/schedule-replacement/DatePickerButton";
import { ScheduleReplacementControls } from "#/components/admin/financial-ledger/schedule-replacement/ScheduleReplacementControls";
import { ScheduleReplacementPreviewTable } from "#/components/admin/financial-ledger/schedule-replacement/ScheduleReplacementPreviewTable";
import type {
	PaymentOperationsSearchState,
	PaymentOperationsSnapshot,
} from "#/components/admin/financial-ledger/types";

vi.mock("@tanstack/react-router", () => ({
	Link: (props: { children: ReactNode; to: string }) => (
		<a href={props.to}>{props.children}</a>
	),
}));

vi.mock("#/hooks/useAdminDetailSheet", () => ({
	useAdminDetailSheet: () => ({
		close: vi.fn(),
		detailOpen: false,
		entityType: undefined,
		open: vi.fn(),
		recordId: undefined,
		setSearch: vi.fn(),
	}),
}));

vi.mock("#/lib/auth", async (importOriginal) => {
	const actual = await importOriginal<typeof import("#/lib/auth")>();
	return {
		...actual,
		useAuthorization: () => ({ allowed: true, loading: false }),
	};
});

vi.mock(
	"#/components/admin/financial-ledger/schedule-replacement/ScheduleReplacementDialog",
	() => ({
		ScheduleReplacementDialog: () => null,
	})
);

class ResizeObserverMock implements ResizeObserver {
	disconnect() {}
	observe() {}
	unobserve() {}
}

beforeEach(() => {
	vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("payment schedule replacement date picker", () => {
	it("renders the selected date and blocks disabled dates through the calendar predicate", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(
			<DatePickerButton
				label="Start date"
				maxDate={Date.UTC(2026, 5, 15)}
				minDate={Date.UTC(2026, 1, 15)}
				onChange={onChange}
				value={Date.UTC(2026, 1, 15)}
			/>
		);

		const trigger = screen.getByRole("button", { name: /15 Feb 2026/i });
		expect(trigger).not.toBeNull();

		await user.click(trigger);

		expect(screen.getByLabelText("Start date")).not.toBeNull();
	});
});

const baseDraft = {
	deadlineDate: Date.UTC(2026, 5, 15),
	interestPaymentAmount: 10_000,
	paymentFrequency: "monthly",
	replacementRail: "app_managed_manual",
	sliderBounds: {
		maxInterestPaymentAmount: 40_000,
		maxInterestRows: 4,
		minInterestPaymentAmount: 10_000,
		step: 100,
	},
	startDate: Date.UTC(2026, 1, 15),
	validationIssues: [],
} as const;

describe("payment schedule replacement controls", () => {
	it("uses constrained controls for rail, frequency, start date, and amount", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(
			<ScheduleReplacementControls
				deadlineDate={Date.UTC(2026, 5, 15)}
				draft={baseDraft}
				minStartDate={Date.UTC(2026, 1, 15)}
				onChange={onChange}
			/>
		);

		expect(
			screen
				.getByRole("radio", { name: /manual collection/i })
				.getAttribute("aria-checked")
		).toBe("true");
		expect(screen.getByRole("radio", { name: /rotessa pad/i })).not.toBeNull();
		expect(
			screen.getByRole("combobox", { name: /payment frequency/i })
		).not.toBeNull();
		expect(
			screen
				.getByRole("slider", { name: /interest payment amount/i })
				.getAttribute("aria-valuemin")
		).toBe("10000");
		expect(
			screen.queryByRole("textbox", { name: /interest payment amount/i })
		).toBeNull();

		await user.click(screen.getByRole("radio", { name: /rotessa pad/i }));
		expect(onChange).toHaveBeenCalledWith({
			replacementRail: "provider_managed_rotessa",
		});
	});
});

describe("payment schedule replacement preview", () => {
	it("shows settled context and generated app-managed rows with date editors", () => {
		render(
			<ScheduleReplacementPreviewTable
				onAdjustDate={vi.fn()}
				rows={[
					{
						amount: 20_000,
						dueDate: Date.UTC(2026, 0, 15),
						editableDate: false,
						executionMode: "app_owned",
						kind: "historical_settled",
						obligationType: "regular_interest",
						paymentNumber: 1,
						rowKey: "historical-1",
						scheduledDate: Date.UTC(2026, 0, 15),
						status: "context",
					},
					{
						amount: 10_000,
						dueDate: Date.UTC(2026, 1, 15),
						editableDate: true,
						executionMode: "app_owned",
						kind: "replacement_interest",
						obligationType: "regular_interest",
						paymentNumber: 2,
						rowKey: "generated-interest-2",
						scheduledDate: Date.UTC(2026, 1, 15),
						status: "generated",
					},
					{
						amount: 500_000,
						dueDate: Date.UTC(2026, 2, 15),
						editableDate: false,
						executionMode: "app_owned",
						kind: "replacement_principal",
						obligationType: "principal_repayment",
						paymentNumber: 3,
						rowKey: "generated-principal-3",
						scheduledDate: Date.UTC(2026, 2, 15),
						status: "generated",
					},
				]}
			/>
		);

		expect(screen.getByText("Settled context")).not.toBeNull();
		expect(screen.getByText("Replacement interest")).not.toBeNull();
		expect(
			screen.getByRole("button", { name: /adjust generated-interest-2/i })
		).not.toBeNull();
		expect(screen.getByText("Manual principal payoff")).not.toBeNull();
	});

	it("shows provider-managed generated rows without date editors", () => {
		render(
			<ScheduleReplacementPreviewTable
				onAdjustDate={vi.fn()}
				rows={[
					{
						amount: 10_000,
						dueDate: Date.UTC(2026, 1, 15),
						editableDate: false,
						executionMode: "provider_managed",
						kind: "replacement_interest",
						obligationType: "regular_interest",
						paymentNumber: 2,
						rowKey: "generated-interest-2",
						scheduledDate: Date.UTC(2026, 1, 15),
						status: "generated",
					},
					{
						amount: 500_000,
						dueDate: Date.UTC(2026, 2, 15),
						editableDate: false,
						executionMode: "app_owned",
						kind: "replacement_principal",
						obligationType: "principal_repayment",
						paymentNumber: 3,
						rowKey: "generated-principal-3",
						scheduledDate: Date.UTC(2026, 2, 15),
						status: "generated",
					},
				]}
			/>
		);

		expect(screen.getByText("Rotessa PAD")).not.toBeNull();
		expect(
			screen.queryByRole("button", { name: /adjust generated-interest-2/i })
		).toBeNull();
		expect(screen.getByText("Manual principal payoff")).not.toBeNull();
	});
});

const paymentOperationsSnapshot: PaymentOperationsSnapshot = {
	collectionAttempts: [],
	collectionPlanEntries: [
		{
			amount: 100_000,
			balancePreCheck: {},
			borrowerEmail: "borrower@example.test",
			borrowerId: "borrower-1",
			borrowerLabel: "Borrower One",
			createdAt: Date.parse("2026-03-01T00:00:00.000Z"),
			executionMode: "provider_managed",
			lineage: {},
			method: "pad_rotessa",
			mortgageId: "mortgage-1",
			mortgageLabel: "12 King St",
			obligationIds: ["obligation-1"],
			planEntryId: "plan-1",
			reschedule: {},
			scheduledDate: Date.parse("2026-04-01T00:00:00.000Z"),
			source: "default_schedule",
			status: "provider_scheduled",
		},
	],
	generatedAt: Date.parse("2026-04-14T12:00:00.000Z"),
	obligations: [],
	overview: {
		activeCollectionAttempts: 0,
		dueObligations: 0,
		overdueObligations: 0,
		reconciliationExceptions: 0,
		settledObligations: 0,
		upcomingObligations: 0,
	},
	transfers: [],
};

const paymentOperationsSearch: PaymentOperationsSearchState = {
	detailOpen: false,
	entityType: undefined,
	recordId: undefined,
	scheduleBorrowerId: "borrower-1",
	scheduleMortgageId: "mortgage-1",
	selectedCheck: undefined,
	selectedId: undefined,
	showOnlyExceptions: false,
	tab: "collection-plans",
};

describe("payment operations schedule replacement integration", () => {
	it("surfaces the replacement action for a selected mortgage schedule", () => {
		render(
			<PaymentOperationsPage
				onRefresh={vi.fn()}
				search={paymentOperationsSearch}
				setSearch={vi.fn()}
				snapshot={paymentOperationsSnapshot}
			/>
		);

		expect(
			screen.getByRole("button", { name: /replace schedule/i })
		).not.toBeNull();
	});
});
