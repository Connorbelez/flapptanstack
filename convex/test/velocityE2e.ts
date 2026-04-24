import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { adminMutation } from "../fluent";

type AdminMutationCtx = MutationCtx & {
	viewer: {
		authId: string;
		orgId?: string;
	};
};

async function resolveViewerUserId(ctx: AdminMutationCtx) {
	const user = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", ctx.viewer.authId))
		.unique();
	if (!user) {
		throw new ConvexError("Viewer user not found for Velocity e2e helper.");
	}
	return user._id;
}

export const recordFailedActivationAttempt = adminMutation
	.input({
		failureCode: v.optional(v.string()),
		failureMessage: v.optional(v.string()),
		workspaceId: v.id("velocityPackageWorkspaces"),
	})
	.handler(async (ctx, args) => {
		const workspace = await ctx.db.get(args.workspaceId);
		if (!workspace) {
			throw new ConvexError("Velocity package workspace not found.");
		}

		const reviewedSnapshotId = workspace.finalReview?.reviewedSnapshotId;
		const reviewedSnapshotHash = workspace.finalReview?.reviewedSnapshotHash;
		if (!(reviewedSnapshotId && reviewedSnapshotHash)) {
			throw new ConvexError(
				"Velocity e2e failed activation requires final review first."
			);
		}

		const actorUserId = await resolveViewerUserId(ctx);
		const now = Date.now();
		const failureCode = args.failureCode ?? "rotessa_request_failed";
		const failureMessage =
			args.failureMessage ?? "Rotessa schedule creation failed.";
		const activationAttemptId = await ctx.db.insert(
			"velocityActivationAttempts",
			{
				actorAuthId: ctx.viewer.authId,
				actorUserId,
				failedAt: now,
				failureCode,
				failureMessage,
				idempotencyKey: `velocity:e2e:${String(args.workspaceId)}:${now}`,
				reviewedSnapshotHash,
				reviewedSnapshotId,
				rotessaCustomerRef: "e2e-customer-501",
				startedAt: now,
				status: "failed",
				workspaceId: args.workspaceId,
			}
		);

		await ctx.db.patch(args.workspaceId, {
			exceptionKind: "activation_exception",
			exceptionSummary: failureMessage,
			state: "activation_failed_remediation",
			updatedAt: now,
		});
		await ctx.db.insert("velocityPackageExceptions", {
			details: {
				activationAttemptId: String(activationAttemptId),
				failureCode,
			},
			kind: "activation_exception",
			message: failureMessage,
			openedAt: now,
			severity: "blocking",
			sourceActivationAttemptId: activationAttemptId,
			status: "open",
			title: "Velocity activation failed",
			workspaceId: args.workspaceId,
		});

		return {
			activationAttemptId,
			status: "failed" as const,
		};
	})
	.public();
