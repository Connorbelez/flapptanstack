import { ConvexError, v } from "convex/values";
import { authedMutation } from "../fluent";
import {
	assertFileWorkspaceCapability,
	resolveFileWorkspacePrincipal,
} from "./access";
import {
	actorAuthIdForPrincipal,
	assertDeclaredFilePolicy,
	getNextVersionNumber,
	normalizeDeclaredFile,
	requireActiveFolder,
} from "./helpers";
import { insertFileWorkspaceActivity } from "./operations";
import { scheduleFileWorkspaceScan } from "./scanScheduling";
import { FILE_WORKSPACE_SAFE_ERRORS } from "./securityEvents";

const declaredFileValidator = v.object({
	contentType: v.optional(v.string()),
	name: v.string(),
	sha256: v.optional(v.string()),
	sizeBytes: v.number(),
});

export const requestUpload = authedMutation
	.input({
		boxId: v.id("fileBoxes"),
		declaredFile: declaredFileValidator,
		parentNodeId: v.id("fileNodes"),
	})
	.handler(async (ctx, args) => {
		const resolved = await resolveFileWorkspacePrincipal(ctx, {
			boxId: args.boxId,
			viewer: ctx.viewer,
		});
		if (!resolved) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
		}
		assertFileWorkspaceCapability({
			capability: "upload_file",
			principal: resolved.principal,
		});
		await requireActiveFolder(ctx, {
			boxId: args.boxId,
			nodeId: args.parentNodeId,
		});
		const declared = normalizeDeclaredFile(args.declaredFile);
		await assertDeclaredFilePolicy({
			box: resolved.box,
			ctx,
			declaredFile: args.declaredFile,
			displayName: declared.displayName,
		});
		const existingSibling = await ctx.db
			.query("fileNodes")
			.withIndex("by_box_parent_name", (query) =>
				query
					.eq("boxId", args.boxId)
					.eq("parentId", args.parentNodeId)
					.eq("normalizedSiblingKey", declared.normalizedSiblingKey)
					.eq("deletedAt", undefined)
			)
			.first();
		if (existingSibling && existingSibling.nodeType !== "file") {
			throw new ConvexError(
				FILE_WORKSPACE_SAFE_ERRORS.SIBLING_NAME_EXISTS(declared.displayName)
			);
		}
		return {
			uploadUrl: await ctx.storage.generateUploadUrl(),
		};
	})
	.public();

export const finalizeUpload = authedMutation
	.input({
		boxId: v.id("fileBoxes"),
		declaredFile: declaredFileValidator,
		parentNodeId: v.id("fileNodes"),
		storageId: v.id("_storage"),
	})
	.handler(async (ctx, args) => {
		const resolved = await resolveFileWorkspacePrincipal(ctx, {
			boxId: args.boxId,
			viewer: ctx.viewer,
		});
		if (!resolved) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
		}
		assertFileWorkspaceCapability({
			capability: "upload_file",
			principal: resolved.principal,
		});
		await requireActiveFolder(ctx, {
			boxId: args.boxId,
			nodeId: args.parentNodeId,
		});
		const declared = normalizeDeclaredFile(args.declaredFile);
		await assertDeclaredFilePolicy({
			box: resolved.box,
			ctx,
			declaredFile: args.declaredFile,
			displayName: declared.displayName,
		});
		const existingSibling = await ctx.db
			.query("fileNodes")
			.withIndex("by_box_parent_name", (query) =>
				query
					.eq("boxId", args.boxId)
					.eq("parentId", args.parentNodeId)
					.eq("normalizedSiblingKey", declared.normalizedSiblingKey)
					.eq("deletedAt", undefined)
			)
			.first();
		const now = Date.now();
		if (existingSibling && existingSibling.nodeType !== "file") {
			throw new ConvexError(
				FILE_WORKSPACE_SAFE_ERRORS.SIBLING_NAME_EXISTS(declared.displayName)
			);
		}
		const nodeId =
			existingSibling?._id ??
			(await ctx.db.insert("fileNodes", {
				boxId: args.boxId,
				parentId: args.parentNodeId,
				nodeType: "file",
				displayName: declared.displayName,
				normalizedSiblingKey: declared.normalizedSiblingKey,
				isRoot: false,
				createdByAuthId: actorAuthIdForPrincipal(resolved.principal),
				createdAt: now,
				updatedAt: now,
			}));
		const versionId = await ctx.db.insert("fileVersions", {
			boxId: args.boxId,
			nodeId,
			versionNumber: existingSibling
				? await getNextVersionNumber({ ctx, nodeId })
				: 1,
			storageId: args.storageId,
			sizeBytes: declared.sizeBytes,
			contentType: declared.contentType ?? "application/octet-stream",
			sha256: declared.sha256,
			uploadedByAuthId: actorAuthIdForPrincipal(resolved.principal),
			uploadedAt: now,
			scanState: "pending_scan",
		});
		if (!existingSibling) {
			await ctx.db.patch(nodeId, {
				currentVersionId: versionId,
				updatedAt: now,
			});
		}
		if (existingSibling) {
			await insertFileWorkspaceActivity(ctx, {
				boxId: args.boxId,
				eventType: "file_version_created",
				nodeId,
				principal: resolved.principal,
				targetId: versionId,
				targetType: "version",
			});
		} else {
			await insertFileWorkspaceActivity(ctx, {
				boxId: args.boxId,
				eventType: "file_uploaded",
				nodeId,
				principal: resolved.principal,
				targetId: nodeId,
				targetType: "node",
			});
			await insertFileWorkspaceActivity(ctx, {
				boxId: args.boxId,
				eventType: "file_version_created",
				nodeId,
				principal: resolved.principal,
				targetId: versionId,
				targetType: "version",
			});
		}
		await scheduleFileWorkspaceScan(ctx, {
			box: resolved.box,
			declaredContentType: declared.contentType,
			declaredFilename: declared.displayName,
			declaredSizeBytes: declared.sizeBytes,
			storageId: args.storageId,
			versionId,
		});
		return {
			nodeId,
			scanRequest: {
				declaredContentType: declared.contentType,
				declaredFilename: declared.displayName,
				declaredSizeBytes: declared.sizeBytes,
				storageId: args.storageId,
				versionId,
			},
			versionId,
		};
	})
	.public();
