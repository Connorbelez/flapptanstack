import { expect, type Page, test } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

const e2ePort = Number(process.env.E2E_PORT ?? 3000);
const appBaseUrl = `http://app.localhost:${e2ePort}`;

test.use({
	baseURL: appBaseUrl,
	storageState: ".auth/host-aware-app-admin.json",
});

type LawyerWorkspaceScenario = FunctionReturnType<
	typeof api.test.lawyerWorkspaceE2e.seedLawyerWorkspaceScenario
>;

function requireEnv(name: string) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

async function readLawyerE2eAccessToken(page: Page) {
	await page.goto("/e2e/session");
	await page.waitForFunction(
		() => document.body.textContent?.includes('"accessToken"') ?? false,
		undefined,
		{ timeout: 15_000 }
	);

	const sessionJson = await page.evaluate(() => {
		const explicitSession = document.querySelector(
			'[data-testid="session-json"]'
		);
		if (explicitSession?.textContent) {
			return explicitSession.textContent;
		}

		const bodyText = document.body.textContent ?? "";
		const jsonStart = bodyText.indexOf('{"accessToken"');
		return jsonStart >= 0 ? bodyText.slice(jsonStart) : "";
	});
	if (!sessionJson) {
		throw new Error("E2E session route did not expose session JSON");
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

async function createAuthedConvexClient(page: Page) {
	const accessToken = await readLawyerE2eAccessToken(page);
	const convex = new ConvexHttpClient(requireEnv("VITE_CONVEX_URL"));
	convex.setAuth(accessToken);
	return convex;
}

test("lawyer workspace queue, actions, and completed read-only access", async ({
	page,
}) => {
	const convex = await createAuthedConvexClient(page);
	let scenario: LawyerWorkspaceScenario | null = null;

	try {
		scenario = await convex.mutation(
			api.test.lawyerWorkspaceE2e.seedLawyerWorkspaceScenario,
			{}
		);

		await page.goto("/lawyer");
		await expect(
			page.getByRole("heading", { name: "Assigned Closings" })
		).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText("Needs Representation Confirmation")).toBeVisible();
		await expect(page.getByText("Needs Package Review")).toBeVisible();
		await expect(page.getByText("Completed")).toBeVisible();
		await expect(page.getByText("E2E Representation Buyer")).toBeVisible();
		await expect(page.getByText("E2E Approval Buyer")).toBeVisible();
		await expect(page.getByText("E2E Completed Buyer")).toBeVisible();

		await page.goto(`/lawyer/deals/${scenario.representation.dealId}`);
		await expect(
			page.getByRole("heading", {
				name: /E2E Representation Buyer .* E2E Representation Seller/,
			})
		).toBeVisible({ timeout: 15_000 });
		await page.getByRole("button", { name: "Confirm Representation" }).click();
		await expect(page.getByText("DocumentReview Pending")).toBeVisible({
			timeout: 15_000,
		});

		await page.goto(`/lawyer/deals/${scenario.approval.dealId}`);
		await expect(
			page.getByRole("heading", {
				name: /E2E Approval Buyer .* E2E Approval Seller/,
			})
		).toBeVisible({ timeout: 15_000 });
		await expect(
			page.getByText("E2E Approval Buyer Closing Signature Package")
		).toBeVisible();
		await page
			.getByRole("button", { name: "Approve Package For Signing" })
			.click();
		await expect(page.getByText("DocumentReview Signed")).toBeVisible({
			timeout: 15_000,
		});

		await page.goto(`/lawyer/deals/${scenario.completed.dealId}`);
		await expect(page.getByText("Read-only")).toBeVisible({
			timeout: 15_000,
		});
		await expect(
			page.getByRole("button", { name: "Confirm Representation" })
		).toBeDisabled();
		await expect(
			page.getByRole("button", { name: "Approve Package For Signing" })
		).toBeDisabled();
	} finally {
		if (scenario) {
			await convex.mutation(
				api.test.lawyerWorkspaceE2e.cleanupLawyerWorkspaceScenario,
				{ scenario }
			);
		}
	}
});
