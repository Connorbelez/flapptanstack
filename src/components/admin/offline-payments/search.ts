import type { FunctionArgs } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import type {
	OfflinePaymentBucket,
	OfflinePaymentOperationsSearchState,
	OfflinePaymentOperationsView,
} from "./types";

const BUCKETS = new Set<OfflinePaymentBucket | "all">([
	"all",
	"upcoming",
	"due",
	"in_progress",
	"staff_overdue",
	"overdue",
	"delinquent",
	"confirmed",
]);

const VIEWS = new Set<OfflinePaymentOperationsView>([
	"agenda",
	"board",
	"grouped",
]);

function parseString(value: unknown) {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function parseBoolean(value: unknown) {
	if (value === true) {
		return true;
	}
	if (value === false || value === null || value === undefined) {
		return false;
	}
	if (typeof value === "number") {
		return value === 1;
	}
	if (typeof value !== "string") {
		return false;
	}
	const normalized = value.trim().toLowerCase();
	return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseBucket(value: unknown) {
	return BUCKETS.has(value as OfflinePaymentBucket | "all")
		? (value as OfflinePaymentBucket | "all")
		: "all";
}

function parseView(value: unknown): OfflinePaymentOperationsView {
	return VIEWS.has(value as OfflinePaymentOperationsView)
		? (value as OfflinePaymentOperationsView)
		: "board";
}

function parseEvidenceType(value: unknown) {
	if (value === "missing_evidence" || value === "with_evidence") {
		return value;
	}
	return "all";
}

function parseInstrumentType(value: unknown) {
	if (value === "cash" || value === "cheque") {
		return value;
	}
	return "all";
}

function parseAmountString(value: unknown) {
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}
	return parseString(value);
}

function parseLocalDateStart(date: string | undefined) {
	if (!date) {
		return undefined;
	}
	const timestamp = Date.parse(`${date}T00:00:00.000`);
	return Number.isNaN(timestamp) ? undefined : timestamp;
}

function parseLocalDateEnd(date: string | undefined) {
	if (!date) {
		return undefined;
	}
	const timestamp = Date.parse(`${date}T23:59:59.999`);
	return Number.isNaN(timestamp) ? undefined : timestamp;
}

function parseAmountCents(value: string | undefined) {
	if (!value) {
		return undefined;
	}
	const amount = Number(value);
	return Number.isFinite(amount) && amount >= 0
		? Math.round(amount * 100)
		: undefined;
}

export function parseOfflinePaymentOperationsSearch(
	raw: Record<string, unknown>
): OfflinePaymentOperationsSearchState {
	return {
		amountMax: parseAmountString(raw.amountMax),
		amountMin: parseAmountString(raw.amountMin),
		dateFrom: parseString(raw.dateFrom),
		dateTo: parseString(raw.dateTo),
		evidenceType: parseEvidenceType(raw.evidenceType),
		instrumentType: parseInstrumentType(raw.instrumentType),
		search: parseString(raw.search),
		selectedPlanEntryId: parseString(raw.selectedPlanEntryId),
		staffOverdueOnly: parseBoolean(raw.staffOverdueOnly),
		statusBucket: parseBucket(raw.statusBucket),
		view: parseView(raw.view),
	};
}

export function cleanOfflinePaymentOperationsSearch(
	search: OfflinePaymentOperationsSearchState
) {
	return Object.fromEntries(
		Object.entries(search).filter(([key, value]) => {
			if (value === undefined || value === null || value === "") {
				return false;
			}
			if (key === "view" && value === "board") {
				return false;
			}
			if (
				(key === "statusBucket" ||
					key === "evidenceType" ||
					key === "instrumentType") &&
				value === "all"
			) {
				return false;
			}
			if (typeof value === "boolean") {
				return value;
			}
			return true;
		})
	) as Partial<OfflinePaymentOperationsSearchState>;
}

export function buildOfflinePaymentOperationsQueryArgs(
	search: OfflinePaymentOperationsSearchState
): FunctionArgs<
	typeof api.payments.offlineOperations.getOfflinePaymentOperationsSnapshot
> {
	return {
		amountMax: parseAmountCents(search.amountMax),
		amountMin: parseAmountCents(search.amountMin),
		dateFrom: parseLocalDateStart(search.dateFrom),
		dateTo: parseLocalDateEnd(search.dateTo),
		evidenceType:
			search.evidenceType === "all" ? undefined : search.evidenceType,
		instrumentType:
			search.instrumentType === "all" ? undefined : search.instrumentType,
		search: search.search,
		staffOverdueOnly: search.staffOverdueOnly || undefined,
		statusBucket:
			search.statusBucket === "all" ? undefined : search.statusBucket,
	};
}
