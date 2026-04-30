import { ConvexError, v } from "convex/values";
import {
	FILE_ACTIVITY_EVENT_TYPES,
	FILE_BOX_STATUSES,
	FILE_BOX_VISIBILITIES,
	FILE_NODE_TYPES,
	FILE_PARTICIPANT_STATUSES,
	FILE_SCAN_STATES,
	FILE_SECURITY_EVENT_TYPES,
	FILE_SHARE_LINK_KINDS,
	FILE_WORKSPACE_CAPABILITIES,
	FILE_WORKSPACE_PRINCIPAL_KINDS,
	FILE_WORKSPACE_ROLES,
	type FileWorkspaceCapability,
	type FileWorkspaceRole,
} from "./types";

export const MAX_FILE_WORKSPACE_NAME_LENGTH = 255;

const UNSUPPORTED_FILE_WORKSPACE_NAME_CHARACTERS = /[\\/:*?"<>|]/;

const WINDOWS_RESERVED_NAMES = new Set([
	"con",
	"prn",
	"aux",
	"nul",
	"com1",
	"com2",
	"com3",
	"com4",
	"com5",
	"com6",
	"com7",
	"com8",
	"com9",
	"lpt1",
	"lpt2",
	"lpt3",
	"lpt4",
	"lpt5",
	"lpt6",
	"lpt7",
	"lpt8",
	"lpt9",
]);

export const fileWorkspaceRoleValidator = v.union(
	v.literal("viewer"),
	v.literal("editor"),
	v.literal("manager")
);

export const fileWorkspacePrincipalKindValidator = v.union(
	v.literal("authenticated"),
	v.literal("public_link"),
	v.literal("magic_link"),
	v.literal("platform_admin")
);

export const fileBoxStatusValidator = v.union(
	v.literal("active"),
	v.literal("archived"),
	v.literal("suspended"),
	v.literal("disabled")
);

export const fileBoxVisibilityValidator = v.union(
	v.literal("private"),
	v.literal("public_link"),
	v.literal("magic_link"),
	v.literal("disabled")
);

export const fileNodeTypeValidator = v.union(
	v.literal("folder"),
	v.literal("file")
);

export const fileScanStateValidator = v.union(
	v.literal("pending_scan"),
	v.literal("clean"),
	v.literal("rejected"),
	v.literal("scan_error"),
	v.literal("released_by_admin")
);

export const fileShareLinkKindValidator = v.union(
	v.literal("public_link"),
	v.literal("magic_link")
);

export const fileParticipantStatusValidator = v.union(
	v.literal("active"),
	v.literal("invited"),
	v.literal("revoked")
);

export const fileWorkspaceCapabilityValidator = v.union(
	v.literal("list_nodes"),
	v.literal("preview_clean_file"),
	v.literal("download_file"),
	v.literal("view_comments"),
	v.literal("view_activity"),
	v.literal("upload_file"),
	v.literal("create_folder"),
	v.literal("rename_node"),
	v.literal("move_node"),
	v.literal("tag_node"),
	v.literal("comment_on_file"),
	v.literal("create_file_version"),
	v.literal("soft_delete_node"),
	v.literal("view_trash"),
	v.literal("view_versions"),
	v.literal("manage_box_settings"),
	v.literal("manage_participants"),
	v.literal("manage_links"),
	v.literal("manage_retention"),
	v.literal("request_scan_release"),
	v.literal("request_permanent_delete"),
	v.literal("view_security_events")
);

export const fileActivityEventTypeValidator = v.union(
	v.literal("box_created"),
	v.literal("folder_created"),
	v.literal("file_uploaded"),
	v.literal("file_version_created"),
	v.literal("node_renamed"),
	v.literal("node_moved"),
	v.literal("comment_created"),
	v.literal("tag_assigned"),
	v.literal("node_deleted"),
	v.literal("node_restored"),
	v.literal("participant_invited"),
	v.literal("participant_role_changed"),
	v.literal("participant_removed")
);

export const fileSecurityEventTypeValidator = v.union(
	v.literal("box_created"),
	v.literal("box_updated"),
	v.literal("box_archived"),
	v.literal("participant_invited"),
	v.literal("participant_role_changed"),
	v.literal("participant_removed"),
	v.literal("share_link_created"),
	v.literal("share_link_revoked"),
	v.literal("link_opened"),
	v.literal("download_requested"),
	v.literal("preview_requested"),
	v.literal("scan_state_changed"),
	v.literal("scan_error_released"),
	v.literal("retention_policy_changed"),
	v.literal("access_denied")
);

export const fileWorkspaceActorValidator = v.object({
	authId: v.optional(v.string()),
	displayName: v.optional(v.string()),
	email: v.optional(v.string()),
	principalKind: fileWorkspacePrincipalKindValidator,
});

export const fileWorkspaceDownloadPolicyValidator = v.object({
	authenticated: v.boolean(),
	magicLink: v.boolean(),
	publicLink: v.boolean(),
});

export const fileWorkspaceRetentionPolicyValidator = v.object({
	allowEditorRestore: v.boolean(),
	managerPermanentDeleteAfterDays: v.optional(v.number()),
	minRetentionLockedUntil: v.optional(v.number()),
	trashRetentionDays: v.number(),
});

export const fileWorkspaceScanPolicyValidator = v.object({
	allowedContentTypes: v.array(v.string()),
	archivesEnabled: v.boolean(),
	blockedExtensions: v.array(v.string()),
	maxFileSizeBytes: v.number(),
});

export const fileWorkspaceStorageLimitsValidator = v.object({
	maxBoxBytes: v.number(),
	maxFileBytes: v.number(),
});

export const fileWorkspaceAuthenticatedPrincipalValidator = v.object({
	authId: v.string(),
	email: v.optional(v.string()),
	kind: v.literal("authenticated"),
	role: fileWorkspaceRoleValidator,
});

export const fileWorkspaceLinkPrincipalValidator = v.object({
	kind: fileShareLinkKindValidator,
	linkId: v.string(),
	linkKind: fileShareLinkKindValidator,
});

export const fileWorkspacePlatformAdminPrincipalValidator = v.object({
	authId: v.string(),
	email: v.optional(v.string()),
	kind: v.literal("platform_admin"),
});

export const fileWorkspacePrincipalValidator = v.union(
	fileWorkspaceAuthenticatedPrincipalValidator,
	fileWorkspaceLinkPrincipalValidator,
	fileWorkspacePlatformAdminPrincipalValidator
);

export const fileWorkspaceActivityEventValidator = v.object({
	actor: fileWorkspaceActorValidator,
	boxId: v.id("fileBoxes"),
	createdAt: v.number(),
	eventType: fileActivityEventTypeValidator,
	nodeId: v.optional(v.id("fileNodes")),
	targetId: v.optional(v.string()),
	targetType: v.union(
		v.literal("box"),
		v.literal("comment"),
		v.literal("node"),
		v.literal("participant"),
		v.literal("tag"),
		v.literal("version")
	),
});

export const fileWorkspaceSecurityEventValidator = v.object({
	actor: fileWorkspaceActorValidator,
	boxId: v.optional(v.id("fileBoxes")),
	createdAt: v.number(),
	eventType: fileSecurityEventTypeValidator,
	linkId: v.optional(v.id("fileShareLinks")),
	nodeId: v.optional(v.id("fileNodes")),
	outcome: v.union(
		v.literal("allowed"),
		v.literal("denied"),
		v.literal("blocked")
	),
	reasonCode: v.optional(v.string()),
});

export const fileWorkspaceVersionTransitionFieldsValidator = v.object({
	releasedAt: v.optional(v.number()),
	releasedByAuthId: v.optional(v.string()),
	releaseReason: v.optional(v.string()),
	scanCompletedAt: v.optional(v.number()),
	scanReason: v.optional(v.string()),
	scanState: fileScanStateValidator,
});

export function normalizeFileWorkspaceName(rawName: string): string {
	const normalized = rawName.trim().replace(/\s+/g, " ");
	if (normalized.length === 0) {
		throw new ConvexError("File or folder name is required");
	}
	if (normalized.length > MAX_FILE_WORKSPACE_NAME_LENGTH) {
		throw new ConvexError(
			`File or folder name exceeds ${MAX_FILE_WORKSPACE_NAME_LENGTH} character limit`
		);
	}
	if (UNSUPPORTED_FILE_WORKSPACE_NAME_CHARACTERS.test(normalized)) {
		throw new ConvexError(
			"File or folder name contains unsupported characters"
		);
	}
	if (normalized === "." || normalized === "..") {
		throw new ConvexError("File or folder name is reserved");
	}
	const basename = normalized.split(".")[0]?.toLowerCase() ?? "";
	if (WINDOWS_RESERVED_NAMES.has(basename)) {
		throw new ConvexError("File or folder name is reserved");
	}
	return normalized;
}

export function normalizeFileWorkspaceSiblingKey(rawName: string): string {
	return normalizeFileWorkspaceName(rawName).toLocaleLowerCase("en-CA");
}

export function assertFileWorkspaceRole(
	value: string
): asserts value is FileWorkspaceRole {
	if (!(FILE_WORKSPACE_ROLES as readonly string[]).includes(value)) {
		throw new ConvexError("Unsupported File Workspace role");
	}
}

export function assertFileWorkspaceCapability(
	value: string
): asserts value is FileWorkspaceCapability {
	if (!(FILE_WORKSPACE_CAPABILITIES as readonly string[]).includes(value)) {
		throw new ConvexError("Unsupported File Workspace capability");
	}
}

export const fileWorkspaceContractValues = {
	activityEventTypes: FILE_ACTIVITY_EVENT_TYPES,
	boxStatuses: FILE_BOX_STATUSES,
	boxVisibilities: FILE_BOX_VISIBILITIES,
	capabilities: FILE_WORKSPACE_CAPABILITIES,
	nodeTypes: FILE_NODE_TYPES,
	participantStatuses: FILE_PARTICIPANT_STATUSES,
	principalKinds: FILE_WORKSPACE_PRINCIPAL_KINDS,
	roles: FILE_WORKSPACE_ROLES,
	scanStates: FILE_SCAN_STATES,
	shareLinkKinds: FILE_SHARE_LINK_KINDS,
	securityEventTypes: FILE_SECURITY_EVENT_TYPES,
} as const;
