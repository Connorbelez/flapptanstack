export const FILE_WORKSPACE_ROLES = ["viewer", "editor", "manager"] as const;
export type FileWorkspaceRole = (typeof FILE_WORKSPACE_ROLES)[number];

export const FILE_WORKSPACE_PRINCIPAL_KINDS = [
	"authenticated",
	"public_link",
	"magic_link",
	"platform_admin",
] as const;
export type FileWorkspacePrincipalKind =
	(typeof FILE_WORKSPACE_PRINCIPAL_KINDS)[number];

export const FILE_BOX_STATUSES = [
	"active",
	"archived",
	"suspended",
	"disabled",
] as const;
export type FileBoxStatus = (typeof FILE_BOX_STATUSES)[number];

export const FILE_BOX_VISIBILITIES = [
	"private",
	"public_link",
	"magic_link",
	"disabled",
] as const;
export type FileBoxVisibility = (typeof FILE_BOX_VISIBILITIES)[number];

export const FILE_NODE_TYPES = ["folder", "file"] as const;
export type FileNodeType = (typeof FILE_NODE_TYPES)[number];

export const FILE_SCAN_STATES = [
	"pending_scan",
	"clean",
	"rejected",
	"scan_error",
	"released_by_admin",
] as const;
export type FileScanState = (typeof FILE_SCAN_STATES)[number];

export const FILE_SHARE_LINK_KINDS = ["public_link", "magic_link"] as const;
export type FileShareLinkKind = (typeof FILE_SHARE_LINK_KINDS)[number];

export const FILE_PARTICIPANT_STATUSES = [
	"active",
	"invited",
	"revoked",
] as const;
export type FileParticipantStatus = (typeof FILE_PARTICIPANT_STATUSES)[number];

export const FILE_ACTIVITY_EVENT_TYPES = [
	"box_created",
	"folder_created",
	"file_uploaded",
	"file_version_created",
	"node_renamed",
	"node_moved",
	"comment_created",
	"tag_assigned",
	"node_deleted",
	"node_restored",
	"participant_invited",
	"participant_role_changed",
	"participant_removed",
] as const;
export type FileActivityEventType = (typeof FILE_ACTIVITY_EVENT_TYPES)[number];

export const FILE_SECURITY_EVENT_TYPES = [
	"box_created",
	"box_updated",
	"box_archived",
	"participant_invited",
	"participant_role_changed",
	"participant_removed",
	"share_link_created",
	"share_link_revoked",
	"link_opened",
	"download_requested",
	"preview_requested",
	"scan_state_changed",
	"scan_error_released",
	"retention_policy_changed",
	"access_denied",
] as const;
export type FileSecurityEventType = (typeof FILE_SECURITY_EVENT_TYPES)[number];

export const FILE_WORKSPACE_CAPABILITIES = [
	"list_nodes",
	"preview_clean_file",
	"download_file",
	"view_comments",
	"view_activity",
	"upload_file",
	"create_folder",
	"rename_node",
	"move_node",
	"tag_node",
	"comment_on_file",
	"create_file_version",
	"soft_delete_node",
	"view_trash",
	"view_versions",
	"manage_box_settings",
	"manage_participants",
	"manage_links",
	"manage_retention",
	"request_scan_release",
	"request_permanent_delete",
	"view_security_events",
] as const;
export type FileWorkspaceCapability =
	(typeof FILE_WORKSPACE_CAPABILITIES)[number];

export interface FileWorkspaceActor {
	authId?: string;
	displayName?: string;
	email?: string;
	principalKind: FileWorkspacePrincipalKind;
}

export interface FileWorkspaceAuthenticatedPrincipal {
	authId: string;
	email?: string;
	kind: "authenticated";
	role: FileWorkspaceRole;
}

export interface FileWorkspaceLinkPrincipal {
	kind: "public_link" | "magic_link";
	linkId: string;
	linkKind: FileShareLinkKind;
}

export interface FileWorkspacePlatformAdminPrincipal {
	authId: string;
	email?: string;
	kind: "platform_admin";
}

export type FileWorkspacePrincipal =
	| FileWorkspaceAuthenticatedPrincipal
	| FileWorkspaceLinkPrincipal
	| FileWorkspacePlatformAdminPrincipal;

export interface FileWorkspaceDownloadPolicy {
	authenticated: boolean;
	magicLink: boolean;
	publicLink: boolean;
}

export interface FileWorkspaceRetentionPolicy {
	allowEditorRestore: boolean;
	managerPermanentDeleteAfterDays?: number;
	minRetentionLockedUntil?: number;
	trashRetentionDays: number;
}

export interface FileWorkspaceScanPolicy {
	allowedContentTypes: readonly string[];
	archivesEnabled: boolean;
	blockedExtensions: readonly string[];
	maxFileSizeBytes: number;
}

export interface FileWorkspaceStorageLimits {
	maxBoxBytes: number;
	maxFileBytes: number;
}

export interface FileWorkspaceActivityEventEnvelope {
	actor: FileWorkspaceActor;
	boxId: string;
	createdAt: number;
	eventType: FileActivityEventType;
	nodeId?: string;
	targetId?: string;
	targetType: "box" | "comment" | "node" | "participant" | "tag" | "version";
}

export interface FileWorkspaceSecurityEventEnvelope {
	actor: FileWorkspaceActor;
	boxId?: string;
	createdAt: number;
	eventType: FileSecurityEventType;
	linkId?: string;
	nodeId?: string;
	outcome: "allowed" | "denied" | "blocked";
	reasonCode?: string;
}
