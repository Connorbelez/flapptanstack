// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	DataTableCard,
	MetricStrip,
	type TableColumn,
} from "#/components/admin/financial-ledger/ui";

interface SortableRow {
	amount: number | null;
	id: string;
	name: string;
}

const rows: SortableRow[] = [
	{ amount: 30, id: "row-1", name: "Beta" },
	{ amount: null, id: "row-2", name: "Unassigned" },
	{ amount: 10, id: "row-3", name: "Alpha" },
];

const columns: TableColumn<SortableRow>[] = [
	{
		header: "Name",
		id: "name",
		render: (row) => row.name,
		sortValue: (row) => row.name,
	},
	{
		align: "right",
		header: "Amount",
		id: "amount",
		render: (row) => (row.amount === null ? "—" : `$${row.amount}`),
		sortValue: (row) => row.amount,
	},
];

function renderTable() {
	return render(
		<DataTableCard
			columns={columns}
			emptyMessage="No rows"
			rowKey={(row) => row.id}
			rows={rows}
		/>
	);
}

function bodyRowLabels() {
	return screen
		.getAllByRole("row")
		.slice(1)
		.map((row) => within(row).getAllByRole("cell")[0].textContent);
}

afterEach(() => {
	cleanup();
});

describe("DataTableCard sorting", () => {
	it("cycles sortable headers through ascending, descending, and original order", () => {
		renderTable();

		expect(bodyRowLabels()).toEqual(["Beta", "Unassigned", "Alpha"]);

		fireEvent.click(screen.getByRole("button", { name: "Name" }));
		expect(bodyRowLabels()).toEqual(["Alpha", "Beta", "Unassigned"]);

		fireEvent.click(screen.getByRole("button", { name: "Name" }));
		expect(bodyRowLabels()).toEqual(["Unassigned", "Beta", "Alpha"]);

		fireEvent.click(screen.getByRole("button", { name: "Name" }));
		expect(bodyRowLabels()).toEqual(["Beta", "Unassigned", "Alpha"]);
	});

	it("sorts numeric columns and leaves missing values last in both directions", () => {
		renderTable();

		fireEvent.click(screen.getByRole("button", { name: "Amount" }));
		expect(bodyRowLabels()).toEqual(["Alpha", "Beta", "Unassigned"]);

		fireEvent.click(screen.getByRole("button", { name: "Amount" }));
		expect(bodyRowLabels()).toEqual(["Beta", "Alpha", "Unassigned"]);
	});
});

describe("MetricStrip actions", () => {
	it("calls the metric action when an interactive card is clicked", () => {
		const onSelect = vi.fn();
		render(
			<MetricStrip
				items={[
					{
						label: "Overdue obligations",
						onSelect,
						value: "11",
					},
				]}
			/>
		);

		fireEvent.click(
			screen.getByRole("button", { name: "Overdue obligations 11" })
		);

		expect(onSelect).toHaveBeenCalledOnce();
	});
});
