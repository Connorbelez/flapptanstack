import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { Viewer } from "../fluent";
import { authedMutation, authedQuery, convex } from "../fluent";
import {
	assertFileWorkspaceCapability,
	resolveFileWorkspacePrincipal,
} from "./access";
import {
	actorAuthIdForPrincipal,
	assertDeclaredFilePolicy,
	assertVersionUrlEligible,
	collectBreadcrumbs,
	getNextVersionNumber,
	hasDeletedAncestor,
	isEditorLikePrincipal,
	requireNodeInBox,
} from "./helpers";
import {
	insertFileWorkspaceActivity,
	insertFileWorkspaceSecurityEvent,
} from "./operations";
import { isFileWorkspaceScanStateVisible } from "./policy";
import { scheduleFileWorkspaceScan } from "./scanScheduling";
import { FILE_WORKSPACE_SAFE_ERRORS } from "./securityEvents";

const declaredReplacementValidator = v.object({
	contentType: v.optional(v.string()),
	name: v.string(),
	sha256: v.optional(v.string()),
	sizeBytes: v.number(),
});

function summarizeVersion(version: {
	_id: string;
	contentType: string;
	releasedAt?: number;
	scanCompletedAt?: number;
	scanReason?: string;
	scanState: string;
	sizeBytes: number;
	uploadedAt: number;
	uploadedByAuthId: string;
	versionNumber: number;
}) {
	return {
		contentType: version.contentType,
		releasedAt: version.releasedAt,
		scanCompletedAt: version.scanCompletedAt,
		scanReason: version.scanReason,
		scanState: version.scanState,
		sizeBytes: version.sizeBytes,
		uploadedAt: version.uploadedAt,
		uploadedByAuthId: version.uploadedByAuthId,
		versionId: version._id,
		versionNumber: version.versionNumber,
	};
}

export const listVersions = authedQuery
	.input({ boxId: v.id("fileBoxes"), nodeId: v.id("fileNodes") })
	.handler(async (ctx, args) => {
		const resolved = await resolveFileWorkspacePrincipal(ctx, {
			boxId: args.boxId,
			viewer: ctx.viewer,
		});
		if (!resolved) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
		}
		const node = await requireNodeInBox(ctx, args);
		if (node.nodeType !== "file" || node.deletedAt !== undefined) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.NODE_NOT_FOUND);
		}
		const versions = await ctx.db
			.query("fileVersions")
			.withIndex("by_node_version", (query) => query.eq("nodeId", args.nodeId))
			.collect();
		if (isEditorLikePrincipal(resolved.principal)) {
			return versions.map(summarizeVersion);
		}
		return versions
			.filter((version) => version._id === node.currentVersionId)
			.map(summarizeVersion);
	})
	.public();

export const replaceFile = authedMutation
	.input({
		boxId: v.id("fileBoxes"),
		declaredFile: declaredReplacementValidator,
		nodeId: v.id("fileNodes"),
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
			capability: "create_file_version",
			principal: resolved.principal,
		});
		const node = await requireNodeInBox(ctx, args);
		if (node.nodeType !== "file" || node.deletedAt !== undefined) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.NODE_NOT_FOUND);
		}
		await assertDeclaredFilePolicy({
			box: resolved.box,
			ctx,
			declaredFile: args.declaredFile,
			displayName: node.displayName,
		});
		const now = Date.now();
		const versionId = await ctx.db.insert("fileVersions", {
			boxId: args.boxId,
			nodeId: args.nodeId,
			versionNumber: await getNextVersionNumber({ ctx, nodeId: args.nodeId }),
			storageId: args.storageId,
			sizeBytes: args.declaredFile.sizeBytes,
			contentType: args.declaredFile.contentType ?? "application/octet-stream",
			sha256: args.declaredFile.sha256 ?? "pending",
			uploadedByAuthId: actorAuthIdForPrincipal(resolved.principal),
			uploadedAt: now,
			scanState: "pending_scan",
		});
		await insertFileWorkspaceActivity(ctx, {
			boxId: args.boxId,
			eventType: "file_version_created",
			nodeId: args.nodeId,
			principal: resolved.principal,
			targetId: versionId,
			targetType: "version",
		});
		await scheduleFileWorkspaceScan(ctx, {
			box: resolved.box,
			declaredContentType: args.declaredFile.contentType,
			declaredFilename: node.displayName,
			declaredSizeBytes: args.declaredFile.sizeBytes,
			storageId: args.storageId,
			versionId,
		});
		return {
			scanRequest: {
				declaredContentType: args.declaredFile.contentType,
				declaredFilename: node.displayName,
				declaredSizeBytes: args.declaredFile.sizeBytes,
				storageId: args.storageId,
				versionId,
			},
			versionId,
		};
	})
	.public();

export const restoreVersionAsCurrent = authedMutation
	.input({
		boxId: v.id("fileBoxes"),
		nodeId: v.id("fileNodes"),
		versionId: v.id("fileVersions"),
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
			capability: "create_file_version",
			principal: resolved.principal,
		});
		const node = await requireNodeInBox(ctx, args);
		const source = await ctx.db.get(args.versionId);
		if (
			node.nodeType !== "file" ||
			node.deletedAt !== undefined ||
			!source ||
			source.nodeId !== args.nodeId
		) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.NODE_NOT_FOUND);
		}
		assertVersionUrlEligible(source);
		const now = Date.now();
		const newVersionId = await ctx.db.insert("fileVersions", {
			boxId: args.boxId,
			nodeId: args.nodeId,
			versionNumber: await getNextVersionNumber({ ctx, nodeId: args.nodeId }),
			storageId: source.storageId,
			sizeBytes: source.sizeBytes,
			contentType: source.contentType,
			sha256: source.sha256,
			uploadedByAuthId: actorAuthIdForPrincipal(resolved.principal),
			uploadedAt: now,
			scanCompletedAt: source.scanCompletedAt,
			scanReason: source.scanReason,
			scanState: source.scanState,
		});
		await ctx.db.patch(args.nodeId, {
			currentVersionId: newVersionId,
			updatedAt: now,
		});
		await insertFileWorkspaceActivity(ctx, {
			boxId: args.boxId,
			eventType: "file_version_created",
			metadata: { restoredFromVersionId: args.versionId },
			nodeId: args.nodeId,
			principal: resolved.principal,
			targetId: newVersionId,
			targetType: "version",
		});
		return { versionId: newVersionId };
	})
	.public();

export const getPreviewUrl = authedMutation
	.input({ boxId: v.id("fileBoxes"), nodeId: v.id("fileNodes") })
	.handler(async (ctx, args) => {
		return getUrlForAuthenticatedNode(ctx, args, "preview_requested");
	})
	.public();

export const getDownloadUrl = authedMutation
	.input({ boxId: v.id("fileBoxes"), nodeId: v.id("fileNodes") })
	.handler(async (ctx, args) => {
		return getUrlForAuthenticatedNode(ctx, args, "download_requested");
	})
	.public();

export const getBearerPreviewUrl = convex
	.mutation()
	.input({ nodeId: v.id("fileNodes"), rawToken: v.string() })
	.handler(async (ctx, args) => {
		return getUrlForBearerNode(ctx, args, "preview_requested");
	})
	.public();

export const getBearerDownloadUrl = convex
	.mutation()
	.input({ nodeId: v.id("fileNodes"), rawToken: v.string() })
	.handler(async (ctx, args) => {
		return getUrlForBearerNode(ctx, args, "download_requested");
	})
	.public();

async function getUrlForAuthenticatedNode(
	ctx: MutationCtx & { viewer: Viewer },
	args: { boxId: Id<"fileBoxes">; nodeId: Id<"fileNodes"> },
	eventType: "download_requested" | "preview_requested"
) {
	const resolved = await resolveFileWorkspacePrincipal(ctx, {
		boxId: args.boxId,
		viewer: ctx.viewer,
	});
	if (!resolved) {
		throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
	}
	if (
		eventType === "download_requested" &&
		!resolved.box.downloadPolicy.authenticated
	) {
		return denyStorageUrl({
			ctx,
			eventType,
			linkId: resolved.link?._id,
			nodeId: args.nodeId,
			reasonCode: "downloads_disabled",
			resolved,
		});
	}
	const capability =
		eventType === "download_requested" ? "download_file" : "preview_clean_file";
	assertFileWorkspaceCapability({
		capability,
		options: { downloadsAllowed: resolved.box.downloadPolicy.authenticated },
		principal: resolved.principal,
	});
	return issueStorageUrl(ctx, resolved, args.nodeId, eventType);
}

async function getUrlForBearerNode(
	ctx: MutationCtx,
	args: { nodeId: Id<"fileNodes">; rawToken: string },
	eventType: "download_requested" | "preview_requested"
) {
	const resolved = await resolveFileWorkspacePrincipal(ctx, {
		rawToken: args.rawToken,
	});
	if (!resolved) {
		throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
	}
	if (eventType === "download_requested") {
		const downloadsAllowed =
			resolved.link?.downloadEnabled &&
			(resolved.link.linkKind === "public_link"
				? resolved.box.downloadPolicy.publicLink
				: resolved.box.downloadPolicy.magicLink);
		if (!downloadsAllowed) {
			return denyStorageUrl({
				ctx,
				eventType,
				linkId: resolved.link?._id,
				nodeId: args.nodeId,
				reasonCode: "downloads_disabled",
				resolved,
			});
		}
	}
	return issueStorageUrl(ctx, resolved, args.nodeId, eventType);
}

async function denyStorageUrl(args: {
	ctx: Pick<MutationCtx, "db">;
	eventType: "download_requested" | "preview_requested";
	linkId?: Id<"fileShareLinks">;
	nodeId: Id<"fileNodes">;
	reasonCode: string;
	resolved: NonNullable<
		Awaited<ReturnType<typeof resolveFileWorkspacePrincipal>>
	>;
}) {
	await insertFileWorkspaceSecurityEvent(args.ctx, {
		boxId: args.resolved.box._id,
		eventType: args.eventType,
		linkId: args.linkId,
		nodeId: args.nodeId,
		outcome: "denied",
		principal: args.resolved.principal,
		reasonCode: args.reasonCode,
	});
	return {
		denied: true as const,
		reasonCode: args.reasonCode,
		url: null,
	};
}

async function issueStorageUrl(
	ctx: Pick<MutationCtx, "db" | "storage">,
	resolved: NonNullable<
		Awaited<ReturnType<typeof resolveFileWorkspacePrincipal>>
	>,
	nodeId: Id<"fileNodes">,
	eventType: "download_requested" | "preview_requested"
) {
	const node = await ctx.db.get(nodeId);
	if (
		!node ||
		node.boxId !== resolved.box._id ||
		node.nodeType !== "file" ||
		node.deletedAt !== undefined ||
		(await hasDeletedAncestor({ ctx, node }))
	) {
		return denyStorageUrl({
			ctx,
			eventType,
			linkId: resolved.link?._id,
			nodeId,
			reasonCode: "node_deleted_or_missing",
			resolved,
		});
	}
	if (!node.currentVersionId) {
		return denyStorageUrl({
			ctx,
			eventType,
			linkId: resolved.link?._id,
			nodeId,
			reasonCode: "file_version_blocked",
			resolved,
		});
	}
	const version = await ctx.db.get(node.currentVersionId);
	if (!version) {
		return denyStorageUrl({
			ctx,
			eventType,
			linkId: resolved.link?._id,
			nodeId,
			reasonCode: "file_version_blocked",
			resolved,
		});
	}
	if (!isFileWorkspaceScanStateVisible(version.scanState)) {
		return denyStorageUrl({
			ctx,
			eventType,
			linkId: resolved.link?._id,
			nodeId,
			reasonCode: "file_version_blocked",
			resolved,
		});
	}
	const url = await ctx.storage.getUrl(version.storageId);
	await insertFileWorkspaceSecurityEvent(ctx, {
		boxId: resolved.box._id,
		eventType,
		linkId: resolved.link?._id,
		nodeId,
		outcome: "allowed",
		principal: resolved.principal,
	});
	return {
		breadcrumbs: await collectBreadcrumbs({ ctx, node }),
		contentType: version.contentType,
		fileName: node.displayName,
		url,
		versionId: version._id,
	};
}
