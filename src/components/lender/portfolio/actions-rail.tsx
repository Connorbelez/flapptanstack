import { CheckCircle2, ListTodo } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { ActionItemHost } from "./action-item-host";
import { PortfolioDescriptionTooltip } from "./portfolio-shell";
import type {
	LenderPortfolioQueryMode,
	PortfolioCommandCenterSnapshot,
} from "./portfolio-types";

type PortfolioActionItem =
	PortfolioCommandCenterSnapshot["actionsRequired"]["items"][number];
type PortfolioActionsSection =
	PortfolioCommandCenterSnapshot["actionsRequired"];
type PortfolioBrokerPrefillContext = PortfolioActionItem["prefillContext"];

export interface ActionsRailProps {
	actionsRequired: PortfolioActionsSection;
	mode: LenderPortfolioQueryMode;
	onOpenDetails?: (action: PortfolioActionItem) => void;
	onPrefill: (context: PortfolioBrokerPrefillContext) => void;
	selectedPrefillContext?: PortfolioBrokerPrefillContext | null;
}

function hasSamePrefillContext(
	left: PortfolioBrokerPrefillContext | null | undefined,
	right: PortfolioBrokerPrefillContext
) {
	return (
		left?.contextType === right.contextType &&
		left?.subjectId === right.subjectId
	);
}

export function ActionsRail({
	actionsRequired,
	mode,
	onOpenDetails,
	onPrefill,
	selectedPrefillContext,
}: ActionsRailProps) {
	const hasItems =
		actionsRequired.items.length > 0 && !actionsRequired.allClear;

	return (
		<section
			className="rounded-xl border border-border/70 bg-background"
			data-testid="actions-required-section"
		>
			<div className="flex flex-wrap items-start justify-between gap-3 border-border/70 border-b px-4 py-4">
				<div className="space-y-1.5">
					<div className="flex items-center gap-2">
						<ListTodo className="size-4 text-muted-foreground" />
						<h3 className="font-semibold text-base">Actions Required</h3>
						<PortfolioDescriptionTooltip
							label="About Actions Required"
							text="Renewal, payment, and deal follow-up items stay grouped here so the rail remains an operational surface instead of an inbox."
						/>
					</div>
				</div>
				<Badge variant="outline">
					{hasItems
						? `${actionsRequired.items.length} open items`
						: "All clear"}
				</Badge>
			</div>

			<div className="p-4">
				{hasItems ? (
					<div className="space-y-3">
						{actionsRequired.items.map((action) => (
							<ActionItemHost
								action={action}
								isSelected={hasSamePrefillContext(
									selectedPrefillContext,
									action.prefillContext
								)}
								key={action.id}
								mode={mode}
								onOpenDetails={onOpenDetails}
								onPrefill={onPrefill}
							/>
						))}
					</div>
				) : (
					<div
						className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
						data-testid="actions-required-all-clear"
					>
						<div className="flex items-start gap-3">
							<div className="rounded-full bg-emerald-500/15 p-2 text-emerald-700 dark:text-emerald-300">
								<CheckCircle2 className="size-4" />
							</div>
							<div className="space-y-1.5">
								<p className="font-medium text-sm">No actions required</p>
								<p className="text-muted-foreground text-sm leading-6">
									The rail stays visible even when the action feed is clear, so
									the lender still has broker coordination and downstream
									fallback states available.
								</p>
							</div>
						</div>
					</div>
				)}
			</div>
		</section>
	);
}
