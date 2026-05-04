import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import { appendAuditJournalEntry } from "../engine/auditJournal";

export type MicInvestorAccessRequestId = Id<"micInvestorAccessRequests">;

export const getRequestById = internalQuery({
	args: { id: v.id("micInvestorAccessRequests") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	},
});

export const getSyncedUserByWorkosId = internalQuery({
	args: { workosUserId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("users")
			.withIndex("authId", (q) => q.eq("authId", args.workosUserId))
			.unique();
	},
});

export const assignMicHomePortalIfCompatible = internalMutation({
	args: {
		portalId: v.id("portals"),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db.get(args.userId);
		if (!user) {
			return "missing_user" as const;
		}

		if (user.homePortalId === args.portalId) {
			return "already_assigned" as const;
		}

		if (user.homePortalId) {
			const existingPortal = await ctx.db.get(user.homePortalId);
			if (existingPortal?.portalType !== "mic") {
				return "not_compatible" as const;
			}
		}

		await ctx.db.patch(args.userId, { homePortalId: args.portalId });
		return "assigned" as const;
	},
});

export const beginProvisioningProcessing = internalMutation({
	args: {
		journalEntryId: v.string(),
		requestId: v.id("micInvestorAccessRequests"),
	},
	handler: async (ctx, args) => {
		const request = await ctx.db.get(args.requestId);
		if (!request) {
			throw new Error(
				`MIC investor access request not found: ${args.requestId}`
			);
		}

		const processed = request.processedProvisioningJournalIds ?? [];
		if (processed.includes(args.journalEntryId)) {
			return { status: "processed" as const };
		}

		if (request.activeProvisioningJournalId === args.journalEntryId) {
			return { status: "in_progress" as const };
		}

		if (
			request.activeProvisioningJournalId &&
			request.activeProvisioningJournalId !== args.journalEntryId
		) {
			throw new Error(
				`MIC investor access provisioning already in progress for request ${args.requestId}`
			);
		}

		await ctx.db.patch(args.requestId, {
			activeProvisioningJournalId: args.journalEntryId,
			provisioningError: undefined,
			provisioningState: "in_progress",
		});

		return { status: "started" as const };
	},
});

export const completeProvisioningProcessing = internalMutation({
	args: {
		journalEntryId: v.string(),
		membershipWorkosId: v.optional(v.string()),
		requestId: v.id("micInvestorAccessRequests"),
		userWorkosId: v.string(),
	},
	handler: async (ctx, args) => {
		const request = await ctx.db.get(args.requestId);
		if (!request) {
			throw new Error(
				`MIC investor access request not found: ${args.requestId}`
			);
		}

		const processed = request.processedProvisioningJournalIds ?? [];
		const nextProcessed = processed.includes(args.journalEntryId)
			? processed
			: [...processed, args.journalEntryId];

		await ctx.db.patch(args.requestId, {
			activeProvisioningJournalId:
				request.activeProvisioningJournalId === args.journalEntryId
					? undefined
					: request.activeProvisioningJournalId,
			invitedUserWorkosId: args.userWorkosId,
			membershipWorkosId: args.membershipWorkosId,
			processedProvisioningJournalIds: nextProcessed,
			provisioningError: undefined,
			provisioningState: "completed",
		});

		const portal = await ctx.db.get(request.portalId);
		await appendAuditJournalEntry(ctx, {
			actorId: "system",
			actorType: "system",
			channel: "scheduler",
			entityId: args.requestId,
			entityType: "micInvestorAccessRequest",
			eventCategory: "domain_write",
			eventType: "PROVISIONING_COMPLETED",
			idempotencyKey: args.journalEntryId,
			newState: request.status,
			organizationId: portal?.orgId,
			outcome: "transitioned",
			payload: {
				membershipWorkosId: args.membershipWorkosId,
				provisioningState: "completed",
				userWorkosId: args.userWorkosId,
			},
			previousState: request.status,
			timestamp: Date.now(),
		});
	},
});

export const failProvisioningProcessing = internalMutation({
	args: {
		error: v.string(),
		journalEntryId: v.string(),
		requestId: v.id("micInvestorAccessRequests"),
		userWorkosId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const request = await ctx.db.get(args.requestId);
		if (!request) {
			throw new Error(
				`MIC investor access request not found: ${args.requestId}`
			);
		}

		await ctx.db.patch(args.requestId, {
			activeProvisioningJournalId:
				request.activeProvisioningJournalId === args.journalEntryId
					? undefined
					: request.activeProvisioningJournalId,
			invitedUserWorkosId: args.userWorkosId,
			provisioningError: args.error,
			provisioningState: "failed",
		});

		const portal = await ctx.db.get(request.portalId);
		await appendAuditJournalEntry(ctx, {
			actorId: "system",
			actorType: "system",
			channel: "scheduler",
			entityId: args.requestId,
			entityType: "micInvestorAccessRequest",
			eventCategory: "domain_write",
			eventType: "PROVISIONING_FAILED",
			idempotencyKey: args.journalEntryId,
			newState: request.status,
			organizationId: portal?.orgId,
			outcome: "transitioned",
			payload: {
				error: args.error,
				provisioningState: "failed",
				userWorkosId: args.userWorkosId,
			},
			previousState: request.status,
			reason: args.error,
			timestamp: Date.now(),
		});
	},
});
