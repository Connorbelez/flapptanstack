import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { adminMutation } from "../fluent";
import { applyVelocityPackageFinalReview } from "./workspaces";

export const confirmVelocityPackageFinalReview = adminMutation
	.input({
		normalizedCoreHash: v.string(),
		snapshotId: v.id("velocityPackageSnapshots"),
		workspaceId: v.id("velocityPackageWorkspaces"),
	})
	.handler(async (ctx, args) =>
		applyVelocityPackageFinalReview(ctx as MutationCtx, args, ctx.viewer)
	)
	.public();
