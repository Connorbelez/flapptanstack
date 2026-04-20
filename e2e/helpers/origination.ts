import { expect, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
	createOriginationE2eBootstrapState,
	ORIGINATION_BOOTSTRAP_STORAGE_KEY,
} from "../../src/lib/admin-origination-bootstrap";

const ORIGINATION_E2E_BOOTSTRAP_INIT_KEY =
	"origination-e2e-bootstrap-installed";

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

export async function readE2eAccessToken(page: Page) {
	await page.goto("/e2e/session");
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

export async function primeOriginationE2eBootstrap(page: Page) {
	const bootstrapState = createOriginationE2eBootstrapState();
	await page.addInitScript(
		({
			initKey,
			storageKey,
			state,
		}: {
			initKey: string;
			storageKey: string;
			state: ReturnType<typeof createOriginationE2eBootstrapState>;
		}) => {
			if (window.sessionStorage.getItem(initKey) === "true") {
				return;
			}

			window.localStorage.setItem(storageKey, JSON.stringify(state));
			window.sessionStorage.setItem(initKey, "true");
		},
		{
			initKey: ORIGINATION_E2E_BOOTSTRAP_INIT_KEY,
			storageKey: ORIGINATION_BOOTSTRAP_STORAGE_KEY,
			state: bootstrapState,
		}
	);
	return bootstrapState;
}

export function createOriginationE2eClient(accessToken: string) {
	const convex = new ConvexHttpClient(requireEnv("VITE_CONVEX_URL"));
	convex.setAuth(accessToken);

	return {
		cleanupCommittedOrigination(caseId: string) {
			return convex.mutation(
				api.test.originationE2e.cleanupCommittedOrigination,
				{
					caseId: caseId as Id<"adminOriginationCases">,
				}
			);
		},
		ensureOriginationE2eContext() {
			return convex.mutation(
				api.test.originationE2e.ensureOriginationE2eContext,
				{}
			);
		},
	};
}

export function uniqueOriginationValue(prefix: string) {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
