import { Badge } from "#/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import type { MicPaymentHistoryRow } from "../../../convex/micPortfolio/contracts";

interface MicPaymentsTableProps {
	payments: MicPaymentHistoryRow[];
}

function formatCurrency(value: number): string {
	return `$${value.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMicPercent(value: number | null): string {
	return value === null ? "—" : `${value.toFixed(2)}%`;
}

function statusBadgeVariant(
	status: string
): React.ComponentProps<typeof Badge>["variant"] {
	if (status === "settled") {
		return "default";
	}
	if (status === "due" || status === "upcoming") {
		return "secondary";
	}
	if (status === "overdue" || status === "exception") {
		return "destructive";
	}
	return "outline";
}

export function MicPaymentsTable({ payments }: MicPaymentsTableProps) {
	return (
		<div className="rounded-md border" data-testid="mic-payments-table">
			<div className="max-h-[520px] overflow-auto">
				<Table>
					<TableHeader className="sticky top-0 z-10 bg-background">
						<TableRow>
							<TableHead>Payment Date</TableHead>
							<TableHead>Property</TableHead>
							<TableHead>Mortgage</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Payment Amount</TableHead>
							<TableHead>MIC share</TableHead>
							<TableHead className="whitespace-nowrap">
								MIC % of gross
							</TableHead>
							<TableHead>Collection</TableHead>
							<TableHead>Transfer</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{payments.length === 0 ? (
							<TableRow>
								<TableCell
									className="py-8 text-center text-muted-foreground"
									colSpan={9}
								>
									No payments are associated with current MIC positions.
								</TableCell>
							</TableRow>
						) : (
							payments.map((payment) => (
								<TableRow key={payment.obligationId}>
									<TableCell className="whitespace-nowrap">
										{payment.dueDate}
									</TableCell>
									<TableCell className="min-w-[220px] font-medium">
										{payment.propertyLabel}
									</TableCell>
									<TableCell className="max-w-[180px] truncate text-muted-foreground text-xs">
										{payment.mortgageId}
									</TableCell>
									<TableCell>
										<Badge variant={statusBadgeVariant(payment.rowStatus)}>
											{payment.rowStatus}
										</Badge>
									</TableCell>
									<TableCell>{formatCurrency(payment.grossAmount)}</TableCell>
									<TableCell>
										{formatCurrency(payment.micShareAmount)}
									</TableCell>
									<TableCell className="text-muted-foreground text-xs tabular-nums">
										{formatMicPercent(payment.micSharePercentOfGross)}
									</TableCell>
									<TableCell>
										{payment.latestCollectionStatus ?? "No attempt"}
									</TableCell>
									<TableCell>
										{payment.latestTransferStatus ?? "No transfer"}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
