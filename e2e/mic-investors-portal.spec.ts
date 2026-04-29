import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
	expect,
	test,
	type Browser,
	type BrowserContext,
	type Page,
} from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import {
	createAuthStorageState,
	TEST_ADMIN_ORG_ID,
} from "./helpers/auth-storage";
import {
	buildHostAwareSignInHref,
	buildLocalOrigin,
	getE2EPort,
} from "./helpers/host-aware-auth";

test.describe.configure({ mode: "serial" });
test.use({ storageState: { cookies: [], origins: [] } });

const authStateDir = join(process.cwd(), ".tmp", "auth", "mic-portal");
const micLocalHost = `mic.localhost:${getE2EPort()}`;
const micOrigin = buildLocalOrigin(micLocalHost);
const appLocalHost = `app.localhost:${getE2EPort()}`;
const appOrigin = buildLocalOrigin(appLocalHost);

type MicScenario = Awaited<
	ReturnType<typeof bootstrapMicPortalScenario>
>;

let adminStorageState: string;
let convex: ConvexHttpClient;
let scenario: MicScenario;

function requireEnv(name: string) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

function getBaseURL() {
	const baseURL = test.info().project.use.baseURL;
	if (!baseURL) {
		throw new Error("Playwright baseURL is required for MIC portal e2e tests");
	}
	return baseURL;
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function createScopedStorageState(
	browser: Browser,
	args: {
		entryHref: string;
		orgId: string;
	}
) {
	await mkdir(authStateDir, { recursive: true });

	const context = await browser.newContext({ baseURL: getBaseURL() });
	const page = await context.newPage();
	const storageStatePath = join(authStateDir, `storage-${randomUUID()}.json`);

	try {
		await createAuthStorageState({
			entryHref: args.entryHref,
			orgId: args.orgId,
			page,
			path: storageStatePath,
		});
		return storageStatePath;
	} catch (error) {
		await rm(storageStatePath, { force: true });
		throw error;
	} finally {
		await context.close();
	}
}

async function openContextFromStorage(
	browser: Browser,
	storageState: string
): Promise<{ context: BrowserContext; page: Page }> {
	const context = await browser.newContext({
		baseURL: getBaseURL(),
		storageState,
	});
	const page = await context.newPage();
	return { context, page };
}

async function readAccessToken(page: Page, origin: string) {
	await page.goto(`${origin}/e2e/session`);
	await expect(page.locator('[data-testid="session-json"]')).toBeVisible({
		timeout: 15_000,
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

function createE2eClient(accessToken: string) {
	const client = new ConvexHttpClient(requireEnv("VITE_CONVEX_URL"));
	client.setAuth(accessToken);
	return client;
}

async function bootstrapMicPortalScenario(client: ConvexHttpClient) {
	return await client.mutation(api.test.micPortalE2e.bootstrapMicPortalScenario, {
		localHost: micLocalHost,
		productionHost: "mic-e2e.fairlend.test",
	});
}

test.beforeAll(async ({ browser }) => {
	test.setTimeout(120_000);

	const appAdminStorageState = await createScopedStorageState(browser, {
		entryHref: buildHostAwareSignInHref(appLocalHost, "/demo/workos"),
		orgId: TEST_ADMIN_ORG_ID,
	});
	const { context, page } = await openContextFromStorage(
		browser,
		appAdminStorageState
	);

	try {
		const accessToken = await readAccessToken(page, appOrigin);
		convex = createE2eClient(accessToken);
		scenario = await bootstrapMicPortalScenario(convex);
	} finally {
		await context.close();
	}

	adminStorageState = appAdminStorageState;
});

test.afterAll(async () => {
	if (adminStorageState) {
		await rm(adminStorageState, { force: true });
	}
});

test("public MIC landing accepts offering memorandum requests without leaking request state", async ({
	page,
}) => {
	const requestEmail = `mic-e2e-${randomUUID()}@example.com`;

	await page.goto(`${micOrigin}/`);

	await expect(
		page.getByRole("heading", { name: "MIC Investors Portal" })
	).toBeVisible({ timeout: 15_000 });
	await expect(
		page.getByText("Transparent portfolio reporting")
	).toBeVisible();
	await expect(
		page.getByLabel("Request offering memorandum / prospectus")
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Sign in to the portal" })
	).toBeVisible();
	await expect(page.getByText("Portal ID:")).toHaveCount(0);

	await page
		.getByLabel("Request offering memorandum / prospectus")
		.fill(requestEmail);
	await page.getByRole("button", { name: "Request access" }).click();

	await expect(
		page.getByText("Request received. We will follow up by email after review.")
	).toBeVisible({ timeout: 15_000 });
	await expect
		.poll(async () => {
			const request = await convex.query(api.test.micPortalE2e.getRequestByEmail, {
				email: requestEmail,
				portalId: scenario.portalId as Id<"portals">,
			});
			return request?.status ?? null;
		})
		.toBe("pending_review");
});

test("authenticated MIC portal shows ledger-backed read-only portfolio and mortgage detail", async ({
	browser,
}) => {
	const { context, page } = await openContextFromStorage(
		browser,
		adminStorageState
	);

	try {
		await page.goto(`${micOrigin}/portal`);

		await expect(page.getByTestId("mic-portfolio-page")).toBeVisible({
			timeout: 20_000,
		});
		await expect(
			page.getByRole("heading", { name: "FairLend MIC" })
		).toBeVisible();
		await expect(
			page.getByText("Current system truth only").first()
		).toBeVisible();
		await expect(page.getByText("Portfolio ledger")).toBeVisible();

		const row = page.getByTestId(
			`mic-position-row-${scenario.mortgageId}`
		);
		await expect(row).toContainText(scenario.propertyLabel);
		await expect(row).toContainText("Toronto, ON");

		await row.click();
		const detailPanel = page.getByTestId("mic-mortgage-detail-panel");
		await expect(detailPanel).toBeVisible({ timeout: 15_000 });
		await expect(detailPanel).toContainText(scenario.propertyLabel, {
			timeout: 15_000,
		});
		await expect(detailPanel).toContainText("Read-only operational transparency");

		await page
			.getByRole("button", { name: "Open full mortgage detail" })
			.click();
		await expect(page).toHaveURL(
			new RegExp(`/portal/mortgages/${escapeRegExp(scenario.mortgageId)}`)
		);
		await expect(page.getByTestId("mic-mortgage-detail-page")).toBeVisible({
			timeout: 15_000,
		});
		await expect(
			page.getByRole("heading", { name: scenario.propertyLabel })
		).toBeVisible();
		await expect(page.getByText("Disclosures")).toBeVisible();
	} finally {
		await context.close();
	}
});
