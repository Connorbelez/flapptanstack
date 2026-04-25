"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	Loader2,
	RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import type { ListingDocumentItem } from "./listing-detail-types";
import { listingDocumentAccessQueryOptions } from "./query-options";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url
).toString();

type PdfViewerPhase = "error" | "loading" | "ready" | "stale-url-retrying";

interface ListingPdfViewerProps {
	document: ListingDocumentItem;
	listingId: string;
	mobile?: boolean;
}

function toErrorMessage(error: unknown) {
	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message;
	}

	return "We couldn't load this PDF preview.";
}

function PdfViewerHeader({
	fileUrl,
	label,
	meta,
	mobile,
}: {
	fileUrl: string | null;
	label: string;
	meta: string;
	mobile: boolean;
}) {
	return (
		<div
			className={cn(
				"flex items-start justify-between gap-3 border-[#EFEDE8] border-b px-4 py-3",
				mobile && "border-b-0 px-0 pt-0 pb-3"
			)}
		>
			<div className="min-w-0">
				<p className="truncate font-semibold text-[18px] leading-tight">
					{label}
				</p>
				<p className="mt-1 truncate text-[#737373] text-sm">{meta}</p>
			</div>
			{fileUrl ? (
				<Button asChild size="sm" type="button" variant="outline">
					<a href={fileUrl} rel="noreferrer" target="_blank">
						<ExternalLink className="mr-2 size-4" />
						Open document
					</a>
				</Button>
			) : null}
		</div>
	);
}

function PdfViewerControls({
	canGoToNextPage,
	canGoToPreviousPage,
	fileName,
	mobile,
	onNextPage,
	onPreviousPage,
	pageCount,
	pageNumber,
	phase,
}: {
	canGoToNextPage: boolean;
	canGoToPreviousPage: boolean;
	fileName: string | null;
	mobile: boolean;
	onNextPage: () => void;
	onPreviousPage: () => void;
	pageCount: number | null;
	pageNumber: number;
	phase: PdfViewerPhase;
}) {
	return (
		<div
			className={cn(
				"flex items-center justify-between gap-3 px-4 py-3",
				mobile && "px-0 pt-0 pb-3"
			)}
		>
			<div className="flex items-center gap-2">
				<Button
					disabled={!canGoToPreviousPage || phase === "stale-url-retrying"}
					onClick={onPreviousPage}
					size="icon"
					type="button"
					variant="outline"
				>
					<ChevronLeft className="size-4" />
					<span className="sr-only">Previous page</span>
				</Button>
				<div className="min-w-[112px] text-center font-medium text-sm">
					{pageCount !== null
						? `Page ${pageNumber} of ${pageCount}`
						: "Loading pages"}
				</div>
				<Button
					disabled={!canGoToNextPage || phase === "stale-url-retrying"}
					onClick={onNextPage}
					size="icon"
					type="button"
					variant="outline"
				>
					<ChevronRight className="size-4" />
					<span className="sr-only">Next page</span>
				</Button>
			</div>
			<div className="max-w-[14rem] truncate text-[#6B6B68] text-xs">
				{phase === "stale-url-retrying"
					? "Refreshing document access"
					: (fileName ?? "PDF document")}
			</div>
		</div>
	);
}

function PdfViewerLoadingOverlay({ phase }: { phase: PdfViewerPhase }) {
	if (phase === "ready") {
		return null;
	}

	return (
		<div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#FBFAF8]/80 px-6 text-center">
			<Loader2 className="size-6 animate-spin text-[#6B6B68]" />
			<p className="mt-3 font-medium text-[#5A5956] text-sm">
				{phase === "stale-url-retrying"
					? "Refreshing document access"
					: "Rendering inline preview"}
			</p>
			<p className="mt-2 max-w-[24rem] text-[#888784] text-sm leading-6">
				{phase === "stale-url-retrying"
					? "The signed URL expired, so we're fetching a fresh one before retrying."
					: "Large PDFs can take a moment to render, especially on mobile devices."}
			</p>
		</div>
	);
}

function PdfViewerErrorState({
	errorMessage,
	fileUrl,
	mobile,
	onRetry,
}: {
	errorMessage: string | null;
	fileUrl: string | null;
	mobile: boolean;
	onRetry: () => void;
}) {
	return (
		<div
			className={cn(
				"flex h-full flex-col items-center justify-center rounded-xl border border-[#E7E5E4] bg-[#FBFAF8] px-6 py-8 text-center",
				mobile && "min-h-[320px] px-5 py-6"
			)}
		>
			<div className="flex size-12 items-center justify-center rounded-full bg-white text-[#B42318]">
				<AlertCircle className="size-5" />
			</div>
			<p className="mt-4 font-medium text-[#5A5956] text-sm">
				Inline PDF preview unavailable
			</p>
			<p className="mt-2 max-w-[28rem] text-[#737373] text-sm leading-6">
				{errorMessage ??
					"We couldn't render this PDF in place after refreshing document access."}
			</p>
			<div className="mt-5 flex flex-wrap items-center justify-center gap-2">
				<Button onClick={onRetry} type="button" variant="outline">
					<RefreshCw className="mr-2 size-4" />
					Retry preview
				</Button>
				{fileUrl ? (
					<Button asChild type="button" variant="ghost">
						<a href={fileUrl} rel="noreferrer" target="_blank">
							<ExternalLink className="mr-2 size-4" />
							Open document
						</a>
					</Button>
				) : null}
			</div>
		</div>
	);
}

export function ListingPdfViewer({
	document,
	listingId,
	mobile = false,
}: ListingPdfViewerProps) {
	const queryClient = useQueryClient();
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [containerWidth, setContainerWidth] = useState<number | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(
		document.url ? null : "Document access is unavailable."
	);
	const [fileName, setFileName] = useState(document.fileName ?? null);
	const [fileUrl, setFileUrl] = useState(document.url ?? null);
	const [hasAutoRetried, setHasAutoRetried] = useState(false);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [pageNumber, setPageNumber] = useState(1);
	const [phase, setPhase] = useState<PdfViewerPhase>(
		document.url ? "loading" : "error"
	);
	const [viewerKey, setViewerKey] = useState(0);

	useEffect(() => {
		const nextErrorMessage = document.url
			? null
			: "Document access is unavailable.";

		setErrorMessage(nextErrorMessage);
		setFileName(document.fileName ?? null);
		setFileUrl(document.url ?? null);
		setHasAutoRetried(false);
		setPageCount(null);
		setPageNumber(1);
		setPhase(document.assetId && document.url ? "loading" : "error");
		setViewerKey(0);
	}, [document.assetId, document.fileName, document.url]);

	useEffect(() => {
		const element = containerRef.current;
		if (!element) {
			return;
		}

		const updateWidth = () => {
			if (element.clientWidth > 0) {
				setContainerWidth(element.clientWidth);
			}
		};

		updateWidth();

		if (typeof ResizeObserver === "undefined") {
			return;
		}

		const observer = new ResizeObserver((entries) => {
			const nextWidth = entries[0]?.contentRect.width;
			if (nextWidth && nextWidth > 0) {
				setContainerWidth(nextWidth);
			}
		});

		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const canGoToPreviousPage = pageNumber > 1;
	const canGoToNextPage = pageCount !== null && pageNumber < pageCount;
	const pageWidth = Math.max(
		240,
		Math.floor(containerWidth ?? (mobile ? 320 : 720))
	);

	async function refreshAccess(options: { automatic: boolean }) {
		if (options.automatic) {
			setHasAutoRetried(true);
		}

		if (!document.assetId) {
			setErrorMessage("Document access could not be refreshed.");
			setPhase("error");
			return;
		}

		setErrorMessage(null);
		setPhase("stale-url-retrying");

		try {
			const refreshed = await queryClient.fetchQuery(
				listingDocumentAccessQueryOptions(listingId, document.assetId)
			);

			if (!refreshed?.url) {
				throw new Error("A refreshed document URL was not returned.");
			}

			setFileName(refreshed.fileName ?? document.fileName ?? null);
			setFileUrl(refreshed.url);
			setPageCount(null);
			setPageNumber(1);
			setPhase("loading");
			setViewerKey((current) => current + 1);
		} catch (error) {
			setErrorMessage(toErrorMessage(error));
			setPhase("error");
		}
	}

	function handlePdfError(error: unknown) {
		if (!hasAutoRetried && document.assetId) {
			void refreshAccess({ automatic: true });
			return;
		}

		setErrorMessage(toErrorMessage(error));
		setPhase("error");
	}

	function goToNextPage() {
		if (!canGoToNextPage) {
			return;
		}

		setPhase("loading");
		setPageNumber((current) => current + 1);
	}

	function goToPreviousPage() {
		if (!canGoToPreviousPage) {
			return;
		}

		setPhase("loading");
		setPageNumber((current) => current - 1);
	}

	if (phase === "error") {
		return (
			<div className="flex h-full flex-col">
				<PdfViewerHeader
					fileUrl={fileUrl}
					label={document.label}
					meta={document.meta}
					mobile={mobile}
				/>
				<PdfViewerErrorState
					errorMessage={errorMessage}
					fileUrl={fileUrl}
					mobile={mobile}
					onRetry={() => void refreshAccess({ automatic: false })}
				/>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<PdfViewerHeader
				fileUrl={fileUrl}
				label={document.label}
				meta={document.meta}
				mobile={mobile}
			/>
			<PdfViewerControls
				canGoToNextPage={canGoToNextPage}
				canGoToPreviousPage={canGoToPreviousPage}
				fileName={fileName}
				mobile={mobile}
				onNextPage={goToNextPage}
				onPreviousPage={goToPreviousPage}
				pageCount={pageCount}
				pageNumber={pageNumber}
				phase={phase}
			/>

			<div
				className={cn(
					"relative flex-1 overflow-auto rounded-xl border border-[#E7E5E4] bg-[#FBFAF8]",
					mobile && "min-h-[320px]"
				)}
			>
				<PdfViewerLoadingOverlay phase={phase} />

				<div
					className={cn("flex min-h-full justify-center p-4", mobile && "p-2")}
					ref={containerRef}
				>
					{fileUrl ? (
						<Document
							file={fileUrl}
							key={`${fileUrl}:${viewerKey}`}
							loading={null}
							onLoadError={handlePdfError}
							onLoadSuccess={({ numPages }: { numPages: number }) => {
								setPageCount(numPages);
								setPageNumber((current) => Math.min(current, numPages));
							}}
						>
							<Page
								loading={null}
								onRenderError={handlePdfError}
								onRenderSuccess={() => {
									setErrorMessage(null);
									setPhase("ready");
								}}
								pageNumber={pageNumber}
								renderAnnotationLayer={false}
								renderTextLayer={false}
								width={pageWidth}
							/>
						</Document>
					) : null}
				</div>
			</div>
		</div>
	);
}
