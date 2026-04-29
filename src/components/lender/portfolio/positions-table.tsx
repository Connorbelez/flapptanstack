"use client";

import { ArrowUpRight, Search } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "#/components/ui/empty";
import { Input } from "#/components/ui/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "#/components/ui/native-select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import {
	formatPortfolioCurrency,
	formatPortfolioDate,
	formatPortfolioEnumLabel,
	formatPortfolioFractions,
	formatPortfolioPercent,
} from "./portfolio-formatters";
import type {
	LenderPortfolioSearchState,
	PortfolioPositionRow,
	PortfolioPositionSortKey,
} from "./portfolio-types";

const POSITION_SORT_LABELS: Record<PortfolioPositionSortKey, string> = {
	"next-payment-latest": "Next payment: latest",
	"next-payment-soonest": "Next payment: soonest",
	"payment-highest": "Payment amount: high to low",
	"payment-lowest": "Payment amount: low to high",
	"property-a-z": "Property: A to Z",
};

const STATUS_TOKEN_SPLIT = /[^a-z0-9]+/;

interface PositionsTableProps {
	onPositionQueryChange: (value: string | undefined) => void;
	onPositionSortChange: (value: PortfolioPositionSortKey) => void;
	onPositionStatusChange: (value: string | undefined) => void;
	onSelectPosition: (mortgageId: string) => void;
	rows: readonly PortfolioPositionRow[];
	search: LenderPortfolioSearchState;
	statusOptions: readonly string[];
	totalRows: number;
}

function getStatusVariant(status: string) {
	const tokens = status.toLowerCase().split(STATUS_TOKEN_SPLIT);
	if (
		tokens.some((token) => ["default", "delinquent", "missed"].includes(token))
	) {
		return "destructive" as const;
	}
	if (tokens.some((token) => ["active", "current"].includes(token))) {
		return "secondary" as const;
	}
	return "outline" as const;
}

export function PositionsTable({
	onPositionQueryChange,
	onPositionSortChange,
	onPositionStatusChange,
	onSelectPosition,
	rows,
	search,
	statusOptions,
	totalRows,
}: PositionsTableProps) {
	const isFiltered =
		Boolean(search.positionQuery) || Boolean(search.positionStatus);

	return (
		<Card className="gap-0 overflow-hidden" data-testid="positions-ledger">
			<CardHeader className="gap-4 border-border/70 border-b py-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="space-y-1.5">
						<CardTitle>Positions ledger</CardTitle>
						<CardDescription>
							The first operational table in the command center, grounded in the
							upstream position and renewal contracts.
						</CardDescription>
					</div>
					<Badge variant="outline">
						{rows.length} of {totalRows} positions shown
					</Badge>
				</div>
				<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_14rem]">
					<div className="relative">
						<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							aria-label="Search positions"
							className="pl-9"
							onChange={(event) =>
								onPositionQueryChange(event.currentTarget.value || undefined)
							}
							placeholder="Filter by property, status, or renewal"
							value={search.positionQuery ?? ""}
						/>
					</div>
					<NativeSelect
						aria-label="Filter positions by status"
						onChange={(event) =>
							onPositionStatusChange(
								event.currentTarget.value === "all"
									? undefined
									: event.currentTarget.value
							)
						}
						size="sm"
						value={search.positionStatus ?? "all"}
					>
						<NativeSelectOption value="all">All statuses</NativeSelectOption>
						{statusOptions.map((status) => (
							<NativeSelectOption key={status} value={status}>
								{formatPortfolioEnumLabel(status)}
							</NativeSelectOption>
						))}
					</NativeSelect>
					<NativeSelect
						aria-label="Sort positions"
						onChange={(event) =>
							onPositionSortChange(
								event.currentTarget.value as PortfolioPositionSortKey
							)
						}
						size="sm"
						value={search.positionSort}
					>
						{Object.entries(POSITION_SORT_LABELS).map(([value, label]) => (
							<NativeSelectOption key={value} value={value}>
								{label}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</div>
			</CardHeader>
			<CardContent className="px-0 pb-0">
				{rows.length > 0 ? (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="pl-6">Property</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Holding</TableHead>
								<TableHead>Renewal</TableHead>
								<TableHead>Next payment</TableHead>
								<TableHead className="text-right">Payment amount</TableHead>
								<TableHead className="pr-6 text-right">Detail</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow
									className="cursor-pointer"
									data-testid={`position-row-${row.mortgageId}`}
									key={row.mortgageId}
									onClick={() => onSelectPosition(row.mortgageId)}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											onSelectPosition(row.mortgageId);
										}
									}}
									tabIndex={0}
								>
									<TableCell className="pl-6">
										<div className="flex items-center gap-3">
											<div className="size-12 overflow-hidden rounded-lg border border-border/70 bg-muted">
												{row.thumbnailUrl ? (
													<img
														alt={row.propertyLabel}
														className="h-full w-full object-cover"
														height={48}
														src={row.thumbnailUrl}
														width={48}
													/>
												) : (
													<div className="flex h-full items-center justify-center bg-muted text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
														Home
													</div>
												)}
											</div>
											<div className="space-y-1">
												<p className="font-medium text-sm">
													{row.propertyLabel}
												</p>
												<p className="text-muted-foreground text-xs">
													{formatPortfolioPercent(row.positionPercent)} held
												</p>
											</div>
										</div>
									</TableCell>
									<TableCell>
										<div className="space-y-1">
											<Badge variant={getStatusVariant(row.mortgageStatus)}>
												{formatPortfolioEnumLabel(row.mortgageStatus)}
											</Badge>
											{row.renewalIntentStatus ? (
												<p className="text-muted-foreground text-xs">
													Intent:{" "}
													{formatPortfolioEnumLabel(row.renewalIntentStatus)}
												</p>
											) : null}
										</div>
									</TableCell>
									<TableCell>
										<div className="space-y-1 text-sm">
											<p>{formatPortfolioFractions(row.fractionCount)}</p>
											<p className="text-muted-foreground text-xs">
												{formatPortfolioCurrency(row.estimatedPositionValue)}
											</p>
										</div>
									</TableCell>
									<TableCell>
										<div className="space-y-1 text-sm">
											<p>{row.renewalTimingLabel}</p>
											<p className="text-muted-foreground text-xs">
												{row.nextPaymentDate
													? `Next pay ${formatPortfolioDate(row.nextPaymentDate)}`
													: "Next payment unavailable"}
											</p>
										</div>
									</TableCell>
									<TableCell>
										{formatPortfolioDate(row.nextPaymentDate)}
									</TableCell>
									<TableCell className="text-right font-medium">
										{formatPortfolioCurrency(row.paymentAmount)}
									</TableCell>
									<TableCell className="pr-6 text-right">
										<Button
											aria-label={`Open position details for ${row.propertyLabel}`}
											size="sm"
											variant="ghost"
										>
											Open
											<ArrowUpRight className="size-4" />
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				) : (
					<div className="p-6">
						<Empty className="border border-border/70 border-dashed">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<Search className="size-5" />
								</EmptyMedia>
								<EmptyTitle>
									{isFiltered
										? "No positions match these filters"
										: "No active positions yet"}
								</EmptyTitle>
								<EmptyDescription>
									{isFiltered
										? "Adjust the route-level search, status filter, or sort order to reveal matching holdings."
										: "The command-center route stays stable even when the lender has no active holdings."}
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
