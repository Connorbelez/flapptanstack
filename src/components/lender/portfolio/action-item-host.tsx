import {
	ArrowUpRight,
	CalendarClock,
	MapPin,
	MessageSquarePlus,
} from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import {
	formatPortfolioDate,
	formatPortfolioEnumLabel,
} from "./portfolio-formatters";
import type { PortfolioCommandCenterSnapshot } from "./portfolio-types";

type PortfolioActionItem =
	PortfolioCommandCenterSnapshot["actionsRequired"]["items"][number];
type PortfolioBrokerPrefillContext = PortfolioActionItem["prefillContext"];

export interface ActionItemHostProps {
	action: PortfolioActionItem;
	isSelected?: boolean;
	onOpenDetails?: (action: PortfolioActionItem) => void;
	onPrefill: (context: PortfolioBrokerPrefillContext) => void;
}

function getActionDetailLabel(action: PortfolioActionItem) {
	if (action.kind === "deal_action") {
		return null;
	}

	if (action.obligationId) {
		return "Open payment details";
	}

	if (action.mortgageId) {
		return "Open position details";
	}

	return null;
}

function getPriorityBadgeClassName(priority: PortfolioActionItem["priority"]) {
	switch (priority) {
		case "high":
			return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
		case "medium":
			return "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
		default:
			return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
	}
}

export function ActionItemHost({
	action,
	isSelected = false,
	onOpenDetails,
	onPrefill,
}: ActionItemHostProps) {
	const detailLabel = getActionDetailLabel(action);

	return (
		<article
			className={cn(
				"rounded-xl border bg-card/60 p-4 transition-colors",
				isSelected
					? "border-primary/50 bg-primary/5"
					: "border-border/70 bg-background"
			)}
			data-testid={`action-item-${action.id}`}
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="space-y-1.5">
					<div className="flex flex-wrap items-center gap-2">
						<h4 className="font-medium text-sm">{action.title}</h4>
						{isSelected ? (
							<Badge variant="outline">Selected handoff</Badge>
						) : null}
					</div>
					<p className="text-muted-foreground text-sm leading-6">
						{action.summary}
					</p>
				</div>
				<div className="flex flex-wrap items-center justify-end gap-2">
					<Badge
						className={getPriorityBadgeClassName(action.priority)}
						variant="outline"
					>
						{formatPortfolioEnumLabel(action.priority)} priority
					</Badge>
					<Badge variant="outline">
						{formatPortfolioEnumLabel(action.kind)}
					</Badge>
				</div>
			</div>

			<dl className="mt-4 grid gap-3 text-muted-foreground text-xs sm:grid-cols-3">
				<div className="space-y-1">
					<dt className="font-medium uppercase tracking-[0.16em]">Status</dt>
					<dd>{formatPortfolioEnumLabel(action.status)}</dd>
				</div>
				<div className="space-y-1">
					<dt className="font-medium uppercase tracking-[0.16em]">Due</dt>
					<dd className="flex items-center gap-1.5">
						<CalendarClock className="size-3.5" />
						{formatPortfolioDate(action.dueDate)}
					</dd>
				</div>
				<div className="space-y-1">
					<dt className="font-medium uppercase tracking-[0.16em]">Context</dt>
					<dd className="flex items-center gap-1.5">
						<MapPin className="size-3.5" />
						{action.prefillContext.propertyLabel}
					</dd>
				</div>
			</dl>

			<div className="mt-4 flex flex-wrap gap-2">
				<Button
					data-testid={`action-prefill-${action.id}`}
					onClick={() => onPrefill(action.prefillContext)}
					size="sm"
					type="button"
					variant={isSelected ? "default" : "outline"}
				>
					<MessageSquarePlus className="size-4" />
					{isSelected ? "Broker handoff selected" : "Prefill broker handoff"}
				</Button>
				{detailLabel ? (
					<Button
						data-testid={`action-open-details-${action.id}`}
						onClick={() => onOpenDetails?.(action)}
						size="sm"
						type="button"
						variant="ghost"
					>
						<ArrowUpRight className="size-4" />
						{detailLabel}
					</Button>
				) : null}
			</div>
		</article>
	);
}
