import { ConvexError, v } from "convex/values";
import { authedMutation, authedQuery } from "../fluent";
import {
	assertFileWorkspaceCapability,
	resolveFileWorkspacePrincipal,
} from "./access";
import { actorAuthIdForPrincipal, requireNodeInBox } from "./helpers";
import { insertFileWorkspaceActivity } from "./operations";
import { FILE_WORKSPACE_SAFE_ERRORS } from "./securityEvents";
import { normalizeFileWorkspaceName } from "./validators";

function normalizeTagName(name: string) {
	return normalizeFileWorkspaceName(name);
}

export const listTags = authedQuery
	.input({ boxId: v.id("fileBoxes") })
	.handler(async (ctx, args) => {
		const resolved = await resolveFileWorkspacePrincipal(ctx, {
			boxId: args.boxId,
			viewer: ctx.viewer,
		});
		if (!resolved) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
		}
		const tags = await ctx.db
			.query("fileTags")
			.withIndex("by_box", (query) => query.eq("boxId", args.boxId))
			.collect();
		return tags.map((tag) => ({
			color: tag.color,
			name: tag.name,
			tagId: tag._id,
		}));
	})
	.public();

export const createTag = authedMutation
	.input({
		boxId: v.id("fileBoxes"),
		color: v.optional(v.string()),
		name: v.string(),
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
			capability: "tag_node",
			principal: resolved.principal,
		});
		const name = normalizeTagName(args.name);
		const normalizedName = name.toLocaleLowerCase("en-CA");
		const existing = await ctx.db
			.query("fileTags")
			.withIndex("by_box_name", (query) =>
				query.eq("boxId", args.boxId).eq("normalizedName", normalizedName)
			)
			.unique();
		if (existing) {
			return { tagId: existing._id };
		}
		const now = Date.now();
		const tagId = await ctx.db.insert("fileTags", {
			boxId: args.boxId,
			name,
			normalizedName,
			color: args.color,
			createdByAuthId: actorAuthIdForPrincipal(resolved.principal),
			createdAt: now,
			updatedAt: now,
		});
		return { tagId };
	})
	.public();

export const assignTag = authedMutation
	.input({
		boxId: v.id("fileBoxes"),
		nodeId: v.id("fileNodes"),
		tagId: v.id("fileTags"),
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
			capability: "tag_node",
			principal: resolved.principal,
		});
		const node = await requireNodeInBox(ctx, args);
		const tag = await ctx.db.get(args.tagId);
		if (!tag || tag.boxId !== args.boxId || node.deletedAt !== undefined) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.NODE_NOT_FOUND);
		}
		const existing = await ctx.db
			.query("fileNodeTags")
			.withIndex("by_node_tag", (query) =>
				query.eq("nodeId", args.nodeId).eq("tagId", args.tagId)
			)
			.unique();
		if (existing) {
			return { assignmentId: existing._id };
		}
		const assignmentId = await ctx.db.insert("fileNodeTags", {
			boxId: args.boxId,
			nodeId: args.nodeId,
			tagId: args.tagId,
			assignedByAuthId: actorAuthIdForPrincipal(resolved.principal),
			assignedAt: Date.now(),
		});
		await insertFileWorkspaceActivity(ctx, {
			boxId: args.boxId,
			eventType: "tag_assigned",
			nodeId: args.nodeId,
			principal: resolved.principal,
			targetId: args.tagId,
			targetType: "tag",
		});
		return { assignmentId };
	})
	.public();
