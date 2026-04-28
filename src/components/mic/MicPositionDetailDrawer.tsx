import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge } from "#/components/ui/badge";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "#/components/ui/sheet";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import type { Id } from "../../../convex/_generated/dataModel";
import type { MicPositionRow } from "../../../convex/micPortfolio/contracts";
import {
	micPaymentsHistoryQueryOptions,
	micPositionDetailQueryOptions,
} from "./query-options";

interface MicPositionDetailDrawerProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	portalId: Id<"portals">;
	position: MicPositionRow | null;
}

function formatCurrency(value: number): string {
	return `$${value.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number | null): string {
	return value === null ? "N/A" : `${value.toFixed(2)}%`;
}

function DrawerContent({
	position,
	portalId,
}: {
	position: MicPositionRow;
	portalId: Id<"portals">;
}) {
	const mortgageId = position.mortgageId as Id<"mortgages">;

	const { data: detailData } = useSuspenseQuery(
		micPositionDetailQueryOptions(portalId, mortgageId)
	);

	const { data: paymentsData } = useSuspenseQuery(
		micPaymentsHistoryQueryOptions(portalId, mortgageId)
	);

	const detail = detailData?.position;
	const payments = paymentsData?.rows ?? [];

	if (!detail) {
		return (
			<p className="px-4 py-6 text-muted-foreground text-sm">
				Unable to load position details.
			</p>
		);
	}

	return (
		<div className="space-y-6 py-4">
			{/* Property */}
			<section className="space-y-2 border-border/70 border-t pt-4">
				<h3 className="font-semibold text-sm">Property</h3>
				<div className="space-y-1 text-sm">
					<p>
						{detail.property.streetAddress}
						{detail.property.unit ? `, Unit ${detail.property.unit}` : ""}
					</p>
					<p>
						{detail.property.city}, {detail.property.province}{" "}
						{detail.property.postalCode}
					</p>
					<p className="text-muted-foreground capitalize">
						{detail.property.propertyType}
					</p>
				</div>
			</section>

			{/* Mortgage Terms */}
			<section className="space-y-2 border-border/70 border-t pt-4">
				<h3 className="font-semibold text-sm">Mortgage Terms</h3>
				<dl className="grid grid-cols-2 gap-x-4 text-sm">
					<div className="border-border/60 border-t py-2">
						<dt className="text-muted-foreground">Principal</dt>
						<dd className="font-medium">
							{formatCurrency(detail.mortgage.principal)}
						</dd>
					</div>
					<div className="border-border/60 border-t py-2">
						<dt className="text-muted-foreground">Interest Rate</dt>
						<dd className="font-medium">
							{detail.mortgage.interestRate.toFixed(2)}%
						</dd>
					</div>
					<div className="border-border/60 border-t py-2">
						<dt className="text-muted-foreground">Rate Type</dt>
						<dd className="font-medium capitalize">
							{detail.mortgage.rateType}
						</dd>
					</div>
					<div className="border-border/60 border-t py-2">
						<dt className="text-muted-foreground">Term</dt>
						<dd className="font-medium">{detail.mortgage.termMonths} months</dd>
					</div>
					<div className="border-border/60 border-t py-2">
						<dt className="text-muted-foreground">Amortization</dt>
						<dd className="font-medium">
							{detail.mortgage.amortizationMonths} months
						</dd>
					</div>
					<div className="border-border/60 border-t py-2">
						<dt className="text-muted-foreground">Payment Amount</dt>
						<dd className="font-medium">
							{formatCurrency(detail.mortgage.paymentAmount)}
						</dd>
					</div>
					<div className="border-border/60 border-t py-2">
						<dt className="text-muted-foreground">Frequency</dt>
						<dd className="font-medium capitalize">
							{detail.mortgage.paymentFrequency}
						</dd>
					</div>
					<div className="border-border/60 border-t py-2">
						<dt className="text-muted-foreground">Lien Position</dt>
						<dd className="font-medium">{detail.mortgage.lienPosition}</dd>
					</div>
					<div className="border-border/60 border-t py-2">
						<dt className="text-muted-foreground">Maturity Date</dt>
						<dd className="font-medium">{detail.mortgage.maturityDate}</dd>
					</div>
					<div className="border-border/60 border-t py-2">
						<dt className="text-muted-foreground">Status</dt>
						<dd className="font-medium">
							<Badge variant="secondary">{detail.mortgage.status}</Badge>
						</dd>
					</div>
				</dl>
			</section>

			{/* Position */}
			<section className="space-y-2 border-border/70 border-t pt-4">
				<h3 className="font-semibold text-sm">Position</h3>
				<dl className="grid grid-cols-2 gap-x-4 text-sm">
					<div className="border-border/60 border-t py-2">
						<dt className="text-muted-foreground">Outstanding Principal</dt>
						<dd className="font-medium">
							{formatCurrency(position.outstandingPrincipal)}
						</dd>
					</div>
					<div className="border-border/60 border-t py-2">
						<dt className="text-muted-foreground">Position Units</dt>
						<dd className="font-medium">{position.positionUnits}</dd>
					</div>
					<div className="border-border/60 border-t py-2">
						<dt className="text-muted-foreground">LTV</dt>
						<dd className="font-medium">{formatPercent(position.ltv)}</dd>
					</div>
					<div className="border-border/60 border-t py-2">
						<dt className="text-muted-foreground">Arrears</dt>
						<dd className="font-medium">
							<Badge variant="secondary">{position.arrearsSignal.status}</Badge>
						</dd>
					</div>
				</dl>
			</section>

			{/* Payment History */}
			<section className="space-y-2 border-border/70 border-t pt-4">
				<h3 className="font-semibold text-sm">Payment History</h3>
				{payments.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No payment history available.
					</p>
				) : (
					<div className="border-border/70 border-y">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Due Date</TableHead>
									<TableHead>Gross</TableHead>
									<TableHead>MIC Share</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Collection</TableHead>
									<TableHead>Transfer</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{payments.map((payment) => (
									<TableRow key={payment.obligationId}>
										<TableCell>{payment.dueDate}</TableCell>
										<TableCell>{formatCurrency(payment.grossAmount)}</TableCell>
										<TableCell>
											{formatCurrency(payment.micShareAmount)}
										</TableCell>
										<TableCell>
											<Badge variant="secondary">{payment.rowStatus}</Badge>
										</TableCell>
										<TableCell>
											{payment.latestCollectionStatus ?? "—"}
										</TableCell>
										<TableCell>{payment.latestTransferStatus ?? "—"}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</section>

			{position.drilldownIds.listingId && (
				<div className="pt-2">
					<Link
						className="text-primary text-sm underline-offset-4 hover:underline"
						params={{
							listingId: position.drilldownIds.listingId,
						}}
						to="/listings/$listingId"
					>
						View full mortgage detail →
					</Link>
				</div>
			)}
		</div>
	);
}

export function MicPositionDetailDrawer({
	position,
	open,
	onOpenChange,
	portalId,
}: MicPositionDetailDrawerProps) {
	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent className="w-full overflow-y-auto sm:max-w-lg">
				<SheetHeader>
					<SheetTitle>
						{position?.propertyLabel ?? "Position Detail"}
					</SheetTitle>
				</SheetHeader>

				{position && <DrawerContent portalId={portalId} position={position} />}
			</SheetContent>
		</Sheet>
	);
}
