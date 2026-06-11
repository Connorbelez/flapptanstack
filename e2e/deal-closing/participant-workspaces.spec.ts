import { expect, test } from "@playwright/test";

const DATA_LOAD_TIMEOUT = 15_000;
const FIXTURE_PATH = "/e2e/participant-workspaces.html";

test.describe("Deal Closing Participant Workspaces", () => {
	test("renders lender acceptance queues without admin auth", async ({
		page,
	}) => {
		await page.goto(FIXTURE_PATH);

		await expect(
			page.getByRole("heading", { name: "My Closings" })
		).toBeVisible({ timeout: DATA_LOAD_TIMEOUT });
		await expect(page.getByText("Lender Closings")).toBeVisible();
		await expect(page.getByText("Needs Action")).toBeVisible();
		await expect(page.getByText("In Progress")).toBeVisible();
		await expect(page.getByRole("heading", { name: "Completed" })).toBeVisible();

		await page.goto(`${FIXTURE_PATH}?scenario=selling-lender-queue`);

		await expect(
			page.getByRole("heading", { name: "My Closings" })
		).toBeVisible({ timeout: DATA_LOAD_TIMEOUT });
		await expect(page.getByText("Selling Lender Closings")).toBeVisible();
		await expect(page.getByText("Needs Action")).toBeVisible();
		await expect(page.getByText("In Progress")).toBeVisible();
		await expect(page.getByRole("heading", { name: "Completed" })).toBeVisible();
	});

	test("covers participant workspace happy path and raw token denial", async ({
		page,
	}) => {
		await page.goto(`${FIXTURE_PATH}?scenario=workspace`);
		await expect(
			page.getByRole("heading", { name: "123 King St W, Toronto" })
		).toBeVisible({ timeout: DATA_LOAD_TIMEOUT });

		await expect(page.getByText("Documents & Signatures")).toBeVisible({
			timeout: DATA_LOAD_TIMEOUT,
		});
		await expect(page.getByText("Overview")).toBeVisible();
		await expect(page.getByText("Timeline")).toBeVisible();
		await expect(page.getByText("Parties & Counsel")).toBeVisible();
		await expect(page.getByText("Signing task ready")).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Open signing" })
		).toHaveCount(0);
			await expect(page.locator('a[href="purchasing-lender-token"]')).toHaveCount(0);
	});

	test("covers completed receipt and unauthorized denial states", async ({
		page,
	}) => {
		await page.goto(`${FIXTURE_PATH}?scenario=completed`);
		await expect(page.getByText("Completion Receipt")).toBeVisible({
			timeout: DATA_LOAD_TIMEOUT,
		});
		await expect(page.getByText("Manual Admin")).toBeVisible();
		await expect(page.getByText("archived")).toBeVisible();

		await page.goto(`${FIXTURE_PATH}?scenario=unauthorized`);
		await expect(
			page.getByRole("heading", { name: "Workspace unavailable" })
		).toBeVisible({ timeout: DATA_LOAD_TIMEOUT });
			await expect(
				page.getByText(
					"Forbidden: no participating_lender workspace access for this deal."
				)
			).toBeVisible();
	});

	test("covers the no-active-closings empty state", async ({ page }) => {
		await page.goto(`${FIXTURE_PATH}?scenario=empty`);

		await expect(page.getByText("No active closings", { exact: true })).toBeVisible({
			timeout: DATA_LOAD_TIMEOUT,
		});
	});
});
