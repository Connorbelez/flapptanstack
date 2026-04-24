import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { adminMutation } from "../fluent";
import { applyVelocityPackageExceptionResolution } from "./workspaces";

export const resolveVelocityPackageException = adminMutation
	.input({
		exceptionId: v.id("velocityPackageExceptions"),
		resolutionNote: v.string(),
	})
	.handler(async (ctx, args) =>
		applyVelocityPackageExceptionResolution(
			ctx as MutationCtx,
			args,
			ctx.viewer
		)
	)
	.public();
