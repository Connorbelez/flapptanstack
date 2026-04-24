import { expect, test } from "@playwright/test";
import {
	bootstrapVelocityE2e,
	openVelocityWorkspaceFromBoard,
	uploadPadEvidenceThroughUi,
	UI_TIMEOUT,
} from "../helpers/velocity";

test.use({ storageState: ".auth/admin.json" });

test.describe("Velocity operator workflow", () => {
	test.setTimeout(180_000);

	test("progresses a backend scenario from board to workspace to final review to activation", async ({
		page,
	}) => {
		const { client } = await bootstrapVelocityE2e(page);
		const seed = Math.floor(Date.now() % 90_000) + 10_000;
		const scenario = await client.createScenario({
			scenarioName: "successful_all_or_nothing_activation",
			seed,
		});
		let workspace = await client.applyScenarioFairLendPatch(scenario);

		await test.step("open the real backend package from the board", async () => {
			await openVelocityWorkspaceFromBoard(page, {
				loanCode: scenario.loanCode,
			});
			await expect(
				page.getByText(scenario.linkApplicationId ?? "", { exact: true })
			).toBeVisible({ timeout: UI_TIMEOUT });
			await uploadPadEvidenceThroughUi(page);
			await expect(
				page.getByText("No backend readiness blockers are active.")
			).toBeVisible({ timeout: UI_TIMEOUT });
		});

		await test.step("sync through the operator button", async () => {
			await client.patchMockDeal(scenario.loanCode, {
				mortgageRequest: { rate: 12.34 },
			});
			await page.getByRole("button", { name: "Sync now" }).click();
			await expect(page.getByText("12.34%")).toBeVisible({
				timeout: UI_TIMEOUT,
			});
		});

		await test.step("confirm final review from the review route", async () => {
			await page.getByRole("link", { name: "Final review" }).click();
			await expect(
				page.getByRole("heading", { exact: true, name: "Final review" })
			).toBeVisible({ timeout: UI_TIMEOUT });
			await expect(page.getByText(scenario.loanCode, { exact: true })).toBeVisible({
				timeout: UI_TIMEOUT,
			});
			await expect(
				page.getByRole("button", { name: "Confirm review" })
			).toBeEnabled({ timeout: UI_TIMEOUT });
			await page.getByRole("button", { name: "Confirm review" }).click();
			await expect(page.getByText("Reviewed", { exact: true })).toBeVisible({
				timeout: UI_TIMEOUT,
			});
			await expect(
				page.getByRole("button", { name: "Activate package" })
			).toBeEnabled({ timeout: UI_TIMEOUT });
		});

		await test.step("activate the package through the operator action", async () => {
			await page.getByRole("button", { name: "Activate package" }).click();
			await expect(page.getByText("Velocity package activated.")).toBeVisible({
				timeout: 120_000,
			});
			await expect(page.getByText("Succeeded", { exact: true })).toBeVisible({
				timeout: UI_TIMEOUT,
			});
		});

		workspace = await client.getWorkspace(workspace.workspaceId);
		expect(workspace.activationAttempt?.status).toBe("succeeded");
		expect(workspace.fairlendOwned.finalReview?.reviewedSnapshotHash).toBe(
			workspace.velocityOwned.normalizedCoreHash
		);
	});
});
