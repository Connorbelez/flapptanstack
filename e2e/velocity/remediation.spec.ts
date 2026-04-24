import { expect, test } from "@playwright/test";
import {
	bootstrapVelocityE2e,
	openVelocityWorkspaceFromBoard,
	uploadPadEvidenceThroughUi,
	UI_TIMEOUT,
} from "../helpers/velocity";

test.use({ storageState: ".auth/admin.json" });

test.describe("Velocity remediation workflows", () => {
	test.setTimeout(180_000);

	test("surfaces unsupported payment frequency, missing PAD, and incomplete bank blockers from backend scenarios", async ({
		page,
	}) => {
		const { client } = await bootstrapVelocityE2e(page);
		const seedBase = Math.floor(Date.now() % 80_000) + 10_000;
		const unsupportedFrequency = await client.createScenario({
			scenarioName: "unsupported_payment_frequency",
			seed: seedBase,
		});
		const missingPad = await client.createScenario({
			scenarioName: "missing_pad",
			seed: seedBase + 1,
		});
		await client.applyScenarioFairLendPatch(missingPad);
		const incompleteBank = await client.createScenario({
			scenarioName: "incomplete_bank_data",
			seed: seedBase + 2,
		});
		await client.applyScenarioFairLendPatch(incompleteBank);

		await test.step("unsupported Velocity frequency stays visible in the operator board and workspace", async () => {
			await openVelocityWorkspaceFromBoard(page, {
				loanCode: unsupportedFrequency.loanCode,
			});
			await expect(
				page.getByText("Unsupported Payment Frequency")
			).toBeVisible({ timeout: UI_TIMEOUT });
			await expect(
				page.getByText("mortgageRequest.paymentFrequencyCode")
			).toBeVisible();
		});

		await test.step("missing PAD evidence remains a backend blocker after FairLend fields are complete", async () => {
			await openVelocityWorkspaceFromBoard(page, {
				loanCode: missingPad.loanCode,
			});
			await expect(page.getByText("Missing Pad Pdf")).toBeVisible({
				timeout: UI_TIMEOUT,
			});
			await expect(
				page.getByText("No active package documents are linked.")
			).toBeVisible();
		});

		await test.step("incomplete bank data renders the bank remediation lane", async () => {
			await openVelocityWorkspaceFromBoard(page, {
				loanCode: incompleteBank.loanCode,
			});
			await expect(page.getByText("Missing Bank Data")).toBeVisible({
				timeout: UI_TIMEOUT,
			});
			await expect(page.getByLabel("Account number")).toHaveValue("");
		});
	});

	test("opens a post-live drift exception after the shared mock Velocity deal changes", async ({
		page,
	}) => {
		const { client } = await bootstrapVelocityE2e(page);
		const seed = Math.floor(Date.now() % 80_000) + 90_000;
		const scenario = await client.createScenario({
			scenarioName: "post_live_velocity_drift",
			seed,
		});
		let workspace = await client.applyScenarioFairLendPatch(scenario);
		await openVelocityWorkspaceFromBoard(page, {
			loanCode: scenario.loanCode,
		});
		await uploadPadEvidenceThroughUi(page);

		await page.getByRole("link", { name: "Final review" }).click();
		await expect(
			page.getByRole("button", { name: "Confirm review" })
		).toBeEnabled({ timeout: UI_TIMEOUT });
		await page.getByRole("button", { name: "Confirm review" }).click();
		await expect(
			page.getByRole("button", { name: "Activate package" })
		).toBeEnabled({ timeout: UI_TIMEOUT });
		await page.getByRole("button", { name: "Activate package" }).click();
		await expect(page.getByText("Velocity package activated.")).toBeVisible({
			timeout: 120_000,
		});
		workspace = await client.getWorkspace(workspace.workspaceId);
		expect(workspace.activationAttempt?.status).toBe("succeeded");

		if (!scenario.nextVelocityPatch) {
			throw new Error("post_live_velocity_drift scenario did not provide drift");
		}
		await client.patchMockDeal(scenario.loanCode, scenario.nextVelocityPatch);
		await client.deliverWebhook(scenario.loanCode);
		await client.syncNow(workspace.workspaceId);

		await page.goto(`/admin/velocity/${workspace.workspaceId}`);
		await expect(page.getByText("Live Drift Exception")).toBeVisible({
			timeout: UI_TIMEOUT,
		});
		await expect(
			page.getByText(
				"Velocity-owned core data changed after the package was activated. Canonical mortgage data was left unchanged."
			)
		).toBeVisible();
	});

	test("surfaces activation failure remediation and retries through the operator action", async ({
		page,
	}) => {
		const { client } = await bootstrapVelocityE2e(page);
		const seed = Math.floor(Date.now() % 80_000) + 170_000;
		const scenario = await client.createScenario({
			scenarioName: "retry_after_remediation",
			seed,
		});
		let workspace = await client.applyScenarioFairLendPatch(scenario);
		workspace = await client.linkPadEvidence(workspace.workspaceId);
		await client.confirmFinalReview(workspace.workspaceId);
		await client.recordFailedActivationAttempt({
			failureCode: "rotessa_request_failed",
			failureMessage: "Rotessa schedule creation failed.",
			workspaceId: workspace.workspaceId,
		});

		await page.goto(`/admin/velocity/${workspace.workspaceId}/review`);
		await expect(page.getByText("Rotessa Request Failed")).toBeVisible({
			timeout: UI_TIMEOUT,
		});
		await expect(page.getByText("Rotessa schedule creation failed.")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Retry activation" })
		).toBeEnabled();
		await page.getByRole("button", { name: "Retry activation" }).click();
		await expect(page.getByText(/Velocity activation (succeeded|failed)\./)).toBeVisible({
			timeout: 120_000,
		});
	});
});
