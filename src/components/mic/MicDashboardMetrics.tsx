import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import type { MicPortfolioMetrics } from "../../../convex/micPortfolio/contracts";

interface MicDashboardMetricsProps {
	metrics: MicPortfolioMetrics;
}

function formatCurrency(value: number): string {
	return `$${value.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number | null): string {
	return value === null ? "N/A" : `${value.toFixed(2)}%`;
}

export function MicDashboardMetrics({ metrics }: MicDashboardMetricsProps) {
	const hasPositions = metrics.activePositionCount > 0;

	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<Card>
				<CardHeader>
					<CardTitle>Outstanding Principal</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="font-semibold text-2xl">
						{formatCurrency(metrics.outstandingPrincipal)}
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Active Positions</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="font-semibold text-2xl">
						{metrics.activePositionCount}
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Weighted Average Yield</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="font-semibold text-2xl">
						{hasPositions ? formatPercent(metrics.weightedAverageYield) : "N/A"}
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Weighted Average LTV</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="font-semibold text-2xl">
						{hasPositions ? formatPercent(metrics.weightedAverageLtv) : "N/A"}
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Arrears Exposure</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="font-semibold text-2xl">
						{formatCurrency(metrics.arrearsExposure)}
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Delinquency Exposure</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="font-semibold text-2xl">
						{formatCurrency(metrics.delinquencyExposure)}
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
