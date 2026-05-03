import { expect, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import type { Browser } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { TEST_ADMIN_ORG_ID, createAuthStorageState } from "./auth-storage";

export const FILE_WORKSPACE_E2E_STORAGE_STATE = ".auth/file-workspace-user.json";

type SeedBaseFixtureResult = FunctionReturnType<
	typeof api.test.fileWorkspaceE2e.seedBaseFixture
>;
type AttachFixtureFileResult = FunctionReturnType<
	typeof api.test.fileWorkspaceE2e.attachFixtureFile
>;

export interface SeededFileWorkspaceFixture extends SeedBaseFixtureResult {
	files: {
		clean: AttachFixtureFileResult;
		deleted: AttachFixtureFileResult;
		magicClean: AttachFixtureFileResult;
		pending: AttachFixtureFileResult;
		publicClean: AttachFixtureFileResult;
		rejected: AttachFixtureFileResult;
		released: AttachFixtureFileResult;
		scanError: AttachFixtureFileResult;
	};
}

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

function fileBytes(contents: string): Uint8Array {
	return new TextEncoder().encode(contents);
}

export function uniqueFileWorkspaceRunId(prefix = "fw") {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toLowerCase();
}

export async function ensureFileWorkspaceAdminStorageState(
	browser: Browser,
	baseURL?: string
) {
	if (existsSync(FILE_WORKSPACE_E2E_STORAGE_STATE)) {
		return;
	}
	const context = await browser.newContext({
		baseURL: baseURL ?? `http://localhost:${process.env.E2E_PORT ?? 3000}`,
		storageState: { cookies: [], origins: [] },
	});
	const page = await context.newPage();
	try {
		await createAuthStorageState({
			orgId: TEST_ADMIN_ORG_ID,
			page,
			path: FILE_WORKSPACE_E2E_STORAGE_STATE,
		});
	} finally {
		await context.close();
	}
}

export async function readFileWorkspaceAccessToken(page: Page) {
	await page.goto("/e2e/session");
	await expect(page.locator('[data-testid="session-json"]')).toBeVisible({
		timeout: 30_000,
	});
	const sessionJson = await page
		.locator('[data-testid="session-json"]')
		.textContent();
	if (!sessionJson) {
		throw new Error("E2E session route did not render session JSON");
	}
	const session = JSON.parse(sessionJson) as {
		accessToken?: string | null;
		error?: string;
		permissions?: string[];
		role?: string | null;
	};
	if (session.error) {
		throw new Error(`E2E session bootstrap failed: ${session.error}`);
	}
	if (!session.accessToken) {
		throw new Error("E2E session route did not expose an access token");
	}
	return {
		accessToken: session.accessToken,
		permissions: session.permissions ?? [],
		role: session.role,
	};
}

export function createFileWorkspaceE2eClient(accessToken: string) {
	const convex = new ConvexHttpClient(requireEnv("VITE_CONVEX_URL"));
	convex.setAuth(accessToken);

	async function uploadFixtureBytes(args: {
		bytes: Uint8Array;
		contentType: string;
	}) {
		const { uploadUrl } = await convex.mutation(
			api.test.fileWorkspaceE2e.createUploadUrl,
			{}
		);
		const response = await fetch(uploadUrl, {
			body: new Blob([Buffer.from(args.bytes)], { type: args.contentType }),
			headers: { "Content-Type": args.contentType },
			method: "POST",
		});
		if (!response.ok) {
			throw new Error(
				`File Workspace fixture upload failed with status ${response.status}`
			);
		}
		const result = (await response.json()) as { storageId: Id<"_storage"> };
		return result.storageId;
	}

	async function attachTextFile(args: {
		body?: string;
		boxId: string;
		contentType?: string;
		deleted?: boolean;
		displayName: string;
		parentNodeId: string;
		releaseReason?: string;
		scanReason?: string;
		scanState:
			| "pending_scan"
			| "clean"
			| "rejected"
			| "scan_error"
			| "released_by_admin";
	}) {
		const contentType = args.contentType ?? "text/plain";
		const bytes = fileBytes(
			args.body ??
				`${args.displayName}\nscan=${args.scanState}\ncreated for File Workspace E2E\n`
		);
		const storageId = await uploadFixtureBytes({ bytes, contentType });
		return convex.mutation(api.test.fileWorkspaceE2e.attachFixtureFile, {
			boxId: args.boxId as Id<"fileBoxes">,
			contentType,
			deleted: args.deleted,
			displayName: args.displayName,
			parentNodeId: args.parentNodeId as Id<"fileNodes">,
			releaseReason: args.releaseReason,
			scanReason: args.scanReason,
			scanState: args.scanState,
			sha256: `${args.scanState}-${args.displayName}`,
			sizeBytes: bytes.byteLength,
			storageId,
		});
	}

	return {
		attachTextFile,
		cleanupFixture(runId: string) {
			return convex.mutation(api.test.fileWorkspaceE2e.cleanupFixture, {
				runId,
			});
		},
		getSecurityEvents(args: {
			boxId: string;
			eventType?: string;
		}) {
			return convex.query(api.test.fileWorkspaceE2e.getSecurityEvents, {
				boxId: args.boxId as Id<"fileBoxes">,
				eventType: args.eventType,
			});
		},
		recordDeniedAccess(args: {
			boxId: string;
			nodeId?: string;
			reasonCode: string;
		}) {
			return convex.mutation(api.test.fileWorkspaceE2e.recordDeniedAccess, {
				boxId: args.boxId as Id<"fileBoxes">,
				nodeId: args.nodeId as Id<"fileNodes"> | undefined,
				reasonCode: args.reasonCode,
			});
		},
		seedBaseFixture(runId: string) {
			return convex.mutation(api.test.fileWorkspaceE2e.seedBaseFixture, {
				runId,
			});
		},
		upsertParticipant(args: {
			authId?: string;
			boxId: string;
			email?: string;
			role: "editor" | "manager" | "viewer";
		}) {
			return convex.mutation(api.fileWorkspace.participants.upsertParticipant, {
				boxId: args.boxId as Id<"fileBoxes">,
				grant: {
					authId: args.authId,
					email: args.email,
					role: args.role,
				},
			});
		},
		removeParticipant(args: {
			boxId: string;
			participantId: string;
		}) {
			return convex.mutation(api.fileWorkspace.participants.removeParticipant, {
				boxId: args.boxId as Id<"fileBoxes">,
				participantId: args.participantId as Id<"fileBoxParticipants">,
			});
		},
		replaceFile(args: {
			body: string;
			boxId: string;
			contentType?: string;
			displayName: string;
			nodeId: string;
		}) {
			const contentType = args.contentType ?? "text/plain";
			const bytes = fileBytes(args.body);
			return uploadFixtureBytes({ bytes, contentType }).then((storageId) =>
				convex.mutation(api.fileWorkspace.versions.replaceFile, {
					boxId: args.boxId as Id<"fileBoxes">,
					declaredFile: {
						contentType,
						name: args.displayName,
						sha256: `replacement-${args.displayName}`,
						sizeBytes: bytes.byteLength,
					},
					nodeId: args.nodeId as Id<"fileNodes">,
					storageId,
				})
			);
		},
		permanentlyDeleteNode(args: {
			boxId: string;
			nodeId: string;
		}) {
			return convex.mutation(api.fileWorkspace.nodes.permanentlyDeleteNode, {
				boxId: args.boxId as Id<"fileBoxes">,
				nodeId: args.nodeId as Id<"fileNodes">,
			});
		},
		softDeleteNode(args: {
			boxId: string;
			nodeId: string;
		}) {
			return convex.mutation(api.fileWorkspace.nodes.softDeleteNode, {
				boxId: args.boxId as Id<"fileBoxes">,
				nodeId: args.nodeId as Id<"fileNodes">,
			});
		},
	};
}

export async function seedDefaultFileWorkspaceFixture(
	page: Page,
	runId = uniqueFileWorkspaceRunId()
): Promise<SeededFileWorkspaceFixture> {
	const session = await readFileWorkspaceAccessToken(page);
	const client = createFileWorkspaceE2eClient(session.accessToken);
	const fixture = await client.seedBaseFixture(runId);
	const [
		clean,
		pending,
		rejected,
		scanError,
		released,
		deleted,
		publicClean,
		magicClean,
	] = await Promise.all([
		client.attachTextFile({
			boxId: fixture.boxes.manager.boxId,
			displayName: "Commitment letter clean.txt",
			parentNodeId: fixture.boxes.manager.rootNodeId,
			scanState: "clean",
		}),
		client.attachTextFile({
			boxId: fixture.boxes.manager.boxId,
			displayName: "Pending scan package.txt",
			parentNodeId: fixture.boxes.manager.rootNodeId,
			scanState: "pending_scan",
		}),
		client.attachTextFile({
			boxId: fixture.boxes.manager.boxId,
			displayName: "Rejected executable.txt",
			parentNodeId: fixture.boxes.manager.rootNodeId,
			scanReason: "blocked_extension",
			scanState: "rejected",
		}),
		client.attachTextFile({
			boxId: fixture.boxes.manager.boxId,
			displayName: "Scanner unavailable.txt",
			parentNodeId: fixture.boxes.manager.rootNodeId,
			scanReason: "scanner_unavailable",
			scanState: "scan_error",
		}),
		client.attachTextFile({
			boxId: fixture.boxes.manager.boxId,
			displayName: "Released by admin.txt",
			parentNodeId: fixture.boxes.manager.rootNodeId,
			releaseReason: "Manual E2E review",
			scanState: "released_by_admin",
		}),
		client.attachTextFile({
			boxId: fixture.boxes.manager.boxId,
			deleted: true,
			displayName: "Retention blocked deleted.txt",
			parentNodeId: fixture.boxes.manager.rootNodeId,
			scanState: "clean",
		}),
		client.attachTextFile({
			boxId: fixture.boxes.public.boxId,
			displayName: "Public clean package.txt",
			parentNodeId: fixture.boxes.public.rootNodeId,
			scanState: "clean",
		}),
		client.attachTextFile({
			boxId: fixture.boxes.magic.boxId,
			displayName: "Magic clean package.txt",
			parentNodeId: fixture.boxes.magic.rootNodeId,
			scanState: "clean",
		}),
	]);

	return {
		...fixture,
		files: {
			clean,
			deleted,
			magicClean,
			pending,
			publicClean,
			rejected,
			released,
			scanError,
		},
	};
}

export async function expectNoTextOverlap(page: Page) {
	const badElements = await page.locator("body *").evaluateAll((elements) =>
		elements
			.filter((element) => {
				const rect = element.getBoundingClientRect();
				const style = window.getComputedStyle(element);
				return (
					rect.width > 0 &&
					rect.height > 0 &&
					style.overflow === "visible" &&
					element.scrollWidth > Math.ceil(rect.width + 1)
				);
			})
			.slice(0, 5)
			.map((element) => ({
				tag: element.tagName.toLowerCase(),
				text: element.textContent?.trim().slice(0, 80) ?? "",
			}))
	);
	expect(badElements).toEqual([]);
}

export async function openManagerWorkspace(
	page: Page,
	fixture: SeededFileWorkspaceFixture
) {
	await page.goto(`/files/${fixture.boxes.manager.boxId}`);
	await expect(page.getByText(fixture.boxes.manager.name)).toBeVisible({
		timeout: 20_000,
	});
	await expect(
		page
			.getByLabel("Files", { exact: true })
			.getByRole("button", { name: "Commitment letter clean.txt" })
	).toBeVisible({ timeout: 20_000 });
}
