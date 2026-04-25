import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import type { Page } from "@playwright/test";
import { loginViaWorkOS } from "./workos-login";

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

const testAccountEmail = requireEnv("TEST_ACCOUNT_EMAIL");
const testAccountPassword = requireEnv("TEST_ACCOUNT_PW");

export const TEST_ADMIN_ORG_ID = requireEnv("TEST_ADMIN_ORG");
export const TEST_MEMBER_ORG_ID = requireEnv("TEST_MEMBER_ORG");

function buildSameOriginUrl(currentUrl: string, pathname: string) {
	const url = new URL(currentUrl);
	url.pathname = pathname;
	url.search = "";
	url.hash = "";
	return url;
}

function buildE2eUtilityUrl(currentUrl: string, pathname: string) {
	const url = buildSameOriginUrl(currentUrl, pathname);
	if (url.hostname.startsWith("mock-")) {
		url.hostname = "localhost";
	}
	return url;
}

export async function createAuthStorageState(args: {
	entryHref?: string;
	expectedRole?: string;
	orgId?: string;
	page: Page;
	path: string;
}) {
	await loginViaWorkOS(args.page, testAccountEmail, testAccountPassword, {
		entryHref: args.entryHref,
	});

	if (args.orgId) {
		const switchOrgUrl = buildSameOriginUrl(args.page.url(), "/e2e/switch-org");
		switchOrgUrl.searchParams.set("orgId", args.orgId);
		await args.page.goto(switchOrgUrl.toString());
		await args.page.waitForURL(
			(url) =>
				url.origin === switchOrgUrl.origin &&
				url.pathname === "/",
			{ timeout: 15_000 }
		);

		const expectedRole =
			args.expectedRole ??
			(args.orgId === TEST_MEMBER_ORG_ID ? "member" : "admin");

		// Force the auth client to settle on the switched organization before
		// persisting the browser state. Use a dedicated e2e route so setup does
		// not depend on demo page tabs or layout structure.
		await args.page.goto(buildE2eUtilityUrl(args.page.url(), "/e2e/session").toString());
		try {
			await args.page.waitForFunction(
				([expectedOrgId, expectedSessionRole]) => {
					const el = document.querySelector('[data-testid="session-json"]');
					if (!el?.textContent) {
						return false;
					}

					try {
						const session = JSON.parse(el.textContent) as {
							tokenOrganizationId?: string | null;
							tokenRole?: string | null;
							error?: string;
						};
						if (session.error) {
							return true;
						}
						return (
							session.tokenOrganizationId === expectedOrgId &&
							session.tokenRole === expectedSessionRole
						);
					} catch {
						return false;
					}
				},
				[args.orgId, expectedRole],
				{ timeout: 15_000 }
			);
		} catch (error) {
			const sessionJson = await args.page
				.locator('[data-testid="session-json"]')
				.textContent()
				.catch(() => null);
			const message =
				error instanceof Error ? error.message : "unknown_wait_for_function_error";
			throw new Error(
				`E2E session bootstrap did not settle for org ${args.orgId} with expected role ${expectedRole}. url=${args.page.url()} session=${sessionJson ?? "<missing>"} cause=${message}`
			);
		}

		const sessionJson = await args.page
			.locator('[data-testid="session-json"]')
			.textContent();
		if (!sessionJson) {
			throw new Error("E2E session bootstrap did not render session JSON");
		}

		const session = JSON.parse(sessionJson) as {
			error?: string;
			tokenOrganizationId?: string | null;
			tokenRole?: string | null;
		};
		if (session.error) {
			throw new Error(
				`E2E session bootstrap failed: ${session.error} for org ${args.orgId}`
			);
		}
	}

	mkdirSync(dirname(args.path), { recursive: true });

	const tempPath = `${args.path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
	await args.page.context().storageState({ path: tempPath });

	try {
		renameSync(tempPath, args.path);
	} catch (error) {
		const err = error as NodeJS.ErrnoException;
		rmSync(tempPath, { force: true });

		if ((err.code === "EEXIST" || err.code === "EPERM") && existsSync(args.path)) {
			return;
		}

		throw error;
	}
}
