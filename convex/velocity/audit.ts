import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
	type AuditJournalEntryInput,
	appendAuditJournalEntry,
} from "../engine/auditJournal";
import type {
	VelocityConnectorCredentialContext,
	VelocityPackageAuditEventType,
	VelocityPackageAuditPayload,
	VelocityReadinessV1,
	VelocityWebhookAgent,
} from "./contracts";

export const VELOCITY_PACKAGE_AUDIT_EVENT_CATEGORY =
	"velocity_package_lifecycle" as const;
export const VELOCITY_PACKAGE_AUDIT_ORIGIN_SYSTEM = "velocity_package" as const;

export interface AppendVelocityPackageAuditEntryArgs {
	actorId: string;
	actorType?: AuditJournalEntryInput["actorType"];
	channel: AuditJournalEntryInput["channel"];
	connectorCredentialContext?: VelocityConnectorCredentialContext;
	correlationId?: string;
	eventId?: string;
	eventType: VelocityPackageAuditEventType;
	idempotencyKey?: string;
	ip?: string;
	linkedRecordIds?: Record<string, unknown>;
	newState?: string;
	organizationId?: string;
	outcome?: AuditJournalEntryInput["outcome"];
	payload?: VelocityPackageAuditPayload;
	previousState?: string;
	readiness?: VelocityReadinessV1;
	reason?: string;
	requestId?: string;
	sessionId?: string;
	timestamp?: number;
	webhookAgent?: VelocityWebhookAgent;
	workspaceId: Id<"velocityPackageWorkspaces"> | string;
}

function buildVelocityAuditPayload(
	args: Pick<
		AppendVelocityPackageAuditEntryArgs,
		| "connectorCredentialContext"
		| "payload"
		| "readiness"
		| "webhookAgent"
		| "workspaceId"
	>
): Record<string, unknown> {
	const payload: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(args.payload ?? {})) {
		if (value !== undefined) {
			payload[key] = value;
		}
	}

	const connectorCredentialContext =
		args.connectorCredentialContext ?? args.payload?.connectorCredentialContext;
	const readiness = args.readiness ?? args.payload?.readiness;
	const webhookAgent = args.webhookAgent ?? args.payload?.webhookAgent;

	if (connectorCredentialContext !== undefined) {
		payload.connectorCredentialContext = connectorCredentialContext;
	}
	if (readiness !== undefined) {
		payload.readiness = readiness;
	}
	if (webhookAgent !== undefined) {
		payload.webhookAgent = webhookAgent;
	}
	payload.workspaceId = String(args.workspaceId);

	return payload;
}

export async function appendVelocityPackageAuditEntry(
	ctx: MutationCtx,
	args: AppendVelocityPackageAuditEntryArgs
) {
	const timestamp = args.timestamp ?? Date.now();
	const workspaceId = String(args.workspaceId);

	return appendAuditJournalEntry(ctx, {
		actorId: args.actorId,
		actorType: args.actorType,
		channel: args.channel,
		correlationId: args.correlationId,
		entityId: workspaceId,
		entityType: "velocityPackageWorkspace",
		eventCategory: VELOCITY_PACKAGE_AUDIT_EVENT_CATEGORY,
		eventId: args.eventId,
		eventType: args.eventType,
		idempotencyKey: args.idempotencyKey,
		ip: args.ip,
		linkedRecordIds: {
			...(args.linkedRecordIds ?? {}),
			entityId: workspaceId,
			velocityPackageWorkspaceId: workspaceId,
		},
		newState: args.newState ?? "none",
		organizationId: args.organizationId,
		originSystem: VELOCITY_PACKAGE_AUDIT_ORIGIN_SYSTEM,
		outcome: args.outcome ?? "transitioned",
		payload: buildVelocityAuditPayload(args),
		previousState: args.previousState ?? "none",
		reason: args.reason,
		requestId: args.requestId,
		sessionId: args.sessionId,
		timestamp,
	});
}
