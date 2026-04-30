import { anyApi } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import {
	createMockViewer,
	createTestConvex,
} from "../../../src/test/auth/helpers";
import { generateShareLinkToken, hashShareLinkToken } from "../tokens";

const boxesApi = anyApi.fileWorkspace.boxes;
const shareLinksApi = anyApi.fileWorkspace.shareLinks;
const RAW_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const TOKEN_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

const MANAGER_IDENTITY = createMockViewer({
	email: "link-manager@test.fairlend.ca",
	orgId: "org_file_workspace_broker",
	orgName: "Broker Org",
	permissions: ["broker:access"],
	roles: ["broker"],
	subject: "user_link_manager",
});

async function createManagedBox(t: ReturnType<typeof createTestConvex>) {
	return await t.withIdentity(MANAGER_IDENTITY).mutation(boxesApi.createBox, {
		name: "Share Link Box",
	});
}

describe("File Workspace share links", () => {
	it("generates high-entropy tokens and hashes raw bearer tokens", async () => {
		const token = generateShareLinkToken((bytes) => {
			bytes.fill(171);
			return bytes;
		});
		const hash = await hashShareLinkToken(token);

		expect(token).toMatch(RAW_TOKEN_PATTERN);
		expect(hash).toMatch(TOKEN_HASH_PATTERN);
		expect(hash).not.toContain(token);
		await expect(hashShareLinkToken("")).rejects.toBeInstanceOf(ConvexError);
	});

	it("returns raw tokens only on creation and stores only token hashes", async () => {
		const t = createTestConvex();
		const createdBox = await createManagedBox(t);

		const createdLink = await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(shareLinksApi.createShareLink, {
				boxId: createdBox.boxId,
				linkKind: "public_link",
			});
		const listed = await t
			.withIdentity(MANAGER_IDENTITY)
			.query(shareLinksApi.listShareLinks, { boxId: createdBox.boxId });
		const stored = await t.run(async (ctx) => ctx.db.get(createdLink.linkId));

		expect(createdLink.rawToken).toMatch(RAW_TOKEN_PATTERN);
		expect(stored?.tokenHash).toMatch(TOKEN_HASH_PATTERN);
		expect(stored?.tokenHash).not.toBe(createdLink.rawToken);
		expect(listed).toHaveLength(1);
		expect("rawToken" in listed[0]).toBe(false);
		expect("tokenHash" in listed[0]).toBe(false);
		expect(listed[0]?.downloadEnabled).toBe(false);
	});

	it("resolves active public links and respects box plus link download policy", async () => {
		const t = createTestConvex();
		const createdBox = await createManagedBox(t);

		const createdLink = await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(shareLinksApi.createShareLink, {
				boxId: createdBox.boxId,
				downloadEnabled: true,
				linkKind: "public_link",
			});
		const initial = await t.mutation(shareLinksApi.resolveBearerLink, {
			rawToken: createdLink.rawToken,
		});
		await t.withIdentity(MANAGER_IDENTITY).mutation(boxesApi.updateBox, {
			boxId: createdBox.boxId,
			patch: {
				downloadPolicy: {
					authenticated: true,
					magicLink: false,
					publicLink: true,
				},
			},
		});
		const afterPolicy = await t.mutation(shareLinksApi.resolveBearerLink, {
			rawToken: createdLink.rawToken,
		});
		const security = await t.run(async (ctx) =>
			ctx.db
				.query("fileSecurityEvents")
				.withIndex("by_box_event_type", (query) =>
					query.eq("boxId", createdBox.boxId).eq("eventType", "link_opened")
				)
				.collect()
		);

		expect(initial.downloadEnabled).toBe(false);
		expect(afterPolicy.downloadEnabled).toBe(true);
		expect(afterPolicy.principalKind).toBe("public_link");
		expect(security.length).toBeGreaterThanOrEqual(2);
	});

	it("fails closed for revoked, expired, tampered, and disabled links", async () => {
		const t = createTestConvex();
		const revokedBox = await createManagedBox(t);
		const revokedLink = await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(shareLinksApi.createShareLink, {
				boxId: revokedBox.boxId,
				linkKind: "public_link",
			});
		await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(shareLinksApi.revokeShareLink, {
				boxId: revokedBox.boxId,
				linkId: revokedLink.linkId,
			});

		const expiredBox = await createManagedBox(t);
		const expiredLink = await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(shareLinksApi.createShareLink, {
				boxId: expiredBox.boxId,
				expiresAt: Date.now() - 1,
				linkKind: "magic_link",
			});

		const disabledBox = await createManagedBox(t);
		const disabledLink = await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(shareLinksApi.createShareLink, {
				boxId: disabledBox.boxId,
				linkKind: "public_link",
			});
		await t.run(async (ctx) => {
			await ctx.db.patch(disabledBox.boxId, { status: "disabled" });
		});

		await expect(
			t.mutation(shareLinksApi.resolveBearerLink, {
				rawToken: `${revokedLink.rawToken}tampered`,
			})
		).rejects.toThrow("Box not found or access denied.");
		await expect(
			t.mutation(shareLinksApi.resolveBearerLink, {
				rawToken: revokedLink.rawToken,
			})
		).rejects.toThrow("Box not found or access denied.");
		await expect(
			t.mutation(shareLinksApi.resolveBearerLink, {
				rawToken: expiredLink.rawToken,
			})
		).rejects.toThrow("This link has expired.");
		await expect(
			t.mutation(shareLinksApi.resolveBearerLink, {
				rawToken: disabledLink.rawToken,
			})
		).rejects.toThrow("Box not found or access denied.");
	});
});
