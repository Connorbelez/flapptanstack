"use client";

import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { BriefcaseBusiness, Users } from "lucide-react";
import { Button } from "#/components/ui/button";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface LenderPageAsideProps {
	readonly lenderId: string;
}

export function LenderPageAside({ lenderId }: LenderPageAsideProps) {
	const detailContext = useQuery(
		api.crm.detailContextQueries.getLenderDetailContext,
		{
			lenderId: lenderId as Id<"lenders">,
		}
	);

	const dealCount = detailContext?.deals.length ?? 0;
	const mortgageCount = detailContext?.mortgages.length ?? 0;
	const totalPrincipal = detailContext?.deals.reduce(
		(sum, deal) => sum + (deal.mortgage?.principal ?? 0),
		0
	);

	return (
		<div className="space-y-4">
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
				<div className="border-border/60 border-t py-3">
					<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
						Active Deals
					</p>
					<p className="mt-1 font-medium text-lg">{dealCount}</p>
				</div>
				<div className="border-border/60 border-t py-3">
					<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
						Mortgages
					</p>
					<p className="mt-1 font-medium text-lg">{mortgageCount}</p>
				</div>
				{totalPrincipal ? (
					<div className="border-border/60 border-t py-3">
						<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
							Total Principal
						</p>
						<p className="mt-1 font-medium text-lg">
							{new Intl.NumberFormat("en-US", {
								style: "currency",
								currency: "USD",
								maximumFractionDigits: 0,
							}).format(totalPrincipal / 100)}
						</p>
					</div>
				) : null}
			</div>

			<div className="flex flex-col gap-2">
				<Button asChild size="sm">
					<Link
						search={{
							detailOpen: false,
							entityType: undefined,
							recordId: undefined,
						}}
						to="/admin/deals"
					>
						<BriefcaseBusiness className="mr-2 h-4 w-4" />
						View Deals
					</Link>
				</Button>
				<Button asChild size="sm" variant="outline">
					<Link
						search={{
							detailOpen: false,
							entityType: "lenders",
							recordId: undefined,
						}}
						to="/admin"
					>
						<Users className="mr-2 h-4 w-4" />
						View Lenders
					</Link>
				</Button>
			</div>
		</div>
	);
}
