import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { adminMutation } from "../fluent";
import { velocityPackageDocumentRoleValidator } from "./validators";
import { applyVelocityPackageDocumentLink } from "./workspaces";

export const linkVelocityPackageDocument = adminMutation
	.input({
		documentAssetId: v.id("documentAssets"),
		role: velocityPackageDocumentRoleValidator,
		workspaceId: v.id("velocityPackageWorkspaces"),
	})
	.handler(async (ctx, args) =>
		applyVelocityPackageDocumentLink(ctx as MutationCtx, args, ctx.viewer)
	)
	.public();
