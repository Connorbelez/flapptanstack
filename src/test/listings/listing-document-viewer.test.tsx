/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListingDocumentViewer } from "#/components/listings/ListingDocumentViewer";
import type { ListingDocumentItem } from "#/components/listings/listing-detail-types";

vi.mock("react-pdf", () => ({
	Document: () => null,
	Page: () => null,
	pdfjs: {
		GlobalWorkerOptions: {},
	},
}));

describe("listing document viewer", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"ResizeObserver",
			class ResizeObserver {
				disconnect() {}
				observe() {}
				unobserve() {}
			}
		);
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it("renders a non-pdf document with an external-open fallback", () => {
		const queryClient = new QueryClient();
		const document: ListingDocumentItem = {
			assetId: "asset-term-sheet",
			contentType:
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			description: "Investor-facing term sheet.",
			fileName: "term-sheet.docx",
			id: "asset-term-sheet",
			kind: "other",
			label: "Term Sheet",
			meta: "Term Sheet",
			url: "https://example.com/term-sheet.docx",
		};

		render(
			<QueryClientProvider client={queryClient}>
				<ListingDocumentViewer
					document={document}
					listingId="listing_1"
					mobile
				/>
			</QueryClientProvider>
		);

		expect(screen.getByText("Investor-facing term sheet.")).toBeTruthy();
		expect(
			screen
				.getByRole("link", { name: "Open document in a new tab" })
				.getAttribute("href")
		).toBe("https://example.com/term-sheet.docx");
	});

});
