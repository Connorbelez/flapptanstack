import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { Viewer } from "../fluent";
import { authedMutation, authedQuery, convex } from "../fluent";
import { principalForLink } from "./access";
import {
	assertManagerOrPlatformAdmin,
	insertFileWorkspaceSecurityEvent,
	resolveBoxAuthenticatedPrincipal,
} from "./operations";
import { FILE_WORKSPACE_SAFE_ERRORS } from "./securityEvents";
import { generateShareLinkToken, hashShareLinkToken } from "./tokens";
import { fileShareLinkKindValidator } from "./validators";

function summarizeShareLink(link: Doc<"fileShareLinks">) {
	return {
		boxId: link.boxId,
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

async function assertShareLinkManager(
	ctx: Pick<MutationCtx, "db"> & {
		viewer: Viewer;
	},
	boxId: Id<"fileBoxes">
) {
	const principal = await resolveBoxAuthenticatedPrincipal(ctx, {
		boxId,
		requireActiveBox: false,
		viewer: ctx.viewer,
	});
	assertManagerOrPlatformAdmin(principal);
	return principal;
}

async function getRootNodeId(
	ctx: Pick<MutationCtx, "db">,
	boxId: Id<"fileBoxes">
) {
	const root = await ctx.db
		.query("fileNodes")
		.withIndex("by_box_parent", (query) =>
			query.eq("boxId", boxId).eq("parentId", undefined)
		)
		.filter((query) => query.eq(query.field("isRoot"), true))
		.first();
	return root?._id;
}

async function insertUniqueShareLink(args: {
	boxId: Id<"fileBoxes">;
	ctx: Pick<MutationCtx, "db">;
	downloadEnabled: boolean;
	expiresAt?: number;
	linkKind: "public_link" | "magic_link";
	tokenFactory?: () => string;
	viewerAuthId: string;
}): Promise<{ linkId: Id<"fileShareLinks">; rawToken: string }> {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const rawToken = args.tokenFactory?.() ?? generateShareLinkToken();
		const tokenHash = await hashShareLinkToken(rawToken);
		const collision = await args.ctx.db
			.query("fileShareLinks")
			.withIndex("by_token_hash", (query) => query.eq("tokenHash", tokenHash))
			.unique();
		if (collision) {
			continue;
		}
		const now = Date.now();
		const linkId = await args.ctx.db.insert("fileShareLinks", {
			boxId: args.boxId,
			tokenHash,
			linkKind: args.linkKind,
			expiresAt: args.expiresAt,
			viewEnabled: true,
			downloadEnabled: args.downloadEnabled,
			createdByAuthId: args.viewerAuthId,
			createdAt: now,
		});
		return { linkId, rawToken };
	}
	throw new ConvexError("Could not create a unique share link token.");
}

export const createShareLink = authedMutation
	.input({
		boxId: v.id("fileBoxes"),
		downloadEnabled: v.optional(v.boolean()),
		expiresAt: v.optional(v.number()),
		linkKind: fileShareLinkKindValidator,
	})
	.handler(async (ctx, args) => {
		const principal = await assertShareLinkManager(ctx, args.boxId);
		const created = await insertUniqueShareLink({
			boxId: args.boxId,
			ctx,
			downloadEnabled: args.downloadEnabled ?? false,
			expiresAt: args.expiresAt,
			linkKind: args.linkKind,
			viewerAuthId: ctx.viewer.authId,
		});
		await ctx.db.patch(args.boxId, {
			updatedAt: Date.now(),
			visibility: args.linkKind,
		});
		await insertFileWorkspaceSecurityEvent(ctx, {
			boxId: args.boxId,
			eventType: "share_link_created",
			outcome: "allowed",
			principal,
		});
		return {
			linkId: created.linkId,
			rawToken: created.rawToken,
		};
	})
	.public();

export const listShareLinks = authedQuery
	.input({ boxId: v.id("fileBoxes") })
	.handler(async (ctx, args) => {
		const principal = await resolveBoxAuthenticatedPrincipal(ctx, {
			boxId: args.boxId,
			requireActiveBox: false,
			viewer: ctx.viewer,
		});
		assertManagerOrPlatformAdmin(principal);
		const links = await ctx.db
			.query("fileShareLinks")
			.withIndex("by_box", (query) => query.eq("boxId", args.boxId))
			.collect();
		return links.map(summarizeShareLink);
	})
	.public();

export const revokeShareLink = authedMutation
	.input({
		boxId: v.id("fileBoxes"),
		linkId: v.id("fileShareLinks"),
	})
	.handler(async (ctx, args) => {
		const principal = await assertShareLinkManager(ctx, args.boxId);
		const link = await ctx.db.get(args.linkId);
		if (!link || link.boxId !== args.boxId) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
		}
		if (!link.revokedAt) {
			await ctx.db.patch(args.linkId, {
				revokedAt: Date.now(),
				revokedByAuthId: ctx.viewer.authId,
			});
			await insertFileWorkspaceSecurityEvent(ctx, {
				boxId: args.boxId,
				eventType: "share_link_revoked",
				outcome: "allowed",
				principal,
			});
		}
		return { linkId: args.linkId, status: "revoked" as const };
	})
	.public();

export const resolveBearerLink = convex
	.mutation()
	.input({ rawToken: v.string() })
	.handler(async (ctx, args) => {
		const tokenHash = await hashShareLinkToken(args.rawToken);
		const link = await ctx.db
			.query("fileShareLinks")
			.withIndex("by_token_hash", (query) => query.eq("tokenHash", tokenHash))
			.unique();
		if (!link || link.revokedAt || !link.viewEnabled) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
		}
		const now = Date.now();
		if (link.expiresAt !== undefined && link.expiresAt <= now) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.LINK_EXPIRED);
		}
		const box = await ctx.db.get(link.boxId);
		if (
			!box ||
			box.status === "disabled" ||
			box.status === "suspended" ||
			box.visibility !== link.linkKind
		) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
		}
		await ctx.db.patch(link._id, { lastUsedAt: now });
		await insertFileWorkspaceSecurityEvent(ctx, {
			boxId: box._id,
			eventType: "link_opened",
			outcome: "allowed",
			principal: principalForLink({
				linkId: link._id,
				linkKind: link.linkKind,
			}),
		});
		return {
			boxId: box._id,
			downloadEnabled:
				link.downloadEnabled &&
				(link.linkKind === "public_link"
					? box.downloadPolicy.publicLink
					: box.downloadPolicy.magicLink),
			linkId: link._id,
			linkKind: link.linkKind,
			principalKind: link.linkKind,
			rootNodeId: await getRootNodeId(ctx, box._id),
			viewEnabled: true,
		};
	})
	.public();
