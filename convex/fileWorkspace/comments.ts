import { ConvexError, v } from "convex/values";
import { authedMutation, authedQuery } from "../fluent";
import {
	assertFileWorkspaceCapability,
	resolveFileWorkspacePrincipal,
} from "./access";
import {
	actorAuthIdForPrincipal,
	hasDeletedAncestor,
	requireNodeInBox,
} from "./helpers";
import { insertFileWorkspaceActivity } from "./operations";
import { FILE_WORKSPACE_SAFE_ERRORS } from "./securityEvents";

function normalizeCommentBody(body: string) {
	const normalized = body.trim();
	if (normalized.length === 0) {
		throw new ConvexError("Comment body is required.");
	}
	if (normalized.length > 4000) {
		throw new ConvexError("Comment body exceeds 4000 character limit.");
	}
	return normalized;
}

export const listComments = authedQuery
	.input({ boxId: v.id("fileBoxes"), nodeId: v.id("fileNodes") })
	.handler(async (ctx, args) => {
		const resolved = await resolveFileWorkspacePrincipal(ctx, {
			boxId: args.boxId,
			viewer: ctx.viewer,
		});
		if (!resolved) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
		}
		assertFileWorkspaceCapability({
			capability: "view_comments",
			principal: resolved.principal,
		});
		const node = await requireNodeInBox(ctx, args);
		if (
			node.nodeType !== "file" ||
			node.deletedAt !== undefined ||
			(await hasDeletedAncestor({ ctx, node }))
		) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.NODE_NOT_FOUND);
		}
		const comments = await ctx.db
			.query("fileComments")
			.withIndex("by_node", (query) => query.eq("nodeId", args.nodeId))
			.collect();
		return comments
			.filter((comment) => comment.deletedAt === undefined)
			.map((comment) => ({
				authorAuthId: comment.authorAuthId,
				body: comment.body,
				commentId: comment._id,
				createdAt: comment.createdAt,
				updatedAt: comment.updatedAt,
			}));
	})
	.public();

export const createComment = authedMutation
	.input({
		body: v.string(),
		boxId: v.id("fileBoxes"),
		nodeId: v.id("fileNodes"),
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
			capability: "comment_on_file",
			principal: resolved.principal,
		});
		const node = await requireNodeInBox(ctx, args);
		if (node.nodeType !== "file" || node.deletedAt !== undefined) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.NODE_NOT_FOUND);
		}
		const now = Date.now();
		const commentId = await ctx.db.insert("fileComments", {
			boxId: args.boxId,
			nodeId: args.nodeId,
			body: normalizeCommentBody(args.body),
			authorAuthId: actorAuthIdForPrincipal(resolved.principal),
			createdAt: now,
			updatedAt: now,
		});
		await insertFileWorkspaceActivity(ctx, {
			boxId: args.boxId,
			eventType: "comment_created",
			nodeId: args.nodeId,
			principal: resolved.principal,
			targetId: commentId,
			targetType: "comment",
		});
		return { commentId };
	})
	.public();
