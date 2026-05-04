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
		const validationBlockingReasons: string[] = [];
		if (lender.brokerId !== args.expectedCurrentBrokerId) {
			validationBlockingReasons.push(
				"Lender broker assignment changed. Refresh and try again."
			);
		}
		if ((lender.orgId ?? null) !== (args.expectedCurrentOrgId ?? null)) {
			validationBlockingReasons.push(
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

		return {
			currentBroker,
			lender,
			lenderUser,
			targetBroker,
			validationBlockingReasons,
		};
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
		currentMembershipId: v.optional(v.string()),
		currentMembershipOperation: v.optional(
			v.union(
				v.literal("not_found"),
				v.literal("deactivated"),
				v.literal("role_removed")
			)
		),
		currentMembershipRoleSlugsAfter: v.optional(v.array(v.string())),
		currentMembershipRoleSlugsBefore: v.optional(v.array(v.string())),
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
		const attemptPatch: Partial<{
			completedAt: number;
			currentMembershipId: string;
			currentMembershipOperation: "not_found" | "deactivated" | "role_removed";
			currentMembershipRoleSlugsAfter: string[];
			currentMembershipRoleSlugsBefore: string[];
			status: "succeeded";
			targetMembershipId: string;
			targetMembershipWasPreexisting: boolean;
			targetPortalId: typeof args.targetPortalId;
			updatedAt: number;
		}> = {
			completedAt: now,
			status: "succeeded",
			targetMembershipWasPreexisting: args.targetMembershipWasPreexisting,
			targetPortalId: args.targetPortalId,
			updatedAt: now,
		};
		if (args.currentMembershipId) {
			attemptPatch.currentMembershipId = args.currentMembershipId;
		}
		if (args.currentMembershipOperation) {
			attemptPatch.currentMembershipOperation = args.currentMembershipOperation;
		}
		if (args.currentMembershipRoleSlugsAfter) {
			attemptPatch.currentMembershipRoleSlugsAfter =
				args.currentMembershipRoleSlugsAfter;
		}
		if (args.currentMembershipRoleSlugsBefore) {
			attemptPatch.currentMembershipRoleSlugsBefore =
				args.currentMembershipRoleSlugsBefore;
		}
		if (args.targetMembershipId) {
			attemptPatch.targetMembershipId = args.targetMembershipId;
		}
		await ctx.db.patch(args.attemptId, attemptPatch);
		return args.attemptId;
	})
	.internal();

export const markReassignmentFailed = convex
	.mutation()
	.input({
		attemptId: v.id("lenderBrokerReassignmentAttempts"),
		currentMembershipId: v.optional(v.string()),
		currentMembershipOperation: v.optional(
			v.union(
				v.literal("not_found"),
				v.literal("deactivated"),
				v.literal("role_removed")
			)
		),
		currentMembershipRoleSlugsAfter: v.optional(v.array(v.string())),
		currentMembershipRoleSlugsBefore: v.optional(v.array(v.string())),
		failureMessage: v.string(),
		failurePhase: v.union(
			v.literal("validation"),
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
			currentMembershipId: string;
			currentMembershipOperation: "not_found" | "deactivated" | "role_removed";
			currentMembershipRoleSlugsAfter: string[];
			currentMembershipRoleSlugsBefore: string[];
			failureMessage: string;
			failurePhase:
				| "validation"
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
		if (args.currentMembershipId) {
			patch.currentMembershipId = args.currentMembershipId;
		}
		if (args.currentMembershipOperation) {
			patch.currentMembershipOperation = args.currentMembershipOperation;
		}
		if (args.currentMembershipRoleSlugsBefore) {
			patch.currentMembershipRoleSlugsBefore =
				args.currentMembershipRoleSlugsBefore;
		}
		if (args.currentMembershipRoleSlugsAfter) {
			patch.currentMembershipRoleSlugsAfter =
				args.currentMembershipRoleSlugsAfter;
		}
		await ctx.db.patch(args.attemptId, patch);
	})
	.internal();
