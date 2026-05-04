import { expect, type Page, test } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "../helpers/document-engine";

const DEMO_ROUTE = "/demo/deal-closing-pipeline";
const DEMO_PACKAGE_TITLE = "test full package april30";
const DOCUMENSO_API_BASE_URL =
	process.env.DOCUMENSO_API_BASE_URL ?? "https://app.documenso.com/api/v2";

function getDocumensoApiToken() {
	return process.env.DOCUMENSO_API_TOKEN ?? process.env.DOCUMENSO_API_KEY;
}

async function deleteDocumensoEnvelope(providerEnvelopeId: string) {
	const token = getDocumensoApiToken();
	if (!token) {
		return {
			ok: false,
			providerEnvelopeId,
			status: "missing_credentials",
		};
	}

	try {
		const response = await fetch(
			`${DOCUMENSO_API_BASE_URL.replace(/\/$/, "")}/envelope/delete`,
			{
				body: JSON.stringify({ envelopeId: providerEnvelopeId }),
				headers: {
					Authorization: token,
					"Content-Type": "application/json",
				},
				method: "POST",
			}
		);
		return {
			ok: response.ok,
			providerEnvelopeId,
			status: response.status,
			body: await response.text().catch(() => ""),
		};
	} catch (error) {
		return {
			ok: false,
			providerEnvelopeId,
			status: "request_failed",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function readProviderEnvelopeIds(page: Page) {
	const values = await page.getByTestId("provider-envelope-id").allTextContents();
	return [
		...new Set(
			values
				.map((value) => value.trim())
				.filter((value) => value.length > 0 && value !== "Pending")
		),
	].sort();
}

test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("Demo Deal Closing - Documenso signing", () => {
	test.setTimeout(120_000);

	test.skip(
		!getDocumensoApiToken(),
		"DOCUMENSO_API_TOKEN or DOCUMENSO_API_KEY is required for live Documenso e2e"
	);

	test("regenerates the fixed package and opens embedded signing", async ({
		page,
	}, testInfo) => {
		let providerEnvelopeIds: string[] = [];

		try {
			await page.goto(DEMO_ROUTE);
			await expect(page.getByText(DEMO_PACKAGE_TITLE)).toBeVisible({
				timeout: 20_000,
			});
			const previousEnvelopeIds = await readProviderEnvelopeIds(page);

			await page
				.getByRole("button", { name: /reset and regenerate/i })
				.click();

			const activeEnvelopeId = page
				.getByTestId("active-provider-envelope-id")
				.first();
			await expect(page.getByText("Ready for signature")).toBeVisible({
				timeout: 60_000,
			});
			await page.waitForFunction(
				(previousIds) => {
					const existing = new Set(previousIds);
					const value = document
						.querySelector('[data-testid="active-provider-envelope-id"]')
						?.textContent?.trim();
					return Boolean(
						value &&
							value.length > 0 &&
							value !== "Pending" &&
							!existing.has(value)
					);
				},
				previousEnvelopeIds,
				{ timeout: 60_000 }
			);
			await expect(activeEnvelopeId).not.toHaveText(/^(Pending)?$/, {
				timeout: 60_000,
			});
			providerEnvelopeIds = await readProviderEnvelopeIds(page);

			await testInfo.attach("documenso-envelope-cleanup", {
				body: providerEnvelopeIds.join("\n"),
				contentType: "text/plain",
			});

			const signButton = page
				.getByRole("button", { name: /sign in portal/i })
				.first();
			await expect(signButton).toBeVisible({ timeout: 20_000 });
			await signButton.click();

			await expect(
				page.locator("iframe").or(page.getByText(/sign document/i)).first()
			).toBeVisible({
				timeout: 30_000,
			});
		} finally {
			const finalProviderEnvelopeIds = await readProviderEnvelopeIds(page).catch(
				() => []
			);
			providerEnvelopeIds = [
				...new Set([...providerEnvelopeIds, ...finalProviderEnvelopeIds]),
			].sort();
			const cleanupResults = [];
			for (const providerEnvelopeId of providerEnvelopeIds) {
				cleanupResults.push(await deleteDocumensoEnvelope(providerEnvelopeId));
			}
			if (cleanupResults.length > 0) {
				await testInfo.attach("documenso-envelope-cleanup-results", {
					body: JSON.stringify(cleanupResults, null, 2),
					contentType: "application/json",
				});
			}
		}
	});
});
