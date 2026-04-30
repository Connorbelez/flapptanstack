import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { Viewer } from "../fluent";
import { authedMutation, authedQuery } from "../fluent";
import {
	normalizeFileWorkspaceEmail,
	participantKeyForAuthId,
	participantKeyForEmail,
} from "./identity";
import {
	assertManagerOrPlatformAdmin,
	getUserIdForAuthId,
	insertFileWorkspaceActivity,
	insertFileWorkspaceSecurityEvent,
	resolveBoxAuthenticatedPrincipal,
} from "./operations";
import { FILE_WORKSPACE_SAFE_ERRORS } from "./securityEvents";
import { fileWorkspaceRoleValidator } from "./validators";

const participantGrantInput = v.object({
	authId: v.optional(v.string()),
	email: v.optional(v.string()),
	role: fileWorkspaceRoleValidator,
});

function resolveParticipantGrant(args: { authId?: string; email?: string }): {
	authId?: string;
	email?: string;
	participantKey: string;
} {
	const authId = args.authId?.trim();
	if (authId) {
		return {
			authId,
			email: args.email ? normalizeFileWorkspaceEmail(args.email) : undefined,
			participantKey: participantKeyForAuthId(authId),
		};
	}
	if (args.email) {
		const email = normalizeFileWorkspaceEmail(args.email);
		return {
			email,
			participantKey: participantKeyForEmail(email),
		};
	}
	throw new ConvexError("Participant auth id or email is required");
}

async function getActiveParticipantByKey(
	ctx: Pick<MutationCtx, "db">,
	args: {
		boxId: Id<"fileBoxes">;
		participantKey: string;
	}
) {
	return await ctx.db
		.query("fileBoxParticipants")
		.withIndex("by_box_participant_status", (query) =>
			query
				.eq("boxId", args.boxId)
				.eq("participantKey", args.participantKey)
				.eq("status", "active")
		)
		.unique();
}

async function countActiveManagers(
	ctx: Pick<MutationCtx, "db">,
	boxId: Id<"fileBoxes">
): Promise<number> {
	const managers = await ctx.db
		.query("fileBoxParticipants")
		.withIndex("by_box_status_role", (query) =>
			query.eq("boxId", boxId).eq("status", "active").eq("role", "manager")
		)
		.collect();
	return managers.length;
}

function summarizeParticipant(participant: Doc<"fileBoxParticipants">) {
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

async function assertParticipantManager(
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

async function emitParticipantEvents(
	ctx: Pick<MutationCtx, "db">,
	args: {
		boxId: Id<"fileBoxes">;
		eventType:
			| "participant_invited"
			| "participant_removed"
			| "participant_role_changed";
		participantId: Id<"fileBoxParticipants">;
		principal: Parameters<
			typeof insertFileWorkspaceSecurityEvent
		>[1]["principal"];
	}
) {
	await insertFileWorkspaceActivity(ctx, {
		boxId: args.boxId,
		eventType: args.eventType,
		principal: args.principal,
		targetId: args.participantId,
		targetType: "participant",
	});
	await insertFileWorkspaceSecurityEvent(ctx, {
		boxId: args.boxId,
		eventType: args.eventType,
		outcome: "allowed",
		principal: args.principal,
	});
}

export const listParticipants = authedQuery
	.input({ boxId: v.id("fileBoxes") })
	.handler(async (ctx, args) => {
		const principal = await resolveBoxAuthenticatedPrincipal(ctx, {
			boxId: args.boxId,
			requireActiveBox: false,
			viewer: ctx.viewer,
		});
		assertManagerOrPlatformAdmin(principal);
		const participants = await ctx.db
			.query("fileBoxParticipants")
			.withIndex("by_box", (query) => query.eq("boxId", args.boxId))
			.collect();
		return participants
			.filter((participant) => participant.status !== "revoked")
			.map(summarizeParticipant)
			.sort((left, right) => left.createdAt - right.createdAt);
	})
	.public();

export const upsertParticipant = authedMutation
	.input({
		boxId: v.id("fileBoxes"),
		grant: participantGrantInput,
	})
	.handler(async (ctx, args) => {
		const principal = await assertParticipantManager(ctx, args.boxId);
		const grant = resolveParticipantGrant(args.grant);
		const now = Date.now();
		const userId = grant.authId
			? await getUserIdForAuthId(ctx, grant.authId)
			: undefined;
		const existing = await getActiveParticipantByKey(ctx, {
			boxId: args.boxId,
			participantKey: grant.participantKey,
		});

		if (existing) {
			const roleChanged = existing.role !== args.grant.role;
			await ctx.db.patch(existing._id, {
				authId: grant.authId ?? existing.authId,
				email: grant.email ?? existing.email,
				role: args.grant.role,
				updatedAt: now,
				userId: userId ?? existing.userId,
			});
			if (roleChanged) {
				await emitParticipantEvents(ctx, {
					boxId: args.boxId,
					eventType: "participant_role_changed",
					participantId: existing._id,
					principal,
				});
			}
			return { participantId: existing._id, status: "updated" as const };
		}

		const participantId = await ctx.db.insert("fileBoxParticipants", {
			boxId: args.boxId,
			participantKey: grant.participantKey,
			authId: grant.authId,
			userId,
			email: grant.email,
			role: args.grant.role,
			status: "active",
			invitedByAuthId:
				principal.kind === "authenticated" ||
				principal.kind === "platform_admin"
					? principal.authId
					: undefined,
			invitedAt: now,
			createdAt: now,
			updatedAt: now,
		});
		await emitParticipantEvents(ctx, {
			boxId: args.boxId,
			eventType: "participant_invited",
			participantId,
			principal,
		});
		return { participantId, status: "created" as const };
	})
	.public();

export const removeParticipant = authedMutation
	.input({
		boxId: v.id("fileBoxes"),
		participantId: v.id("fileBoxParticipants"),
	})
	.handler(async (ctx, args) => {
		const principal = await assertParticipantManager(ctx, args.boxId);
		const participant = await ctx.db.get(args.participantId);
		if (!participant || participant.boxId !== args.boxId) {
			throw new ConvexError(FILE_WORKSPACE_SAFE_ERRORS.ACCESS_DENIED);
		}
		if (participant.status === "revoked") {
			return {
				participantId: args.participantId,
				status: "already_revoked" as const,
			};
		}
		if (
			participant.role === "manager" &&
			(await countActiveManagers(ctx, args.boxId)) <= 1
		) {
			throw new ConvexError("At least one manager must remain on the box.");
		}
		await ctx.db.patch(args.participantId, {
			revokedAt: Date.now(),
			status: "revoked",
			updatedAt: Date.now(),
		});
		await emitParticipantEvents(ctx, {
			boxId: args.boxId,
			eventType: "participant_removed",
			participantId: args.participantId,
			principal,
		});
		return { participantId: args.participantId, status: "revoked" as const };
	})
	.public();
