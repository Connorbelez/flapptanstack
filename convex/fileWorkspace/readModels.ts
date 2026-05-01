import { ConvexError, v } from "convex/values";
import { authedQuery, convex } from "../fluent";
import {
	assertFileWorkspaceCapability,
	resolveFileWorkspacePrincipal,
} from "./access";
import {
	collectBreadcrumbs,
	getCurrentVisibleVersion,
	hasDeletedAncestor,
	requireActiveFolder,
} from "./helpers";
import { participantKeyForAuthId, participantKeyForEmail } from "./identity";
import { insertFileWorkspaceSecurityEvent } from "./operations";
import { FILE_WORKSPACE_SAFE_ERRORS } from "./securityEvents";

interface BoxIndexSummary {
	boxId: string;
	createdAt: number;
	description?: string;
	name: string;
	principalKind: "authenticated" | "platform_admin";
	role: "editor" | "manager" | "platform_admin" | "viewer";
	status: "active" | "archived" | "disabled" | "suspended";
	updatedAt: number;
	visibility: "disabled" | "magic_link" | "private" | "public_link";
}

function summarizeLinkForSettings(link: {
	_id: string;
	createdAt: number;
	createdByAuthId: string;
	downloadEnabled: boolean;
	expiresAt?: number;
	lastUsedAt?: number;
	linkKind: "public_link" | "magic_link";
	revokedAt?: number;
	revokedByAuthId?: string;
	viewEnabled: boolean;
}) {
	return {
		createdAt: link.createdAt,
		createdByAuthId: link.createdByAuthId,
		downloadEnabled: link.downloadEnabled,
		expiresAt: link.expiresAt,
		lastUsedAt: link.lastUsedAt,
		linkId: link._id,
		linkKind: link.linkKind,
		revokedAt: link.revokedAt,
		revokedByAuthId: link.revokedByAuthId,
		viewEnabled: link.viewEnabled,
	};
}

function summarizeParticipantForSettings(participant: {
	_id: string;
	acceptedAt?: number;
	authId?: string;
	createdAt: number;
	email?: string;
	invitedAt?: number;
	participantKey: string;
	revokedAt?: number;
	role: "viewer" | "editor" | "manager";
	status: "active" | "invited" | "revoked";
	updatedAt: number;
	userId?: string;
}) {
	return {
		acceptedAt: participant.acceptedAt,
		authId: participant.authId,
		createdAt: participant.createdAt,
		email: participant.email,
		invitedAt: participant.invitedAt,
		participantId: participant._id,
		participantKey: participant.participantKey,
		revokedAt: participant.revokedAt,
		role: participant.role,
		status: participant.status,
		updatedAt: participant.updatedAt,
		userId: participant.userId,
	};
}

export const listBoxIndex = authedQuery
	.handler(async (ctx) => {
		if (ctx.viewer.isFairLendAdmin) {
			const boxes = await ctx.db
				.query("fileBoxes")
				.withIndex("by_created_at")
				.order("desc")
				.collect();
			return boxes.map((box) => ({
				boxId: box._id,
				createdAt: box.createdAt,
				description: box.description,
				name: box.name,
				principalKind: "platform_admin" as const,
				role: "platform_admin" as const,
				status: box.status,
				updatedAt: box.updatedAt,
				visibility: box.visibility,
			}));
		}
		const participantKeys = [participantKeyForAuthId(ctx.viewer.authId)];
		if (ctx.viewer.verifiedEmail) {
			participantKeys.push(participantKeyForEmail(ctx.viewer.verifiedEmail));
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
		const summaries: BoxIndexSummary[] = [];
		for (const participant of participantRows) {
			if (seen.has(participant.boxId)) {
				continue;
			}
			seen.add(participant.boxId);
			const box = await ctx.db.get(participant.boxId);
			if (!box || box.status === "disabled" || box.status === "suspended") {
				continue;
			}
			summaries.push({
				boxId: box._id,
				createdAt: box.createdAt,
				description: box.description,
				name: box.name,
				principalKind: "authenticated" as const,
				role: participant.role,
				status: box.status,
				updatedAt: box.updatedAt,
				visibility: box.visibility,
			});
		}
		return summaries.sort((left, right) => right.updatedAt - left.updatedAt);
	})
	.public();

export const getManagerSettings = authedQuery
	.input({ boxId: v.id("fileBoxes") })
	.handler(async (ctx, args) => {
		const resolved = await resolveFileWorkspacePrincipal(ctx, {
			boxId: args.boxId,
			requireActiveBox: false,
			viewer: ctx.viewer,
		});
		if (!resolved) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
		}
		assertFileWorkspaceCapability({
			capability: "manage_box_settings",
			principal: resolved.principal,
		});
		const participants = await ctx.db
			.query("fileBoxParticipants")
			.withIndex("by_box", (query) => query.eq("boxId", args.boxId))
			.collect();
		const links = await ctx.db
			.query("fileShareLinks")
			.withIndex("by_box", (query) => query.eq("boxId", args.boxId))
			.collect();
		return {
			box: {
				archivedAt: resolved.box.archivedAt,
				boxId: resolved.box._id,
				description: resolved.box.description,
				downloadPolicy: resolved.box.downloadPolicy,
				name: resolved.box.name,
				retentionPolicy: resolved.box.retentionPolicy,
				scanPolicy: resolved.box.scanPolicy,
				status: resolved.box.status,
				storageLimits: resolved.box.storageLimits,
				updatedAt: resolved.box.updatedAt,
				visibility: resolved.box.visibility,
			},
			links: links.map(summarizeLinkForSettings),
			participants: participants
				.filter((participant) => participant.status !== "revoked")
				.map(summarizeParticipantForSettings),
			principalKind: resolved.principal.kind,
		};
	})
	.public();

export const getCapabilityPreview = authedQuery
	.input({ boxId: v.id("fileBoxes") })
	.handler(async (ctx, args) => {
		const resolved = await resolveFileWorkspacePrincipal(ctx, {
			boxId: args.boxId,
			viewer: ctx.viewer,
		});
		if (!resolved) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
		}
		return {
			boxId: resolved.box._id,
			capabilities: [...resolved.capabilities].sort(),
			principalKind: resolved.principal.kind,
			role:
				resolved.principal.kind === "authenticated"
					? resolved.principal.role
					: resolved.principal.kind,
		};
	})
	.public();

async function summarizeNodeForTree(
	ctx: Parameters<typeof resolveFileWorkspacePrincipal>[0],
	node: {
		_id: string;
		createdAt: number;
		currentVersionId?: string;
		displayName: string;
		isRoot: boolean;
		nodeType: "file" | "folder";
		updatedAt: number;
	}
) {
	const currentVersion =
		node.nodeType === "file"
			? await getCurrentVisibleVersion({
					ctx,
					node: node as never,
				})
			: null;
	return {
		createdAt: node.createdAt,
		currentVersion: currentVersion
			? {
					contentType: currentVersion.contentType,
					scanState: currentVersion.scanState,
					sizeBytes: currentVersion.sizeBytes,
					versionId: currentVersion._id,
					versionNumber: currentVersion.versionNumber,
				}
			: null,
		displayName: node.displayName,
		isRoot: node.isRoot,
		nodeId: node._id,
		nodeType: node.nodeType,
		updatedAt: node.updatedAt,
	};
}

export const listNodes = authedQuery
	.input({
		boxId: v.id("fileBoxes"),
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
			capability: "list_nodes",
			principal: resolved.principal,
		});
		const parent = await requireActiveFolder(ctx, {
			boxId: args.boxId,
			nodeId: args.parentNodeId,
		});
		const children = await ctx.db
			.query("fileNodes")
			.withIndex("by_box_parent", (query) =>
				query
					.eq("boxId", args.boxId)
					.eq("parentId", args.parentNodeId)
					.eq("deletedAt", undefined)
			)
			.collect();
		const visibleChildren: Awaited<ReturnType<typeof summarizeNodeForTree>>[] =
			[];
		for (const child of children) {
			if (!(await hasDeletedAncestor({ ctx, node: child }))) {
				visibleChildren.push(await summarizeNodeForTree(ctx, child));
			}
		}
		return {
			breadcrumbs: await collectBreadcrumbs({ ctx, node: parent }),
			boxId: args.boxId,
			nodes: visibleChildren.sort((left, right) => {
				if (left.nodeType !== right.nodeType) {
					return left.nodeType === "folder" ? -1 : 1;
				}
				return left.displayName.localeCompare(right.displayName);
			}),
			parentNodeId: args.parentNodeId,
			principalKind: resolved.principal.kind,
		};
	})
	.public();

export const listBearerNodes = convex
	.mutation()
	.input({
		parentNodeId: v.id("fileNodes"),
		rawToken: v.string(),
	})
	.handler(async (ctx, args) => {
		const resolved = await resolveFileWorkspacePrincipal(ctx, {
			rawToken: args.rawToken,
		});
		if (!resolved) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
		}
		await insertFileWorkspaceSecurityEvent(ctx, {
			boxId: resolved.box._id,
			eventType: "link_opened",
			linkId: resolved.link?._id,
			outcome: "allowed",
			principal: resolved.principal,
		});
		const parent = await requireActiveFolder(ctx, {
			boxId: resolved.box._id,
			nodeId: args.parentNodeId,
		});
		const children = await ctx.db
			.query("fileNodes")
			.withIndex("by_box_parent", (query) =>
				query
					.eq("boxId", resolved.box._id)
					.eq("parentId", args.parentNodeId)
					.eq("deletedAt", undefined)
			)
			.collect();
		const visibleChildren: Awaited<ReturnType<typeof summarizeNodeForTree>>[] =
			[];
		for (const child of children) {
			if (!(await hasDeletedAncestor({ ctx, node: child }))) {
				const summarized = await summarizeNodeForTree(ctx, child);
				if (summarized.nodeType === "folder" || summarized.currentVersion) {
					visibleChildren.push(summarized);
				}
			}
		}
		return {
			breadcrumbs: await collectBreadcrumbs({ ctx, node: parent }),
			boxId: resolved.box._id,
			linkKind: resolved.principal.kind,
			nodes: visibleChildren,
			parentNodeId: args.parentNodeId,
		};
	})
	.public();
