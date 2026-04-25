/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ListingDocumentItem } from "#/components/listings/listing-detail-types";
import { ListingDocumentViewer } from "#/components/listings/ListingDocumentViewer";

vi.mock("#/components/listings/ListingPdfViewer", () => ({
	ListingPdfViewer: ({
		document,
		listingId,
		mobile,
	}: {
		document: ListingDocumentItem;
		listingId: string;
		mobile?: boolean;
	}) => (
		<div
			data-listing-id={listingId}
			data-mobile={String(mobile ?? false)}
			data-testid="listing-pdf-viewer"
		>
			{document.label}
		</div>
	),
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

	it("routes pdf documents to the inline pdf viewer", () => {
		const queryClient = new QueryClient();
		const document: ListingDocumentItem = {
			assetId: "asset-appraisal",
			contentType: "application/pdf",
			description: "Certified appraisal package.",
			fileName: "appraisal-report.pdf",
			id: "asset-appraisal",
			kind: "pdf",
			label: "Appraisal Report",
			meta: "Appraisal Report",
			url: "https://example.com/appraisal-report.pdf",
		};

		render(
			<QueryClientProvider client={queryClient}>
				<ListingDocumentViewer document={document} listingId="listing_1" />
			</QueryClientProvider>
		);

		const viewer = screen.getByTestId("listing-pdf-viewer");
		expect(viewer.textContent).toBe("Appraisal Report");
		expect(viewer.getAttribute("data-listing-id")).toBe("listing_1");
	});
});
