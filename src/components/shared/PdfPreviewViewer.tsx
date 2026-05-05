"use client";

import {
	AlertCircle,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	Loader2,
	RefreshCw,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

type PdfViewerPhase = "error" | "loading" | "ready" | "stale-url-retrying";

interface PdfDocumentProps {
	readonly children: ReactNode;
	readonly file: string;
	readonly loading: null;
	readonly onLoadError: (error: unknown) => void;
	readonly onLoadSuccess: (payload: { numPages: number }) => void;
}

interface PdfPageProps {
	readonly loading: null;
	readonly onRenderError: (error: unknown) => void;
	readonly onRenderSuccess: () => void;
	readonly pageNumber: number;
	readonly renderAnnotationLayer: boolean;
	readonly renderTextLayer: boolean;
	readonly width: number;
}

interface ReactPdfComponents {
	readonly Document: ComponentType<PdfDocumentProps>;
	readonly Page: ComponentType<PdfPageProps>;
}

export interface PdfPreviewRefreshResult {
	readonly fileName?: string | null;
	readonly url?: string | null;
}

interface PdfPreviewViewerProps {
	readonly fileName?: string | null;
	readonly fileUrl?: string | null;
	readonly label: string;
	readonly meta: string;
	readonly mobile?: boolean;
	readonly onRefreshAccess?: () => Promise<PdfPreviewRefreshResult | null>;
	readonly openFileLabel?: string;
	readonly unavailableMessage?: string;
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
	openFileLabel,
}: {
	readonly fileUrl: string | null;
	readonly label: string;
	readonly meta: string;
	readonly mobile: boolean;
	readonly openFileLabel: string;
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
						{openFileLabel}
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
	readonly canGoToNextPage: boolean;
	readonly canGoToPreviousPage: boolean;
	readonly fileName: string | null;
	readonly mobile: boolean;
	readonly onNextPage: () => void;
	readonly onPreviousPage: () => void;
	readonly pageCount: number | null;
	readonly pageNumber: number;
	readonly phase: PdfViewerPhase;
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

function PdfViewerLoadingOverlay({
	phase,
}: {
	readonly phase: PdfViewerPhase;
}) {
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
	openFileLabel,
}: {
	readonly errorMessage: string | null;
	readonly fileUrl: string | null;
	readonly mobile: boolean;
	readonly onRetry: () => void;
	readonly openFileLabel: string;
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
							{openFileLabel}
						</a>
					</Button>
				) : null}
			</div>
		</div>
	);
}

export function PdfPreviewViewer({
	fileName: initialFileName = null,
	fileUrl: initialFileUrl = null,
	label,
	meta,
	mobile = false,
	onRefreshAccess,
	openFileLabel = "Open document",
	unavailableMessage = "Document access is unavailable.",
}: PdfPreviewViewerProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [containerWidth, setContainerWidth] = useState<number | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(
		initialFileUrl ? null : unavailableMessage
	);
	const [fileName, setFileName] = useState(initialFileName);
	const [fileUrl, setFileUrl] = useState(initialFileUrl);
	const [hasAutoRetried, setHasAutoRetried] = useState(false);
	const [pageCount, setPageCount] = useState<number | null>(null);
	const [pageNumber, setPageNumber] = useState(1);
	const [pdfComponents, setPdfComponents] = useState<ReactPdfComponents | null>(
		null
	);
	const [phase, setPhase] = useState<PdfViewerPhase>(
		initialFileUrl ? "loading" : "error"
	);
	const [viewerKey, setViewerKey] = useState(0);

	useEffect(() => {
		let cancelled = false;

		if (typeof window === "undefined") {
			return () => {
				cancelled = true;
			};
		}

		async function loadReactPdf() {
			try {
				const module = await import("react-pdf");
				module.pdfjs.GlobalWorkerOptions.workerSrc = new URL(
					"pdfjs-dist/build/pdf.worker.min.mjs",
					import.meta.url
				).toString();

				if (!cancelled) {
					setPdfComponents({
						Document: module.Document as ComponentType<PdfDocumentProps>,
						Page: module.Page as ComponentType<PdfPageProps>,
					});
				}
			} catch (error) {
				if (!cancelled) {
					setErrorMessage(toErrorMessage(error));
					setPhase("error");
				}
			}
		}

		void loadReactPdf();

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		setErrorMessage(initialFileUrl ? null : unavailableMessage);
		setFileName(initialFileName);
		setFileUrl(initialFileUrl);
		setHasAutoRetried(false);
		setPageCount(null);
		setPageNumber(1);
		setPhase(initialFileUrl ? "loading" : "error");
		setViewerKey(0);
	}, [initialFileName, initialFileUrl, unavailableMessage]);

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
	const PdfDocument = pdfComponents?.Document;
	const PdfPage = pdfComponents?.Page;

	async function refreshAccess(options: { automatic: boolean }) {
		if (options.automatic) {
			setHasAutoRetried(true);
		}

		if (!onRefreshAccess) {
			setErrorMessage("Document access could not be refreshed.");
			setPhase("error");
			return;
		}

		setErrorMessage(null);
		setPhase("stale-url-retrying");

		try {
			const refreshed = await onRefreshAccess();

			if (!refreshed?.url) {
				throw new Error("A refreshed document URL was not returned.");
			}

			setFileName(refreshed.fileName ?? initialFileName ?? null);
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
		if (!hasAutoRetried && onRefreshAccess) {
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
			<div className="flex h-full flex-col" data-testid="pdf-preview-viewer">
				<PdfViewerHeader
					fileUrl={fileUrl}
					label={label}
					meta={meta}
					mobile={mobile}
					openFileLabel={openFileLabel}
				/>
				<PdfViewerErrorState
					errorMessage={errorMessage}
					fileUrl={fileUrl}
					mobile={mobile}
					onRetry={() => void refreshAccess({ automatic: false })}
					openFileLabel={openFileLabel}
				/>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col" data-testid="pdf-preview-viewer">
			<PdfViewerHeader
				fileUrl={fileUrl}
				label={label}
				meta={meta}
				mobile={mobile}
				openFileLabel={openFileLabel}
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
					{fileUrl && PdfDocument && PdfPage ? (
						<PdfDocument
							file={fileUrl}
							key={`${fileUrl}:${viewerKey}`}
							loading={null}
							onLoadError={handlePdfError}
							onLoadSuccess={({ numPages }) => {
								setPageCount(numPages);
								setPageNumber((current) => Math.min(current, numPages));
							}}
						>
							<PdfPage
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
						</PdfDocument>
					) : null}
				</div>
			</div>
		</div>
	);
}
