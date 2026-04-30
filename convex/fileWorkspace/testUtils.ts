import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { principalForLink, principalForParticipant } from "./access";
import type { FileWorkspaceRole } from "./types";

const DEFAULT_NOW = 1_779_000_000_000;

const defaultDownloadPolicy = {
	authenticated: true,
	magicLink: false,
	publicLink: false,
};

const defaultRetentionPolicy = {
	allowEditorRestore: true,
	managerPermanentDeleteAfterDays: 30,
	trashRetentionDays: 14,
};

const defaultScanPolicy = {
	allowedContentTypes: ["application/pdf", "text/plain", "text/csv"],
	archivesEnabled: false,
	blockedExtensions: [".exe", ".js", ".sh"],
	maxFileSizeBytes: 25_000_000,
};

const defaultStorageLimits = {
	maxBoxBytes: 1_000_000_000,
	maxFileBytes: 25_000_000,
};

export interface FileWorkspaceUserSeed {
	authId: string;
	email: string;
	firstName: string;
	lastName: string;
}

export interface FileWorkspaceSeededUser extends FileWorkspaceUserSeed {
	userId: Id<"users">;
}

export interface FileWorkspaceSeededBox {
	boxId: Id<"fileBoxes">;
	linkId?: Id<"fileShareLinks">;
	rootNodeId: Id<"fileNodes">;
}

export interface FileWorkspaceSeedFixture {
	admin: FileWorkspaceSeededUser;
	boxes: {
		activePrivate: FileWorkspaceSeededBox;
		magicLink: FileWorkspaceSeededBox;
		publicLink: FileWorkspaceSeededBox;
		suspended: FileWorkspaceSeededBox;
	};
	editor: FileWorkspaceSeededUser;
	manager: FileWorkspaceSeededUser;
	nonParticipant: FileWorkspaceSeededUser;
	principals: {
		editor: ReturnType<typeof principalForParticipant>;
		magicLink: ReturnType<typeof principalForLink>;
		manager: ReturnType<typeof principalForParticipant>;
		publicLink: ReturnType<typeof principalForLink>;
		viewer: ReturnType<typeof principalForParticipant>;
	};
	viewer: FileWorkspaceSeededUser;
}

export const fileWorkspaceSeedUsers = {
	admin: {
		authId: "user_file_workspace_admin",
		email: "file-admin@test.fairlend.ca",
		firstName: "File",
		lastName: "Admin",
	},
	editor: {
		authId: "user_file_workspace_editor",
		email: "file-editor@test.fairlend.ca",
		firstName: "File",
		lastName: "Editor",
	},
	manager: {
		authId: "user_file_workspace_manager",
		email: "file-manager@test.fairlend.ca",
		firstName: "File",
		lastName: "Manager",
	},
	nonParticipant: {
		authId: "user_file_workspace_non_participant",
		email: "file-non-participant@test.fairlend.ca",
		firstName: "File",
		lastName: "NonParticipant",
	},
	viewer: {
		authId: "user_file_workspace_viewer",
		email: "file-viewer@test.fairlend.ca",
		firstName: "File",
		lastName: "Viewer",
	},
} as const satisfies Record<string, FileWorkspaceUserSeed>;

export async function seedFileWorkspaceUser(
	ctx: Pick<MutationCtx, "db">,
	user: FileWorkspaceUserSeed
): Promise<FileWorkspaceSeededUser> {
	const userId = await ctx.db.insert("users", {
		authId: user.authId,
		email: user.email,
		firstName: user.firstName,
		lastName: user.lastName,
	});
	return { ...user, userId };
}

async function seedParticipant(args: {
	boxId: Id<"fileBoxes">;
	ctx: Pick<MutationCtx, "db">;
	role: FileWorkspaceRole;
	user: FileWorkspaceSeededUser;
}) {
	return args.ctx.db.insert("fileBoxParticipants", {
		boxId: args.boxId,
		participantKey: `auth:${args.user.authId}`,
		authId: args.user.authId,
		userId: args.user.userId,
		email: args.user.email,
		role: args.role,
		status: "active",
		createdAt: DEFAULT_NOW,
		updatedAt: DEFAULT_NOW,
	});
}

async function seedBox(args: {
	ctx: Pick<MutationCtx, "db">;
	manager: FileWorkspaceSeededUser;
	name: string;
	status?: "active" | "archived" | "suspended" | "disabled";
	visibility?: "private" | "public_link" | "magic_link" | "disabled";
}): Promise<FileWorkspaceSeededBox> {
	const boxId = await args.ctx.db.insert("fileBoxes", {
		name: args.name,
		createdByAuthId: args.manager.authId,
		createdByUserId: args.manager.userId,
		status: args.status ?? "active",
		visibility: args.visibility ?? "private",
		downloadPolicy: defaultDownloadPolicy,
		retentionPolicy: defaultRetentionPolicy,
		scanPolicy: defaultScanPolicy,
		storageLimits: defaultStorageLimits,
		createdAt: DEFAULT_NOW,
		updatedAt: DEFAULT_NOW,
	});

	const rootNodeId = await args.ctx.db.insert("fileNodes", {
		boxId,
		nodeType: "folder",
		displayName: "Root",
		normalizedSiblingKey: "root",
		isRoot: true,
		createdByAuthId: args.manager.authId,
		createdAt: DEFAULT_NOW,
		updatedAt: DEFAULT_NOW,
	});

	await seedParticipant({
		boxId,
		ctx: args.ctx,
		role: "manager",
		user: args.manager,
	});

	return { boxId, rootNodeId };
}

async function seedShareLink(args: {
	boxId: Id<"fileBoxes">;
	ctx: Pick<MutationCtx, "db">;
	linkKind: "public_link" | "magic_link";
	manager: FileWorkspaceSeededUser;
	tokenHash: string;
}): Promise<Id<"fileShareLinks">> {
	return args.ctx.db.insert("fileShareLinks", {
		boxId: args.boxId,
		tokenHash: args.tokenHash,
		linkKind: args.linkKind,
		viewEnabled: true,
		downloadEnabled: false,
		createdByAuthId: args.manager.authId,
		createdAt: DEFAULT_NOW,
	});
}

export async function seedFileWorkspaceFixture(
	ctx: Pick<MutationCtx, "db">
): Promise<FileWorkspaceSeedFixture> {
	const [admin, manager, editor, viewer, nonParticipant] = await Promise.all([
		seedFileWorkspaceUser(ctx, fileWorkspaceSeedUsers.admin),
		seedFileWorkspaceUser(ctx, fileWorkspaceSeedUsers.manager),
		seedFileWorkspaceUser(ctx, fileWorkspaceSeedUsers.editor),
		seedFileWorkspaceUser(ctx, fileWorkspaceSeedUsers.viewer),
		seedFileWorkspaceUser(ctx, fileWorkspaceSeedUsers.nonParticipant),
	]);

	const activePrivate = await seedBox({
		ctx,
		manager,
		name: "Private Workspace",
	});
	await Promise.all([
		seedParticipant({
			boxId: activePrivate.boxId,
			ctx,
			role: "editor",
			user: editor,
		}),
		seedParticipant({
			boxId: activePrivate.boxId,
			ctx,
			role: "viewer",
			user: viewer,
		}),
	]);

	const suspended = await seedBox({
		ctx,
		manager,
		name: "Suspended Workspace",
		status: "suspended",
	});

	const publicLink = await seedBox({
		ctx,
		manager,
		name: "Public Link Workspace",
		visibility: "public_link",
	});
	publicLink.linkId = await seedShareLink({
		boxId: publicLink.boxId,
		ctx,
		linkKind: "public_link",
		manager,
		tokenHash: "sha256:public-link",
	});

	const magicLink = await seedBox({
		ctx,
		manager,
		name: "Magic Link Workspace",
		visibility: "magic_link",
	});
	magicLink.linkId = await seedShareLink({
		boxId: magicLink.boxId,
		ctx,
		linkKind: "magic_link",
		manager,
		tokenHash: "sha256:magic-link",
	});

	return {
		admin,
		editor,
		manager,
		nonParticipant,
		viewer,
		boxes: {
			activePrivate,
			magicLink,
			publicLink,
			suspended,
		},
		principals: {
			editor: principalForParticipant({
				authId: editor.authId,
				email: editor.email,
				role: "editor",
			}),
			magicLink: principalForLink({
				linkId: magicLink.linkId,
				linkKind: "magic_link",
			}),
			manager: principalForParticipant({
				authId: manager.authId,
				email: manager.email,
				role: "manager",
			}),
			publicLink: principalForLink({
				linkId: publicLink.linkId,
				linkKind: "public_link",
			}),
			viewer: principalForParticipant({
				authId: viewer.authId,
				email: viewer.email,
				role: "viewer",
			}),
		},
	};
}
