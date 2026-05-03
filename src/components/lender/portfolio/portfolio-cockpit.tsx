"use client";

import {
	ArrowUpRight,
	BarChart3,
	Clock3,
	LineChart,
	ShieldAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import {
	Bar,
	CartesianGrid,
	Cell,
	ComposedChart,
	Line,
	Pie,
	PieChart,
	Tooltip as RechartsTooltip,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";
import { Badge } from "#/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
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
	formatPortfolioCurrency,
	formatPortfolioDataCompleteness,
	formatPortfolioDate,
	formatPortfolioDateTime,
	formatPortfolioEnumLabel,
	formatPortfolioRate,
} from "./portfolio-formatters";
import {
	PortfolioDescriptionTooltip,
	PortfolioSlotHost,
} from "./portfolio-shell";
import type {
	PortfolioAsyncState,
	PortfolioCommandCenterSnapshot,
	PortfolioHistoricalSeries,
} from "./portfolio-types";

const INCOME_TREND_CONFIG = {
	cumulativeIncome: {
		color: "var(--chart-2)",
		label: "Cumulative income",
	},
	periodIncome: {
		color: "var(--chart-1)",
		label: "Period income",
	},
	projectedAggregateEarnings: {
		color: "var(--chart-4)",
		label: "Projected aggregate earnings",
	},
} as const;

const BREAKDOWN_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--muted-foreground)",
	"var(--border)",
] as const;

interface PortfolioCockpitProps {
	cockpit: PortfolioCommandCenterSnapshot["cockpit"];
	generatedAt: number;
	historyErrorMessage?: string;
	historySeries: PortfolioHistoricalSeries | null;
	historyState: PortfolioAsyncState;
}

export function PortfolioCockpit({
	cockpit,
	generatedAt,
	historyErrorMessage,
	historySeries,
	historyState,
}: PortfolioCockpitProps) {
	const metrics = cockpit.metrics;

	return (
		<PortfolioSlotHost
			dataTestId="portfolio-cockpit"
			description="A lender-first financial cockpit that keeps current performance, trend health, and concentration risk visible without moving the portfolio into separate performance routes."
			eyebrow="Financial cockpit"
			summary={buildCockpitSummary(historySeries, historyState)}
			title="Portfolio command center"
		>
			<div className="space-y-5">
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<MetricCard
						description="Accrued interest earned in the current tax year."
						icon={<ArrowUpRight className="size-4 text-[var(--chart-2)]" />}
						label="YTD accrued"
						value={formatPortfolioCurrency(metrics.ytdAccruedInterest)}
					/>
					<MetricCard
						description="Current-month income pace from the upstream accrual seam."
						icon={<Clock3 className="size-4 text-[var(--chart-1)]" />}
						label="Monthly accrued"
						value={formatPortfolioCurrency(metrics.monthlyAccruedInterest)}
					/>
					<MetricCard
						description="Lifetime lender income recognized across active holdings."
						icon={<LineChart className="size-4 text-[var(--chart-2)]" />}
						label="Lifetime accrued"
						value={formatPortfolioCurrency(metrics.lifetimeAccruedInterest)}
					/>
					<MetricCard
						description={`${metrics.renewalsDueSoonCount} renewals due soon and ${metrics.paymentExceptionCount} payment exceptions need attention.`}
						icon={<ShieldAlert className="size-4 text-[var(--chart-1)]" />}
						label="Risk and renewal"
						value={`${metrics.renewalsDueSoonCount + metrics.paymentExceptionCount} watchpoints`}
					/>
				</div>

				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<MiniMetric
						label="Estimated portfolio value"
						value={formatPortfolioCompactCurrency(
							metrics.estimatedPortfolioValue
						)}
					/>
					<MiniMetric
						label="Available cash"
						value={formatPortfolioCompactCurrency(metrics.availableCashBalance)}
					/>
					<MiniMetric
						label="Undisbursed balance"
						value={formatPortfolioCompactCurrency(metrics.undisbursedBalance)}
					/>
					<MiniMetric
						label="Weighted average rate"
						value={formatPortfolioRate(metrics.weightedAverageInterestRate)}
					/>
				</div>

				<div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
					<Card className="border-border/70">
						<CardHeader className="gap-3">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="flex items-center gap-2">
									<CardTitle className="text-base">
										Income trend and projected earnings
									</CardTitle>
									<PortfolioDescriptionTooltip
										label="About income trend and projected earnings"
										text="Track period income, accrued income to date, and the projected aggregate earnings line from the snapshot-backed history contract."
									/>
								</div>
								<Badge variant="outline">
									Updated {formatPortfolioDateTime(generatedAt)}
								</Badge>
							</div>
						</CardHeader>
						<CardContent>
							{renderHistoryState({
								historyErrorMessage,
								historySeries,
								historyState,
							})}
						</CardContent>
					</Card>

					<Card className="border-border/70">
						<CardHeader className="gap-3">
							<div className="flex items-center gap-2">
								<CardTitle className="text-base">
									Portfolio breakdown visuals
								</CardTitle>
								<PortfolioDescriptionTooltip
									label="About portfolio breakdown visuals"
									text="Concentration is shown by mortgage status and property type so risk and composition stay visible at a glance."
								/>
							</div>
						</CardHeader>
						<CardContent className="grid gap-4 lg:grid-cols-2">
							<BreakdownChart
								data={cockpit.breakdowns.byMortgageStatus}
								emptyCopy="No mortgage-status breakdown is available yet."
								title="By mortgage status"
							/>
							<BreakdownChart
								data={cockpit.breakdowns.byPropertyType}
								emptyCopy="No property-type breakdown is available yet."
								title="By property type"
							/>
						</CardContent>
					</Card>
				</div>
			</div>
		</PortfolioSlotHost>
	);
}

function buildCockpitSummary(
	historySeries: PortfolioHistoricalSeries | null,
	historyState: PortfolioAsyncState
) {
	if (historyState === "loading") {
		return "Loading trend data";
	}

	if (historyState === "error") {
		return "Trend data unavailable";
	}

	if (!historySeries || historySeries.points.length === 0) {
		return "No historical trend data yet";
	}

	if (
		historySeries.dataCompleteness === "live_fallback" &&
		historySeries.liveFallbackPeriodLabel
	) {
		return `Live through ${historySeries.liveFallbackPeriodLabel}`;
	}

	if (historySeries.snapshotBackedThrough) {
		return `Snapshots through ${formatPortfolioDate(historySeries.snapshotBackedThrough)}`;
	}

	return formatPortfolioDataCompleteness(historySeries.dataCompleteness);
}

function renderHistoryState({
	historyErrorMessage,
	historySeries,
	historyState,
}: {
	historyErrorMessage?: string;
	historySeries: PortfolioHistoricalSeries | null;
	historyState: PortfolioAsyncState;
}) {
	if (historyState === "loading") {
		return <HistoryLoadingState />;
	}

	if (historyState === "error") {
		return (
			<InlineEmptyState
				description={
					historyErrorMessage ??
					"The historical performance contract could not be loaded right now."
				}
				title="Trend data unavailable"
			/>
		);
	}

	if (!historySeries || historySeries.points.length === 0) {
		return (
			<InlineEmptyState
				description="As historical snapshots and live fallback periods accumulate, this chart will show performance momentum without shifting the page layout."
				title="No historical trend data yet"
			/>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-2">
				<Badge variant="secondary">{historySeries.asOfDate}</Badge>
				<Badge variant="outline">
					{formatPortfolioDataCompleteness(historySeries.dataCompleteness)}
				</Badge>
				{historySeries.liveFallbackPeriodLabel ? (
					<Badge variant="outline">
						Live period {historySeries.liveFallbackPeriodLabel}
					</Badge>
				) : null}
			</div>
			<div className="flex flex-wrap gap-3 text-muted-foreground text-xs">
				<TrendLegendItem
					color={INCOME_TREND_CONFIG.periodIncome.color}
					label={INCOME_TREND_CONFIG.periodIncome.label}
				/>
				<TrendLegendItem
					color={INCOME_TREND_CONFIG.cumulativeIncome.color}
					label={INCOME_TREND_CONFIG.cumulativeIncome.label}
				/>
				<TrendLegendItem
					color={INCOME_TREND_CONFIG.projectedAggregateEarnings.color}
					dashed
					label={INCOME_TREND_CONFIG.projectedAggregateEarnings.label}
				/>
			</div>
			<div className="h-[260px] w-full text-xs">
				<ResponsiveContainer height="100%" width="100%">
					<ComposedChart data={historySeries.points}>
						<CartesianGrid strokeDasharray="3 3" vertical={false} />
						<XAxis
							axisLine={false}
							dataKey="periodLabel"
							tickLine={false}
							tickMargin={10}
						/>
						<YAxis
							axisLine={false}
							tickFormatter={(value) =>
								formatPortfolioCompactCurrency(Number(value))
							}
							tickLine={false}
							width={88}
						/>
						<RechartsTooltip
							formatter={(value, name) => [
								formatPortfolioCurrency(Number(value)),
								name === "periodIncome"
									? INCOME_TREND_CONFIG.periodIncome.label
									: name === "projectedAggregateEarnings"
										? INCOME_TREND_CONFIG.projectedAggregateEarnings.label
										: INCOME_TREND_CONFIG.cumulativeIncome.label,
							]}
							labelFormatter={(
								label,
								payload?: ReadonlyArray<{
									payload?: { dataCompleteness?: string };
								}>
							) =>
								`${label} • ${formatPortfolioDataCompleteness(
									payload?.[0]?.payload?.dataCompleteness
								)}`
							}
						/>
						<Bar
							dataKey="periodIncome"
							fill={INCOME_TREND_CONFIG.periodIncome.color}
							radius={[10, 10, 0, 0]}
						/>
						<Line
							dataKey="cumulativeIncome"
							dot={false}
							stroke={INCOME_TREND_CONFIG.cumulativeIncome.color}
							strokeWidth={3}
							type="monotone"
						/>
						<Line
							dataKey="projectedAggregateEarnings"
							dot={false}
							stroke={INCOME_TREND_CONFIG.projectedAggregateEarnings.color}
							strokeDasharray="8 6"
							strokeWidth={2}
							type="monotone"
						/>
					</ComposedChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}

function BreakdownChart({
	data,
	emptyCopy,
	title,
}: {
	data: readonly PortfolioCommandCenterSnapshot["cockpit"]["breakdowns"]["byMortgageStatus"][number][];
	emptyCopy: string;
	title: string;
}) {
	if (data.length === 0) {
		return (
			<div className="rounded-xl border border-border/70 bg-muted/10 p-4">
				<p className="font-medium text-sm">{title}</p>
				<p className="mt-2 text-muted-foreground text-sm leading-6">
					{emptyCopy}
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4 rounded-xl border border-border/70 bg-muted/10 p-4">
			<div className="space-y-1">
				<p className="font-medium text-sm">{title}</p>
				<p className="text-muted-foreground text-xs leading-5">
					Split by active holdings and backed by the upstream command-center
					contract.
				</p>
			</div>
			<div className="mx-auto h-[180px] max-w-[240px] text-xs">
				<ResponsiveContainer height="100%" width="100%">
					<PieChart>
						<RechartsTooltip
							formatter={(value) => [
								`${Number(value).toLocaleString("en-CA")} units`,
								"Position units",
							]}
						/>
						<Pie
							data={[...data]}
							dataKey="positionUnits"
							innerRadius={52}
							nameKey="key"
							outerRadius={74}
							paddingAngle={3}
						>
							{data.map((entry, index) => (
								<Cell
									fill={BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length]}
									key={entry.key}
								/>
							))}
						</Pie>
					</PieChart>
				</ResponsiveContainer>
			</div>
			<div className="space-y-2">
				{data.map((entry, index) => (
					<div
						className="flex items-start justify-between gap-3 rounded-lg bg-background/80 px-3 py-2"
						key={entry.key}
					>
						<div className="flex items-start gap-2">
							<span
								aria-hidden="true"
								className="mt-1 size-2.5 rounded-full"
								style={{
									backgroundColor:
										BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length],
								}}
							/>
							<div>
								<p className="text-sm">{formatPortfolioEnumLabel(entry.key)}</p>
								<p className="text-muted-foreground text-xs">
									{entry.count.toLocaleString("en-CA")} holdings
								</p>
							</div>
						</div>
						<p className="text-right font-medium text-sm">
							{entry.positionUnits.toLocaleString("en-CA")} units
						</p>
					</div>
				))}
			</div>
		</div>
	);
}

function MetricCard({
	description,
	icon,
	label,
	value,
}: {
	description: string;
	icon: ReactNode;
	label: string;
	value: string;
}) {
	return (
		<div className="rounded-2xl border border-border/70 bg-linear-to-br from-card via-card to-muted/20 p-4 shadow-sm">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="flex items-center gap-1.5">
						<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
							{label}
						</p>
						<PortfolioDescriptionTooltip
							label={`About ${label}`}
							text={description}
						/>
					</div>
					<p className="mt-3 font-semibold text-2xl tracking-tight">{value}</p>
				</div>
				<div className="flex size-10 items-center justify-center rounded-full bg-background shadow-sm">
					{icon}
				</div>
			</div>
		</div>
	);
}

function MiniMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl border border-border/70 bg-background px-4 py-3">
			<p className="text-muted-foreground text-xs uppercase tracking-[0.14em]">
				{label}
			</p>
			<p className="mt-2 font-medium text-sm">{value}</p>
		</div>
	);
}

function TrendLegendItem({
	color,
	dashed = false,
	label,
}: {
	color: string;
	dashed?: boolean;
	label: string;
}) {
	return (
		<div className="flex items-center gap-2">
			<span
				aria-hidden="true"
				className="block h-0.5 w-6"
				style={{
					background: dashed
						? `repeating-linear-gradient(to right, ${color} 0 8px, transparent 8px 12px)`
						: color,
				}}
			/>
			<span>{label}</span>
		</div>
	);
}

function HistoryLoadingState() {
	return (
		<div className="space-y-4">
			<div className="flex gap-2">
				<Skeleton className="h-6 w-28 rounded-full" />
				<Skeleton className="h-6 w-32 rounded-full" />
			</div>
			<Skeleton className="h-[260px] w-full rounded-2xl" />
		</div>
	);
}

function InlineEmptyState({
	description,
	title,
}: {
	description: string;
	title: string;
}) {
	return (
		<Empty className="min-h-[260px] border-border/70 bg-muted/10">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<BarChart3 className="size-5" />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}
