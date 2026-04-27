import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import type { MicMaturityLadderBucket } from "../../../convex/micPortfolio/contracts";

interface MicMaturityLadderProps {
	buckets: MicMaturityLadderBucket[];
}

function formatCurrency(value: number): string {
	return `$${value.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
	past_due: "Past Due",
	"0_6_months": "0–6 Months",
	"6_12_months": "6–12 Months",
	"12_24_months": "12–24 Months",
	"24_plus_months": "24+ Months",
	unknown: "Unknown",
};

export function MicMaturityLadder({ buckets }: MicMaturityLadderProps) {
	const bucketMap = new Map(buckets.map((b) => [b.bucket, b]));

	const orderedBuckets = bucketOrder.map((bucket) => ({
		bucket,
		label: bucketLabels[bucket],
		count: bucketMap.get(bucket)?.count ?? 0,
		outstandingPrincipal: bucketMap.get(bucket)?.outstandingPrincipal ?? 0,
	}));

	const hasAnyData = buckets.some((b) => b.count > 0);

	return (
		<div className="space-y-3">
			<h2 className="font-semibold text-lg tracking-tight">Maturity Ladder</h2>
			{hasAnyData ? (
				<div className="rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Time Bucket</TableHead>
								<TableHead>Count</TableHead>
								<TableHead>Outstanding Principal</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{orderedBuckets.map((row) => (
								<TableRow key={row.bucket}>
									<TableCell className="font-medium">{row.label}</TableCell>
									<TableCell>{row.count}</TableCell>
									<TableCell>
										{formatCurrency(row.outstandingPrincipal)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			) : (
				<p className="text-muted-foreground text-sm">
					No maturity data available.
				</p>
			)}
		</div>
	);
}
