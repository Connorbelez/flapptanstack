import type { Id } from "../_generated/dataModel";
import {
	buildVelocityMortgageWorkflowSourceKey,
	normalizeVelocityKeyPart,
	VELOCITY_CREATION_SOURCE,
	VELOCITY_ORIGINATION_PATH,
	VELOCITY_WORKFLOW_SOURCE_TYPE,
} from "./constants";

export interface VelocityMortgageActivationSource {
	creationSource: typeof VELOCITY_CREATION_SOURCE;
	originatedByUserId: string;
	originatingWorkflowId: string;
	originatingWorkflowType: typeof VELOCITY_WORKFLOW_SOURCE_TYPE;
	originationPath: typeof VELOCITY_ORIGINATION_PATH;
	workflowSourceId: string;
	workflowSourceKey: `velocity_package:mortgage:${string}`;
	workflowSourceType: typeof VELOCITY_WORKFLOW_SOURCE_TYPE;
}

export function buildVelocityMortgageActivationSource(args: {
	linkApplicationId: string;
	viewerUserId: Id<"users">;
	workspaceId: Id<"velocityPackageWorkspaces">;
}) {
	return {
		creationSource: VELOCITY_CREATION_SOURCE,
		originatedByUserId: String(args.viewerUserId),
		originatingWorkflowId: String(args.workspaceId),
		originatingWorkflowType: VELOCITY_WORKFLOW_SOURCE_TYPE,
		originationPath: VELOCITY_ORIGINATION_PATH,
		workflowSourceId: String(args.workspaceId),
		workflowSourceKey: buildVelocityMortgageWorkflowSourceKey(
			args.linkApplicationId
		),
		workflowSourceType: VELOCITY_WORKFLOW_SOURCE_TYPE,
	} satisfies VelocityMortgageActivationSource;
}

export function buildVelocityBorrowerWorkflowSourceKey(args: {
	borrowerExternalKey?: string;
	linkApplicationId: string;
	role: "co_borrower" | "guarantor" | "primary";
	workspaceId: Id<"velocityPackageWorkspaces">;
}) {
	return `${VELOCITY_WORKFLOW_SOURCE_TYPE}:borrower:${normalizeVelocityKeyPart(
		args.linkApplicationId
	)}:${normalizeVelocityKeyPart(
		String(args.workspaceId)
	)}:${normalizeVelocityKeyPart(args.borrowerExternalKey ?? args.role)}` as const;
}
