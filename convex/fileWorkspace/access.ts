import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { Viewer } from "../fluent";
import { participantKeyForAuthId, participantKeyForEmail } from "./identity";
import { FILE_WORKSPACE_SAFE_ERRORS } from "./securityEvents";
import { hashShareLinkToken } from "./tokens";
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

export interface ResolvedFileWorkspacePrincipal {
	box: Doc<"fileBoxes">;
	capabilities: ReadonlySet<FileWorkspaceCapability>;
	link?: Doc<"fileShareLinks">;
	participant?: Doc<"fileBoxParticipants">;
	principal: FileWorkspacePrincipal;
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

async function getActiveParticipantByViewer(
	ctx: Pick<QueryCtx, "db">,
	args: {
		boxId: Id<"fileBoxes">;
		viewer: Pick<Viewer, "authId" | "verifiedEmail">;
	}
) {
	const authParticipant = await ctx.db
		.query("fileBoxParticipants")
		.withIndex("by_box_participant_status", (query) =>
			query
				.eq("boxId", args.boxId)
				.eq("participantKey", participantKeyForAuthId(args.viewer.authId))
				.eq("status", "active")
		)
		.unique();
	if (authParticipant) {
		return authParticipant;
	}
	const verifiedEmail = args.viewer.verifiedEmail;
	if (!verifiedEmail) {
		return null;
	}
	return await ctx.db
		.query("fileBoxParticipants")
		.withIndex("by_box_participant_status", (query) =>
			query
				.eq("boxId", args.boxId)
				.eq("participantKey", participantKeyForEmail(verifiedEmail))
				.eq("status", "active")
		)
		.unique();
}

function isNormalPrincipalBlockedForBox(
	box: Doc<"fileBoxes">,
	principal: FileWorkspacePrincipal
): boolean {
	if (principal.kind === "platform_admin") {
		return false;
	}
	if (
		principal.kind === "authenticated" &&
		principal.role === "manager" &&
		(box.status === "archived" || box.status === "disabled")
	) {
		return false;
	}
	return box.status === "disabled" || box.status === "suspended";
}

async function resolveAuthenticatedFileWorkspacePrincipal(
	ctx: Pick<QueryCtx, "db">,
	args: {
		boxId: Id<"fileBoxes">;
		requireActiveBox?: boolean;
		viewer: Viewer;
	}
): Promise<ResolvedFileWorkspacePrincipal | null> {
	const box = await ctx.db.get(args.boxId);
	if (!box) {
		return null;
	}
	const participant = await getActiveParticipantByViewer(ctx, {
		boxId: args.boxId,
		viewer: args.viewer,
	});
	let principal: FileWorkspacePrincipal | null = null;
	if (participant) {
		principal = principalForParticipant({
			authId: args.viewer.authId,
			email: args.viewer.email,
			role: participant.role,
		});
	} else if (args.viewer.isFairLendAdmin) {
		principal = principalForPlatformAdmin(args.viewer);
	}
	if (!principal) {
		return null;
	}
	if (
		args.requireActiveBox !== false &&
		isNormalPrincipalBlockedForBox(box, principal)
	) {
		return null;
	}
	return {
		box,
		capabilities: capabilitiesForPrincipal(principal),
		participant: participant ?? undefined,
		principal,
	};
}

async function resolveBearerFileWorkspacePrincipal(
	ctx: Pick<QueryCtx, "db">,
	args: {
		boxId?: Id<"fileBoxes">;
		rawToken: string;
	}
): Promise<ResolvedFileWorkspacePrincipal | null> {
	const tokenHash = await hashShareLinkToken(args.rawToken);
	const link = await ctx.db
		.query("fileShareLinks")
		.withIndex("by_token_hash", (query) => query.eq("tokenHash", tokenHash))
		.unique();
	if (!link || link.revokedAt || !link.viewEnabled) {
		return null;
	}
	if (args.boxId && link.boxId !== args.boxId) {
		return null;
	}
	if (link.expiresAt !== undefined && link.expiresAt <= Date.now()) {
		return null;
	}
	const box = await ctx.db.get(link.boxId);
	if (!box || box.status !== "active" || box.visibility !== link.linkKind) {
		return null;
	}
	const principal = principalForLink({
		linkId: link._id,
		linkKind: link.linkKind,
	});
	return {
		box,
		capabilities: capabilitiesForPrincipal(principal),
		link,
		principal,
	};
}

export async function resolveFileWorkspacePrincipal(
	ctx: Pick<QueryCtx, "db">,
	args:
		| {
				boxId: Id<"fileBoxes">;
				requireActiveBox?: boolean;
				viewer: Viewer;
		  }
		| {
				boxId?: Id<"fileBoxes">;
				rawToken: string;
		  }
): Promise<ResolvedFileWorkspacePrincipal | null> {
	if ("viewer" in args) {
		return await resolveAuthenticatedFileWorkspacePrincipal(ctx, args);
	}
	return await resolveBearerFileWorkspacePrincipal(ctx, args);
}

export function assertFileWorkspaceCapability(args: {
	capability: FileWorkspaceCapability;
	options?: FileWorkspaceCapabilityOptions;
	principal: FileWorkspacePrincipal;
}): FileWorkspaceAccessAllowed {
	const capabilities = capabilitiesForPrincipal(args.principal, args.options);
	if (!capabilities.has(args.capability)) {
		throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
	}
	return {
		allowed: true,
		capabilities,
		principal: args.principal,
	};
}
