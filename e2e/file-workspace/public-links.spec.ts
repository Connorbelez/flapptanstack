import { expect, test } from "@playwright/test";
import {
	createFileWorkspaceE2eClient,
	readFileWorkspaceAccessToken,
	seedDefaultFileWorkspaceFixture,
	uniqueFileWorkspaceRunId,
} from "../helpers/file-workspace";

test.setTimeout(90_000);

test.describe("File Workspace public and magic links", () => {
	test("renders public and magic links as view-only shares", async ({
		browser,
		page,
	}, testInfo) => {
		const runId = uniqueFileWorkspaceRunId("fw-public");
		const { accessToken } = await readFileWorkspaceAccessToken(page);
		const client = createFileWorkspaceE2eClient(accessToken);
		const fixture = await seedDefaultFileWorkspaceFixture(page, runId);
		const signedOut = await browser.newContext({
			baseURL: testInfo.project.use.baseURL,
			storageState: { cookies: [], origins: [] },
		});
		const publicPage = await signedOut.newPage();

		try {
			await publicPage.goto(`/files/public/${fixture.links.public.rawToken}`);
			await expect(publicPage).toHaveURL(/\/files\/public\//, {
				timeout: 20_000,
			});
			await expect(
				publicPage.getByRole("heading", { name: "Shared files" })
			).toBeVisible({ timeout: 20_000 });
			await expect(publicPage.getByText("Public clean package.txt")).toBeVisible();
			await expect(publicPage.getByText("Downloads enabled")).toBeVisible();
			await expect(
				publicPage.getByRole("button", {
					name: "Download Public clean package.txt",
				})
			).toBeVisible();

			await expect(publicPage.getByText("Upload")).toHaveCount(0);
			await expect(publicPage.getByText("Participants")).toHaveCount(0);
			await expect(publicPage.getByText("Security")).toHaveCount(0);
			await expect(publicPage.getByText("Trash")).toHaveCount(0);
			await expect(publicPage.getByText("Settings")).toHaveCount(0);
			await expect(publicPage.getByText("Versions")).toHaveCount(0);

			await publicPage.goto(`/files/public/${fixture.links.magic.rawToken}`);
			await expect(publicPage.getByText("Magic clean package.txt")).toBeVisible({
				timeout: 20_000,
			});
			await expect(publicPage.getByText("Downloads enabled")).toBeVisible();
		} finally {
			await signedOut.close();
			await client.cleanupFixture(runId);
		}
	});

	test("fails closed for expired, revoked, and tampered links", async ({
		browser,
		page,
	}, testInfo) => {
		const runId = uniqueFileWorkspaceRunId("fw-links");
		const { accessToken } = await readFileWorkspaceAccessToken(page);
		const client = createFileWorkspaceE2eClient(accessToken);
		const fixture = await seedDefaultFileWorkspaceFixture(page, runId);
		const signedOut = await browser.newContext({
			baseURL: testInfo.project.use.baseURL,
			storageState: { cookies: [], origins: [] },
		});
		const publicPage = await signedOut.newPage();

		try {
			for (const token of [
				fixture.links.expired.rawToken,
				fixture.links.revoked.rawToken,
				fixture.links.tamperedToken,
			]) {
				await publicPage.goto(`/files/public/${token}`);
				await expect(publicPage).toHaveURL(/\/files\/public\//, {
					timeout: 20_000,
				});
				await expect(
					publicPage.getByRole("heading", {
						name: "This file share is unavailable",
					})
				).toBeVisible({ timeout: 20_000 });
				await expect(
					publicPage.getByText(
						"The link may be expired, revoked, malformed, or no longer available."
					)
				).toBeVisible();
				await expect(publicPage.getByText("Public clean package.txt")).toHaveCount(
					0
				);
			}
		} finally {
			await signedOut.close();
			await client.cleanupFixture(runId);
		}
	});
});
