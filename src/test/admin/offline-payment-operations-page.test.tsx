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
import { useAction, useMutation } from "convex/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflinePaymentOperationsPage } from "#/components/admin/offline-payments/OfflinePaymentOperationsPage";
import {
	buildOfflinePaymentOperationsQueryArgs,
	parseOfflinePaymentOperationsSearch,
} from "#/components/admin/offline-payments/search";
import type {
	OfflinePaymentOperationItem,
	OfflinePaymentOperationsSearchState,
	OfflinePaymentOperationsSnapshot,
} from "#/components/admin/offline-payments/types";

vi.mock("convex/react", () => ({
	useAction: vi.fn(),
	useMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

const useActionMock = useAction as unknown as ReturnType<typeof vi.fn>;
const useMutationMock = useMutation as unknown as ReturnType<typeof vi.fn>;

const DUE_PLAN_ENTRY_ID = "due-plan-1";
const GROUPED_PLAN_ENTRY_ID = "grouped-plan-1";

function createSearch(
	overrides: Partial<OfflinePaymentOperationsSearchState> = {}
): OfflinePaymentOperationsSearchState {
	return {
		amountMax: undefined,
		amountMin: undefined,
		evidenceType: "all",
		instrumentType: "all",
		staffOverdueOnly: false,
		statusBucket: "all",
		view: "board",
		...overrides,
	};
}

function createItem(
	overrides: Partial<OfflinePaymentOperationItem> = {}
): OfflinePaymentOperationItem {
	return {
		amount: 125_000,
		borrowerEmail: "borrower@example.test",
		borrowerId: "borrower_1",
		borrowerLabel: "Avery Borrower",
		bucket: "due",
		evidenceAttachmentIds: [],
		isGrouped: false,
		mortgageId: "mortgage_1",
		mortgageLabel: "123 King Street, Toronto",
		obligationIds: ["obligation_1"],
		obligations: [
			{
				amount: 125_000,
				amountSettled: 0,
				dueDate: Date.parse("2026-06-12T12:00:00.000Z"),
				obligationId: "obligation_1",
				paymentNumber: 1,
				status: "due",
			},
		],
		planEntryId: DUE_PLAN_ENTRY_ID,
		remainingCollectibleAmount: 125_000,
		scheduledDate: Date.parse("2026-06-12T12:00:00.000Z"),
		source: "default_schedule",
		status: "planned",
		...overrides,
	} as OfflinePaymentOperationItem;
}

function createSnapshot(): OfflinePaymentOperationsSnapshot {
	const dueItem = createItem();
	return {
		agenda: [],
		asOf: Date.parse("2026-06-15T12:00:00.000Z"),
		calendarEvents: [
			{
				amount: 125_000,
				borrowerLabel: "Avery Borrower",
				bucket: "due",
				isGrouped: false,
				mortgageLabel: "123 King Street, Toronto",
				planEntryId: DUE_PLAN_ENTRY_ID,
				scheduledDate: Date.parse("2026-06-12T12:00:00.000Z"),
				title: "Avery Borrower - 123 King Street, Toronto",
			},
		],
		confirmedPage: {
			items: [],
			nextCursor: null,
		},
		counters: {
			confirmed: 0,
			delinquent: 0,
			due: 1,
			grouped: 1,
			inProgress: 0,
			overdue: 0,
			staffOverdue: 0,
			upcoming: 0,
		},
		groupedEntries: [
			{
				amount: 80_000,
				borrowerEmail: "workout@example.test",
				borrowerLabel: "Workout Borrower",
				bucket: "due",
				installments: [
					{
						amount: 80_000,
						bucket: "due",
						obligationIds: ["obligation_old", "obligation_new"],
						obligations: [
							{
								amount: 60_000,
								amountSettled: 0,
								dueDate: Date.parse("2026-06-01T12:00:00.000Z"),
								obligationId: "obligation_old",
								paymentNumber: 1,
								status: "due",
							},
							{
								amount: 60_000,
								amountSettled: 0,
								dueDate: Date.parse("2026-06-12T12:00:00.000Z"),
								obligationId: "obligation_new",
								paymentNumber: 2,
								status: "due",
							},
						],
						planEntryId: GROUPED_PLAN_ENTRY_ID,
						scheduledDate: Date.parse("2026-06-12T12:00:00.000Z"),
						status: "planned",
					},
				],
				mortgageId: "mortgage_2",
				mortgageLabel: "456 Queen Street, Toronto",
				planEntryId: GROUPED_PLAN_ENTRY_ID,
				scheduledDate: Date.parse("2026-06-12T12:00:00.000Z"),
			},
		],
		kanban: {
			confirmed: [],
			delinquent: [],
			due: [dueItem],
			inProgress: [],
			overdue: [],
			staffOverdue: [],
			upcoming: [],
		},
	};
}

function setupActionMocks() {
	const startCollection = vi.fn(async () => ({ outcome: "started" }));
	const confirmCollection = vi.fn(async () => ({ outcome: "confirmed" }));
	const confirmGroupedInstallment = vi.fn(async () => ({
		outcome: "confirmed",
	}));
	const assignCollector = vi.fn(async () => ({ outcome: "assigned" }));
	const addCollectionNote = vi.fn(async () => ({ outcome: "noted" }));
	const releaseCollectionAttempt = vi.fn(async () => ({
		outcome: "released",
	}));

	const actions = [startCollection, confirmCollection, confirmGroupedInstallment];
	let actionCallIndex = 0;
	useActionMock.mockImplementation(() => {
		const action = actions[actionCallIndex % actions.length];
		actionCallIndex += 1;
		return action;
	});
	const mutations = [assignCollector, addCollectionNote, releaseCollectionAttempt];
	let mutationCallIndex = 0;
	useMutationMock.mockImplementation(() => {
		const mutation = mutations[mutationCallIndex % mutations.length];
		mutationCallIndex += 1;
		return mutation;
	});

	return {
		addCollectionNote,
		assignCollector,
		confirmCollection,
		confirmGroupedInstallment,
		releaseCollectionAttempt,
		startCollection,
	};
}

function renderPage(
	search: OfflinePaymentOperationsSearchState = createSearch()
) {
	const actions = setupActionMocks();
	const onRefresh = vi.fn(async () => undefined);
	const setSearch = vi.fn();
	const snapshot = createSnapshot();
	render(
		<OfflinePaymentOperationsPage
			onRefresh={onRefresh}
			search={search}
			setSearch={setSearch}
			snapshot={snapshot}
		/>
	);
	return { ...actions, onRefresh, setSearch, snapshot };
}

function applySearchUpdater(
	current: OfflinePaymentOperationsSearchState,
	updater: unknown
) {
	if (typeof updater !== "function") {
		throw new Error("Expected search updater function");
	}
	return (
		updater as (
			value: OfflinePaymentOperationsSearchState
		) => OfflinePaymentOperationsSearchState
	)(current);
}

beforeEach(() => {
	useActionMock.mockReset();
	useMutationMock.mockReset();
});

afterEach(() => {
	cleanup();
});

describe("OfflinePaymentOperationsPage", () => {
	it("renders the offline board with grouped and agenda views available", () => {
		const { setSearch } = renderPage();

		expect(screen.getByRole("heading", { name: "Manual Collections" })).toBeTruthy();
		expect(screen.getAllByText("Avery Borrower").length).toBeGreaterThan(0);
		expect(screen.getByRole("tab", { name: /grouped/i })).toBeTruthy();
		expect(screen.getByRole("tab", { name: /agenda/i })).toBeTruthy();
		expect(screen.getAllByText("123 King Street, Toronto").length).toBeGreaterThan(
			0
		);
		fireEvent.change(screen.getByLabelText("Min amount"), {
			target: { value: "1000" },
		});
		fireEvent.change(screen.getByLabelText("Max amount"), {
			target: { value: "2000.50" },
		});

		expect(
			applySearchUpdater(createSearch(), setSearch.mock.calls[0]?.[0])
		).toMatchObject({ amountMin: "1000" });
		expect(
			applySearchUpdater(createSearch(), setSearch.mock.calls[1]?.[0])
		).toMatchObject({ amountMax: "2000.50" });
	});

	it("maps amount range search params into backend cents filters", () => {
		const parsed = parseOfflinePaymentOperationsSearch({
			amountMax: 2000.5,
			amountMin: "1000",
			view: "grouped",
		});

		expect(buildOfflinePaymentOperationsQueryArgs(parsed)).toMatchObject({
			amountMax: 200_050,
			amountMin: 100_000,
		});
	});

	it("confirms a selected single-obligation offline payment with evidence metadata", async () => {
		const { confirmCollection, onRefresh } = renderPage(
			createSearch({ selectedPlanEntryId: DUE_PLAN_ENTRY_ID })
		);

		await waitFor(() =>
			expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe(
				"1250.00"
			)
		);
		fireEvent.change(screen.getByLabelText("Evidence IDs"), {
			target: { value: "uploaded:receipt-1, uploaded:receipt-2" },
		});
		fireEvent.change(screen.getAllByPlaceholderText("Evidence note")[0], {
			target: { value: "Cash receipt verified against drawer close." },
		});
		fireEvent.change(screen.getAllByPlaceholderText("Reference")[0], {
			target: { value: "drawer-7" },
		});
		fireEvent.click(screen.getAllByRole("button", { name: /^confirm$/i })[0]);

		await waitFor(() => expect(confirmCollection).toHaveBeenCalledTimes(1));
		expect(confirmCollection).toHaveBeenCalledWith({
			amount: 125_000,
			evidence: {
				attachmentIds: ["uploaded:receipt-1", "uploaded:receipt-2"],
				note: "Cash receipt verified against drawer close.",
			},
			instrument: {
				chequeNumber: undefined,
				depositReference: undefined,
				receivedAt: undefined,
				referenceNumber: "drawer-7",
				type: "cash",
			},
			planEntryId: DUE_PLAN_ENTRY_ID,
		});
		expect(onRefresh).toHaveBeenCalled();
	});
});
