import { existsSync } from "node:fs";
import {
	expect,
	type Browser,
	type BrowserContext,
	test,
	type Page,
} from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { PDFDocument } from "pdf-lib";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { readE2eAccessToken } from "./origination";
import {
	TEST_ADMIN_ORG_ID,
	createAuthStorageState,
} from "./auth-storage";

export const BASE_URL = "/demo/document-engine";
// Playwright reads `storageState` before `beforeAll`, so this path stays stable.
// The helper in `auth-storage.ts` writes it atomically to avoid worker races.
export const ADMIN_STORAGE_STATE = ".auth/admin.json";

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

function getBaseURL(): string {
	const baseURL = test.info().project.use.baseURL;
	if (!baseURL) {
		throw new Error(
			"Playwright baseURL is required for document engine auth setup"
		);
	}

	return baseURL;
}

async function ensureAdminStorageState(browser: Browser): Promise<void> {
	if (existsSync(ADMIN_STORAGE_STATE)) {
		return;
	}

	const bootstrapContext = await browser.newContext({ baseURL: getBaseURL() });
	const bootstrapPage = await bootstrapContext.newPage();

	try {
		await createAuthStorageState({
			orgId: TEST_ADMIN_ORG_ID,
			page: bootstrapPage,
			path: ADMIN_STORAGE_STATE,
		});
	} finally {
		await bootstrapContext.close();
	}
}

/**
 * Generate a unique name for test resources to avoid collisions
 * between parallel test runs.
 */
export function uniqueName(prefix: string): string {
	return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Generate a unique snake_case key for system variables.
 */
export function uniqueKey(prefix: string): string {
	return `${prefix}_${Date.now().toString(36).slice(-4)}_${Math.random().toString(36).slice(2, 5)}`;
}

/**
 * Open a browser context/page pair authenticated as the admin test user.
 * Use this for setup and teardown flows that create their own browser context.
 */
export async function openAdminPage(browser: Browser): Promise<{
	context: BrowserContext;
	page: Page;
}> {
	await ensureAdminStorageState(browser);

	const context = await browser.newContext({
		baseURL: getBaseURL(),
		storageState: ADMIN_STORAGE_STATE,
	});
	const page = await context.newPage();
	return { context, page };
}

/**
 * Create a minimal valid PDF buffer for upload testing.
 * Uses pdf-lib (already a project dependency) to produce a single-page US Letter PDF.
 */
export async function createTestPdfBuffer(
	label = "E2E Test Document"
): Promise<Buffer> {
	const doc = await PDFDocument.create();
	const page = doc.addPage([612, 792]); // US Letter dimensions
	page.drawText(label, { x: 50, y: 700, size: 20 });
	const bytes = await doc.save();
	return Buffer.from(bytes);
}

/**
 * Upload a test PDF via the Library page and return its name.
 * Assumes the page is already at the library route or will navigate there.
 */
export async function uploadTestPdf(
	page: Page,
	pdfName: string
): Promise<void> {
	await page.goto(`${BASE_URL}/library`);

	// Open upload dialog
	await page.getByRole("button", { name: "Upload PDF" }).click();
	await page.getByRole("heading", { name: "Upload Base PDF" }).waitFor();

	// Fill name
	await page.getByLabel("Name").fill(pdfName);

	// Set file via input
	const pdfBuffer = await createTestPdfBuffer();
	const fileInput = page.locator('input[type="file"]');
	await fileInput.setInputFiles({
		name: "test.pdf",
		mimeType: "application/pdf",
		buffer: pdfBuffer,
	});

	// Submit upload
	await page.getByRole("button", { name: "Upload", exact: true }).click();

	// Wait for dialog to close and PDF to appear (metadata extraction can be slow)
	await page.getByText(pdfName).waitFor({ timeout: 30_000 });
}

/**
 * Create a system variable via the Variables page.
 */
export async function createVariable(
	page: Page,
	key: string,
	label: string,
	type = "string"
): Promise<void> {
	await page.goto(`${BASE_URL}/variables`);

	await page.getByRole("button", { name: "Add Variable" }).click();
	await page.getByRole("heading", { name: "Create System Variable" }).waitFor();

	await page.getByLabel("Key (snake_case)").fill(key);
	await page.getByLabel("Label").fill(label);

	if (type !== "string") {
		await page.locator("#var-type").click();
		await page.getByRole("option", { name: type }).click();
	}

	await page.getByRole("button", { name: "Create Variable" }).click();

	// Wait for variable to appear in the list
	await page.getByText(key).waitFor({ timeout: 10_000 });
}

/**
 * Create a template via the Templates page.
 */
export async function createTemplate(
	page: Page,
	templateName: string,
	basePdfName: string
): Promise<void> {
	await page.goto(`${BASE_URL}/templates`);

	await page.getByRole("button", { name: "New Template" }).click();
	await page.getByRole("heading", { name: "Create Template" }).waitFor();

	await page.getByLabel("Name").fill(templateName);

	// Select base PDF
	await page.locator("#tpl-pdf").click();
	await page.getByRole("option", { name: new RegExp(basePdfName) }).click();

	await page.getByRole("button", { name: "Create Template" }).click();

	// Wait for template to appear
	await page.getByText(templateName).waitFor({ timeout: 10_000 });
}

/**
 * Create a template group via the Groups page.
 */
export async function createGroup(
	page: Page,
	groupName: string
): Promise<void> {
	await page.goto(`${BASE_URL}/groups`);

	await page.getByRole("button", { name: "New Group" }).click();
	await page.getByRole("heading", { name: "Create Template Group" }).waitFor();

	await page.getByLabel("Name").fill(groupName);
	await page.getByRole("button", { name: "Create Group" }).click();

	await page.getByText(groupName).waitFor({ timeout: 10_000 });
}

// ── pdfme Designer helpers ──────────────────────────────────────

/**
 * Navigate to the designer for a template and wait for pdfme to initialize.
 */
export async function navigateToDesigner(
	page: Page,
	templateName: string
): Promise<void> {
	await page.goto(`${BASE_URL}/templates`);
	await page.getByText(templateName).waitFor({ timeout: 10_000 });

	await page
		.locator("[data-slot='card']")
		.filter({ hasText: templateName })
		.first()
		.getByRole("button", { name: "Design" })
		.click();

	await waitForDesignerReady(page);
}

/**
 * Wait for the pdfme Designer to fully initialize inside its container.
 * Checks that the container has rendered content (pdfme injects its DOM).
 */
export async function waitForDesignerReady(page: Page): Promise<void> {
	// Wait for our toolbar to render (proves the page loaded)
	await page.getByRole("button", { name: "Save" }).waitFor({ timeout: 15_000 });

	// Wait for pdfme to inject its DOM into the container
	const container = page.getByTestId("pdfme-designer");
	await container.waitFor({ timeout: 10_000 });
	await expect(container.locator(":scope > *").first()).toBeAttached({
		timeout: 10_000,
	});
}

/**
 * Add a field to the pdfme Designer canvas by dragging from the sidebar.
 *
 * pdfme's left sidebar shows registered schema types (plugin keys) as
 * draggable items. We find them by text and drag to the canvas area.
 */
export async function addFieldInDesigner(
	page: Page,
	fieldType: "interpolableField" | "signableField"
): Promise<void> {
	const container = page.getByTestId("pdfme-designer");

	// pdfme sidebar renders plugin keys as text labels
	const sidebarItem = container.locator(`text=${fieldType}`).first();
	await sidebarItem.waitFor({ timeout: 5000 });

	// Get the container bounds for targeting the canvas area
	const box = await container.boundingBox();
	if (!box) {
		throw new Error("pdfme designer container is not visible");
	}

	// Drag from sidebar to the center-right of the canvas
	// (pdfme sidebar is on the left, canvas occupies the rest)
	await sidebarItem.dragTo(container, {
		targetPosition: {
			x: Math.round(box.width * 0.5),
			y: Math.round(box.height * 0.4),
		},
	});

	// Wait for pdfme to process the drop and fire onChangeTemplate
	await page.waitForTimeout(500);
}

/**
 * Check that the pdfme Designer container has rendered content,
 * proving that the pdfme library initialized successfully.
 */
export async function expectDesignerRendered(page: Page): Promise<void> {
	const container = page.getByTestId("pdfme-designer");
	// pdfme renders multiple child divs for sidebar, canvas, etc.
	const childCount = await container.locator(":scope > *").count();
	expect(childCount).toBeGreaterThan(0);
}

export interface E2ePublishedTemplate {
	basePdfId: string;
	name: string;
	templateId: string;
}

type E2eTemplateField =
	| {
			readonly type: "interpolable";
			readonly variableKey: string;
	  }
	| {
			readonly signatoryPlatformRole: string;
			readonly type: "signable";
	  };

interface E2eTemplateSignatory {
	readonly platformRole: string;
	readonly role: "approver" | "signatory" | "viewer";
}

export async function createPublishedTemplate(
	page: Page,
	args: {
		readonly fields: readonly E2eTemplateField[];
		readonly name: string;
		readonly signatories: readonly E2eTemplateSignatory[];
	}
): Promise<E2ePublishedTemplate> {
	const accessToken = await readE2eAccessToken(page);
	const convex = new ConvexHttpClient(requireEnv("VITE_CONVEX_URL"));
	convex.setAuth(accessToken);

	for (const field of args.fields) {
		if (field.type === "interpolable") {
			await ensureSystemVariable(convex, field.variableKey);
		}
	}

	const basePdfId = await uploadBasePdf(convex, {
		contents: await createTestPdfBuffer(`${args.name} Base PDF`),
		name: `${args.name} Base`,
	});
	const templateId = await convex.mutation(api.documentEngine.templates.create, {
		basePdfId,
		description: `${args.name} description`,
		name: args.name,
	});

	await convex.mutation(api.documentEngine.templates.saveDraft, {
		draft: {
			fields: args.fields.map((field, index) => {
				const baseField = {
					id: `${args.name}-${index}`,
					label:
						field.type === "interpolable"
							? field.variableKey
							: field.signatoryPlatformRole,
					position: {
						height: 18,
						page: 0,
						width: field.type === "interpolable" ? 220 : 120,
						x: 72,
						y: 120 + index * 40,
					},
					required: true,
				};
				if (field.type === "interpolable") {
					return {
						...baseField,
						type: "interpolable" as const,
						variableKey: field.variableKey,
					};
				}
				return {
					...baseField,
					signableType: "SIGNATURE" as const,
					signatoryPlatformRole: field.signatoryPlatformRole,
					type: "signable" as const,
				};
			}),
			pdfmeSchema: [],
			signatories: args.signatories.map((signatory, index) => ({
				label: signatory.platformRole,
				order: index + 1,
				platformRole: signatory.platformRole,
				role: signatory.role,
			})),
		},
		id: templateId,
	});
	await convex.mutation(api.documentEngine.templates.publish, {
		id: templateId,
		publishedBy: "e2e",
	});

	return {
		basePdfId: String(basePdfId),
		name: args.name,
		templateId: String(templateId),
	};
}

async function ensureSystemVariable(
	convex: ConvexHttpClient,
	key: string
): Promise<void> {
	const existing = await convex.query(api.documentEngine.systemVariables.getByKey, {
		key,
	});
	if (existing) {
		return;
	}

	await convex.mutation(api.documentEngine.systemVariables.create, {
		createdBy: "e2e",
		formatOptions: {},
		key,
		label: key,
		type: "string",
	});
}

async function uploadBasePdf(
	convex: ConvexHttpClient,
	args: { readonly contents: Uint8Array; readonly name: string }
): Promise<Id<"documentBasePdfs">> {
	const { uploadUrl } = await convex.mutation(
		api.documentEngine.basePdfs.generateUploadUrl,
		{}
	);
	const uploadResponse = await fetch(uploadUrl, {
		body: new Blob([new Uint8Array(args.contents)], {
			type: "application/pdf",
		}),
		headers: { "Content-Type": "application/pdf" },
		method: "POST",
	});
	if (!uploadResponse.ok) {
		throw new Error(`Storage upload failed with status ${uploadResponse.status}`);
	}

	const { storageId } = (await uploadResponse.json()) as {
		storageId: Id<"_storage">;
	};
	const metadata = await convex.action(
		api.documentEngine.basePdfs.extractPdfMetadata,
		{
			fileRef: storageId,
		}
	);
	if (!metadata.pageDimensions) {
		throw new Error("Base PDF metadata did not include page dimensions");
	}

	const result = await convex.mutation(api.documentEngine.basePdfs.create, {
		description: `${args.name} description`,
		fileHash: metadata.fileHash,
		fileRef: storageId,
		fileSize: metadata.fileSize,
		name: args.name,
		pageCount: metadata.pageCount,
		pageDimensions: metadata.pageDimensions,
		uploadedBy: "e2e",
	});
	return result.id;
}
