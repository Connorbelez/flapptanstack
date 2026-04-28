import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import {
	ArrowRight,
	BriefcaseBusiness,
	CalendarDays,
	CheckCircle2,
	FileSignature,
	Scale,
	UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import type { api } from "../../../../convex/_generated/api";
import {
	groupLawyerMatters,
	LAWYER_MATTER_QUEUE_BUCKETS,
	type LawyerMatterQueueBucket,
} from "./lawyerDealViewModel";

type AssignedClosings = FunctionReturnType<
	typeof api.deals.lawyerQueries.listAssignedClosings
>;
type AssignedClosing = AssignedClosings[number];

const BUCKET_META: Record<
	LawyerMatterQueueBucket,
	{ accent: string; icon: typeof BriefcaseBusiness; tone: string }
> = {
	needsRepresentationConfirmation: {
		accent: "bg-sky-500",
		icon: Scale,
		tone: "border-sky-200 bg-sky-50/80 text-sky-950",
	},
	needsPackageReview: {
		accent: "bg-amber-500",
		icon: FileSignature,
		tone: "border-amber-200 bg-amber-50/80 text-amber-950",
	},
	awaitingSigners: {
		accent: "bg-teal-500",
		icon: UsersRound,
		tone: "border-teal-200 bg-teal-50/80 text-teal-950",
	},
	completed: {
		accent: "bg-emerald-500",
		icon: CheckCircle2,
		tone: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
	},
};

function formatDate(value: number | null) {
	if (typeof value !== "number") {
		return "No closing date";
	}
	return new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(new Date(value));
}

function formatPercent(value: number | null) {
	if (typeof value !== "number") {
		return "Share unavailable";
	}
	return `${value}% share`;
}

function statusLabel(status: string) {
	return status
		.split(".")
		.flatMap((segment) => segment.split("_"))
		.map((segment) =>
			segment.length > 0
				? `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`
				: segment
		)
		.join(" ");
}

interface LawyerAssignedClosingsPageProps {
	matters: AssignedClosings;
	renderMatterLink?: (
		matter: AssignedClosing,
		children: ReactNode
	) => ReactNode;
}

export function LawyerAssignedClosingsPage({
	renderMatterLink,
	matters,
}: LawyerAssignedClosingsPageProps) {
	const grouped = groupLawyerMatters(matters);
	const openCount = matters.filter(
		(matter) => matter.accessState === "active" && matter.status !== "confirmed"
	).length;

	return (
		<main className="min-h-dvh bg-slate-50">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
				<header className="flex flex-col gap-4 border-slate-200 border-b pb-5 md:flex-row md:items-end md:justify-between">
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-slate-600 text-sm">
							<BriefcaseBusiness className="size-4" />
							<span>Lawyer Workspace</span>
						</div>
						<h1 className="font-semibold text-3xl text-slate-950">
							Assigned Closings
						</h1>
						<p className="max-w-3xl text-slate-600 text-sm leading-6">
							Closing matters assigned to your active lawyer role, grouped by
							the next required legal action.
						</p>
					</div>
					<div className="grid grid-cols-2 gap-2 sm:flex">
						<Metric label="Active matters" value={openCount.toString()} />
						<Metric label="Total assigned" value={matters.length.toString()} />
					</div>
				</header>

				{matters.length === 0 ? (
					<EmptyQueue />
				) : (
					<div className="grid gap-4 xl:grid-cols-2">
						{LAWYER_MATTER_QUEUE_BUCKETS.map((bucket) => (
							<QueueSection
								bucket={bucket.key}
								key={bucket.key}
								label={bucket.label}
								matters={grouped[bucket.key] as AssignedClosing[]}
								renderMatterLink={renderMatterLink}
							/>
						))}
					</div>
				)}
			</div>
		</main>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-md border border-slate-200 bg-white px-4 py-3 shadow-xs">
			<p className="text-slate-500 text-xs">{label}</p>
			<p className="font-semibold text-2xl text-slate-950">{value}</p>
		</div>
	);
}

function EmptyQueue() {
	return (
		<Card className="border-dashed bg-white">
			<CardHeader>
				<CardTitle>No assigned closings</CardTitle>
				<CardDescription>
					Active lawyer matters will appear here when FairLend grants deal
					access.
				</CardDescription>
			</CardHeader>
		</Card>
	);
}

function QueueSection({
	bucket,
	label,
	matters,
	renderMatterLink,
}: {
	bucket: LawyerMatterQueueBucket;
	label: string;
	matters: AssignedClosing[];
	renderMatterLink?: (
		matter: AssignedClosing,
		children: ReactNode
	) => ReactNode;
}) {
	const meta = BUCKET_META[bucket];
	const Icon = meta.icon;

	return (
		<section className="rounded-lg border border-slate-200 bg-white shadow-xs">
			<div className="flex items-center justify-between gap-3 border-slate-200 border-b px-4 py-3">
				<div className="flex min-w-0 items-center gap-3">
					<div
						className={`flex size-9 items-center justify-center rounded-md ${meta.tone}`}
					>
						<Icon className="size-4" />
					</div>
					<div className="min-w-0">
						<h2 className="font-semibold text-slate-950 text-sm">{label}</h2>
						<p className="text-slate-500 text-xs">
							{matters.length} {matters.length === 1 ? "matter" : "matters"}
						</p>
					</div>
				</div>
				<span className={`h-2 w-10 rounded-full ${meta.accent}`} />
			</div>
			<div className="divide-y divide-slate-100">
				{matters.length === 0 ? (
					<p className="px-4 py-6 text-slate-500 text-sm">
						No matters in this lane.
					</p>
				) : (
					matters.map((matter) => (
						<MatterRow
							key={matter.dealId}
							matter={matter}
							renderMatterLink={renderMatterLink}
						/>
					))
				)}
			</div>
		</section>
	);
}

function MatterRow({
	matter,
	renderMatterLink,
}: {
	matter: AssignedClosing;
	renderMatterLink?: (
		matter: AssignedClosing,
		children: ReactNode
	) => ReactNode;
}) {
	const linkChildren = (
		<>
			Open <ArrowRight className="size-4" />
		</>
	);

	return (
		<div className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto] md:items-center">
			<div className="min-w-0 space-y-2">
				<div className="flex flex-wrap items-center gap-2">
					<h3 className="font-medium text-slate-950">{matter.matterName}</h3>
					<Badge
						variant={matter.accessState === "active" ? "outline" : "secondary"}
					>
						{matter.accessState === "active" ? "Active" : "Read-only"}
					</Badge>
				</div>
				<div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600 text-sm">
					<span className="inline-flex items-center gap-1.5">
						<CalendarDays className="size-3.5" />
						{formatDate(matter.closingDate)}
					</span>
					<span>{formatPercent(matter.fractionalShareDisplayPercent)}</span>
					<span>{statusLabel(matter.status)}</span>
				</div>
			</div>
			<Button asChild size="sm" variant="outline">
				{renderMatterLink ? (
					renderMatterLink(matter, linkChildren)
				) : (
					<Link params={{ dealId: matter.dealId }} to="/lawyer/deals/$dealId">
						{linkChildren}
					</Link>
				)}
			</Button>
		</div>
	);
}
