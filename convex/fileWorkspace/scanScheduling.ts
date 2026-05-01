import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getBoxStorageBytes } from "./helpers";

export async function scheduleFileWorkspaceScan(
	ctx: Pick<MutationCtx, "db" | "scheduler">,
	args: {
		box: Doc<"fileBoxes">;
		declaredContentType?: string;
		declaredFilename: string;
		declaredSizeBytes: number;
		storageId: Id<"_storage">;
		versionId: Id<"fileVersions">;
	}
) {
	await ctx.scheduler.runAfter(
		60_000,
		internal.fileWorkspace.scanActions.scanVersion,
		{
			boxQuota: {
				currentBoxBytes: await getBoxStorageBytes(ctx, args.box._id),
				maxBoxBytes: args.box.storageLimits.maxBoxBytes,
			},
			declaredContentType: args.declaredContentType,
			declaredFilename: args.declaredFilename,
			declaredSizeBytes: args.declaredSizeBytes,
			policy: args.box.scanPolicy,
			storageId: args.storageId,
			versionId: args.versionId,
		}
	);
}
