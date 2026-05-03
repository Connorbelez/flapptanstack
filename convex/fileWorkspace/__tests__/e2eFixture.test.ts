import { anyApi } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createMockViewer,
	createTestConvex,
} from "../../../src/test/auth/helpers";
import type { Id } from "../../_generated/dataModel";

const fileWorkspaceE2eApi = anyApi.test.fileWorkspaceE2e;
const shareLinksApi = anyApi.fileWorkspace.shareLinks;

const E2E_MANAGER = createMockViewer({
	email: "fw-e2e-manager@test.fairlend.ca",
	orgId: "org_file_workspace",
	orgName: "Broker Org",
	permissions: ["broker:access", "admin:access"],
	roles: ["admin"],
	subject: "user_fw_e2e_manager",
});

afterEach(() => {
	vi.unstubAllEnvs();
});

async function storeTestBlob(t: ReturnType<typeof createTestConvex>) {
	return await t.run(async (ctx) => {
		return await (
			ctx.storage as unknown as {
				store: (blob: Blob) => Promise<Id<"_storage">>;
			}
		).store(new Blob(["fixture"], { type: "text/plain" }));
	});
}

describe("File Workspace E2E fixture API", () => {
	it("requires explicit E2E opt-in", async () => {
		vi.stubEnv("ALLOW_TEST_AUTH_ENDPOINTS", "false");
		vi.stubEnv("FILE_WORKSPACE_E2E_ENABLED", "false");
		const t = createTestConvex();

		await expect(
			t
				.withIdentity(E2E_MANAGER)
				.mutation(fileWorkspaceE2eApi.seedBaseFixture, {
					runId: "fw-disabled",
				})
		).rejects.toThrow("File Workspace E2E helpers are disabled");
	});

	it("seeds deterministic boxes, links, files, security events, and cleanup", async () => {
		vi.stubEnv("ALLOW_TEST_AUTH_ENDPOINTS", "true");
		const t = createTestConvex();
		const runId = "fw-fixture-test";

		const fixture = await t
			.withIdentity(E2E_MANAGER)
			.mutation(fileWorkspaceE2eApi.seedBaseFixture, { runId });
		const storageId = await storeTestBlob(t);
		const file = await t
			.withIdentity(E2E_MANAGER)
			.mutation(fileWorkspaceE2eApi.attachFixtureFile, {
				boxId: fixture.boxes.manager.boxId,
				contentType: "text/plain",
				displayName: "Fixture clean file.txt",
				parentNodeId: fixture.boxes.manager.rootNodeId,
				scanState: "clean",
				sizeBytes: 7,
				storageId,
			});
		await t
			.withIdentity(E2E_MANAGER)
			.mutation(fileWorkspaceE2eApi.recordDeniedAccess, {
				boxId: fixture.boxes.manager.boxId,
				nodeId: file.nodeId,
				reasonCode: "e2e_denied_probe",
			});

		const publicLink = await t.mutation(shareLinksApi.resolveBearerLink, {
			rawToken: fixture.links.public.rawToken,
		});
		const securityEvents = await t
			.withIdentity(E2E_MANAGER)
			.query(fileWorkspaceE2eApi.getSecurityEvents, {
				boxId: fixture.boxes.manager.boxId,
				eventType: "access_denied",
			});

		expect(fixture.boxes.manager.boxId).toBeTruthy();
		expect(fixture.users.stable.unrelated.authId).toContain(runId);
		expect(publicLink.linkKind).toBe("public_link");
		expect(publicLink.downloadEnabled).toBe(true);
		expect(securityEvents).toEqual([
			expect.objectContaining({
				eventType: "access_denied",
				outcome: "denied",
				reasonCode: "e2e_denied_probe",
			}),
		]);

		const cleanup = await t
			.withIdentity(E2E_MANAGER)
			.mutation(fileWorkspaceE2eApi.cleanupFixture, { runId });
		expect(cleanup.boxes).toBeGreaterThanOrEqual(5);
		expect(cleanup.users).toBe(5);
	});
});
