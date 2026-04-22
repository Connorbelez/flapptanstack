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
} from "./portfolio-formatters";
import type {
	LenderPortfolioSearchState,
	PortfolioPaymentRow,
	PortfolioPaymentSortKey,
} from "./portfolio-types";

const PAYMENT_SORT_LABELS: Record<PortfolioPaymentSortKey, string> = {
	"amount-asc": "Lender share: low to high",
	"amount-desc": "Lender share: high to low",
	"due-asc": "Due date: soonest",
	"due-desc": "Due date: latest",
	"status-a-z": "Status: A to Z",
};

interface PaymentActivityTableProps {
	onPaymentDateFromChange: (value: string | undefined) => void;
	onPaymentDateToChange: (value: string | undefined) => void;
	onPaymentQueryChange: (value: string | undefined) => void;
	onPaymentSortChange: (value: PortfolioPaymentSortKey) => void;
	onPaymentStatusChange: (value: string | undefined) => void;
	onSelectPayment: (obligationId: string) => void;
	rows: readonly PortfolioPaymentRow[];
	search: LenderPortfolioSearchState;
	statusOptions: readonly string[];
	totalRows: number;
}

function getStatusVariant(status: string | null | undefined) {
	if (!status) {
		return "outline" as const;
	}

	const normalized = status.toLowerCase();
	if (
		normalized.includes("failed") ||
		normalized.includes("default") ||
		normalized.includes("overdue") ||
		normalized.includes("reversed")
	) {
		return "destructive" as const;
	}
	if (
		normalized.includes("settled") ||
		normalized.includes("paid") ||
		normalized.includes("complete")
	) {
		return "secondary" as const;
	}
	return "outline" as const;
}

export function PaymentActivityTable({
	onPaymentDateFromChange,
	onPaymentDateToChange,
	onPaymentQueryChange,
	onPaymentSortChange,
	onPaymentStatusChange,
	onSelectPayment,
	rows,
	search,
	statusOptions,
	totalRows,
}: PaymentActivityTableProps) {
	const isFiltered =
		Boolean(search.paymentDateFrom) ||
		Boolean(search.paymentDateTo) ||
		Boolean(search.paymentQuery) ||
		Boolean(search.paymentStatus);

	return (
		<Card
			className="gap-0 overflow-hidden"
			data-testid="payment-activity-ledger"
		>
			<CardHeader className="gap-4 border-border/70 border-b py-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="space-y-1.5">
						<CardTitle>Payment activity</CardTitle>
						<CardDescription>
							Individual payment rows, not aggregate rollups, with route-owned
							filtering and ordering controls.
						</CardDescription>
					</div>
					<Badge variant="outline">
						{rows.length} of {totalRows} payments shown
					</Badge>
				</div>
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_11rem_11rem_12rem_14rem]">
					<div className="relative">
						<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							aria-label="Search payments"
							className="pl-9"
							onChange={(event) =>
								onPaymentQueryChange(event.currentTarget.value || undefined)
							}
							placeholder="Filter by property, payment number, or status"
							value={search.paymentQuery ?? ""}
						/>
					</div>
					<Input
						aria-label="Filter payments from due date"
						onChange={(event) =>
							onPaymentDateFromChange(event.currentTarget.value || undefined)
						}
						type="date"
						value={search.paymentDateFrom ?? ""}
					/>
					<Input
						aria-label="Filter payments to due date"
						onChange={(event) =>
							onPaymentDateToChange(event.currentTarget.value || undefined)
						}
						type="date"
						value={search.paymentDateTo ?? ""}
					/>
					<NativeSelect
						aria-label="Filter payments by status"
						onChange={(event) =>
							onPaymentStatusChange(
								event.currentTarget.value === "all"
									? undefined
									: event.currentTarget.value
							)
						}
						size="sm"
						value={search.paymentStatus ?? "all"}
					>
						<NativeSelectOption value="all">All statuses</NativeSelectOption>
						{statusOptions.map((status) => (
							<NativeSelectOption key={status} value={status}>
								{formatPortfolioEnumLabel(status)}
							</NativeSelectOption>
						))}
					</NativeSelect>
					<NativeSelect
						aria-label="Sort payments"
						onChange={(event) =>
							onPaymentSortChange(
								event.currentTarget.value as PortfolioPaymentSortKey
							)
						}
						size="sm"
						value={search.paymentSort}
					>
						{Object.entries(PAYMENT_SORT_LABELS).map(([value, label]) => (
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
								<TableHead className="pl-6">Payment</TableHead>
								<TableHead>Due date</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Collection</TableHead>
								<TableHead className="text-right">Lender share</TableHead>
								<TableHead className="pr-6 text-right">Detail</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow
									className="cursor-pointer"
									data-testid={`payment-row-${row.obligationId}`}
									key={row.obligationId}
									onClick={() => onSelectPayment(row.obligationId)}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											onSelectPayment(row.obligationId);
										}
									}}
									tabIndex={0}
								>
									<TableCell className="pl-6">
										<div className="space-y-1">
											<p className="font-medium text-sm">{row.propertyLabel}</p>
											<p className="text-muted-foreground text-xs">
												Payment #{row.paymentNumber} •{" "}
												{formatPortfolioEnumLabel(row.type)}
											</p>
										</div>
									</TableCell>
									<TableCell>{formatPortfolioDate(row.dueDate)}</TableCell>
									<TableCell>
										<div className="space-y-1">
											<Badge variant={getStatusVariant(row.rowStatus)}>
												{formatPortfolioEnumLabel(row.rowStatus)}
											</Badge>
											<p className="text-muted-foreground text-xs">
												Obligation{" "}
												{formatPortfolioEnumLabel(row.obligationStatus)}
											</p>
										</div>
									</TableCell>
									<TableCell>
										<div className="space-y-1 text-xs">
											<p>
												Latest collection:{" "}
												{formatPortfolioEnumLabel(row.latestCollectionStatus)}
											</p>
											<p className="text-muted-foreground">
												Transfer{" "}
												{formatPortfolioEnumLabel(row.latestTransferStatus)}
											</p>
										</div>
									</TableCell>
									<TableCell className="text-right font-medium">
										{formatPortfolioCurrency(row.lenderShareAmount)}
									</TableCell>
									<TableCell className="pr-6 text-right">
										<Button
											aria-label={`Open payment details for ${row.propertyLabel}`}
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
										? "No payments match these filters"
										: "No payment activity yet"}
								</EmptyTitle>
								<EmptyDescription>
									{isFiltered
										? "Try widening the route-owned payment search, date range, or status filter."
										: "The route stays stable even when there are no lender payment rows to display."}
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
