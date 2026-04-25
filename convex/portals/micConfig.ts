import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { convex } from "../fluent";

const micPortalConfigResultValidator = v.union(
	v.object({
		availability: v.literal("active"),
		micLenderAuthId: v.string(),
		orgId: v.string(),
		portalId: v.id("portals"),
	}),
	v.object({
		availability: v.union(
			v.literal("missing_lender_mapping"),
			v.literal("not_mic_portal"),
			v.literal("unavailable"),
			v.literal("unpublished")
		),
		portalId: v.optional(v.id("portals")),
	})
);

export type MicPortalConfigResult =
	| {
			availability: "active";
			micLenderAuthId: string;
			orgId: string;
			portalId: Id<"portals">;
	  }
	| {
			availability:
				| "missing_lender_mapping"
				| "not_mic_portal"
				| "unavailable"
				| "unpublished";
			portalId?: Id<"portals">;
	  };

type MicPortalConfigReaderCtx = Pick<QueryCtx, "db">;

export async function resolveMicPortalConfig(
	ctx: MicPortalConfigReaderCtx,
	portalId: Id<"portals">
): Promise<MicPortalConfigResult> {
	const portal = await ctx.db.get(portalId);

	if (
		!portal ||
		portal.status === "archived" ||
		portal.status === "suspended"
	) {
		return { availability: "unavailable", portalId };
	}

	if (portal.portalType !== "mic") {
		return { availability: "not_mic_portal", portalId };
	}

	if (!portal.isPublished || portal.status !== "active") {
		return { availability: "unpublished", portalId };
	}

	const micLenderAuthId = portal.micLenderAuthId?.trim();
	if (!micLenderAuthId) {
		return { availability: "missing_lender_mapping", portalId };
	}

	return {
		availability: "active",
		micLenderAuthId,
		orgId: portal.orgId,
		portalId: portal._id,
	};
}

export const getMicPortalConfig = convex
	.query()
	.input({ portalId: v.id("portals") })
	.returns(micPortalConfigResultValidator)
	.handler(async (ctx, args) => {
		return await resolveMicPortalConfig(ctx, args.portalId);
	})
	.internal();
