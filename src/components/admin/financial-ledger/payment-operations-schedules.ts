import type {
	PaymentCollectionAttemptRow,
	PaymentCollectionPlanEntryRow,
	PaymentOperationsObligationRow,
	PaymentOperationsSnapshot,
	PaymentOperationsTab,
	PaymentOperationsTransferRow,
} from "./types";

export const UNASSIGNED_BORROWER_SCHEDULE_ID = "__unassigned_borrower__";
export const UNASSIGNED_MORTGAGE_SCHEDULE_ID = "__unassigned_mortgage__";

export interface PaymentOperationScheduleRecord {
	amount: number;
	borrowerEmail: string | null;
	borrowerId: string | null;
	borrowerLabel: string;
	date: number | null;
	executionMode: string | null;
	hasException: boolean;
	mortgageId: string | null;
	mortgageLabel: string;
	recordId: string;
	status: string;
	tab: PaymentOperationsTab;
}

export interface PaymentOperationMortgageScheduleGroup {
	amount: number;
	borrowerEmail: string | null;
	borrowerId: string | null;
	borrowerLabel: string;
	exceptionCount: number;
	executionModes: string[];
	id: string;
	mortgageId: string | null;
	mortgageLabel: string;
	nextDate: number | null;
	recordCount: number;
	records: PaymentOperationScheduleRecord[];
	statusCounts: Record<string, number>;
}

export interface PaymentOperationBorrowerScheduleGroup {
	amount: number;
	borrowerEmail: string | null;
	borrowerId: string | null;
	borrowerLabel: string;
	exceptionCount: number;
	id: string;
	mortgageCount: number;
	mortgages: PaymentOperationMortgageScheduleGroup[];
	recordCount: number;
	records: PaymentOperationScheduleRecord[];
	statusCounts: Record<string, number>;
}

function scheduleBorrowerId(borrowerId: string | null | undefined) {
	return borrowerId ?? UNASSIGNED_BORROWER_SCHEDULE_ID;
}

function scheduleMortgageId(mortgageId: string | null | undefined) {
	return mortgageId ?? UNASSIGNED_MORTGAGE_SCHEDULE_ID;
}

function borrowerLabel(value: string | null | undefined) {
	return value ?? "Unassigned borrower";
}

function mortgageLabel(value: string | null | undefined) {
	return value ?? "Unassigned mortgage";
}

function compareNullableDate(left: number | null, right: number | null) {
	if (left === null && right === null) {
		return 0;
	}
	if (left === null) {
		return 1;
	}
	if (right === null) {
		return -1;
	}
	return left - right;
}

function addStatus(counts: Record<string, number>, status: string) {
	counts[status] = (counts[status] ?? 0) + 1;
}

function isCollectionAttemptException(row: PaymentCollectionAttemptRow) {
	return row.reconciliation?.isHealthy === false;
}

function isCollectionPlanException(row: PaymentCollectionPlanEntryRow) {
	return Boolean(row.balancePreCheck.decision || row.workoutPlan);
}

function isObligationException(row: PaymentOperationsObligationRow) {
	return row.hasJournalDrift || row.isCorrective || row.hasActiveCollection;
}

function isTransferException(row: PaymentOperationsTransferRow) {
	return row.journalIntegrity !== "linked";
}

export function getScheduleBorrowerId(borrowerId: string | null | undefined) {
	return scheduleBorrowerId(borrowerId);
}

export function getScheduleMortgageId(mortgageId: string | null | undefined) {
	return scheduleMortgageId(mortgageId);
}

export function getPaymentOperationScheduleRecords(
	snapshot: PaymentOperationsSnapshot,
	tab: PaymentOperationsTab
): PaymentOperationScheduleRecord[] {
	switch (tab) {
		case "collections":
			return snapshot.collectionAttempts.map((row) => ({
				amount: row.amount,
				borrowerEmail: row.borrowerEmail,
				borrowerId: row.borrowerId,
				borrowerLabel: borrowerLabel(row.borrowerLabel),
				date: row.initiatedAt,
				executionMode: null,
				hasException: isCollectionAttemptException(row),
				mortgageId: row.mortgageId,
				mortgageLabel: mortgageLabel(row.mortgageLabel),
				recordId: row.collectionAttemptId,
				status: row.status,
				tab,
			}));
		case "collection-plans":
			return snapshot.collectionPlanEntries.map((row) => ({
				amount: row.amount,
				borrowerEmail: row.borrowerEmail,
				borrowerId: row.borrowerId,
				borrowerLabel: borrowerLabel(row.borrowerLabel),
				date: row.scheduledDate,
				executionMode: row.executionMode ?? "app_owned",
				hasException: isCollectionPlanException(row),
				mortgageId: row.mortgageId,
				mortgageLabel: mortgageLabel(row.mortgageLabel),
				recordId: row.planEntryId,
				status: row.status,
				tab,
			}));
		case "obligations":
			return snapshot.obligations.map((row) => ({
				amount: row.amount,
				borrowerEmail: null,
				borrowerId: row.borrowerId,
				borrowerLabel: borrowerLabel(row.borrowerLabel),
				date: row.dueDate,
				executionMode: null,
				hasException: isObligationException(row),
				mortgageId: row.mortgageId,
				mortgageLabel: mortgageLabel(row.mortgageLabel),
				recordId: row.obligationId,
				status: row.status,
				tab,
			}));
		case "transfers":
			return snapshot.transfers.map((row) => {
				const borrowerId =
					row.borrowerId ??
					(row.counterpartyType === "borrower" ? row.counterpartyId : null);
				return {
					amount: row.amount,
					borrowerEmail: null,
					borrowerId,
					borrowerLabel: borrowerId
						? borrowerLabel(row.counterpartyLabel)
						: borrowerLabel(null),
					date: row.createdAt,
					executionMode: null,
					hasException: isTransferException(row),
					mortgageId: row.mortgageId,
					mortgageLabel: mortgageLabel(row.mortgageLabel),
					recordId: row.transferId,
					status: row.status,
					tab,
				};
			});
		default:
			return [];
	}
}

export function buildPaymentOperationBorrowerScheduleGroups(
	records: PaymentOperationScheduleRecord[]
): PaymentOperationBorrowerScheduleGroup[] {
	const borrowers = new Map<string, PaymentOperationBorrowerScheduleGroup>();

	for (const record of records) {
		const borrowerGroupId = scheduleBorrowerId(record.borrowerId);
		const borrower = borrowers.get(borrowerGroupId) ?? {
			amount: 0,
			borrowerEmail: record.borrowerEmail,
			borrowerId: record.borrowerId,
			borrowerLabel: record.borrowerLabel,
			exceptionCount: 0,
			id: borrowerGroupId,
			mortgageCount: 0,
			mortgages: [],
			recordCount: 0,
			records: [],
			statusCounts: {},
		};

		borrower.amount += record.amount;
		borrower.exceptionCount += record.hasException ? 1 : 0;
		borrower.recordCount += 1;
		borrower.records.push(record);
		addStatus(borrower.statusCounts, record.status);

		const mortgageGroupId = scheduleMortgageId(record.mortgageId);
		let mortgage = borrower.mortgages.find(
			(candidate) => candidate.id === mortgageGroupId
		);
		if (!mortgage) {
			mortgage = {
				amount: 0,
				borrowerEmail: record.borrowerEmail,
				borrowerId: record.borrowerId,
				borrowerLabel: record.borrowerLabel,
				exceptionCount: 0,
				executionModes: [],
				id: mortgageGroupId,
				mortgageId: record.mortgageId,
				mortgageLabel: record.mortgageLabel,
				nextDate: null,
				recordCount: 0,
				records: [],
				statusCounts: {},
			};
			borrower.mortgages.push(mortgage);
		}

		mortgage.amount += record.amount;
		mortgage.exceptionCount += record.hasException ? 1 : 0;
		mortgage.nextDate =
			compareNullableDate(record.date, mortgage.nextDate) < 0
				? record.date
				: mortgage.nextDate;
		mortgage.recordCount += 1;
		mortgage.records.push(record);
		addStatus(mortgage.statusCounts, record.status);
		if (
			record.executionMode &&
			!mortgage.executionModes.includes(record.executionMode)
		) {
			mortgage.executionModes.push(record.executionMode);
		}

		borrowers.set(borrowerGroupId, borrower);
	}

	return [...borrowers.values()]
		.map((borrower) => ({
			...borrower,
			mortgageCount: borrower.mortgages.length,
			mortgages: borrower.mortgages.sort((left, right) =>
				left.mortgageLabel.localeCompare(right.mortgageLabel, "en")
			),
		}))
		.sort((left, right) =>
			left.borrowerLabel.localeCompare(right.borrowerLabel, "en")
		);
}

export function deriveScheduleContextFromSelectedRecord(args: {
	selectedId?: string;
	snapshot: PaymentOperationsSnapshot;
	tab: PaymentOperationsTab;
}) {
	if (!args.selectedId) {
		return null;
	}

	const record = getPaymentOperationScheduleRecords(
		args.snapshot,
		args.tab
	).find((candidate) => candidate.recordId === args.selectedId);
	if (!record) {
		return null;
	}

	return {
		borrowerId: scheduleBorrowerId(record.borrowerId),
		mortgageId: scheduleMortgageId(record.mortgageId),
	};
}
