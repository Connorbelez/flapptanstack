import { expect, test, type Page } from "@playwright/test";
import { createAuthStorageState, TEST_ADMIN_ORG_ID } from "../helpers/auth-storage";
import {
	ADMIN_STORAGE_STATE,
	createPublishedTemplate,
	createTestPdfBuffer,
	uniqueName,
} from "../helpers/document-engine";
import type { Id } from "../../convex/_generated/dataModel";
import {
	createCommittedMortgage,
	createOriginationE2eClient,
} from "../helpers/origination";

const UI_TIMEOUT = 30_000;

type OriginationE2eClient = ReturnType<typeof createOriginationE2eClient>;
type MortgageDetailContext = Awaited<
	ReturnType<OriginationE2eClient["getMortgageDetailContext"]>
>;

interface AttachmentCleanupState {
	accessToken?: string;
	basePdfIds: Id<"documentBasePdfs">[];
	caseId?: string;
	mortgageId?: string;
	templateIds: Id<"documentTemplates">[];
}

async function openAttachDialog(page: Page) {
	await page.getByRole("button", { name: "Attach document" }).click();
	const dialog = page.getByRole("dialog", { name: "Attach mortgage document" });
	await expect(dialog).toBeVisible({ timeout: UI_TIMEOUT });
	return dialog;
}

async function attachStaticDocument(page: Page, displayName: string) {
	const dialog = await openAttachDialog(page);
	await dialog.getByRole("button", { name: "Continue" }).click();
	await dialog.getByLabel("Display name").fill(displayName);
	await dialog.getByLabel("PDF upload").setInputFiles({
		buffer: await createTestPdfBuffer(`${displayName} PDF`),
		mimeType: "application/pdf",
		name: `${displayName.toLowerCase().replace(/\s+/g, "-")}.pdf`,
	});
	await dialog.getByRole("button", { name: "Review" }).click();
	await expect(dialog.getByText(/future deal packages only/i)).toBeVisible();
	await dialog
		.getByRole("button", { name: "Attach future-only document" })
		.click();
	await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: UI_TIMEOUT });
}

function collectMortgageDocumentAssetIds(
	detailContext: MortgageDetailContext
): Id<"documentAssets">[] {
	return (detailContext?.documents ?? [])
		.map((document) => document.asset?.assetId)
		.filter((assetId): assetId is Id<"documentAssets"> => Boolean(assetId));
}

test.describe("admin mortgage document attachments", () => {
	test.setTimeout(180_000);

	let cleanupState: AttachmentCleanupState = { basePdfIds: [], templateIds: [] };

	test.beforeEach(async ({ page }) => {
		cleanupState = { basePdfIds: [], templateIds: [] };
		await createAuthStorageState({
			orgId: TEST_ADMIN_ORG_ID,
			page,
			path: ADMIN_STORAGE_STATE,
		});
	});

	test.afterEach(async () => {
		const { accessToken, caseId, mortgageId } = cleanupState;
		let cleanupError: unknown;
		if (accessToken) {
			const client = createOriginationE2eClient(accessToken);
			if (
				mortgageId &&
				(cleanupState.basePdfIds.length > 0 ||
					cleanupState.templateIds.length > 0)
			) {
				try {
					const detailContext = await client.getMortgageDetailContext(mortgageId);
					const { dealId } = await client.createDealForMortgage(mortgageId);
					await client.cleanupDealPackageScenario({
						assetIds: collectMortgageDocumentAssetIds(detailContext),
						basePdfIds: cleanupState.basePdfIds,
						dealId: String(dealId),
						mortgageId,
						templateIds: cleanupState.templateIds,
					});
				} catch (error) {
					cleanupError = error;
				}
			}
			if (caseId) {
				try {
					await client.cleanupCommittedOrigination(caseId);
				} catch (error) {
					cleanupError ??= error;
				}
			}
		}

		cleanupState = { basePdfIds: [], templateIds: [] };
		if (cleanupError) {
			throw cleanupError;
		}
	});

	test("attaches public static, interpolable, and signable mortgage documents from Files", async ({
		page,
	}) => {
		const runName = uniqueName("MortgageDocAttach");
		const staticDisplayName = `${runName} Public Static`;
		const mortgage = await createCommittedMortgage(page);
		cleanupState.accessToken = mortgage.accessToken;
		cleanupState.caseId = mortgage.caseId;
		cleanupState.mortgageId = mortgage.mortgageId;
		const interpolableTemplate = await createPublishedTemplate(page, {
			fields: [{ type: "interpolable", variableKey: "mortgage_principal" }],
			name: `${runName} Interpolable Notice`,
			signatories: [],
		});
		cleanupState.basePdfIds.push(
			interpolableTemplate.basePdfId as Id<"documentBasePdfs">
		);
		cleanupState.templateIds.push(
			interpolableTemplate.templateId as Id<"documentTemplates">
		);
		const signableTemplate = await createPublishedTemplate(page, {
			fields: [
				{ type: "interpolable", variableKey: "mortgage_principal" },
				{
					signatoryPlatformRole: "borrower_primary",
					type: "signable",
				},
			],
			name: `${runName} Signable Notice`,
			signatories: [{ platformRole: "borrower_primary", role: "signatory" }],
		});
		cleanupState.basePdfIds.push(
			signableTemplate.basePdfId as Id<"documentBasePdfs">
		);
		cleanupState.templateIds.push(
			signableTemplate.templateId as Id<"documentTemplates">
		);

		await page.goto(`/admin/mortgages/${mortgage.mortgageId}`);
		await page.getByRole("tab", { name: "Files" }).click();

		await attachStaticDocument(page, staticDisplayName);

		let dialog = await openAttachDialog(page);
		await dialog.getByLabel("Private templated read-only").click();
		await dialog.getByLabel("Template").click();
		await page
			.getByRole("option", { name: new RegExp(interpolableTemplate.name) })
			.click();
		await expect(dialog.getByText("mortgage_principal")).toBeVisible({
			timeout: UI_TIMEOUT,
		});
		await dialog.getByRole("button", { name: "Review" }).click();
		await expect(dialog.getByText(/future deal packages only/i)).toBeVisible();
		await dialog
			.getByRole("button", { name: "Attach future-only document" })
			.click();
		await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: UI_TIMEOUT });

		dialog = await openAttachDialog(page);
		await dialog.getByLabel("Private signable template").click();
		await dialog.getByLabel("Template").click();
		await page
			.getByRole("option", { name: new RegExp(signableTemplate.name) })
			.click();
		await expect(dialog.getByText("mortgage_principal")).toBeVisible({
			timeout: UI_TIMEOUT,
		});
		await expect(dialog.getByText("borrower_primary")).toBeVisible({
			timeout: UI_TIMEOUT,
		});
		await dialog.getByRole("button", { name: "Review" }).click();
		await expect(dialog.getByText(/future deal packages only/i)).toBeVisible();
		await dialog
			.getByRole("button", { name: "Attach future-only document" })
			.click();
		await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: UI_TIMEOUT });

		await page.getByRole("tab", { name: "Details" }).click();
		await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible({
			timeout: UI_TIMEOUT,
		});
		await expect(page.getByText(staticDisplayName)).toBeVisible();
		await expect(page.getByText(interpolableTemplate.name)).toBeVisible();
		await expect(page.getByText(signableTemplate.name)).toBeVisible();
	});
});
