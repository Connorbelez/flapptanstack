import { anyApi } from "convex/server";
import { describe, expect, it } from "vitest";
import {
	createMockViewer,
	createTestConvex,
} from "../../../src/test/auth/helpers";
import type { Id } from "../../_generated/dataModel";
import { FAIRLEND_STAFF_ORG_ID } from "../../constants";
import { resolveFileWorkspacePrincipal } from "../access";

const boxesApi = anyApi.fileWorkspace.boxes;
const participantsApi = anyApi.fileWorkspace.participants;
const readModelsApi = anyApi.fileWorkspace.readModels;
const shareLinksApi = anyApi.fileWorkspace.shareLinks;

async function storeTextBlob(t: ReturnType<typeof createTestConvex>) {
	return await t.run(async (ctx) => {
		return await (
			ctx.storage as unknown as {
				store: (blob: Blob) => Promise<Id<"_storage">>;
			}
		).store(new Blob(["file workspace fixture"], { type: "text/plain" }));
	});
}

async function insertFileVersion(args: {
	boxId: Id<"fileBoxes">;
	displayName: string;
	parentNodeId: Id<"fileNodes">;
	scanState: "clean" | "pending_scan" | "rejected" | "scan_error";
	t: ReturnType<typeof createTestConvex>;
}) {
	const storageId = await storeTextBlob(args.t);
	return await args.t.run(async (ctx) => {
		const nodeId = await ctx.db.insert("fileNodes", {
			boxId: args.boxId,
			parentId: args.parentNodeId,
			nodeType: "file",
			displayName: args.displayName,
			normalizedSiblingKey: args.displayName.toLowerCase(),
			isRoot: false,
			createdByAuthId: MANAGER_IDENTITY.subject,
			createdAt: 1,
			updatedAt: 1,
		});
		const versionId = await ctx.db.insert("fileVersions", {
			boxId: args.boxId,
			nodeId,
			versionNumber: 1,
			storageId,
			sizeBytes: 22,
			contentType: "text/plain",
			sha256: args.scanState,
			uploadedByAuthId: MANAGER_IDENTITY.subject,
			uploadedAt: 1,
			scanState: args.scanState,
		});
		await ctx.db.patch(nodeId, { currentVersionId: versionId });
		return { nodeId, versionId };
	});
}

const MANAGER_IDENTITY = createMockViewer({
	email: "read-manager@test.fairlend.ca",
	orgId: "org_file_workspace_broker",
	orgName: "Broker Org",
	permissions: ["broker:access"],
	roles: ["broker"],
	subject: "user_read_manager",
});

const VIEWER_IDENTITY = createMockViewer({
	email: "read-viewer@test.fairlend.ca",
	orgId: "org_file_workspace_broker",
	orgName: "Broker Org",
	permissions: ["broker:access"],
	roles: ["broker"],
	subject: "user_read_viewer",
});

const ADMIN_IDENTITY = createMockViewer({
	email: "read-admin@test.fairlend.ca",
	orgId: FAIRLEND_STAFF_ORG_ID,
	orgName: "FairLendStaff",
	permissions: ["admin:access"],
	roles: ["admin"],
	subject: "user_read_admin",
});

describe("File Workspace read models", () => {
	it("returns box indexes for participants and platform admins without creating admin participants", async () => {
		const t = createTestConvex();
		const created = await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(boxesApi.createBox, {
				name: "Read Model Box",
			});
		await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(participantsApi.upsertParticipant, {
				boxId: created.boxId,
				grant: {
					authId: "user_read_viewer",
					email: "read-viewer@test.fairlend.ca",
					role: "viewer",
				},
			});

		const viewerIndex = await t
			.withIdentity(VIEWER_IDENTITY)
			.query(readModelsApi.listBoxIndex, {});
		const adminIndex = await t
			.withIdentity(ADMIN_IDENTITY)
			.query(readModelsApi.listBoxIndex, {});
		const adminParticipants = await t.run(async (ctx) =>
			ctx.db
				.query("fileBoxParticipants")
				.withIndex("by_box_participant_status", (query) =>
					query
						.eq("boxId", created.boxId)
						.eq("participantKey", "auth:user_read_admin")
						.eq("status", "active")
				)
				.collect()
		);

		expect(viewerIndex).toEqual([
			expect.objectContaining({
				boxId: created.boxId,
				principalKind: "authenticated",
				role: "viewer",
			}),
		]);
		expect(adminIndex.map((box) => box.boxId)).toContain(created.boxId);
		expect(adminParticipants).toHaveLength(0);
	});

	it("returns manager settings with redacted links and denies viewers", async () => {
		const t = createTestConvex();
		const created = await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(boxesApi.createBox, {
				name: "Settings Box",
			});
		await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(participantsApi.upsertParticipant, {
				boxId: created.boxId,
				grant: {
					authId: "user_read_viewer",
					email: "read-viewer@test.fairlend.ca",
					role: "viewer",
				},
			});
		await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(shareLinksApi.createShareLink, {
				boxId: created.boxId,
				linkKind: "public_link",
			});

		const settings = await t
			.withIdentity(MANAGER_IDENTITY)
			.query(readModelsApi.getManagerSettings, { boxId: created.boxId });
		await expect(
			t
				.withIdentity(VIEWER_IDENTITY)
				.query(readModelsApi.getManagerSettings, { boxId: created.boxId })
		).rejects.toThrow("Box not found or access denied.");

		expect(settings.box.boxId).toBe(created.boxId);
		expect(settings.participants).toHaveLength(2);
		expect(settings.links).toHaveLength(1);
		expect("rawToken" in settings.links[0]).toBe(false);
		expect("tokenHash" in settings.links[0]).toBe(false);
	});

	it("resolves authenticated and bearer principals for downstream consumers", async () => {
		const t = createTestConvex();
		const created = await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(boxesApi.createBox, {
				name: "Resolver Box",
			});
		const link = await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(shareLinksApi.createShareLink, {
				boxId: created.boxId,
				linkKind: "public_link",
			});
		const managerCapabilities = await t
			.withIdentity(MANAGER_IDENTITY)
			.query(readModelsApi.getCapabilityPreview, { boxId: created.boxId });
		const bearer = await t.run(async (ctx) => {
			const resolved = await resolveFileWorkspacePrincipal(ctx, {
				rawToken: link.rawToken,
			});
			return resolved
				? {
						capabilities: [...resolved.capabilities],
						principalKind: resolved.principal.kind,
					}
				: null;
		});

		expect(managerCapabilities.capabilities).toContain("manage_links");
		expect(bearer?.principalKind).toBe("public_link");
		const bearerCapabilities = bearer?.capabilities ?? [];
		expect(bearerCapabilities).toContain("preview_clean_file");
		expect(bearerCapabilities).not.toContain("comment_on_file");
	});

	it("shows quarantine scan states to authenticated users while hiding them from bearer links", async () => {
		const t = createTestConvex();
		const created = await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(boxesApi.createBox, {
				name: "Quarantine Box",
			});
		const link = await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(shareLinksApi.createShareLink, {
				boxId: created.boxId,
				linkKind: "public_link",
			});
		await Promise.all([
			insertFileVersion({
				boxId: created.boxId,
				displayName: "Clean listing.txt",
				parentNodeId: created.rootNodeId,
				scanState: "clean",
				t,
			}),
			insertFileVersion({
				boxId: created.boxId,
				displayName: "Pending quarantine.txt",
				parentNodeId: created.rootNodeId,
				scanState: "pending_scan",
				t,
			}),
			insertFileVersion({
				boxId: created.boxId,
				displayName: "Rejected quarantine.txt",
				parentNodeId: created.rootNodeId,
				scanState: "rejected",
				t,
			}),
		]);

		const authenticatedList = await t
			.withIdentity(MANAGER_IDENTITY)
			.query(readModelsApi.listNodes, {
				boxId: created.boxId,
				parentNodeId: created.rootNodeId,
			});
		const bearerLink = await t.mutation(shareLinksApi.resolveBearerLink, {
			rawToken: link.rawToken,
		});
		const bearerList = await t.mutation(readModelsApi.listBearerNodes, {
			parentNodeId: bearerLink.rootNodeId,
			rawToken: link.rawToken,
		});

		expect(
			authenticatedList.nodes.map(
				(node: { currentVersion?: { scanState: string } | null }) =>
					node.currentVersion?.scanState
			)
		).toEqual(expect.arrayContaining(["clean", "pending_scan", "rejected"]));
		expect(
			bearerList.nodes.map((node: { displayName: string }) => node.displayName)
		).toEqual(["Clean listing.txt"]);
	});
});
