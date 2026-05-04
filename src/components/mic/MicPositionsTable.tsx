import { useMemo, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Input } from "#/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { MIC_MORTGAGE_UNIT_SUPPLY } from "#/lib/mic-ownership";
import type { MicPositionRow } from "../../../convex/micPortfolio/contracts";

interface MicPositionsTableProps {
	onRowClick?: (position: MicPositionRow) => void;
	positions: MicPositionRow[];
}

type SortKey = "propertyLabel" | "outstandingPrincipal" | "maturityDate" | null;
type SortDir = "asc" | "desc";

function formatCurrency(value: number): string {
	return `$${value.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number | null): string {
	return value === null ? "N/A" : `${value.toFixed(2)}%`;
}

function arrearsBadgeVariant(
	status: MicPositionRow["arrearsSignal"]["status"]
): React.ComponentProps<typeof Badge>["variant"] {
	switch (status) {
		case "current":
			return "default";
		case "due":
			return "secondary";
		case "overdue":
			return "destructive";
		case "exception":
			return "outline";
		default:
			return "default";
	}
}

function MicOwnershipLines({ positionUnits }: { positionUnits: number }) {
	const pct = (positionUnits / MIC_MORTGAGE_UNIT_SUPPLY) * 100;
	return (
		<div className="flex flex-col gap-0.5">
			<span className="text-muted-foreground tabular-nums tracking-tight">
				{positionUnits.toLocaleString("en-CA")} /{" "}
				{MIC_MORTGAGE_UNIT_SUPPLY.toLocaleString("en-CA")}
			</span>
			<span className="font-medium text-foreground text-xs tabular-nums tracking-tight">
				{pct.toFixed(2)}%
			</span>
		</div>
	);
}

function paymentBadgeVariant(
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

export function MicPositionsTable({
	positions,
	onRowClick,
}: MicPositionsTableProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [sortKey, setSortKey] = useState<SortKey>(null);
	const [sortDir, setSortDir] = useState<SortDir>("asc");

	const handleSort = (key: SortKey) => {
		if (sortKey === key) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortKey(key);
			setSortDir("asc");
		}
	};

	const filteredAndSorted = useMemo(() => {
		let rows = positions;

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			rows = rows.filter(
				(r) =>
					r.propertyLabel.toLowerCase().includes(q) ||
					r.borrowerLabel.toLowerCase().includes(q) ||
					r.status.toLowerCase().includes(q)
			);
		}

		if (sortKey) {
			rows = [...rows].sort((a, b) => {
				let cmp = 0;
				if (sortKey === "propertyLabel") {
					cmp = a.propertyLabel.localeCompare(b.propertyLabel);
				} else if (sortKey === "outstandingPrincipal") {
					cmp = a.outstandingPrincipal - b.outstandingPrincipal;
				} else if (sortKey === "maturityDate") {
					cmp = a.maturityDate.localeCompare(b.maturityDate);
				}
				return sortDir === "asc" ? cmp : -cmp;
			});
		}

		return rows;
	}, [positions, searchQuery, sortKey, sortDir]);

	return (
		<div className="space-y-4" data-testid="mic-positions-table">
			<Input
				onChange={(e) => setSearchQuery(e.target.value)}
				placeholder="Search by property, borrower, or status..."
				value={searchQuery}
			/>

			<div className="overflow-x-auto rounded-md border">
				<Table className="min-w-[72rem] table-fixed">
					<TableHeader>
						<TableRow>
							<TableHead className="w-[30%] min-w-[14rem] whitespace-normal">
								<button
									className="flex items-center gap-1 font-medium"
									onClick={() => handleSort("propertyLabel")}
									type="button"
								>
									Property
									{sortKey === "propertyLabel" && (
										<span>{sortDir === "asc" ? "↑" : "↓"}</span>
									)}
								</button>
							</TableHead>
							<TableHead className="w-[12%]">Borrower</TableHead>
							<TableHead className="w-[6rem]">Status</TableHead>
							<TableHead className="w-[11rem]">Current payment</TableHead>
							<TableHead className="w-[7rem]">
								<button
									className="flex items-center gap-1 font-medium"
									onClick={() => handleSort("outstandingPrincipal")}
									type="button"
								>
									Principal
									{sortKey === "outstandingPrincipal" && (
										<span>{sortDir === "asc" ? "↑" : "↓"}</span>
									)}
								</button>
							</TableHead>
							<TableHead className="w-[8.5rem] whitespace-normal">
								MIC ownership
							</TableHead>
							<TableHead className="w-[5.5rem] min-w-[5rem]">Yield</TableHead>
							<TableHead className="w-[5.5rem] min-w-[5rem]">LTV</TableHead>
							<TableHead className="w-[6.5rem]">
								<button
									className="flex items-center gap-1 font-medium"
									onClick={() => handleSort("maturityDate")}
									type="button"
								>
									Maturity
									{sortKey === "maturityDate" && (
										<span>{sortDir === "asc" ? "↑" : "↓"}</span>
									)}
								</button>
							</TableHead>
							<TableHead className="w-[5.5rem]">Arrears</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredAndSorted.length === 0 ? (
							<TableRow>
								<TableCell
									className="text-center text-muted-foreground"
									colSpan={10}
								>
									No active MIC positions found.
								</TableCell>
							</TableRow>
						) : (
							filteredAndSorted.map((position) => (
								<TableRow
									className="cursor-pointer"
									key={position.positionAccountId}
									onClick={() => onRowClick?.(position)}
								>
									<TableCell className="min-w-[240px] whitespace-normal font-medium">
										<div className="flex items-center gap-3">
											<div className="size-14 overflow-hidden rounded-md border bg-muted">
												{position.thumbnailUrl ? (
													<img
														alt={position.propertyLabel}
														className="h-full w-full object-cover"
														height={56}
														src={position.thumbnailUrl}
														width={56}
													/>
												) : (
													<div className="flex h-full items-center justify-center text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
														Property
													</div>
												)}
											</div>
											<div className="space-y-1">
												<p>{position.propertyLabel}</p>
												<p className="font-normal text-muted-foreground text-xs capitalize">
													{position.propertySummary.propertyType.replaceAll(
														"_",
														" "
													)}{" "}
													· {position.propertySummary.city},{" "}
													{position.propertySummary.province}
												</p>
											</div>
										</div>
									</TableCell>
									<TableCell className="whitespace-normal break-words align-middle">
										{position.borrowerLabel}
									</TableCell>
									<TableCell className="align-middle">
										<Badge variant="secondary">{position.status}</Badge>
									</TableCell>
									<TableCell className="whitespace-normal align-middle">
										{position.currentPayment ? (
											<div className="rounded-md border border-border/80 bg-muted/25 px-2 py-1.5">
												<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
													<Badge
														className="px-1.5 py-0 font-medium text-[10px] uppercase tracking-wide"
														variant={paymentBadgeVariant(
															position.currentPayment.status
														)}
													>
														{position.currentPayment.status}
													</Badge>
													<span className="font-semibold text-sm tabular-nums tracking-tight">
														{formatCurrency(position.currentPayment.amount)}
													</span>
												</div>
												<p className="mt-1 text-[11px] text-muted-foreground tabular-nums leading-none">
													Due {position.currentPayment.dueDate}
												</p>
											</div>
										) : (
											<span className="text-muted-foreground text-sm">
												No scheduled payment
											</span>
										)}
									</TableCell>
									<TableCell className="align-middle tabular-nums">
										{formatCurrency(position.outstandingPrincipal)}
									</TableCell>
									<TableCell className="whitespace-normal align-middle text-xs leading-snug">
										<MicOwnershipLines positionUnits={position.positionUnits} />
									</TableCell>
									<TableCell className="align-middle tabular-nums">
										{formatPercent(position.rateYield)}
									</TableCell>
									<TableCell className="align-middle tabular-nums">
										{formatPercent(position.ltv)}
									</TableCell>
									<TableCell className="align-middle tabular-nums">
										{position.maturityDate}
									</TableCell>
									<TableCell>
										<Badge
											variant={arrearsBadgeVariant(
												position.arrearsSignal.status
											)}
										>
											{position.arrearsSignal.status}
										</Badge>
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
