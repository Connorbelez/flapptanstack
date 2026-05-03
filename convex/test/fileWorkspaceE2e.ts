import { ConvexError, v } from "convex/values";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { participantKeyForAuthId } from "../fileWorkspace/identity";
import {
	DEFAULT_FILE_WORKSPACE_DOWNLOAD_POLICY,
	DEFAULT_FILE_WORKSPACE_RETENTION_POLICY,
	DEFAULT_FILE_WORKSPACE_SCAN_POLICY,
	DEFAULT_FILE_WORKSPACE_STORAGE_LIMITS,
} from "../fileWorkspace/operations";
import { actorFromPrincipal } from "../fileWorkspace/securityEvents";
import { hashShareLinkToken } from "../fileWorkspace/tokens";
import type {
	FileBoxStatus,
	FileBoxVisibility,
	FileShareLinkKind,
	FileWorkspaceRole,
} from "../fileWorkspace/types";
import { normalizeFileWorkspaceSiblingKey } from "../fileWorkspace/validators";
import type { Viewer } from "../fluent";
import { authedMutation, authedQuery } from "../fluent";

const FILE_WORKSPACE_E2E_ENABLED_ENV = "FILE_WORKSPACE_E2E_ENABLED";
const FILE_WORKSPACE_E2E_PREFIX = "File Workspace E2E";
const FILE_WORKSPACE_E2E_AUTH_PREFIX = "file-workspace-e2e";
const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,60}$/i;

const fixtureFileValidator = {
	boxId: v.id("fileBoxes"),
	contentType: v.string(),
	deleted: v.optional(v.boolean()),
	displayName: v.string(),
	parentNodeId: v.id("fileNodes"),
	releaseReason: v.optional(v.string()),
	scanReason: v.optional(v.string()),
	scanState: v.union(
		v.literal("pending_scan"),
		v.literal("clean"),
		v.literal("rejected"),
		v.literal("scan_error"),
		v.literal("released_by_admin")
	),
	sha256: v.optional(v.string()),
	sizeBytes: v.number(),
	storageId: v.id("_storage"),
};

function assertFileWorkspaceE2eEnabled() {
	if (
		process.env.FILE_WORKSPACE_E2E_ENABLED !== "true" &&
		process.env.ALLOW_TEST_AUTH_ENDPOINTS !== "true"
	) {
		throw new ConvexError(
			`File Workspace E2E helpers are disabled. Set ${FILE_WORKSPACE_E2E_ENABLED_ENV}=true or ALLOW_TEST_AUTH_ENDPOINTS=true to enable them.`
		);
	}
}

function requireRunId(runId: string) {
	const trimmed = runId.trim();
	if (!RUN_ID_PATTERN.test(trimmed)) {
		throw new ConvexError("File Workspace E2E runId must be URL-safe.");
	}
	return trimmed.toLowerCase();
}

function nowWithOffset(offsetMs = 0) {
	return Date.now() + offsetMs;
}

function e2eAuthId(runId: string, key: string) {
	return `${FILE_WORKSPACE_E2E_AUTH_PREFIX}:${runId}:${key}`;
}

function e2eEmail(runId: string, key: string) {
	return `${FILE_WORKSPACE_E2E_AUTH_PREFIX}+${runId}-${key}@test.fairlend.ca`;
}

async function ensureUser(
	ctx: Pick<MutationCtx, "db">,
	args: {
		authId: string;
		email: string;
		firstName: string;
		lastName: string;
	}
) {
	const existing = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", args.authId))
		.unique();
	if (existing) {
		return existing._id;
	}
	return ctx.db.insert("users", {
		authId: args.authId,
		email: args.email,
		firstName: args.firstName,
		lastName: args.lastName,
	});
}

async function ensureViewerUser(ctx: Pick<MutationCtx, "db">, viewer: Viewer) {
	return ensureUser(ctx, {
		authId: viewer.authId,
		email:
			viewer.verifiedEmail ??
			viewer.email ??
			`${viewer.authId}@test.fairlend.ca`,
		firstName: viewer.firstName ?? "E2E",
		lastName: viewer.lastName ?? "User",
	});
}

async function seedParticipant(args: {
	authId: string;
	boxId: Id<"fileBoxes">;
	ctx: Pick<MutationCtx, "db">;
	email?: string;
	role: FileWorkspaceRole;
	userId?: Id<"users">;
}) {
	const now = Date.now();
	return args.ctx.db.insert("fileBoxParticipants", {
		boxId: args.boxId,
		participantKey: participantKeyForAuthId(args.authId),
		authId: args.authId,
		userId: args.userId,
		email: args.email,
		role: args.role,
		status: "active",
		createdAt: now,
		updatedAt: now,
	});
}

async function seedBox(args: {
	ctx: Pick<MutationCtx, "db">;
	creatorAuthId: string;
	creatorUserId?: Id<"users">;
	downloadPolicy?: Doc<"fileBoxes">["downloadPolicy"];
	name: string;
	status?: FileBoxStatus;
	visibility?: FileBoxVisibility;
}) {
	const now = Date.now();
	const boxId = await args.ctx.db.insert("fileBoxes", {
		name: args.name,
		createdByAuthId: args.creatorAuthId,
		createdByUserId: args.creatorUserId,
		status: args.status ?? "active",
		visibility: args.visibility ?? "private",
		downloadPolicy:
			args.downloadPolicy ?? DEFAULT_FILE_WORKSPACE_DOWNLOAD_POLICY,
		retentionPolicy: DEFAULT_FILE_WORKSPACE_RETENTION_POLICY,
		scanPolicy: DEFAULT_FILE_WORKSPACE_SCAN_POLICY,
		storageLimits: DEFAULT_FILE_WORKSPACE_STORAGE_LIMITS,
		createdAt: now,
		updatedAt: now,
		suspendedAt: args.status === "suspended" ? now : undefined,
	});
	const rootNodeId = await args.ctx.db.insert("fileNodes", {
		boxId,
		nodeType: "folder",
		displayName: "Root",
		normalizedSiblingKey: "root",
		isRoot: true,
		createdByAuthId: args.creatorAuthId,
		createdAt: now,
		updatedAt: now,
	});
	return { boxId, name: args.name, rootNodeId };
}

async function seedFolder(args: {
	boxId: Id<"fileBoxes">;
	ctx: Pick<MutationCtx, "db">;
	createdByAuthId: string;
	name: string;
	parentNodeId: Id<"fileNodes">;
}) {
	const now = Date.now();
	return args.ctx.db.insert("fileNodes", {
		boxId: args.boxId,
		parentId: args.parentNodeId,
		nodeType: "folder",
		displayName: args.name,
		normalizedSiblingKey: normalizeFileWorkspaceSiblingKey(args.name),
		isRoot: false,
		createdByAuthId: args.createdByAuthId,
		createdAt: now,
		updatedAt: now,
	});
}

async function seedShareLink(args: {
	boxId: Id<"fileBoxes">;
	ctx: Pick<MutationCtx, "db">;
	createdByAuthId: string;
	downloadEnabled: boolean;
	expiresAt?: number;
	linkKind: FileShareLinkKind;
	rawToken: string;
	revokedAt?: number;
}) {
	const linkId = await args.ctx.db.insert("fileShareLinks", {
		boxId: args.boxId,
		tokenHash: await hashShareLinkToken(args.rawToken),
		linkKind: args.linkKind,
		expiresAt: args.expiresAt,
		revokedAt: args.revokedAt,
		revokedByAuthId: args.revokedAt ? args.createdByAuthId : undefined,
		viewEnabled: true,
		downloadEnabled: args.downloadEnabled,
		createdByAuthId: args.createdByAuthId,
		createdAt: Date.now(),
	});
	return { linkId, rawToken: args.rawToken };
}

async function deleteRows<T extends { _id: Id<TableNames> }>(
	ctx: Pick<MutationCtx, "db" | "storage">,
	rows: readonly T[]
) {
	for (const row of rows) {
		if ("storageId" in row) {
			await ctx.storage.delete(row.storageId as Id<"_storage">);
		}
		await ctx.db.delete(row._id);
	}
	return rows.length;
}

async function collectFixtureBoxes(ctx: Pick<QueryCtx, "db">, runId: string) {
	const prefix = `${FILE_WORKSPACE_E2E_PREFIX} ${runId}`;
	const boxes = await ctx.db.query("fileBoxes").collect();
	return boxes.filter((box) => box.name.startsWith(prefix));
}

async function cleanupRun(ctx: MutationCtx, runId: string) {
	const boxes = await collectFixtureBoxes(ctx, runId);
	const boxIds = new Set(boxes.map((box) => box._id));
	const [
		nodes,
		versions,
		links,
		participants,
		comments,
		tags,
		nodeTags,
		activityEvents,
		securityEvents,
		users,
	] = await Promise.all([
		ctx.db.query("fileNodes").collect(),
		ctx.db.query("fileVersions").collect(),
		ctx.db.query("fileShareLinks").collect(),
		ctx.db.query("fileBoxParticipants").collect(),
		ctx.db.query("fileComments").collect(),
		ctx.db.query("fileTags").collect(),
		ctx.db.query("fileNodeTags").collect(),
		ctx.db.query("fileActivityEvents").collect(),
		ctx.db.query("fileSecurityEvents").collect(),
		ctx.db.query("users").collect(),
	]);

	const scopedNodes = nodes.filter((row) => boxIds.has(row.boxId));
	const scopedNodeIds = new Set(scopedNodes.map((row) => row._id));
	const scopedVersions = versions.filter((row) => boxIds.has(row.boxId));
	const scopedTags = tags.filter((row) => boxIds.has(row.boxId));
	const scopedTagIds = new Set(scopedTags.map((row) => row._id));

	return {
		activityEvents: await deleteRows(
			ctx,
			activityEvents.filter((row) => boxIds.has(row.boxId))
		),
		comments: await deleteRows(
			ctx,
			comments.filter((row) => boxIds.has(row.boxId))
		),
		links: await deleteRows(
			ctx,
			links.filter((row) => boxIds.has(row.boxId))
		),
		nodeTags: await deleteRows(
			ctx,
			nodeTags.filter(
				(row) => boxIds.has(row.boxId) || scopedTagIds.has(row.tagId)
			)
		),
		participants: await deleteRows(
			ctx,
			participants.filter((row) => boxIds.has(row.boxId))
		),
		securityEvents: await deleteRows(
			ctx,
			securityEvents.filter((row) => row.boxId && boxIds.has(row.boxId))
		),
		tags: await deleteRows(ctx, scopedTags),
		versions: await deleteRows(ctx, scopedVersions),
		nodes: await deleteRows(
			ctx,
			[...scopedNodes].sort((left, right) =>
				scopedNodeIds.has(left.parentId as Id<"fileNodes">) &&
				!scopedNodeIds.has(right.parentId as Id<"fileNodes">)
					? -1
					: 0
			)
		),
		boxes: await deleteRows(ctx, boxes),
		users: await deleteRows(
			ctx,
			users.filter((row) =>
				row.authId.startsWith(`${FILE_WORKSPACE_E2E_AUTH_PREFIX}:${runId}:`)
			)
		),
	};
}

export const cleanupFixture = authedMutation
	.input({ runId: v.string() })
	.handler(async (ctx, args) => {
		assertFileWorkspaceE2eEnabled();
		return cleanupRun(ctx, requireRunId(args.runId));
	})
	.public();

export const seedBaseFixture = authedMutation
	.input({ runId: v.string() })
	.handler(async (ctx, args) => {
		assertFileWorkspaceE2eEnabled();
		const runId = requireRunId(args.runId);
		await cleanupRun(ctx, runId);

		const viewerUserId = await ensureViewerUser(ctx, ctx.viewer);
		const viewerEmail =
			ctx.viewer.verifiedEmail ??
			ctx.viewer.email ??
			`${ctx.viewer.authId}@test.fairlend.ca`;
		const stableUsers = {
			admin: {
				authId: e2eAuthId(runId, "admin"),
				email: e2eEmail(runId, "admin"),
				firstName: "File",
				lastName: "Admin",
			},
			editor: {
				authId: e2eAuthId(runId, "editor"),
				email: e2eEmail(runId, "editor"),
				firstName: "File",
				lastName: "Editor",
			},
			manager: {
				authId: e2eAuthId(runId, "manager"),
				email: e2eEmail(runId, "manager"),
				firstName: "File",
				lastName: "Manager",
			},
			unrelated: {
				authId: e2eAuthId(runId, "unrelated"),
				email: e2eEmail(runId, "unrelated"),
				firstName: "File",
				lastName: "Unrelated",
			},
			viewer: {
				authId: e2eAuthId(runId, "viewer"),
				email: e2eEmail(runId, "viewer"),
				firstName: "File",
				lastName: "Viewer",
			},
		};
		const stableUserIds = {
			admin: await ensureUser(ctx, stableUsers.admin),
			editor: await ensureUser(ctx, stableUsers.editor),
			manager: await ensureUser(ctx, stableUsers.manager),
			unrelated: await ensureUser(ctx, stableUsers.unrelated),
			viewer: await ensureUser(ctx, stableUsers.viewer),
		};

		const managerBox = await seedBox({
			ctx,
			creatorAuthId: ctx.viewer.authId,
			creatorUserId: viewerUserId,
			name: `${FILE_WORKSPACE_E2E_PREFIX} ${runId} Manager Workspace`,
		});
		await Promise.all([
			seedParticipant({
				authId: ctx.viewer.authId,
				boxId: managerBox.boxId,
				ctx,
				email: viewerEmail,
				role: "manager",
				userId: viewerUserId,
			}),
			seedParticipant({
				authId: stableUsers.editor.authId,
				boxId: managerBox.boxId,
				ctx,
				email: stableUsers.editor.email,
				role: "editor",
				userId: stableUserIds.editor,
			}),
			seedParticipant({
				authId: stableUsers.viewer.authId,
				boxId: managerBox.boxId,
				ctx,
				email: stableUsers.viewer.email,
				role: "viewer",
				userId: stableUserIds.viewer,
			}),
		]);

		const editorBox = await seedBox({
			ctx,
			creatorAuthId: stableUsers.manager.authId,
			creatorUserId: stableUserIds.manager,
			name: `${FILE_WORKSPACE_E2E_PREFIX} ${runId} Editor Workspace`,
		});
		await Promise.all([
			seedParticipant({
				authId: stableUsers.manager.authId,
				boxId: editorBox.boxId,
				ctx,
				email: stableUsers.manager.email,
				role: "manager",
				userId: stableUserIds.manager,
			}),
			seedParticipant({
				authId: ctx.viewer.authId,
				boxId: editorBox.boxId,
				ctx,
				email: viewerEmail,
				role: "editor",
				userId: viewerUserId,
			}),
		]);

		const viewerBox = await seedBox({
			ctx,
			creatorAuthId: stableUsers.manager.authId,
			creatorUserId: stableUserIds.manager,
			name: `${FILE_WORKSPACE_E2E_PREFIX} ${runId} Viewer Workspace`,
		});
		await Promise.all([
			seedParticipant({
				authId: stableUsers.manager.authId,
				boxId: viewerBox.boxId,
				ctx,
				email: stableUsers.manager.email,
				role: "manager",
				userId: stableUserIds.manager,
			}),
			seedParticipant({
				authId: ctx.viewer.authId,
				boxId: viewerBox.boxId,
				ctx,
				email: viewerEmail,
				role: "viewer",
				userId: viewerUserId,
			}),
		]);

		const publicBox = await seedBox({
			ctx,
			creatorAuthId: ctx.viewer.authId,
			creatorUserId: viewerUserId,
			downloadPolicy: {
				authenticated: true,
				magicLink: false,
				publicLink: true,
			},
			name: `${FILE_WORKSPACE_E2E_PREFIX} ${runId} Public Workspace`,
			visibility: "public_link",
		});
		await seedParticipant({
			authId: ctx.viewer.authId,
			boxId: publicBox.boxId,
			ctx,
			email: viewerEmail,
			role: "manager",
			userId: viewerUserId,
		});

		const magicBox = await seedBox({
			ctx,
			creatorAuthId: ctx.viewer.authId,
			creatorUserId: viewerUserId,
			downloadPolicy: {
				authenticated: true,
				magicLink: true,
				publicLink: false,
			},
			name: `${FILE_WORKSPACE_E2E_PREFIX} ${runId} Magic Workspace`,
			visibility: "magic_link",
		});
		await seedParticipant({
			authId: ctx.viewer.authId,
			boxId: magicBox.boxId,
			ctx,
			email: viewerEmail,
			role: "manager",
			userId: viewerUserId,
		});

		const suspendedBox = await seedBox({
			ctx,
			creatorAuthId: ctx.viewer.authId,
			creatorUserId: viewerUserId,
			name: `${FILE_WORKSPACE_E2E_PREFIX} ${runId} Suspended Workspace`,
			status: "suspended",
		});
		await seedParticipant({
			authId: ctx.viewer.authId,
			boxId: suspendedBox.boxId,
			ctx,
			email: viewerEmail,
			role: "manager",
			userId: viewerUserId,
		});

		const fundingFolderId = await seedFolder({
			boxId: managerBox.boxId,
			ctx,
			createdByAuthId: ctx.viewer.authId,
			name: "Funding Conditions",
			parentNodeId: managerBox.rootNodeId,
		});
		const deepFolderId = await seedFolder({
			boxId: managerBox.boxId,
			ctx,
			createdByAuthId: ctx.viewer.authId,
			name: "2026 Closing Package With Long Folder Name",
			parentNodeId: fundingFolderId,
		});
		await seedFolder({
			boxId: managerBox.boxId,
			ctx,
			createdByAuthId: ctx.viewer.authId,
			name: "Nested Review Level Three",
			parentNodeId: deepFolderId,
		});

		const publicToken = `${FILE_WORKSPACE_E2E_AUTH_PREFIX}-${runId}-public`;
		const magicToken = `${FILE_WORKSPACE_E2E_AUTH_PREFIX}-${runId}-magic`;
		const expiredToken = `${FILE_WORKSPACE_E2E_AUTH_PREFIX}-${runId}-expired`;
		const revokedToken = `${FILE_WORKSPACE_E2E_AUTH_PREFIX}-${runId}-revoked`;
		const [publicLink, magicLink, expiredLink, revokedLink] = await Promise.all(
			[
				seedShareLink({
					boxId: publicBox.boxId,
					ctx,
					createdByAuthId: ctx.viewer.authId,
					downloadEnabled: true,
					linkKind: "public_link",
					rawToken: publicToken,
				}),
				seedShareLink({
					boxId: magicBox.boxId,
					ctx,
					createdByAuthId: ctx.viewer.authId,
					downloadEnabled: true,
					linkKind: "magic_link",
					rawToken: magicToken,
				}),
				seedShareLink({
					boxId: magicBox.boxId,
					ctx,
					createdByAuthId: ctx.viewer.authId,
					downloadEnabled: false,
					expiresAt: nowWithOffset(-60_000),
					linkKind: "magic_link",
					rawToken: expiredToken,
				}),
				seedShareLink({
					boxId: publicBox.boxId,
					ctx,
					createdByAuthId: ctx.viewer.authId,
					downloadEnabled: false,
					linkKind: "public_link",
					rawToken: revokedToken,
					revokedAt: nowWithOffset(-30_000),
				}),
			]
		);

		return {
			boxes: {
				editor: editorBox,
				magic: magicBox,
				manager: managerBox,
				public: publicBox,
				suspended: suspendedBox,
				viewer: viewerBox,
			},
			folders: {
				deepFolderId,
				fundingFolderId,
			},
			links: {
				expired: expiredLink,
				magic: magicLink,
				public: publicLink,
				revoked: revokedLink,
				tamperedToken: `${publicToken}-tampered`,
			},
			runId,
			users: {
				current: {
					authId: ctx.viewer.authId,
					email: viewerEmail,
					userId: viewerUserId,
				},
				stable: {
					admin: { ...stableUsers.admin, userId: stableUserIds.admin },
					editor: { ...stableUsers.editor, userId: stableUserIds.editor },
					manager: { ...stableUsers.manager, userId: stableUserIds.manager },
					unrelated: {
						...stableUsers.unrelated,
						userId: stableUserIds.unrelated,
					},
					viewer: { ...stableUsers.viewer, userId: stableUserIds.viewer },
				},
			},
		};
	})
	.public();

export const createUploadUrl = authedMutation
	.handler(async (ctx) => {
		assertFileWorkspaceE2eEnabled();
		return { uploadUrl: await ctx.storage.generateUploadUrl() };
	})
	.public();

export const attachFixtureFile = authedMutation
	.input(fixtureFileValidator)
	.handler(async (ctx, args) => {
		assertFileWorkspaceE2eEnabled();
		const now = Date.now();
		const nodeId = await ctx.db.insert("fileNodes", {
			boxId: args.boxId,
			parentId: args.parentNodeId,
			nodeType: "file",
			displayName: args.displayName,
			normalizedSiblingKey: normalizeFileWorkspaceSiblingKey(args.displayName),
			isRoot: false,
			deletedAt: args.deleted ? now : undefined,
			deletedByAuthId: args.deleted ? ctx.viewer.authId : undefined,
			createdByAuthId: ctx.viewer.authId,
			createdAt: now,
			updatedAt: now,
		});
		const versionId = await ctx.db.insert("fileVersions", {
			boxId: args.boxId,
			nodeId,
			versionNumber: 1,
			storageId: args.storageId,
			sizeBytes: args.sizeBytes,
			contentType: args.contentType,
			sha256: args.sha256 ?? `e2e-${args.scanState}-${now}`,
			uploadedByAuthId: ctx.viewer.authId,
			uploadedAt: now,
			scanState: args.scanState,
			scanCompletedAt:
				args.scanState === "pending_scan" ? undefined : nowWithOffset(1000),
			scanReason: args.scanReason,
			releasedAt:
				args.scanState === "released_by_admin"
					? nowWithOffset(2000)
					: undefined,
			releasedByAuthId:
				args.scanState === "released_by_admin" ? ctx.viewer.authId : undefined,
			releaseReason:
				args.scanState === "released_by_admin"
					? (args.releaseReason ?? "E2E manual release")
					: undefined,
		});
		await ctx.db.patch(nodeId, {
			currentVersionId: versionId,
			updatedAt: nowWithOffset(3000),
		});
		return { nodeId, versionId };
	})
	.public();

export const getSecurityEvents = authedQuery
	.input({
		boxId: v.id("fileBoxes"),
		eventType: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		assertFileWorkspaceE2eEnabled();
		const rows = await ctx.db
			.query("fileSecurityEvents")
			.withIndex("by_box_created_at", (query) => query.eq("boxId", args.boxId))
			.collect();
		return rows
			.filter((row) => !args.eventType || row.eventType === args.eventType)
			.map((row) => ({
				createdAt: row.createdAt,
				eventType: row.eventType,
				linkId: row.linkId,
				nodeId: row.nodeId,
				outcome: row.outcome,
				reasonCode: row.reasonCode,
			}));
	})
	.public();

export const recordDeniedAccess = authedMutation
	.input({
		boxId: v.id("fileBoxes"),
		nodeId: v.optional(v.id("fileNodes")),
		reasonCode: v.string(),
	})
	.handler(async (ctx, args) => {
		assertFileWorkspaceE2eEnabled();
		const eventId = await ctx.db.insert("fileSecurityEvents", {
			boxId: args.boxId,
			nodeId: args.nodeId,
			eventType: "access_denied",
			actor: actorFromPrincipal({
				authId: ctx.viewer.authId,
				email: ctx.viewer.email,
				kind: "authenticated",
				role: "viewer",
			}),
			actorAuthId: ctx.viewer.authId,
			outcome: "denied",
			reasonCode: args.reasonCode,
			createdAt: Date.now(),
		});
		return { eventId };
	})
	.public();
