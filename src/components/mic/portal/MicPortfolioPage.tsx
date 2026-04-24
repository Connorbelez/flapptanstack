"use client";

import { ArrowUpRight, ChartColumnIncreasing, Search } from "lucide-react";
import {
	formatPortfolioCurrency,
	formatPortfolioDate,
	formatPortfolioEnumLabel,
	formatPortfolioPercent,
	formatPortfolioRate,
} from "#/components/lender/portfolio/portfolio-formatters";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "#/components/ui/native-select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { cn } from "#/lib/utils";
import { MicMortgageDetailPanel } from "./MicMortgageDetailPanel";
import type {
	MicMortgageDetail,
	MicPortfolioFilterState,
	MicPortfolioFilterUpdater,
	MicPortfolioSnapshot,
	MicPortfolioSortKey,
	MicPositionRow,
} from "./types";

const SORT_LABELS: Record<MicPortfolioSortKey, string> = {
	"maturity-latest": "Maturity: latest",
	"maturity-soonest": "Maturity: soonest",
	"principal-highest": "Principal: high to low",
	"principal-lowest": "Principal: low to high",
	"yield-highest": "Yield: high to low",
};

function getStatusVariant(status: string) {
	const normalized = status.toLowerCase();

	if (
		normalized.includes("delinquent") ||
		normalized.includes("default") ||
		normalized.includes("missed")
	) {
		return "destructive" as const;
	}

	if (normalized.includes("active") || normalized.includes("current")) {
		return "secondary" as const;
	}

	return "outline" as const;
}

function getFocusVariant(severity: "critical" | "info" | "warning") {
	switch (severity) {
		case "critical":
			return "destructive" as const;
		case "warning":
			return "secondary" as const;
		default:
			return "outline" as const;
	}
}

function sortPositions(
	rows: readonly MicPositionRow[],
	sortKey: MicPortfolioSortKey
) {
	const sorted = [...rows];

	const compareDates = (left: string | null, right: string | null) => {
		const leftTime = left
			? new Date(`${left}T00:00:00`).getTime()
			: Number.MAX_SAFE_INTEGER;
		const rightTime = right
			? new Date(`${right}T00:00:00`).getTime()
			: Number.MAX_SAFE_INTEGER;

		return leftTime - rightTime;
	};

	sorted.sort((left, right) => {
		switch (sortKey) {
			case "maturity-soonest":
				return compareDates(left.maturityDate, right.maturityDate);
			case "maturity-latest":
				return compareDates(right.maturityDate, left.maturityDate);
			case "principal-highest":
				return (right.currentPrincipal ?? 0) - (left.currentPrincipal ?? 0);
			case "principal-lowest":
				return (left.currentPrincipal ?? 0) - (right.currentPrincipal ?? 0);
			case "yield-highest":
				return (
					(right.weightedRatePercent ?? 0) - (left.weightedRatePercent ?? 0)
				);
			default:
				return 0;
		}
	});

	return sorted;
}

function filterPositions(
	rows: readonly MicPositionRow[],
	filters: MicPortfolioFilterState
) {
	const normalizedQuery = filters.positionQuery?.trim().toLowerCase();

	return rows.filter((row) => {
		if (
			filters.positionStatus &&
			row.mortgageStatus.toLowerCase() !== filters.positionStatus.toLowerCase()
		) {
			return false;
		}

		if (!normalizedQuery) {
			return true;
		}

		const searchValues = [
			row.borrowerLabel,
			row.city,
			row.mortgageStatus,
			row.propertyLabel,
			row.propertyType,
			row.province,
		]
			.join(" ")
			.toLowerCase();

		return searchValues.includes(normalizedQuery);
	});
}

function MetricCard({
	description,
	label,
	tone = "default",
	value,
}: {
	description: string;
	label: string;
	tone?: "critical" | "default" | "positive";
	value: string;
}) {
	return (
		<Card className="border-border/70 bg-card/95">
			<CardHeader className="space-y-2 pb-3">
				<CardDescription>{label}</CardDescription>
				<CardTitle
					className={cn(
						"text-3xl tracking-tight",
						tone === "critical" && "text-destructive",
						tone === "positive" && "text-emerald-700 dark:text-emerald-400"
					)}
				>
					{value}
				</CardTitle>
			</CardHeader>
			<CardContent className="pt-0 text-muted-foreground text-sm leading-6">
				{description}
			</CardContent>
		</Card>
	);
}

export interface MicPortfolioPageProps {
	filters: MicPortfolioFilterState;
	onFiltersChange: (updater: MicPortfolioFilterUpdater) => void;
	onOpenMortgagePage?: (mortgageId: string) => void;
	selectedMortgageDetail?: MicMortgageDetail | null;
	snapshot: MicPortfolioSnapshot;
}

export function MicPortfolioPage({
	filters,
	onFiltersChange,
	onOpenMortgagePage,
	selectedMortgageDetail,
	snapshot,
}: MicPortfolioPageProps) {
	const filteredRows = sortPositions(
		filterPositions(snapshot.positions, filters),
		filters.positionSort
	);
	const statusOptions = [
		...new Set(snapshot.positions.map((row) => row.mortgageStatus)),
	].sort();

	return (
		<>
			<div
				className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8"
				data-testid="mic-portfolio-page"
			>
				<section className="overflow-hidden rounded-[28px] border border-border/70 bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-stone-50 shadow-xl">
					<div className="grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1.35fr)_20rem] lg:px-8">
						<div className="space-y-5">
							<div className="flex flex-wrap items-center gap-2">
								<Badge
									className="border-white/20 bg-white/10 text-white hover:bg-white/10"
									variant="outline"
								>
									MIC transparency portal
								</Badge>
								<Badge
									className="border-white/15 bg-white/5 text-stone-200 hover:bg-white/5"
									variant="outline"
								>
									Read only
								</Badge>
								<Badge
									className="border-white/15 bg-white/5 text-stone-200 hover:bg-white/5"
									variant="outline"
								>
									Mortgage-ledger derived
								</Badge>
							</div>
							<div className="space-y-3">
								<p className="font-medium text-[11px] text-stone-300 uppercase tracking-[0.28em]">
									{snapshot.asOfLabel}
								</p>
								<h1 className="max-w-4xl font-semibold text-4xl text-white tracking-tight sm:text-5xl">
									{snapshot.fundName}
								</h1>
								<p className="max-w-3xl text-base text-stone-200 leading-7 sm:text-lg">
									{snapshot.subtitle}
								</p>
							</div>
						</div>
						<Card className="border-white/10 bg-white/6 text-stone-50 backdrop-blur">
							<CardHeader className="pb-3">
								<div className="flex items-center gap-2 text-stone-200">
									<ChartColumnIncreasing className="size-4" />
									<p className="font-medium text-sm">Reporting boundary</p>
								</div>
								<CardTitle className="text-white text-xl">
									Current system truth only
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3 text-sm text-stone-200 leading-6">
								<p>{snapshot.sourceNote}</p>
								<p className="text-stone-300">
									The screen is intentionally optimized for operational
									transparency, not personalized investor statements.
								</p>
							</CardContent>
						</Card>
					</div>
				</section>

				<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					{snapshot.metricCards.map((metric) => (
						<MetricCard key={metric.label} {...metric} />
					))}
				</section>

				<section className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
					<Card className="border-border/70 bg-card/95">
						<CardHeader className="border-border/70 border-b pb-5">
							<CardDescription>What needs attention first</CardDescription>
							<CardTitle className="text-2xl">Focus rail</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 pt-5">
							{snapshot.focusItems.map((item) => (
								<div
									className="rounded-2xl border border-border/70 bg-muted/20 p-4"
									key={item.id}
								>
									<div className="flex items-start justify-between gap-3">
										<div className="space-y-1">
											<p className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
												{item.label}
											</p>
											<p className="font-medium text-sm">{item.title}</p>
										</div>
										<Badge variant={getFocusVariant(item.severity)}>
											{formatPortfolioEnumLabel(item.severity)}
										</Badge>
									</div>
									<p className="mt-3 text-muted-foreground text-sm leading-6">
										{item.summary}
									</p>
									{item.value ? (
										<p className="mt-3 font-medium text-sm">{item.value}</p>
									) : null}
								</div>
							))}
						</CardContent>
					</Card>

					<div className="grid gap-6">
						<div className="grid gap-6 lg:grid-cols-2">
							<Card className="border-border/70 bg-card/95">
								<CardHeader className="border-border/70 border-b pb-5">
									<CardDescription>Concentration and exposure</CardDescription>
									<CardTitle className="text-2xl">Exposure lens</CardTitle>
								</CardHeader>
								<CardContent className="grid gap-3 pt-5">
									{snapshot.exposureCards.map((card) => (
										<div
											className="rounded-2xl border border-border/70 bg-muted/20 p-4"
											key={card.label}
										>
											<p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
												{card.label}
											</p>
											<p className="mt-2 font-semibold text-2xl tracking-tight">
												{card.value}
											</p>
											<p className="mt-2 text-muted-foreground text-sm leading-6">
												{card.description}
											</p>
										</div>
									))}
								</CardContent>
							</Card>

							<Card className="border-border/70 bg-card/95">
								<CardHeader className="border-border/70 border-b pb-5">
									<CardDescription>
										Mortgage and servicing history
									</CardDescription>
									<CardTitle className="text-2xl">Recent activity</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4 pt-5">
									{snapshot.recentActivity.map((activity) => (
										<div
											className="rounded-2xl border border-border/70 bg-muted/20 p-4"
											key={activity.id}
										>
											<p className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
												{activity.dateLabel}
											</p>
											<p className="mt-2 font-medium text-sm">
												{activity.title}
											</p>
											<p className="mt-2 text-muted-foreground text-sm leading-6">
												{activity.summary}
											</p>
										</div>
									))}
								</CardContent>
							</Card>
						</div>

						<Card className="overflow-hidden border-border/70 bg-card/95">
							<CardHeader className="gap-4 border-border/70 border-b pb-5">
								<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
									<div className="space-y-1.5">
										<CardDescription>
											Live mortgage positions held by the MIC
										</CardDescription>
										<CardTitle className="text-2xl">Portfolio ledger</CardTitle>
									</div>
									<Badge variant="outline">
										{filteredRows.length} of {snapshot.positions.length}{" "}
										mortgages shown
									</Badge>
								</div>
								<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_14rem]">
									<div className="relative">
										<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
										<Input
											aria-label="Search MIC mortgages"
											className="pl-9"
											onChange={(event) =>
												onFiltersChange((current) => ({
													...current,
													positionQuery: event.currentTarget.value || undefined,
												}))
											}
											placeholder="Filter by property, borrower, city, or status"
											value={filters.positionQuery ?? ""}
										/>
									</div>
									<NativeSelect
										aria-label="Filter MIC mortgages by status"
										onChange={(event) =>
											onFiltersChange((current) => ({
												...current,
												positionStatus:
													event.currentTarget.value === "all"
														? undefined
														: event.currentTarget.value,
											}))
										}
										size="sm"
										value={filters.positionStatus ?? "all"}
									>
										<NativeSelectOption value="all">
											All statuses
										</NativeSelectOption>
										{statusOptions.map((status) => (
											<NativeSelectOption key={status} value={status}>
												{formatPortfolioEnumLabel(status)}
											</NativeSelectOption>
										))}
									</NativeSelect>
									<NativeSelect
										aria-label="Sort MIC mortgages"
										onChange={(event) =>
											onFiltersChange((current) => ({
												...current,
												positionSort: event.currentTarget
													.value as MicPortfolioSortKey,
											}))
										}
										size="sm"
										value={filters.positionSort}
									>
										{Object.entries(SORT_LABELS).map(([value, label]) => (
											<NativeSelectOption key={value} value={value}>
												{label}
											</NativeSelectOption>
										))}
									</NativeSelect>
								</div>
							</CardHeader>
							<CardContent className="px-0 pb-0">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="pl-6">Property</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Principal</TableHead>
											<TableHead className="text-right">Yield</TableHead>
											<TableHead className="text-right">LTV</TableHead>
											<TableHead>Next payment</TableHead>
											<TableHead>Maturity</TableHead>
											<TableHead className="pr-6 text-right">Detail</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredRows.map((row) => (
											<TableRow
												className="cursor-pointer"
												data-testid={`mic-position-row-${row.mortgageId}`}
												key={row.mortgageId}
												onClick={() =>
													onFiltersChange((current) => ({
														...current,
														detailMortgageId: row.mortgageId,
													}))
												}
												onKeyDown={(event) => {
													if (event.key === "Enter" || event.key === " ") {
														event.preventDefault();
														onFiltersChange((current) => ({
															...current,
															detailMortgageId: row.mortgageId,
														}));
													}
												}}
												tabIndex={0}
											>
												<TableCell className="pl-6">
													<div className="flex items-center gap-3">
														<div className="size-12 overflow-hidden rounded-lg border border-border/70 bg-muted">
															{row.thumbnailUrl ? (
																<img
																	alt={row.propertyLabel}
																	className="h-full w-full object-cover"
																	height={48}
																	src={row.thumbnailUrl}
																	width={48}
																/>
															) : (
																<div className="flex h-full items-center justify-center bg-muted text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
																	MIC
																</div>
															)}
														</div>
														<div className="space-y-1">
															<p className="font-medium text-sm">
																{row.propertyLabel}
															</p>
															<p className="text-muted-foreground text-xs">
																{row.city}, {row.province} · {row.propertyType}
															</p>
															<p className="text-muted-foreground text-xs">
																{row.borrowerLabel}
															</p>
														</div>
													</div>
												</TableCell>
												<TableCell>
													<div className="space-y-1">
														<Badge
															variant={getStatusVariant(row.mortgageStatus)}
														>
															{formatPortfolioEnumLabel(row.mortgageStatus)}
														</Badge>
														<p className="text-muted-foreground text-xs">
															{formatPortfolioPercent(row.positionPercent)} of
															mortgage
														</p>
													</div>
												</TableCell>
												<TableCell className="text-right font-medium">
													{formatPortfolioCurrency(row.currentPrincipal)}
												</TableCell>
												<TableCell className="text-right">
													{formatPortfolioRate(row.weightedRatePercent)}
												</TableCell>
												<TableCell className="text-right">
													{formatPortfolioPercent(row.currentLtvPercent)}
												</TableCell>
												<TableCell>
													{formatPortfolioDate(row.nextPaymentDate)}
												</TableCell>
												<TableCell>
													{formatPortfolioDate(row.maturityDate)}
												</TableCell>
												<TableCell className="pr-6 text-right">
													<Button
														aria-label={`Open MIC mortgage details for ${row.propertyLabel}`}
														size="sm"
														variant="ghost"
													>
														Open
														<ArrowUpRight className="size-4" />
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					</div>
				</section>
			</div>

			<MicMortgageDetailPanel
				detail={selectedMortgageDetail}
				mortgageId={filters.detailMortgageId}
				onOpenChange={(open) => {
					if (!open) {
						onFiltersChange((current) => ({
							...current,
							detailMortgageId: undefined,
						}));
					}
				}}
				onOpenMortgagePage={onOpenMortgagePage}
				open={Boolean(filters.detailMortgageId)}
			/>
		</>
	);
}
