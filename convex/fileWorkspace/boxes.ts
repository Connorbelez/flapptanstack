import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { Viewer } from "../fluent";
import { authedMutation, authedQuery, brokerMutation } from "../fluent";
import { principalForParticipant, principalForPlatformAdmin } from "./access";
import { participantKeyForAuthId } from "./identity";
import {
	assertCanCreateFileWorkspaceBox,
	assertManagerOrPlatformAdmin,
	DEFAULT_FILE_WORKSPACE_DOWNLOAD_POLICY,
	DEFAULT_FILE_WORKSPACE_RETENTION_POLICY,
	DEFAULT_FILE_WORKSPACE_SCAN_POLICY,
	DEFAULT_FILE_WORKSPACE_STORAGE_LIMITS,
	getUserIdForAuthId,
	insertFileWorkspaceActivity,
	insertFileWorkspaceSecurityEvent,
	normalizeRootFolderName,
	resolveBoxAuthenticatedPrincipal,
	summarizeBoxForPrincipal,
} from "./operations";
import { FILE_WORKSPACE_SAFE_ERRORS } from "./securityEvents";
import {
	fileBoxVisibilityValidator,
	fileWorkspaceDownloadPolicyValidator,
	fileWorkspaceRetentionPolicyValidator,
	fileWorkspaceScanPolicyValidator,
	fileWorkspaceStorageLimitsValidator,
	normalizeFileWorkspaceName,
} from "./validators";

const createBoxInput = {
	description: v.optional(v.string()),
	downloadPolicy: v.optional(fileWorkspaceDownloadPolicyValidator),
	name: v.string(),
	retentionPolicy: v.optional(fileWorkspaceRetentionPolicyValidator),
	scanPolicy: v.optional(fileWorkspaceScanPolicyValidator),
	storageLimits: v.optional(fileWorkspaceStorageLimitsValidator),
	visibility: v.optional(fileBoxVisibilityValidator),
};

const boxPatchInput = {
	description: v.optional(v.string()),
	downloadPolicy: v.optional(fileWorkspaceDownloadPolicyValidator),
	name: v.optional(v.string()),
	retentionPolicy: v.optional(fileWorkspaceRetentionPolicyValidator),
	scanPolicy: v.optional(fileWorkspaceScanPolicyValidator),
	storageLimits: v.optional(fileWorkspaceStorageLimitsValidator),
	visibility: v.optional(fileBoxVisibilityValidator),
};

type BoxSummary = ReturnType<typeof summarizeBoxForPrincipal>;

async function getRootNodeId(
	ctx: Pick<QueryCtx, "db">,
	boxId: Id<"fileBoxes">
): Promise<Id<"fileNodes"> | undefined> {
	const root = await ctx.db
		.query("fileNodes")
		.withIndex("by_box_parent", (query) =>
			query.eq("boxId", boxId).eq("parentId", undefined)
		)
		.filter((query) => query.eq(query.field("isRoot"), true))
		.first();
	return root?._id;
}

async function requireBoxAccess(
	ctx: Pick<QueryCtx, "db"> & { viewer: Viewer },
	args: {
		boxId: Id<"fileBoxes">;
		requireActiveBox?: boolean;
	}
) {
	const principal = await resolveBoxAuthenticatedPrincipal(ctx, {
		boxId: args.boxId,
		requireActiveBox: args.requireActiveBox,
		viewer: ctx.viewer,
	});
	if (!principal) {
		throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
	}
	return principal;
}

function shouldListParticipantBox(box: Doc<"fileBoxes">): boolean {
	return box.status !== "disabled" && box.status !== "suspended";
}

export const createBox = brokerMutation
	.input(createBoxInput)
	.handler(async (ctx, args) => {
		assertCanCreateFileWorkspaceBox(ctx.viewer);
		const now = Date.now();
		const name = normalizeFileWorkspaceName(args.name);
		const userId = await getUserIdForAuthId(ctx, ctx.viewer.authId);
		const boxId = await ctx.db.insert("fileBoxes", {
			name,
			description: args.description?.trim() || undefined,
			createdByAuthId: ctx.viewer.authId,
			createdByUserId: userId,
			status: "active",
			visibility: args.visibility ?? "private",
			downloadPolicy:
				args.downloadPolicy ?? DEFAULT_FILE_WORKSPACE_DOWNLOAD_POLICY,
			retentionPolicy:
				args.retentionPolicy ?? DEFAULT_FILE_WORKSPACE_RETENTION_POLICY,
			scanPolicy: args.scanPolicy ?? DEFAULT_FILE_WORKSPACE_SCAN_POLICY,
			storageLimits:
				args.storageLimits ?? DEFAULT_FILE_WORKSPACE_STORAGE_LIMITS,
			createdAt: now,
			updatedAt: now,
		});

		const root = normalizeRootFolderName();
		const rootNodeId = await ctx.db.insert("fileNodes", {
			boxId,
			nodeType: "folder",
			displayName: root.displayName,
			normalizedSiblingKey: root.normalizedSiblingKey,
			isRoot: true,
			createdByAuthId: ctx.viewer.authId,
			createdAt: now,
			updatedAt: now,
		});

		await ctx.db.insert("fileBoxParticipants", {
			boxId,
			participantKey: participantKeyForAuthId(ctx.viewer.authId),
			authId: ctx.viewer.authId,
			userId,
			email: ctx.viewer.email,
			role: "manager",
			status: "active",
			createdAt: now,
			updatedAt: now,
		});

		const principal = principalForParticipant({
			authId: ctx.viewer.authId,
			email: ctx.viewer.email,
			role: "manager",
		});
		await insertFileWorkspaceActivity(ctx, {
			boxId,
			eventType: "box_created",
			principal,
			targetId: boxId,
			targetType: "box",
		});
		await insertFileWorkspaceSecurityEvent(ctx, {
			boxId,
			eventType: "box_created",
			outcome: "allowed",
			principal,
		});

		return { boxId, rootNodeId };
	})
	.public();

export const listBoxes = authedQuery
	.handler(async (ctx) => {
		if (ctx.viewer.isFairLendAdmin) {
			const boxes = await ctx.db
				.query("fileBoxes")
				.withIndex("by_created_at")
				.order("desc")
				.collect();
			return await Promise.all(
				boxes.map(async (box) =>
					summarizeBoxForPrincipal({
						box,
						principal: principalForPlatformAdmin(ctx.viewer),
						rootNodeId: await getRootNodeId(ctx, box._id),
					})
				)
			);
		}

		const participantKeys = [participantKeyForAuthId(ctx.viewer.authId)];
		if (ctx.viewer.verifiedEmail) {
			participantKeys.push(`email:${ctx.viewer.verifiedEmail}`);
		}

		const participantRows = (
			await Promise.all(
				participantKeys.map((participantKey) =>
					ctx.db
						.query("fileBoxParticipants")
						.withIndex("by_participant", (query) =>
							query.eq("participantKey", participantKey).eq("status", "active")
						)
						.collect()
				)
			)
		).flat();

		const seen = new Set<string>();
		const summaries: BoxSummary[] = [];
		for (const participant of participantRows) {
			if (seen.has(participant.boxId)) {
				continue;
			}
			seen.add(participant.boxId);
			const box = await ctx.db.get(participant.boxId);
			if (!(box && shouldListParticipantBox(box))) {
				continue;
			}
			summaries.push(
				summarizeBoxForPrincipal({
					box,
					principal: principalForParticipant({
						authId: ctx.viewer.authId,
						email: ctx.viewer.email,
						role: participant.role,
					}),
					rootNodeId: await getRootNodeId(ctx, box._id),
				})
			);
		}
		return summaries.sort((left, right) => right.updatedAt - left.updatedAt);
	})
	.public();

export const getBox = authedQuery
	.input({ boxId: v.id("fileBoxes") })
	.handler(async (ctx, args) => {
		const principal = await requireBoxAccess(ctx, {
			boxId: args.boxId,
			requireActiveBox: false,
		});
		const box = await ctx.db.get(args.boxId);
		if (!box) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
		}
		return summarizeBoxForPrincipal({
			box,
			principal,
			rootNodeId: await getRootNodeId(ctx, box._id),
		});
	})
	.public();

export const updateBox = authedMutation
	.input({
		boxId: v.id("fileBoxes"),
		patch: v.object(boxPatchInput),
	})
	.handler(async (ctx, args) => {
		const principal = await resolveBoxAuthenticatedPrincipal(ctx, {
			boxId: args.boxId,
			requireActiveBox: false,
			viewer: ctx.viewer,
		});
		assertManagerOrPlatformAdmin(principal);
		const box = await ctx.db.get(args.boxId);
		if (!box) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
		}
		const patch: Partial<Doc<"fileBoxes">> = { updatedAt: Date.now() };
		if (args.patch.description !== undefined) {
			patch.description = args.patch.description.trim() || undefined;
		}
		if (args.patch.downloadPolicy !== undefined) {
			patch.downloadPolicy = args.patch.downloadPolicy;
		}
		if (args.patch.name !== undefined) {
			patch.name = normalizeFileWorkspaceName(args.patch.name);
		}
		if (args.patch.retentionPolicy !== undefined) {
			patch.retentionPolicy = args.patch.retentionPolicy;
		}
		if (args.patch.scanPolicy !== undefined) {
			patch.scanPolicy = args.patch.scanPolicy;
		}
		if (args.patch.storageLimits !== undefined) {
			patch.storageLimits = args.patch.storageLimits;
		}
		if (args.patch.visibility !== undefined) {
			patch.visibility = args.patch.visibility;
		}
		await ctx.db.patch(args.boxId, patch);
		await insertFileWorkspaceSecurityEvent(ctx, {
			boxId: args.boxId,
			eventType: "box_updated",
			outcome: "allowed",
			principal,
		});
		return { boxId: args.boxId };
	})
	.public();

export const archiveBox = authedMutation
	.input({ boxId: v.id("fileBoxes") })
	.handler(async (ctx, args) => {
		const principal = await resolveBoxAuthenticatedPrincipal(ctx, {
			boxId: args.boxId,
			requireActiveBox: false,
			viewer: ctx.viewer,
		});
		assertManagerOrPlatformAdmin(principal);
		const now = Date.now();
		await ctx.db.patch(args.boxId, {
			archivedAt: now,
			status: "archived",
			updatedAt: now,
			visibility: "disabled",
		});
		await insertFileWorkspaceSecurityEvent(ctx, {
			boxId: args.boxId,
			eventType: "box_archived",
			outcome: "allowed",
			principal,
		});
		return { boxId: args.boxId };
	})
	.public();
