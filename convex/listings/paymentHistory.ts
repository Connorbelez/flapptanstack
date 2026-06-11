import type { Doc } from "../_generated/dataModel";

type ObligationDoc = Doc<"obligations">;

const MONTH_LABELS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

function toPaymentHistoryMonthStatus(status: string) {
	switch (status) {
		case "settled":
		case "waived":
			return "settled";
		case "overdue":
		case "partially_settled":
			return "overdue";
		case "missed":
		case "defaulted":
		case "failed":
			return "missed";
		default:
			return null;
	}
}

function formatPaymentHistoryMonthLabel(dueDate: number) {
	const date = new Date(dueDate);
	return MONTH_LABELS[date.getUTCMonth()] ?? "Due";
}

export function buildPaymentHistoryMonthsFromObligations(
	obligations: readonly ObligationDoc[]
) {
	return [...obligations]
		.sort((left, right) => left.dueDate - right.dueDate)
		.flatMap((obligation) => {
			const status = toPaymentHistoryMonthStatus(obligation.status);
			if (!status) {
				return [];
			}

			return [
				{
					id: `${obligation._id}`,
					label: formatPaymentHistoryMonthLabel(obligation.dueDate),
					status,
				},
			];
		});
}
