import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { MicMaturityLadderBucket } from "../../../convex/micPortfolio/contracts";

interface MicMaturityLadderProps {
	buckets: MicMaturityLadderBucket[];
	portfolioOutstandingPrincipal: number;
}

function formatCurrency(value: number): string {
	return `$${value.toLocaleString("en-CA", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

const bucketOrder: MicMaturityLadderBucket["bucket"][] = [
	"past_due",
	"0_6_months",
	"6_12_months",
	"12_24_months",
	"24_plus_months",
	"unknown",
];

const bucketLabels: Record<MicMaturityLadderBucket["bucket"], string> = {
	past_due: "Past due",
	"0_6_months": "0–6 mo",
	"6_12_months": "6–12 mo",
	"12_24_months": "12–24 mo",
	"24_plus_months": "24+ mo",
	unknown: "Unknown",
};

interface ChartRow {
	bucket: MicMaturityLadderBucket["bucket"];
	count: number;
	label: string;
	outstandingPrincipal: number;
	sharePercent: number;
}

function RichTooltipBody({
	payload,
	portfolioOutstandingPrincipal,
}: {
	payload: ChartRow;
	portfolioOutstandingPrincipal: number;
}) {
	return (
		<div className="min-w-[200px] space-y-2 px-1 py-0.5">
			<p className="font-semibold text-foreground text-sm">{payload.label}</p>
			<dl className="space-y-1.5 text-xs">
				<div className="flex justify-between gap-6">
					<dt className="text-muted-foreground">Positions</dt>
					<dd className="font-medium tabular-nums">{payload.count}</dd>
				</div>
				<div className="flex justify-between gap-6">
					<dt className="text-muted-foreground">MIC principal</dt>
					<dd className="font-medium tabular-nums">
						{formatCurrency(payload.outstandingPrincipal)}
					</dd>
				</div>
				<div className="flex justify-between gap-6">
					<dt className="text-muted-foreground">Share of portfolio</dt>
					<dd className="font-medium tabular-nums">
						{portfolioOutstandingPrincipal > 0
							? `${payload.sharePercent.toFixed(2)}%`
							: "—"}
					</dd>
				</div>
			</dl>
		</div>
	);
}

export function MicMaturityLadder({
	buckets,
	portfolioOutstandingPrincipal,
}: MicMaturityLadderProps) {
	const bucketMap = useMemo(
		() => new Map(buckets.map((b) => [b.bucket, b])),
		[buckets]
	);

	const chartData: ChartRow[] = useMemo(
		() =>
			bucketOrder.map((bucket) => {
				const row = bucketMap.get(bucket);
				const outstandingPrincipal = row?.outstandingPrincipal ?? 0;
				const count = row?.count ?? 0;
				const sharePercent =
					portfolioOutstandingPrincipal > 0
						? (outstandingPrincipal / portfolioOutstandingPrincipal) * 100
						: 0;
				return {
					bucket,
					count,
					label: bucketLabels[bucket],
					outstandingPrincipal,
					sharePercent,
				};
			}),
		[bucketMap, portfolioOutstandingPrincipal]
	);

	const hasAnyData = buckets.some((b) => b.count > 0);
	const [pinnedBucket, setPinnedBucket] = useState<
		MicMaturityLadderBucket["bucket"] | null
	>(null);
	const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearLongPress = useCallback(() => {
		if (longPressTimer.current) {
			clearTimeout(longPressTimer.current);
			longPressTimer.current = null;
		}
	}, []);

	useEffect(() => () => clearLongPress(), [clearLongPress]);

	const handleBarLongPressStart = useCallback(
		(bucket: MicMaturityLadderBucket["bucket"]) => {
			clearLongPress();
			longPressTimer.current = setTimeout(() => {
				setPinnedBucket((prev) => (prev === bucket ? null : bucket));
			}, 450);
		},
		[clearLongPress]
	);

	const pinnedRow = pinnedBucket
		? chartData.find((r) => r.bucket === pinnedBucket)
		: null;

	if (!hasAnyData) {
		return (
			<div className="space-y-3">
				<h2 className="mic-display text-2xl tracking-tight">Maturity ladder</h2>
				<p className="text-muted-foreground text-sm">
					No maturity data available.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="max-w-2xl space-y-2">
				<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
					Horizon
				</p>
				<h2 className="mic-display text-2xl tracking-tight">Maturity ladder</h2>
				<p className="text-muted-foreground text-sm leading-relaxed">
					Outstanding MIC principal by time to maturity. Hover a bar for detail;
					touch and hold to pin (tap again to clear).
				</p>
			</div>
			<div className="@container h-56 min-h-[14rem] w-full">
				<ResponsiveContainer height="100%" width="100%">
					<BarChart
						data={chartData}
						margin={{ bottom: 8, left: 4, right: 8, top: 8 }}
					>
						<CartesianGrid
							className="stroke-border"
							strokeDasharray="4 4"
							vertical={false}
						/>
						<XAxis
							axisLine={false}
							dataKey="label"
							tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
							tickLine={false}
						/>
						<YAxis axisLine={false} hide tickLine={false} width={0} />
						<Tooltip
							content={({ active, payload }) => {
								if (!(active && payload?.[0])) {
									return null;
								}
								const row = payload[0].payload as ChartRow;
								return (
									<div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
										<RichTooltipBody
											payload={row}
											portfolioOutstandingPrincipal={
												portfolioOutstandingPrincipal
											}
										/>
									</div>
								);
							}}
							cursor={{
								fill: "color-mix(in oklab, var(--muted) 35%, transparent)",
							}}
						/>
						<Bar dataKey="outstandingPrincipal" radius={[0, 0, 0, 0]}>
							{chartData.map((entry) => (
								<Cell
									className="outline-none"
									fill={
										entry.bucket === "past_due"
											? "var(--destructive)"
											: "color-mix(in oklab, var(--foreground) 55%, var(--muted-foreground) 45%)"
									}
									key={entry.bucket}
									onTouchCancel={clearLongPress}
									onTouchEnd={clearLongPress}
									onTouchStart={() => handleBarLongPressStart(entry.bucket)}
								/>
							))}
						</Bar>
					</BarChart>
				</ResponsiveContainer>
			</div>
			{pinnedRow ? (
				<div
					aria-live="polite"
					className="rounded-lg bg-muted/40 px-4 py-3 text-sm md:hidden"
				>
					<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
						Pinned bucket
					</p>
					<RichTooltipBody
						payload={pinnedRow}
						portfolioOutstandingPrincipal={portfolioOutstandingPrincipal}
					/>
				</div>
			) : null}
		</div>
	);
}
