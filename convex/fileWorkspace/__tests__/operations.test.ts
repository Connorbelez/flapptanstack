import { anyApi } from "convex/server";
import { describe, expect, it } from "vitest";
import {
	createMockViewer,
	createTestConvex,
} from "../../../src/test/auth/helpers";
import type { Id } from "../../_generated/dataModel";

const boxesApi = anyApi.fileWorkspace.boxes;
const nodesApi = anyApi.fileWorkspace.nodes;
const participantsApi = anyApi.fileWorkspace.participants;
const shareLinksApi = anyApi.fileWorkspace.shareLinks;
const uploadsApi = anyApi.fileWorkspace.uploads;
const versionsApi = anyApi.fileWorkspace.versions;
const commentsApi = anyApi.fileWorkspace.comments;
const tagsApi = anyApi.fileWorkspace.tags;
const readModelsApi = anyApi.fileWorkspace.readModels;

const MANAGER = createMockViewer({
	email: "fw-manager@test.fairlend.ca",
	orgId: "org_file_workspace",
	orgName: "Broker Org",
	permissions: ["broker:access"],
	roles: ["broker"],
	subject: "user_fw_manager",
});

const VIEWER = createMockViewer({
	email: "fw-viewer@test.fairlend.ca",
	orgId: "org_file_workspace",
	orgName: "Broker Org",
	permissions: [],
	roles: ["member"],
	subject: "user_fw_viewer",
});

const EDITOR = createMockViewer({
	email: "fw-editor@test.fairlend.ca",
	orgId: "org_file_workspace",
	orgName: "Broker Org",
	permissions: ["broker:access"],
	roles: ["broker"],
	subject: "user_fw_editor",
});

async function storeTestBlob(t: ReturnType<typeof createTestConvex>) {
	return await t.run(async (ctx) => {
		return await (
			ctx.storage as unknown as {
				store: (blob: Blob) => Promise<Id<"_storage">>;
			}
		).store(new Blob(["%PDF-1.7\n"], { type: "application/pdf" }));
	});
}

async function createWorkspace(t: ReturnType<typeof createTestConvex>) {
	return await t.withIdentity(MANAGER).mutation(boxesApi.createBox, {
		name: "Lifecycle Workspace",
	});
}

async function uploadTestFile(
	t: ReturnType<typeof createTestConvex>,
	args: {
		boxId: Id<"fileBoxes">;
		name: string;
		parentNodeId: Id<"fileNodes">;
	}
) {
	const storageId = await storeTestBlob(t);
	const uploaded = await t
		.withIdentity(MANAGER)
		.mutation(uploadsApi.finalizeUpload, {
			boxId: args.boxId,
			declaredFile: {
				contentType: "application/pdf",
				name: args.name,
				sizeBytes: 9,
			},
			parentNodeId: args.parentNodeId,
			storageId,
		});
	return { ...uploaded, storageId };
}

async function applyCleanScan(
	t: ReturnType<typeof createTestConvex>,
	args: { storageId: Id<"_storage">; versionId: Id<"fileVersions"> }
) {
	await t.mutation(anyApi.fileWorkspace.scanMutations.applyScanResult, {
		expectedStorageId: args.storageId,
		result: {
			detectedContentType: "application/pdf",
			displayName: "Scanned.pdf",
			sha256: "clean",
			sizeBytes: 9,
			state: "clean",
		},
		versionId: args.versionId,
	});
}

describe("File Workspace operations", () => {
	it("creates folders, enforces sibling uniqueness, and rejects move cycles", async () => {
		const t = createTestConvex();
		const box = await createWorkspace(t);

		const folder = await t
			.withIdentity(MANAGER)
			.mutation(nodesApi.createFolder, {
				boxId: box.boxId,
				name: "Closing Docs",
				parentNodeId: box.rootNodeId,
			});
		const child = await t
			.withIdentity(MANAGER)
			.mutation(nodesApi.createFolder, {
				boxId: box.boxId,
				name: "Conditions",
				parentNodeId: folder.nodeId,
			});

		await expect(
			t.withIdentity(MANAGER).mutation(nodesApi.createFolder, {
				boxId: box.boxId,
				name: " closing docs ",
				parentNodeId: box.rootNodeId,
			})
		).rejects.toThrow("already exists");

		await expect(
			t.withIdentity(MANAGER).mutation(nodesApi.moveNode, {
				boxId: box.boxId,
				newParentNodeId: child.nodeId,
				nodeId: folder.nodeId,
			})
		).rejects.toThrow("Cannot move a folder");
	});

	it("soft-deletes folders so descendants disappear from normal views", async () => {
		const t = createTestConvex();
		const box = await createWorkspace(t);
		const folder = await t
			.withIdentity(MANAGER)
			.mutation(nodesApi.createFolder, {
				boxId: box.boxId,
				name: "Trash Me",
				parentNodeId: box.rootNodeId,
			});

		await t.withIdentity(MANAGER).mutation(nodesApi.softDeleteNode, {
			boxId: box.boxId,
			nodeId: folder.nodeId,
		});
		const listing = await t
			.withIdentity(MANAGER)
			.query(readModelsApi.listNodes, {
				boxId: box.boxId,
				parentNodeId: box.rootNodeId,
			});

		expect(
			listing.nodes.map((node: { nodeId: string }) => node.nodeId)
		).not.toContain(folder.nodeId);
	});

	it("keeps replacement versions non-current until scan promotion and gates URLs", async () => {
		const t = createTestConvex();
		const box = await createWorkspace(t);
		const initialStorageId = await storeTestBlob(t);

		const uploaded = await t
			.withIdentity(MANAGER)
			.mutation(uploadsApi.finalizeUpload, {
				boxId: box.boxId,
				declaredFile: {
					contentType: "application/pdf",
					name: "Commitment Letter.pdf",
					sizeBytes: 9,
				},
				parentNodeId: box.rootNodeId,
				storageId: initialStorageId,
			});

		await expect(
			t.withIdentity(MANAGER).mutation(versionsApi.getPreviewUrl, {
				boxId: box.boxId,
				nodeId: uploaded.nodeId,
			})
		).resolves.toMatchObject({
			denied: true,
			reasonCode: "file_version_blocked",
		});

		await t.mutation(anyApi.fileWorkspace.scanMutations.applyScanResult, {
			expectedStorageId: initialStorageId,
			result: {
				detectedContentType: "application/pdf",
				displayName: "Commitment Letter.pdf",
				sha256: "initial",
				sizeBytes: 9,
				state: "clean",
			},
			versionId: uploaded.versionId,
		});

		const replacementStorageId = await storeTestBlob(t);
		const replacement = await t
			.withIdentity(MANAGER)
			.mutation(versionsApi.replaceFile, {
				boxId: box.boxId,
				declaredFile: {
					contentType: "application/pdf",
					name: "Commitment Letter.pdf",
					sizeBytes: 9,
				},
				nodeId: uploaded.nodeId,
				storageId: replacementStorageId,
			});
		let node = await t.run((ctx) => ctx.db.get(uploaded.nodeId));
		expect(node?.currentVersionId).toBe(uploaded.versionId);

		await t.mutation(anyApi.fileWorkspace.scanMutations.applyScanResult, {
			expectedStorageId: replacementStorageId,
			result: {
				detectedContentType: "application/pdf",
				displayName: "Commitment Letter.pdf",
				sha256: "replacement",
				sizeBytes: 9,
				state: "clean",
			},
			versionId: replacement.versionId,
		});
		node = await t.run((ctx) => ctx.db.get(uploaded.nodeId));
		expect(node?.currentVersionId).toBe(replacement.versionId);

		const url = await t
			.withIdentity(MANAGER)
			.mutation(versionsApi.getPreviewUrl, {
				boxId: box.boxId,
				nodeId: uploaded.nodeId,
			});
		expect(url.versionId).toBe(replacement.versionId);
	});

	it("denies viewer mutations but allows comments and tags for managers", async () => {
		const t = createTestConvex();
		const box = await createWorkspace(t);
		const storageId = await storeTestBlob(t);
		const uploaded = await t
			.withIdentity(MANAGER)
			.mutation(uploadsApi.finalizeUpload, {
				boxId: box.boxId,
				declaredFile: {
					contentType: "application/pdf",
					name: "Servicing.pdf",
					sizeBytes: 9,
				},
				parentNodeId: box.rootNodeId,
				storageId,
			});

		await expect(
			t.withIdentity(VIEWER).mutation(nodesApi.createFolder, {
				boxId: box.boxId,
				name: "Denied",
				parentNodeId: box.rootNodeId,
			})
		).rejects.toThrow("access denied");

		const comment = await t
			.withIdentity(MANAGER)
			.mutation(commentsApi.createComment, {
				body: "Reviewed by closing.",
				boxId: box.boxId,
				nodeId: uploaded.nodeId,
			});
		const tag = await t.withIdentity(MANAGER).mutation(tagsApi.createTag, {
			boxId: box.boxId,
			name: "Closing",
		});
		const assignment = await t
			.withIdentity(MANAGER)
			.mutation(tagsApi.assignTag, {
				boxId: box.boxId,
				nodeId: uploaded.nodeId,
				tagId: tag.tagId,
			});

		expect(comment.commentId).toBeTruthy();
		expect(assignment.assignmentId).toBeTruthy();
	});

	it("lets editors restore deleted nodes when retention policy allows", async () => {
		const t = createTestConvex();
		const box = await createWorkspace(t);
		const folder = await t
			.withIdentity(MANAGER)
			.mutation(nodesApi.createFolder, {
				boxId: box.boxId,
				name: "Editor Restore",
				parentNodeId: box.rootNodeId,
			});
		await t.withIdentity(MANAGER).mutation(participantsApi.upsertParticipant, {
			boxId: box.boxId,
			grant: {
				authId: EDITOR.subject,
				email: EDITOR.user_email,
				role: "editor",
			},
		});
		await t.withIdentity(MANAGER).mutation(nodesApi.softDeleteNode, {
			boxId: box.boxId,
			nodeId: folder.nodeId,
		});

		const restored = await t
			.withIdentity(EDITOR)
			.mutation(nodesApi.restoreNode, {
				boxId: box.boxId,
				nodeId: folder.nodeId,
			});
		const node = await t.run((ctx) => ctx.db.get(folder.nodeId));

		expect(restored.nodeId).toBe(folder.nodeId);
		expect(node?.deletedAt).toBeUndefined();
	});

	it("schedules scan actions for upload finalize and replacement", async () => {
		const t = createTestConvex();
		const box = await createWorkspace(t);
		const uploaded = await uploadTestFile(t, {
			boxId: box.boxId,
			name: "Scheduled Scan.pdf",
			parentNodeId: box.rootNodeId,
		});
		const replacementStorageId = await storeTestBlob(t);
		await t.withIdentity(MANAGER).mutation(versionsApi.replaceFile, {
			boxId: box.boxId,
			declaredFile: {
				contentType: "application/pdf",
				name: "Scheduled Scan.pdf",
				sizeBytes: 9,
			},
			nodeId: uploaded.nodeId,
			storageId: replacementStorageId,
		});

		const scheduled = await t.run(async (ctx) => {
			const jobs = await ctx.db.system.query("_scheduled_functions").collect();
			return jobs.filter(
				(job) =>
					job.state.kind === "pending" &&
					job.name === "fileWorkspace/scanActions:scanVersion"
			);
		});

		expect(scheduled).toHaveLength(2);
	});

	it("finalizes same-name uploads as replacement versions", async () => {
		const t = createTestConvex();
		const box = await createWorkspace(t);
		const first = await uploadTestFile(t, {
			boxId: box.boxId,
			name: "Replace On Finalize.pdf",
			parentNodeId: box.rootNodeId,
		});
		const secondStorageId = await storeTestBlob(t);

		const uploadRequest = await t
			.withIdentity(MANAGER)
			.mutation(uploadsApi.requestUpload, {
				boxId: box.boxId,
				declaredFile: {
					contentType: "application/pdf",
					name: "replace on finalize.pdf",
					sizeBytes: 9,
				},
				parentNodeId: box.rootNodeId,
			});
		const second = await t
			.withIdentity(MANAGER)
			.mutation(uploadsApi.finalizeUpload, {
				boxId: box.boxId,
				declaredFile: {
					contentType: "application/pdf",
					name: "replace on finalize.pdf",
					sizeBytes: 9,
				},
				parentNodeId: box.rootNodeId,
				storageId: secondStorageId,
			});
		const versions = await t.run((ctx) =>
			ctx.db
				.query("fileVersions")
				.withIndex("by_node_version", (query) =>
					query.eq("nodeId", first.nodeId)
				)
				.collect()
		);

		expect(uploadRequest.uploadUrl).toBeTruthy();
		expect(second.nodeId).toBe(first.nodeId);
		expect(second.versionId).not.toBe(first.versionId);
		expect(versions.map((version) => version.versionNumber).sort()).toEqual([
			1, 2,
		]);
	});

	it("restores an older clean version as a new current version", async () => {
		const t = createTestConvex();
		const box = await createWorkspace(t);
		const uploaded = await uploadTestFile(t, {
			boxId: box.boxId,
			name: "Restore Version.pdf",
			parentNodeId: box.rootNodeId,
		});
		await applyCleanScan(t, {
			storageId: uploaded.storageId,
			versionId: uploaded.versionId,
		});
		const replacementStorageId = await storeTestBlob(t);
		const replacement = await t
			.withIdentity(MANAGER)
			.mutation(versionsApi.replaceFile, {
				boxId: box.boxId,
				declaredFile: {
					contentType: "application/pdf",
					name: "Restore Version.pdf",
					sizeBytes: 9,
				},
				nodeId: uploaded.nodeId,
				storageId: replacementStorageId,
			});
		await applyCleanScan(t, {
			storageId: replacementStorageId,
			versionId: replacement.versionId,
		});

		const restored = await t
			.withIdentity(MANAGER)
			.mutation(versionsApi.restoreVersionAsCurrent, {
				boxId: box.boxId,
				nodeId: uploaded.nodeId,
				versionId: uploaded.versionId,
			});
		const node = await t.run((ctx) => ctx.db.get(uploaded.nodeId));
		const restoredVersion = await t.run((ctx) =>
			ctx.db.get(restored.versionId)
		);

		expect(restored.versionId).not.toBe(uploaded.versionId);
		expect(restored.versionId).not.toBe(replacement.versionId);
		expect(node?.currentVersionId).toBe(restored.versionId);
		expect(restoredVersion?.storageId).toBe(uploaded.storageId);
		expect(restoredVersion?.versionNumber).toBe(3);
	});

	it("blocks retained deletes with evidence and recursively permanent-deletes eligible folders", async () => {
		const t = createTestConvex();
		const box = await createWorkspace(t);
		const folder = await t
			.withIdentity(MANAGER)
			.mutation(nodesApi.createFolder, {
				boxId: box.boxId,
				name: "Permanent Delete",
				parentNodeId: box.rootNodeId,
			});
		const uploaded = await uploadTestFile(t, {
			boxId: box.boxId,
			name: "Nested.pdf",
			parentNodeId: folder.nodeId,
		});
		await t.withIdentity(MANAGER).mutation(nodesApi.softDeleteNode, {
			boxId: box.boxId,
			nodeId: folder.nodeId,
		});

		const blockedDelete = await t
			.withIdentity(MANAGER)
			.mutation(nodesApi.permanentlyDeleteNode, {
				boxId: box.boxId,
				nodeId: folder.nodeId,
			});
		const blockedEvents = await t.run((ctx) =>
			ctx.db
				.query("fileSecurityEvents")
				.withIndex("by_box_event_type", (query) =>
					query
						.eq("boxId", box.boxId)
						.eq("eventType", "retention_delete_blocked")
				)
				.collect()
		);
		await t.run(async (ctx) => {
			await ctx.db.patch(folder.nodeId, {
				deletedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
			});
		});

		await t.withIdentity(MANAGER).mutation(nodesApi.permanentlyDeleteNode, {
			boxId: box.boxId,
			nodeId: folder.nodeId,
		});
		const remaining = await t.run(async (ctx) => ({
			childNode: await ctx.db.get(uploaded.nodeId),
			folderNode: await ctx.db.get(folder.nodeId),
			versions: await ctx.db
				.query("fileVersions")
				.withIndex("by_node_version", (query) =>
					query.eq("nodeId", uploaded.nodeId)
				)
				.collect(),
		}));

		expect(blockedDelete).toMatchObject({
			permanentlyDeleted: false,
			reasonCode: "retention_window_active",
		});
		expect(blockedEvents).toHaveLength(1);
		expect(remaining.folderNode).toBeNull();
		expect(remaining.childNode).toBeNull();
		expect(remaining.versions).toHaveLength(0);
	});

	it("journals URL denial events for blocked current versions and bearer access", async () => {
		const t = createTestConvex();
		const box = await createWorkspace(t);
		const uploaded = await uploadTestFile(t, {
			boxId: box.boxId,
			name: "Pending Public.pdf",
			parentNodeId: box.rootNodeId,
		});
		const link = await t
			.withIdentity(MANAGER)
			.mutation(shareLinksApi.createShareLink, {
				boxId: box.boxId,
				downloadEnabled: true,
				linkKind: "public_link",
			});

		const authenticatedDenied = await t
			.withIdentity(MANAGER)
			.mutation(versionsApi.getPreviewUrl, {
				boxId: box.boxId,
				nodeId: uploaded.nodeId,
			});
		const bearerDenied = await t.mutation(versionsApi.getBearerPreviewUrl, {
			nodeId: uploaded.nodeId,
			rawToken: link.rawToken,
		});
		const bearerDownloadDenied = await t.mutation(
			versionsApi.getBearerDownloadUrl,
			{
				nodeId: uploaded.nodeId,
				rawToken: link.rawToken,
			}
		);
		const events = await t.run(async (ctx) =>
			ctx.db
				.query("fileSecurityEvents")
				.withIndex("by_box_event_type", (query) =>
					query.eq("boxId", box.boxId).eq("eventType", "preview_requested")
				)
				.collect()
		);
		const downloadEvents = await t.run(async (ctx) =>
			ctx.db
				.query("fileSecurityEvents")
				.withIndex("by_box_event_type", (query) =>
					query.eq("boxId", box.boxId).eq("eventType", "download_requested")
				)
				.collect()
		);

		expect(authenticatedDenied).toMatchObject({
			denied: true,
			reasonCode: "file_version_blocked",
		});
		expect(bearerDenied).toMatchObject({
			denied: true,
			reasonCode: "file_version_blocked",
		});
		expect(bearerDownloadDenied).toMatchObject({
			denied: true,
			reasonCode: "downloads_disabled",
		});
		expect(events.filter((event) => event.outcome === "denied")).toHaveLength(
			2
		);
		expect(downloadEvents).toEqual([
			expect.objectContaining({
				outcome: "denied",
				reasonCode: "downloads_disabled",
			}),
		]);
	});
});
