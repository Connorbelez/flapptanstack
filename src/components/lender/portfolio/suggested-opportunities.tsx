import { AlertTriangle, Clock3, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Card } from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import { PortfolioSlotHost } from "./portfolio-shell";
import {
	type PortfolioSuggestedOpportunity,
	SuggestedOpportunityCard,
} from "./suggested-opportunity-card";

const PORTFOLIO_SUGGESTIONS_STALE_AFTER_MS = 1000 * 60 * 60 * 24;

export type SuggestedOpportunitiesState = "ready" | "loading" | "unavailable";

interface SuggestedOpportunitiesProps {
	excludedOwnedMortgageCount: number;
	generatedAt: number;
	hasBrokerConstraints: boolean;
	hasPositions: boolean;
	rows: readonly PortfolioSuggestedOpportunity[];
	state?: SuggestedOpportunitiesState;
	unavailableReason?: string;
}

export function SuggestedOpportunities({
	excludedOwnedMortgageCount,
	generatedAt,
	hasBrokerConstraints,
	hasPositions,
	rows,
	state = "ready",
	unavailableReason,
}: SuggestedOpportunitiesProps) {
	const isStale =
		state !== "loading" &&
		Date.now() - generatedAt >= PORTFOLIO_SUGGESTIONS_STALE_AFTER_MS;

	return (
		<PortfolioSlotHost
			dataTestId="suggested-slot-host"
			description="Broker-aligned listings that fit the current portfolio profile without pulling the command center into a marketplace-first flow."
			eyebrow="Suggested opportunities"
			summary={buildSummary({
				excludedOwnedMortgageCount,
				hasPositions,
				rowCount: rows.length,
				state,
			})}
			title="Suggested opportunities"
		>
			<div className="space-y-5" data-testid="suggested-opportunities-section">
				<div className="flex flex-wrap items-center gap-2 text-sm">
					{isStale ? (
						<Badge
							data-testid="suggested-opportunities-stale-badge"
							variant="secondary"
						>
							<Clock3 className="size-3.5" />
							Stale snapshot
						</Badge>
					) : null}
					{hasBrokerConstraints ? (
						<Badge variant="outline">
							<ShieldCheck className="size-3.5" />
							Broker constraints active
						</Badge>
					) : null}
					{excludedOwnedMortgageCount > 0 ? (
						<Badge variant="outline">
							Excluded {excludedOwnedMortgageCount} already-owned
						</Badge>
					) : null}
					<span className="text-muted-foreground">
						Snapshot updated {formatGeneratedAt(generatedAt)}
					</span>
				</div>

				{state === "loading" ? <LoadingState /> : null}
				{state === "unavailable" ? (
					<UnavailableState unavailableReason={unavailableReason} />
				) : null}
				{state === "ready" && rows.length === 0 ? (
					<EmptyState
						excludedOwnedMortgageCount={excludedOwnedMortgageCount}
						hasBrokerConstraints={hasBrokerConstraints}
						hasPositions={hasPositions}
					/>
				) : null}
				{state === "ready" && rows.length > 0 ? (
					<>
						<div className="grid gap-4 xl:grid-cols-2">
							{rows.map((opportunity) => (
								<SuggestedOpportunityCard
									key={opportunity.listingId}
									opportunity={opportunity}
								/>
							))}
						</div>
						<Card className="border-border/70 bg-muted/20 px-4 py-3 text-muted-foreground text-sm">
							Listing availability is rechecked when you open a detail page, so
							the drill-down remains the source of truth if a listing changed
							after this snapshot was generated.
						</Card>
					</>
				) : null}
			</div>
		</PortfolioSlotHost>
	);
}

function buildSummary(args: {
	excludedOwnedMortgageCount: number;
	hasPositions: boolean;
	rowCount: number;
	state: SuggestedOpportunitiesState;
}) {
	if (args.state === "loading") {
		return "Loading suggestions";
	}

	if (args.state === "unavailable") {
		return "Suggestions temporarily unavailable";
	}

	if (args.rowCount > 0) {
		return `${args.rowCount} suggestion-ready rows`;
	}

	if (!args.hasPositions) {
		return "Portfolio profile needed";
	}

	if (args.excludedOwnedMortgageCount > 0) {
		return "Owned listings excluded";
	}

	return "No eligible matches";
}

function LoadingState() {
	const placeholderKeys = ["primary", "secondary"] as const;

	return (
		<div
			className="grid gap-4 xl:grid-cols-2"
			data-testid="suggested-opportunities-loading"
		>
			{placeholderKeys.map((key) => (
				<div
					className="space-y-4 rounded-2xl border border-border/70 p-4"
					key={`suggested-loading-${key}`}
				>
					<Skeleton className="aspect-[16/9] w-full rounded-xl" />
					<Skeleton className="h-5 w-40" />
					<Skeleton className="h-4 w-full" />
					<div className="grid grid-cols-2 gap-3">
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-16 w-full" />
					</div>
					<Skeleton className="h-9 w-36" />
				</div>
			))}
		</div>
	);
}

function UnavailableState(args: { unavailableReason?: string }) {
	return (
		<Card
			className="border-border/70 border-dashed bg-muted/15 px-5 py-5"
			data-testid="suggested-opportunities-unavailable"
		>
			<div className="flex items-start gap-3">
				<div className="rounded-full bg-background p-2">
					<AlertTriangle className="size-4 text-muted-foreground" />
				</div>
				<div className="space-y-2">
					<p className="font-medium">Suggestions are temporarily unavailable</p>
					<p className="text-muted-foreground text-sm leading-6">
						{args.unavailableReason ??
							"The portfolio command center is still available, but FairLend could not load a reliable suggestion snapshot right now. Check back later or continue using the existing listings experience for manual review."}
					</p>
				</div>
			</div>
		</Card>
	);
}

function EmptyState(args: {
	excludedOwnedMortgageCount: number;
	hasBrokerConstraints: boolean;
	hasPositions: boolean;
}) {
	if (!args.hasPositions) {
		return (
			<Card
				className="border-border/70 border-dashed bg-muted/15 px-5 py-5"
				data-testid="suggested-opportunities-empty"
			>
				<div className="flex items-start gap-3">
					<div className="rounded-full bg-background p-2">
						<Sparkles className="size-4 text-muted-foreground" />
					</div>
					<div className="space-y-2">
						<p className="font-medium">No portfolio-based matches yet</p>
						<p className="text-muted-foreground text-sm leading-6">
							Suggested opportunities will appear after the lender has active
							positions that FairLend can use to match new listings against the
							current portfolio profile.
						</p>
					</div>
				</div>
			</Card>
		);
	}

	return (
		<Card
			className="border-border/70 border-dashed bg-muted/15 px-5 py-5"
			data-testid="suggested-opportunities-empty"
		>
			<div className="space-y-2">
				<p className="font-medium">No eligible suggestions right now</p>
				<p className="text-muted-foreground text-sm leading-6">
					{buildEmptyCopy(args)}
				</p>
			</div>
		</Card>
	);
}

function buildEmptyCopy(args: {
	excludedOwnedMortgageCount: number;
	hasBrokerConstraints: boolean;
	hasPositions: boolean;
}) {
	if (args.excludedOwnedMortgageCount > 0 && args.hasBrokerConstraints) {
		return `Broker-imposed limits and the already-owned exclusion filtered the current live marketplace set. ${args.excludedOwnedMortgageCount} owned listing${args.excludedOwnedMortgageCount === 1 ? "" : "s"} were removed from consideration.`;
	}

	if (args.excludedOwnedMortgageCount > 0) {
		return `The current live marketplace only surfaced listings tied to mortgages the lender already owns. ${args.excludedOwnedMortgageCount} owned listing${args.excludedOwnedMortgageCount === 1 ? "" : "s"} were excluded.`;
	}

	if (args.hasBrokerConstraints) {
		return "Broker-imposed portfolio limits are active, and none of the current live listings fit the approved profile right now.";
	}

	return "FairLend could not find a live listing that fits the current portfolio profile right now.";
}

function formatGeneratedAt(value: number) {
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return "Unavailable";
	}

	return parsed.toLocaleString("en-CA", {
		dateStyle: "medium",
		timeStyle: "short",
	});
}
