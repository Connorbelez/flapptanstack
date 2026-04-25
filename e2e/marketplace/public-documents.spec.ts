import { expect, type Page, test } from "@playwright/test";

const e2eRoute = "/e2e/marketplace-public-documents";
const testDocumentStorageIds = [
	"kg20r04rzbtawec6vjbjpfd92585fpyt",
	"kg2b1k3egsafmkn1w3tty8qb2d85f65r",
] as const satisfies readonly string[];
const documentLabels = ["E2E Public PDF 1", "E2E Public PDF 2"] as const;
const listingTitle = "E2E Public PDF Listing";

async function openListingDetail(page: Page) {
	await page.goto(e2eRoute);
	await expect(
		page.getByRole("heading", {
			name: "Marketplace public document fixtures",
		})
	).toBeVisible({ timeout: 30_000 });
	await page.getByRole("button", { name: new RegExp(listingTitle) }).click();
	await expect(page.getByRole("heading", { name: listingTitle })).toBeVisible({
		timeout: 30_000,
	});
}

async function expectPdfCanvasRendered(page: Page) {
	await expect
		.poll(async () => await getVisiblePageSummary(page), { timeout: 45_000 })
		.toMatch(/^Page 1 of \d+$/);
	await expect(page.getByText("Inline PDF preview unavailable")).toHaveCount(0);

	await expect
		.poll(
			async () => {
				const dimensions = await getVisiblePdfCanvasDimensions(page);
				return dimensions.width > 100 && dimensions.height > 100;
			},
			{ timeout: 15_000 }
		)
		.toBe(true);

	const dimensions = await getVisiblePdfCanvasDimensions(page);
	expect(dimensions.width).toBeGreaterThan(100);
	expect(dimensions.height).toBeGreaterThan(100);
}

async function getVisiblePdfCanvasDimensions(page: Page) {
	return await page.locator("canvas").evaluateAll((elements) => {
		const isVisibleElement = (element: Element) => {
			const rect = element.getBoundingClientRect();
			const style = window.getComputedStyle(element);
			return (
				rect.width > 0 &&
				rect.height > 0 &&
				style.display !== "none" &&
				style.visibility !== "hidden"
			);
		};
		const visibleCanvas = elements.find(
			(element): element is HTMLCanvasElement =>
				element instanceof HTMLCanvasElement && isVisibleElement(element)
		);
		return {
			height: visibleCanvas?.height ?? 0,
			width: visibleCanvas?.width ?? 0,
		};
	});
}

async function getVisiblePageSummary(page: Page) {
	const summaries = await page
		.getByText(/^Page 1 of \d+$/)
		.evaluateAll((elements) => {
			const isVisibleElement = (element: Element) => {
				const rect = element.getBoundingClientRect();
				const style = window.getComputedStyle(element);
				return (
					rect.width > 0 &&
					rect.height > 0 &&
					style.display !== "none" &&
					style.visibility !== "hidden"
				);
			};
			return elements
				.filter((element) => isVisibleElement(element))
				.map((element) => element.textContent ?? "");
		});
	return summaries[0] ?? "";
}

async function getRenderedPageCount(page: Page) {
	const pageSummary = await getVisiblePageSummary(page);
	const match = pageSummary?.match(/^Page 1 of (?<pageCount>\d+)$/);
	if (!match?.groups?.pageCount) {
		throw new Error(`Unable to parse PDF page summary: ${pageSummary ?? ""}`);
	}
	return Number.parseInt(match.groups.pageCount, 10);
}

async function expectDocumentDownloadIsPdf(page: Page) {
	const href = await page
		.getByRole("link", { name: "Open document" })
		.first()
		.getAttribute("href");
	expect(href).toBeTruthy();

	const response = await page.request.get(href as string);
	expect(response.ok()).toBe(true);
	expect(response.headers()["content-type"] ?? "").toContain("application/pdf");
	const body = await response.body();
	expect(body.byteLength).toBeGreaterThan(100);
	expect(body.subarray(0, 4).toString()).toBe("%PDF");
}

test.describe.serial("marketplace listing public PDF documents", () => {
	test("opens a listing card and renders both supplied public PDFs inline", async ({
		page,
	}) => {
		await openListingDetail(page);

		for (const [index, label] of documentLabels.entries()) {
			await expect(
				page.getByText(testDocumentStorageIds[index]).first()
			).toBeVisible();
			await page.getByRole("button", { name: new RegExp(label) }).first().click();
			await expect(page.getByText(label).first()).toBeVisible();
			await expectPdfCanvasRendered(page);
			await expectDocumentDownloadIsPdf(page);
		}

		const pageCount = await getRenderedPageCount(page);
		const previousPage = page
			.getByRole("button", { name: "Previous page" })
			.first();
		const nextPage = page.getByRole("button", { name: "Next page" }).first();
		await expect(previousPage).toBeDisabled();
		if (pageCount > 1) {
			await expect(nextPage).toBeEnabled();
			await nextPage.click();
			await expect(page.getByText(`Page 2 of ${pageCount}`)).toBeVisible({
				timeout: 15_000,
			});
		} else {
			await expect(nextPage).toBeDisabled();
		}
	});

	test("renders the supplied public PDFs in the mobile listing detail layout", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await openListingDetail(page);
		await page
			.getByRole("button", { name: new RegExp(documentLabels[1]) })
			.first()
			.click();
		await expectPdfCanvasRendered(page);
		await expectDocumentDownloadIsPdf(page);
	});
});
