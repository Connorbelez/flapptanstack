import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { DatePickerButton } from "./DatePickerButton";
import { formatPaymentScheduleDate, formatPaymentScheduleMoney } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ScheduleReplacementPreviewRowView {
	amount: number;
	dueDate: number;
	editableDate: boolean;
	executionMode: "app_owned" | "provider_managed";
	kind:
		| "historical_settled"
		| "archived_candidate"
		| "replacement_interest"
		| "replacement_principal";
	obligationType: "regular_interest" | "principal_repayment";
	paymentNumber: number;
	rowKey: string;
	scheduledDate: number;
	status: "context" | "will_archive" | "generated";
}

function rowLabel(row: ScheduleReplacementPreviewRowView) {
	switch (row.kind) {
		case "historical_settled":
			return "Settled context";
		case "archived_candidate":
			return "Will archive";
		case "replacement_interest":
			return "Replacement interest";
		case "replacement_principal":
			return "Manual principal payoff";
		default:
			throw new Error(`Unsupported preview row kind: ${row.kind}`);
	}
}

function collectionRailLabel(row: ScheduleReplacementPreviewRowView) {
	return row.executionMode === "provider_managed" ? "Rotessa PAD" : "Manual";
}

function editableBounds(
	row: ScheduleReplacementPreviewRowView,
	rows: ScheduleReplacementPreviewRowView[],
	minDate: number,
	maxDate: number
) {
	const generatedRows = rows.filter(
		(candidate) => candidate.status === "generated"
	);
	const rowIndex = generatedRows.findIndex(
		(candidate) => candidate.rowKey === row.rowKey
	);
	const previousRow = generatedRows[rowIndex - 1];
	const nextRow = generatedRows[rowIndex + 1];

	return {
		maxDate: Math.min(
			maxDate,
			nextRow ? nextRow.scheduledDate - DAY_MS : maxDate
		),
		minDate: Math.max(
			minDate,
			previousRow ? previousRow.scheduledDate + DAY_MS : minDate
		),
	};
}

export function ScheduleReplacementPreviewTable({
	maxDate = Date.UTC(9999, 11, 31),
	minDate = 0,
	onAdjustDate,
	rows,
}: {
	maxDate?: number;
	minDate?: number;
	onAdjustDate: (
		row: ScheduleReplacementPreviewRowView,
		scheduledDate: number
	) => void;
	rows: ScheduleReplacementPreviewRowView[];
}) {
	return (
		<div className="overflow-hidden rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Row</TableHead>
						<TableHead>Due date</TableHead>
						<TableHead>Collection date</TableHead>
						<TableHead>Amount</TableHead>
						<TableHead>Rail</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => {
						const bounds = editableBounds(row, rows, minDate, maxDate);
						return (
							<TableRow key={row.rowKey}>
								<TableCell>
									<div className="font-medium">{rowLabel(row)}</div>
									<div className="text-muted-foreground text-xs">
										Payment {row.paymentNumber}
									</div>
								</TableCell>
								<TableCell>{formatPaymentScheduleDate(row.dueDate)}</TableCell>
								<TableCell>
									{row.editableDate ? (
										<DatePickerButton
											buttonAriaLabel={`Adjust ${row.rowKey}`}
											className="h-8 w-40"
											label={`Adjust ${row.rowKey}`}
											maxDate={bounds.maxDate}
											minDate={bounds.minDate}
											onChange={(scheduledDate) =>
												onAdjustDate(row, scheduledDate)
											}
											value={row.scheduledDate}
										/>
									) : (
										formatPaymentScheduleDate(row.scheduledDate)
									)}
								</TableCell>
								<TableCell>{formatPaymentScheduleMoney(row.amount)}</TableCell>
								<TableCell>{collectionRailLabel(row)}</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
