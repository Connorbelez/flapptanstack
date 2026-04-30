import { describe, expect, it } from "vitest";
import { createTestConvex } from "../../../src/test/auth/helpers";
import type { Id } from "../../_generated/dataModel";

const NOW = Date.now();

const downloadPolicy = {
	authenticated: true,
	magicLink: false,
	publicLink: false,
};

const retentionPolicy = {
	allowEditorRestore: true,
	managerPermanentDeleteAfterDays: 30,
	trashRetentionDays: 14,
};

const scanPolicy = {
	allowedContentTypes: ["application/pdf", "text/plain"],
	archivesEnabled: false,
	blockedExtensions: [".exe", ".js"],
	maxFileSizeBytes: 25_000_000,
};

const storageLimits = {
	maxBoxBytes: 1_000_000_000,
	maxFileBytes: 25_000_000,
};

describe("File Workspace schema", () => {
	it("inserts representative standalone workspace rows and queries key indexes", async () => {
		const t = createTestConvex();

		const result = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {
				authId: "user_file_workspace_manager",
				email: "manager@test.fairlend.ca",
				firstName: "File",
				lastName: "Manager",
			});

			const boxId = await ctx.db.insert("fileBoxes", {
				name: "Closing Workspace",
				description: "Standalone file workspace",
				createdByAuthId: "user_file_workspace_manager",
				createdByUserId: userId,
				status: "active",
				visibility: "private",
				downloadPolicy,
				retentionPolicy,
				scanPolicy,
				storageLimits,
				createdAt: NOW,
				updatedAt: NOW,
			});

			const participantId = await ctx.db.insert("fileBoxParticipants", {
				boxId,
				participantKey: "auth:user_file_workspace_manager",
				authId: "user_file_workspace_manager",
				userId,
				email: "manager@test.fairlend.ca",
				role: "manager",
				status: "active",
				createdAt: NOW,
				updatedAt: NOW,
			});

			const rootNodeId = await ctx.db.insert("fileNodes", {
				boxId,
				nodeType: "folder",
				displayName: "Root",
				normalizedSiblingKey: "root",
				isRoot: true,
				createdByAuthId: "user_file_workspace_manager",
				createdAt: NOW,
				updatedAt: NOW,
			});

			const fileNodeId = await ctx.db.insert("fileNodes", {
				boxId,
				parentId: rootNodeId,
				nodeType: "file",
				displayName: "Commitment Letter.pdf",
				normalizedSiblingKey: "commitment letter.pdf",
				isRoot: false,
				createdByAuthId: "user_file_workspace_manager",
				createdAt: NOW,
				updatedAt: NOW,
			});

			const storageId = await (
				ctx.storage as unknown as {
					store: (blob: Blob) => Promise<Id<"_storage">>;
				}
			).store(new Blob(["file workspace smoke fixture"]));
			const versionId = await ctx.db.insert("fileVersions", {
				boxId,
				nodeId: fileNodeId,
				versionNumber: 1,
				storageId,
				sizeBytes: 42_000,
				contentType: "application/pdf",
				sha256: "abc123",
				uploadedByAuthId: "user_file_workspace_manager",
				uploadedAt: NOW,
				scanState: "clean",
				scanCompletedAt: NOW,
			});
			await ctx.db.patch(fileNodeId, { currentVersionId: versionId });

			const linkId = await ctx.db.insert("fileShareLinks", {
				boxId,
				tokenHash: "sha256:token-hash",
				linkKind: "public_link",
				viewEnabled: true,
				downloadEnabled: false,
				createdByAuthId: "user_file_workspace_manager",
				createdAt: NOW,
			});

			const commentId = await ctx.db.insert("fileComments", {
				boxId,
				nodeId: fileNodeId,
				body: "Ready for review.",
				authorAuthId: "user_file_workspace_manager",
				createdAt: NOW,
				updatedAt: NOW,
			});

			const tagId = await ctx.db.insert("fileTags", {
				boxId,
				name: "Closing",
				normalizedName: "closing",
				color: "green",
				createdByAuthId: "user_file_workspace_manager",
				createdAt: NOW,
				updatedAt: NOW,
			});

			await ctx.db.insert("fileNodeTags", {
				boxId,
				nodeId: fileNodeId,
				tagId,
				assignedByAuthId: "user_file_workspace_manager",
				assignedAt: NOW,
			});

			await ctx.db.insert("fileActivityEvents", {
				boxId,
				nodeId: fileNodeId,
				eventType: "file_uploaded",
				actor: {
					authId: "user_file_workspace_manager",
					email: "manager@test.fairlend.ca",
					principalKind: "authenticated",
				},
				actorAuthId: "user_file_workspace_manager",
				targetType: "version",
				targetId: versionId,
				createdAt: NOW,
			});

			await ctx.db.insert("fileSecurityEvents", {
				boxId,
				nodeId: fileNodeId,
				linkId,
				eventType: "preview_requested",
				actor: {
					authId: "user_file_workspace_manager",
					email: "manager@test.fairlend.ca",
					principalKind: "authenticated",
				},
				actorAuthId: "user_file_workspace_manager",
				outcome: "allowed",
				createdAt: NOW,
			});

			const participant = await ctx.db
				.query("fileBoxParticipants")
				.withIndex("by_box_participant_status", (query) =>
					query
						.eq("boxId", boxId)
						.eq("participantKey", "auth:user_file_workspace_manager")
						.eq("status", "active")
				)
				.unique();
			const folderChildren = await ctx.db
				.query("fileNodes")
				.withIndex("by_box_parent", (query) =>
					query.eq("boxId", boxId).eq("parentId", rootNodeId)
				)
				.collect();
			const sibling = await ctx.db
				.query("fileNodes")
				.withIndex("by_box_parent_name", (query) =>
					query
						.eq("boxId", boxId)
						.eq("parentId", rootNodeId)
						.eq("normalizedSiblingKey", "commitment letter.pdf")
				)
				.unique();
			const link = await ctx.db
				.query("fileShareLinks")
				.withIndex("by_token_hash", (query) =>
					query.eq("tokenHash", "sha256:token-hash")
				)
				.unique();
			const versions = await ctx.db
				.query("fileVersions")
				.withIndex("by_node_version", (query) => query.eq("nodeId", fileNodeId))
				.collect();
			const activity = await ctx.db
				.query("fileActivityEvents")
				.withIndex("by_box_created_at", (query) => query.eq("boxId", boxId))
				.collect();
			const security = await ctx.db
				.query("fileSecurityEvents")
				.withIndex("by_box_created_at", (query) => query.eq("boxId", boxId))
				.collect();

			return {
				activityCount: activity.length,
				commentId,
				folderChildCount: folderChildren.length,
				linkId: link?._id,
				participantId: participant?._id,
				seededParticipantId: participantId,
				securityCount: security.length,
				siblingId: sibling?._id,
				versionCount: versions.length,
			};
		});

		expect(result.participantId).toBe(result.seededParticipantId);
		expect(result.folderChildCount).toBe(1);
		expect(result.siblingId).toBeTruthy();
		expect(result.linkId).toBeTruthy();
		expect(result.versionCount).toBe(1);
		expect(result.commentId).toBeTruthy();
		expect(result.activityCount).toBe(1);
		expect(result.securityCount).toBe(1);
	});
});
