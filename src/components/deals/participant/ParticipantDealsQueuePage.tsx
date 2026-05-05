"use client";

import type { FunctionReturnType } from "convex/server";
import { CheckCircle2, Clock3, FileWarning, FolderOpen } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import type { api } from "../../../../convex/_generated/api";

type ParticipantDealQueue = FunctionReturnType<
	typeof api.deals.queries.getParticipantDealQueue
>;
type QueueItem = ParticipantDealQueue["needsAction"][number];

interface ParticipantDealsQueuePageProps {
	queue: ParticipantDealQueue;
}

const groupConfig = {
	needsAction: {
		icon: FileWarning,
		label: "Needs Action",
	},
	inProgress: {
		icon: Clock3,
		label: "In Progress",
	},
	completed: {
		icon: CheckCircle2,
		label: "Completed",
	},
} as const;

export function ParticipantDealsQueuePage({
	queue,
}: ParticipantDealsQueuePageProps) {
	const hasDeals =
		queue.needsAction.length +
			queue.inProgress.length +
			queue.completed.length >
		0;
	const title =
		queue.persona === "selling_lender"
			? "Selling Lender Closings"
			: "Lender Closings";

	return (
		<div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
			<header className="space-y-2">
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="outline">{queue.persona}</Badge>
					<Badge variant="secondary">{title}</Badge>
				</div>
				<div>
					<h1 className="font-semibold text-3xl tracking-tight">My Closings</h1>
					<p className="text-muted-foreground text-sm">
						{hasDeals
							? "Active and completed deal workspaces grouped by next action."
							: "No active closings are assigned to this workspace."}
					</p>
				</div>
			</header>

			{hasDeals ? (
				<div className="grid gap-4 lg:grid-cols-3">
					<QueueGroup items={queue.needsAction} kind="needsAction" />
					<QueueGroup items={queue.inProgress} kind="inProgress" />
					<QueueGroup items={queue.completed} kind="completed" />
				</div>
			) : (
				<Card>
					<CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
						<div className="flex size-11 items-center justify-center rounded-full bg-muted">
							<FolderOpen className="size-5 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium text-sm">No active closings</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Completed and active deal workspaces will appear here when
								access is granted.
							</p>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function QueueGroup({
	items,
	kind,
}: {
	items: QueueItem[];
	kind: keyof typeof groupConfig;
}) {
	const Icon = groupConfig[kind].icon;
	return (
		<section className="space-y-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Icon className="size-4 text-muted-foreground" />
					<h2 className="font-medium text-sm">{groupConfig[kind].label}</h2>
				</div>
				<Badge variant="secondary">{items.length}</Badge>
			</div>
			<div className="space-y-3">
				{items.length > 0 ? (
					items.map((item) => <QueueCard item={item} key={item.dealId} />)
				) : (
					<div className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm">
						No closings in this group.
					</div>
				)}
			</div>
		</section>
	);
}

function QueueCard({ item }: { item: QueueItem }) {
	const href = `/lender/deals/${String(item.dealId)}`;

	return (
		<Card>
			<CardHeader className="space-y-2 pb-3">
				<div className="flex items-start justify-between gap-3">
					<div>
						<CardTitle className="text-base">{item.propertyLabel}</CardTitle>
						<CardDescription>{item.nextAction}</CardDescription>
					</div>
					<Badge variant="outline">{formatStatus(item.signingStatus)}</Badge>
				</div>
			</CardHeader>
			<CardContent className="flex items-center justify-between gap-3">
				<div className="text-muted-foreground text-xs">
					{formatDate(item.closingDate)}
				</div>
				<Button asChild size="sm" variant="outline">
					<a href={href}>Open</a>
				</Button>
			</CardContent>
		</Card>
	);
}

function formatStatus(value: string) {
	return value
		.split("_")
		.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

function formatDate(value: number | null) {
	if (typeof value !== "number") {
		return "Closing date unavailable";
	}
	return new Date(value).toLocaleDateString("en-CA", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}
