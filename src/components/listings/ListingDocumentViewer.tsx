"use client";

import { ExternalLink, File, FileText } from "lucide-react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import { ListingPdfViewer } from "./ListingPdfViewer";
import type { ListingDocumentItem } from "./listing-detail-types";

interface ListingDocumentViewerProps {
	document?: ListingDocumentItem;
	listingId: string;
	mobile?: boolean;
}

export function ListingDocumentViewer({
	document,
	listingId,
	mobile = false,
}: ListingDocumentViewerProps) {
	if (!document) {
		return (
			<div
				className={cn(
					"flex h-full flex-col items-center justify-center rounded-xl border border-[#D6D3CC] border-dashed bg-[#FBFAF8] px-6 py-8 text-center",
					mobile && "min-h-[220px] px-5 py-6"
				)}
			>
				<FileText className="size-8 text-[#B0AEA8]" />
				<p className="mt-4 font-medium text-[#5A5956] text-sm">
					No public documents are available for this listing.
				</p>
				<p className="mt-2 max-w-[26rem] text-[#888784] text-sm leading-6">
					Published mortgage documents will appear here when they are attached
					to the listing.
				</p>
			</div>
		);
	}

	if (document.kind === "pdf") {
		return (
			<ListingPdfViewer
				document={document}
				listingId={listingId}
				mobile={mobile}
			/>
		);
	}

	return (
		<div
			className={cn(
				"flex h-full flex-col justify-center rounded-xl border border-[#E7E5E4] bg-[#FBFAF8] px-6 py-6",
				mobile && "min-h-[220px] px-5 py-5"
			)}
		>
			<div className="flex items-center gap-3">
				<div className="flex size-11 items-center justify-center rounded-full bg-white text-[#6B6B68]">
					<File className="size-5" />
				</div>
				<div className="min-w-0">
					<p className="truncate font-semibold text-[18px] leading-tight">
						{document.label}
					</p>
					<p className="mt-1 truncate text-[#737373] text-sm">
						{document.meta}
					</p>
				</div>
			</div>

			<p className="mt-5 text-[#4A4A48] text-sm leading-6">
				{document.description ??
					"This document is publicly available, but inline rendering is not enabled for its file type in this surface."}
			</p>

			<div className="mt-5 flex flex-wrap gap-2 text-[#6B6B68] text-xs">
				{document.fileName ? (
					<span className="rounded-full bg-white px-3 py-1">
						{document.fileName}
					</span>
				) : null}
				{document.contentType ? (
					<span className="rounded-full bg-white px-3 py-1">
						{document.contentType}
					</span>
				) : null}
			</div>

			<div className="mt-6">
				{document.url ? (
					<Button asChild type="button" variant="outline">
						<a href={document.url} rel="noreferrer" target="_blank">
							<ExternalLink className="mr-2 size-4" />
							Open document in a new tab
						</a>
					</Button>
				) : (
					<Button disabled type="button" variant="outline">
						<ExternalLink className="mr-2 size-4" />
						Document access unavailable
					</Button>
				)}
			</div>
		</div>
	);
}
