import { describe, expect, it } from "vitest";
import { createTestConvex } from "../../../src/test/auth/helpers";
import { FAIRLEND_ADMIN, MEMBER } from "../../../src/test/auth/identities";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { defaultFileWorkspaceScanPolicy } from "../policy";
import { seedFileWorkspaceFixture } from "../testUtils";

const NOW = 1_779_000_000_000;

async function seedPendingVersion(args: {
	contentType?: string;
	scanState?: "pending_scan" | "clean" | "rejected" | "scan_error";
	t: ReturnType<typeof createTestConvex>;
}) {
	return args.t.run(async (ctx) => {
		const fixture = await seedFileWorkspaceFixture(ctx);
		const fileNodeId = await ctx.db.insert("fileNodes", {
			boxId: fixture.boxes.activePrivate.boxId,
			parentId: fixture.boxes.activePrivate.rootNodeId,
			nodeType: "file",
			displayName: "Commitment Letter.pdf",
			normalizedSiblingKey: "commitment letter.pdf",
			isRoot: false,
			createdByAuthId: fixture.manager.authId,
			createdAt: NOW,
			updatedAt: NOW,
		});
		const storageId = await (
			ctx.storage as unknown as {
				store: (blob: Blob) => Promise<Id<"_storage">>;
			}
		).store(new Blob(["%PDF-1.7\n"], { type: "application/pdf" }));
		const versionId = await ctx.db.insert("fileVersions", {
			boxId: fixture.boxes.activePrivate.boxId,
			nodeId: fileNodeId,
			versionNumber: 1,
			storageId,
			sizeBytes: 0,
			contentType: args.contentType ?? "application/pdf",
			sha256: "pending",
			uploadedByAuthId: fixture.manager.authId,
			uploadedAt: NOW,
			scanState: args.scanState ?? "pending_scan",
		});
		await ctx.db.patch(fileNodeId, { currentVersionId: versionId });
		return {
			boxId: fixture.boxes.activePrivate.boxId,
			fileNodeId,
			storageId,
			versionId,
		};
	});
}

describe("File Workspace scan mutations", () => {
	it("applies clean scan results to matching pending versions", async () => {
		const t = createTestConvex();
		const seeded = await seedPendingVersion({ t });

		const result = await t.mutation(
			internal.fileWorkspace.scanMutations.applyScanResult,
			{
				expectedStorageId: seeded.storageId,
				result: {
					detectedContentType: "application/pdf",
					displayName: "Commitment Letter.pdf",
					normalizedExtension: ".pdf",
					sha256: "abc123",
					sizeBytes: 9,
					state: "clean",
				},
				versionId: seeded.versionId,
			}
		);

		const stored = await t.run((ctx) => ctx.db.get(seeded.versionId));
		const events = await t.run((ctx) =>
			ctx.db
				.query("fileSecurityEvents")
				.withIndex("by_box_event_type", (query) =>
					query.eq("boxId", seeded.boxId).eq("eventType", "scan_state_changed")
				)
				.collect()
		);

		expect(result).toEqual({ applied: true, scanState: "clean" });
		expect(stored).toMatchObject({
			contentType: "application/pdf",
			scanState: "clean",
			sha256: "abc123",
			sizeBytes: 9,
		});
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			outcome: "allowed",
		});
	});

	it("keeps stale or already-final scan results from mutating versions", async () => {
		const t = createTestConvex();
		const seeded = await seedPendingVersion({ scanState: "clean", t });

		const result = await t.mutation(
			internal.fileWorkspace.scanMutations.applyScanResult,
			{
				expectedStorageId: seeded.storageId,
				result: {
					message: "Rejected after stale retry.",
					reasonCode: "blocked_extension",
					sha256: "newhash",
					state: "rejected",
				},
				versionId: seeded.versionId,
			}
		);
		const stored = await t.run((ctx) => ctx.db.get(seeded.versionId));

		expect(result).toEqual({
			applied: false,
			reasonCode: "scan_already_final",
		});
		expect(stored?.scanState).toBe("clean");
		expect(stored?.sha256).toBe("pending");
	});

	it("runs the scanner action and persists rejected scan outcomes", async () => {
		const t = createTestConvex();
		const seeded = await seedPendingVersion({ t });

		const result = await t.action(
			internal.fileWorkspace.scanActions.scanVersion,
			{
				declaredContentType: "text/plain",
				declaredFilename: "script.sh",
				declaredSizeBytes: 9,
				policy: defaultFileWorkspaceScanPolicy,
				storageId: seeded.storageId,
				versionId: seeded.versionId,
			}
		);
		const stored = await t.run((ctx) => ctx.db.get(seeded.versionId));

		expect(result).toEqual({ applied: true, scanState: "rejected" });
		expect(stored).toMatchObject({
			scanReason: "content_type_mismatch",
			scanState: "rejected",
		});
		expect(stored?.sha256).not.toBe("pending");
	});

	it("allows platform admins to release scan_error versions with a reason", async () => {
		const t = createTestConvex();
		const seeded = await seedPendingVersion({ scanState: "scan_error", t });

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(api.fileWorkspace.scanMutations.releaseScanError, {
				reason: "Manual platform review passed.",
				versionId: seeded.versionId,
			});
		const stored = await t.run((ctx) => ctx.db.get(seeded.versionId));
		const events = await t.run((ctx) =>
			ctx.db
				.query("fileSecurityEvents")
				.withIndex("by_box_event_type", (query) =>
					query.eq("boxId", seeded.boxId).eq("eventType", "scan_error_released")
				)
				.collect()
		);

		expect(result.scanState).toBe("released_by_admin");
		expect(stored).toMatchObject({
			releasedByAuthId: FAIRLEND_ADMIN.subject,
			releaseReason: "Manual platform review passed.",
			scanState: "released_by_admin",
		});
		expect(events).toHaveLength(1);
		expect(events[0]?.metadata?.releaseReason).toBe(
			"Manual platform review passed."
		);
	});

	it("blocks non-admin release, blank release reasons, and rejected release", async () => {
		const t = createTestConvex();
		const scanError = await seedPendingVersion({ scanState: "scan_error", t });

		await expect(
			t
				.withIdentity(MEMBER)
				.mutation(api.fileWorkspace.scanMutations.releaseScanError, {
					reason: "manual review",
					versionId: scanError.versionId,
				})
		).rejects.toThrow("Forbidden");

		await expect(
			t
				.withIdentity(FAIRLEND_ADMIN)
				.mutation(api.fileWorkspace.scanMutations.releaseScanError, {
					reason: "   ",
					versionId: scanError.versionId,
				})
		).rejects.toThrow("reason is required");

		const rejected = await seedPendingVersion({ scanState: "rejected", t });
		await expect(
			t
				.withIdentity(FAIRLEND_ADMIN)
				.mutation(api.fileWorkspace.scanMutations.releaseScanError, {
					reason: "Manual review",
					versionId: rejected.versionId,
				})
		).rejects.toThrow("Rejected files cannot be released");
	});
});
