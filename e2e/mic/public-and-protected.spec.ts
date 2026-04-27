import { expect, test } from "@playwright/test";
import { buildLocalOrigin, getE2EPort } from "../helpers/host-aware-auth";

test.describe("MIC portal", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	const micOrigin = buildLocalOrigin(`mic.localhost:${getE2EPort()}`);

	test("renders the public MIC request form and validates email locally", async ({
		page,
	}) => {
		await page.goto(`${micOrigin}/`);

		await expect(
			page.getByRole("heading", { name: /mic portal/i })
		).toBeVisible();
		await expect(
			page.getByRole("heading", {
				name: /Request offering memorandum \/ prospectus/i,
			})
		).toBeVisible();
		await page.getByRole("button", { name: "Request access" }).click();
		await expect(page.getByText("Enter a valid email address")).toBeVisible();
		await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
			"href",
			"/sign-in?redirect=/portal"
		);
	});

	test("does not expose protected dashboard data to an unauthenticated visitor", async ({
		page,
	}) => {
		await page.goto(`${micOrigin}/portal`);

		await expect(
			page.getByText("101 Riverfront Ave, Ottawa")
		).not.toBeVisible();
		await expect(page.getByText("Outstanding Principal")).not.toBeVisible();
		await expect(page).toHaveURL(/sign-in|unauthorized|portal/);
	});
});
