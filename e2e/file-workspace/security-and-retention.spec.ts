import { expect, test } from "@playwright/test";
import {
	createFileWorkspaceE2eClient,
	openManagerWorkspace,
	readFileWorkspaceAccessToken,
	seedDefaultFileWorkspaceFixture,
	uniqueFileWorkspaceRunId,
} from "../helpers/file-workspace";

test.setTimeout(90_000);

test.describe("File Workspace security and retention journeys", () => {
	test("covers participant management and denied lower-role management attempts", async ({
		page,
	}) => {
		const runId = uniqueFileWorkspaceRunId("fw-security");
		const { accessToken } = await readFileWorkspaceAccessToken(page);
		const client = createFileWorkspaceE2eClient(accessToken);
		const fixture = await seedDefaultFileWorkspaceFixture(page, runId);
		const invitedEmail = `file-workspace-e2e+${runId}-invite@test.fairlend.ca`;

		try {
			await openManagerWorkspace(page, fixture);
			await page.getByLabel("Participant email").fill(invitedEmail);
			await page.getByLabel("Participant role").selectOption("viewer");
			await page.getByRole("button", { name: "Save participant" }).click();
			await expect(page.getByText(invitedEmail)).toBeVisible({
				timeout: 20_000,
			});
			await expect(page.getByLabel(`Role for ${invitedEmail}`)).toHaveValue(
				"viewer"
			);

			await page.getByLabel(`Role for ${invitedEmail}`).selectOption("editor");
			await expect(page.getByText(invitedEmail)).toBeVisible({
				timeout: 20_000,
			});
			await expect(page.getByLabel(`Role for ${invitedEmail}`)).toHaveValue(
				"editor"
			);

			await page
				.getByRole("button", { name: `Remove ${invitedEmail}` })
				.click();
			await expect(page.getByText(invitedEmail)).toHaveCount(0);

			await page.goto(`/files/${fixture.boxes.viewer.boxId}`);
			await expect(
				page.getByRole("button", { name: "Upload", exact: true })
			).toBeDisabled({
				timeout: 20_000,
			});
			await expect(
				page.getByRole("button", { name: "Share settings" })
			).toBeDisabled();
			await expect(page.getByText("Participants")).toHaveCount(0);
			await expect(
				client.upsertParticipant({
					boxId: fixture.boxes.viewer.boxId,
					email: `denied-${invitedEmail}`,
					role: "viewer",
				})
			).rejects.toThrow();

			await page.goto(`/files/${fixture.boxes.editor.boxId}`);
			await expect(
				page.getByRole("button", { name: "Upload", exact: true })
			).toBeEnabled({
				timeout: 20_000,
			});
			await expect(
				page.getByRole("button", { name: "Share settings" })
			).toBeDisabled();
			await expect(
				client.upsertParticipant({
					boxId: fixture.boxes.editor.boxId,
					email: `editor-denied-${invitedEmail}`,
					role: "viewer",
				})
			).rejects.toThrow();
		} finally {
			await client.cleanupFixture(runId);
		}
	});

	test("records retention-blocked deletion evidence", async ({
		page,
	}) => {
		const runId = uniqueFileWorkspaceRunId("fw-retention");
		const { accessToken } = await readFileWorkspaceAccessToken(page);
		const client = createFileWorkspaceE2eClient(accessToken);
		const fixture = await seedDefaultFileWorkspaceFixture(page, runId);

		try {
			const deleteResult = await client.permanentlyDeleteNode({
				boxId: fixture.boxes.manager.boxId,
				nodeId: fixture.files.deleted.nodeId,
			});
			expect(deleteResult).toMatchObject({
				permanentlyDeleted: false,
				reasonCode: "retention_window_active",
			});
			await openManagerWorkspace(page, fixture);
			await expect(page.getByText("Trash retention")).toBeVisible();
			await expect(page.getByText("14 days")).toBeVisible();

			const retentionEvents = await client.getSecurityEvents({
				boxId: fixture.boxes.manager.boxId,
				eventType: "retention_delete_blocked",
			});
			expect(retentionEvents).toEqual([
				expect.objectContaining({
					outcome: "blocked",
					reasonCode: "retention_window_active",
				}),
			]);

			const scanReleaseEvents = await client.getSecurityEvents({
				boxId: fixture.boxes.manager.boxId,
				eventType: "scan_error_released",
			});
			expect(scanReleaseEvents).toEqual([]);
		} finally {
			await client.cleanupFixture(runId);
		}
	});
});
