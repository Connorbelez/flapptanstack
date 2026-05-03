import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type * as React from "react";
import { type ReactNode, useMemo, useState } from "react";
import { AdminDescriptionHelp } from "#/components/admin/AdminDescriptionHelp";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { cn } from "#/lib/utils";
import type { MetricItem } from "./types";

export interface TableColumn<T> {
	align?: "left" | "right";
	cellClassName?: string;
	header: string;
	id: string;
	render: (row: T) => ReactNode;
	sortValue?: (row: T) => SortableTableValue;
}

type SortableTableValue = boolean | number | string | null | undefined;
type SortDirection = "asc" | "desc";

interface TableSortState {
	columnId: string;
	direction: SortDirection;
}

function compareSortableValues(
	left: SortableTableValue,
	right: SortableTableValue,
	direction: SortDirection
) {
	const leftMissing = left === null || left === undefined || left === "";
	const rightMissing = right === null || right === undefined || right === "";
	if (leftMissing && rightMissing) {
		return 0;
	}
	if (leftMissing) {
		return 1;
	}
	if (rightMissing) {
		return -1;
	}

	let compared: number;
	if (typeof left === "number" && typeof right === "number") {
		compared = left - right;
	} else if (typeof left === "boolean" && typeof right === "boolean") {
		compared = Number(left) - Number(right);
	} else {
		compared = String(left).localeCompare(String(right), "en", {
			numeric: true,
			sensitivity: "base",
		});
	}

	return direction === "asc" ? compared : -compared;
}

function nextSortState(
	current: TableSortState | null,
	columnId: string
): TableSortState | null {
	if (current?.columnId !== columnId) {
		return { columnId, direction: "asc" };
	}
	if (current.direction === "asc") {
		return { columnId, direction: "desc" };
	}
	return null;
}

function SortIndicator({ direction }: { direction?: SortDirection }) {
	if (direction === "asc") {
		return <ArrowUp className="size-3.5" />;
	}
	if (direction === "desc") {
		return <ArrowDown className="size-3.5" />;
	}
	return <ChevronsUpDown className="size-3.5 opacity-60" />;
}

function getAriaSort(direction?: SortDirection) {
	if (direction === "asc") {
		return "ascending";
	}
	if (direction === "desc") {
		return "descending";
	}
	return "none";
}

export function statusBadgeVariant(status?: string) {
	if (!status) {
		return "outline" as const;
	}

	const normalized = status.toLowerCase();
	if (
		normalized.includes("error") ||
		normalized.includes("failed") ||
		normalized.includes("overdue") ||
		normalized.includes("missing") ||
		normalized.includes("critical") ||
		normalized.includes("escalated")
	) {
		return "destructive" as const;
	}
	if (
		normalized.includes("warning") ||
		normalized.includes("pending") ||
		normalized.includes("retry") ||
		normalized.includes("draft")
	) {
		return "secondary" as const;
	}
	if (
		normalized.includes("healthy") ||
		normalized.includes("confirmed") ||
		normalized.includes("settled") ||
		normalized.includes("resolved") ||
		normalized.includes("active") ||
		normalized.includes("completed")
	) {
		return "default" as const;
	}
	return "outline" as const;
}

export function StatusBadge({
	label,
	variant,
}: {
	label: string;
	variant?: "default" | "destructive" | "outline" | "secondary";
}) {
	return <Badge variant={variant ?? statusBadgeVariant(label)}>{label}</Badge>;
}

export function PageHeader({
	actions,
	description,
	eyebrow,
	title,
}: {
	actions?: ReactNode;
	description: string;
	eyebrow?: ReactNode;
	title: string;
}) {
	return (
		<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
			<div className="space-y-2">
				{eyebrow ? <div>{eyebrow}</div> : null}
				<div className="flex items-center gap-2">
					<h1 className="font-semibold text-3xl tracking-tight">{title}</h1>
					<AdminDescriptionHelp
						content={description}
						label={`${title} details`}
					/>
				</div>
			</div>
			{actions ? (
				<div className="flex flex-wrap items-center gap-2">{actions}</div>
			) : null}
		</div>
	);
}

export function MetricStrip({ items }: { items: MetricItem[] }) {
	return (
		<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
			{items.map((item) => {
				const hasTone = item.tone && item.tone !== "default";
				const isInteractive = Boolean(item.onSelect);

				return (
					<Card
						className={cn(
							"gap-2 py-4",
							isInteractive &&
								"cursor-pointer transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							item.isActive && "border-primary/70 ring-2 ring-primary/30",
							item.tone === "critical" &&
								"border-destructive/40 bg-destructive/5 text-destructive-foreground dark:bg-destructive/15",
							item.tone === "warning" &&
								"border-amber-400/60 bg-amber-50 text-amber-950 dark:bg-amber-500/15 dark:text-amber-50",
							item.tone === "positive" &&
								"border-emerald-400/60 bg-emerald-50 text-emerald-950 dark:bg-emerald-500/15 dark:text-emerald-50"
						)}
						key={item.label}
						onClick={
							item.onSelect
								? (event: React.MouseEvent<HTMLDivElement>) => {
										if (
											event.target instanceof Element &&
											event.target.closest("a,button")
										) {
											return;
										}
										item.onSelect?.();
									}
								: undefined
						}
						onKeyDown={
							item.onSelect
								? (event: React.KeyboardEvent<HTMLDivElement>) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											item.onSelect?.();
										}
									}
								: undefined
						}
						role={isInteractive ? "button" : undefined}
						tabIndex={isInteractive ? 0 : undefined}
					>
						<CardContent className="px-4">
							<div className="flex items-center gap-1.5">
								<div
									className={cn(
										"text-xs uppercase tracking-[0.12em]",
										hasTone ? "text-current/75" : "text-muted-foreground"
									)}
								>
									{item.label}
								</div>
								{item.description ? (
									<AdminDescriptionHelp
										className={
											hasTone ? "text-current/75 hover:text-current" : ""
										}
										content={item.description}
										label={`${item.label} details`}
									/>
								) : null}
							</div>
							<div className="mt-2 font-semibold text-2xl">{item.value}</div>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}

export function SectionCard({
	action,
	children,
	description,
	title,
}: {
	action?: ReactNode;
	children: ReactNode;
	description?: string;
	title: string;
}) {
	return (
		<Card className="gap-0 overflow-hidden py-0">
			<CardHeader className="border-b px-5 py-4">
				<div className="flex items-start justify-between gap-4">
					<div className="flex items-center gap-1.5">
						<CardTitle className="text-base">{title}</CardTitle>
						{description ? (
							<AdminDescriptionHelp
								content={description}
								label={`${title} details`}
							/>
						) : null}
					</div>
					{action ? <div>{action}</div> : null}
				</div>
			</CardHeader>
			<CardContent className="p-0">{children}</CardContent>
		</Card>
	);
}

export function FilterBar({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"sticky top-0 z-10 rounded-xl border bg-background/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80",
				className
			)}
		>
			<div className="flex flex-wrap items-end gap-3">{children}</div>
		</div>
	);
}

export function FilterField({
	children,
	label,
}: {
	children: ReactNode;
	label: string;
}) {
	return (
		<div className="flex min-w-[160px] flex-col gap-2">
			<span className="font-medium text-muted-foreground text-xs uppercase tracking-[0.12em]">
				{label}
			</span>
			{children}
		</div>
	);
}

export function FilterTextInput(props: React.ComponentProps<typeof Input>) {
	return <Input className="h-9 min-w-[220px]" {...props} />;
}

export function FilterDateInput(props: React.ComponentProps<typeof Input>) {
	return <Input className="h-9 min-w-[160px]" type="date" {...props} />;
}

export function FilterSelect({
	onValueChange,
	options,
	placeholder,
	value,
}: {
	onValueChange: (value: string) => void;
	options: Array<{ label: string; value: string }>;
	placeholder: string;
	value?: string;
}) {
	return (
		<Select onValueChange={onValueChange} value={value}>
			<SelectTrigger className="h-9 min-w-[180px]">
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

export function FilterSwitch({
	checked,
	label,
	onCheckedChange,
}: {
	checked: boolean;
	label: string;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex min-h-9 items-center gap-3 rounded-md border px-3">
			<Switch checked={checked} onCheckedChange={onCheckedChange} />
			<Label className="text-sm">{label}</Label>
		</div>
	);
}

export function DataTableCard<T>({
	columns,
	emptyMessage,
	onRowSelect,
	rowKey,
	rows,
	selectedRowId,
}: {
	columns: TableColumn<T>[];
	emptyMessage: string;
	onRowSelect?: (row: T) => void;
	rowKey: (row: T) => string;
	rows: T[];
	selectedRowId?: string;
}) {
	const [sort, setSort] = useState<TableSortState | null>(null);
	const sortedRows = useMemo(() => {
		const sortedColumn = sort
			? columns.find((column) => column.id === sort.columnId)
			: undefined;
		if (!(sort && sortedColumn?.sortValue)) {
			return rows;
		}

		return rows
			.map((row, index) => ({ index, row }))
			.sort((left, right) => {
				const compared = compareSortableValues(
					sortedColumn.sortValue?.(left.row),
					sortedColumn.sortValue?.(right.row),
					sort.direction
				);
				if (compared === 0) {
					return left.index - right.index;
				}
				return compared;
			})
			.map(({ row }) => row);
	}, [columns, rows, sort]);

	return (
		<div className="max-h-[min(72vh,760px)] overflow-auto">
			<Table>
				<TableHeader className="sticky top-0 z-[1] bg-card">
					<TableRow className="hover:bg-transparent">
						{columns.map((column) => {
							const sortDirection =
								sort?.columnId === column.id ? sort.direction : undefined;
							return (
								<TableHead
									aria-sort={
										column.sortValue ? getAriaSort(sortDirection) : undefined
									}
									className={cn(column.align === "right" && "text-right")}
									key={column.id}
								>
									{column.sortValue ? (
										<button
											className={cn(
												"inline-flex h-8 w-full items-center gap-1.5 rounded px-1 text-left font-medium transition hover:bg-muted/70 hover:text-foreground",
												column.align === "right"
													? "justify-end"
													: "justify-start"
											)}
											onClick={() =>
												setSort((current) => nextSortState(current, column.id))
											}
											type="button"
										>
											<span>{column.header}</span>
											<SortIndicator direction={sortDirection} />
										</button>
									) : (
										column.header
									)}
								</TableHead>
							);
						})}
					</TableRow>
				</TableHeader>
				<TableBody>
					{sortedRows.length === 0 ? (
						<TableRow>
							<TableCell
								className="h-36 text-center text-muted-foreground"
								colSpan={columns.length}
							>
								{emptyMessage}
							</TableCell>
						</TableRow>
					) : (
						sortedRows.map((row) => {
							const key = rowKey(row);
							const isSelected = selectedRowId === key;
							return (
								<TableRow
									className={cn(
										onRowSelect && "cursor-pointer",
										isSelected && "bg-muted/70 hover:bg-muted/70"
									)}
									key={key}
									onClick={onRowSelect ? () => onRowSelect(row) : undefined}
								>
									{columns.map((column) => (
										<TableCell
											className={cn(
												column.align === "right" && "text-right",
												column.cellClassName
											)}
											key={column.id}
										>
											{column.render(row)}
										</TableCell>
									))}
								</TableRow>
							);
						})
					)}
				</TableBody>
			</Table>
		</div>
	);
}

export function DetailRail({
	actions,
	children,
	description,
	title,
}: {
	actions?: ReactNode;
	children: ReactNode;
	description?: string;
	title: string;
}) {
	return (
		<Card className="sticky top-24 gap-0 overflow-hidden py-0">
			<CardHeader className="border-b px-5 py-4">
				<div className="space-y-1">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<CardTitle className="text-base">{title}</CardTitle>
						{actions ? (
							<div className="flex flex-wrap gap-2">{actions}</div>
						) : null}
					</div>
					{description ? (
						<AdminDescriptionHelp
							content={description}
							label={`${title} details`}
						/>
					) : null}
				</div>
			</CardHeader>
			<CardContent className="space-y-4 px-5 py-4">{children}</CardContent>
		</Card>
	);
}

export function KeyValueList({
	items,
}: {
	items: Array<{ label: string; value: ReactNode }>;
}) {
	return (
		<div className="space-y-3">
			{items.map((item) => (
				<div className="space-y-1" key={item.label}>
					<div className="text-muted-foreground text-xs uppercase tracking-[0.12em]">
						{item.label}
					</div>
					<div className="text-sm">{item.value}</div>
				</div>
			))}
		</div>
	);
}

export function InlineCode({ value }: { value: string }) {
	return (
		<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
			{value}
		</code>
	);
}

export function EmptyDetailState({
	description,
	title,
}: {
	description: string;
	title: string;
}) {
	return (
		<div className="rounded-xl border border-dashed p-6 text-center">
			<div className="inline-flex items-center gap-1.5 font-medium text-sm">
				{title}
				<AdminDescriptionHelp
					content={description}
					label={`${title} details`}
				/>
			</div>
		</div>
	);
}

export function ActionButtonRow({ children }: { children: ReactNode }) {
	return <div className="flex flex-wrap gap-2">{children}</div>;
}

export function LinkLikeButton({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<Button className={className} size="sm" variant="outline">
			{children}
		</Button>
	);
}
