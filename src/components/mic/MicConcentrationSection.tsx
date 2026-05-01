import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import type { MicConcentrationExposureData } from "../../../convex/micPortfolio/contracts";

interface MicConcentrationSectionProps {
	concentration: MicConcentrationExposureData;
}

function formatCurrency(value: number): string {
	return `$${value.toLocaleString("en-CA", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

function formatPercent(value: number): string {
	return `${value.toFixed(2)}%`;
}

interface BreakdownTableProps {
	entries: MicConcentrationExposureData["byBorrower"];
}

function BreakdownTable({ entries }: BreakdownTableProps) {
	const sorted = [...entries].sort((a, b) => b.sharePercent - a.sharePercent);

	if (sorted.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">No rows in this view.</p>
		);
	}

	return (
		<div className="overflow-x-auto border border-border">
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
			<div
				className="space-y-3 border-border border-t pt-14"
				data-testid="mic-concentration"
			>
				<h2 className="mic-display text-2xl tracking-tight">
					Concentration exposure
				</h2>
				<p className="text-muted-foreground text-sm">
					No concentration data available.
				</p>
			</div>
		);
	}

	return (
		<div
			className="space-y-6 border-border border-t pt-14"
			data-testid="mic-concentration"
		>
			<div className="max-w-2xl space-y-2">
				<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
					Limits & breadth
				</p>
				<h2 className="mic-display text-2xl tracking-tight">
					Concentration exposure
				</h2>
				<p className="text-muted-foreground text-sm leading-relaxed">
					MIC principal share by borrower, region, collateral type, and loan
					status.
				</p>
			</div>
			<Tabs className="w-full" defaultValue="borrower">
				<TabsList className="flex h-auto w-full flex-wrap gap-0 border-border border-b bg-transparent p-0">
					<TabsTrigger
						className="relative rounded-none border-0 border-transparent px-0 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-[0.12em] shadow-none data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-foreground"
						value="borrower"
					>
						Borrower
					</TabsTrigger>
					<TabsTrigger
						className="relative ml-6 rounded-none border-0 border-transparent px-0 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-[0.12em] shadow-none data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-foreground sm:ml-8"
						value="geography"
					>
						Geography
					</TabsTrigger>
					<TabsTrigger
						className="relative ml-6 rounded-none border-0 border-transparent px-0 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-[0.12em] shadow-none data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-foreground sm:ml-8"
						value="property"
					>
						Property type
					</TabsTrigger>
					<TabsTrigger
						className="relative ml-6 rounded-none border-0 border-transparent px-0 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-[0.12em] shadow-none data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-foreground sm:ml-8"
						value="status"
					>
						Status
					</TabsTrigger>
				</TabsList>
				<TabsContent className="mt-4" value="borrower">
					<BreakdownTable entries={concentration.byBorrower} />
				</TabsContent>
				<TabsContent className="mt-4" value="geography">
					<BreakdownTable entries={concentration.byGeography} />
				</TabsContent>
				<TabsContent className="mt-4" value="property">
					<BreakdownTable entries={concentration.byPropertyType} />
				</TabsContent>
				<TabsContent className="mt-4" value="status">
					<BreakdownTable entries={concentration.byStatus} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
