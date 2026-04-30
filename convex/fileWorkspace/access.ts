import type { Viewer } from "../fluent";
import { FILE_WORKSPACE_SAFE_ERRORS } from "./securityEvents";
import type {
	FileShareLinkKind,
	FileWorkspaceCapability,
	FileWorkspacePrincipal,
	FileWorkspaceRole,
} from "./types";

const VIEWER_CAPABILITIES = [
	"list_nodes",
	"preview_clean_file",
	"view_comments",
	"view_activity",
] as const satisfies readonly FileWorkspaceCapability[];

const EDITOR_EXTRA_CAPABILITIES = [
	"upload_file",
	"create_folder",
	"rename_node",
	"move_node",
	"tag_node",
	"comment_on_file",
	"create_file_version",
	"soft_delete_node",
] as const satisfies readonly FileWorkspaceCapability[];

const MANAGER_EXTRA_CAPABILITIES = [
	"view_trash",
	"view_versions",
	"manage_box_settings",
	"manage_participants",
	"manage_links",
	"manage_retention",
	"request_scan_release",
	"request_permanent_delete",
	"view_security_events",
] as const satisfies readonly FileWorkspaceCapability[];

const LINK_VIEW_CAPABILITIES = [
	"list_nodes",
	"preview_clean_file",
] as const satisfies readonly FileWorkspaceCapability[];

export interface FileWorkspaceCapabilityOptions {
	downloadsAllowed?: boolean;
}

export interface FileWorkspaceAccessAllowed {
	allowed: true;
	capabilities: ReadonlySet<FileWorkspaceCapability>;
	principal: FileWorkspacePrincipal;
}

export interface FileWorkspaceAccessDenied {
	allowed: false;
	capabilities: ReadonlySet<FileWorkspaceCapability>;
	errorMessage: string;
	principal: FileWorkspacePrincipal;
	reasonCode: string;
}

export type FileWorkspaceAccessResult =
	| FileWorkspaceAccessAllowed
	| FileWorkspaceAccessDenied;

function capabilitySet(
	capabilities: readonly FileWorkspaceCapability[],
	options: FileWorkspaceCapabilityOptions = {}
): ReadonlySet<FileWorkspaceCapability> {
	const next = new Set<FileWorkspaceCapability>(capabilities);
	if (options.downloadsAllowed) {
		next.add("download_file");
	}
	return next;
}

export function capabilitiesForRole(
	role: FileWorkspaceRole,
	options: FileWorkspaceCapabilityOptions = {}
): ReadonlySet<FileWorkspaceCapability> {
	switch (role) {
		case "viewer":
			return capabilitySet(VIEWER_CAPABILITIES, options);
		case "editor":
			return capabilitySet(
				[...VIEWER_CAPABILITIES, ...EDITOR_EXTRA_CAPABILITIES],
				options
			);
		case "manager":
			return capabilitySet(
				[
					...VIEWER_CAPABILITIES,
					...EDITOR_EXTRA_CAPABILITIES,
					...MANAGER_EXTRA_CAPABILITIES,
				],
				options
			);
		default: {
			const exhaustive: never = role;
			return exhaustive;
		}
	}
}

export function capabilitiesForLinkPrincipal(
	options: FileWorkspaceCapabilityOptions = {}
): ReadonlySet<FileWorkspaceCapability> {
	return capabilitySet(LINK_VIEW_CAPABILITIES, options);
}

export function capabilitiesForPlatformAdmin(): ReadonlySet<FileWorkspaceCapability> {
	return capabilitySet(
		[
			...VIEWER_CAPABILITIES,
			...EDITOR_EXTRA_CAPABILITIES,
			...MANAGER_EXTRA_CAPABILITIES,
		],
		{ downloadsAllowed: true }
	);
}

export function principalForParticipant(args: {
	authId: string;
	email?: string;
	role: FileWorkspaceRole;
}): FileWorkspacePrincipal {
	return {
		authId: args.authId,
		email: args.email,
		kind: "authenticated",
		role: args.role,
	};
}

export function principalForLink(args: {
	linkId: string;
	linkKind: FileShareLinkKind;
}): FileWorkspacePrincipal {
	return {
		kind: args.linkKind,
		linkId: args.linkId,
		linkKind: args.linkKind,
	};
}

export function principalForPlatformAdmin(
	viewer: Pick<Viewer, "authId" | "email">
): FileWorkspacePrincipal {
	return {
		authId: viewer.authId,
		email: viewer.email,
		kind: "platform_admin",
	};
}

export function resolvePrincipalFromViewer(args: {
	participantRole?: FileWorkspaceRole;
	viewer: Pick<Viewer, "authId" | "email" | "isFairLendAdmin">;
}): FileWorkspacePrincipal | null {
	if (args.participantRole) {
		return principalForParticipant({
			authId: args.viewer.authId,
			email: args.viewer.email,
			role: args.participantRole,
		});
	}
	if (args.viewer.isFairLendAdmin) {
		return principalForPlatformAdmin(args.viewer);
	}
	return null;
}

export function capabilitiesForPrincipal(
	principal: FileWorkspacePrincipal,
	options: FileWorkspaceCapabilityOptions = {}
): ReadonlySet<FileWorkspaceCapability> {
	switch (principal.kind) {
		case "authenticated":
			return capabilitiesForRole(principal.role, options);
		case "platform_admin":
			return capabilitiesForPlatformAdmin();
		case "magic_link":
		case "public_link":
			return capabilitiesForLinkPrincipal(options);
		default: {
			const exhaustive: never = principal;
			return exhaustive;
		}
	}
}

export function canFileWorkspace(
	capabilities: ReadonlySet<FileWorkspaceCapability>,
	capability: FileWorkspaceCapability
): boolean {
	return capabilities.has(capability);
}

export function allowFileWorkspaceAccess(args: {
	options?: FileWorkspaceCapabilityOptions;
	principal: FileWorkspacePrincipal;
}): FileWorkspaceAccessAllowed {
	return {
		allowed: true,
		capabilities: capabilitiesForPrincipal(args.principal, args.options),
		principal: args.principal,
	};
}

export function denyFileWorkspaceAccess(args: {
	principal: FileWorkspacePrincipal;
	reasonCode?: string;
}): FileWorkspaceAccessDenied {
	return {
		allowed: false,
		capabilities: new Set<FileWorkspaceCapability>(),
		errorMessage: FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED,
		principal: args.principal,
		reasonCode: args.reasonCode ?? "access_denied",
	};
}
