"use client";

import { Download, ShieldCheck } from "lucide-react";
import { downloadCsv } from "#/components/admin/financial-ledger/csv";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "#/components/ui/empty";
import { Skeleton } from "#/components/ui/skeleton";
import {
	formatPortfolioCompactCurrency,
	formatPortfolioDataCompleteness,
	formatPortfolioDate,
	formatPortfolioDateTime,
} from "./portfolio-formatters";
import { PortfolioSlotHost } from "./portfolio-shell";
import type {
	PortfolioCommandCenterSnapshot,
	PortfolioExportAsyncState,
	PortfolioTaxExport,
} from "./portfolio-types";

interface PortfolioExportStripProps {
	exportContract: PortfolioTaxExport | null;
	exportErrorMessage?: string;
	exportState: PortfolioExportAsyncState;
	limitsStrip: PortfolioCommandCenterSnapshot["limitsStrip"];
	onDownload?: (filename: string, csv: string) => void;
}

export function PortfolioExportStrip({
	exportContract,
	exportErrorMessage,
	exportState,
	limitsStrip,
	onDownload = downloadCsv,
}: PortfolioExportStripProps) {
	const exportAction = resolveExportAction({
		exportContract,
		exportErrorMessage,
		exportState,
	});

	return (
		<PortfolioSlotHost
			dataTestId="portfolio-export-strip"
			description="Broker guardrails stay paired with the CSV-first tax export workflow so lenders can check allocation bounds and move straight into tax-software exports without implying document generation."
			eyebrow="Broker limits and export"
			summary={exportAction.summary}
			title="Broker guardrails and CSV export"
		>
			<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
				<Card className="border-border/70 shadow-none">
					<CardHeader className="gap-2">
						<div className="flex items-start gap-3">
							<div className="flex size-10 items-center justify-center rounded-full bg-muted">
								<ShieldCheck className="size-5 text-[var(--chart-2)]" />
							</div>
							<div className="space-y-1">
								<CardTitle className="text-base">
									Broker-imposed limits
								</CardTitle>
								<CardDescription>
									These constraints shape what appears lower on the page in
									suggested opportunities.
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						{limitsStrip.hasConstraints ? (
							<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
								<LimitTile
									label="Mortgage types"
									value={joinValues(
										limitsStrip.constraints.allowedMortgageTypes
									)}
								/>
								<LimitTile
									label="Property types"
									value={joinValues(
										limitsStrip.constraints.allowedPropertyTypes
									)}
								/>
								<LimitTile
									label="Loan amount"
									value={formatMoneyRange(
										limitsStrip.constraints.loanAmountRange
									)}
								/>
								<LimitTile
									label="Interest rate"
									value={formatPercentRange(
										limitsStrip.constraints.interestRateRange
									)}
								/>
								<LimitTile
									label="LTV"
									value={formatRatioRange(limitsStrip.constraints.ltvRange)}
								/>
								<LimitTile
									label="Maturity ceiling"
									value={formatPortfolioDate(
										limitsStrip.constraints.maturityDateMax
									)}
								/>
							</div>
						) : (
							<Empty className="min-h-[168px] border-border/70 bg-muted/10">
								<EmptyHeader>
									<EmptyMedia variant="icon">
										<ShieldCheck className="size-5" />
									</EmptyMedia>
									<EmptyTitle>No broker limits configured</EmptyTitle>
									<EmptyDescription>
										The current portal does not publish lender-specific
										constraints, so suggested opportunities can explain matches
										without a broker rule overlay yet.
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						)}
						<div className="mt-4 rounded-xl border border-border/70 border-dashed bg-muted/10 px-4 py-3 text-muted-foreground text-sm leading-6">
							{limitsStrip.suggestionSeedCount.toLocaleString("en-CA")} listings
							currently pass the guardrail seed before downstream match reasons
							are rendered.
						</div>
					</CardContent>
				</Card>

				<Card className="border-border/70 shadow-none">
					<CardHeader className="gap-2">
						<div className="space-y-1">
							<CardTitle className="text-base">
								CSV export for tax software
							</CardTitle>
							<CardDescription>
								Server-generated CSV only. This surface never implies PDF
								output, T5 issuance, or official document generation.
							</CardDescription>
						</div>
					</CardHeader>
					<CardContent>
						{exportAction.state === "loading" ? (
							<LoadingExportState />
						) : (
							<div className="space-y-4">
								<div className="flex flex-wrap gap-2">
									<Badge
										variant={exportAction.canDownload ? "secondary" : "outline"}
									>
										{exportAction.badge}
									</Badge>
									{exportContract?.periodLabel ? (
										<Badge variant="outline">
											{exportContract.periodLabel}
										</Badge>
									) : null}
									{exportContract ? (
										<Badge variant="outline">
											{formatPortfolioDataCompleteness(
												exportContract.dataCompleteness
											)}
										</Badge>
									) : null}
								</div>

								<div className="rounded-xl border border-border/70 bg-muted/10 p-4">
									<p className="font-medium text-sm">{exportAction.title}</p>
									<p className="mt-2 text-muted-foreground text-sm leading-6">
										{exportAction.description}
									</p>
									{exportContract ? (
										<div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
											<MetadataRow
												label="Generated"
												value={formatPortfolioDateTime(
													exportContract.generatedAt
												)}
											/>
											<MetadataRow
												label="Filename"
												value={
													exportContract.filename ?? "Pending availability"
												}
											/>
										</div>
									) : null}
								</div>

								<Button
									className="w-full justify-center"
									disabled={!exportAction.canDownload}
									onClick={() => {
										if (
											exportContract?.csv &&
											exportContract.filename &&
											exportAction.canDownload
										) {
											onDownload(exportContract.filename, exportContract.csv);
										}
									}}
								>
									<Download className="mr-2 size-4" />
									Download CSV
								</Button>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</PortfolioSlotHost>
	);
}

function resolveExportAction({
	exportContract,
	exportErrorMessage,
	exportState,
}: Pick<
	PortfolioExportStripProps,
	"exportContract" | "exportErrorMessage" | "exportState"
>) {
	if (exportState === "loading") {
		return {
			badge: "Loading",
			canDownload: false,
			description: "Loading export status from the server-generated contract.",
			state: "loading" as const,
			summary: "Loading export status",
			title: "Checking export availability",
		};
	}

	if (exportState === "forbidden") {
		return {
			badge: "Access required",
			canDownload: false,
			description:
				"Your current lender access does not include the tax CSV export permission, so the action remains visible but disabled with a clear reason.",
			state: "forbidden" as const,
			summary: "Export access required",
			title: "CSV export unavailable for this role",
		};
	}

	if (exportState === "error") {
		return {
			badge: "Temporarily unavailable",
			canDownload: false,
			description:
				exportErrorMessage ??
				"The export contract could not be loaded right now. Try again after the portfolio contracts recover.",
			state: "error" as const,
			summary: "Export unavailable",
			title: "Unable to load the CSV export",
		};
	}

	if (
		exportContract?.isAvailable &&
		exportContract.csv &&
		exportContract.filename
	) {
		return {
			badge: "Ready",
			canDownload: true,
			description:
				"Download the server-generated CSV directly into tax software workflows without regenerating rows in the browser.",
			state: "ready" as const,
			summary: exportContract.periodLabel,
			title: "Export is ready",
		};
	}

	return {
		badge: "Unavailable",
		canDownload: false,
		description:
			exportContract?.unavailableReason ??
			"No CSV export is available for the current period yet.",
		state: "ready" as const,
		summary: "CSV unavailable",
		title: "Export is currently unavailable",
	};
}

function LoadingExportState() {
	return (
		<div className="space-y-4">
			<div className="flex gap-2">
				<Skeleton className="h-6 w-24 rounded-full" />
				<Skeleton className="h-6 w-28 rounded-full" />
			</div>
			<Skeleton className="h-28 w-full rounded-2xl" />
			<Skeleton className="h-10 w-full rounded-xl" />
		</div>
	);
}

function LimitTile({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl border border-border/70 bg-background px-4 py-3">
			<p className="text-muted-foreground text-xs uppercase tracking-[0.14em]">
				{label}
			</p>
			<p className="mt-2 font-medium text-sm leading-6">{value}</p>
		</div>
	);
}

function MetadataRow({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="text-muted-foreground text-xs uppercase tracking-[0.14em]">
				{label}
			</p>
			<p className="mt-1 text-sm">{value}</p>
		</div>
	);
}

function joinValues(values: readonly string[]) {
	if (values.length === 0) {
		return "Unspecified";
	}

	return values.join(", ");
}

function formatMoneyRange(
	range:
		| PortfolioCommandCenterSnapshot["limitsStrip"]["constraints"]["loanAmountRange"]
		| null
) {
	if (!range) {
		return "Unspecified";
	}

	return `${formatPortfolioCompactCurrency(range.min)} to ${formatPortfolioCompactCurrency(range.max)}`;
}

function formatPercentRange(
	range:
		| PortfolioCommandCenterSnapshot["limitsStrip"]["constraints"]["interestRateRange"]
		| null
) {
	if (!range) {
		return "Unspecified";
	}

	return `${range.min.toLocaleString("en-CA", {
		maximumFractionDigits: 2,
	})}% to ${range.max.toLocaleString("en-CA", {
		maximumFractionDigits: 2,
	})}%`;
}

function formatRatioRange(
	range:
		| PortfolioCommandCenterSnapshot["limitsStrip"]["constraints"]["ltvRange"]
		| null
) {
	if (!range) {
		return "Unspecified";
	}

	return `${Math.round(range.min * 100)}% to ${Math.round(range.max * 100)}%`;
}
