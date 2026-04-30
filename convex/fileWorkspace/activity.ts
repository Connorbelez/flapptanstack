import { actorFromPrincipal } from "./securityEvents";
import type {
	FileActivityEventType,
	FileWorkspaceActivityEventEnvelope,
	FileWorkspaceActor,
	FileWorkspacePrincipal,
} from "./types";

export function createFileWorkspaceActivityEvent(args: {
	actor: FileWorkspaceActor;
	boxId: string;
	createdAt: number;
	eventType: FileActivityEventType;
	nodeId?: string;
	targetId?: string;
	targetType: FileWorkspaceActivityEventEnvelope["targetType"];
}): FileWorkspaceActivityEventEnvelope {
	return {
		actor: args.actor,
		boxId: args.boxId,
		createdAt: args.createdAt,
		eventType: args.eventType,
		nodeId: args.nodeId,
		targetId: args.targetId,
		targetType: args.targetType,
	};
}

export function createFileWorkspaceActivityForPrincipal(
	principal: FileWorkspacePrincipal,
	args: Omit<Parameters<typeof createFileWorkspaceActivityEvent>[0], "actor">
): FileWorkspaceActivityEventEnvelope {
	return createFileWorkspaceActivityEvent({
		...args,
		actor: actorFromPrincipal(principal),
	});
}
