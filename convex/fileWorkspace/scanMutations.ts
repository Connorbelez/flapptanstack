import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { adminMutation, convex } from "../fluent";
import { principalForPlatformAdmin } from "./access";
import { actorFromPrincipal } from "./securityEvents";

const cleanScanResultValidator = v.object({
	detectedContentType: v.string(),
	displayName: v.string(),
	normalizedExtension: v.optional(v.string()),
	sha256: v.string(),
	sizeBytes: v.number(),
	state: v.literal("clean"),
});

const rejectedScanResultValidator = v.object({
	displayName: v.optional(v.string()),
	message: v.string(),
	reasonCode: v.string(),
	sha256: v.optional(v.string()),
	state: v.literal("rejected"),
});

const scanErrorResultValidator = v.object({
	displayName: v.optional(v.string()),
	message: v.string(),
	reasonCode: v.string(),
	sha256: v.optional(v.string()),
	state: v.literal("scan_error"),
});

const fileScanResultValidator = v.union(
	cleanScanResultValidator,
	rejectedScanResultValidator,
	scanErrorResultValidator
);

function actorAuthId(
	actor: ReturnType<typeof actorFromPrincipal>
): string | undefined {
	return actor.authId;
}

async function recordScanSecurityEvent(args: {
	boxId: Id<"fileBoxes">;
	ctx: Pick<MutationCtx, "db">;
	eventType: "scan_state_changed" | "scan_error_released";
	metadata?: Record<string, string>;
	nodeId: Id<"fileNodes">;
	outcome: "allowed" | "denied" | "blocked";
	principal: Parameters<typeof actorFromPrincipal>[0];
	reasonCode?: string;
}) {
	const actor = actorFromPrincipal(args.principal);
	await args.ctx.db.insert("fileSecurityEvents", {
		actor,
		actorAuthId: actorAuthId(actor),
		boxId: args.boxId,
		createdAt: Date.now(),
		eventType: args.eventType,
		metadata: args.metadata,
		nodeId: args.nodeId,
		outcome: args.outcome,
		reasonCode: args.reasonCode,
	});
}

export const applyScanResult = convex
	.mutation()
	.input({
		expectedStorageId: v.id("_storage"),
		result: fileScanResultValidator,
		scannerAuthId: v.optional(v.string()),
		versionId: v.id("fileVersions"),
	})
	.handler(async (ctx, args) => {
		const version = await ctx.db.get(args.versionId);
		if (!version) {
			return { applied: false, reasonCode: "version_not_found" };
		}
		if (version.storageId !== args.expectedStorageId) {
			return { applied: false, reasonCode: "storage_mismatch" };
		}
		if (version.scanState !== "pending_scan") {
			return { applied: false, reasonCode: "scan_already_final" };
		}
		const node = await ctx.db.get(version.nodeId);
		if (!node || node.deletedAt) {
			return { applied: false, reasonCode: "node_not_active" };
		}

		const now = Date.now();
		if (args.result.state === "clean") {
			await ctx.db.patch(args.versionId, {
				contentType: args.result.detectedContentType,
				scanCompletedAt: now,
				scanReason: undefined,
				scanState: "clean",
				sha256: args.result.sha256,
				sizeBytes: args.result.sizeBytes,
			});
			await ctx.db.patch(version.nodeId, {
				currentVersionId: args.versionId,
				updatedAt: now,
			});
		} else {
			await ctx.db.patch(args.versionId, {
				scanCompletedAt: now,
				scanReason: args.result.reasonCode,
				scanState: args.result.state,
				sha256: args.result.sha256 ?? version.sha256,
			});
		}

		await recordScanSecurityEvent({
			boxId: version.boxId,
			ctx,
			eventType: "scan_state_changed",
			metadata: {
				scanState: args.result.state,
				versionId: args.versionId,
			},
			nodeId: version.nodeId,
			outcome: args.result.state === "clean" ? "allowed" : "blocked",
			principal: {
				authId: args.scannerAuthId ?? "system:file-workspace-scanner",
				kind: "platform_admin",
			},
			reasonCode:
				args.result.state === "clean" ? undefined : args.result.reasonCode,
		});

		return { applied: true, scanState: args.result.state };
	})
	.internal();

export const releaseScanError = adminMutation
	.input({
		reason: v.string(),
		versionId: v.id("fileVersions"),
	})
	.handler(async (ctx, args) => {
		const reason = args.reason.trim();
		if (reason.length === 0) {
			throw new ConvexError("Scan error release reason is required");
		}
		const version = await ctx.db.get(args.versionId);
		if (!version) {
			throw new ConvexError("File version not found");
		}
		if (version.scanState === "rejected") {
			throw new ConvexError("Rejected files cannot be released");
		}
		if (version.scanState !== "scan_error") {
			throw new ConvexError("Only scan_error files can be released");
		}
		const node = await ctx.db.get(version.nodeId);
		if (!node || node.deletedAt) {
			throw new ConvexError("File version is not active");
		}

		const now = Date.now();
		await ctx.db.patch(args.versionId, {
			releasedAt: now,
			releasedByAuthId: ctx.viewer.authId,
			releaseReason: reason,
			scanState: "released_by_admin",
		});
		await ctx.db.patch(version.nodeId, {
			currentVersionId: args.versionId,
			updatedAt: now,
		});

		await recordScanSecurityEvent({
			boxId: version.boxId,
			ctx,
			eventType: "scan_error_released",
			metadata: {
				releaseReason: reason,
				versionId: args.versionId,
			},
			nodeId: version.nodeId,
			outcome: "allowed",
			principal: principalForPlatformAdmin(ctx.viewer),
			reasonCode: "scan_error_admin_release",
		});

		return {
			released: true,
			scanState: "released_by_admin" as const,
			versionId: args.versionId,
		};
	})
	.public();
