"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Layers3 } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { Badge } from "#/components/ui/badge";
import { cn } from "#/lib/utils";

const boardColumnVariants = cva("flex shrink-0 flex-col gap-3 border p-4", {
	defaultVariants: {
		variant: "crm",
	},
	variants: {
		variant: {
			crm: "w-[300px] rounded-2xl border-border/70 bg-muted/20",
			operations: "w-[320px] rounded-lg border-border/70 bg-background",
		},
	},
});

const boardCardVariants = cva(
	"flex h-auto w-full flex-col items-start gap-3 border bg-background/90 p-4 text-left text-foreground shadow-sm",
	{
		defaultVariants: {
			variant: "crm",
		},
		variants: {
			selectable: {
				false: "",
				true: "cursor-pointer hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
			},
			variant: {
				crm: "rounded-2xl border-border/70",
				operations:
					"rounded-lg border-border/70 transition hover:border-primary/35 hover:shadow-md",
			},
		},
	}
);

interface AdminKanbanColumn<TItem> {
	readonly badge?: ReactNode;
	readonly count?: number;
	readonly emptyLabel?: string;
	readonly id: string;
	readonly items: readonly TItem[];
	readonly label: string;
	readonly meta?: ReactNode;
}

interface AdminKanbanBoardProps<TItem>
	extends VariantProps<typeof boardColumnVariants> {
	readonly className?: string;
	readonly columns: readonly AdminKanbanColumn<TItem>[];
	readonly getItemId: (item: TItem) => string;
	readonly onSelectItem?: (item: TItem) => void;
	readonly renderItem: (item: TItem) => ReactNode;
}

export function AdminKanbanBoard<TItem>({
	className,
	columns,
	getItemId,
	onSelectItem,
	renderItem,
	variant,
}: AdminKanbanBoardProps<TItem>) {
	const handleSelectableCardKeyDown = (
		event: KeyboardEvent<HTMLDivElement>,
		item: TItem
	) => {
		if (!onSelectItem || event.target !== event.currentTarget) {
			return;
		}

		if (event.key !== "Enter" && event.key !== " ") {
			return;
		}

		event.preventDefault();
		onSelectItem(item);
	};

	return (
		<div className={cn("overflow-x-auto pb-2", className)}>
			<div className="flex min-w-max gap-4">
				{columns.map((column) => (
					<section className={boardColumnVariants({ variant })} key={column.id}>
						<header className="flex items-center justify-between gap-3">
							<div className="space-y-1">
								<p className="font-medium text-sm">{column.label}</p>
								<div className="flex items-center gap-2 text-muted-foreground text-xs">
									<Layers3 className="size-3.5" />
									{column.meta ??
										`${column.count ?? column.items.length} records`}
								</div>
							</div>
							{column.badge ? (
								typeof column.badge === "string" ? (
									<Badge variant="outline">{column.badge}</Badge>
								) : (
									column.badge
								)
							) : null}
						</header>

						<div className="space-y-3">
							{column.items.length === 0 ? (
								<div className="rounded-lg border border-border/70 border-dashed px-3 py-8 text-center text-muted-foreground text-sm">
									{column.emptyLabel ?? "No records in this lane."}
								</div>
							) : null}

							{column.items.map((item) => {
								const itemId = getItemId(item);
								const cardBody = renderItem(item);
								if (!onSelectItem) {
									return (
										<div
											className={boardCardVariants({
												selectable: false,
												variant,
											})}
											key={itemId}
										>
											{cardBody}
										</div>
									);
								}

								return (
									<div
										className={boardCardVariants({
											selectable: true,
											variant,
										})}
										key={itemId}
										onClick={() => onSelectItem(item)}
										onKeyDown={(event) =>
											handleSelectableCardKeyDown(event, item)
										}
										role="button"
										tabIndex={0}
									>
										{cardBody}
									</div>
								);
							})}
						</div>
					</section>
				))}
			</div>
		</div>
	);
}
