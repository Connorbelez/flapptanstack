import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { Viewer } from "../fluent";
import { authedMutation } from "../fluent";
import {
	assertFileWorkspaceCapability,
	resolveFileWorkspacePrincipal,
} from "./access";
import {
	actorAuthIdForPrincipal,
	assertUniqueActiveSibling,
	isDescendantOf,
	isEditorLikePrincipal,
	isManagerLikePrincipal,
	requireActiveFolder,
	requireNodeInBox,
} from "./helpers";
import {
	insertFileWorkspaceActivity,
	insertFileWorkspaceSecurityEvent,
} from "./operations";
import { canPermanentlyDelete, canRestoreFromTrash } from "./retention";
import { FILE_WORKSPACE_SAFE_ERRORS } from "./securityEvents";
import {
	normalizeFileWorkspaceName,
	normalizeFileWorkspaceSiblingKey,
} from "./validators";

async function resolveMutationPrincipal(
	ctx: MutationCtx & { viewer: Viewer },
	boxId: Id<"fileBoxes">
) {
	const resolved = await resolveFileWorkspacePrincipal(ctx, {
		boxId,
		viewer: ctx.viewer,
	});
	if (!resolved) {
		throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
	}
	return resolved;
}

export const createFolder = authedMutation
	.input({
		boxId: v.id("fileBoxes"),
		name: v.string(),
		parentNodeId: v.id("fileNodes"),
	})
	.handler(async (ctx, args) => {
		const resolved = await resolveMutationPrincipal(ctx, args.boxId);
		assertFileWorkspaceCapability({
			capability: "create_folder",
			principal: resolved.principal,
		});
		await requireActiveFolder(ctx, {
			boxId: args.boxId,
			nodeId: args.parentNodeId,
		});
		const displayName = normalizeFileWorkspaceName(args.name);
		const normalizedSiblingKey = normalizeFileWorkspaceSiblingKey(displayName);
		await assertUniqueActiveSibling({
			boxId: args.boxId,
			ctx,
			displayName,
			normalizedSiblingKey,
			parentId: args.parentNodeId,
		});
		const now = Date.now();
		const nodeId = await ctx.db.insert("fileNodes", {
			boxId: args.boxId,
			parentId: args.parentNodeId,
			nodeType: "folder",
			displayName,
			normalizedSiblingKey,
			isRoot: false,
			createdByAuthId: actorAuthIdForPrincipal(resolved.principal),
			createdAt: now,
			updatedAt: now,
		});
		await insertFileWorkspaceActivity(ctx, {
			boxId: args.boxId,
			eventType: "folder_created",
			nodeId,
			principal: resolved.principal,
			targetId: nodeId,
			targetType: "node",
		});
		return { nodeId };
	})
	.public();

export const renameNode = authedMutation
	.input({
		boxId: v.id("fileBoxes"),
		name: v.string(),
		nodeId: v.id("fileNodes"),
	})
	.handler(async (ctx, args) => {
		const resolved = await resolveMutationPrincipal(ctx, args.boxId);
		assertFileWorkspaceCapability({
			capability: "rename_node",
			principal: resolved.principal,
		});
		const node = await requireNodeInBox(ctx, args);
		if (node.isRoot || node.deletedAt !== undefined) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.NODE_NOT_FOUND);
		}
		const displayName = normalizeFileWorkspaceName(args.name);
		const normalizedSiblingKey = normalizeFileWorkspaceSiblingKey(displayName);
		await assertUniqueActiveSibling({
			boxId: args.boxId,
			ctx,
			displayName,
			excludeNodeId: args.nodeId,
			normalizedSiblingKey,
			parentId: node.parentId,
		});
		await ctx.db.patch(args.nodeId, {
			displayName,
			normalizedSiblingKey,
			updatedAt: Date.now(),
		});
		await insertFileWorkspaceActivity(ctx, {
			boxId: args.boxId,
			eventType: "node_renamed",
			metadata: { previousName: node.displayName },
			nodeId: args.nodeId,
			principal: resolved.principal,
			targetId: args.nodeId,
			targetType: "node",
		});
		return { nodeId: args.nodeId };
	})
	.public();

export const moveNode = authedMutation
	.input({
		boxId: v.id("fileBoxes"),
		newParentNodeId: v.id("fileNodes"),
		nodeId: v.id("fileNodes"),
	})
	.handler(async (ctx, args) => {
		const resolved = await resolveMutationPrincipal(ctx, args.boxId);
		assertFileWorkspaceCapability({
			capability: "move_node",
			principal: resolved.principal,
		});
		const node = await requireNodeInBox(ctx, args);
		const newParent = await requireActiveFolder(ctx, {
			boxId: args.boxId,
			nodeId: args.newParentNodeId,
		});
		if (
			node.isRoot ||
			node.deletedAt !== undefined ||
			newParent.boxId !== node.boxId
		) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.NODE_NOT_FOUND);
		}
		if (
			node.nodeType === "folder" &&
			(await isDescendantOf({
				ancestorId: args.nodeId,
				ctx,
				nodeId: args.newParentNodeId,
			}))
		) {
			throw new ConvexError(
				"Cannot move a folder into itself or its descendant."
			);
		}
		await assertUniqueActiveSibling({
			boxId: args.boxId,
			ctx,
			displayName: node.displayName,
			excludeNodeId: args.nodeId,
			normalizedSiblingKey: node.normalizedSiblingKey,
			parentId: args.newParentNodeId,
		});
		await ctx.db.patch(args.nodeId, {
			parentId: args.newParentNodeId,
			updatedAt: Date.now(),
		});
		await insertFileWorkspaceActivity(ctx, {
			boxId: args.boxId,
			eventType: "node_moved",
			metadata: { previousParentId: node.parentId ?? "root" },
			nodeId: args.nodeId,
			principal: resolved.principal,
			targetId: args.nodeId,
			targetType: "node",
		});
		return { nodeId: args.nodeId };
	})
	.public();

export const softDeleteNode = authedMutation
	.input({ boxId: v.id("fileBoxes"), nodeId: v.id("fileNodes") })
	.handler(async (ctx, args) => {
		const resolved = await resolveMutationPrincipal(ctx, args.boxId);
		assertFileWorkspaceCapability({
			capability: "soft_delete_node",
			principal: resolved.principal,
		});
		const node = await requireNodeInBox(ctx, args);
		if (node.isRoot || node.deletedAt !== undefined) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.NODE_NOT_FOUND);
		}
		await ctx.db.patch(args.nodeId, {
			deletedAt: Date.now(),
			deletedByAuthId: actorAuthIdForPrincipal(resolved.principal),
			updatedAt: Date.now(),
		});
		await insertFileWorkspaceActivity(ctx, {
			boxId: args.boxId,
			eventType: "node_deleted",
			nodeId: args.nodeId,
			principal: resolved.principal,
			targetId: args.nodeId,
			targetType: "node",
		});
		return { nodeId: args.nodeId };
	})
	.public();

export const restoreNode = authedMutation
	.input({ boxId: v.id("fileBoxes"), nodeId: v.id("fileNodes") })
	.handler(async (ctx, args) => {
		const resolved = await resolveMutationPrincipal(ctx, args.boxId);
		const node = await requireNodeInBox(ctx, args);
		const restore = canRestoreFromTrash({
			deletedAt: node.deletedAt,
			isEditor:
				resolved.principal.kind === "authenticated" &&
				resolved.principal.role === "editor",
			now: Date.now(),
			policy: resolved.box.retentionPolicy,
		});
		if (!(restore.allowed && isEditorLikePrincipal(resolved.principal))) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
		}
		await assertUniqueActiveSibling({
			boxId: args.boxId,
			ctx,
			displayName: node.displayName,
			excludeNodeId: args.nodeId,
			normalizedSiblingKey: node.normalizedSiblingKey,
			parentId: node.parentId,
		});
		await ctx.db.patch(args.nodeId, {
			deletedAt: undefined,
			deletedByAuthId: undefined,
			updatedAt: Date.now(),
		});
		await insertFileWorkspaceActivity(ctx, {
			boxId: args.boxId,
			eventType: "node_restored",
			nodeId: args.nodeId,
			principal: resolved.principal,
			targetId: args.nodeId,
			targetType: "node",
		});
		return { nodeId: args.nodeId };
	})
	.public();

export const permanentlyDeleteNode = authedMutation
	.input({ boxId: v.id("fileBoxes"), nodeId: v.id("fileNodes") })
	.handler(async (ctx, args) => {
		const resolved = await resolveMutationPrincipal(ctx, args.boxId);
		assertFileWorkspaceCapability({
			capability: "request_permanent_delete",
			principal: resolved.principal,
		});
		if (!isManagerLikePrincipal(resolved.principal)) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
		}
		const node = await requireNodeInBox(ctx, args);
		const now = Date.now();
		const retention = canPermanentlyDelete({
			deletedAt: node.deletedAt,
			now,
			policy: resolved.box.retentionPolicy,
		});
		if (!retention.allowed) {
			await insertFileWorkspaceSecurityEvent(ctx, {
				boxId: args.boxId,
				eventType: "retention_delete_blocked",
				nodeId: args.nodeId,
				outcome: "blocked",
				principal: resolved.principal,
				reasonCode: retention.reasonCode,
			});
			return {
				nodeId: args.nodeId,
				permanentlyDeleted: false,
				reasonCode: retention.reasonCode,
			};
		}
		const nodesToDelete = await collectSubtreeNodes(ctx, {
			boxId: args.boxId,
			rootNodeId: args.nodeId,
		});
		const subtreeRetention = evaluatePermanentDeleteSubtree({
			nodes: nodesToDelete,
			now,
			policy: resolved.box.retentionPolicy,
			rootNodeId: args.nodeId,
		});
		if (!subtreeRetention.allowed) {
			await insertFileWorkspaceSecurityEvent(ctx, {
				boxId: args.boxId,
				eventType: "retention_delete_blocked",
				metadata: {
					blockedNodeId: subtreeRetention.blockedNode._id,
					blockedNodeName: subtreeRetention.blockedNode.displayName,
				},
				nodeId: args.nodeId,
				outcome: "blocked",
				principal: resolved.principal,
				reasonCode: subtreeRetention.reasonCode,
			});
			return {
				nodeId: args.nodeId,
				permanentlyDeleted: false,
				reasonCode: subtreeRetention.reasonCode,
			};
		}
		const versions = (
			await Promise.all(
				nodesToDelete.map((nodeToDelete) =>
					ctx.db
						.query("fileVersions")
						.withIndex("by_node_version", (query) =>
							query.eq("nodeId", nodeToDelete._id)
						)
						.collect()
				)
			)
		).flat();
		await insertFileWorkspaceSecurityEvent(ctx, {
			boxId: args.boxId,
			eventType: "node_permanently_deleted",
			metadata: {
				nodeCount: String(nodesToDelete.length),
				versionCount: String(versions.length),
			},
			nodeId: args.nodeId,
			outcome: "allowed",
			principal: resolved.principal,
		});
		const storageIds = new Set<Id<"_storage">>();
		for (const version of versions) {
			storageIds.add(version.storageId);
		}
		for (const storageId of storageIds) {
			await ctx.storage.delete(storageId);
		}
		for (const version of versions) {
			await ctx.db.delete(version._id);
		}
		for (const nodeToDelete of [...nodesToDelete].reverse()) {
			await ctx.db.delete(nodeToDelete._id);
		}
		await insertFileWorkspaceActivity(ctx, {
			boxId: args.boxId,
			eventType: "node_permanently_deleted",
			nodeId: args.nodeId,
			principal: resolved.principal,
			targetId: args.nodeId,
			targetType: "node",
		});
		return { nodeId: args.nodeId, permanentlyDeleted: true };
	})
	.public();

async function collectSubtreeNodes(
	ctx: Pick<MutationCtx, "db">,
	args: { boxId: Id<"fileBoxes">; rootNodeId: Id<"fileNodes"> }
) {
	const root = await requireNodeInBox(ctx, {
		boxId: args.boxId,
		nodeId: args.rootNodeId,
	});
	const nodes: (typeof root)[] = [];
	const queue = [root];
	while (queue.length > 0) {
		const node = queue.shift();
		if (!node) {
			break;
		}
		nodes.push(node);
		const children = await ctx.db
			.query("fileNodes")
			.withIndex("by_box_parent", (query) =>
				query.eq("boxId", args.boxId).eq("parentId", node._id)
			)
			.collect();
		queue.push(...children);
	}
	return nodes;
}

function evaluatePermanentDeleteSubtree(args: {
	nodes: Doc<"fileNodes">[];
	now: number;
	policy: Parameters<typeof canPermanentlyDelete>[0]["policy"];
	rootNodeId: Id<"fileNodes">;
}) {
	const nodesById = new Map(args.nodes.map((node) => [node._id, node]));
	const effectiveDeletedAtById = new Map<Id<"fileNodes">, number>();

	for (const node of args.nodes) {
		const parentDeletedAt = node.parentId
			? effectiveDeletedAtById.get(node.parentId)
			: undefined;
		const effectiveDeletedAt = node.deletedAt ?? parentDeletedAt;
		if (effectiveDeletedAt !== undefined) {
			effectiveDeletedAtById.set(node._id, effectiveDeletedAt);
		}
		const retention = canPermanentlyDelete({
			deletedAt: effectiveDeletedAt,
			now: args.now,
			policy: args.policy,
		});
		if (!retention.allowed) {
			return {
				allowed: false,
				blockedNode: node,
				reasonCode: retention.reasonCode,
			} as const;
		}
		if (
			node._id !== args.rootNodeId &&
			node.parentId &&
			!nodesById.has(node.parentId)
		) {
			return {
				allowed: false,
				blockedNode: node,
				reasonCode: "node_not_deleted",
			} as const;
		}
	}

	return { allowed: true } as const;
}
