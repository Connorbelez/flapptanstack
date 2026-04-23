import {
	ArrowRight,
	CalendarDays,
	CircleDollarSign,
	CirclePercent,
	MapPin,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import {
	formatPortfolioCompactCurrency,
	formatPortfolioDate,
	formatPortfolioPercent,
} from "./portfolio-formatters";
import type { PortfolioCommandCenterSnapshot } from "./portfolio-types";

export type PortfolioSuggestedOpportunity =
	PortfolioCommandCenterSnapshot["suggestedOpportunities"]["rows"][number];

interface SuggestedOpportunityCardProps {
	opportunity: PortfolioSuggestedOpportunity;
}

export function SuggestedOpportunityCard({
	opportunity,
}: SuggestedOpportunityCardProps) {
	return (
		<Card
			className="h-full gap-0 overflow-hidden border-border/70 bg-card/95"
			data-testid={`suggested-opportunity-${opportunity.listingId}`}
		>
			<div className="relative aspect-[16/9] overflow-hidden border-border/70 border-b bg-muted/40">
				{opportunity.heroImageUrl ? (
					<img
						alt={opportunity.title}
						className="h-full w-full object-cover"
						height={720}
						src={opportunity.heroImageUrl}
						width={1280}
					/>
				) : (
					<div className="flex h-full flex-col justify-between bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.2),_transparent_48%),linear-gradient(135deg,rgba(15,23,42,0.9),rgba(37,99,235,0.78))] p-5 text-white">
						<p className="font-medium text-[11px] text-white/75 uppercase tracking-[0.2em]">
							Suggested opportunity
						</p>
						<div>
							<p className="text-sm text-white/70">
								{opportunity.propertyTypeLabel}
							</p>
							<p className="mt-2 max-w-xs font-semibold text-xl leading-tight">
								{opportunity.locationLabel}
							</p>
						</div>
					</div>
				)}
				<div className="absolute right-4 bottom-4 rounded-full bg-background/92 px-3 py-1 font-medium text-foreground text-xs shadow-sm">
					{opportunity.mortgageTypeLabel}
				</div>
			</div>

			<CardHeader className="space-y-4 border-border/70 border-b pb-4">
				<div className="space-y-2">
					<p className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
						Broker-aligned match
					</p>
					<CardTitle className="text-xl leading-tight">
						{opportunity.title}
					</CardTitle>
					<p className="flex items-center gap-2 text-muted-foreground text-sm">
						<MapPin className="size-4 shrink-0" />
						<span>{opportunity.locationLabel}</span>
					</p>
				</div>

				<div className="flex flex-wrap gap-2">
					{opportunity.explanationTags.map((tag) => (
						<Badge
							key={`${opportunity.listingId}-${tag.label}`}
							variant="outline"
						>
							{tag.label}
						</Badge>
					))}
				</div>
			</CardHeader>

			<CardContent className="space-y-5 pt-5">
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<MetricTile
						icon={<CircleDollarSign className="size-4" />}
						label="Principal"
						value={formatPortfolioCompactCurrency(opportunity.principal)}
					/>
					<MetricTile
						icon={<CirclePercent className="size-4" />}
						label="Rate"
						value={formatPortfolioPercent(opportunity.interestRate)}
					/>
					<MetricTile
						icon={<CirclePercent className="size-4" />}
						label="LTV"
						value={formatPortfolioPercent(opportunity.ltvRatio * 100)}
					/>
					<MetricTile
						icon={<CalendarDays className="size-4" />}
						label="Maturity"
						value={formatPortfolioDate(opportunity.maturityDate)}
					/>
				</div>

				<div className="space-y-2">
					<p className="text-sm leading-6">{opportunity.marketplaceCopy}</p>
					<ul className="space-y-2 text-muted-foreground text-sm leading-6">
						{opportunity.explanationTags.map((tag) => (
							<li
								className="flex gap-2"
								key={`${opportunity.listingId}-${tag.label}-reason`}
							>
								<span aria-hidden className="text-foreground">
									-
								</span>
								<span>{tag.reason}</span>
							</li>
						))}
					</ul>
				</div>
			</CardContent>

			<CardFooter className="mt-auto flex items-center justify-between border-border/70 border-t pt-5">
				<div className="text-muted-foreground text-sm">
					<p>{opportunity.propertyTypeLabel}</p>
					<p>
						{formatPortfolioCompactCurrency(opportunity.principal)} target size
					</p>
				</div>
				<Button asChild>
					<a href={buildListingHref(opportunity.listingId)}>
						Open listing
						<ArrowRight className="size-4" />
					</a>
				</Button>
			</CardFooter>
		</Card>
	);
}

interface MetricTileProps {
	icon: ReactNode;
	label: string;
	value: string;
}

function MetricTile({ icon, label, value }: MetricTileProps) {
	return (
		<div className="rounded-xl border border-border/70 bg-muted/25 p-3">
			<p className="flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
				{icon}
				<span>{label}</span>
			</p>
			<p className="mt-2 font-semibold text-sm">{value}</p>
		</div>
	);
}

function buildListingHref(listingId: string) {
	return `/listings/${listingId}`;
}
