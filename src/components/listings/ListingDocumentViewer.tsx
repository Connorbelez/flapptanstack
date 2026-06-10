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

function isImageContentType(contentType: string | null | undefined) {
	return contentType?.toLowerCase().startsWith("image/") ?? false;
}

function isUnsupportedKnownContentType(contentType: string | null | undefined) {
	if (!contentType) {
		return false;
	}

	const normalized = contentType.toLowerCase();
	return !(normalized.includes("pdf") || normalized.startsWith("image/"));
}

function BrowserDocumentPreview({
	document,
	mobile,
}: {
	document: ListingDocumentItem;
	mobile: boolean;
}) {
	if (!document.url) {
		return null;
	}

	const previewLabel = `${document.label} preview`;

	return (
		<div
			className={cn(
				"flex h-full min-h-[520px] flex-col overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-sm dark:border-border/55 dark:bg-[#111715]",
				mobile && "min-h-[320px]"
			)}
		>
			<div className="flex items-start justify-between gap-3 border-border/70 border-b bg-background/65 px-4 py-3 backdrop-blur-sm dark:border-border/45 dark:bg-white/[0.035]">
				<div className="min-w-0">
					<p className="truncate font-semibold text-[18px] leading-tight">
						{document.label}
					</p>
					<p className="mt-1 truncate text-muted-foreground text-sm">
						{document.meta}
					</p>
				</div>
				<Button asChild size="sm" type="button" variant="outline">
					<a href={document.url} rel="noreferrer" target="_blank">
						<ExternalLink className="mr-2 size-4" />
						Open document
					</a>
				</Button>
			</div>
			<div className="min-h-0 flex-1 overflow-auto bg-background/70 dark:bg-[#0B1110]">
				{isImageContentType(document.contentType) ? (
					<div className="flex min-h-full items-start justify-center p-4">
						<img
							alt={previewLabel}
							className="max-h-none max-w-full rounded-lg border border-border/40 bg-white object-contain shadow-sm dark:border-white/10"
							height={1600}
							src={document.url}
							width={1200}
						/>
					</div>
				) : (
					<iframe
						className="h-full min-h-[520px] w-full border-0 bg-white dark:bg-white"
						src={document.url}
						title={previewLabel}
					/>
				)}
			</div>
		</div>
	);
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
					"flex h-full flex-col items-center justify-center rounded-xl border border-border/80 border-dashed bg-card px-6 py-8 text-center text-card-foreground dark:border-border/55 dark:bg-[#111715]",
					mobile && "min-h-[220px] px-5 py-6"
				)}
			>
				<FileText className="size-8 text-muted-foreground" />
				<p className="mt-4 font-medium text-sm">
					No public documents are available for this listing.
				</p>
				<p className="mt-2 max-w-[26rem] text-muted-foreground text-sm leading-6">
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

	if (document.url && !isUnsupportedKnownContentType(document.contentType)) {
		return <BrowserDocumentPreview document={document} mobile={mobile} />;
	}

	return (
		<div
			className={cn(
				"flex h-full flex-col justify-center rounded-xl border border-border/80 bg-card px-6 py-6 text-card-foreground shadow-sm dark:border-border/55 dark:bg-[#111715]",
				mobile && "min-h-[220px] px-5 py-5"
			)}
		>
			<div className="flex items-center gap-3">
				<div className="flex size-11 items-center justify-center rounded-full bg-background text-muted-foreground dark:bg-white/[0.06]">
					<File className="size-5" />
				</div>
				<div className="min-w-0">
					<p className="truncate font-semibold text-[18px] leading-tight">
						{document.label}
					</p>
					<p className="mt-1 truncate text-muted-foreground text-sm">
						{document.meta}
					</p>
				</div>
			</div>

			<p className="mt-5 text-foreground/80 text-sm leading-6">
				{document.description ??
					"This document is publicly available, but inline rendering is not enabled for its file type in this surface."}
			</p>

			<div className="mt-5 flex flex-wrap gap-2 text-muted-foreground text-xs">
				{document.fileName ? (
					<span className="rounded-full bg-background px-3 py-1 dark:bg-white/[0.06]">
						{document.fileName}
					</span>
				) : null}
				{document.contentType ? (
					<span className="rounded-full bg-background px-3 py-1 dark:bg-white/[0.06]">
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
