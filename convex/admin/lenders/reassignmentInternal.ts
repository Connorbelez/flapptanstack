import { ConvexError, v } from "convex/values";
import { convex } from "../../fluent";
import { ensureFairLendPortal } from "../../portals/homePortalAssignment";

export const getReassignmentActionContext = convex
	.query()
	.input({
		expectedCurrentBrokerId: v.id("brokers"),
		expectedCurrentOrgId: v.optional(v.string()),
		lenderId: v.id("lenders"),
		targetBrokerId: v.id("brokers"),
	})
	.handler(async (ctx, args) => {
		const lender = await ctx.db.get(args.lenderId);
		if (!lender) {
			throw new ConvexError("Lender not found");
		}
		if (lender.brokerId !== args.expectedCurrentBrokerId) {
			throw new ConvexError(
				"Lender broker assignment changed. Refresh and try again."
			);
		}
		if ((lender.orgId ?? null) !== (args.expectedCurrentOrgId ?? null)) {
			throw new ConvexError(
				"Lender organization assignment changed. Refresh and try again."
			);
		}

		const [lenderUser, currentBroker, targetBroker] = await Promise.all([
			ctx.db.get(lender.userId),
			ctx.db.get(lender.brokerId),
			ctx.db.get(args.targetBrokerId),
		]);
		if (!(lenderUser && currentBroker && targetBroker)) {
			throw new ConvexError("Reassignment context is incomplete");
		}

		return { currentBroker, lender, lenderUser, targetBroker };
	})
	.internal();

export const ensureFairLendTargetPortal = convex
	.mutation()
	.input({})
	.handler(async (ctx) => {
		return await ensureFairLendPortal(ctx);
	})
	.internal();

export const markReassignmentStarted = convex
	.mutation()
	.input({
		adminAuthId: v.string(),
		currentBrokerId: v.id("brokers"),
		currentOrgId: v.optional(v.string()),
		currentPortalHost: v.optional(v.string()),
		currentPortalId: v.optional(v.id("portals")),
		lenderId: v.id("lenders"),
		lenderUserId: v.id("users"),
		targetBrokerId: v.id("brokers"),
		targetOrgId: v.string(),
		targetPortalHost: v.optional(v.string()),
		targetPortalId: v.optional(v.id("portals")),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		const adminUser = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", args.adminAuthId))
			.first();

		return await ctx.db.insert("lenderBrokerReassignmentAttempts", {
			...args,
			adminUserId: adminUser?._id,
			createdAt: now,
			status: "started",
			updatedAt: now,
		});
	})
	.internal();

export const completeReassignment = convex
	.mutation()
	.input({
		attemptId: v.id("lenderBrokerReassignmentAttempts"),
		expectedCurrentBrokerId: v.id("brokers"),
		expectedCurrentOrgId: v.optional(v.string()),
		lenderId: v.id("lenders"),
		lenderUserId: v.id("users"),
		targetBrokerId: v.id("brokers"),
		targetMembershipId: v.optional(v.string()),
		targetMembershipWasPreexisting: v.boolean(),
		targetOrgId: v.string(),
		targetPortalId: v.id("portals"),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		const lender = await ctx.db.get(args.lenderId);
		if (
			!lender ||
			lender.brokerId !== args.expectedCurrentBrokerId ||
			(lender.orgId ?? null) !== (args.expectedCurrentOrgId ?? null)
		) {
			throw new ConvexError(
				"Lender assignment changed during reassignment. Manual repair required."
			);
		}

		await ctx.db.patch(args.lenderId, {
			brokerId: args.targetBrokerId,
			orgId: args.targetOrgId,
		});
		await ctx.db.patch(args.lenderUserId, {
			homePortalId: args.targetPortalId,
		});
		await ctx.db.patch(args.attemptId, {
			completedAt: now,
			status: "succeeded",
			targetMembershipId: args.targetMembershipId,
			targetMembershipWasPreexisting: args.targetMembershipWasPreexisting,
			targetPortalId: args.targetPortalId,
			updatedAt: now,
		});
		return args.attemptId;
	})
	.internal();

export const markReassignmentFailed = convex
	.mutation()
	.input({
		attemptId: v.id("lenderBrokerReassignmentAttempts"),
		failureMessage: v.string(),
		failurePhase: v.union(
			v.literal("target_membership"),
			v.literal("old_membership_removal"),
			v.literal("rollback"),
			v.literal("convex_patch")
		),
		repairNeeded: v.boolean(),
		rollbackStatus: v.optional(
			v.union(
				v.literal("not_needed"),
				v.literal("succeeded"),
				v.literal("failed")
			)
		),
		targetMembershipId: v.optional(v.string()),
		targetMembershipWasPreexisting: v.optional(v.boolean()),
	})
	.handler(async (ctx, args) => {
		const patch: Partial<{
			failureMessage: string;
			failurePhase:
				| "target_membership"
				| "old_membership_removal"
				| "rollback"
				| "convex_patch";
			rollbackStatus: "not_needed" | "succeeded" | "failed";
			status: "failed" | "repair_needed";
			targetMembershipId: string;
			targetMembershipWasPreexisting: boolean;
			updatedAt: number;
		}> = {
			failureMessage: args.failureMessage,
			failurePhase: args.failurePhase,
			rollbackStatus: args.rollbackStatus,
			status: args.repairNeeded ? "repair_needed" : "failed",
			updatedAt: Date.now(),
		};
		if (args.targetMembershipId) {
			patch.targetMembershipId = args.targetMembershipId;
		}
		if (args.targetMembershipWasPreexisting !== undefined) {
			patch.targetMembershipWasPreexisting =
				args.targetMembershipWasPreexisting;
		}
		await ctx.db.patch(args.attemptId, patch);
	})
	.internal();
