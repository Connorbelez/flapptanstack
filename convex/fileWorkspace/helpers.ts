import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
	isFileWorkspaceScanStateVisible,
	validateFileWorkspaceBoxQuota,
	validateFileWorkspaceContentType,
	validateFileWorkspaceExtension,
	validateFileWorkspaceFileSize,
} from "./policy";
import { FILE_WORKSPACE_SAFE_ERRORS } from "./securityEvents";
import type { FileWorkspacePrincipal } from "./types";
import {
	normalizeFileWorkspaceName,
	normalizeFileWorkspaceSiblingKey,
} from "./validators";

export interface DeclaredFileInput {
	contentType?: string;
	name: string;
	sha256?: string;
	sizeBytes: number;
}

export function actorAuthIdForPrincipal(
	principal: FileWorkspacePrincipal
): string {
	if (
		principal.kind === "authenticated" ||
		principal.kind === "platform_admin"
	) {
		return principal.authId;
	}
	return `link:${principal.linkId}`;
}

export function isEditorLikePrincipal(
	principal: FileWorkspacePrincipal
): boolean {
	return (
		principal.kind === "platform_admin" ||
		(principal.kind === "authenticated" &&
			(principal.role === "editor" || principal.role === "manager"))
	);
}

export function isManagerLikePrincipal(
	principal: FileWorkspacePrincipal
): boolean {
	return (
		principal.kind === "platform_admin" ||
		(principal.kind === "authenticated" && principal.role === "manager")
	);
}

export function normalizeDeclaredFile(declaredFile: DeclaredFileInput) {
	const displayName = normalizeFileWorkspaceName(declaredFile.name);
	if (
		!Number.isSafeInteger(declaredFile.sizeBytes) ||
		declaredFile.sizeBytes < 0
	) {
		throw new ConvexError("File size metadata is invalid.");
	}
	return {
		contentType: declaredFile.contentType,
		displayName,
		normalizedSiblingKey: normalizeFileWorkspaceSiblingKey(displayName),
		sha256: declaredFile.sha256 ?? "pending",
		sizeBytes: declaredFile.sizeBytes,
	};
}

export async function getActiveRootNode(
	ctx: Pick<QueryCtx, "db">,
	boxId: Id<"fileBoxes">
) {
	return await ctx.db
		.query("fileNodes")
		.withIndex("by_box_parent", (query) =>
			query.eq("boxId", boxId).eq("parentId", undefined)
		)
		.filter((query) => query.eq(query.field("isRoot"), true))
		.first();
}

export async function requireNodeInBox(
	ctx: Pick<QueryCtx, "db">,
	args: { boxId: Id<"fileBoxes">; nodeId: Id<"fileNodes"> }
) {
	const node = await ctx.db.get(args.nodeId);
	if (!node || node.boxId !== args.boxId) {
		throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.NODE_NOT_FOUND);
	}
	return node;
}

export async function requireActiveFolder(
	ctx: Pick<QueryCtx, "db">,
	args: { boxId: Id<"fileBoxes">; nodeId: Id<"fileNodes"> }
) {
	const folder = await requireNodeInBox(ctx, args);
	if (folder.nodeType !== "folder" || folder.deletedAt !== undefined) {
		throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.NODE_NOT_FOUND);
	}
	return folder;
}

export async function assertUniqueActiveSibling(args: {
	boxId: Id<"fileBoxes">;
	ctx: Pick<QueryCtx, "db">;
	displayName: string;
	excludeNodeId?: Id<"fileNodes">;
	normalizedSiblingKey: string;
	parentId?: Id<"fileNodes">;
}) {
	const collision = await args.ctx.db
		.query("fileNodes")
		.withIndex("by_box_parent_name", (query) =>
			query
				.eq("boxId", args.boxId)
				.eq("parentId", args.parentId)
				.eq("normalizedSiblingKey", args.normalizedSiblingKey)
				.eq("deletedAt", undefined)
		)
		.first();
	if (collision && collision._id !== args.excludeNodeId) {
		throw new ConvexError(
			FILE_WORKSPACE_SAFE_ERRORS.SIBLING_NAME_EXISTS(args.displayName)
		);
	}
}

export async function isDescendantOf(args: {
	ancestorId: Id<"fileNodes">;
	ctx: Pick<QueryCtx, "db">;
	nodeId?: Id<"fileNodes">;
}) {
	let currentId = args.nodeId;
	const seen = new Set<string>();
	while (currentId) {
		if (currentId === args.ancestorId) {
			return true;
		}
		if (seen.has(currentId)) {
			return true;
		}
		seen.add(currentId);
		const current = await args.ctx.db.get(currentId);
		currentId = current?.parentId;
	}
	return false;
}

export async function hasDeletedAncestor(args: {
	ctx: Pick<QueryCtx, "db">;
	node: Doc<"fileNodes">;
}) {
	let parentId = args.node.parentId;
	const seen = new Set<string>();
	while (parentId) {
		if (seen.has(parentId)) {
			return true;
		}
		seen.add(parentId);
		const parent = await args.ctx.db.get(parentId);
		if (!parent || parent.deletedAt !== undefined) {
			return true;
		}
		parentId = parent.parentId;
	}
	return false;
}

export async function collectBreadcrumbs(args: {
	ctx: Pick<QueryCtx, "db">;
	node: Doc<"fileNodes">;
}) {
	const breadcrumbs: Array<{ displayName: string; nodeId: Id<"fileNodes"> }> =
		[];
	let current: Doc<"fileNodes"> | null = args.node;
	const seen = new Set<string>();
	while (current && !seen.has(current._id)) {
		seen.add(current._id);
		breadcrumbs.push({ displayName: current.displayName, nodeId: current._id });
		current = current.parentId ? await args.ctx.db.get(current.parentId) : null;
	}
	return breadcrumbs.reverse();
}

export async function getNextVersionNumber(args: {
	ctx: Pick<QueryCtx, "db">;
	nodeId: Id<"fileNodes">;
}) {
	const versions = await args.ctx.db
		.query("fileVersions")
		.withIndex("by_node_version", (query) => query.eq("nodeId", args.nodeId))
		.collect();
	return (
		versions.reduce((max, version) => Math.max(max, version.versionNumber), 0) +
		1
	);
}

export async function getCurrentVisibleVersion(args: {
	ctx: Pick<QueryCtx, "db">;
	node: Doc<"fileNodes">;
}) {
	if (!args.node.currentVersionId) {
		return null;
	}
	const version = await args.ctx.db.get(args.node.currentVersionId);
	if (!(version && isFileWorkspaceScanStateVisible(version.scanState))) {
		return null;
	}
	return version;
}

export async function getBoxStorageBytes(
	ctx: Pick<QueryCtx, "db">,
	boxId: Id<"fileBoxes">
) {
	const versions = await ctx.db
		.query("fileVersions")
		.withIndex("by_box_scan_state", (query) => query.eq("boxId", boxId))
		.collect();
	return versions.reduce((sum, version) => sum + version.sizeBytes, 0);
}

export async function assertDeclaredFilePolicy(args: {
	box: Doc<"fileBoxes">;
	ctx: Pick<QueryCtx, "db">;
	declaredFile: DeclaredFileInput;
	displayName: string;
}) {
	const size = validateFileWorkspaceFileSize({
		policy: args.box.scanPolicy,
		sizeBytes: args.declaredFile.sizeBytes,
		storageLimits: args.box.storageLimits,
	});
	if (!size.allowed) {
		throw new ConvexError(size.message);
	}
	const quota = validateFileWorkspaceBoxQuota({
		currentBoxBytes: await getBoxStorageBytes(args.ctx, args.box._id),
		incomingSizeBytes: args.declaredFile.sizeBytes,
		storageLimits: args.box.storageLimits,
	});
	if (!quota.allowed) {
		throw new ConvexError(quota.message);
	}
	const contentType = validateFileWorkspaceContentType({
		contentType: args.declaredFile.contentType,
		policy: args.box.scanPolicy,
	});
	if (!contentType.allowed) {
		throw new ConvexError(contentType.message);
	}
	const extension = validateFileWorkspaceExtension({
		contentType: args.declaredFile.contentType,
		displayName: args.displayName,
		policy: args.box.scanPolicy,
	});
	if (!extension.allowed) {
		throw new ConvexError(extension.message);
	}
}

export function assertVersionUrlEligible(version: Doc<"fileVersions">) {
	if (!isFileWorkspaceScanStateVisible(version.scanState)) {
		throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.FILE_VERSION_BLOCKED);
	}
}
