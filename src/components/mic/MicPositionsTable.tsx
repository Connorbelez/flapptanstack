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
		<div className="space-y-4">
			<Input
				onChange={(e) => setSearchQuery(e.target.value)}
				placeholder="Search by property, borrower, or status..."
				value={searchQuery}
			/>

			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>
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
							<TableHead>Borrower</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>
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
							<TableHead>Yield</TableHead>
							<TableHead>LTV</TableHead>
							<TableHead>
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
							<TableHead>Arrears</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredAndSorted.length === 0 ? (
							<TableRow>
								<TableCell
									className="text-center text-muted-foreground"
									colSpan={8}
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
									<TableCell className="font-medium">
										{position.propertyLabel}
									</TableCell>
									<TableCell>{position.borrowerLabel}</TableCell>
									<TableCell>
										<Badge variant="secondary">{position.status}</Badge>
									</TableCell>
									<TableCell>
										{formatCurrency(position.outstandingPrincipal)}
									</TableCell>
									<TableCell>{formatPercent(position.rateYield)}</TableCell>
									<TableCell>{formatPercent(position.ltv)}</TableCell>
									<TableCell>{position.maturityDate}</TableCell>
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
