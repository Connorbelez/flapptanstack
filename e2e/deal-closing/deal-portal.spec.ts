import { expect, type Page, test } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { readE2eAccessToken } from "../helpers/origination";

const e2ePort = Number(process.env.E2E_PORT ?? 3000);
const appBaseUrl = `http://app.localhost:${e2ePort}`;

test.use({
	baseURL: appBaseUrl,
	storageState: ".auth/host-aware-app-admin.json",
});

type Scenario = FunctionReturnType<
	typeof api.test.lawyerWorkspaceE2e.seedLawyerWorkspaceScenario
>;

function requireEnv(name: string) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

async function createAuthedConvexClient(page: Page) {
	const accessToken = await readE2eAccessToken(page);
	const convex = new ConvexHttpClient(requireEnv("VITE_CONVEX_URL"));
	convex.setAuth(accessToken);
	return convex;
}

test("confirms representation, signs, uploads proof, approves, and completes", async ({
	page,
}) => {
	const convex = await createAuthedConvexClient(page);
	let scenario: Scenario | null = null;

	try {
		scenario = await convex.mutation(
			api.test.lawyerWorkspaceE2e.seedLawyerWorkspaceScenario,
			{}
		);
		const dealId = scenario.representation.dealId;

		await page.goto(`/deals/${dealId}`);
		await expect(
			page.getByRole("heading", { name: /legal representation/i })
		).toBeVisible({ timeout: 15_000 });
		await page.getByLabel(/reason/i).fill("E2E external retainer evidence");
		await page
			.getByLabel(/evidence note/i)
			.fill("E2E verified lawyer representation");
		await page.getByRole("button", { name: /^confirm representation$/i }).click();

		await expect(
			page.getByRole("heading", { name: /document signing/i })
		).toBeVisible({ timeout: 15_000 });
		await convex.mutation(api.test.dealPortalE2e.completeSigningForDeal, {
			dealId,
		});

		await page.goto(`/deals/${dealId}`);
		await expect(
			page.getByRole("heading", { name: /payment confirmation/i })
		).toBeVisible({ timeout: 15_000 });

		await page.getByLabel(/amount/i).fill("125000");
		await page.getByLabel(/transfer date/i).fill("2026-05-01");
		await page.getByLabel(/sending party/i).fill("Lender legal trust");
		await page.getByLabel(/reference number/i).fill("WIRE-E2E");
		await page.setInputFiles('input[type="file"]', {
			buffer: Buffer.from("%PDF-1.4\n%wire proof\n"),
			mimeType: "application/pdf",
			name: "wire-proof.pdf",
		});
		await page.getByRole("button", { name: /upload proof/i }).click();
		await expect(page.getByText(/pending review/i)).toBeVisible({
			timeout: 15_000,
		});

		await page.getByRole("button", { name: /approve proof/i }).click();
		await expect(
			page.getByRole("heading", { name: /deal complete/i })
		).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText(/funds evidence/i)).toBeVisible();
		await expect(page.getByText(/governed transition/i)).toBeVisible();
	} finally {
		if (scenario) {
			await convex.mutation(
				api.test.lawyerWorkspaceE2e.cleanupLawyerWorkspaceScenario,
				{ scenario }
			);
		}
	}
});
