import type {
	AdminDealOperationAction,
	AdminDealOperationBlocker,
	AdminDealOperationsCard,
	AdminDealOperationsFilter,
} from "../../../../convex/deals/queries";

export type DealOperationsPhase =
	| "initiated"
	| "lawyerOnboarding"
	| "documentReview"
	| "fundsTransfer"
	| "confirmed"
	| "failed"
	| "unknown";

export const DEAL_OPERATIONS_PHASES: Array<{
	id: DealOperationsPhase;
	tone: "blue" | "amber" | "purple" | "cyan" | "emerald" | "red" | "zinc";
	title: string;
}> = [
	{ id: "initiated", title: "Initiated", tone: "blue" },
	{ id: "lawyerOnboarding", title: "Lawyer Onboarding", tone: "amber" },
	{ id: "documentReview", title: "Document Review", tone: "purple" },
	{ id: "fundsTransfer", title: "Funds Transfer", tone: "cyan" },
	{ id: "confirmed", title: "Confirmed", tone: "emerald" },
	{ id: "failed", title: "Failed", tone: "red" },
	{ id: "unknown", title: "Missing Contract", tone: "zinc" },
];

export const DEAL_OPERATIONS_FILTERS: Array<{
	id: AdminDealOperationsFilter;
	label: string;
}> = [
	{ id: "all", label: "All" },
	{ id: "needs_action", label: "Needs action" },
	{ id: "blocked", label: "Blocked" },
	{ id: "awaiting_signatures", label: "Awaiting signatures" },
	{ id: "awaiting_funds", label: "Awaiting funds" },
	{ id: "completed", label: "Completed" },
	{ id: "failed", label: "Failed" },
];

export function filterDealOperationCards(
	cards: readonly AdminDealOperationsCard[],
	filter: AdminDealOperationsFilter
) {
	if (filter === "all") {
		return [...cards];
	}
	return cards.filter((card) => card.filters.includes(filter));
}

export function groupDealOperationCards(
	cards: readonly AdminDealOperationsCard[]
) {
	const grouped: Record<DealOperationsPhase, AdminDealOperationsCard[]> = {
		initiated: [],
		lawyerOnboarding: [],
		documentReview: [],
		fundsTransfer: [],
		confirmed: [],
		failed: [],
		unknown: [],
	};
	for (const card of cards) {
		grouped[card.lifecycle.phase].push(card);
	}
	return grouped;
}

export function formatDealOperationPhase(
	status: string,
	subState: string | null
) {
	const phase =
		DEAL_OPERATIONS_PHASES.find((entry) => status.startsWith(entry.id))
			?.title ??
		DEAL_OPERATIONS_PHASES.find((entry) => entry.id === status)?.title ??
		"Unknown";
	if (!subState) {
		return phase;
	}
	return `${phase} - ${formatEnumLabel(subState)}`;
}

export function formatDealShare(displayPercent: number | null) {
	if (typeof displayPercent !== "number") {
		return "Invalid share";
	}
	return `${displayPercent.toLocaleString(undefined, {
		maximumFractionDigits: 2,
		minimumFractionDigits: 0,
	})}%`;
}

export function formatEnumLabel(value: string) {
	return value
		.split("_")
		.flatMap((segment) => segment.split("."))
		.map((segment) =>
			segment.length > 0
				? `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`
				: segment
		)
		.join(" ");
}

export function summarizeBlockers(
	blockers: readonly AdminDealOperationBlocker[]
) {
	if (blockers.length === 0) {
		return "No blockers";
	}
	const criticalCount = blockers.filter(
		(blocker) => blocker.severity === "critical"
	).length;
	if (criticalCount > 0) {
		return `${criticalCount} critical blocker${criticalCount === 1 ? "" : "s"}`;
	}
	return `${blockers.length} blocker${blockers.length === 1 ? "" : "s"}`;
}

export function primaryActionLabel(action: AdminDealOperationAction | null) {
	return action?.label ?? "Monitor";
}

export function actionDisabledReason(action: AdminDealOperationAction) {
	if (action.disabledReason) {
		return action.disabledReason;
	}
	if (!action.requiresPayload) {
		return null;
	}
	if (action.payloadKind === "closing_date") {
		return "Closing date required";
	}
	if (action.payloadKind === "verification_id") {
		return "Verification ID required";
	}
	if (action.payloadKind === "manual_funds") {
		return "Funds evidence required";
	}
	if (action.payloadKind === "cancel_reason") {
		return "Cancellation reason required";
	}
	return null;
}

export function lifecycleProgress(phase: DealOperationsPhase): {
	completed: DealOperationsPhase[];
	current: DealOperationsPhase;
	remaining: DealOperationsPhase[];
} {
	const order = DEAL_OPERATIONS_PHASES.map((entry) => entry.id);
	const index = order.indexOf(phase);
	if (phase === "failed" || phase === "unknown" || index < 0) {
		return { completed: [], current: phase, remaining: [] };
	}
	return {
		completed: order.slice(0, index).filter((entry) => entry !== "failed"),
		current: phase,
		remaining: order
			.slice(index + 1)
			.filter((entry) => entry !== "failed" && entry !== "unknown"),
	};
}
