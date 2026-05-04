import { type ReactNode, useMemo } from "react";
import {
	Area,
	CartesianGrid,
	Cell,
	ComposedChart,
	Legend,
	Line,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "#/components/ui/chart";
import type {
	MicConcentrationExposureData,
	MicLendingFeeMetrics,
	MicPortfolioMetrics,
	MicPositionRow,
	MicReturnSeriesRow,
} from "../../../convex/micPortfolio/contracts";

const CHART_FILLS = [
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
	"var(--chart-1)",
] as const;

function formatCurrency(value: number): string {
	return `$${value.toLocaleString("en-CA", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

function formatCompactCurrency(value: number): string {
	return new Intl.NumberFormat("en-CA", {
		currency: "CAD",
		maximumFractionDigits: 0,
		notation: "compact",
		style: "currency",
	}).format(value);
}

function formatPercent(value: number | null): string {
	return value === null ? "N/A" : `${value.toFixed(2)}%`;
}

const RETURN_CHART_CONFIG = {
	cumulativeFeeIncome: {
		color: "var(--palm)",
		label: "Lending fee income",
	},
	cumulativeTotalReturn: {
		color: "var(--lagoon-deep)",
		label: "Total return",
	},
} satisfies ChartConfig;

const EMPTY_LENDING_FEE_METRICS: MicLendingFeeMetrics = {
	feeBasisPoints: 100,
	inferredLendingFeeIncome: 0,
	lendingFeeIncomeSharePercent: null,
	mortgageOriginatedCount: 0,
	originatedPrincipal: 0,
	totalInterestIncome: 0,
	totalReturnIncome: 0,
};

export interface MicReturnAnalytics {
	currentMonthApr: number | null;
	currentMonthPeriod: string | null;
	currentMonthReturn: number;
	projectedYieldEarned: number | null;
	projectedYieldInvestment: number;
	projectedYieldReturn: number;
	totalInvestment: number;
	ytdApr: number | null;
	ytdPeriodLabel: string;
	ytdReturn: number;
}

type ReturnChartRow = MicReturnSeriesRow & {
	isProjected?: boolean;
};

function previousPeriod(period: string) {
	const [year, month] = period.split("-").map(Number);
	if (!(year && month)) {
		return period;
	}
	const previous = new Date(Date.UTC(year, month - 2, 1));
	return previous.toISOString().slice(0, 7);
}

function nextPeriod(period: string) {
	const [year, month] = period.split("-").map(Number);
	if (!(year && month)) {
		return period;
	}
	const next = new Date(Date.UTC(year, month, 1));
	return next.toISOString().slice(0, 7);
}

function roundPercentValue(value: number) {
	return Math.round(value * 100) / 100;
}

function roundCurrencyValue(value: number) {
	return Math.round(value * 100) / 100;
}

function calculateReturnPercent(returnValue: number, investment: number) {
	if (investment <= 0) {
		return null;
	}
	return roundPercentValue((returnValue / investment) * 100);
}

function annualizeReturnPercent(
	returnValue: number,
	investment: number,
	months: number
) {
	if (investment <= 0 || months <= 0) {
		return null;
	}
	return roundPercentValue((returnValue / investment) * (12 / months) * 100);
}

function calculateProjectedRolling12Return(
	series: readonly MicReturnSeriesRow[],
	totalInvestment: number
): { investment: number; returnValue: number } {
	if (series.length === 0) {
		return { investment: totalInvestment, returnValue: 0 };
	}
	if (series.length >= 12) {
		return {
			investment: totalInvestment,
			returnValue: series
				.slice(-12)
				.reduce((sum, row) => sum + row.totalReturn, 0),
		};
	}
	const latest = series.at(-1);
	const projectedMonthlyPrincipal = latest?.originatedPrincipal ?? 0;
	const projectedMonthlyFeeIncome = latest?.feeIncome ?? 0;
	const projectedMonthlyInterestIncrement =
		totalInvestment > 0 && latest
			? roundCurrencyValue(
					latest.interestIncome * (projectedMonthlyPrincipal / totalInvestment)
				)
			: 0;
	let returnValue = 0;
	for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
		returnValue = roundCurrencyValue(
			returnValue +
				projectedMonthlyFeeIncome +
				(latest?.interestIncome ?? 0) +
				projectedMonthlyInterestIncrement * monthIndex
		);
	}
	return {
		investment: roundCurrencyValue(
			totalInvestment + projectedMonthlyPrincipal * 11
		),
		returnValue,
	};
}

export function buildReturnChartSeries(
	series: readonly MicReturnSeriesRow[]
): ReturnChartRow[] {
	if (series.length === 0) {
		return [];
	}
	const rows: ReturnChartRow[] =
		series.length === 1 && series[0]
			? [
					{
						cumulativeFeeIncome: 0,
						cumulativeInterestIncome: 0,
						cumulativeTotalReturn: 0,
						feeIncome: 0,
						feeIncomeSharePercent: null,
						interestIncome: 0,
						originatedPrincipal: 0,
						period: previousPeriod(series[0].period),
						totalReturn: 0,
					},
					series[0],
				]
			: [...series];
	const latest = rows.at(-1);
	if (!latest) {
		return rows;
	}
	const cumulativeOriginatedPrincipal = series.reduce(
		(sum, row) => sum + row.originatedPrincipal,
		0
	);
	const projectedFeeIncome = latest.feeIncome;
	const projectedNewInterestIncome =
		cumulativeOriginatedPrincipal > 0
			? roundCurrencyValue(
					latest.interestIncome *
						(latest.originatedPrincipal / cumulativeOriginatedPrincipal)
				)
			: 0;
	const projectedInterestIncome = roundCurrencyValue(
		latest.interestIncome + projectedNewInterestIncome
	);
	const projectedTotalReturn = roundCurrencyValue(
		projectedFeeIncome + projectedInterestIncome
	);
	const projectedCumulativeFeeIncome = roundCurrencyValue(
		latest.cumulativeFeeIncome + projectedFeeIncome
	);
	const projectedCumulativeInterestIncome = roundCurrencyValue(
		latest.cumulativeInterestIncome + projectedInterestIncome
	);
	const projectedCumulativeTotalReturn = roundCurrencyValue(
		projectedCumulativeFeeIncome + projectedCumulativeInterestIncome
	);
	rows.push({
		cumulativeFeeIncome: projectedCumulativeFeeIncome,
		cumulativeInterestIncome: projectedCumulativeInterestIncome,
		cumulativeTotalReturn: projectedCumulativeTotalReturn,
		feeIncome: projectedFeeIncome,
		feeIncomeSharePercent: calculateReturnPercent(
			projectedCumulativeFeeIncome,
			projectedCumulativeTotalReturn
		),
		interestIncome: projectedInterestIncome,
		isProjected: true,
		originatedPrincipal: latest.originatedPrincipal,
		period: nextPeriod(latest.period),
		totalReturn: projectedTotalReturn,
	});
	return rows;
}

export function buildReturnAnalytics({
	lendingFeeMetrics,
	metrics,
	returnSeries,
}: {
	lendingFeeMetrics?: MicLendingFeeMetrics;
	metrics: MicPortfolioMetrics;
	returnSeries?: readonly MicReturnSeriesRow[];
}): MicReturnAnalytics {
	const series = returnSeries ?? [];
	const fees = lendingFeeMetrics ?? EMPTY_LENDING_FEE_METRICS;
	const totalInvestment =
		metrics.outstandingPrincipal > 0
			? metrics.outstandingPrincipal
			: fees.originatedPrincipal;
	const latest = series.at(-1);
	const currentMonthReturn = latest?.totalReturn ?? 0;
	const currentMonthPeriod = latest?.period ?? null;
	const projectedRolling12 = calculateProjectedRolling12Return(
		series,
		totalInvestment
	);
	const currentMonthApr = annualizeReturnPercent(
		currentMonthReturn,
		totalInvestment,
		1
	);
	const currentYear = currentMonthPeriod?.slice(0, 4) ?? null;
	const ytdRows = currentYear
		? series.filter((row) => row.period.startsWith(currentYear))
		: [];
	const ytdReturn = ytdRows.reduce((sum, row) => sum + row.totalReturn, 0);
	const latestMonth = currentMonthPeriod
		? Number(currentMonthPeriod.slice(5, 7))
		: 0;
	const ytdMonths = Number.isFinite(latestMonth) ? latestMonth : ytdRows.length;
	return {
		currentMonthApr,
		currentMonthPeriod,
		currentMonthReturn,
		projectedYieldEarned: calculateReturnPercent(
			projectedRolling12.returnValue,
			projectedRolling12.investment
		),
		projectedYieldInvestment: projectedRolling12.investment,
		projectedYieldReturn: projectedRolling12.returnValue,
		totalInvestment,
		ytdApr: annualizeReturnPercent(ytdReturn, totalInvestment, ytdMonths),
		ytdPeriodLabel: currentYear ? `${currentYear} YTD` : "YTD",
		ytdReturn,
	};
}

function shortLabel(raw: string, max = 26): string {
	const t = raw.trim();
	if (t.length <= max) {
		return t;
	}
	return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function topNWithOther<
	T extends { outstandingPrincipal: number; label: string },
>(entries: readonly T[], topN: number): { name: string; value: number }[] {
	const sorted = [...entries].sort(
		(a, b) => b.outstandingPrincipal - a.outstandingPrincipal
	);
	if (sorted.length === 0) {
		return [];
	}
	const head = sorted.slice(0, topN);
	const tail = sorted.slice(topN);
	const otherPrincipal = tail.reduce((s, e) => s + e.outstandingPrincipal, 0);
	const rows = head.map((e) => ({
		name: shortLabel(e.label),
		value: e.outstandingPrincipal,
	}));
	if (otherPrincipal > 0) {
		rows.push({ name: "Other", value: otherPrincipal });
	}
	return rows;
}

function buildServicingSlices(metrics: MicPortfolioMetrics): {
	name: string;
	value: number;
}[] {
	const { outstandingPrincipal, arrearsExposure, delinquencyExposure } =
		metrics;
	if (outstandingPrincipal <= 0) {
		return [];
	}
	const overdueStress = Math.max(0, arrearsExposure - delinquencyExposure);
	const delinquent = Math.max(0, delinquencyExposure);
	const performing = Math.max(0, outstandingPrincipal - arrearsExposure);
	const rows = [
		{ name: "Performing", value: performing },
		{ name: "Overdue", value: overdueStress },
		{ name: "Delinquent", value: delinquent },
	].filter((r) => r.value > 0);
	return rows;
}

function buildYieldContributionSlices(
	positions: readonly MicPositionRow[],
	topN: number
): { name: string; value: number; yieldPct: number; principal: number }[] {
	const masses = positions
		.filter((p) => p.outstandingPrincipal > 0 && p.rateYield !== null)
		.map((p) => ({
			principal: p.outstandingPrincipal,
			yieldPct: p.rateYield as number,
			mass: p.outstandingPrincipal * (p.rateYield as number),
			label: shortLabel(p.propertyLabel),
		}))
		.sort((a, b) => b.mass - a.mass);

	if (masses.length === 0) {
		return [];
	}

	const head = masses.slice(0, topN);
	const tail = masses.slice(topN);
	const otherMass = tail.reduce((s, m) => s + m.mass, 0);

	const rows = head.map((m) => ({
		name: m.label,
		value: m.mass,
		yieldPct: m.yieldPct,
		principal: m.principal,
	}));

	if (otherMass > 0) {
		const otherPrincipal = tail.reduce((s, m) => s + m.principal, 0);
		const blendedYield = otherPrincipal > 0 ? otherMass / otherPrincipal : 0;
		rows.push({
			name: "Other positions",
			value: otherMass,
			yieldPct: blendedYield,
			principal: otherPrincipal,
		});
	}

	return rows;
}

function buildLtvBandSlices(
	positions: readonly MicPositionRow[]
): { name: string; value: number }[] {
	let low = 0;
	let mid = 0;
	let high = 0;
	let unknown = 0;

	for (const p of positions) {
		const principal = p.outstandingPrincipal;
		if (principal <= 0) {
			continue;
		}
		if (p.ltv === null) {
			unknown += principal;
			continue;
		}
		if (p.ltv < 65) {
			low += principal;
		} else if (p.ltv <= 75) {
			mid += principal;
		} else {
			high += principal;
		}
	}

	return [
		{ name: "LTV under 65%", value: low },
		{ name: "LTV 65–75%", value: mid },
		{ name: "LTV above 75%", value: high },
		{ name: "LTV unavailable", value: unknown },
	].filter((r) => r.value > 0);
}

interface DonutPanelProps {
	data: { name: string; value: number; [key: string]: string | number }[];
	emptyHint: string;
	subtitle: string;
	title: string;
	tooltipKind: "currency" | "yieldMass" | "percentShare";
	totalBasis?: number;
}

function PieTooltip({
	active,
	payload,
	kind,
	totalBasis,
}: {
	active?: boolean;
	payload?: readonly unknown[];
	kind: DonutPanelProps["tooltipKind"];
	totalBasis?: number;
}) {
	if (!(active && payload?.[0])) {
		return null;
	}
	const entry = payload[0] as {
		payload?: Record<string, unknown>;
		value?: number;
	};
	const row = entry.payload ?? {};
	const value = Number(row.value ?? entry.value ?? 0);
	const name = String(row.name ?? "");

	let detail: ReactNode = null;
	if (kind === "currency") {
		detail = (
			<p className="font-semibold text-foreground tabular-nums">
				{formatCurrency(value)}
			</p>
		);
	} else if (kind === "yieldMass") {
		const principal = Number(row.principal ?? 0);
		const yieldPct = Number(row.yieldPct ?? 0);
		detail = (
			<dl className="mt-1 space-y-1 text-muted-foreground text-xs">
				<div className="flex justify-between gap-6">
					<dt>Principal</dt>
					<dd className="font-medium text-foreground tabular-nums">
						{formatCurrency(principal)}
					</dd>
				</div>
				<div className="flex justify-between gap-6">
					<dt>Stated yield</dt>
					<dd className="font-medium text-foreground tabular-nums">
						{yieldPct.toFixed(2)}%
					</dd>
				</div>
				<div className="flex justify-between gap-6">
					<dt>Yield × principal</dt>
					<dd className="font-medium text-foreground tabular-nums">
						{formatCurrency(value)}
					</dd>
				</div>
			</dl>
		);
	} else if (kind === "percentShare" && totalBasis && totalBasis > 0) {
		const pct = (value / totalBasis) * 100;
		detail = (
			<p className="font-semibold text-foreground tabular-nums">
				{pct.toFixed(2)}% of portfolio
			</p>
		);
	}

	return (
		<div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
			<p className="font-medium text-foreground text-sm">{name}</p>
			{detail}
		</div>
	);
}

function DonutPanel({
	title,
	subtitle,
	data,
	emptyHint,
	tooltipKind,
	totalBasis,
}: DonutPanelProps) {
	const total = data.reduce((s, d) => s + d.value, 0);
	const basis = totalBasis ?? total;

	if (total <= 0 || data.length === 0) {
		return (
			<figure className="flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm backdrop-blur-sm">
				<figcaption>
					<h3 className="mic-display text-lg tracking-tight">{title}</h3>
					<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
						{subtitle}
					</p>
				</figcaption>
				<p className="text-muted-foreground text-sm">{emptyHint}</p>
			</figure>
		);
	}

	return (
		<figure className="flex min-w-0 flex-col gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm backdrop-blur-sm">
			<figcaption>
				<h3 className="mic-display text-lg tracking-tight">{title}</h3>
				<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
					{subtitle}
				</p>
			</figcaption>
			<div className="h-52 min-h-[13rem] w-full min-w-[180px]">
				<ResponsiveContainer height="100%" width="100%">
					<PieChart margin={{ bottom: 8, left: 8, right: 8, top: 8 }}>
						<Pie
							animationDuration={480}
							data={data}
							dataKey="value"
							innerRadius={52}
							nameKey="name"
							outerRadius={78}
							paddingAngle={2}
							stroke="var(--border)"
							strokeWidth={1}
						>
							{data.map((slice, fillIndex) => (
								<Cell
									fill={CHART_FILLS[fillIndex % CHART_FILLS.length]}
									key={`${title}-${slice.name}-${slice.value}`}
								/>
							))}
						</Pie>
						<Tooltip
							content={(props) => (
								<PieTooltip
									active={props.active}
									kind={tooltipKind}
									payload={props.payload}
									totalBasis={
										tooltipKind === "percentShare" ? basis : undefined
									}
								/>
							)}
						/>
						<Legend
							layout="horizontal"
							verticalAlign="bottom"
							wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
						/>
					</PieChart>
				</ResponsiveContainer>
			</div>
		</figure>
	);
}

function FeeMetric({
	label,
	value,
	aside,
}: {
	aside?: string;
	label: string;
	value: string;
}) {
	return (
		<div>
			<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
				{label}
			</p>
			<p className="mt-1 font-semibold text-[var(--sea-ink)] text-xl tabular-nums leading-tight">
				{value}
			</p>
			{aside ? (
				<p className="mt-1 text-muted-foreground text-xs leading-relaxed">
					{aside}
				</p>
			) : null}
		</div>
	);
}

export function MicReturnSeriesChart({
	lendingFeeMetrics,
	metrics,
	returnSeries,
}: {
	lendingFeeMetrics?: MicLendingFeeMetrics;
	metrics: MicPortfolioMetrics;
	returnSeries?: MicReturnSeriesRow[];
}) {
	const series = returnSeries ?? [];
	const fees = lendingFeeMetrics ?? EMPTY_LENDING_FEE_METRICS;
	const chartSeries = useMemo(() => buildReturnChartSeries(series), [series]);
	const analytics = useMemo(
		() => buildReturnAnalytics({ lendingFeeMetrics, metrics, returnSeries }),
		[lendingFeeMetrics, metrics, returnSeries]
	);

	if (series.length === 0) {
		return (
			<section className="space-y-4 border-[var(--line)] border-b pb-8">
				<div className="max-w-2xl space-y-2">
					<h3 className="mic-display text-2xl tracking-tight">
						Total return over time
					</h3>
					<p className="text-muted-foreground text-sm leading-relaxed">
						Return history appears once MIC-held mortgages have originated or
						interest obligations exist.
					</p>
				</div>
			</section>
		);
	}

	return (
		<section className="space-y-6 border-[var(--line)] border-b pb-8">
			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
				<div className="min-w-0">
					<div className="mb-4 max-w-2xl space-y-2">
						<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.22em]">
							Return composition
						</p>
						<h3 className="mic-display text-2xl tracking-tight">
							Total return over time
						</h3>
						<p className="text-muted-foreground text-sm leading-relaxed">
							Cumulative MIC return combines interest participation with an
							inferred 1.00% lending/origination fee on each originated
							mortgage.
						</p>
					</div>
					<ChartContainer
						className="h-[320px] w-full"
						config={RETURN_CHART_CONFIG}
					>
						<ComposedChart
							accessibilityLayer
							data={chartSeries}
							margin={{ bottom: 8, left: 4, right: 16, top: 16 }}
						>
							<defs>
								<linearGradient
									id="mic-total-return-fill"
									x1="0"
									x2="0"
									y1="0"
									y2="1"
								>
									<stop
										offset="5%"
										stopColor="var(--color-cumulativeTotalReturn)"
										stopOpacity={0.3}
									/>
									<stop
										offset="95%"
										stopColor="var(--color-cumulativeTotalReturn)"
										stopOpacity={0.04}
									/>
								</linearGradient>
							</defs>
							<CartesianGrid strokeDasharray="3 3" vertical={false} />
							<XAxis
								axisLine={false}
								dataKey="period"
								tickLine={false}
								tickMargin={10}
							/>
							<YAxis
								axisLine={false}
								tickFormatter={formatCompactCurrency}
								tickLine={false}
								width={68}
							/>
							<ChartTooltip
								content={
									<ChartTooltipContent
										formatter={(value, name) => (
											<>
												<span className="text-muted-foreground">
													{RETURN_CHART_CONFIG[
														name as keyof typeof RETURN_CHART_CONFIG
													]?.label ?? name}
												</span>
												<span className="ml-auto font-medium font-mono text-foreground tabular-nums">
													{formatCurrency(Number(value))}
												</span>
											</>
										)}
										labelFormatter={(label) => {
											const row = chartSeries.find(
												(item) => item.period === String(label)
											);
											return `${row?.isProjected ? "Projected" : "Actual"} period ${label}`;
										}}
									/>
								}
							/>
							<Area
								activeDot={{ r: 5 }}
								dataKey="cumulativeTotalReturn"
								dot={{ r: 2 }}
								fill="url(#mic-total-return-fill)"
								fillOpacity={1}
								name="cumulativeTotalReturn"
								stroke="var(--color-cumulativeTotalReturn)"
								strokeWidth={2.5}
								type="monotone"
							/>
							<Line
								dataKey="cumulativeFeeIncome"
								dot={{ r: 2 }}
								name="cumulativeFeeIncome"
								stroke="var(--color-cumulativeFeeIncome)"
								strokeDasharray="5 4"
								strokeWidth={2}
								type="monotone"
							/>
						</ComposedChart>
					</ChartContainer>
				</div>

				<aside className="grid content-start gap-5 border-[var(--line)] border-t pt-5 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
					<FeeMetric
						aside={`${fees.feeBasisPoints / 100}% inferred on originated principal`}
						label="Inferred lending fees"
						value={formatCurrency(fees.inferredLendingFeeIncome)}
					/>
					<FeeMetric
						label="Fee share of income"
						value={formatPercent(fees.lendingFeeIncomeSharePercent)}
					/>
					<FeeMetric
						label="Originated principal"
						value={formatCurrency(fees.originatedPrincipal)}
					/>
					<FeeMetric
						aside={`${fees.mortgageOriginatedCount.toLocaleString("en-CA")} originated mortgages`}
						label="Total return income"
						value={formatCurrency(fees.totalReturnIncome)}
					/>
					<FeeMetric
						aside={`${formatPercent(analytics.projectedYieldEarned)} over ${formatCurrency(analytics.projectedYieldInvestment)} projected MIC investment basis`}
						label="Projected yield earned"
						value={formatCurrency(analytics.projectedYieldReturn)}
					/>
				</aside>
			</div>
		</section>
	);
}

interface MicPortfolioChartsProps {
	concentration: MicConcentrationExposureData;
	metrics: MicPortfolioMetrics;
	positions: MicPositionRow[];
}

export function MicPortfolioCharts({
	concentration,
	metrics,
	positions,
}: MicPortfolioChartsProps) {
	const servicingData = useMemo(() => buildServicingSlices(metrics), [metrics]);

	const yieldData = useMemo(
		() => buildYieldContributionSlices(positions, 5),
		[positions]
	);

	const geographyData = useMemo(
		() => topNWithOther(concentration.byGeography, 5),
		[concentration.byGeography]
	);

	const ltvData = useMemo(() => buildLtvBandSlices(positions), [positions]);

	return (
		<section
			aria-labelledby="mic-analytics-heading"
			className="mic-portfolio-charts space-y-8 border-[var(--line)] border-t pt-14 motion-safe:animate-[mic-rise_0.65s_ease-out_both]"
			data-testid="mic-portfolio-charts"
			id="mic-analytics"
			style={{ animationDelay: "90ms" }}
		>
			<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div className="max-w-2xl space-y-2">
					<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.22em]">
						Analytics
					</p>
					<h2
						className="mic-display text-3xl tracking-tight sm:text-[2rem]"
						id="mic-analytics-heading"
					>
						Portfolio geometry
					</h2>
					<p className="text-muted-foreground text-sm leading-relaxed">
						Donut views summarize servicing posture, where coupon income is
						concentrated, regional principal deployment, and how collateral LTV
						bands stack across the book. Weighted portfolio yield stays in the
						summary strip above.
					</p>
				</div>
			</div>

			<div className="grid min-w-0 gap-6 lg:grid-cols-2 xl:grid-cols-4">
				<DonutPanel
					data={servicingData}
					emptyHint="Add funded positions to visualize servicing posture."
					subtitle="Performing MIC principal versus balances flagged overdue or in exception workflows."
					title="Servicing posture"
					tooltipKind="currency"
				/>
				<DonutPanel
					data={yieldData}
					emptyHint="Yield contribution requires positions with a stated rate."
					subtitle="Each slice is principal × stated yield—showing which loans drive coupon mass before expenses."
					title="Yield concentration"
					tooltipKind="yieldMass"
				/>
				<DonutPanel
					data={geographyData}
					emptyHint="Geographic concentration appears once province-level rolls exist."
					subtitle="Outstanding MIC principal by region (top five plus other)."
					title="Regional deployment"
					tooltipKind="percentShare"
					totalBasis={metrics.outstandingPrincipal}
				/>
				<DonutPanel
					data={ltvData}
					emptyHint="LTV bands populate when collateral valuations are attached."
					subtitle="How principal stacks across collateral leverage buckets."
					title="LTV structure"
					tooltipKind="percentShare"
					totalBasis={metrics.outstandingPrincipal}
				/>
			</div>
		</section>
	);
}
