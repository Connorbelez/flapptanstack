import { expect, test, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import { createAuthStorageState, TEST_ADMIN_ORG_ID } from "../helpers/auth-storage";

const ADMIN_STORAGE_STATE = ".auth/admin.json";
const UI_TIMEOUT = 30_000;

interface ReassignmentE2eScenarioIds {
	readonly currentBrokerId: Id<"brokers">;
	readonly currentOrgId: string;
	readonly currentPortalHost: string;
	readonly currentPortalId: Id<"portals">;
	readonly currentUserId: Id<"users">;
	readonly lenderId: Id<"lenders">;
	readonly lenderUserId: Id<"users">;
	readonly organizationId: Id<"organizations">;
	readonly targetBrokerId: Id<"brokers">;
	readonly targetBrokerName: string;
	readonly targetPortalHost: string;
	readonly targetUserId: Id<"users">;
}

type ReassignmentE2eCleanupArgs = Pick<
	ReassignmentE2eScenarioIds,
	| "currentBrokerId"
	| "currentPortalId"
	| "currentUserId"
	| "lenderId"
	| "lenderUserId"
	| "organizationId"
	| "targetBrokerId"
	| "targetUserId"
>;

const seedExternalToFairLendPreviewScenarioRef = makeFunctionReference<
	"mutation",
	{ suffix: string },
	ReassignmentE2eScenarioIds
>("test/adminLenderReassignmentE2e:seedExternalToFairLendPreviewScenario");

const cleanupPreviewScenarioRef = makeFunctionReference<
	"mutation",
	ReassignmentE2eCleanupArgs,
	{ ok: true }
>("test/adminLenderReassignmentE2e:cleanupPreviewScenario");

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

function getE2EPort() {
	return Number(process.env.E2E_PORT ?? 3000);
}

function fairLendAppUrl(pathname: string) {
	return `http://app.localhost:${getE2EPort()}${pathname}`;
}

async function readE2eAccessToken(page: Page) {
	await page.goto(fairLendAppUrl("/e2e/session"));
	await expect(page.locator('[data-testid="session-json"]')).toBeVisible({
		timeout: UI_TIMEOUT,
	});

	const sessionJson = await page
		.locator('[data-testid="session-json"]')
		.textContent();
	if (!sessionJson) {
		throw new Error("E2E session route did not render session JSON");
	}

	const session = JSON.parse(sessionJson) as {
		accessToken?: string | null;
		error?: string;
	};
	if (session.error) {
		throw new Error(`E2E session bootstrap failed: ${session.error}`);
	}
	if (!session.accessToken) {
		throw new Error("E2E session route did not expose an access token");
	}

	return session.accessToken;
}

async function createAdminConvexClient(page: Page) {
	const convex = new ConvexHttpClient(requireEnv("VITE_CONVEX_URL"));
	convex.setAuth(await readE2eAccessToken(page));
	return convex;
}

test.describe("admin lender broker reassignment", () => {
	test.setTimeout(120_000);

	let scenario: ReassignmentE2eScenarioIds | null = null;
	let accessToken: string | null = null;

	test.beforeEach(async ({ page }) => {
		scenario = null;
		accessToken = null;
		await createAuthStorageState({
			entryHref: fairLendAppUrl(
				`/sign-in?redirect=${encodeURIComponent("/admin?detailOpen=false")}`
			),
			orgId: TEST_ADMIN_ORG_ID,
			page,
			path: ADMIN_STORAGE_STATE,
		});

		const convex = await createAdminConvexClient(page);
		accessToken = await readE2eAccessToken(page);
		scenario = await convex.mutation(seedExternalToFairLendPreviewScenarioRef, {
			suffix: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
		});
	});

	test.afterEach(async () => {
		if (!(scenario && accessToken)) {
			return;
		}

		const convex = new ConvexHttpClient(requireEnv("VITE_CONVEX_URL"));
		convex.setAuth(accessToken);
		await convex.mutation(cleanupPreviewScenarioRef, {
			currentBrokerId: scenario.currentBrokerId,
			currentPortalId: scenario.currentPortalId,
			currentUserId: scenario.currentUserId,
			lenderId: scenario.lenderId,
			lenderUserId: scenario.lenderUserId,
			organizationId: scenario.organizationId,
			targetBrokerId: scenario.targetBrokerId,
			targetUserId: scenario.targetUserId,
		});
		scenario = null;
		accessToken = null;
	});

	test("previews an external-to-FairLend portal transition to the global app portal", async ({
		page,
	}) => {
		if (!scenario) {
			throw new Error("Reassignment e2e scenario was not seeded");
		}

		await page.goto(
			fairLendAppUrl(`/admin/lenders/${String(scenario.lenderId)}`)
		);
		await expect(
			page.getByRole("button", { name: "Change broker" })
		).toBeVisible({ timeout: UI_TIMEOUT });
		await page.getByRole("button", { name: "Change broker" }).click();

		const dialog = page.getByRole("dialog", { name: "Change broker" });
		await expect(dialog).toBeVisible({ timeout: UI_TIMEOUT });
		await dialog.getByLabel("Search active brokers").fill(scenario.targetBrokerName);
		await dialog
			.getByRole("button", { name: new RegExp(scenario.targetBrokerName) })
			.click();

		await expect(dialog.getByText(scenario.currentPortalHost)).toBeVisible({
			timeout: UI_TIMEOUT,
		});
		await expect(dialog.getByText(scenario.targetPortalHost)).toBeVisible();
		await expect(dialog.getByText("Portal host changes")).toBeVisible();
		await expect(
			dialog.getByText("Add lender role in target WorkOS org")
		).toBeVisible();
		await expect(
			dialog.getByText("Remove lender role from current WorkOS org")
		).toBeVisible();
		await expect(
			dialog.getByRole("button", { name: "Confirm reassignment" })
		).toBeEnabled();
	});
});
