import { expect, test, type Page } from "@playwright/test";
import {
	createFileWorkspaceE2eClient,
	expectNoTextOverlap,
	openManagerWorkspace,
	readFileWorkspaceAccessToken,
	seedDefaultFileWorkspaceFixture,
	uniqueFileWorkspaceRunId,
} from "../helpers/file-workspace";

test.setTimeout(90_000);

function fileRow(page: Page, name: string) {
	return fileRowButton(page, name)
		.locator("xpath=ancestor::div[contains(@class, 'grid')][1]");
}

function fileRowButton(page: Page, name: string) {
	return page.getByRole("button", { name, exact: true }).nth(1);
}

test.describe("File Workspace authenticated journeys", () => {
	test("creates a box, folder, and upload through the UI", async ({
		page,
	}, testInfo) => {
		const runId = uniqueFileWorkspaceRunId("fw-create");
		const { accessToken } = await readFileWorkspaceAccessToken(page);
		const client = createFileWorkspaceE2eClient(accessToken);
		const boxName = `File Workspace E2E ${runId} Created Via UI`;
		const uploadedName = `manager-upload-${runId}.txt`;

		try {
			await page.goto("/files");
			await expect(page.getByRole("heading", { name: "Files" })).toBeVisible({
				timeout: 20_000,
			});
			await page.getByLabel("New box name").fill(boxName);
			await page.getByRole("button", { name: "Create box" }).click();

			await expect(page).toHaveURL(/\/files\/.+/, { timeout: 20_000 });
			await expect(page.locator("h1", { hasText: boxName })).toBeVisible({
				timeout: 20_000,
			});
			await expect(
				page.getByRole("button", { name: "Upload", exact: true })
			).toBeEnabled();
			await expect(
				page.getByRole("button", { name: "Share settings" })
			).toBeEnabled();

			await page.getByRole("button", { name: "Create folder" }).click();
			await expect(
				page
					.getByLabel("Files", { exact: true })
					.getByRole("button", { name: "New folder", exact: true })
			).toBeVisible({ timeout: 20_000 });

			await page.getByLabel("Upload file to workspace").setInputFiles({
				buffer: Buffer.from("uploaded by File Workspace E2E\n"),
				mimeType: "text/plain",
				name: uploadedName,
			});
			await expect(
				page
					.getByLabel("Files", { exact: true })
					.getByRole("button", { name: uploadedName, exact: true })
			).toBeVisible({
				timeout: 20_000,
			});
			await expect(
				fileRow(page, uploadedName).getByText("Pending Scan")
			).toBeVisible();

			await testInfo.attach("created-workspace-with-pending-upload", {
				body: await page.screenshot({ fullPage: true }),
				contentType: "image/png",
			});
		} finally {
			await client.cleanupFixture(runId);
		}
	});

	test("navigates seeded workspace files, scan quarantine, and replacement versions", async (
		{ page },
		testInfo
	) => {
		const runId = uniqueFileWorkspaceRunId("fw-workspace");
		const { accessToken } = await readFileWorkspaceAccessToken(page);
		const client = createFileWorkspaceE2eClient(accessToken);
		const fixture = await seedDefaultFileWorkspaceFixture(page, runId);

		try {
			await openManagerWorkspace(page, fixture);

			await expect(page.getByText("Funding Conditions").first()).toBeVisible();
			await expect(
				page
					.getByLabel("Files", { exact: true })
					.getByRole("button", {
						name: "Pending scan package.txt",
						exact: true,
					})
			).toBeVisible();
			await expect(
				page
					.getByLabel("Files", { exact: true })
					.getByRole("button", {
						name: "Rejected executable.txt",
						exact: true,
					})
			).toBeVisible();
			await expect(
				page
					.getByLabel("Files", { exact: true })
					.getByRole("button", {
						name: "Released by admin.txt",
						exact: true,
					})
			).toBeVisible();
			await expect(page.getByText("Pending Scan", { exact: true })).toBeVisible();
			await expect(page.getByText("Rejected", { exact: true })).toBeVisible();
			await expect(
				page.getByText("Released By Admin", { exact: true })
			).toBeVisible();
			await testInfo.attach("manager-workspace-desktop", {
				body: await page.screenshot({ fullPage: true }),
				contentType: "image/png",
			});

			await expect(
				fileRow(page, "Commitment letter clean.txt").getByRole("button", {
					name: "Preview",
				})
			).toBeEnabled();
			await expect(
				fileRow(page, "Commitment letter clean.txt").getByRole("button", {
					name: "Download",
				})
			).toBeEnabled();
			await expect(
				fileRow(page, "Pending scan package.txt").getByRole("button", {
					name: "Preview",
				})
			).toBeDisabled();
			await expect(
				fileRow(page, "Rejected executable.txt").getByRole("button", {
					name: "Download",
				})
			).toBeDisabled();

			await fileRowButton(page, "Commitment letter clean.txt").click();
			await client.replaceFile({
				body: "replacement pending body",
				boxId: fixture.boxes.manager.boxId,
				displayName: "Commitment letter clean.txt",
				nodeId: fixture.files.clean.nodeId,
			});
			await page.reload();
			await fileRowButton(page, "Commitment letter clean.txt").click();

			const inspector = page.getByRole("complementary").last();
			await expect(page.getByText("v1")).toBeVisible();
			await expect(page.getByText("v2")).toBeVisible();
			await expect(
				inspector.getByText("Clean", { exact: true }).first()
			).toBeVisible();
			await expect(
				inspector.getByText("Pending Scan", { exact: true }).first()
			).toBeVisible();

			await page
				.getByRole("tree", { name: "Files" })
				.getByRole("button", { name: "Funding Conditions", exact: true })
				.focus();
			await page.keyboard.press("Enter");
			await expect(
				page
					.getByRole("tree", { name: "Files" })
					.getByRole("button", {
						name: "2026 Closing Package With Long Folder Name",
						exact: true,
					})
			).toBeVisible({ timeout: 20_000 });
			await page
				.getByRole("tree", { name: "Files" })
				.getByRole("button", {
					name: "2026 Closing Package With Long Folder Name",
					exact: true,
				})
				.focus();
			await page.keyboard.press("Enter");
			await expect(
				page
					.getByRole("tree", { name: "Files" })
					.getByRole("button", {
						name: "Nested Review Level Three",
						exact: true,
					})
			).toBeVisible({ timeout: 20_000 });

			await page.setViewportSize({ width: 390, height: 844 });
			await page.reload();
			await page.getByRole("button", { name: "List view" }).click();
			await expect(
				fileRowButton(page, "Commitment letter clean.txt")
			).toBeVisible({
				timeout: 20_000,
			});
			await expectNoTextOverlap(page);
			await testInfo.attach("manager-workspace-mobile", {
				body: await page.screenshot({ fullPage: true }),
				contentType: "image/png",
			});
		} finally {
			await client.cleanupFixture(runId);
		}
	});

	test("shows failed uploads and suspended boxes as blocked states", async ({
		page,
	}) => {
		const runId = uniqueFileWorkspaceRunId("fw-chaos");
		const { accessToken } = await readFileWorkspaceAccessToken(page);
		const client = createFileWorkspaceE2eClient(accessToken);
		const fixture = await seedDefaultFileWorkspaceFixture(page, runId);

		try {
			await openManagerWorkspace(page, fixture);
			let blockedStorageUpload = false;
			await page.route("**", async (route) => {
				const request = route.request();
				if (
					!blockedStorageUpload &&
					request.method() === "POST" &&
					request.url().includes("/api/storage/")
				) {
					blockedStorageUpload = true;
					await route.fulfill({ body: "forced upload failure", status: 500 });
					return;
				}
				await route.continue();
			});
			await page.getByLabel("Upload file to workspace").setInputFiles({
				buffer: Buffer.from("this upload should fail\n"),
				mimeType: "text/plain",
				name: `forced-failure-${runId}.txt`,
			});
			await expect(page.getByRole("alert")).toContainText("Upload failed.", {
				timeout: 20_000,
			});
			expect(blockedStorageUpload).toBe(true);
			await page.unroute("**");

			await page.goto(`/files/${fixture.boxes.suspended.boxId}`);
			await expect(
				page.getByRole("heading", { name: "Access denied" })
			).toBeVisible({ timeout: 20_000 });
			await expect(
				page.getByText("Box not found or access denied.")
			).toBeVisible();
			await expect(
				page.getByRole("button", { name: "Upload", exact: true })
			).toHaveCount(0);
		} finally {
			await client.cleanupFixture(runId);
		}
	});
});
