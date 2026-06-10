import { expect, test } from "@playwright/test";

test("mobile marketplace listings filter and search interactions stay in-page", async ({
	page,
}) => {
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 343, height: 940 });
	await page.goto("/e2e/marketplace-listings-mobile");

	await expect(page.getByRole("heading", { name: "Listings" })).toBeVisible({
		timeout: 60_000,
	});
	await expect(page.getByText("1st mortgages")).toBeVisible();
	await expect(page.getByText("LTV <= 65%")).toBeVisible();
	await expect(page.getByText("APR >= 9%")).toBeVisible();
	await expect(page.getByText("Available >= 50%")).toBeVisible();
	await expect(page.getByText("10/10 fractions available")).toBeVisible();
	await expect(page.getByText("Min <= $25K")).toBeVisible();

	await page.getByPlaceholder("Search address, city, type").fill("oakwood");
	await expect(page.getByText("Oakwood renewal bridge").first()).toBeVisible();
	await expect(page.getByText("King West bridge opportunity")).toHaveCount(0);
	await expect(page.getByText(/loading/i)).toHaveCount(0);

	await page.getByRole("button", { name: "Open listing filters" }).click();
	await expect(page.getByRole("heading", { name: "Filters" })).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Fractions available" })
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Minimum investment" })
	).toBeVisible();

	await page.keyboard.press("Escape");
	const mapTrigger = page.getByRole("button", { name: /open map view/i });
	await expect(mapTrigger).toBeVisible();
	const box = await mapTrigger.boundingBox();
	expect(box).not.toBeNull();
	expect(Math.abs((box?.y ?? 0) + (box?.height ?? 0) - 940)).toBeLessThanOrEqual(
		2
	);
});
