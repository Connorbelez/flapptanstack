import type { Id } from "../_generated/dataModel";
import type {
	VELOCITY_CREATION_SOURCE,
	VELOCITY_ORIGINATION_PATH,
	VELOCITY_WORKFLOW_SOURCE_TYPE,
} from "../velocity/constants";

export const ORIGINATION_WORKFLOW_SOURCE_TYPE =
	"admin_origination_case" as const;
export const ADMIN_DIRECT_CREATION_SOURCE = "admin_direct" as const;
export const ADMIN_DIRECT_ORIGINATION_PATH = "admin_direct" as const;

export type MortgageActivationWorkflowSourceType =
	| typeof ORIGINATION_WORKFLOW_SOURCE_TYPE
	| typeof VELOCITY_WORKFLOW_SOURCE_TYPE;

export type MortgageActivationCreationSource =
	| typeof ADMIN_DIRECT_CREATION_SOURCE
	| typeof VELOCITY_CREATION_SOURCE;

export type MortgageActivationOriginationPath =
	| typeof ADMIN_DIRECT_ORIGINATION_PATH
	| typeof VELOCITY_ORIGINATION_PATH;

export interface MortgageActivationSource {
	creationSource: MortgageActivationCreationSource;
	originatedByUserId: string;
	originatingWorkflowId: string;
	originatingWorkflowType: MortgageActivationWorkflowSourceType;
	originationPath: MortgageActivationOriginationPath;
	workflowSourceId: string;
	workflowSourceKey: string;
	workflowSourceType: MortgageActivationWorkflowSourceType;
}

export function buildAdminDirectMortgageActivationSource(args: {
	caseId: Id<"adminOriginationCases">;
	viewerUserId: Id<"users">;
}) {
	return {
		creationSource: ADMIN_DIRECT_CREATION_SOURCE,
		originationPath: ADMIN_DIRECT_ORIGINATION_PATH,
		originatedByUserId: String(args.viewerUserId),
		originatingWorkflowId: String(args.caseId),
		originatingWorkflowType: ORIGINATION_WORKFLOW_SOURCE_TYPE,
		workflowSourceId: String(args.caseId),
		workflowSourceKey: buildOriginationMortgageWorkflowSourceKey(args.caseId),
		workflowSourceType: ORIGINATION_WORKFLOW_SOURCE_TYPE,
	} satisfies MortgageActivationSource;
}

export function buildOriginationMortgageWorkflowSourceKey(
	caseId: Id<"adminOriginationCases">
) {
	return `${ORIGINATION_WORKFLOW_SOURCE_TYPE}:mortgage:${caseId}`;
}

export function buildOriginationBorrowerWorkflowSourceKey(args: {
	caseId: Id<"adminOriginationCases">;
	participantDiscriminator?: string;
	participantDraftId?: string;
	role: "co_borrower" | "guarantor" | "primary";
}) {
	return `${ORIGINATION_WORKFLOW_SOURCE_TYPE}:borrower:${args.caseId}:${
		args.participantDraftId ?? args.participantDiscriminator ?? args.role
	}`;
}
