"use client";

import { useQuery } from "convex/react";
import {
	AlertTriangle,
	ArrowRight,
	Clock3,
	FileSignature,
	Scale,
	Users,
} from "lucide-react";
import { type KeyboardEvent, type MouseEvent, useMemo, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { ScrollArea, ScrollBar } from "#/components/ui/scroll-area";
import { useAdminDetailSheet } from "#/hooks/useAdminDetailSheet";
import { cn } from "#/lib/utils";
import { api } from "../../../../convex/_generated/api";
import type {
	AdminDealOperationsCard,
	AdminDealOperationsFilter,
	AdminDealOperationsProjection,
} from "../../../../convex/deals/queries";
import { DealOperationActionControls } from "./DealOperationActionControls";
import {
	DEAL_OPERATIONS_FILTERS,
	DEAL_OPERATIONS_PHASES,
	filterDealOperationCards,
	formatDealOperationPhase,
	formatDealShare,
	groupDealOperationCards,
	lifecycleProgress,
	primaryActionLabel,
	summarizeBlockers,
} from "./dealOperationsViewModel";

const PHASE_TONE: Record<
	(typeof DEAL_OPERATIONS_PHASES)[number]["tone"],
	string
> = {
	amber: "bg-amber-500",
	blue: "bg-blue-500",
	cyan: "bg-cyan-500",
	emerald: "bg-emerald-500",
	purple: "bg-purple-500",
	red: "bg-red-500",
	zinc: "bg-zinc-500",
};

function formatDate(value: number | null) {
	if (value === null) {
		return "Not set";
	}
	return new Date(value).toLocaleDateString();
}

function isInteractiveCardTarget(target: EventTarget | null) {
	return (
		target instanceof Element &&
		target.closest("a,button,input,textarea,select,[data-card-action]") !== null
	);
}

function DealOperationsCard({
	deal,
	onOpenDeal,
}: {
	readonly deal: AdminDealOperationsCard;
	readonly onOpenDeal: (recordId: string) => void;
}) {
	const primaryAction = deal.nextAction;
	const criticalBlocker = deal.blockers.find(
		(blocker) => blocker.severity === "critical"
	);
	const progress = lifecycleProgress(deal.lifecycle.phase);
	const dealLabel = `deal ${String(deal._id).slice(-6)}`;

	function openDeal() {
		onOpenDeal(String(deal._id));
	}

	function handleCardClick(event: MouseEvent<HTMLDivElement>) {
		if (event.defaultPrevented || isInteractiveCardTarget(event.target)) {
			return;
		}
		openDeal();
	}

	function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (
			event.defaultPrevented ||
			event.target !== event.currentTarget ||
			(event.key !== "Enter" && event.key !== " ")
		) {
			return;
		}
		event.preventDefault();
		openDeal();
	}

	return (
		<Card
			aria-label={`Open ${dealLabel} detail sheet`}
			className="cursor-pointer rounded-md border-border/70 shadow-none transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			onClick={handleCardClick}
			onKeyDown={handleCardKeyDown}
			role="button"
			tabIndex={0}
		>
			<CardHeader className="space-y-3 pb-3">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 space-y-1">
						<CardTitle className="truncate font-medium text-sm">
							Deal {String(deal._id).slice(-6)}
						</CardTitle>
						<p className="text-muted-foreground text-xs">
							{formatDealOperationPhase(
								deal.lifecycle.status,
								deal.lifecycle.subState
							)}
						</p>
					</div>
					<Badge variant={deal.blockers.length > 0 ? "destructive" : "outline"}>
						{summarizeBlockers(deal.blockers)}
					</Badge>
				</div>
				<div className="grid grid-cols-5 gap-1">
					{DEAL_OPERATIONS_PHASES.filter(
						(phase) => phase.id !== "failed" && phase.id !== "unknown"
					).map((phase) => (
						<div
							className={cn(
								"h-1.5 rounded-full bg-muted",
								progress.completed.includes(phase.id) && "bg-emerald-500",
								phase.id === deal.lifecycle.phase && PHASE_TONE[phase.tone]
							)}
							key={phase.id}
						/>
					))}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-2 text-sm">
					<div className="flex items-center gap-2 text-muted-foreground">
						<Users className="size-4" />
						<span className="truncate">
							{deal.participants.buyer.displayName} /{" "}
							{deal.participants.seller.displayName}
						</span>
					</div>
					<div className="flex items-center gap-2 text-muted-foreground">
						<Scale className="size-4" />
						<span>
							Share {formatDealShare(deal.fractionalShareDisplayPercent)}
						</span>
					</div>
					<div className="flex items-center gap-2 text-muted-foreground">
						<FileSignature className="size-4" />
						<span>
							Signing {deal.signing.completedRequiredCount}/
							{deal.signing.requiredCount}
						</span>
					</div>
					<div className="flex items-center gap-2 text-muted-foreground">
						<Clock3 className="size-4" />
						<span>Closing {formatDate(deal.closingDate)}</span>
					</div>
				</div>

				<div className="rounded-md border border-border/70 p-3">
					<div className="flex items-center justify-between gap-3">
						<div className="min-w-0">
							<p className="font-medium text-sm">
								{primaryActionLabel(primaryAction)}
							</p>
							<p className="text-muted-foreground text-xs">
								{criticalBlocker?.message ?? "Projected from governed state"}
							</p>
						</div>
						<Button
							aria-label={`Open ${dealLabel} detail sheet`}
							onClick={(event) => {
								event.stopPropagation();
								openDeal();
							}}
							size="icon"
							type="button"
							variant="outline"
						>
							<ArrowRight className="size-4" />
						</Button>
					</div>
				</div>

				{deal.blockers.length > 0 ? (
					<div className="space-y-2">
						{deal.blockers.slice(0, 2).map((blocker) => (
							<div
								className="flex gap-2 text-muted-foreground text-xs"
								key={`${deal._id}-${blocker.kind}-${blocker.message}`}
							>
								<AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
								<span>{blocker.message}</span>
							</div>
						))}
					</div>
				) : null}

				<DealOperationActionControls actions={deal.actions} dealId={deal._id} />
			</CardContent>
		</Card>
	);
}

export function DealOperationsPipeline() {
	const projection = useQuery(api.deals.queries.getAdminDealOperations) as
		| AdminDealOperationsProjection
		| undefined;
	const { open } = useAdminDetailSheet();
	const [activeFilter, setActiveFilter] =
		useState<AdminDealOperationsFilter>("all");
	const filteredCards = useMemo(
		() => filterDealOperationCards(projection?.cards ?? [], activeFilter),
		[activeFilter, projection?.cards]
	);
	const grouped = useMemo(
		() => groupDealOperationCards(filteredCards),
		[filteredCards]
	);

	if (projection === undefined) {
		return (
			<div className="space-y-4 p-6">
				<div className="h-8 w-64 rounded bg-muted" />
				<div className="grid gap-4 md:grid-cols-3">
					<div className="h-48 rounded-md bg-muted" />
					<div className="h-48 rounded-md bg-muted" />
					<div className="h-48 rounded-md bg-muted" />
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col gap-5 p-6">
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div className="space-y-1">
					<h1 className="font-semibold text-2xl tracking-tight">
						Deal Operations
					</h1>
					<p className="text-muted-foreground text-sm">
						{projection.cards.length} active and historical deal records
						projected from governed closing state.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					{DEAL_OPERATIONS_FILTERS.map((filter) => (
						<Button
							key={filter.id}
							onClick={() => setActiveFilter(filter.id)}
							size="sm"
							type="button"
							variant={activeFilter === filter.id ? "default" : "outline"}
						>
							{filter.label}
							<Badge className="ml-2" variant="secondary">
								{projection.filters[filter.id] ?? 0}
							</Badge>
						</Button>
					))}
				</div>
			</header>

			<ScrollArea className="min-h-0 flex-1">
				<div className="flex min-w-max gap-4 pb-4">
					{DEAL_OPERATIONS_PHASES.map((phase) => (
						<section className="w-80 shrink-0" key={phase.id}>
							<div className="mb-3 flex items-center gap-2">
								<div
									className={cn(
										"size-2.5 rounded-full",
										PHASE_TONE[phase.tone]
									)}
								/>
								<h2 className="font-medium text-sm">{phase.title}</h2>
								<span className="ml-auto text-muted-foreground text-xs">
									{grouped[phase.id].length}
								</span>
							</div>
							<div className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-3">
								{grouped[phase.id].length > 0 ? (
									grouped[phase.id].map((deal) => (
										<DealOperationsCard
											deal={deal}
											key={deal._id}
											onOpenDeal={open}
										/>
									))
								) : (
									<div className="flex h-32 items-center justify-center rounded-md border border-dashed bg-background">
										<p className="text-muted-foreground text-sm">No deals</p>
									</div>
								)}
							</div>
						</section>
					))}
				</div>
				<ScrollBar orientation="horizontal" />
			</ScrollArea>
		</div>
	);
}
