"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
	type PdfPreviewRefreshResult,
	PdfPreviewViewer,
} from "#/components/shared/PdfPreviewViewer";
import type { ListingDocumentItem } from "./listing-detail-types";
import { listingDocumentAccessQueryOptions } from "./query-options";

interface ListingPdfViewerProps {
	document: ListingDocumentItem;
	listingId: string;
	mobile?: boolean;
}

export function ListingPdfViewer({
	document,
	listingId,
	mobile = false,
}: ListingPdfViewerProps) {
	const queryClient = useQueryClient();

	async function refreshAccess(): Promise<PdfPreviewRefreshResult | null> {
		if (!document.assetId) {
			return null;
		}

		const refreshed = await queryClient.fetchQuery(
			listingDocumentAccessQueryOptions(listingId, document.assetId)
		);

		return {
			fileName: refreshed?.fileName ?? document.fileName ?? null,
			url: refreshed?.url ?? null,
		};
	}

	return (
		<PdfPreviewViewer
			fileName={document.fileName}
			fileUrl={document.url}
			label={document.label}
			meta={document.meta}
			mobile={mobile}
			onRefreshAccess={document.assetId ? refreshAccess : undefined}
		/>
	);
}
