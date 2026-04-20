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
import {
	createAuthStorageState,
	TEST_ADMIN_ORG_ID,
	TEST_MEMBER_ORG_ID,
} from "../helpers/auth-storage";
import {
	buildHostAwareSignInHref,
	buildLocalOrigin,
	getAppLocalHost,
} from "../helpers/host-aware-auth";

test.describe.configure({ mode: "serial" });
test.use({ storageState: { cookies: [], origins: [] } });

const testAccountEmail = process.env.TEST_ACCOUNT_EMAIL;
if (!testAccountEmail) {
	throw new Error("TEST_ACCOUNT_EMAIL environment variable is required for e2e tests");
}

const hostAwareAuthStateDir = join(process.cwd(), ".tmp", "auth", "host-aware");

interface SessionSnapshot {
	tokenOrganizationId?: string | null;
	viewerHomePortal?: {
		homePortal: null | {
			localHost: string;
			portalType: "broker" | "fairlend";
			slug: string;
		};
		homePortalId: string | null;
		isFairLendAdmin: boolean;
		userId: string | null;
	} | null;
	viewerHomePortalError?: string | null;
}

function getProfileEmailCard(page: Page) {
	const profileTabPanel = page.getByRole("tabpanel", { name: /profile/i });
	return profileTabPanel
		.getByText("Email", { exact: true })
		.locator("xpath=..");
}

function getBaseURL(): string {
	const baseURL = test.info().project.use.baseURL;
	if (!baseURL) {
		throw new Error("Playwright baseURL is required for host-aware auth tests");
	}
	return baseURL;
}

async function createScopedStorageState(
	browser: Browser,
	args: {
		entryHref?: string;
		orgId?: string;
	}
) {
	await mkdir(hostAwareAuthStateDir, { recursive: true });

	const bootstrapContext = await browser.newContext({ baseURL: getBaseURL() });
	const bootstrapPage = await bootstrapContext.newPage();
	const storageStatePath = join(
		hostAwareAuthStateDir,
		`storage-${randomUUID()}.json`
	);

	try {
		await createAuthStorageState({
			entryHref: args.entryHref,
			orgId: args.orgId,
			page: bootstrapPage,
			path: storageStatePath,
		});

		return storageStatePath;
	} catch (error) {
		await rm(storageStatePath, { force: true });
		throw error;
	} finally {
		await bootstrapContext.close();
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

async function readSessionSnapshot(page: Page, origin?: string) {
	await page.goto(origin ? `${origin}/e2e/session` : "/e2e/session");
	await expect(page.locator('[data-testid="session-json"]')).toBeVisible({
		timeout: 15_000,
	});
	const sessionJson = await page
		.locator('[data-testid="session-json"]')
		.textContent();
	if (!sessionJson) {
		throw new Error("E2E session route did not render session JSON");
	}
	return JSON.parse(sessionJson) as SessionSnapshot;
}

async function expectSignedOutRoot(
	page: Page,
	args: {
		expectedHeading: string;
		expectedHost: string;
	}
) {
	await page.waitForURL(
		(url) => url.host === args.expectedHost && url.pathname === "/",
		{ timeout: 30_000 }
	);
	await expect(
		page.getByRole("heading", { name: args.expectedHeading })
	).toBeVisible({ timeout: 15_000 });
	await expect(
		page.getByRole("link", { name: "Sign in", exact: true })
	).toBeVisible();
}

test("app.localhost admin auth stays on app host and signs out back to the app host", async ({
	browser,
}) => {
	const appLocalHost = getAppLocalHost(getBaseURL());
	const appOrigin = buildLocalOrigin(appLocalHost);
	const storageState = await createScopedStorageState(browser, {
		entryHref: buildHostAwareSignInHref(appLocalHost),
		orgId: TEST_ADMIN_ORG_ID,
	});
	const { context, page } = await openContextFromStorage(browser, storageState);

	try {
		const session = await readSessionSnapshot(page, appOrigin);
		expect(session.tokenOrganizationId).toBe(TEST_ADMIN_ORG_ID);
		expect(session.viewerHomePortalError).toBeNull();
		expect(session.viewerHomePortal?.homePortal?.localHost).toBe(appLocalHost);

		await page.goto(`${appOrigin}/demo/workos`);
		await expect(getProfileEmailCard(page)).toContainText(testAccountEmail, {
			timeout: 15_000,
		});

		await page.getByRole("button", { name: /sign out/i }).click();
		await expectSignedOutRoot(page, {
			expectedHeading: "FairLend Portal",
			expectedHost: appLocalHost,
		});
	} finally {
		await context.close();
		await rm(storageState, { force: true });
	}
});

test("member org auth stays on the assigned broker localhost host and signs out back there", async ({
	browser,
}) => {
	const appLocalHost = getAppLocalHost(getBaseURL());
	const discoveryState = await createScopedStorageState(browser, {
		orgId: TEST_MEMBER_ORG_ID,
	});
	const discoverySession = await (async () => {
		const { context, page } = await openContextFromStorage(browser, discoveryState);
		try {
			return await readSessionSnapshot(page);
		} finally {
			await context.close();
			await rm(discoveryState, { force: true });
		}
	})();

	expect(discoverySession.tokenOrganizationId).toBe(TEST_MEMBER_ORG_ID);
	expect(discoverySession.viewerHomePortalError).toBeNull();
	expect(discoverySession.viewerHomePortal?.homePortal?.portalType).toBe("broker");

	const assignedPortal = discoverySession.viewerHomePortal?.homePortal;
	if (!(assignedPortal && assignedPortal.localHost)) {
		throw new Error("Expected member org to resolve to a broker localhost portal");
	}
	expect(assignedPortal.localHost).not.toBe(appLocalHost);

	const brokerOrigin = buildLocalOrigin(assignedPortal.localHost);
	const brokerStorage = await createScopedStorageState(browser, {
		entryHref: buildHostAwareSignInHref(assignedPortal.localHost),
		orgId: TEST_MEMBER_ORG_ID,
	});
	const { context, page } = await openContextFromStorage(browser, brokerStorage);

	try {
		const session = await readSessionSnapshot(page, brokerOrigin);
		expect(session.tokenOrganizationId).toBe(TEST_MEMBER_ORG_ID);
		expect(session.viewerHomePortalError).toBeNull();
		expect(session.viewerHomePortal?.homePortal?.localHost).toBe(
			assignedPortal.localHost
		);
		expect(session.viewerHomePortal?.homePortal?.portalType).toBe("broker");

		await page.goto(`${brokerOrigin}/demo/workos`);
		await expect(getProfileEmailCard(page)).toContainText(testAccountEmail, {
			timeout: 15_000,
		});

		await page.getByRole("button", { name: /sign out/i }).click();
		await expectSignedOutRoot(page, {
			expectedHeading: `${assignedPortal.slug} Portal`,
			expectedHost: assignedPortal.localHost,
		});
	} finally {
		await context.close();
		await rm(brokerStorage, { force: true });
	}
});
