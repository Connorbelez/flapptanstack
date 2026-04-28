import { expect, test } from "@playwright/test";

const DEALS_URL = "/admin/deals";
const DATA_LOAD_TIMEOUT = 15_000;

/**
 * Locate a kanban column by its header title.
 * Columns are `w-80` divs containing the title in an `h2`.
 */
function getColumn(page: import("@playwright/test").Page, title: string) {
	return page.locator(".w-80").filter({
		has: page.locator("h2", { hasText: title }),
	});
}

function shareText(shareUnits: number) {
	return `Share ${shareUnits / 100}%`;
}

/**
 * Locate a deal card by its unique fractional share value.
 * Seeded deals have shares: 3000 (initiated), 5000 (lawyerOnboarding.verified),
 * 2000 (documentReview.signed).
 */
function getDealCard(page: import("@playwright/test").Page, share: number) {
	return page
		.locator("[data-slot='card']")
		.filter({ hasText: shareText(share) });
}

// ── Board Rendering ──────────────────────────────────────────────

test.describe("Deal Closing Kanban — Board Rendering", () => {
	test("renders 6 kanban columns with correct headers", async ({ page }) => {
		await page.goto(DEALS_URL);

		const columnTitles = [
			"Initiated",
			"Lawyer Onboarding",
			"Document Review",
			"Funds Transfer",
			"Confirmed",
			"Failed",
		];

		for (const title of columnTitles) {
			await expect(
				getColumn(page, title).locator("h2", { hasText: title }),
			).toBeVisible({ timeout: DATA_LOAD_TIMEOUT });
		}
	});

	test("seeded deals appear in correct columns", async ({ page }) => {
		await page.goto(DEALS_URL);

		// Wait for deals to load
		await expect(getDealCard(page, 3000)).toBeVisible({
			timeout: DATA_LOAD_TIMEOUT,
		});

		// Deal 1 (3000 share, initiated) → Initiated column
		await expect(
			getColumn(page, "Initiated").getByText(shareText(3000)),
		).toBeVisible();

		// Deal 2 (5000 share, lawyerOnboarding.verified) → Lawyer Onboarding column
		await expect(
			getColumn(page, "Lawyer Onboarding").getByText(shareText(5000)),
		).toBeVisible();

		// Deal 3 (2000 share, documentReview.signed) → Document Review column
		await expect(
			getColumn(page, "Document Review").getByText(shareText(2000)),
		).toBeVisible();
	});

	test("deal cards display sub-state badges", async ({ page }) => {
		await page.goto(DEALS_URL);

		await expect(getDealCard(page, 3000)).toBeVisible({
			timeout: DATA_LOAD_TIMEOUT,
		});

		// Deal 1: initiated → "Initiated - Pending"
		await expect(
			getDealCard(page, 3000).getByText("Initiated - Pending"),
		).toBeVisible();

		// Deal 2: lawyerOnboarding.verified → "Lawyer Onboarding - Verified"
		await expect(
			getDealCard(page, 5000).getByText("Lawyer Onboarding - Verified"),
		).toBeVisible();

		// Deal 3: documentReview.signed → "Document Review - Signed"
		await expect(
			getDealCard(page, 2000).getByText("Document Review - Signed"),
		).toBeVisible();
	});

	test("deal cards show phase completion progress indicators", async ({
		page,
	}) => {
		await page.goto(DEALS_URL);

		await expect(getDealCard(page, 3000)).toBeVisible({
			timeout: DATA_LOAD_TIMEOUT,
		});

		// Deal 1 (initiated): no completed phases → current bar is blue, rest are muted
		const deal1 = getDealCard(page, 3000);
		await expect(deal1.locator(".bg-blue-500")).toBeVisible();
		// No green bars (no completed phases)
		await expect(deal1.locator(".bg-emerald-500")).toHaveCount(0);

		// Deal 3 (documentReview.signed): 2 completed phases → 2 green bars
		const deal3 = getDealCard(page, 2000);
		await expect(deal3.locator(".bg-emerald-500")).toHaveCount(2);
	});
});

// ── Action Button Visibility ─────────────────────────────────────

test.describe("Deal Closing Kanban — Action Visibility", () => {
	test("initiated deal shows Lock Deal + Cancel Deal only", async ({
		page,
	}) => {
		await page.goto(DEALS_URL);

		const deal = getDealCard(page, 3000);
		await expect(deal).toBeVisible({ timeout: DATA_LOAD_TIMEOUT });

		await expect(
			deal.getByRole("button", { name: "Lock Deal" }),
		).toBeVisible();
		await expect(
			deal.getByRole("button", { name: /Cancel Deal/ }),
		).toBeVisible();

		// No other phase actions
		await expect(
			deal.getByRole("button", { name: "Verify Lawyer" }),
		).toHaveCount(0);
		await expect(
			deal.getByRole("button", { name: "Approve Documents" }),
		).toHaveCount(0);
		await expect(
			deal.getByRole("button", { name: "Confirm Funds Received" }),
		).toHaveCount(0);
	});

	test("lawyerOnboarding.verified deal shows Confirm Representation + Cancel Deal", async ({
		page,
	}) => {
		await page.goto(DEALS_URL);

		const deal = getDealCard(page, 5000);
		await expect(deal).toBeVisible({ timeout: DATA_LOAD_TIMEOUT });

		await expect(
			deal.getByRole("button", { name: "Confirm Representation" }),
		).toBeVisible();
		await expect(
			deal.getByRole("button", { name: /Cancel Deal/ }),
		).toBeVisible();

		// No other phase actions
		await expect(
			deal.getByRole("button", { name: "Lock Deal" }),
		).toHaveCount(0);
		await expect(
			deal.getByRole("button", { name: "Approve Documents" }),
		).toHaveCount(0);
	});

	test("documentReview.signed deal shows Confirm All Signed + Cancel Deal", async ({
		page,
	}) => {
		await page.goto(DEALS_URL);

		const deal = getDealCard(page, 2000);
		await expect(deal).toBeVisible({ timeout: DATA_LOAD_TIMEOUT });

		await expect(
			deal.getByRole("button", { name: "Confirm All Signed" }),
		).toBeVisible();
		await expect(
			deal.getByRole("button", { name: /Cancel Deal/ }),
		).toBeVisible();

		// No other phase actions
		await expect(
			deal.getByRole("button", { name: "Lock Deal" }),
		).toHaveCount(0);
		await expect(
			deal.getByRole("button", { name: "Confirm Representation" }),
		).toHaveCount(0);
	});
});

// ── State Transitions (serial — mutates seeded data) ─────────────

test.describe.serial(
	"Deal Closing Kanban — State Transitions",
	() => {
		test("advance: Confirm Representation moves deal to Document Review (real-time)", async ({
			page,
		}) => {
			await page.goto(DEALS_URL);

			// Find Deal 2 (5000 share) in Lawyer Onboarding
			const deal = getDealCard(page, 5000);
			await expect(deal).toBeVisible({ timeout: DATA_LOAD_TIMEOUT });
			await expect(
				deal.getByText("Lawyer Onboarding - Verified"),
			).toBeVisible();

			// Click "Confirm Representation" (no payload needed)
			await deal
				.getByRole("button", { name: "Confirm Representation" })
				.click();

			// Success toast
			await expect(page.getByText("Confirm Representation submitted")).toBeVisible({
				timeout: DATA_LOAD_TIMEOUT,
			});

			// Convex reactivity: deal moves to Document Review column without refresh
			await expect(
				getColumn(page, "Document Review").getByText(shareText(5000)),
			).toBeVisible({ timeout: DATA_LOAD_TIMEOUT });

			// Badge updates to "Document Review - Pending"
			await expect(
				getDealCard(page, 5000).getByText("Document Review - Pending"),
			).toBeVisible({ timeout: DATA_LOAD_TIMEOUT });

			// Action button updates to "Approve Documents"
			await expect(
				getDealCard(page, 5000).getByRole("button", {
					name: "Approve Documents",
				}),
			).toBeVisible({ timeout: DATA_LOAD_TIMEOUT });
		});

		test("cancel: Cancel Deal moves deal to Failed column with reason required", async ({
			page,
		}) => {
			await page.goto(DEALS_URL);

			// Find Deal 3 (2000 share) in Document Review
			const deal = getDealCard(page, 2000);
			await expect(deal).toBeVisible({ timeout: DATA_LOAD_TIMEOUT });

			// Open cancel dialog
			await deal.getByRole("button", { name: /Cancel Deal/ }).click();

			// Dialog appears with title and description
			await expect(
				page.getByRole("heading", { name: "Cancel deal" }),
			).toBeVisible();
			await expect(
				page.getByText(
					"This action is submitted through the governed deal transition path",
				),
			).toBeVisible();

			// Confirm button is disabled without a reason.
			const confirmBtn = page
				.locator("[role='dialog']")
				.getByRole("button", { name: "Cancel Deal" });
			await expect(confirmBtn).toBeDisabled();

			// Enter cancellation reason
			await page
				.getByPlaceholder("Explain why this deal is being cancelled...")
				.fill("E2E test cancellation");

			// Confirm button is now enabled.
			await expect(confirmBtn).toBeEnabled();

			// Confirm the cancellation
			await confirmBtn.click();

			// Success toast
			await expect(page.getByText("Cancel Deal submitted")).toBeVisible({
				timeout: DATA_LOAD_TIMEOUT,
			});

			// Deal moves to Failed column (Convex reactivity, no refresh needed)
			await expect(
				getColumn(page, "Failed").getByText(shareText(2000)),
			).toBeVisible({ timeout: DATA_LOAD_TIMEOUT });

			// Badge shows terminal state
			await expect(
				getDealCard(page, 2000).getByText("Failed - Terminated"),
			).toBeVisible({ timeout: DATA_LOAD_TIMEOUT });

			// No action buttons on terminal deal (including no Cancel Deal)
			const cancelledDeal = getDealCard(page, 2000);
			await expect(
				cancelledDeal.getByRole("button", { name: /Cancel Deal/ }),
			).toHaveCount(0);
			await expect(
				cancelledDeal.getByRole("button", { name: "Confirm All Signed" }),
			).toHaveCount(0);
		});

		test("cancelled deal: Failed column count increments", async ({
			page,
		}) => {
			await page.goto(DEALS_URL);

			// After the previous cancel, Failed column should show at least 1 deal
			await expect(
				getColumn(page, "Failed").getByText(shareText(2000)),
			).toBeVisible({ timeout: DATA_LOAD_TIMEOUT });

			// The column count is a muted-foreground span next to the h2 header.
			// Scope to the header row to avoid matching deal card content.
			const failedHeader = getColumn(page, "Failed").locator(
				".flex.items-center.gap-2",
			);
			await expect(
				failedHeader.locator(".text-muted-foreground"),
			).toHaveText(/[1-9]/);
		});
	},
);
