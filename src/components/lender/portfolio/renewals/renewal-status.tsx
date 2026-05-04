import { Badge } from "#/components/ui/badge";
import {
	formatPortfolioDate,
	formatPortfolioDateTime,
	formatPortfolioEnumLabel,
	formatPortfolioFractions,
} from "../portfolio-formatters";
import type { PortfolioLenderRenewalIntentRecord } from "../portfolio-types";

export type RenewalSurfaceVariant = "compact" | "full";

function describeCurrentIntent(renewal: PortfolioLenderRenewalIntentRecord) {
	if (!renewal.intent) {
		return "Awaiting lender decision";
	}

	if (
		renewal.intent === "partial_exit" &&
		typeof renewal.partialExitFractions === "number"
	) {
		return `Partial exit (${formatPortfolioFractions(renewal.partialExitFractions)})`;
	}

	return formatPortfolioEnumLabel(renewal.intent);
}

interface RenewalStatusProps {
	mortgageId: string;
	renewal: PortfolioLenderRenewalIntentRecord;
	variant: RenewalSurfaceVariant;
}

export function RenewalStatus({
	mortgageId,
	renewal,
	variant,
}: RenewalStatusProps) {
	return (
		<div
			className="space-y-3"
			data-testid={`renewal-status-${variant}-${mortgageId}`}
		>
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="secondary">
					{formatPortfolioEnumLabel(renewal.status)}
				</Badge>
				{renewal.intent ? (
					<Badge variant="outline">{describeCurrentIntent(renewal)}</Badge>
				) : null}
				{renewal.actionRequired ? (
					<Badge variant="outline">Action required</Badge>
				) : renewal.canChangeIntent ? (
					<Badge variant="outline">Change mind available</Badge>
				) : null}
			</div>
			<dl
				className={
					variant === "compact"
						? "grid gap-3 text-sm sm:grid-cols-2"
						: "grid gap-3 text-sm lg:grid-cols-3"
				}
			>
				<div className="space-y-1">
					<dt className="font-medium uppercase tracking-[0.16em]">
						Signal deadline
					</dt>
					<dd className="text-muted-foreground">
						{formatPortfolioDate(renewal.signalDeadline)}
					</dd>
				</div>
				<div className="space-y-1">
					<dt className="font-medium uppercase tracking-[0.16em]">Maturity</dt>
					<dd className="text-muted-foreground">
						{formatPortfolioDate(renewal.maturityDate)}
					</dd>
				</div>
				<div className="space-y-1">
					<dt className="font-medium uppercase tracking-[0.16em]">Held now</dt>
					<dd className="text-muted-foreground">
						{formatPortfolioFractions(renewal.currentHeldFractions)}
					</dd>
				</div>
				<div className="space-y-1">
					<dt className="font-medium uppercase tracking-[0.16em]">
						Minimum partial exit
					</dt>
					<dd className="text-muted-foreground">
						{formatPortfolioFractions(renewal.partialExitMinimumFractions)}
					</dd>
				</div>
				<div className="space-y-1">
					<dt className="font-medium uppercase tracking-[0.16em]">
						Recorded intent
					</dt>
					<dd className="text-muted-foreground">
						{describeCurrentIntent(renewal)}
					</dd>
				</div>
				<div className="space-y-1">
					<dt className="font-medium uppercase tracking-[0.16em]">Updated</dt>
					<dd className="text-muted-foreground">
						{formatPortfolioDateTime(renewal.signalledAt ?? renewal.recordedAt)}
					</dd>
				</div>
			</dl>
		</div>
	);
}
