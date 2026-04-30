import { type FunctionReference, makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { convex } from "../fluent";
import {
	createDefaultFileScannerInput,
	defaultFileWorkspaceScanner,
	type FileScanResult,
} from "./scanner";

type ApplyScanResultReturn =
	| { applied: false; reasonCode: string }
	| { applied: true; scanState: FileScanResult["state"] };

const applyScanResultRef = makeFunctionReference<
	"mutation",
	{
		expectedStorageId: Id<"_storage">;
		result: FileScanResult;
		scannerAuthId?: string;
		versionId: Id<"fileVersions">;
	},
	ApplyScanResultReturn
>(
	"fileWorkspace/scanMutations:applyScanResult"
) as unknown as FunctionReference<
	"mutation",
	"internal",
	{
		expectedStorageId: Id<"_storage">;
		result: FileScanResult;
		scannerAuthId?: string;
		versionId: Id<"fileVersions">;
	},
	ApplyScanResultReturn
>;

export const scanVersion = convex
	.action()
	.input({
		boxQuota: v.optional(
			v.object({
				currentBoxBytes: v.number(),
				maxBoxBytes: v.number(),
			})
		),
		declaredContentType: v.optional(v.string()),
		declaredFilename: v.string(),
		declaredSizeBytes: v.number(),
		policy: v.object({
			allowedContentTypes: v.array(v.string()),
			archivesEnabled: v.boolean(),
			blockedExtensions: v.array(v.string()),
			maxFileSizeBytes: v.number(),
		}),
		storageId: v.id("_storage"),
		versionId: v.id("fileVersions"),
	})
	.handler(async (ctx, args): Promise<ApplyScanResultReturn> => {
		const blob = await ctx.storage.get(args.storageId);
		if (!blob) {
			return ctx.runMutation(applyScanResultRef, {
				expectedStorageId: args.storageId,
				result: {
					message: "Stored blob is missing from Convex storage.",
					reasonCode: "storage_blob_missing",
					state: "scan_error",
				},
				versionId: args.versionId,
			});
		}

		const bytes = new Uint8Array(await blob.arrayBuffer());
		const result = await defaultFileWorkspaceScanner.scan(
			createDefaultFileScannerInput({
				bytes,
				boxQuota: args.boxQuota,
				declaredContentType: args.declaredContentType,
				declaredFilename: args.declaredFilename,
				declaredSizeBytes: args.declaredSizeBytes,
				policy: args.policy,
				storageId: args.storageId,
			})
		);

		return ctx.runMutation(applyScanResultRef, {
			expectedStorageId: args.storageId,
			result,
			versionId: args.versionId,
		});
	})
	.internal();
