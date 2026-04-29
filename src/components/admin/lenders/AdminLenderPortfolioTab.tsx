"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { LenderPortfolioPage } from "#/components/lender/portfolio/LenderPortfolioPage";
import {
	DEFAULT_LENDER_PORTFOLIO_SEARCH,
	type LenderPortfolioSearchState,
} from "#/components/lender/portfolio/portfolio-types";
import { adminLenderPortfolioCommandCenterQueryOptions } from "#/components/lender/portfolio/query-options";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Badge } from "#/components/ui/badge";
import { Textarea } from "#/components/ui/textarea";
import { cn } from "#/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { UnifiedRecord } from "../../../../convex/crm/types";

function readStringField(record: UnifiedRecord | undefined, fieldName: string) {
	const value = record?.fields[fieldName];
	return typeof value === "string" && value.trim().length > 0
		? value
		: undefined;
}

function toErrorMessage(error: unknown) {
	return error instanceof Error
		? error.message
		: "Unknown admin portfolio error";
}

function isNativeLenderRecord(
	record: UnifiedRecord | undefined,
	recordId: string
): record is UnifiedRecord & { nativeTable: "lenders" } {
	return (
		record?._kind === "native" &&
		record.nativeTable === "lenders" &&
		record._id === recordId
	);
}

export function AdminLenderPortfolioTab({
	className,
	record,
	recordId,
}: {
	readonly className?: string;
	readonly record: UnifiedRecord | undefined;
	readonly recordId: string;
}) {
	if (!record) {
		return (
			<div
				className={cn(
					"border-border/70 border-y px-6 py-10 text-muted-foreground text-sm",
					className
				)}
			>
				Loading lender record.
			</div>
		);
	}

	if (!isNativeLenderRecord(record, recordId)) {
		return (
			<div className={cn("space-y-4", className)}>
				<Alert variant="destructive">
					<TriangleAlert className="size-4" />
					<AlertTitle>Portfolio unavailable for this record</AlertTitle>
					<AlertDescription>
						Admin portfolio access requires a resolved lender record.
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	return (
		<ResolvedAdminLenderPortfolioTab
			className={className}
			record={record}
			recordId={recordId}
		/>
	);
}

function ResolvedAdminLenderPortfolioTab({
	className,
	record,
	recordId,
}: {
	readonly className?: string;
	readonly record: UnifiedRecord & { nativeTable: "lenders" };
	readonly recordId: string;
}) {
	const targetLenderId = recordId as Id<"lenders">;
	const [renewalActionReason, setRenewalActionReason] = useState("");
	const access = {
		mode: "admin" as const,
		renewalActionReason,
		targetLenderId,
	};
	const portfolioQuery = useQuery({
		...adminLenderPortfolioCommandCenterQueryOptions(targetLenderId),
	});
	const [search, setSearch] = useState<LenderPortfolioSearchState>(
		DEFAULT_LENDER_PORTFOLIO_SEARCH
	);
	const lenderName =
		readStringField(record, "lenderName") ??
		readStringField(record, "contactEmail") ??
		"Selected lender";
	const brokerLabel =
		readStringField(record, "brokerSummary") ?? "Broker context";

	return (
		<div className={cn("space-y-4", className)}>
			<div className="border-border/70 border-y bg-muted/30 px-4 py-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							<ShieldCheck className="size-4 text-primary" />
							<h3 className="font-semibold text-sm">Admin portfolio access</h3>
							<Badge variant="outline">Audited admin actions</Badge>
						</div>
						<p className="text-muted-foreground text-sm leading-6">
							Viewing {lenderName} through {brokerLabel}. Portfolio reads and
							actions use this lender as the business subject while preserving
							the current admin actor in audit metadata.
						</p>
					</div>
					<div className="w-full max-w-md space-y-2">
						<label
							className="font-medium text-muted-foreground text-xs"
							htmlFor="admin-renewal-action-reason"
						>
							Admin action reason
						</label>
						<Textarea
							className="min-h-20 resize-none bg-background text-sm"
							id="admin-renewal-action-reason"
							onChange={(event) =>
								setRenewalActionReason(event.currentTarget.value)
							}
							placeholder="Reason recorded with renewal actions"
							value={renewalActionReason}
						/>
					</div>
				</div>
			</div>

			{portfolioQuery.isPending ? (
				<div className="border-border/70 border-y px-6 py-10 text-muted-foreground text-sm">
					Loading target lender portfolio.
				</div>
			) : portfolioQuery.isError || !portfolioQuery.data ? (
				<Alert variant="destructive">
					<TriangleAlert className="size-4" />
					<AlertTitle>Unable to resolve admin portfolio target</AlertTitle>
					<AlertDescription>
						{toErrorMessage(portfolioQuery.error)}
					</AlertDescription>
				</Alert>
			) : (
				<LenderPortfolioPage
					access={access}
					search={search}
					setSearch={(updater) =>
						setSearch((current) => ({
							...DEFAULT_LENDER_PORTFOLIO_SEARCH,
							...updater(current),
						}))
					}
					snapshot={portfolioQuery.data}
					suggestedOpportunitiesState={
						portfolioQuery.data.suggestedOpportunities.availabilityState ===
						"unavailable"
							? "unavailable"
							: "ready"
					}
				/>
			)}
		</div>
	);
}
