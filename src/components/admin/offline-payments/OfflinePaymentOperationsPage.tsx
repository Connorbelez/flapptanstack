"use client";

import { useAction, useMutation } from "convex/react";
import {
	Banknote,
	CalendarDays,
	CheckCircle2,
	ClipboardList,
	MessageSquare,
	Paperclip,
	Play,
	RefreshCw,
	Search,
	UnlockKeyhole,
	UserPlus,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminKanbanBoard } from "#/components/admin/shell/AdminKanbanBoard";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { type Event, EventManager } from "#/components/ui/event-manager";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { Textarea } from "#/components/ui/textarea";
import { cn } from "#/lib/utils";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type {
	OfflinePaymentBucket,
	OfflinePaymentGroupedEntry,
	OfflinePaymentOperationItem,
	OfflinePaymentOperationsSearchState,
	OfflinePaymentOperationsSnapshot,
	OfflinePaymentOperationsView,
} from "./types";

interface OfflinePaymentOperationsPageProps {
	onRefresh: () => Promise<unknown>;
	search: OfflinePaymentOperationsSearchState;
	setSearch: (
		updater: (
			current: OfflinePaymentOperationsSearchState
		) => OfflinePaymentOperationsSearchState
	) => void;
	snapshot: OfflinePaymentOperationsSnapshot;
}

type BusyOperation =
	| "assign"
	| "confirm"
	| "note"
	| "refresh"
	| "release"
	| "start";

const BUCKET_META: Record<
	OfflinePaymentBucket,
	{ label: string; tone: "critical" | "default" | "positive" | "warning" }
> = {
	confirmed: { label: "Confirmed", tone: "positive" },
	delinquent: { label: "Delinquent", tone: "critical" },
	due: { label: "Due", tone: "warning" },
	in_progress: { label: "In Progress", tone: "default" },
	overdue: { label: "Overdue", tone: "critical" },
	staff_overdue: { label: "Staff Overdue", tone: "critical" },
	upcoming: { label: "Upcoming", tone: "default" },
};

const BOARD_BUCKETS: Array<{
	id: keyof OfflinePaymentOperationsSnapshot["kanban"];
	bucket: OfflinePaymentBucket;
	label: string;
}> = [
	{ bucket: "upcoming", id: "upcoming", label: "Upcoming" },
	{ bucket: "due", id: "due", label: "Due" },
	{ bucket: "in_progress", id: "inProgress", label: "In Progress" },
	{ bucket: "staff_overdue", id: "staffOverdue", label: "Staff Overdue" },
	{ bucket: "overdue", id: "overdue", label: "Overdue" },
	{ bucket: "delinquent", id: "delinquent", label: "Delinquent" },
	{ bucket: "confirmed", id: "confirmed", label: "Confirmed" },
];

const EVENT_COLORS = [
	{
		bg: "bg-sky-500",
		name: "Upcoming",
		text: "text-sky-700",
		value: "upcoming",
	},
	{ bg: "bg-amber-500", name: "Due", text: "text-amber-700", value: "due" },
	{
		bg: "bg-blue-500",
		name: "In Progress",
		text: "text-blue-700",
		value: "in_progress",
	},
	{
		bg: "bg-red-600",
		name: "Staff Overdue",
		text: "text-red-700",
		value: "staff_overdue",
	},
	{
		bg: "bg-orange-600",
		name: "Overdue",
		text: "text-orange-700",
		value: "overdue",
	},
	{
		bg: "bg-rose-700",
		name: "Delinquent",
		text: "text-rose-700",
		value: "delinquent",
	},
	{
		bg: "bg-emerald-600",
		name: "Confirmed",
		text: "text-emerald-700",
		value: "confirmed",
	},
];

function formatCurrency(cents: number) {
	return new Intl.NumberFormat("en-CA", {
		currency: "CAD",
		style: "currency",
	}).format(cents / 100);
}

function formatDate(timestamp: number | undefined) {
	if (!timestamp) {
		return "Unscheduled";
	}
	return new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(timestamp);
}

function formatDateTime(timestamp: number | undefined) {
	if (!timestamp) {
		return "Not recorded";
	}
	return new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "short",
		year: "numeric",
	}).format(timestamp);
}

function dollarsToCents(value: string) {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) {
		return 0;
	}
	return Math.round(numeric * 100);
}

function attachmentIdsFromInput(value: string) {
	return value
		.split(",")
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
}

function flattenBoardItems(snapshot: OfflinePaymentOperationsSnapshot) {
	return BOARD_BUCKETS.flatMap(({ id }) => snapshot.kanban[id]);
}

function findSelectedRecord(
	snapshot: OfflinePaymentOperationsSnapshot,
	selectedPlanEntryId: string | undefined
) {
	if (!selectedPlanEntryId) {
		return {
			card: flattenBoardItems(snapshot)[0] ?? null,
			grouped: null,
		};
	}

	const card =
		flattenBoardItems(snapshot).find(
			(item) => item.planEntryId === selectedPlanEntryId
		) ?? null;
	const grouped =
		snapshot.groupedEntries.find(
			(item) => item.planEntryId === selectedPlanEntryId
		) ?? null;
	return { card, grouped };
}

function itemBucketLabel(bucket: OfflinePaymentBucket) {
	return BUCKET_META[bucket].label;
}

function itemToneClasses(bucket: OfflinePaymentBucket) {
	switch (BUCKET_META[bucket].tone) {
		case "critical":
			return "border-destructive/40 bg-destructive/5 text-destructive";
		case "positive":
			return "border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-100";
		case "warning":
			return "border-amber-400/50 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100";
		default:
			return "border-border/70 bg-muted/20 text-foreground";
	}
}

function buildEvents(snapshot: OfflinePaymentOperationsSnapshot): Event[] {
	return snapshot.calendarEvents.map((event) => {
		const startTime = new Date(event.scheduledDate);
		return {
			category: itemBucketLabel(event.bucket as OfflinePaymentBucket),
			color: event.bucket,
			description: `${event.borrowerLabel} / ${event.mortgageLabel}`,
			endTime: new Date(event.scheduledDate + 30 * 60 * 1000),
			id: event.planEntryId,
			startTime,
			tags: [
				event.isGrouped ? "Grouped" : "Single",
				formatCurrency(event.amount),
			],
			title: event.title,
		};
	});
}

export function OfflinePaymentOperationsPage({
	onRefresh,
	search,
	setSearch,
	snapshot,
}: OfflinePaymentOperationsPageProps) {
	const startCollection = useAction(
		api.payments.offlineOperations.startCollection
	);
	const confirmCollection = useAction(
		api.payments.offlineOperations.confirmCollection
	);
	const confirmGroupedInstallment = useAction(
		api.payments.offlineOperations.confirmGroupedInstallment
	);
	const assignCollector = useMutation(
		api.payments.offlineOperations.assignCollector
	);
	const addCollectionNote = useMutation(
		api.payments.offlineOperations.addCollectionNote
	);
	const releaseCollectionAttempt = useMutation(
		api.payments.offlineOperations.releaseCollectionAttempt
	);

	const [{ card: selectedCard, grouped: selectedGrouped }, setSelectedRecord] =
		useState(() => findSelectedRecord(snapshot, search.selectedPlanEntryId));
	const [busyOperation, setBusyOperation] = useState<BusyOperation | null>(
		null
	);
	const [startReason, setStartReason] = useState("");
	const [collectorActorId, setCollectorActorId] = useState("");
	const [assignmentReason, setAssignmentReason] = useState("");
	const [note, setNote] = useState("");
	const [releaseReason, setReleaseReason] = useState("");
	const [instrumentType, setInstrumentType] = useState<"cash" | "cheque">(
		"cash"
	);
	const [confirmAmountDollars, setConfirmAmountDollars] = useState("");
	const [referenceNumber, setReferenceNumber] = useState("");
	const [chequeNumber, setChequeNumber] = useState("");
	const [depositReference, setDepositReference] = useState("");
	const [receivedAt, setReceivedAt] = useState("");
	const [evidenceAttachmentIds, setEvidenceAttachmentIds] = useState("");
	const [evidenceNote, setEvidenceNote] = useState("");

	const selectedPlanEntryId =
		selectedCard?.planEntryId ?? selectedGrouped?.planEntryId;
	const selectedAmount =
		selectedCard?.remainingCollectibleAmount ?? selectedGrouped?.amount ?? 0;
	const selectedIsGrouped = Boolean(selectedGrouped ?? selectedCard?.isGrouped);

	useEffect(() => {
		setSelectedRecord(findSelectedRecord(snapshot, search.selectedPlanEntryId));
	}, [search.selectedPlanEntryId, snapshot]);

	useEffect(() => {
		if (!selectedPlanEntryId) {
			setConfirmAmountDollars("");
			return;
		}
		if (selectedAmount > 0) {
			setConfirmAmountDollars((selectedAmount / 100).toFixed(2));
		}
	}, [selectedAmount, selectedPlanEntryId]);

	const boardColumns = useMemo(
		() =>
			BOARD_BUCKETS.map(({ bucket, id, label }) => ({
				badge: (
					<Badge className={itemToneClasses(bucket)} variant="outline">
						{snapshot.kanban[id].length}
					</Badge>
				),
				count: snapshot.kanban[id].length,
				emptyLabel: "No cards",
				id,
				items: snapshot.kanban[id],
				label,
			})),
		[snapshot]
	);

	const events = useMemo(() => buildEvents(snapshot), [snapshot]);

	const updateSearch = (
		patch: Partial<OfflinePaymentOperationsSearchState>
	) => {
		setSearch((current) => ({ ...current, ...patch }));
	};

	const selectPlanEntry = (planEntryId: string) => {
		updateSearch({ selectedPlanEntryId: planEntryId });
	};

	const runOperation = async (
		operation: BusyOperation,
		successMessage: string,
		callback: () => Promise<unknown>
	) => {
		setBusyOperation(operation);
		try {
			await callback();
			await onRefresh();
			toast.success(successMessage);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Offline payment action failed"
			);
		} finally {
			setBusyOperation(null);
		}
	};

	const handleRefresh = () =>
		runOperation("refresh", "Offline queue refreshed", onRefresh);

	const handleStart = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!selectedPlanEntryId) {
			return;
		}
		void runOperation("start", "Collection started", () =>
			startCollection({
				earlyStartReason: startReason || undefined,
				planEntryId: selectedPlanEntryId as Id<"collectionPlanEntries">,
				reason: startReason || undefined,
			})
		);
	};

	const handleAssign = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!selectedPlanEntryId) {
			return;
		}
		void runOperation("assign", "Assignment updated", () =>
			assignCollector({
				assignedCollectorActorId: collectorActorId || undefined,
				planEntryId: selectedPlanEntryId as Id<"collectionPlanEntries">,
				reason: assignmentReason,
			})
		);
	};

	const handleNote = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!selectedPlanEntryId) {
			return;
		}
		void runOperation("note", "Note added", async () => {
			await addCollectionNote({
				note,
				planEntryId: selectedPlanEntryId as Id<"collectionPlanEntries">,
			});
			setNote("");
		});
	};

	const handleRelease = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!selectedPlanEntryId) {
			return;
		}
		void runOperation("release", "Collection attempt released", () =>
			releaseCollectionAttempt({
				planEntryId: selectedPlanEntryId as Id<"collectionPlanEntries">,
				reason: releaseReason,
			})
		);
	};

	const handleConfirm = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!selectedPlanEntryId) {
			return;
		}

		const amount = dollarsToCents(confirmAmountDollars);
		const attachmentIds = attachmentIdsFromInput(evidenceAttachmentIds);
		const receivedAtTimestamp = receivedAt
			? Date.parse(`${receivedAt}T12:00:00.000`)
			: undefined;
		const instrument = {
			chequeNumber: chequeNumber || undefined,
			depositReference: depositReference || undefined,
			receivedAt: Number.isNaN(receivedAtTimestamp)
				? undefined
				: receivedAtTimestamp,
			referenceNumber: referenceNumber || undefined,
			type: instrumentType,
		};
		const evidence = {
			attachmentIds,
			note: evidenceNote,
		};

		void runOperation("confirm", "Offline payment confirmed", () =>
			selectedIsGrouped
				? confirmGroupedInstallment({
						amount,
						evidence,
						instrument,
						planEntryId: selectedPlanEntryId as Id<"collectionPlanEntries">,
					})
				: confirmCollection({
						amount,
						evidence,
						instrument,
						planEntryId: selectedPlanEntryId as Id<"collectionPlanEntries">,
					})
		);
	};

	const metricItems = [
		{
			label: "Upcoming",
			value: snapshot.counters.upcoming,
			bucket: "upcoming",
		},
		{ label: "Due", value: snapshot.counters.due, bucket: "due" },
		{
			label: "In Progress",
			value: snapshot.counters.inProgress,
			bucket: "in_progress",
		},
		{
			label: "Staff Overdue",
			value: snapshot.counters.staffOverdue,
			bucket: "staff_overdue",
		},
		{ label: "Overdue", value: snapshot.counters.overdue, bucket: "overdue" },
		{
			label: "Delinquent",
			value: snapshot.counters.delinquent,
			bucket: "delinquent",
		},
	] as const;

	return (
		<div className="space-y-6 p-4 md:p-6">
			<section className="flex flex-col gap-4 border-border/70 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
				<div className="space-y-2">
					<p className="text-muted-foreground text-sm">
						Offline payment operations
					</p>
					<h1 className="font-semibold text-3xl tracking-tight">
						Manual Collections
					</h1>
				</div>
				<Button
					disabled={busyOperation === "refresh"}
					onClick={handleRefresh}
					variant="outline"
				>
					<RefreshCw className="size-4" />
					Refresh
				</Button>
			</section>

			<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
				{metricItems.map((metric) => (
					<button
						className={cn(
							"rounded-lg border border-border/70 bg-muted/20 p-4 text-left transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							search.statusBucket === metric.bucket && "border-primary/70"
						)}
						key={metric.bucket}
						onClick={() =>
							updateSearch({
								statusBucket:
									search.statusBucket === metric.bucket ? "all" : metric.bucket,
							})
						}
						type="button"
					>
						<div className="text-muted-foreground text-sm">{metric.label}</div>
						<div className="mt-1 font-semibold text-2xl tabular-nums">
							{metric.value}
						</div>
					</button>
				))}
			</section>

			<section className="grid gap-3 rounded-lg border border-border/70 bg-background p-4 lg:grid-cols-[minmax(240px,1fr)_repeat(6,minmax(130px,170px))_auto]">
				<div className="space-y-2">
					<Label htmlFor="offline-search">Search</Label>
					<div className="relative">
						<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							className="pl-9"
							id="offline-search"
							onChange={(event) =>
								updateSearch({ search: event.target.value || undefined })
							}
							placeholder="Borrower, mortgage, transfer"
							value={search.search ?? ""}
						/>
					</div>
				</div>
				<div className="space-y-2">
					<Label>Status</Label>
					<Select
						onValueChange={(value) =>
							updateSearch({
								statusBucket:
									value as OfflinePaymentOperationsSearchState["statusBucket"],
							})
						}
						value={search.statusBucket ?? "all"}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All</SelectItem>
							{BOARD_BUCKETS.map(({ bucket, label }) => (
								<SelectItem key={bucket} value={bucket}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label>Evidence</Label>
					<Select
						onValueChange={(value) =>
							updateSearch({
								evidenceType:
									value as OfflinePaymentOperationsSearchState["evidenceType"],
							})
						}
						value={search.evidenceType ?? "all"}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All</SelectItem>
							<SelectItem value="with_evidence">With evidence</SelectItem>
							<SelectItem value="missing_evidence">Missing evidence</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor="date-from">From</Label>
					<Input
						id="date-from"
						onChange={(event) =>
							updateSearch({ dateFrom: event.target.value || undefined })
						}
						type="date"
						value={search.dateFrom ?? ""}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="date-to">To</Label>
					<Input
						id="date-to"
						onChange={(event) =>
							updateSearch({ dateTo: event.target.value || undefined })
						}
						type="date"
						value={search.dateTo ?? ""}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="amount-min">Min amount</Label>
					<Input
						id="amount-min"
						inputMode="decimal"
						min="0"
						onChange={(event) =>
							updateSearch({ amountMin: event.target.value || undefined })
						}
						placeholder="0.00"
						step="0.01"
						type="number"
						value={search.amountMin ?? ""}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="amount-max">Max amount</Label>
					<Input
						id="amount-max"
						inputMode="decimal"
						min="0"
						onChange={(event) =>
							updateSearch({ amountMax: event.target.value || undefined })
						}
						placeholder="0.00"
						step="0.01"
						type="number"
						value={search.amountMax ?? ""}
					/>
				</div>
				<div className="flex items-end">
					<div className="flex h-10 items-center gap-2">
						<Switch
							checked={search.staffOverdueOnly}
							id="staff-overdue-only"
							onCheckedChange={(checked) =>
								updateSearch({ staffOverdueOnly: checked })
							}
						/>
						<Label className="whitespace-nowrap" htmlFor="staff-overdue-only">
							Staff overdue
						</Label>
					</div>
				</div>
			</section>

			<Tabs
				onValueChange={(value) =>
					updateSearch({ view: value as OfflinePaymentOperationsView })
				}
				value={search.view}
			>
				<TabsList>
					<TabsTrigger value="board">
						<ClipboardList className="size-4" />
						Board
					</TabsTrigger>
					<TabsTrigger value="grouped">
						<Banknote className="size-4" />
						Grouped
					</TabsTrigger>
					<TabsTrigger value="agenda">
						<CalendarDays className="size-4" />
						Agenda
					</TabsTrigger>
				</TabsList>

				<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
					<div className="min-w-0">
						<TabsContent className="mt-4" value="board">
							<AdminKanbanBoard
								columns={boardColumns}
								getItemId={(item) => item.planEntryId}
								onSelectItem={(item) => selectPlanEntry(item.planEntryId)}
								renderItem={(item) => <OfflineCard item={item} />}
								variant="operations"
							/>
						</TabsContent>
						<TabsContent className="mt-4" value="grouped">
							<GroupedInstallmentsTable
								entries={snapshot.groupedEntries}
								onSelect={(entry) => selectPlanEntry(entry.planEntryId)}
								selectedPlanEntryId={selectedPlanEntryId}
							/>
						</TabsContent>
						<TabsContent className="mt-4" value="agenda">
							<EventManager
								allowCreate={false}
								allowEdit={false}
								availableTags={["Grouped", "Single"]}
								categories={BOARD_BUCKETS.map(({ label }) => label)}
								colors={EVENT_COLORS}
								defaultView="list"
								events={events}
								showFilters={false}
								title="Collection Agenda"
							/>
						</TabsContent>
					</div>
					<SelectedOperationPanel
						assignmentReason={assignmentReason}
						busyOperation={busyOperation}
						chequeNumber={chequeNumber}
						collectorActorId={collectorActorId}
						confirmAmountDollars={confirmAmountDollars}
						depositReference={depositReference}
						evidenceAttachmentIds={evidenceAttachmentIds}
						evidenceNote={evidenceNote}
						instrumentType={instrumentType}
						note={note}
						onAssign={handleAssign}
						onConfirm={handleConfirm}
						onNote={handleNote}
						onRelease={handleRelease}
						onStart={handleStart}
						receivedAt={receivedAt}
						referenceNumber={referenceNumber}
						releaseReason={releaseReason}
						selectedCard={selectedCard}
						selectedGrouped={selectedGrouped}
						setAssignmentReason={setAssignmentReason}
						setChequeNumber={setChequeNumber}
						setCollectorActorId={setCollectorActorId}
						setConfirmAmountDollars={setConfirmAmountDollars}
						setDepositReference={setDepositReference}
						setEvidenceAttachmentIds={setEvidenceAttachmentIds}
						setEvidenceNote={setEvidenceNote}
						setInstrumentType={setInstrumentType}
						setNote={setNote}
						setReceivedAt={setReceivedAt}
						setReferenceNumber={setReferenceNumber}
						setReleaseReason={setReleaseReason}
						setStartReason={setStartReason}
						startReason={startReason}
					/>
				</div>
			</Tabs>
		</div>
	);
}

function OfflineCard({ item }: { item: OfflinePaymentOperationItem }) {
	return (
		<>
			<div className="flex w-full items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<p className="truncate font-medium text-sm">{item.borrowerLabel}</p>
					<p className="truncate text-muted-foreground text-xs">
						{item.mortgageLabel}
					</p>
				</div>
				<Badge className={itemToneClasses(item.bucket)} variant="outline">
					{itemBucketLabel(item.bucket)}
				</Badge>
			</div>
			<div className="grid w-full grid-cols-2 gap-2 text-sm">
				<MiniStat label="Amount" value={formatCurrency(item.amount)} />
				<MiniStat label="Scheduled" value={formatDate(item.scheduledDate)} />
				<MiniStat
					label="Remaining"
					value={formatCurrency(item.remainingCollectibleAmount)}
				/>
				<MiniStat
					label="Evidence"
					value={`${item.evidenceAttachmentIds.length}`}
				/>
			</div>
			<div className="flex flex-wrap gap-1">
				{item.assignedCollectorActorId ? (
					<Badge variant="secondary">{item.assignedCollectorActorId}</Badge>
				) : null}
				{item.transferStatus ? (
					<Badge variant="outline">{item.transferStatus}</Badge>
				) : null}
			</div>
		</>
	);
}

function MiniStat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
			<div className="text-muted-foreground text-xs">{label}</div>
			<div className="truncate font-medium tabular-nums">{value}</div>
		</div>
	);
}

function GroupedInstallmentsTable({
	entries,
	onSelect,
	selectedPlanEntryId,
}: {
	entries: readonly OfflinePaymentGroupedEntry[];
	onSelect: (entry: OfflinePaymentGroupedEntry) => void;
	selectedPlanEntryId?: string;
}) {
	if (entries.length === 0) {
		return (
			<div className="rounded-lg border border-border/70 border-dashed p-10 text-center text-muted-foreground text-sm">
				No grouped installments.
			</div>
		);
	}

	return (
		<div className="overflow-hidden rounded-lg border border-border/70">
			{entries.map((entry) => (
				<details
					className={cn(
						"border-border/70 border-b last:border-b-0",
						selectedPlanEntryId === entry.planEntryId && "bg-primary/5"
					)}
					key={entry.planEntryId}
					onToggle={(event) => {
						if (event.currentTarget.open) {
							onSelect(entry);
						}
					}}
					open={selectedPlanEntryId === entry.planEntryId}
				>
					<summary className="grid cursor-pointer gap-3 px-4 py-3 hover:bg-muted/30 md:grid-cols-[minmax(220px,1fr)_160px_160px_120px]">
						<div>
							<div className="font-medium text-sm">{entry.borrowerLabel}</div>
							<div className="text-muted-foreground text-xs">
								{entry.mortgageLabel}
							</div>
						</div>
						<div>
							<div className="text-muted-foreground text-xs">Amount</div>
							<div className="font-medium tabular-nums">
								{formatCurrency(entry.amount)}
							</div>
						</div>
						<div>
							<div className="text-muted-foreground text-xs">Scheduled</div>
							<div>{formatDate(entry.scheduledDate)}</div>
						</div>
						<div>
							<Badge
								className={itemToneClasses(
									entry.bucket as OfflinePaymentBucket
								)}
								variant="outline"
							>
								{itemBucketLabel(entry.bucket as OfflinePaymentBucket)}
							</Badge>
						</div>
					</summary>
					<div className="grid gap-2 border-border/70 border-t bg-muted/10 p-4">
						{entry.installments.map((installment) => (
							<div
								className="rounded-lg border border-border/70 bg-background p-3"
								key={installment.planEntryId}
							>
								<div className="mb-2 flex items-center justify-between gap-3">
									<div className="font-medium text-sm">
										{formatCurrency(installment.amount)}
									</div>
									<div className="text-muted-foreground text-xs">
										{installment.obligationIds.length} obligations
									</div>
								</div>
								<div className="grid gap-2 md:grid-cols-2">
									{installment.obligations.map((obligation) => (
										<div
											className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm"
											key={obligation.obligationId}
										>
											<div className="flex items-center justify-between gap-2">
												<span>Payment {obligation.paymentNumber ?? "N/A"}</span>
												<Badge variant="outline">{obligation.status}</Badge>
											</div>
											<div className="mt-1 text-muted-foreground text-xs">
												{formatCurrency(obligation.amountSettled)} /{" "}
												{formatCurrency(obligation.amount)}
											</div>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				</details>
			))}
		</div>
	);
}

function SelectedOperationPanel(props: {
	assignmentReason: string;
	busyOperation: BusyOperation | null;
	chequeNumber: string;
	collectorActorId: string;
	confirmAmountDollars: string;
	depositReference: string;
	evidenceAttachmentIds: string;
	evidenceNote: string;
	instrumentType: "cash" | "cheque";
	note: string;
	onAssign: (event: FormEvent<HTMLFormElement>) => void;
	onConfirm: (event: FormEvent<HTMLFormElement>) => void;
	onNote: (event: FormEvent<HTMLFormElement>) => void;
	onRelease: (event: FormEvent<HTMLFormElement>) => void;
	onStart: (event: FormEvent<HTMLFormElement>) => void;
	receivedAt: string;
	referenceNumber: string;
	releaseReason: string;
	selectedCard: OfflinePaymentOperationItem | null;
	selectedGrouped: OfflinePaymentGroupedEntry | null;
	setAssignmentReason: (value: string) => void;
	setChequeNumber: (value: string) => void;
	setCollectorActorId: (value: string) => void;
	setConfirmAmountDollars: (value: string) => void;
	setDepositReference: (value: string) => void;
	setEvidenceAttachmentIds: (value: string) => void;
	setEvidenceNote: (value: string) => void;
	setInstrumentType: (value: "cash" | "cheque") => void;
	setNote: (value: string) => void;
	setReceivedAt: (value: string) => void;
	setReferenceNumber: (value: string) => void;
	setReleaseReason: (value: string) => void;
	setStartReason: (value: string) => void;
	startReason: string;
}) {
	const selectedLabel =
		props.selectedCard?.borrowerLabel ?? props.selectedGrouped?.borrowerLabel;
	const selectedMortgage =
		props.selectedCard?.mortgageLabel ?? props.selectedGrouped?.mortgageLabel;
	const selectedScheduled =
		props.selectedCard?.scheduledDate ?? props.selectedGrouped?.scheduledDate;
	const selectedBucket = (props.selectedCard?.bucket ??
		props.selectedGrouped?.bucket) as OfflinePaymentBucket | undefined;

	if (!selectedLabel) {
		return (
			<aside className="rounded-lg border border-border/70 border-dashed p-6 text-center text-muted-foreground text-sm">
				Select a collection.
			</aside>
		);
	}

	return (
		<aside className="space-y-4 rounded-lg border border-border/70 bg-background p-4">
			<div className="space-y-2">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h2 className="font-semibold text-lg">{selectedLabel}</h2>
						<p className="text-muted-foreground text-sm">{selectedMortgage}</p>
					</div>
					{selectedBucket ? (
						<Badge
							className={itemToneClasses(selectedBucket)}
							variant="outline"
						>
							{itemBucketLabel(selectedBucket)}
						</Badge>
					) : null}
				</div>
				<div className="grid grid-cols-2 gap-2">
					<MiniStat label="Scheduled" value={formatDate(selectedScheduled)} />
					<MiniStat
						label="Confirmed"
						value={formatDateTime(props.selectedCard?.confirmedAt)}
					/>
				</div>
			</div>

			<form
				className="space-y-3 border-border/70 border-t pt-4"
				onSubmit={props.onStart}
			>
				<PanelTitle icon={<Play className="size-4" />} title="Start" />
				<Textarea
					onChange={(event) => props.setStartReason(event.target.value)}
					placeholder="Early-start or handoff reason"
					value={props.startReason}
				/>
				<Button disabled={props.busyOperation === "start"} type="submit">
					<Play className="size-4" />
					Start
				</Button>
			</form>

			<form
				className="space-y-3 border-border/70 border-t pt-4"
				onSubmit={props.onConfirm}
			>
				<PanelTitle
					icon={<CheckCircle2 className="size-4" />}
					title="Confirm"
				/>
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-2">
						<Label htmlFor="confirm-amount">Amount</Label>
						<Input
							id="confirm-amount"
							onChange={(event) =>
								props.setConfirmAmountDollars(event.target.value)
							}
							step="0.01"
							type="number"
							value={props.confirmAmountDollars}
						/>
					</div>
					<div className="space-y-2">
						<Label>Instrument</Label>
						<Select
							onValueChange={(value) =>
								props.setInstrumentType(value as "cash" | "cheque")
							}
							value={props.instrumentType}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="cash">Cash</SelectItem>
								<SelectItem value="cheque">Cheque</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<Input
						onChange={(event) => props.setReferenceNumber(event.target.value)}
						placeholder="Reference"
						value={props.referenceNumber}
					/>
					<Input
						onChange={(event) => props.setReceivedAt(event.target.value)}
						type="date"
						value={props.receivedAt}
					/>
					<Input
						onChange={(event) => props.setChequeNumber(event.target.value)}
						placeholder="Cheque"
						value={props.chequeNumber}
					/>
					<Input
						onChange={(event) => props.setDepositReference(event.target.value)}
						placeholder="Deposit"
						value={props.depositReference}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="evidence-attachments">
						<span className="inline-flex items-center gap-2">
							<Paperclip className="size-4" />
							Evidence IDs
						</span>
					</Label>
					<Input
						id="evidence-attachments"
						onChange={(event) =>
							props.setEvidenceAttachmentIds(event.target.value)
						}
						placeholder="storage-id-1, storage-id-2"
						value={props.evidenceAttachmentIds}
					/>
				</div>
				<Textarea
					onChange={(event) => props.setEvidenceNote(event.target.value)}
					placeholder="Evidence note"
					value={props.evidenceNote}
				/>
				<Button disabled={props.busyOperation === "confirm"} type="submit">
					<CheckCircle2 className="size-4" />
					Confirm
				</Button>
			</form>

			<form
				className="space-y-3 border-border/70 border-t pt-4"
				onSubmit={props.onAssign}
			>
				<PanelTitle icon={<UserPlus className="size-4" />} title="Assign" />
				<Input
					onChange={(event) => props.setCollectorActorId(event.target.value)}
					placeholder="Collector actor ID"
					value={props.collectorActorId}
				/>
				<Textarea
					onChange={(event) => props.setAssignmentReason(event.target.value)}
					placeholder="Assignment reason"
					value={props.assignmentReason}
				/>
				<Button
					disabled={props.busyOperation === "assign"}
					type="submit"
					variant="outline"
				>
					<UserPlus className="size-4" />
					Assign
				</Button>
			</form>

			<form
				className="space-y-3 border-border/70 border-t pt-4"
				onSubmit={props.onNote}
			>
				<PanelTitle icon={<MessageSquare className="size-4" />} title="Note" />
				<Textarea
					onChange={(event) => props.setNote(event.target.value)}
					placeholder="Collection note"
					value={props.note}
				/>
				<Button
					disabled={props.busyOperation === "note"}
					type="submit"
					variant="outline"
				>
					<MessageSquare className="size-4" />
					Add note
				</Button>
			</form>

			<form
				className="space-y-3 border-border/70 border-t pt-4"
				onSubmit={props.onRelease}
			>
				<PanelTitle
					icon={<UnlockKeyhole className="size-4" />}
					title="Release"
				/>
				<Textarea
					onChange={(event) => props.setReleaseReason(event.target.value)}
					placeholder="Release reason"
					value={props.releaseReason}
				/>
				<Button
					disabled={props.busyOperation === "release"}
					type="submit"
					variant="destructive"
				>
					<UnlockKeyhole className="size-4" />
					Release
				</Button>
			</form>
		</aside>
	);
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
	return (
		<div className="flex items-center gap-2 font-medium text-sm">
			{icon}
			{title}
		</div>
	);
}
