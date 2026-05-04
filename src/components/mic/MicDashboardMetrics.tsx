import type { ReactNode } from "react";
import {
	buildReturnAnalytics,
	type MicReturnAnalytics,
} from "#/components/mic/MicPortfolioCharts";
import type {
	MicLendingFeeMetrics,
	MicPortfolioMetrics,
	MicReturnSeriesRow,
} from "../../../convex/micPortfolio/contracts";

interface MicDashboardMetricsProps {
	lendingFeeMetrics?: MicLendingFeeMetrics;
	metrics: MicPortfolioMetrics;
	returnSeries?: MicReturnSeriesRow[];
}

const PRINCIPAL_SPARKLINE_BARS = [
	{ height: 0.42, id: "opening" },
	{ height: 0.52, id: "early" },
	{ height: 0.48, id: "dip" },
	{ height: 0.68, id: "mid" },
	{ height: 0.74, id: "late" },
	{ height: 0.88, id: "current" },
	{ height: 1, id: "projected" },
] as const;

const ACTIVE_DOT_IDS = Array.from(
	{ length: 12 },
	(_, index) => `active-dot-${index + 1}`
);

const EMPTY_DOT_IDS = Array.from(
	{ length: 6 },
	(_, index) => `empty-dot-${index + 1}`
);

function formatCurrency(value: number): string {
	return `$${value.toLocaleString("en-CA", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

function formatPercent(value: number | null): string {
	return value === null ? "N/A" : `${value.toFixed(2)}%`;
}

function MetricFrame({
	children,
	className = "",
	delay,
}: {
	children: ReactNode;
	className?: string;
	delay: number;
}) {
	return (
		<div
			className={`group relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-sm backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--lagoon-deep)_45%,var(--line))] hover:shadow-[0_18px_45px_rgba(23,58,64,0.12)] motion-safe:animate-[mic-rise_0.55s_ease-out_both] ${className}`}
			style={{ animationDelay: `${delay}ms` }}
		>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--palm),transparent)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
			/>
			{children}
		</div>
	);
}

function ValueLabel({ label, value }: { label: string; value: string }) {
	return (
		<>
			<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
				{label}
			</p>
			<p className="mt-2 font-medium text-2xl tabular-nums tracking-tight">
				{value}
			</p>
		</>
	);
}

function PrincipalSparkline({ value }: { value: number }) {
	return (
		<div aria-hidden className="mt-10 flex h-14 items-end gap-2">
			{PRINCIPAL_SPARKLINE_BARS.map(({ height, id }) => (
				<div
					className="flex-1 rounded-t-sm bg-[linear-gradient(180deg,var(--palm),color-mix(in_oklab,var(--lagoon-deep)_62%,transparent))] opacity-80 transition-all duration-300 group-hover:opacity-100"
					key={`${value}-${id}`}
					style={{ height: `${height * 100}%` }}
				/>
			))}
		</div>
	);
}

function DotMatrix({ count }: { count: number }) {
	const dots = ACTIVE_DOT_IDS.slice(0, Math.min(Math.max(count, 0), 12));
	return (
		<div
			aria-label={`${count} active positions`}
			className="mt-5 grid grid-cols-6 gap-1.5"
			role="img"
		>
			{dots.length > 0
				? dots.map((id) => (
						<span
							className="h-2.5 rounded-full bg-[var(--palm)] opacity-75 transition-opacity group-hover:opacity-100"
							key={id}
						/>
					))
				: EMPTY_DOT_IDS.map((id) => (
						<span
							className="h-2.5 rounded-full bg-[var(--line)] opacity-45"
							key={id}
						/>
					))}
		</div>
	);
}

function HorizontalGauge({
	label,
	percent,
}: {
	label: string;
	percent: number | null;
}) {
	const width = Math.max(0, Math.min(percent ?? 0, 100));
	return (
		<div
			aria-label={label}
			aria-valuemax={100}
			aria-valuemin={0}
			aria-valuenow={width}
			className="mt-5"
			role="meter"
		>
			<div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
				<div
					className="h-full rounded-full bg-[linear-gradient(90deg,var(--palm),var(--lagoon-deep))] transition-[width] duration-700"
					style={{ width: `${width}%` }}
				/>
			</div>
			<div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
				<span>0%</span>
				<span>100%</span>
			</div>
		</div>
	);
}

function ExposureScale({
	exposure,
	total,
}: {
	exposure: number;
	total: number;
}) {
	const share = total > 0 ? Math.min(100, (exposure / total) * 100) : 0;
	return (
		<div className="mt-5">
			<div className="flex items-center gap-2">
				<div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
					<div
						className="h-full rounded-full bg-[var(--destructive)]/70 transition-[width] duration-700"
						style={{ width: `${share}%` }}
					/>
				</div>
				<span className="w-12 text-right text-[10px] text-muted-foreground tabular-nums">
					{share.toFixed(1)}%
				</span>
			</div>
		</div>
	);
}

function ReturnBars({ analytics }: { analytics: MicReturnAnalytics }) {
	const max = Math.max(analytics.currentMonthReturn, analytics.ytdReturn, 1);
	return (
		<div className="mt-5 grid gap-3">
			<div>
				<div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
					<span>{analytics.currentMonthPeriod ?? "Current month"}</span>
					<span>{formatPercent(analytics.currentMonthApr)} APR</span>
				</div>
				<div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
					<div
						className="h-full rounded-full bg-[var(--lagoon-deep)]"
						style={{
							width: `${Math.max(4, (analytics.currentMonthReturn / max) * 100)}%`,
						}}
					/>
				</div>
			</div>
			<div>
				<div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
					<span>{analytics.ytdPeriodLabel}</span>
					<span>{formatPercent(analytics.ytdApr)} APR</span>
				</div>
				<div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
					<div
						className="h-full rounded-full bg-[var(--palm)]"
						style={{
							width: `${Math.max(4, (analytics.ytdReturn / max) * 100)}%`,
						}}
					/>
				</div>
			</div>
		</div>
	);
}

export function MicDashboardMetrics({
	lendingFeeMetrics,
	metrics,
	returnSeries,
}: MicDashboardMetricsProps) {
	const hasPositions = metrics.activePositionCount > 0;
	const analytics = buildReturnAnalytics({
		lendingFeeMetrics,
		metrics,
		returnSeries,
	});

	return (
		<div
			className="mic-dashboard-metrics grid gap-4 lg:grid-cols-12"
			data-testid="mic-dashboard-metrics"
		>
			<MetricFrame
				className="min-h-[320px] p-7 lg:col-span-7 lg:row-span-2 lg:p-10"
				delay={0}
			>
				<div className="relative z-10 flex h-full flex-col justify-between">
					<div>
						<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.22em]">
							Outstanding principal
						</p>
						<p className="mic-display mt-8 text-5xl tracking-tight sm:text-6xl lg:text-[4.3rem] lg:leading-none">
							<span className="tabular-nums">
								{formatCurrency(metrics.outstandingPrincipal)}
							</span>
						</p>
					</div>
					<PrincipalSparkline value={metrics.outstandingPrincipal} />
				</div>
			</MetricFrame>

			<MetricFrame className="p-5 lg:col-span-2" delay={45}>
				<ValueLabel
					label="Active positions"
					value={String(metrics.activePositionCount)}
				/>
				<DotMatrix count={metrics.activePositionCount} />
			</MetricFrame>

			<MetricFrame className="p-5 lg:col-span-3" delay={70}>
				<ValueLabel
					label="Weighted avg yield"
					value={
						hasPositions ? formatPercent(metrics.weightedAverageYield) : "N/A"
					}
				/>
				<HorizontalGauge
					label="Weighted average yield gauge"
					percent={metrics.weightedAverageYield}
				/>
			</MetricFrame>

			<MetricFrame className="p-5 lg:col-span-2" delay={95}>
				<ValueLabel
					label="Weighted avg LTV"
					value={
						hasPositions ? formatPercent(metrics.weightedAverageLtv) : "N/A"
					}
				/>
				<HorizontalGauge
					label="Weighted average LTV gauge"
					percent={metrics.weightedAverageLtv}
				/>
			</MetricFrame>

			<MetricFrame className="p-5 lg:col-span-3" delay={120}>
				<ValueLabel
					label="Projected yield earned"
					value={formatCurrency(analytics.projectedYieldReturn)}
				/>
				<p className="mt-2 text-muted-foreground text-xs">
					{formatPercent(analytics.projectedYieldEarned)} over{" "}
					{formatCurrency(analytics.projectedYieldInvestment)} projected MIC
					investment
				</p>
				<HorizontalGauge
					label="Projected yield earned gauge"
					percent={analytics.projectedYieldEarned}
				/>
			</MetricFrame>

			<MetricFrame className="p-5 lg:col-span-4" delay={145}>
				<ValueLabel
					label="Projected return pace"
					value={formatCurrency(analytics.currentMonthReturn)}
				/>
				<p className="mt-2 text-muted-foreground text-xs">
					Current month and {analytics.ytdPeriodLabel} return with annualized
					APR.
				</p>
				<ReturnBars analytics={analytics} />
			</MetricFrame>

			<MetricFrame className="p-5 lg:col-span-4" delay={170}>
				<ValueLabel
					label="Arrears exposure"
					value={formatCurrency(metrics.arrearsExposure)}
				/>
				<ExposureScale
					exposure={metrics.arrearsExposure}
					total={metrics.outstandingPrincipal}
				/>
			</MetricFrame>

			<MetricFrame className="p-5 lg:col-span-4" delay={195}>
				<ValueLabel
					label="Delinquency exposure"
					value={formatCurrency(metrics.delinquencyExposure)}
				/>
				<ExposureScale
					exposure={metrics.delinquencyExposure}
					total={metrics.outstandingPrincipal}
				/>
			</MetricFrame>
		</div>
	);
}
