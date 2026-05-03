import type {
	DealDocumentInstanceStatus,
	DealDocumentStoredRemediationAction,
} from "./contracts";

export type DealDocumentRemediationAction =
	| "open_authoring"
	| "open_mapping"
	| "retry_instance"
	| "refresh_snapshot"
	| "waive_for_deal"
	| "archive_source_blueprint";

export type DealDocumentRemediationEligibility =
	| "remediable_failed_instance"
	| "already_remediated"
	| "not_remediable";

export interface DealDocumentRemediationActionItem {
	action: DealDocumentRemediationAction;
	copy: string;
}

export interface DealDocumentRemediation {
	actions: DealDocumentRemediationActionItem[];
	eligibility: DealDocumentRemediationEligibility;
	primaryAction: DealDocumentRemediationAction | null;
	summary: string;
}

export interface DealDocumentRemediationInput {
	archivedAt?: number | null;
	lastError?: string | null;
	remediationAction?: DealDocumentStoredRemediationAction | null;
	sourceBlueprintId?: unknown;
	sourceBlueprintSnapshot?: {
		class?: string;
		templateId?: unknown;
	};
	status: DealDocumentInstanceStatus;
	supersededByInstanceId?: unknown;
}

const ACTIVE_FAILED_STATUSES = new Set<DealDocumentInstanceStatus>([
	"generation_failed",
	"signature_pending_recipient_resolution",
	"provider_error",
]);

const DOCUMENSO_SIGNATURE_FIELD_RE =
	/documenso[\s\S]*(signature fields?|signer recipients must have at least one signature field)|signer recipients must have at least one signature field/i;
const MISSING_SIGNATORY_RE =
	/(signatory mapping|recipient mapping|pending recipient|no documenso recipients|missing signator)/i;
const MISSING_VARIABLE_RE = /(missing variables?|variable mapping)/i;
const PROVIDER_VALIDATION_RE =
	/(provider.*(400|validation)|documenso.*(400|validation)|validation failed)/i;

export function getDealDocumentRemediationEligibility(
	input: DealDocumentRemediationInput
): DealDocumentRemediationEligibility {
	if (
		input.remediationAction === "waived_for_deal" ||
		input.supersededByInstanceId != null
	) {
		return "already_remediated";
	}

	if (input.archivedAt != null || input.status === "archived") {
		return "not_remediable";
	}

	if (ACTIVE_FAILED_STATUSES.has(input.status)) {
		return "remediable_failed_instance";
	}

	return "not_remediable";
}

function supportsTemplateActions(input: DealDocumentRemediationInput) {
	return Boolean(input.sourceBlueprintSnapshot?.templateId);
}

function buildActions(
	input: DealDocumentRemediationInput,
	primaryAction: DealDocumentRemediationAction | null
): DealDocumentRemediationActionItem[] {
	const actions: DealDocumentRemediationActionItem[] = [];
	const templateActionsSupported = supportsTemplateActions(input);
	const push = (action: DealDocumentRemediationAction, copy: string) => {
		if (!actions.some((item) => item.action === action)) {
			actions.push({ action, copy });
		}
	};

	if (primaryAction === "open_authoring" && templateActionsSupported) {
		push(
			"open_authoring",
			"Open the template authoring surface and fix the signature field or provider setup."
		);
	}
	if (primaryAction === "open_mapping" && templateActionsSupported) {
		push(
			"open_mapping",
			"Open document mapping and fix the variable or recipient mapping for this deal."
		);
	}
	if (templateActionsSupported) {
		push(
			"open_authoring",
			"Open the template authoring surface and fix the signature field or provider setup."
		);
		push(
			"open_mapping",
			"Open document mapping and fix the variable or recipient mapping for this deal."
		);
	}
	push(
		"retry_instance",
		"Retry this failed row after correcting the deal-scoped configuration."
	);
	if (input.sourceBlueprintId != null) {
		push(
			"refresh_snapshot",
			"Replace this failed row from the latest active source blueprint snapshot."
		);
	}
	push(
		"waive_for_deal",
		"Archive this failed row as intentionally waived for this deal."
	);
	if (input.sourceBlueprintId != null) {
		push(
			"archive_source_blueprint",
			"Archive the source blueprint so future deal packages do not generate it."
		);
	}

	return actions;
}

function classifyRemediation(input: DealDocumentRemediationInput): {
	primaryAction: DealDocumentRemediationAction;
	summary: string;
} {
	const lastError = input.lastError ?? "";

	if (DOCUMENSO_SIGNATURE_FIELD_RE.test(lastError)) {
		return {
			primaryAction: supportsTemplateActions(input)
				? "open_authoring"
				: "retry_instance",
			summary:
				"Documenso requires at least one signer signature field. Fix the template authoring before retrying.",
		};
	}

	if (
		input.status === "signature_pending_recipient_resolution" ||
		MISSING_SIGNATORY_RE.test(lastError)
	) {
		return {
			primaryAction: supportsTemplateActions(input)
				? "open_mapping"
				: "retry_instance",
			summary:
				"The document is missing recipient mapping for one or more signatories.",
		};
	}

	if (MISSING_VARIABLE_RE.test(lastError)) {
		return {
			primaryAction: supportsTemplateActions(input)
				? "open_mapping"
				: "retry_instance",
			summary:
				"The template is missing variable mapping or deal data needed for generation.",
		};
	}

	if (PROVIDER_VALIDATION_RE.test(lastError)) {
		return {
			primaryAction: supportsTemplateActions(input)
				? "open_authoring"
				: "retry_instance",
			summary:
				"The provider rejected the document setup. Check provider validation details, then retry.",
		};
	}

	return {
		primaryAction: "retry_instance",
		summary:
			"Inspect the error, fix the source or deal data, then retry this document instance.",
	};
}

export function buildDealDocumentRemediation(
	input: DealDocumentRemediationInput
): DealDocumentRemediation {
	const eligibility = getDealDocumentRemediationEligibility(input);
	if (eligibility === "already_remediated") {
		return {
			actions: [],
			eligibility,
			primaryAction: null,
			summary: "This document row has already been remediated.",
		};
	}
	if (eligibility === "not_remediable") {
		return {
			actions: [],
			eligibility,
			primaryAction: null,
			summary: "This document row is not eligible for remediation.",
		};
	}

	const classification = classifyRemediation(input);
	return {
		actions: buildActions(input, classification.primaryAction),
		eligibility,
		primaryAction: classification.primaryAction,
		summary: classification.summary,
	};
}
