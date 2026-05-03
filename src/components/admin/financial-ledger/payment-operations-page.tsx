import { Link } from "@tanstack/react-router";
import {
	Download,
	ExternalLink,
	Landmark,
	RefreshCw,
	UserRound,
} from "lucide-react";
import { type MouseEvent, type ReactNode, useMemo, useState } from "react";
import { Button } from "#/components/ui/button";
import { useAdminDetailSheet } from "#/hooks/useAdminDetailSheet";
import type { AdminDetailSearch } from "#/lib/admin-detail-search";
import { useAuthorization } from "#/lib/auth";
import { cn } from "#/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
	ExecutePlanEntryDialog,
	ReschedulePlanEntryDialog,
} from "../../demo/amps/dialogs";
import { WaiveBalanceDialog, WriteOffBalanceDialog } from "./actions";
import { downloadCsv, rowsToCsv } from "./csv";
import {
	formatCurrencyCents,
	formatDateOnly,
	formatDateTime,
	formatInteger,
	humanizeLabel,
} from "./format";
import {
	buildPaymentOperationBorrowerScheduleGroups,
	deriveScheduleContextFromSelectedRecord,
	getPaymentOperationScheduleRecords,
	getScheduleBorrowerId,
	getScheduleMortgageId,
	type PaymentOperationBorrowerScheduleGroup,
	type PaymentOperationMortgageScheduleGroup,
} from "./payment-operations-schedules";
import { ScheduleReplacementDialog } from "./schedule-replacement/ScheduleReplacementDialog";
import type {
	FinancialLedgerSearchState,
	MetricItem,
	PaymentCollectionAttemptRow,
	PaymentCollectionPlanEntryRow,
	PaymentOperationsObligationRow,
	PaymentOperationsSearchState,
	PaymentOperationsSnapshot,
	PaymentOperationsTab,
	PaymentOperationsTransferRow,
} from "./types";
import {
	ActionButtonRow,
	DataTableCard,
	DetailRail,
	EmptyDetailState,
	FilterBar,
	FilterDateInput,
	FilterField,
	FilterSelect,
	FilterSwitch,
	FilterTextInput,
	InlineCode,
	KeyValueList,
	MetricStrip,
	PageHeader,
	SectionCard,
	StatusBadge,
	type TableColumn,
} from "./ui";

interface PaymentOperationsPageProps {
	onRefresh: () => Promise<unknown>;
	search: PaymentOperationsSearchState;
	setSearch: (
		updater: (
			current: PaymentOperationsSearchState
		) => PaymentOperationsSearchState
	) => void;
	snapshot: PaymentOperationsSnapshot;
}

type LinkSearchSeed = Partial<{
	borrowerId: string;
	dateFrom: string;
	dateTo: string;
	detailOpen: boolean;
	entityType: string | undefined;
	lenderId: string;
	mortgageId: string;
	recordId: string | undefined;
	scheduleBorrowerId: string;
	scheduleMortgageId: string;
	search: string;
	selectedCheck: string;
	selectedId: string;
	showOnlyExceptions: boolean;
	status: string;
	tab: FinancialLedgerSearchState["tab"] | PaymentOperationsSearchState["tab"];
	type: string;
}>;

const TAB_LABELS: Record<PaymentOperationsTab, string> = {
	collections: "Collections",
	"collection-plans": "Collection Plans",
	obligations: "Obligations",
	transfers: "Transfers",
};

const ACTIVE_COLLECTION_STATUSES = new Set([
	"executing",
	"initiated",
	"pending",
]);

const PAYMENT_OPERATIONS_METRIC_FILTERS = {
	activeCollections: "active_collections",
	reconciliationExceptions: "reconciliation_exceptions",
} as const;

const RECORD_REFERENCE_DEFINITIONS = {
	borrowers: {
		entityType: "borrowers",
		label: "Borrower",
		mode: "admin",
	},
	collectionAttempts: {
		label: "Collection attempt",
		mode: "paymentOperations",
		tab: "collections",
	},
	collectionPlanEntries: {
		label: "Plan entry",
		mode: "paymentOperations",
		tab: "collection-plans",
	},
	mortgages: {
		entityType: "mortgages",
		label: "Mortgage",
		mode: "admin",
	},
	obligations: {
		entityType: "obligations",
		label: "Obligation",
		mode: "admin",
	},
	transferRequests: {
		label: "Transfer request",
		mode: "paymentOperations",
		tab: "transfers",
	},
} as const;

type RecordReferenceType = keyof typeof RECORD_REFERENCE_DEFINITIONS;

interface RecordReference {
	description?: string | null;
	label?: string | null;
	recordId: string;
	type: RecordReferenceType;
}

function isAdminRecordReferenceDefinition(
	definition: (typeof RECORD_REFERENCE_DEFINITIONS)[RecordReferenceType]
): definition is Extract<
	(typeof RECORD_REFERENCE_DEFINITIONS)[RecordReferenceType],
	{ mode: "admin" }
> {
	return definition.mode === "admin";
}

function isPaymentOperationsRecordReferenceDefinition(
	definition: (typeof RECORD_REFERENCE_DEFINITIONS)[RecordReferenceType]
): definition is Extract<
	(typeof RECORD_REFERENCE_DEFINITIONS)[RecordReferenceType],
	{ mode: "paymentOperations" }
> {
	return definition.mode === "paymentOperations";
}

function getRecordReferenceDefinition(reference: RecordReference) {
	return RECORD_REFERENCE_DEFINITIONS[reference.type];
}

function getTabRecordLabel(tab: PaymentOperationsTab) {
	switch (tab) {
		case "collections":
			return "Attempts";
		case "collection-plans":
			return "Plan entries";
		case "obligations":
			return "Obligations";
		case "transfers":
			return "Transfers";
		default:
			return "Records";
	}
}

function getTabAmountLabel(tab: PaymentOperationsTab) {
	return tab === "obligations" ? "Obligation amount" : "Amount";
}

function summarizeStatusCounts(statusCounts: Record<string, number>) {
	return Object.entries(statusCounts).sort((left, right) => {
		if (right[1] !== left[1]) {
			return right[1] - left[1];
		}
		return left[0].localeCompare(right[0], "en");
	});
}

function buildStatusSortValue(statusCounts: Record<string, number>) {
	return summarizeStatusCounts(statusCounts)
		.map(([status, count]) => `${status}:${count}`)
		.join("|");
}

function normalizeText(value: string) {
	return value.trim().toLowerCase();
}

function matchesText(
	search: string | undefined,
	values: Array<string | null | undefined>
) {
	if (!search) {
		return true;
	}

	const needle = normalizeText(search);
	return values.some((value) => value && normalizeText(value).includes(needle));
}

function parseLocalDateStart(date: string) {
	return Date.parse(`${date}T00:00:00.000`);
}

function parseLocalDateEnd(date: string) {
	return Date.parse(`${date}T23:59:59.999`);
}

function matchesDateRange(
	value: number | string | null | undefined,
	dateFrom?: string,
	dateTo?: string
) {
	if (value === null || value === undefined) {
		return !(dateFrom || dateTo);
	}

	const timestamp =
		typeof value === "string" ? Date.parse(value) : new Date(value).getTime();
	if (Number.isNaN(timestamp)) {
		return false;
	}

	if (dateFrom) {
		const fromMs = parseLocalDateStart(dateFrom);
		if (!Number.isNaN(fromMs) && timestamp < fromMs) {
			return false;
		}
	}

	if (dateTo) {
		const toMs = parseLocalDateEnd(dateTo);
		if (!Number.isNaN(toMs) && timestamp > toMs) {
			return false;
		}
	}

	return true;
}

function matchesObligationFilters(
	row: PaymentOperationsObligationRow,
	search: PaymentOperationsSearchState
) {
	return (
		(!search.metricFilter ||
			search.metricFilter !==
				PAYMENT_OPERATIONS_METRIC_FILTERS.reconciliationExceptions ||
			row.hasJournalDrift ||
			row.isCorrective) &&
		(!search.status || row.status === search.status) &&
		(!search.type || row.type === search.type) &&
		(!search.mortgageId || row.mortgageId === search.mortgageId) &&
		(!search.borrowerId || row.borrowerId === search.borrowerId) &&
		(!search.showOnlyExceptions || row.hasJournalDrift || row.isCorrective) &&
		matchesDateRange(row.dueDate, search.dateFrom, search.dateTo) &&
		matchesText(search.search, [
			row.obligationId,
			row.mortgageLabel,
			row.borrowerLabel,
			row.type,
			row.status,
		])
	);
}

function matchesCollectionFilters(
	row: PaymentCollectionAttemptRow,
	search: PaymentOperationsSearchState
) {
	return (
		(!search.metricFilter ||
			search.metricFilter !==
				PAYMENT_OPERATIONS_METRIC_FILTERS.activeCollections ||
			ACTIVE_COLLECTION_STATUSES.has(row.status)) &&
		(!search.metricFilter ||
			search.metricFilter !==
				PAYMENT_OPERATIONS_METRIC_FILTERS.reconciliationExceptions ||
			row.reconciliation?.isHealthy === false) &&
		(!search.status || row.status === search.status) &&
		(!search.type || row.method === search.type) &&
		(!search.mortgageId || row.mortgageId === search.mortgageId) &&
		(!search.borrowerId || row.borrowerId === search.borrowerId) &&
		(!search.showOnlyExceptions || row.reconciliation?.isHealthy === false) &&
		matchesDateRange(row.initiatedAt, search.dateFrom, search.dateTo) &&
		matchesText(search.search, [
			row.collectionAttemptId,
			row.borrowerEmail,
			row.borrowerLabel,
			row.executionIdempotencyKey,
			row.mortgageLabel,
			...row.obligationIds,
			row.transfer?.providerRef,
			row.status,
			row.triggerSource,
		])
	);
}

function matchesTransferFilters(
	row: PaymentOperationsTransferRow,
	search: PaymentOperationsSearchState
) {
	return (
		(!search.metricFilter ||
			search.metricFilter !==
				PAYMENT_OPERATIONS_METRIC_FILTERS.reconciliationExceptions ||
			row.journalIntegrity !== "linked") &&
		(!search.status || row.status === search.status) &&
		(!search.type || row.transferType === search.type) &&
		(!search.mortgageId || row.mortgageId === search.mortgageId) &&
		(!search.lenderId || row.lenderId === search.lenderId) &&
		(!search.borrowerId || row.borrowerId === search.borrowerId) &&
		(!search.showOnlyExceptions || row.journalIntegrity !== "linked") &&
		matchesDateRange(row.createdAt, search.dateFrom, search.dateTo) &&
		matchesText(search.search, [
			row.transferId,
			row.counterpartyLabel,
			row.providerCode,
			row.providerRef,
			row.mortgageLabel,
		])
	);
}

function matchesCollectionPlanFilters(
	row: PaymentCollectionPlanEntryRow,
	search: PaymentOperationsSearchState
) {
	return (
		(!search.metricFilter ||
			search.metricFilter !==
				PAYMENT_OPERATIONS_METRIC_FILTERS.reconciliationExceptions ||
			Boolean(row.balancePreCheck.decision || row.workoutPlan)) &&
		(!search.status || row.status === search.status) &&
		(!search.type || row.source === search.type) &&
		(!search.mortgageId || row.mortgageId === search.mortgageId) &&
		(!search.borrowerId || row.borrowerId === search.borrowerId) &&
		(!search.showOnlyExceptions ||
			Boolean(row.balancePreCheck.decision || row.workoutPlan)) &&
		matchesDateRange(row.scheduledDate, search.dateFrom, search.dateTo) &&
		matchesText(search.search, [
			row.planEntryId,
			row.mortgageLabel,
			row.borrowerLabel,
			row.source,
			row.method,
			row.status,
			...row.obligationIds,
			row.createdByRule?.displayName,
			row.workoutPlan?.name,
		])
	);
}

function getManualExecutionBlockReason(
	row: PaymentCollectionPlanEntryRow,
	now: number
) {
	if (row.executionMode === "provider_managed") {
		return "Provider-managed entries are executed by the external payment schedule.";
	}
	if (row.relatedAttempt || row.collectionAttemptId) {
		return "This entry already has a linked collection attempt.";
	}
	if (row.status !== "planned") {
		return `Manual execution is only available for planned app-owned entries. This entry is ${humanizeLabel(row.status)}.`;
	}
	if (row.scheduledDate > now) {
		return "This entry is scheduled in the future.";
	}
	return null;
}

function getRescheduleBlockReason(
	row: PaymentCollectionPlanEntryRow,
	now: number
) {
	if (row.relatedAttempt || row.collectionAttemptId) {
		return "This entry already has execution linkage and cannot be rescheduled safely.";
	}
	if (row.status !== "planned") {
		return `Rescheduling is only available for planned entries. This entry is ${humanizeLabel(row.status)}.`;
	}
	if (row.scheduledDate <= now) {
		return "This entry is already due for scheduler execution.";
	}
	return null;
}

function getCollectionReconciliationStatus(
	reconciliation: PaymentCollectionAttemptRow["reconciliation"]
) {
	if (!reconciliation) {
		return {
			label: "pending reconciliation",
			variant: "secondary" as const,
		};
	}

	return {
		label: reconciliation.isHealthy ? "healthy" : "unhealthy",
		variant: reconciliation.isHealthy
			? ("default" as const)
			: ("destructive" as const),
	};
}

function buildOptions(values: Array<string | null | undefined>) {
	return Array.from(
		new Set(values.filter((value): value is string => Boolean(value)))
	)
		.sort((left, right) => left.localeCompare(right, "en"))
		.map((value) => ({ label: humanizeLabel(value), value }));
}

function buildAdminDetailLinkSearch(
	current: LinkSearchSeed
): AdminDetailSearch {
	return {
		detailOpen: current.detailOpen ?? false,
		entityType: current.entityType,
		recordId: current.recordId,
	};
}

function buildFinancialLedgerLinkSearch(
	current: LinkSearchSeed,
	patch: Partial<FinancialLedgerSearchState>
): FinancialLedgerSearchState {
	return {
		...buildAdminDetailLinkSearch(current),
		borrowerId: current.borrowerId,
		dateFrom: current.dateFrom,
		dateTo: current.dateTo,
		lenderId: current.lenderId,
		mortgageId: current.mortgageId,
		search: current.search,
		selectedCheck: current.selectedCheck,
		selectedId: current.selectedId,
		showOnlyExceptions: current.showOnlyExceptions ?? false,
		status: current.status,
		tab:
			current.tab === "cash-ledger" ||
			current.tab === "ops-health" ||
			current.tab === "ownership-ledger" ||
			current.tab === "validation"
				? current.tab
				: "reconciliation",
		type: current.type,
		...patch,
	};
}

function exportTabCsv(args: {
	collectionAttempts: PaymentCollectionAttemptRow[];
	collectionPlanEntries: PaymentCollectionPlanEntryRow[];
	obligations: PaymentOperationsObligationRow[];
	tab: PaymentOperationsTab;
	transfers: PaymentOperationsTransferRow[];
}) {
	switch (args.tab) {
		case "obligations":
			downloadCsv(
				"payment-operations-obligations.csv",
				rowsToCsv(
					[
						"obligation_id",
						"status",
						"due_date",
						"mortgage",
						"borrower",
						"type",
						"payment_number",
						"amount",
						"amount_settled",
						"journal_outstanding_balance",
						"projected_outstanding_balance",
						"latest_collection_status",
						"latest_transfer_status",
					],
					args.obligations.map((row) => ({
						amount: (row.amount / 100).toFixed(2),
						amount_settled: (row.amountSettled / 100).toFixed(2),
						borrower: row.borrowerLabel,
						due_date: row.dueDate,
						journal_outstanding_balance: (
							row.journalOutstandingBalance / 100
						).toFixed(2),
						latest_collection_status: row.latestCollectionStatus ?? "",
						latest_transfer_status: row.latestTransferStatus ?? "",
						mortgage: row.mortgageLabel,
						obligation_id: row.obligationId,
						payment_number: row.paymentNumber,
						projected_outstanding_balance: (
							row.projectedOutstandingBalance / 100
						).toFixed(2),
						status: row.status,
						type: row.type,
					}))
				)
			);
			return;
		case "collections":
			downloadCsv(
				"payment-operations-collections.csv",
				rowsToCsv(
					[
						"collection_attempt_id",
						"status",
						"amount",
						"method",
						"mortgage_id",
						"plan_entry_id",
						"obligation_count",
						"transfer_status",
						"reconciliation_status",
						"initiated_at",
						"confirmed_at",
						"failed_at",
						"provider_ref",
					],
					args.collectionAttempts.map((row) => ({
						amount: (row.amount / 100).toFixed(2),
						collection_attempt_id: row.collectionAttemptId,
						confirmed_at: row.confirmedAt
							? new Date(row.confirmedAt).toISOString()
							: "",
						failed_at: row.failedAt ? new Date(row.failedAt).toISOString() : "",
						initiated_at: new Date(row.initiatedAt).toISOString(),
						method: row.method,
						mortgage_id: row.mortgageId,
						obligation_count: row.obligationIds.length,
						plan_entry_id: row.planEntryId,
						provider_ref: row.transfer?.providerRef ?? "",
						reconciliation_status: getCollectionReconciliationStatus(
							row.reconciliation
						).label,
						status: row.status,
						transfer_status: row.transfer?.status ?? "",
					}))
				)
			);
			return;
		case "transfers":
			downloadCsv(
				"payment-operations-transfers.csv",
				rowsToCsv(
					[
						"transfer_id",
						"status",
						"direction",
						"transfer_type",
						"amount",
						"mortgage",
						"counterparty",
						"provider_code",
						"provider_ref",
						"created_at",
						"confirmed_at",
						"reversed_at",
						"journal_integrity",
					],
					args.transfers.map((row) => ({
						amount: (row.amount / 100).toFixed(2),
						confirmed_at: row.confirmedAt
							? new Date(row.confirmedAt).toISOString()
							: "",
						counterparty: row.counterpartyLabel,
						created_at: new Date(row.createdAt).toISOString(),
						direction: row.direction,
						journal_integrity: row.journalIntegrity,
						mortgage: row.mortgageLabel ?? row.mortgageId ?? "",
						provider_code: row.providerCode,
						provider_ref: row.providerRef ?? "",
						reversed_at: row.reversedAt
							? new Date(row.reversedAt).toISOString()
							: "",
						status: row.status,
						transfer_id: row.transferId,
						transfer_type: row.transferType,
					}))
				)
			);
			return;
		case "collection-plans":
			downloadCsv(
				"payment-operations-collection-plans.csv",
				rowsToCsv(
					[
						"plan_entry_id",
						"status",
						"source",
						"scheduled_date",
						"amount",
						"method",
						"mortgage",
						"mortgage_id",
						"borrower",
						"obligation_count",
						"balance_precheck_decision",
						"workout_plan",
						"related_attempt_id",
					],
					args.collectionPlanEntries.map((row) => ({
						amount: (row.amount / 100).toFixed(2),
						balance_precheck_decision: row.balancePreCheck.decision ?? "",
						borrower: row.borrowerLabel ?? "",
						method: row.method,
						mortgage: row.mortgageLabel,
						mortgage_id: row.mortgageId,
						obligation_count: row.obligationIds.length,
						plan_entry_id: row.planEntryId,
						related_attempt_id: row.relatedAttempt?.collectionAttemptId ?? "",
						scheduled_date: new Date(row.scheduledDate).toISOString(),
						source: row.source,
						status: row.status,
						workout_plan: row.workoutPlan?.name ?? "",
					}))
				)
			);
			return;
		default:
			return;
	}
}

function renderTabButton(args: {
	currentTab: PaymentOperationsTab;
	label: string;
	onSelect: () => void;
	tab: PaymentOperationsTab;
}) {
	return (
		<button
			className={
				args.currentTab === args.tab
					? "rounded-full bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm"
					: "rounded-full border px-3 py-1.5 text-muted-foreground text-sm hover:bg-muted"
			}
			key={args.tab}
			onClick={args.onSelect}
			type="button"
		>
			{args.label}
		</button>
	);
}

function stopReferenceClick(event: MouseEvent<HTMLButtonElement>) {
	event.preventDefault();
	event.stopPropagation();
}

function LinkedRecordCode({
	onOpen,
	reference,
}: {
	onOpen: (reference: RecordReference) => void;
	reference: RecordReference;
}) {
	const definition = getRecordReferenceDefinition(reference);

	return (
		<button
			className={cn(
				"inline-flex max-w-full items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs",
				"text-left text-foreground underline-offset-2 transition hover:bg-muted/80 hover:text-primary hover:underline",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			)}
			onClick={(event) => {
				stopReferenceClick(event);
				onOpen(reference);
			}}
			title={`Open ${definition.label} details`}
			type="button"
		>
			<span className="truncate">{reference.label ?? reference.recordId}</span>
			<ExternalLink className="size-3 shrink-0" />
		</button>
	);
}

function LinkedRecordCard({
	icon,
	onOpen,
	reference,
}: {
	icon?: ReactNode;
	onOpen: (reference: RecordReference) => void;
	reference: RecordReference;
}) {
	const definition = getRecordReferenceDefinition(reference);

	return (
		<button
			className="flex w-full items-start gap-3 rounded-md border bg-muted/20 p-3 text-left transition hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			onClick={(event) => {
				stopReferenceClick(event);
				onOpen(reference);
			}}
			type="button"
		>
			<div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
				{icon ?? <ExternalLink className="size-4" />}
			</div>
			<div className="min-w-0 space-y-1">
				<div className="text-muted-foreground text-xs uppercase tracking-[0.12em]">
					{definition.label}
				</div>
				<div className="truncate font-medium text-sm">
					{reference.label ?? reference.recordId}
				</div>
				{reference.description ? (
					<div className="truncate text-muted-foreground text-xs">
						{reference.description}
					</div>
				) : null}
				<InlineCode value={reference.recordId} />
			</div>
		</button>
	);
}

export function PaymentOperationsPage({
	onRefresh,
	search,
	setSearch,
	snapshot,
}: PaymentOperationsPageProps) {
	const adminDetailSheet = useAdminDetailSheet();
	const [replacementMortgageId, setReplacementMortgageId] =
		useState<Id<"mortgages"> | null>(null);
	const openRecordReference = (reference: RecordReference) => {
		const definition = getRecordReferenceDefinition(reference);

		if (isAdminRecordReferenceDefinition(definition)) {
			adminDetailSheet.setSearch({
				detailOpen: true,
				entityType: definition.entityType,
				recordId: reference.recordId,
			});
			return;
		}

		if (isPaymentOperationsRecordReferenceDefinition(definition)) {
			setSearch((current) => ({
				...current,
				detailOpen: false,
				recordId: undefined,
				selectedId: reference.recordId,
				tab: definition.tab,
			}));
		}
	};
	const selectMetricFilter = (
		patch: Pick<
			PaymentOperationsSearchState,
			"metricFilter" | "showOnlyExceptions" | "status" | "tab"
		>
	) => {
		setSearch((current) => ({
			...current,
			...patch,
			scheduleBorrowerId: undefined,
			scheduleMortgageId: undefined,
			search: undefined,
			selectedId: undefined,
			type: undefined,
		}));
	};

	const metricItems: MetricItem[] = [
		{
			isActive: search.tab === "obligations" && search.status === "upcoming",
			label: "Upcoming obligations",
			onSelect: () =>
				selectMetricFilter({
					metricFilter: undefined,
					showOnlyExceptions: false,
					status: "upcoming",
					tab: "obligations",
				}),
			value: formatInteger(snapshot.overview.upcomingObligations),
		},
		{
			isActive: search.tab === "obligations" && search.status === "due",
			label: "Due obligations",
			onSelect: () =>
				selectMetricFilter({
					metricFilter: undefined,
					showOnlyExceptions: false,
					status: "due",
					tab: "obligations",
				}),
			value: formatInteger(snapshot.overview.dueObligations),
		},
		{
			isActive: search.tab === "obligations" && search.status === "overdue",
			label: "Overdue obligations",
			onSelect: () =>
				selectMetricFilter({
					metricFilter: undefined,
					showOnlyExceptions: false,
					status: "overdue",
					tab: "obligations",
				}),
			tone: snapshot.overview.overdueObligations > 0 ? "critical" : "default",
			value: formatInteger(snapshot.overview.overdueObligations),
		},
		{
			isActive: search.tab === "obligations" && search.status === "settled",
			label: "Settled obligations",
			onSelect: () =>
				selectMetricFilter({
					metricFilter: undefined,
					showOnlyExceptions: false,
					status: "settled",
					tab: "obligations",
				}),
			tone: "positive",
			value: formatInteger(snapshot.overview.settledObligations),
		},
		{
			isActive:
				search.tab === "collections" &&
				search.metricFilter ===
					PAYMENT_OPERATIONS_METRIC_FILTERS.activeCollections,
			label: "Active collections",
			onSelect: () =>
				selectMetricFilter({
					metricFilter: PAYMENT_OPERATIONS_METRIC_FILTERS.activeCollections,
					showOnlyExceptions: false,
					status: undefined,
					tab: "collections",
				}),
			tone:
				snapshot.overview.activeCollectionAttempts > 0 ? "warning" : "default",
			value: formatInteger(snapshot.overview.activeCollectionAttempts),
		},
		{
			description: "All full-suite gaps and reconciliation exceptions.",
			isActive:
				search.metricFilter ===
				PAYMENT_OPERATIONS_METRIC_FILTERS.reconciliationExceptions,
			label: "Reconciliation exceptions",
			onSelect: () =>
				selectMetricFilter({
					metricFilter:
						PAYMENT_OPERATIONS_METRIC_FILTERS.reconciliationExceptions,
					showOnlyExceptions: true,
					status: undefined,
					tab: search.tab,
				}),
			tone:
				snapshot.overview.reconciliationExceptions > 0
					? "critical"
					: "positive",
			value: formatInteger(snapshot.overview.reconciliationExceptions),
		},
	];

	const filteredObligations = useMemo(
		() =>
			snapshot.obligations.filter((row) =>
				matchesObligationFilters(row, search)
			),
		[search, snapshot.obligations]
	);

	const filteredCollections = useMemo(
		() =>
			snapshot.collectionAttempts.filter((row) =>
				matchesCollectionFilters(row, search)
			),
		[search, snapshot.collectionAttempts]
	);

	const filteredTransfers = useMemo(
		() =>
			snapshot.transfers.filter((row) => matchesTransferFilters(row, search)),
		[search, snapshot.transfers]
	);

	const filteredCollectionPlans = useMemo(
		() =>
			snapshot.collectionPlanEntries.filter((row) =>
				matchesCollectionPlanFilters(row, search)
			),
		[search, snapshot.collectionPlanEntries]
	);

	const filteredScheduleSnapshot = useMemo<PaymentOperationsSnapshot>(
		() => ({
			...snapshot,
			collectionAttempts: filteredCollections,
			collectionPlanEntries: filteredCollectionPlans,
			obligations: filteredObligations,
			transfers: filteredTransfers,
		}),
		[
			filteredCollectionPlans,
			filteredCollections,
			filteredObligations,
			filteredTransfers,
			snapshot,
		]
	);
	const selectedScheduleContext = useMemo(
		() =>
			deriveScheduleContextFromSelectedRecord({
				selectedId: search.selectedId,
				snapshot,
				tab: search.tab,
			}),
		[search.selectedId, search.tab, snapshot]
	);
	const activeScheduleBorrowerId =
		search.scheduleBorrowerId ?? selectedScheduleContext?.borrowerId;
	const activeScheduleMortgageId =
		search.scheduleMortgageId ??
		(activeScheduleBorrowerId === selectedScheduleContext?.borrowerId
			? selectedScheduleContext?.mortgageId
			: undefined);
	const scheduleRecords = useMemo(
		() =>
			getPaymentOperationScheduleRecords(filteredScheduleSnapshot, search.tab),
		[filteredScheduleSnapshot, search.tab]
	);
	const borrowerScheduleGroups = useMemo(
		() => buildPaymentOperationBorrowerScheduleGroups(scheduleRecords),
		[scheduleRecords]
	);
	const selectedBorrowerSchedule =
		borrowerScheduleGroups.find((row) => row.id === activeScheduleBorrowerId) ??
		null;
	const selectedMortgageSchedule =
		selectedBorrowerSchedule?.mortgages.find(
			(row) => row.id === activeScheduleMortgageId
		) ?? null;
	const isRecordDrilldownActive = Boolean(
		activeScheduleBorrowerId && activeScheduleMortgageId
	);
	const scheduleScopedObligations = isRecordDrilldownActive
		? filteredObligations.filter(
				(row) =>
					getScheduleBorrowerId(row.borrowerId) === activeScheduleBorrowerId &&
					getScheduleMortgageId(row.mortgageId) === activeScheduleMortgageId
			)
		: filteredObligations;
	const scheduleScopedCollections = isRecordDrilldownActive
		? filteredCollections.filter(
				(row) =>
					getScheduleBorrowerId(row.borrowerId) === activeScheduleBorrowerId &&
					getScheduleMortgageId(row.mortgageId) === activeScheduleMortgageId
			)
		: filteredCollections;
	const scheduleScopedTransfers = isRecordDrilldownActive
		? filteredTransfers.filter(
				(row) =>
					getScheduleBorrowerId(
						row.borrowerId ??
							(row.counterpartyType === "borrower" ? row.counterpartyId : null)
					) === activeScheduleBorrowerId &&
					getScheduleMortgageId(row.mortgageId) === activeScheduleMortgageId
			)
		: filteredTransfers;
	const scheduleScopedCollectionPlans = isRecordDrilldownActive
		? filteredCollectionPlans.filter(
				(row) =>
					getScheduleBorrowerId(row.borrowerId) === activeScheduleBorrowerId &&
					getScheduleMortgageId(row.mortgageId) === activeScheduleMortgageId
			)
		: filteredCollectionPlans;

	const selectedObligation = search.selectedId
		? (scheduleScopedObligations.find(
				(row) => row.obligationId === search.selectedId
			) ?? null)
		: null;
	const selectedCollection = search.selectedId
		? (scheduleScopedCollections.find(
				(row) => row.collectionAttemptId === search.selectedId
			) ?? null)
		: null;
	const selectedTransfer = search.selectedId
		? (scheduleScopedTransfers.find(
				(row) => row.transferId === search.selectedId
			) ?? null)
		: null;
	const selectedCollectionPlan = search.selectedId
		? (scheduleScopedCollectionPlans.find(
				(row) => row.planEntryId === search.selectedId
			) ?? null)
		: null;

	const currentStatusOptions = useMemo(() => {
		switch (search.tab) {
			case "obligations":
				return buildOptions(snapshot.obligations.map((row) => row.status));
			case "collections":
				return buildOptions(
					snapshot.collectionAttempts.map((row) => row.status)
				);
			case "transfers":
				return buildOptions(snapshot.transfers.map((row) => row.status));
			case "collection-plans":
				return buildOptions(
					snapshot.collectionPlanEntries.map((row) => row.status)
				);
			default:
				return [];
		}
	}, [search.tab, snapshot]);

	const currentTypeOptions = useMemo(() => {
		switch (search.tab) {
			case "obligations":
				return buildOptions(snapshot.obligations.map((row) => row.type));
			case "collections":
				return buildOptions(
					snapshot.collectionAttempts.map((row) => row.method)
				);
			case "transfers":
				return buildOptions(snapshot.transfers.map((row) => row.transferType));
			case "collection-plans":
				return buildOptions(
					snapshot.collectionPlanEntries.map((row) => row.source)
				);
			default:
				return [];
		}
	}, [search.tab, snapshot]);

	const mortgageOptions = useMemo(
		() =>
			Array.from(
				new Map(
					[
						...snapshot.obligations.map((row) => [
							row.mortgageId,
							row.mortgageLabel,
						]),
						...snapshot.collectionAttempts.map((row) => [
							row.mortgageId,
							row.mortgageLabel,
						]),
						...snapshot.collectionPlanEntries.map((row) => [
							row.mortgageId,
							row.mortgageLabel,
						]),
					].filter(
						(entry): entry is [string, string] =>
							Boolean(entry[0]) && Boolean(entry[1])
					)
				).entries()
			)
				.sort((left, right) => left[1].localeCompare(right[1], "en"))
				.map(([value, label]) => ({ label, value })),
		[
			snapshot.collectionAttempts,
			snapshot.collectionPlanEntries,
			snapshot.obligations,
		]
	);

	const borrowerOptions = useMemo(
		() =>
			Array.from(
				new Map(
					[
						...snapshot.obligations.map((row) => [
							row.borrowerId,
							row.borrowerLabel,
						]),
						...snapshot.collectionAttempts.map((row) => [
							row.borrowerId,
							row.borrowerLabel,
						]),
						...snapshot.collectionPlanEntries.map((row) => [
							row.borrowerId,
							row.borrowerLabel,
						]),
					].filter(
						(entry): entry is [string, string] =>
							Boolean(entry[0]) && Boolean(entry[1])
					)
				).entries()
			)
				.sort((left, right) => left[1].localeCompare(right[1], "en"))
				.map(([value, label]) => ({ label, value })),
		[
			snapshot.collectionAttempts,
			snapshot.collectionPlanEntries,
			snapshot.obligations,
		]
	);

	const lenderOptions = useMemo(
		() =>
			Array.from(
				new Map(
					snapshot.transfers
						.filter((row) => row.lenderId)
						.map((row) => [row.lenderId as string, row.counterpartyLabel])
				).entries()
			)
				.sort((left, right) => left[1].localeCompare(right[1], "en"))
				.map(([value, label]) => ({ label, value })),
		[snapshot.transfers]
	);

	const canWaiveObligationBalance = useAuthorization({
		kind: "permission",
		permission: "obligation:waive",
	}).allowed;
	const canWriteOffObligationBalance = useAuthorization({
		kind: "permission",
		permission: "cash_ledger:correct",
	}).allowed;
	const canManagePaymentOperations = useAuthorization({
		kind: "permission",
		permission: "payment:manage",
	}).allowed;
	const activeTabRecordLabel = getTabRecordLabel(search.tab);
	const activeTabAmountLabel = getTabAmountLabel(search.tab);

	const borrowerScheduleColumns: TableColumn<PaymentOperationBorrowerScheduleGroup>[] =
		[
			{
				header: "Borrower",
				id: "borrower",
				render: (row) => (
					<div className="max-w-[260px] space-y-1">
						<div className="font-medium">{row.borrowerLabel}</div>
						{row.borrowerEmail ? (
							<div className="truncate text-muted-foreground text-xs">
								{row.borrowerEmail}
							</div>
						) : null}
						<InlineCode value={row.borrowerId ?? row.id} />
					</div>
				),
				sortValue: (row) => row.borrowerLabel,
			},
			{
				align: "right",
				header: "Schedules",
				id: "mortgageCount",
				render: (row) => formatInteger(row.mortgageCount),
				sortValue: (row) => row.mortgageCount,
			},
			{
				align: "right",
				header: activeTabRecordLabel,
				id: "recordCount",
				render: (row) => formatInteger(row.recordCount),
				sortValue: (row) => row.recordCount,
			},
			{
				align: "right",
				header: activeTabAmountLabel,
				id: "amount",
				render: (row) => formatCurrencyCents(row.amount),
				sortValue: (row) => row.amount,
			},
			{
				header: "Status",
				id: "status",
				render: (row) => (
					<div className="flex flex-wrap gap-1">
						{summarizeStatusCounts(row.statusCounts)
							.slice(0, 3)
							.map(([status, count]) => (
								<StatusBadge
									key={status}
									label={`${humanizeLabel(status)} ${count}`}
								/>
							))}
						{row.exceptionCount > 0 ? (
							<StatusBadge
								label={`${formatInteger(row.exceptionCount)} exceptions`}
								variant="destructive"
							/>
						) : null}
					</div>
				),
				sortValue: (row) => buildStatusSortValue(row.statusCounts),
			},
		];

	const mortgageScheduleColumns: TableColumn<PaymentOperationMortgageScheduleGroup>[] =
		[
			{
				header: "Mortgage schedule",
				id: "mortgage",
				render: (row) => (
					<div className="max-w-[280px] space-y-1">
						<div className="font-medium">{row.mortgageLabel}</div>
						<InlineCode value={row.mortgageId ?? row.id} />
					</div>
				),
				sortValue: (row) => row.mortgageLabel,
			},
			{
				header: "Borrower",
				id: "borrower",
				render: (row) => row.borrowerLabel,
				sortValue: (row) => row.borrowerLabel,
			},
			{
				align: "right",
				header: activeTabRecordLabel,
				id: "recordCount",
				render: (row) => formatInteger(row.recordCount),
				sortValue: (row) => row.recordCount,
			},
			{
				header: "Next date",
				id: "nextDate",
				render: (row) => formatDateTime(row.nextDate),
				sortValue: (row) => row.nextDate,
			},
			{
				align: "right",
				header: activeTabAmountLabel,
				id: "amount",
				render: (row) => formatCurrencyCents(row.amount),
				sortValue: (row) => row.amount,
			},
			{
				header: "Status",
				id: "status",
				render: (row) => (
					<div className="flex flex-wrap gap-1">
						{summarizeStatusCounts(row.statusCounts)
							.slice(0, 3)
							.map(([status, count]) => (
								<StatusBadge
									key={status}
									label={`${humanizeLabel(status)} ${count}`}
								/>
							))}
						{row.executionModes.map((mode) => (
							<StatusBadge
								key={mode}
								label={humanizeLabel(mode)}
								variant="outline"
							/>
						))}
						{row.exceptionCount > 0 ? (
							<StatusBadge
								label={`${formatInteger(row.exceptionCount)} exceptions`}
								variant="destructive"
							/>
						) : null}
					</div>
				),
				sortValue: (row) =>
					`${buildStatusSortValue(row.statusCounts)}|${row.executionModes.join("|")}`,
			},
		];

	const obligationColumns: TableColumn<PaymentOperationsObligationRow>[] = [
		{
			header: "Status",
			id: "status",
			render: (row) => (
				<div className="space-y-1">
					<StatusBadge label={row.status} />
					<div className="flex flex-wrap gap-1">
						{row.isCorrective ? (
							<StatusBadge label="corrective" variant="outline" />
						) : null}
						{row.hasJournalDrift ? (
							<StatusBadge label="journal drift" variant="destructive" />
						) : null}
						{row.hasActiveCollection ? (
							<StatusBadge label="active collection" variant="secondary" />
						) : null}
					</div>
				</div>
			),
			sortValue: (row) =>
				[
					row.status,
					row.isCorrective ? "corrective" : "",
					row.hasJournalDrift ? "journal_drift" : "",
					row.hasActiveCollection ? "active_collection" : "",
				].join("|"),
		},
		{
			header: "Due date",
			id: "dueDate",
			render: (row) => formatDateOnly(row.dueDate),
			sortValue: (row) => row.dueDate,
		},
		{
			header: "Mortgage",
			id: "mortgage",
			render: (row) => (
				<LinkedRecordCode
					onOpen={openRecordReference}
					reference={{
						description: row.mortgageLabel,
						label: row.mortgageId,
						recordId: row.mortgageId,
						type: "mortgages",
					}}
				/>
			),
			sortValue: (row) => row.mortgageLabel,
		},
		{
			header: "Borrower",
			id: "borrower",
			render: (row) => (
				<LinkedRecordCode
					onOpen={openRecordReference}
					reference={{
						label: row.borrowerLabel,
						recordId: row.borrowerId,
						type: "borrowers",
					}}
				/>
			),
			sortValue: (row) => row.borrowerLabel,
		},
		{
			header: "Type",
			id: "type",
			render: (row) => humanizeLabel(row.type),
			sortValue: (row) => row.type,
		},
		{
			align: "right",
			header: "Amount",
			id: "amount",
			render: (row) => formatCurrencyCents(row.amount),
			sortValue: (row) => row.amount,
		},
		{
			align: "right",
			header: "Settled",
			id: "settled",
			render: (row) => formatCurrencyCents(row.amountSettled),
			sortValue: (row) => row.amountSettled,
		},
		{
			align: "right",
			header: "Journal outstanding",
			id: "journalOutstanding",
			render: (row) => formatCurrencyCents(row.journalOutstandingBalance),
			sortValue: (row) => row.journalOutstandingBalance,
		},
	];

	const collectionColumns: TableColumn<PaymentCollectionAttemptRow>[] = [
		{
			header: "Attempt status",
			id: "status",
			render: (row) => <StatusBadge label={row.status} />,
			sortValue: (row) => row.status,
		},
		{
			header: "Transfer",
			id: "transfer",
			render: (row) => {
				const reconciliationStatus = getCollectionReconciliationStatus(
					row.reconciliation
				);

				return (
					<div className="space-y-1">
						<div>
							{row.transfer
								? humanizeLabel(row.transfer.status)
								: "No transfer"}
						</div>
						<StatusBadge
							label={reconciliationStatus.label}
							variant={reconciliationStatus.variant}
						/>
					</div>
				);
			},
			sortValue: (row) =>
				`${row.transfer?.status ?? "no_transfer"}|${getCollectionReconciliationStatus(row.reconciliation).label}`,
		},
		{
			align: "right",
			header: "Amount",
			id: "amount",
			render: (row) => formatCurrencyCents(row.amount),
			sortValue: (row) => row.amount,
		},
		{
			header: "Method",
			id: "method",
			render: (row) => humanizeLabel(row.method),
			sortValue: (row) => row.method,
		},
		{
			header: "Mortgage",
			id: "mortgageId",
			render: (row) => (
				<LinkedRecordCode
					onOpen={openRecordReference}
					reference={{
						description: row.mortgageLabel,
						label: row.mortgageId,
						recordId: row.mortgageId,
						type: "mortgages",
					}}
				/>
			),
			sortValue: (row) => row.mortgageLabel,
		},
		{
			align: "right",
			header: "Obligations",
			id: "obligationCount",
			render: (row) => formatInteger(row.obligationIds.length),
			sortValue: (row) => row.obligationIds.length,
		},
		{
			header: "Initiated",
			id: "initiatedAt",
			render: (row) => formatDateTime(row.initiatedAt),
			sortValue: (row) => row.initiatedAt,
		},
		{
			header: "Provider ref",
			id: "providerRef",
			render: (row) => row.transfer?.providerRef ?? "—",
			sortValue: (row) => row.transfer?.providerRef,
		},
	];

	const transferColumns: TableColumn<PaymentOperationsTransferRow>[] = [
		{
			header: "Transfer status",
			id: "status",
			render: (row) => <StatusBadge label={row.status} />,
			sortValue: (row) => row.status,
		},
		{
			header: "Direction",
			id: "direction",
			render: (row) => humanizeLabel(row.direction),
			sortValue: (row) => row.direction,
		},
		{
			header: "Transfer type",
			id: "transferType",
			render: (row) => humanizeLabel(row.transferType),
			sortValue: (row) => row.transferType,
		},
		{
			align: "right",
			header: "Amount",
			id: "amount",
			render: (row) => formatCurrencyCents(row.amount),
			sortValue: (row) => row.amount,
		},
		{
			header: "Mortgage",
			id: "mortgage",
			render: (row) =>
				row.mortgageId ? (
					<LinkedRecordCode
						onOpen={openRecordReference}
						reference={{
							description: row.mortgageLabel,
							label: row.mortgageId,
							recordId: row.mortgageId,
							type: "mortgages",
						}}
					/>
				) : (
					"—"
				),
			sortValue: (row) => row.mortgageLabel,
		},
		{
			header: "Counterparty",
			id: "counterparty",
			render: (row) =>
				row.borrowerId ? (
					<LinkedRecordCode
						onOpen={openRecordReference}
						reference={{
							label: row.counterpartyLabel,
							recordId: row.borrowerId,
							type: "borrowers",
						}}
					/>
				) : (
					row.counterpartyLabel
				),
			sortValue: (row) => row.counterpartyLabel,
		},
		{
			header: "Provider ref",
			id: "providerRef",
			render: (row) => row.providerRef ?? "—",
			sortValue: (row) => row.providerRef,
		},
		{
			header: "Journal integrity",
			id: "journalIntegrity",
			render: (row) => (
				<StatusBadge
					label={row.journalIntegrity}
					variant={
						row.journalIntegrity === "linked" ? "default" : "destructive"
					}
				/>
			),
			sortValue: (row) => row.journalIntegrity,
		},
	];

	const collectionPlanColumns: TableColumn<PaymentCollectionPlanEntryRow>[] = [
		{
			header: "Status",
			id: "status",
			render: (row) => <StatusBadge label={row.status} />,
			sortValue: (row) => row.status,
		},
		{
			header: "Source",
			id: "source",
			render: (row) => humanizeLabel(row.source),
			sortValue: (row) => row.source,
		},
		{
			header: "Mortgage",
			id: "mortgage",
			render: (row) => (
				<LinkedRecordCode
					onOpen={openRecordReference}
					reference={{
						description: row.mortgageLabel,
						label: row.mortgageId,
						recordId: row.mortgageId,
						type: "mortgages",
					}}
				/>
			),
			sortValue: (row) => row.mortgageLabel,
		},
		{
			header: "Borrower",
			id: "borrower",
			render: (row) =>
				row.borrowerId ? (
					<LinkedRecordCode
						onOpen={openRecordReference}
						reference={{
							description: row.borrowerEmail,
							label: row.borrowerLabel,
							recordId: row.borrowerId,
							type: "borrowers",
						}}
					/>
				) : (
					"—"
				),
			sortValue: (row) => row.borrowerLabel,
		},
		{
			header: "Balance precheck",
			id: "balancePrecheck",
			render: (row) =>
				row.balancePreCheck.decision ? (
					<StatusBadge label={row.balancePreCheck.decision} />
				) : (
					"—"
				),
			sortValue: (row) => row.balancePreCheck.decision,
		},
		{
			header: "Scheduled date",
			id: "scheduledDate",
			render: (row) => formatDateTime(row.scheduledDate),
			sortValue: (row) => row.scheduledDate,
		},
		{
			align: "right",
			header: "Amount",
			id: "amount",
			render: (row) => formatCurrencyCents(row.amount),
			sortValue: (row) => row.amount,
		},
		{
			header: "Method",
			id: "method",
			render: (row) => humanizeLabel(row.method),
			sortValue: (row) => row.method,
		},
		{
			header: "Workout",
			id: "workout",
			render: (row) => row.workoutPlan?.name ?? "—",
			sortValue: (row) => row.workoutPlan?.name,
		},
		{
			header: "Related attempt",
			id: "relatedAttempt",
			render: (row) =>
				row.relatedAttempt ? (
					<LinkedRecordCode
						onOpen={openRecordReference}
						reference={{
							recordId: row.relatedAttempt.collectionAttemptId,
							type: "collectionAttempts",
						}}
					/>
				) : (
					"—"
				),
			sortValue: (row) => row.relatedAttempt?.collectionAttemptId,
		},
	];

	function updateSearch(patch: Partial<PaymentOperationsSearchState>) {
		setSearch((current) => ({ ...current, ...patch }));
	}

	function renderScheduleBreadcrumbs() {
		return (
			<div className="flex flex-wrap items-center gap-1 text-muted-foreground text-sm">
				<button
					className="rounded px-1.5 py-1 hover:bg-muted hover:text-foreground"
					onClick={() =>
						updateSearch({
							scheduleBorrowerId: undefined,
							scheduleMortgageId: undefined,
							selectedId: undefined,
						})
					}
					type="button"
				>
					Borrower schedules
				</button>
				{selectedBorrowerSchedule ? (
					<>
						<span>/</span>
						<button
							className="rounded px-1.5 py-1 hover:bg-muted hover:text-foreground"
							onClick={() =>
								updateSearch({
									scheduleBorrowerId: selectedBorrowerSchedule.id,
									scheduleMortgageId: undefined,
									selectedId: undefined,
								})
							}
							type="button"
						>
							{selectedBorrowerSchedule.borrowerLabel}
						</button>
					</>
				) : null}
				{selectedMortgageSchedule ? (
					<>
						<span>/</span>
						<span className="px-1.5 py-1 text-foreground">
							{selectedMortgageSchedule.mortgageLabel}
						</span>
					</>
				) : null}
			</div>
		);
	}

	function renderScheduleStatusSummary(statusCounts: Record<string, number>) {
		const entries = summarizeStatusCounts(statusCounts);
		if (entries.length === 0) {
			return "No records";
		}

		return (
			<div className="flex flex-wrap gap-1">
				{entries.slice(0, 5).map(([status, count]) => (
					<StatusBadge
						key={status}
						label={`${humanizeLabel(status)} ${count}`}
					/>
				))}
			</div>
		);
	}

	function renderScheduleSummaryDetail() {
		if (!activeScheduleBorrowerId) {
			const totalMortgageCount = borrowerScheduleGroups.reduce(
				(total, row) => total + row.mortgageCount,
				0
			);
			const totalRecordCount = borrowerScheduleGroups.reduce(
				(total, row) => total + row.recordCount,
				0
			);
			const totalAmount = borrowerScheduleGroups.reduce(
				(total, row) => total + row.amount,
				0
			);
			const totalExceptionCount = borrowerScheduleGroups.reduce(
				(total, row) => total + row.exceptionCount,
				0
			);

			return (
				<DetailRail
					description="Borrower-first operational schedules for the active payment operations tab."
					title="Borrower schedules"
				>
					<KeyValueList
						items={[
							{
								label: "Borrowers",
								value: formatInteger(borrowerScheduleGroups.length),
							},
							{
								label: "Mortgage schedules",
								value: formatInteger(totalMortgageCount),
							},
							{
								label: activeTabRecordLabel,
								value: formatInteger(totalRecordCount),
							},
							{
								label: activeTabAmountLabel,
								value: formatCurrencyCents(totalAmount),
							},
							{
								label: "Exceptions",
								value: formatInteger(totalExceptionCount),
							},
						]}
					/>
				</DetailRail>
			);
		}

		if (!selectedBorrowerSchedule) {
			return (
				<EmptyDetailState
					description="The selected borrower schedule is not present under the current filters."
					title="No borrower schedule selected"
				/>
			);
		}

		if (!activeScheduleMortgageId) {
			return (
				<DetailRail
					description="Mortgage schedules and operational records grouped under this borrower."
					title={`Borrower schedule ${selectedBorrowerSchedule.borrowerLabel}`}
				>
					{selectedBorrowerSchedule.borrowerId ? (
						<LinkedRecordCard
							icon={<UserRound className="size-4" />}
							onOpen={openRecordReference}
							reference={{
								description: selectedBorrowerSchedule.borrowerEmail,
								label: selectedBorrowerSchedule.borrowerLabel,
								recordId: selectedBorrowerSchedule.borrowerId,
								type: "borrowers",
							}}
						/>
					) : null}
					<KeyValueList
						items={[
							{
								label: "Mortgage schedules",
								value: formatInteger(selectedBorrowerSchedule.mortgageCount),
							},
							{
								label: activeTabRecordLabel,
								value: formatInteger(selectedBorrowerSchedule.recordCount),
							},
							{
								label: activeTabAmountLabel,
								value: formatCurrencyCents(selectedBorrowerSchedule.amount),
							},
							{
								label: "Exceptions",
								value: formatInteger(selectedBorrowerSchedule.exceptionCount),
							},
							{
								label: "Status summary",
								value: renderScheduleStatusSummary(
									selectedBorrowerSchedule.statusCounts
								),
							},
						]}
					/>
				</DetailRail>
			);
		}

		if (!selectedMortgageSchedule) {
			return (
				<EmptyDetailState
					description="The selected mortgage schedule is not present under the current filters."
					title="No mortgage schedule selected"
				/>
			);
		}

		return (
			<DetailRail
				description="Operational records for this mortgage-level collection schedule."
				title={`Mortgage schedule ${selectedMortgageSchedule.mortgageLabel}`}
			>
				{canManagePaymentOperations && selectedMortgageSchedule.mortgageId ? (
					<ActionButtonRow>
						<Button
							onClick={() =>
								setReplacementMortgageId(
									selectedMortgageSchedule.mortgageId as Id<"mortgages">
								)
							}
							type="button"
							variant="outline"
						>
							Replace schedule
						</Button>
					</ActionButtonRow>
				) : null}
				<KeyValueList
					items={[
						{
							label: "Mortgage",
							value: selectedMortgageSchedule.mortgageId ? (
								<LinkedRecordCode
									onOpen={openRecordReference}
									reference={{
										description: selectedMortgageSchedule.mortgageLabel,
										label: selectedMortgageSchedule.mortgageId,
										recordId: selectedMortgageSchedule.mortgageId,
										type: "mortgages",
									}}
								/>
							) : (
								selectedMortgageSchedule.mortgageLabel
							),
						},
						{
							label: "Borrower",
							value: selectedMortgageSchedule.borrowerId ? (
								<LinkedRecordCode
									onOpen={openRecordReference}
									reference={{
										description: selectedMortgageSchedule.borrowerEmail,
										label: selectedMortgageSchedule.borrowerLabel,
										recordId: selectedMortgageSchedule.borrowerId,
										type: "borrowers",
									}}
								/>
							) : (
								selectedMortgageSchedule.borrowerLabel
							),
						},
						{
							label: activeTabRecordLabel,
							value: formatInteger(selectedMortgageSchedule.recordCount),
						},
						{
							label: "Next date",
							value: formatDateTime(selectedMortgageSchedule.nextDate),
						},
						{
							label: activeTabAmountLabel,
							value: formatCurrencyCents(selectedMortgageSchedule.amount),
						},
						{
							label: "Exceptions",
							value: formatInteger(selectedMortgageSchedule.exceptionCount),
						},
						{
							label: "Status summary",
							value: renderScheduleStatusSummary(
								selectedMortgageSchedule.statusCounts
							),
						},
					]}
				/>
			</DetailRail>
		);
	}

	function renderObligationDetail() {
		if (!selectedObligation) {
			return (
				<EmptyDetailState
					description="Select an obligation row to inspect debt truth, journal balance, and quick operator actions."
					title="No obligation selected"
				/>
			);
		}

		return (
			<DetailRail
				actions={
					<ActionButtonRow>
						{canWaiveObligationBalance ? (
							<WaiveBalanceDialog
								defaultAmountCents={
									selectedObligation.journalOutstandingBalance
								}
								obligationId={
									selectedObligation.obligationId as Id<"obligations">
								}
							/>
						) : null}
						{canWriteOffObligationBalance ? (
							<WriteOffBalanceDialog
								defaultAmountCents={
									selectedObligation.journalOutstandingBalance
								}
								obligationId={
									selectedObligation.obligationId as Id<"obligations">
								}
							/>
						) : null}
						<Button asChild size="sm" variant="outline">
							<Link
								params={{ recordid: selectedObligation.mortgageId }}
								search={(current) => buildAdminDetailLinkSearch(current)}
								to="/admin/mortgages/$recordid"
							>
								<Landmark className="size-4" />
								View mortgage
							</Link>
						</Button>
					</ActionButtonRow>
				}
				description="Debt truth stays separate from collection strategy and transfer execution."
				title={`Obligation ${selectedObligation.paymentNumber}`}
			>
				<KeyValueList
					items={[
						{
							label: "Obligation ID",
							value: <InlineCode value={selectedObligation.obligationId} />,
						},
						{ label: "Mortgage", value: selectedObligation.mortgageLabel },
						{ label: "Borrower", value: selectedObligation.borrowerLabel },
						{
							label: "Status",
							value: <StatusBadge label={selectedObligation.status} />,
						},
						{ label: "Type", value: humanizeLabel(selectedObligation.type) },
						{
							label: "Due date",
							value: formatDateOnly(selectedObligation.dueDate),
						},
						{
							label: "Grace period end",
							value: formatDateOnly(selectedObligation.gracePeriodEnd),
						},
						{
							label: "Amount",
							value: formatCurrencyCents(selectedObligation.amount),
						},
						{
							label: "Amount settled",
							value: formatCurrencyCents(selectedObligation.amountSettled),
						},
						{
							label: "Journal outstanding",
							value: formatCurrencyCents(
								selectedObligation.journalOutstandingBalance
							),
						},
						{
							label: "Projected outstanding",
							value: formatCurrencyCents(
								selectedObligation.projectedOutstandingBalance
							),
						},
						{
							label: "Corrective chain",
							value:
								selectedObligation.correctiveCount > 0
									? `${selectedObligation.correctiveCount} downstream corrective obligations`
									: "No corrective chain",
						},
					]}
				/>
				<div className="space-y-2">
					<div className="text-muted-foreground text-xs uppercase tracking-[0.12em]">
						Quick links
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							onClick={() =>
								setSearch((current) => ({
									...current,
									search: selectedObligation.obligationId,
									selectedId:
										selectedObligation.latestCollectionAttemptId ?? undefined,
									status: undefined,
									type: undefined,
									tab: "collections",
								}))
							}
							size="sm"
							variant="outline"
						>
							Open collections
						</Button>
						<Button asChild size="sm" variant="outline">
							<Link
								search={(current) =>
									buildFinancialLedgerLinkSearch(current, {
										search: selectedObligation.obligationId,
										selectedCheck: undefined,
										selectedId: undefined,
										tab: "cash-ledger",
									})
								}
								to="/admin/financial-ledger"
							>
								Open in financial ledger
							</Link>
						</Button>
					</div>
				</div>
			</DetailRail>
		);
	}

	function renderCollectionDetail() {
		if (!selectedCollection) {
			return (
				<EmptyDetailState
					description="Select an attempt to inspect provider execution, linked transfer state, and reconciliation health."
					title="No collection attempt selected"
				/>
			);
		}

		return (
			<DetailRail
				description="Execution attempts are separate from the collection plan entries that created them."
				title={`Attempt ${selectedCollection.collectionAttemptId}`}
			>
				{selectedCollection.borrowerId ? (
					<LinkedRecordCard
						icon={<UserRound className="size-4" />}
						onOpen={openRecordReference}
						reference={{
							description:
								selectedCollection.borrowerEmail ?? "No email on borrower user",
							label: selectedCollection.borrowerLabel ?? "Borrower",
							recordId: selectedCollection.borrowerId,
							type: "borrowers",
						}}
					/>
				) : null}
				<KeyValueList
					items={[
						{
							label: "Attempt ID",
							value: (
								<LinkedRecordCode
									onOpen={openRecordReference}
									reference={{
										recordId: selectedCollection.collectionAttemptId,
										type: "collectionAttempts",
									}}
								/>
							),
						},
						{
							label: "Status",
							value: <StatusBadge label={selectedCollection.status} />,
						},
						{
							label: "Amount",
							value: formatCurrencyCents(selectedCollection.amount),
						},
						{
							label: "Method",
							value: humanizeLabel(selectedCollection.method),
						},
						{
							label: "Plan entry",
							value: (
								<LinkedRecordCode
									onOpen={openRecordReference}
									reference={{
										recordId: selectedCollection.planEntryId,
										type: "collectionPlanEntries",
									}}
								/>
							),
						},
						{
							label: "Mortgage",
							value: (
								<LinkedRecordCode
									onOpen={openRecordReference}
									reference={{
										description: selectedCollection.mortgageLabel,
										label: selectedCollection.mortgageId,
										recordId: selectedCollection.mortgageId,
										type: "mortgages",
									}}
								/>
							),
						},
						{
							label: "Obligations",
							value:
								selectedCollection.obligationIds.length > 0 ? (
									<div className="flex flex-wrap gap-1.5">
										{selectedCollection.obligationIds.map((obligationId) => (
											<LinkedRecordCode
												key={obligationId}
												onOpen={openRecordReference}
												reference={{
													recordId: obligationId,
													type: "obligations",
												}}
											/>
										))}
									</div>
								) : (
									"—"
								),
						},
						{
							label: "Trigger source",
							value: selectedCollection.triggerSource
								? humanizeLabel(selectedCollection.triggerSource)
								: "—",
						},
						{
							label: "Reconciliation",
							value: (
								<StatusBadge
									label={
										getCollectionReconciliationStatus(
											selectedCollection.reconciliation
										).label
									}
									variant={
										getCollectionReconciliationStatus(
											selectedCollection.reconciliation
										).variant
									}
								/>
							),
						},
						{
							label: "Provider ref",
							value: selectedCollection.transfer?.providerRef ?? "—",
						},
						{
							label: "Transfer request",
							value: selectedCollection.transfer ? (
								<LinkedRecordCode
									onOpen={openRecordReference}
									reference={{
										recordId: selectedCollection.transfer.transferId,
										type: "transferRequests",
									}}
								/>
							) : (
								"—"
							),
						},
						{
							label: "Initiated",
							value: formatDateTime(selectedCollection.initiatedAt),
						},
						{
							label: "Confirmed",
							value: formatDateTime(selectedCollection.confirmedAt),
						},
						{
							label: "Failed",
							value: formatDateTime(selectedCollection.failedAt),
						},
					]}
				/>
			</DetailRail>
		);
	}

	function renderTransferDetail() {
		if (!selectedTransfer) {
			return (
				<EmptyDetailState
					description="Select a transfer row to inspect provider refs, journal linkage, and downstream context."
					title="No transfer selected"
				/>
			);
		}

		return (
			<DetailRail
				description="Transfers are the provider-facing execution truth with drill-through to ledger evidence."
				title={`Transfer ${selectedTransfer.transferId}`}
			>
				<KeyValueList
					items={[
						{
							label: "Transfer ID",
							value: (
								<LinkedRecordCode
									onOpen={openRecordReference}
									reference={{
										recordId: selectedTransfer.transferId,
										type: "transferRequests",
									}}
								/>
							),
						},
						{
							label: "Status",
							value: <StatusBadge label={selectedTransfer.status} />,
						},
						{
							label: "Direction",
							value: humanizeLabel(selectedTransfer.direction),
						},
						{
							label: "Transfer type",
							value: humanizeLabel(selectedTransfer.transferType),
						},
						{
							label: "Counterparty",
							value: selectedTransfer.borrowerId ? (
								<LinkedRecordCode
									onOpen={openRecordReference}
									reference={{
										label: selectedTransfer.counterpartyLabel,
										recordId: selectedTransfer.borrowerId,
										type: "borrowers",
									}}
								/>
							) : (
								selectedTransfer.counterpartyLabel
							),
						},
						{ label: "Provider code", value: selectedTransfer.providerCode },
						{
							label: "Provider ref",
							value: selectedTransfer.providerRef ?? "—",
						},
						{
							label: "Amount",
							value: formatCurrencyCents(selectedTransfer.amount),
						},
						{
							label: "Journal integrity",
							value: (
								<StatusBadge
									label={selectedTransfer.journalIntegrity}
									variant={
										selectedTransfer.journalIntegrity === "linked"
											? "default"
											: "destructive"
									}
								/>
							),
						},
						{
							label: "Created",
							value: formatDateTime(selectedTransfer.createdAt),
						},
						{
							label: "Confirmed",
							value: formatDateTime(selectedTransfer.confirmedAt),
						},
						{
							label: "Reversed",
							value: formatDateTime(selectedTransfer.reversedAt),
						},
					]}
				/>
				<ActionButtonRow>
					<Button asChild size="sm" variant="outline">
						<Link
							search={(current) =>
								buildFinancialLedgerLinkSearch(current, {
									selectedCheck: undefined,
									selectedId: undefined,
									tab: "cash-ledger",
									type: selectedTransfer.transferType,
								})
							}
							to="/admin/financial-ledger"
						>
							Open in financial ledger
						</Link>
					</Button>
					{selectedTransfer.mortgageId ? (
						<Button
							onClick={() =>
								openRecordReference({
									description: selectedTransfer.mortgageLabel,
									label: selectedTransfer.mortgageLabel,
									recordId: selectedTransfer.mortgageId as string,
									type: "mortgages",
								})
							}
							size="sm"
							variant="outline"
						>
							Open mortgage
						</Button>
					) : null}
				</ActionButtonRow>
			</DetailRail>
		);
	}

	function renderCollectionPlanDetail() {
		if (!selectedCollectionPlan) {
			return (
				<EmptyDetailState
					description="Select a strategy row to inspect balance precheck facts, lineage, and execute/reschedule actions."
					title="No collection plan selected"
				/>
			);
		}

		const now = Date.now();
		const manualExecutionBlockReason = getManualExecutionBlockReason(
			selectedCollectionPlan,
			now
		);
		const rescheduleBlockReason = getRescheduleBlockReason(
			selectedCollectionPlan,
			now
		);
		const blockedActionReasons = [
			manualExecutionBlockReason
				? `Execute: ${manualExecutionBlockReason}`
				: null,
			rescheduleBlockReason ? `Reschedule: ${rescheduleBlockReason}` : null,
		].filter((reason): reason is string => Boolean(reason));
		const hasAvailableActions =
			canManagePaymentOperations &&
			!(manualExecutionBlockReason && rescheduleBlockReason);

		return (
			<DetailRail
				actions={
					hasAvailableActions ? (
						<ActionButtonRow>
							{manualExecutionBlockReason ? null : (
								<ExecutePlanEntryDialog
									planEntryId={
										selectedCollectionPlan.planEntryId as Id<"collectionPlanEntries">
									}
									triggerLabel="Manual execute"
								/>
							)}
							{rescheduleBlockReason ? null : (
								<ReschedulePlanEntryDialog
									planEntryId={
										selectedCollectionPlan.planEntryId as Id<"collectionPlanEntries">
									}
									scheduledDate={selectedCollectionPlan.scheduledDate}
								/>
							)}
						</ActionButtonRow>
					) : undefined
				}
				description="Collection strategy stays distinct from attempts and from cash-ledger truth."
				title={`Plan entry ${selectedCollectionPlan.planEntryId}`}
			>
				{selectedCollectionPlan.borrowerId ? (
					<LinkedRecordCard
						icon={<UserRound className="size-4" />}
						onOpen={openRecordReference}
						reference={{
							description:
								selectedCollectionPlan.borrowerEmail ??
								"No email on borrower user",
							label: selectedCollectionPlan.borrowerLabel ?? "Borrower",
							recordId: selectedCollectionPlan.borrowerId,
							type: "borrowers",
						}}
					/>
				) : null}
				<KeyValueList
					items={[
						{
							label: "Plan entry ID",
							value: (
								<LinkedRecordCode
									onOpen={openRecordReference}
									reference={{
										recordId: selectedCollectionPlan.planEntryId,
										type: "collectionPlanEntries",
									}}
								/>
							),
						},
						{
							label: "Status",
							value: <StatusBadge label={selectedCollectionPlan.status} />,
						},
						{
							label: "Borrower",
							value: selectedCollectionPlan.borrowerId ? (
								<LinkedRecordCode
									onOpen={openRecordReference}
									reference={{
										description: selectedCollectionPlan.borrowerEmail,
										label: selectedCollectionPlan.borrowerLabel,
										recordId: selectedCollectionPlan.borrowerId,
										type: "borrowers",
									}}
								/>
							) : (
								"—"
							),
						},
						{
							label: "Mortgage",
							value: (
								<LinkedRecordCode
									onOpen={openRecordReference}
									reference={{
										description: selectedCollectionPlan.mortgageLabel,
										label: selectedCollectionPlan.mortgageId,
										recordId: selectedCollectionPlan.mortgageId,
										type: "mortgages",
									}}
								/>
							),
						},
						{
							label: "Obligations",
							value:
								selectedCollectionPlan.obligationIds.length > 0 ? (
									<div className="flex flex-wrap gap-1.5">
										{selectedCollectionPlan.obligationIds.map(
											(obligationId) => (
												<LinkedRecordCode
													key={obligationId}
													onOpen={openRecordReference}
													reference={{
														recordId: obligationId,
														type: "obligations",
													}}
												/>
											)
										)}
									</div>
								) : (
									"—"
								),
						},
						{
							label: "Execution mode",
							value: humanizeLabel(
								selectedCollectionPlan.executionMode ?? "app_owned"
							),
						},
						{
							label: "Source",
							value: humanizeLabel(selectedCollectionPlan.source),
						},
						{
							label: "Method",
							value: humanizeLabel(selectedCollectionPlan.method),
						},
						{
							label: "Amount",
							value: formatCurrencyCents(selectedCollectionPlan.amount),
						},
						{
							label: "Scheduled date",
							value: formatDateTime(selectedCollectionPlan.scheduledDate),
						},
						{
							label: "Balance precheck",
							value: selectedCollectionPlan.balancePreCheck.decision
								? humanizeLabel(selectedCollectionPlan.balancePreCheck.decision)
								: "Not evaluated",
						},
						{
							label: "Reason detail",
							value: selectedCollectionPlan.balancePreCheck.reasonDetail ?? "—",
						},
						{
							label: "Workout plan",
							value: selectedCollectionPlan.workoutPlan?.name ?? "—",
						},
						{
							label: "Retry lineage",
							value: selectedCollectionPlan.lineage.retryOfId ? (
								<LinkedRecordCode
									onOpen={openRecordReference}
									reference={{
										recordId: selectedCollectionPlan.lineage.retryOfId,
										type: "collectionPlanEntries",
									}}
								/>
							) : (
								"—"
							),
						},
						{
							label: "Rescheduled from",
							value: selectedCollectionPlan.lineage.rescheduledFromId ? (
								<LinkedRecordCode
									onOpen={openRecordReference}
									reference={{
										recordId: selectedCollectionPlan.lineage.rescheduledFromId,
										type: "collectionPlanEntries",
									}}
								/>
							) : (
								"—"
							),
						},
						{
							label: "Created by rule",
							value:
								selectedCollectionPlan.createdByRule?.displayName ??
								"Manual / inherited",
						},
					]}
				/>
				{blockedActionReasons.length > 0 ? (
					<div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-muted-foreground text-sm">
						{blockedActionReasons.join(" ")}
					</div>
				) : null}
			</DetailRail>
		);
	}

	let tableSection: ReactNode = null;
	let detailSection: ReactNode = null;
	const scheduleBreadcrumbs = renderScheduleBreadcrumbs();

	if (!activeScheduleBorrowerId) {
		tableSection = (
			<SectionCard
				action={scheduleBreadcrumbs}
				description={`${TAB_LABELS[search.tab]} grouped by borrower before mortgage schedule drill-down.`}
				title={`Borrower schedules (${borrowerScheduleGroups.length})`}
			>
				<DataTableCard
					columns={borrowerScheduleColumns}
					emptyMessage="No borrower schedules match the current filters."
					onRowSelect={(row) =>
						updateSearch({
							scheduleBorrowerId: row.id,
							scheduleMortgageId: undefined,
							selectedId: undefined,
						})
					}
					rowKey={(row) => row.id}
					rows={borrowerScheduleGroups}
				/>
			</SectionCard>
		);
		detailSection = renderScheduleSummaryDetail();
	} else if (activeScheduleMortgageId) {
		if (search.tab === "obligations") {
			tableSection = (
				<SectionCard
					action={scheduleBreadcrumbs}
					description="Debt truth, settlement state, and journal alignment."
					title={`Obligations (${scheduleScopedObligations.length})`}
				>
					<DataTableCard
						columns={obligationColumns}
						emptyMessage="No obligations match the current schedule and filters."
						onRowSelect={(row) =>
							updateSearch({ selectedId: row.obligationId })
						}
						rowKey={(row) => row.obligationId}
						rows={scheduleScopedObligations}
						selectedRowId={selectedObligation?.obligationId}
					/>
				</SectionCard>
			);
			detailSection = selectedObligation
				? renderObligationDetail()
				: renderScheduleSummaryDetail();
		} else if (search.tab === "collections") {
			tableSection = (
				<SectionCard
					action={scheduleBreadcrumbs}
					description="Execution attempts, provider state, and transfer reconciliation."
					title={`Collections (${scheduleScopedCollections.length})`}
				>
					<DataTableCard
						columns={collectionColumns}
						emptyMessage="No collection attempts match the current schedule and filters."
						onRowSelect={(row) =>
							updateSearch({ selectedId: row.collectionAttemptId })
						}
						rowKey={(row) => row.collectionAttemptId}
						rows={scheduleScopedCollections}
						selectedRowId={selectedCollection?.collectionAttemptId}
					/>
				</SectionCard>
			);
			detailSection = selectedCollection
				? renderCollectionDetail()
				: renderScheduleSummaryDetail();
		} else if (search.tab === "transfers") {
			tableSection = (
				<SectionCard
					action={scheduleBreadcrumbs}
					description="Provider-facing transfer truth and ledger linkage."
					title={`Transfers (${scheduleScopedTransfers.length})`}
				>
					<DataTableCard
						columns={transferColumns}
						emptyMessage="No transfers match the current schedule and filters."
						onRowSelect={(row) => updateSearch({ selectedId: row.transferId })}
						rowKey={(row) => row.transferId}
						rows={scheduleScopedTransfers}
						selectedRowId={selectedTransfer?.transferId}
					/>
				</SectionCard>
			);
			detailSection = selectedTransfer
				? renderTransferDetail()
				: renderScheduleSummaryDetail();
		} else {
			tableSection = (
				<SectionCard
					action={scheduleBreadcrumbs}
					description="Collection strategy, balance prechecks, and workout lineage."
					title={`Collection plans (${scheduleScopedCollectionPlans.length})`}
				>
					<DataTableCard
						columns={collectionPlanColumns}
						emptyMessage="No collection plan entries match the current schedule and filters."
						onRowSelect={(row) => updateSearch({ selectedId: row.planEntryId })}
						rowKey={(row) => row.planEntryId}
						rows={scheduleScopedCollectionPlans}
						selectedRowId={selectedCollectionPlan?.planEntryId}
					/>
				</SectionCard>
			);
			detailSection = selectedCollectionPlan
				? renderCollectionPlanDetail()
				: renderScheduleSummaryDetail();
		}
	} else {
		tableSection = (
			<SectionCard
				action={scheduleBreadcrumbs}
				description={`${TAB_LABELS[search.tab]} grouped into mortgage-level collection schedules for the selected borrower.`}
				title={`Mortgage schedules (${selectedBorrowerSchedule?.mortgageCount ?? 0})`}
			>
				<DataTableCard
					columns={mortgageScheduleColumns}
					emptyMessage="No mortgage schedules match the current filters."
					onRowSelect={(row) =>
						updateSearch({
							scheduleMortgageId: row.id,
							selectedId: undefined,
						})
					}
					rowKey={(row) => row.id}
					rows={selectedBorrowerSchedule?.mortgages ?? []}
				/>
			</SectionCard>
		);
		detailSection = renderScheduleSummaryDetail();
	}

	return (
		<div
			className="-m-4 min-h-[calc(100svh-4rem)] px-4 py-6 md:-m-6 md:px-6"
			style={{
				background:
					"radial-gradient(ellipse 75% 48% at 74% 0%, color-mix(in oklab, var(--hero-b) 42%, transparent), transparent 70%), radial-gradient(ellipse 70% 42% at 20% 8%, color-mix(in oklab, var(--hero-a) 28%, transparent), transparent 72%), linear-gradient(180deg, var(--foam) 0%, var(--bg-base) 100%)",
			}}
		>
			<div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
				<PageHeader
					actions={
						<>
							<Button
								onClick={() =>
									exportTabCsv({
										collectionAttempts: filteredCollections,
										collectionPlanEntries: filteredCollectionPlans,
										obligations: filteredObligations,
										tab: search.tab,
										transfers: filteredTransfers,
									})
								}
								size="sm"
								variant="outline"
							>
								<Download className="size-4" />
								Export
							</Button>
							<Button asChild size="sm" variant="outline">
								<Link
									search={(current) =>
										buildFinancialLedgerLinkSearch(current, {
											selectedCheck: undefined,
											selectedId: undefined,
											tab: "reconciliation",
										})
									}
									to="/admin/financial-ledger"
								>
									<ExternalLink className="size-4" />
									Open Financial Ledger
								</Link>
							</Button>
							<Button
								onClick={() => void onRefresh()}
								size="sm"
								variant="outline"
							>
								<RefreshCw className="size-4" />
								Refresh
							</Button>
						</>
					}
					description="Borrower debt, collection strategy, execution attempts, and transfer state. This page stays operational, while the cash ledger remains the money source of truth."
					eyebrow={
						<StatusBadge
							label={`As of ${formatDateTime(snapshot.generatedAt)}`}
							variant="outline"
						/>
					}
					title="Payment Operations"
				/>

				<MetricStrip items={metricItems} />

				<div className="flex flex-wrap gap-2">
					{(Object.entries(TAB_LABELS) as [PaymentOperationsTab, string][]).map(
						([tab, label]) =>
							renderTabButton({
								currentTab: search.tab,
								label,
								onSelect: () =>
									setSearch((current) => ({
										...current,
										metricFilter: undefined,
										scheduleBorrowerId: undefined,
										scheduleMortgageId: undefined,
										selectedId: undefined,
										status: undefined,
										tab,
										type: undefined,
									})),
								tab,
							})
					)}
				</div>

				<FilterBar>
					<FilterField label="Search">
						<FilterTextInput
							onChange={(event) =>
								updateSearch({
									metricFilter: undefined,
									scheduleBorrowerId: undefined,
									scheduleMortgageId: undefined,
									search: event.target.value || undefined,
									selectedId: undefined,
								})
							}
							placeholder="Search IDs, mortgage labels, provider refs"
							value={search.search ?? ""}
						/>
					</FilterField>
					<FilterField label="Status">
						<FilterSelect
							onValueChange={(value) =>
								updateSearch({
									metricFilter: undefined,
									scheduleBorrowerId: undefined,
									scheduleMortgageId: undefined,
									selectedId: undefined,
									status: value === "__all__" ? undefined : value,
								})
							}
							options={[
								{ label: "All statuses", value: "__all__" },
								...currentStatusOptions,
							]}
							placeholder="All statuses"
							value={search.status ?? "__all__"}
						/>
					</FilterField>
					<FilterField label="Type">
						<FilterSelect
							onValueChange={(value) =>
								updateSearch({
									metricFilter: undefined,
									scheduleBorrowerId: undefined,
									scheduleMortgageId: undefined,
									selectedId: undefined,
									type: value === "__all__" ? undefined : value,
								})
							}
							options={[
								{ label: "All types", value: "__all__" },
								...currentTypeOptions,
							]}
							placeholder="All types"
							value={search.type ?? "__all__"}
						/>
					</FilterField>
					<FilterField label="Mortgage">
						<FilterSelect
							onValueChange={(value) =>
								updateSearch({
									metricFilter: undefined,
									mortgageId: value === "__all__" ? undefined : value,
									scheduleBorrowerId: undefined,
									scheduleMortgageId: undefined,
									selectedId: undefined,
								})
							}
							options={[
								{ label: "All mortgages", value: "__all__" },
								...mortgageOptions,
							]}
							placeholder="All mortgages"
							value={search.mortgageId ?? "__all__"}
						/>
					</FilterField>
					<FilterField label="Borrower">
						<FilterSelect
							onValueChange={(value) =>
								updateSearch({
									borrowerId: value === "__all__" ? undefined : value,
									metricFilter: undefined,
									scheduleBorrowerId: undefined,
									scheduleMortgageId: undefined,
									selectedId: undefined,
								})
							}
							options={[
								{ label: "All borrowers", value: "__all__" },
								...borrowerOptions,
							]}
							placeholder="All borrowers"
							value={search.borrowerId ?? "__all__"}
						/>
					</FilterField>
					<FilterField label="Lender">
						<FilterSelect
							onValueChange={(value) =>
								updateSearch({
									lenderId: value === "__all__" ? undefined : value,
									metricFilter: undefined,
									scheduleBorrowerId: undefined,
									scheduleMortgageId: undefined,
									selectedId: undefined,
								})
							}
							options={[
								{ label: "All lenders", value: "__all__" },
								...lenderOptions,
							]}
							placeholder="All lenders"
							value={search.lenderId ?? "__all__"}
						/>
					</FilterField>
					<FilterField label="From">
						<FilterDateInput
							onChange={(event) =>
								updateSearch({
									dateFrom: event.target.value || undefined,
									metricFilter: undefined,
									scheduleBorrowerId: undefined,
									scheduleMortgageId: undefined,
									selectedId: undefined,
								})
							}
							value={search.dateFrom ?? ""}
						/>
					</FilterField>
					<FilterField label="To">
						<FilterDateInput
							onChange={(event) =>
								updateSearch({
									dateTo: event.target.value || undefined,
									metricFilter: undefined,
									scheduleBorrowerId: undefined,
									scheduleMortgageId: undefined,
									selectedId: undefined,
								})
							}
							value={search.dateTo ?? ""}
						/>
					</FilterField>
					<FilterSwitch
						checked={search.showOnlyExceptions}
						label="Show only action-needed rows"
						onCheckedChange={(checked) =>
							updateSearch({
								metricFilter: undefined,
								scheduleBorrowerId: undefined,
								scheduleMortgageId: undefined,
								selectedId: undefined,
								showOnlyExceptions: checked,
							})
						}
					/>
				</FilterBar>

				<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
					<div>{tableSection}</div>
					<div>{detailSection}</div>
				</div>
				<ScheduleReplacementDialog
					mortgageId={replacementMortgageId}
					onOpenChange={(open) => {
						if (!open) {
							setReplacementMortgageId(null);
						}
					}}
					open={replacementMortgageId !== null}
				/>
			</div>
		</div>
	);
}
