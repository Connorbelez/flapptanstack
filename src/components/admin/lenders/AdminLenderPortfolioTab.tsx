"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { LenderPortfolioPage } from "#/components/lender/portfolio/LenderPortfolioPage";
import {
	DEFAULT_LENDER_PORTFOLIO_SEARCH,
	type LenderPortfolioSearchState,
} from "#/components/lender/portfolio/portfolio-types";
import { adminLenderPortfolioCommandCenterQueryOptions } from "#/components/lender/portfolio/query-options";
import { cleanLenderPortfolioSearch } from "#/components/lender/portfolio/search";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Badge } from "#/components/ui/badge";
import type { Id } from "../../../../convex/_generated/dataModel";

export interface AdminLenderPortfolioTabProps {
	readonly brokerLabel?: string;
	readonly isMicLender?: boolean;
	readonly lenderLabel: string;
	readonly targetLenderId: Id<"lenders">;
}

export function AdminLenderPortfolioTab({
	brokerLabel,
	isMicLender = false,
	lenderLabel,
	targetLenderId,
}: AdminLenderPortfolioTabProps) {
	const [search, setSearch] = useState<LenderPortfolioSearchState>(
		DEFAULT_LENDER_PORTFOLIO_SEARCH
	);
	const { data } = useSuspenseQuery(
		adminLenderPortfolioCommandCenterQueryOptions(targetLenderId)
	);
	const suggestedOpportunitiesState =
		data.suggestedOpportunities.availabilityState === "unavailable"
			? "unavailable"
			: "ready";

	return (
		<div className="space-y-4">
			<Alert className="border-amber-200 bg-amber-50 text-amber-950">
				<AlertTriangle className="size-4" />
				<AlertTitle className="flex flex-wrap items-center gap-2">
					Viewing lender portfolio as admin
					{isMicLender ? <Badge variant="secondary">FairLend MIC</Badge> : null}
				</AlertTitle>
				<AlertDescription>
					You are viewing {lenderLabel}
					{brokerLabel ? ` through ${brokerLabel}` : ""}. Actions from this tab
					are executed for the target lender and audited under your admin
					identity.
				</AlertDescription>
			</Alert>
			<LenderPortfolioPage
				queryMode={{
					actionReason:
						"Admin submitted lender portfolio action from lender record tab.",
					kind: "admin",
					targetLenderId,
				}}
				search={search}
				setSearch={(updater) =>
					setSearch((current) => ({
						...DEFAULT_LENDER_PORTFOLIO_SEARCH,
						...current,
						...cleanLenderPortfolioSearch(updater(current)),
					}))
				}
				snapshot={data}
				suggestedOpportunitiesState={suggestedOpportunitiesState}
			/>
		</div>
	);
}
