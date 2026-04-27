import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import type { MicConcentrationExposureData } from "../../../convex/micPortfolio/contracts";

interface MicConcentrationSectionProps {
	concentration: MicConcentrationExposureData;
}

function formatCurrency(value: number): string {
	return `$${value.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number): string {
	return `${value.toFixed(2)}%`;
}

interface BreakdownTableProps {
	entries: MicConcentrationExposureData["byBorrower"];
	title: string;
}

function BreakdownTable({ entries, title }: BreakdownTableProps) {
	const sorted = [...entries].sort((a, b) => b.sharePercent - a.sharePercent);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm">{title}</CardTitle>
			</CardHeader>
			<CardContent>
				{sorted.length === 0 ? (
					<p className="text-muted-foreground text-sm">No data available.</p>
				) : (
					<div className="rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-[40%]">Label</TableHead>
									<TableHead>Count</TableHead>
									<TableHead>Principal</TableHead>
									<TableHead>Share</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sorted.map((entry) => (
									<TableRow key={entry.key}>
										<TableCell className="font-medium">{entry.label}</TableCell>
										<TableCell>{entry.count}</TableCell>
										<TableCell>
											{formatCurrency(entry.outstandingPrincipal)}
										</TableCell>
										<TableCell>{formatPercent(entry.sharePercent)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export function MicConcentrationSection({
	concentration,
}: MicConcentrationSectionProps) {
	const hasAnyData =
		concentration.byBorrower.length > 0 ||
		concentration.byGeography.length > 0 ||
		concentration.byPropertyType.length > 0 ||
		concentration.byStatus.length > 0;

	if (!hasAnyData) {
		return (
			<div className="space-y-3">
				<h2 className="font-semibold text-lg tracking-tight">
					Concentration Exposure
				</h2>
				<p className="text-muted-foreground text-sm">
					No concentration data available.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<h2 className="font-semibold text-lg tracking-tight">
				Concentration Exposure
			</h2>
			<div className="grid gap-4 sm:grid-cols-2">
				<BreakdownTable
					entries={concentration.byBorrower}
					title="By Borrower"
				/>
				<BreakdownTable
					entries={concentration.byGeography}
					title="By Geography"
				/>
				<BreakdownTable
					entries={concentration.byPropertyType}
					title="By Property Type"
				/>
				<BreakdownTable entries={concentration.byStatus} title="By Status" />
			</div>
		</div>
	);
}
