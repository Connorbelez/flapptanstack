import type {
	FileSecurityEventType,
	FileWorkspaceActor,
	FileWorkspacePrincipal,
	FileWorkspaceSecurityEventEnvelope,
} from "./types";

export const FILE_WORKSPACE_SAFE_ERRORS = {
	ACCESS_DENIED: "Box not found or access denied.",
	DOWNLOADS_DISABLED: "Downloads are disabled for this link.",
	FILE_STILL_SCANNING: "This file is still being scanned.",
	FILE_TYPE_NOT_ALLOWED: "This file type is not allowed by workspace policy.",
	LINK_EXPIRED: "This link has expired.",
	PERMANENT_DELETE_BLOCKED:
		"Permanent deletion is blocked by retention policy.",
	SCAN_UNVERIFIED: "This upload could not be verified and remains blocked.",
	SIBLING_NAME_EXISTS: (name: string) =>
		`A file named "${name}" already exists in this folder.`,
} as const;

export function actorFromPrincipal(
	principal: FileWorkspacePrincipal
): FileWorkspaceActor {
	switch (principal.kind) {
		case "authenticated":
			return {
				authId: principal.authId,
				email: principal.email,
				principalKind: "authenticated",
			};
		case "platform_admin":
			return {
				authId: principal.authId,
				email: principal.email,
				principalKind: "platform_admin",
			};
		case "magic_link":
			return { principalKind: "magic_link" };
		case "public_link":
			return { principalKind: "public_link" };
		default: {
			const exhaustive: never = principal;
			return exhaustive;
		}
	}
}

export function createFileWorkspaceSecurityEvent(args: {
	actor: FileWorkspaceActor;
	boxId?: string;
	createdAt: number;
	eventType: FileSecurityEventType;
	linkId?: string;
	metadata?: Readonly<Record<string, string>>;
	nodeId?: string;
	outcome: FileWorkspaceSecurityEventEnvelope["outcome"];
	reasonCode?: string;
}): FileWorkspaceSecurityEventEnvelope {
	return {
		actor: args.actor,
		boxId: args.boxId,
		createdAt: args.createdAt,
		eventType: args.eventType,
		linkId: args.linkId,
		nodeId: args.nodeId,
		outcome: args.outcome,
		reasonCode: args.reasonCode,
	};
}
