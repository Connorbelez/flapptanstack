import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";

export type OfflinePaymentBucket =
	| "upcoming"
	| "due"
	| "in_progress"
	| "staff_overdue"
	| "overdue"
	| "delinquent"
	| "confirmed";

export type OfflinePaymentOperationsView = "agenda" | "board" | "grouped";

export interface OfflinePaymentOperationsSearchState {
	amountMax?: string;
	amountMin?: string;
	dateFrom?: string;
	dateTo?: string;
	evidenceType?: "all" | "missing_evidence" | "with_evidence";
	instrumentType?: "all" | "cash" | "cheque";
	search?: string;
	selectedPlanEntryId?: string;
	staffOverdueOnly: boolean;
	statusBucket?: "all" | OfflinePaymentBucket;
	view: OfflinePaymentOperationsView;
}

export type OfflinePaymentOperationsSnapshot = FunctionReturnType<
	typeof api.payments.offlineOperations.getOfflinePaymentOperationsSnapshot
>;

export type OfflinePaymentOperationItem =
	OfflinePaymentOperationsSnapshot["kanban"]["due"][number];

export type OfflinePaymentGroupedEntry =
	OfflinePaymentOperationsSnapshot["groupedEntries"][number];
