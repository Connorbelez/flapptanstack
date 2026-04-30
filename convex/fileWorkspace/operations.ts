import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Viewer } from "../fluent";
import { principalForParticipant, principalForPlatformAdmin } from "./access";
import { createFileWorkspaceActivityForPrincipal } from "./activity";
import { participantKeyForAuthId, participantKeyForEmail } from "./identity";
import {
	actorFromPrincipal,
	createFileWorkspaceSecurityEvent,
} from "./securityEvents";
import type {
	FileActivityEventType,
	FileSecurityEventType,
	FileWorkspacePrincipal,
} from "./types";
import { normalizeFileWorkspaceSiblingKey } from "./validators";

export const DEFAULT_FILE_WORKSPACE_DOWNLOAD_POLICY = {
	authenticated: true,
	magicLink: false,
	publicLink: false,
};

export const DEFAULT_FILE_WORKSPACE_RETENTION_POLICY = {
	allowEditorRestore: true,
	managerPermanentDeleteAfterDays: 30,
	trashRetentionDays: 14,
};

export const DEFAULT_FILE_WORKSPACE_SCAN_POLICY = {
	allowedContentTypes: ["application/pdf", "text/plain", "text/csv"],
	archivesEnabled: false,
	blockedExtensions: [".exe", ".js", ".sh"],
	maxFileSizeBytes: 25_000_000,
};

export const DEFAULT_FILE_WORKSPACE_STORAGE_LIMITS = {
	maxBoxBytes: 1_000_000_000,
	maxFileBytes: 25_000_000,
};

export function currentFileWorkspaceTime(): number {
	return Date.now();
}

export function isFileWorkspaceCreator(viewer: Viewer): boolean {
	return (
		viewer.isFairLendAdmin ||
		viewer.permissions.has("broker:access") ||
		viewer.permissions.has("admin:access")
	);
}

export function assertCanCreateFileWorkspaceBox(viewer: Viewer): void {
	if (!isFileWorkspaceCreator(viewer)) {
		throw new ConvexError(
			"Forbidden: broker or FairLend admin access required"
		);
	}
}

export async function getUserIdForAuthId(
	ctx: Pick<QueryCtx, "db">,
	authId: string
): Promise<Id<"users"> | undefined> {
	const user = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", authId))
		.unique();
	return user?._id;
}

export async function getActiveParticipantForViewer(
	ctx: Pick<QueryCtx, "db">,
	args: {
		boxId: Id<"fileBoxes">;
		viewer: Viewer;
	}
) {
	const authParticipant = await ctx.db
		.query("fileBoxParticipants")
		.withIndex("by_box_participant_status", (query) =>
			query
				.eq("boxId", args.boxId)
				.eq("participantKey", participantKeyForAuthId(args.viewer.authId))
				.eq("status", "active")
		)
		.unique();
	if (authParticipant) {
		return authParticipant;
	}
	const verifiedEmail = args.viewer.verifiedEmail;
	if (!verifiedEmail) {
		return null;
	}
	return await ctx.db
		.query("fileBoxParticipants")
		.withIndex("by_box_participant_status", (query) =>
			query
				.eq("boxId", args.boxId)
				.eq("participantKey", participantKeyForEmail(verifiedEmail))
				.eq("status", "active")
		)
		.unique();
}

export async function resolveBoxAuthenticatedPrincipal(
	ctx: Pick<QueryCtx, "db">,
	args: {
		boxId: Id<"fileBoxes">;
		requireActiveBox?: boolean;
		viewer: Viewer;
	}
): Promise<FileWorkspacePrincipal | null> {
	const box = await ctx.db.get(args.boxId);
	if (!box) {
		return null;
	}
	const participant = await getActiveParticipantForViewer(ctx, args);
	if (participant) {
		const isClosedBox = box.status === "disabled" || box.status === "suspended";
		if (isClosedBox && participant.role !== "manager") {
			return null;
		}
		if (args.requireActiveBox !== false && isClosedBox) {
			return null;
		}
		return principalForParticipant({
			authId: args.viewer.authId,
			email: args.viewer.email,
			role: participant.role,
		});
	}
	if (args.viewer.isFairLendAdmin) {
		return principalForPlatformAdmin(args.viewer);
	}
	return null;
}

export function assertManagerOrPlatformAdmin(
	principal: FileWorkspacePrincipal | null
): asserts principal is FileWorkspacePrincipal {
	if (!principal) {
		throw new ConvexError("Box not found or access denied.");
	}
	if (principal.kind === "platform_admin") {
		return;
	}
	if (principal.kind === "authenticated" && principal.role === "manager") {
		return;
	}
	throw new ConvexError("Box not found or access denied.");
}

export async function insertFileWorkspaceActivity(
	ctx: Pick<MutationCtx, "db">,
	args: {
		boxId: Id<"fileBoxes">;
		eventType: FileActivityEventType;
		nodeId?: Id<"fileNodes">;
		principal: FileWorkspacePrincipal;
		targetId?: string;
		targetType: "box" | "node" | "participant";
	}
): Promise<Id<"fileActivityEvents">> {
	const event = createFileWorkspaceActivityForPrincipal(args.principal, {
		boxId: args.boxId,
		createdAt: currentFileWorkspaceTime(),
		eventType: args.eventType,
		nodeId: args.nodeId,
		targetId: args.targetId,
		targetType: args.targetType,
	});
	return await ctx.db.insert("fileActivityEvents", {
		actor: event.actor,
		actorAuthId: event.actor.authId,
		boxId: args.boxId,
		createdAt: event.createdAt,
		eventType: event.eventType,
		nodeId: args.nodeId,
		targetId: event.targetId,
		targetType: event.targetType,
	});
}

export async function insertFileWorkspaceSecurityEvent(
	ctx: Pick<MutationCtx, "db">,
	args: {
		boxId?: Id<"fileBoxes">;
		eventType: FileSecurityEventType;
		outcome: "allowed" | "denied" | "blocked";
		principal: FileWorkspacePrincipal;
		reasonCode?: string;
	}
): Promise<Id<"fileSecurityEvents">> {
	const event = createFileWorkspaceSecurityEvent({
		actor: actorFromPrincipal(args.principal),
		boxId: args.boxId,
		createdAt: currentFileWorkspaceTime(),
		eventType: args.eventType,
		outcome: args.outcome,
		reasonCode: args.reasonCode,
	});
	return await ctx.db.insert("fileSecurityEvents", {
		actor: event.actor,
		actorAuthId: event.actor.authId,
		boxId: args.boxId,
		createdAt: event.createdAt,
		eventType: event.eventType,
		outcome: event.outcome,
		reasonCode: event.reasonCode,
	});
}

export function normalizeRootFolderName(name = "Root") {
	return {
		displayName: name,
		normalizedSiblingKey: normalizeFileWorkspaceSiblingKey(name),
	};
}

export function summarizeBoxForPrincipal(args: {
	box: {
		_id: Id<"fileBoxes">;
		_creationTime: number;
		archivedAt?: number;
		createdAt: number;
		createdByAuthId: string;
		description?: string;
		name: string;
		status: "active" | "archived" | "suspended" | "disabled";
		updatedAt: number;
		visibility: "private" | "public_link" | "magic_link" | "disabled";
	};
	principal: FileWorkspacePrincipal;
	rootNodeId?: Id<"fileNodes">;
}) {
	return {
		archivedAt: args.box.archivedAt,
		boxId: args.box._id,
		createdAt: args.box.createdAt,
		createdByAuthId: args.box.createdByAuthId,
		description: args.box.description,
		name: args.box.name,
		principalKind: args.principal.kind,
		role:
			args.principal.kind === "authenticated"
				? args.principal.role
				: args.principal.kind,
		rootNodeId: args.rootNodeId,
		status: args.box.status,
		updatedAt: args.box.updatedAt,
		visibility: args.box.visibility,
	};
}
