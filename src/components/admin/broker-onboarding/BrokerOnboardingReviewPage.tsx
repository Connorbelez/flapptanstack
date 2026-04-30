"use client";

import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
	CheckCircle2,
	Clock3,
	MessageSquareText,
	RefreshCw,
	XCircle,
} from "lucide-react";
import {
	type FormEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useState,
} from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Textarea } from "#/components/ui/textarea";
import { cn } from "#/lib/utils";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
	BROKER_ONBOARDING_REOPENABLE_FIELD_PATHS,
	type BrokerOnboardingReopenableFieldPath,
} from "../../../../shared/brokerOnboarding/contracts";

type QueueView =
	| "submitted"
	| "changes_requested"
	| "recently_updated"
	| "rejected";
type ApplicationId = Id<"brokerOnboardingApplications">;
type ReviewActionResult = Promise<unknown>;
type ApproveReviewAction = (args: {
	applicationId: ApplicationId;
	reviewerNote: string;
}) => ReviewActionResult;
type RejectReviewAction = ApproveReviewAction;
type RequestChangesReviewAction = (args: {
	applicationId: ApplicationId;
	reopenedFields: Array<{ fieldPath: BrokerOnboardingReopenableFieldPath }>;
	reverificationFlags: {
		identityVerification: boolean;
		regulatorLookup: boolean;
	};
	reviewerNote: string;
}) => ReviewActionResult;

interface ReviewActionsApi {
	approve: ApproveReviewAction;
	reject: RejectReviewAction;
	requestChanges: RequestChangesReviewAction;
}

type ReviewQueue = FunctionReturnType<
	typeof api.onboarding.brokerApplication.queries.listReviewQueue
>;
type ReviewQueueItem = ReviewQueue[number];
type ReviewDossier = NonNullable<
	FunctionReturnType<
		typeof api.onboarding.brokerApplication.queries.getReviewDossier
	>
>;
type ReviewEntry = ReviewDossier["reviewEntries"][number];
type AuditHistoryEntry = ReviewDossier["auditHistory"][number];

const QUEUE_TABS: Array<{ label: string; value: QueueView }> = [
	{ label: "Submitted", value: "submitted" },
	{ label: "Changes Requested", value: "changes_requested" },
	{ label: "Recently Updated", value: "recently_updated" },
	{ label: "Rejected", value: "rejected" },
];

const REOPENABLE_FIELD_LABELS = {
	"draftData.brokerageName": "Brokerage name",
	"draftData.brokerageNumber": "Brokerage number",
	"draftData.licenseNumber": "License number",
	"draftData.licenseProvince": "License province",
	"draftData.requestedPortalSlug": "Portal slug",
	"draftData.selfReportedName": "Legal name",
} as const satisfies Record<
	(typeof BROKER_ONBOARDING_REOPENABLE_FIELD_PATHS)[number],
	string
>;

const REOPENABLE_FIELDS = BROKER_ONBOARDING_REOPENABLE_FIELD_PATHS.map(
	(value) => ({ label: REOPENABLE_FIELD_LABELS[value], value })
);

const REVIEWABLE_APPLICATION_STATUSES = new Set<ReviewQueueItem["status"]>([
	"submitted",
]);

const REVIEW_MODE_LABELS = {
	approve: "Approve",
	reject: "Reject",
	request_changes: "Request changes",
} as const;

function formatTimestamp(value: number | null | undefined) {
	if (!value) {
		return "Not recorded";
	}
	return new Intl.DateTimeFormat("en-CA", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function formatName(name: ReviewQueueItem["draftSummary"]["selfReportedName"]) {
	if (!name) {
		return "No name";
	}
	const joinedName = [name.firstName, name.middleName, name.lastName]
		.filter(Boolean)
		.join(" ");
	return name.fullName?.trim() || joinedName.trim() || "No name";
}

function StatusBadge({ status }: { status: string }) {
	const variant = status === "rejected" ? "destructive" : "outline";
	return <Badge variant={variant}>{status.replaceAll("_", " ")}</Badge>;
}

function QueueList({
	items,
	onSelect,
	selectedId,
}: {
	items: ReviewQueueItem[];
	onSelect: (id: ApplicationId) => void;
	selectedId: ApplicationId | null;
}) {
	if (items.length === 0) {
		return (
			<div className="rounded-md border border-dashed p-6 text-muted-foreground text-sm">
				No applications in this view.
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{items.map((item) => (
				<button
					className={cn(
						"w-full rounded-md border bg-background p-3 text-left transition-colors hover:bg-muted/50",
						selectedId === item.applicationId && "border-primary bg-primary/5"
					)}
					key={item.applicationId}
					onClick={() => onSelect(item.applicationId)}
					type="button"
				>
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<div className="truncate font-medium text-sm">
								{formatName(item.draftSummary.selfReportedName)}
							</div>
							<div className="truncate text-muted-foreground text-xs">
								{item.draftSummary.brokerageName ?? "No brokerage"} /{" "}
								{item.verifiedEmail ?? "No verified email"}
							</div>
						</div>
						<StatusBadge status={item.status} />
					</div>
					<div className="mt-3 grid grid-cols-2 gap-2 text-xs">
						<span>Freshness: {item.freshness ?? "unknown"}</span>
						<span>IDV: {item.identityVerificationStatus ?? "unknown"}</span>
						<span>Regulator: {item.regulatorStatus ?? "unknown"}</span>
						<span>Updated: {formatTimestamp(item.updatedAt)}</span>
					</div>
					{item.reasonCodes.length > 0 ? (
						<div className="mt-2 flex flex-wrap gap-1">
							{item.reasonCodes.slice(0, 3).map((reasonCode) => (
								<Badge key={reasonCode} variant="secondary">
									{reasonCode}
								</Badge>
							))}
						</div>
					) : null}
				</button>
			))}
		</div>
	);
}

export function resolveBrokerOnboardingReviewSelection(
	selectedId: ApplicationId | null,
	queueItems: readonly ReviewQueueItem[]
) {
	if (queueItems.length === 0) {
		return null;
	}
	if (
		selectedId &&
		queueItems.some((item) => item.applicationId === selectedId)
	) {
		return selectedId;
	}
	return queueItems[0]?.applicationId ?? null;
}

function ReviewThread({ entries }: { entries: ReviewEntry[] }) {
	return (
		<section className="space-y-3">
			<h2 className="font-semibold text-base">Review Thread</h2>
			<div className="space-y-2">
				{entries.length === 0 ? (
					<div className="rounded-md border border-dashed p-4 text-muted-foreground text-sm">
						No review entries yet.
					</div>
				) : (
					entries.map((entry) => (
						<div className="rounded-md border p-3" key={entry._id}>
							<div className="mb-1 flex items-center justify-between gap-2">
								<Badge variant="outline">{entry.entryType}</Badge>
								<span className="text-muted-foreground text-xs">
									{formatTimestamp(entry.createdAt)}
								</span>
							</div>
							<p className="whitespace-pre-wrap text-sm">{entry.body}</p>
						</div>
					))
				)}
			</div>
		</section>
	);
}

function AuditHistory({ entries }: { entries: AuditHistoryEntry[] }) {
	return (
		<section className="space-y-3">
			<h2 className="font-semibold text-base">Audit History</h2>
			<div className="space-y-2">
				{entries.length === 0 ? (
					<div className="rounded-md border border-dashed p-4 text-muted-foreground text-sm">
						No audit entries yet.
					</div>
				) : (
					entries.map((entry) => (
						<div
							className="rounded-md border p-3"
							key={`${entry.eventType}-${entry.timestamp}`}
						>
							<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
								<div className="flex flex-wrap gap-1">
									<Badge variant="outline">{entry.eventType}</Badge>
									<Badge variant="secondary">{entry.outcome}</Badge>
								</div>
								<span className="text-muted-foreground text-xs">
									{formatTimestamp(entry.timestamp)}
								</span>
							</div>
							<div className="grid gap-2 text-sm sm:grid-cols-2">
								<KeyValue label="Previous state" value={entry.previousState} />
								<KeyValue label="New state" value={entry.newState} />
								<KeyValue label="Actor" value={entry.actorId} />
								<KeyValue label="Channel" value={entry.channel} />
							</div>
							{entry.reason ? (
								<p className="mt-2 whitespace-pre-wrap text-muted-foreground text-sm">
									{entry.reason}
								</p>
							) : null}
						</div>
					))
				)}
			</div>
		</section>
	);
}

function DossierSection({
	children,
	title,
}: {
	children: ReactNode;
	title: string;
}) {
	return (
		<section className="space-y-3 rounded-md border p-4">
			<h2 className="font-semibold text-base">{title}</h2>
			{children}
		</section>
	);
}

function KeyValue({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div>
			<div className="text-muted-foreground text-xs">{label}</div>
			<div className="break-words font-medium text-sm">{value}</div>
		</div>
	);
}

function ReviewActions({
	actions,
	applicationId,
	status,
}: {
	actions: ReviewActionsApi;
	applicationId: ApplicationId;
	status: ReviewQueueItem["status"];
}) {
	const canReview = REVIEWABLE_APPLICATION_STATUSES.has(status);
	const [intent, setIntent] = useState<
		"approve" | "reject" | "request_changes"
	>("approve");
	const [reviewerNote, setReviewerNote] = useState("");
	const [selectedFields, setSelectedFields] = useState<
		BrokerOnboardingReopenableFieldPath[]
	>([]);
	const [requiresIdentity, setRequiresIdentity] = useState(false);
	const [requiresRegulator, setRequiresRegulator] = useState(false);
	const isNoteValid = reviewerNote.trim().length > 0;
	const isRequestChangesValid = selectedFields.length > 0;

	if (!canReview) {
		return (
			<section className="space-y-2 rounded-md border p-4">
				<h2 className="font-semibold text-base">Review Decision</h2>
				<p className="text-muted-foreground text-sm">
					No review actions are available for {status.replaceAll("_", " ")}{" "}
					applications.
				</p>
			</section>
		);
	}

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const submitter = (event.nativeEvent as SubmitEvent).submitter;
		const submitIntent = submitter?.getAttribute("value");

		if (
			!isNoteValid ||
			(submitIntent === "request_changes" && !isRequestChangesValid)
		) {
			return;
		}

		if (submitIntent === "approve") {
			await actions.approve({ applicationId, reviewerNote });
		} else if (submitIntent === "reject") {
			await actions.reject({ applicationId, reviewerNote });
		} else if (submitIntent === "request_changes") {
			const reopenedFields = selectedFields.map((fieldPath) => ({ fieldPath }));
			await actions.requestChanges({
				applicationId,
				reopenedFields,
				reverificationFlags: {
					identityVerification: requiresIdentity,
					regulatorLookup: requiresRegulator,
				},
				reviewerNote,
			});
		}

		form.reset();
		setIntent("approve");
		setReviewerNote("");
		setSelectedFields([]);
		setRequiresIdentity(false);
		setRequiresRegulator(false);
	}

	return (
		<form className="space-y-3 rounded-md border p-4" onSubmit={submit}>
			<Textarea
				name="reviewerNote"
				onChange={(event) => setReviewerNote(event.target.value)}
				placeholder="Reviewer note"
				value={reviewerNote}
			/>
			<div className="space-y-3">
				<div className="grid gap-2 sm:grid-cols-2">
					{REOPENABLE_FIELDS.map((field) => (
						<label
							className="flex items-center gap-2 rounded-md border p-2 text-sm"
							key={field.value}
						>
							<input
								aria-label={field.label}
								className="size-4 rounded border"
								checked={selectedFields.includes(field.value)}
								name="reopenedFieldPaths"
								onChange={(event) => {
									setSelectedFields((current) =>
										event.target.checked
											? [...current, field.value]
											: current.filter((value) => value !== field.value)
									);
								}}
								type="checkbox"
								value={field.value}
							/>
							<span>{field.label}</span>
						</label>
					))}
				</div>
				<div className="grid gap-2 sm:grid-cols-2">
					<label className="flex items-center gap-2 rounded-md border p-2 text-sm">
						<input
							aria-label="Require IDV reverification"
							className="size-4 rounded border"
							checked={requiresIdentity}
							name="requiresIdentity"
							onChange={(event) => setRequiresIdentity(event.target.checked)}
							type="checkbox"
						/>
						<span>Require IDV reverification</span>
					</label>
					<label className="flex items-center gap-2 rounded-md border p-2 text-sm">
						<input
							aria-label="Require regulator reverification"
							className="size-4 rounded border"
							checked={requiresRegulator}
							name="requiresRegulator"
							onChange={(event) => setRequiresRegulator(event.target.checked)}
							type="checkbox"
						/>
						<span>Require regulator reverification</span>
					</label>
				</div>
			</div>
			{isNoteValid &&
			(intent !== "request_changes" || isRequestChangesValid) ? null : (
				<p className="text-muted-foreground text-xs">
					Reviewer note is required
					{intent === "request_changes" && selectedFields.length === 0
						? "; request changes also requires at least one reopened field"
						: ""}
					.
				</p>
			)}
			<div className="flex flex-wrap gap-2">
				<Button
					disabled={!isNoteValid}
					name="intent"
					onClick={() => setIntent("approve")}
					size="sm"
					type="submit"
					value="approve"
				>
					<CheckCircle2 /> {REVIEW_MODE_LABELS.approve}
				</Button>
				<Button
					disabled={!isNoteValid || !isRequestChangesValid}
					name="intent"
					onClick={() => setIntent("request_changes")}
					size="sm"
					type="submit"
					value="request_changes"
					variant="outline"
				>
					<MessageSquareText /> {REVIEW_MODE_LABELS.request_changes}
				</Button>
				<Button
					disabled={!isNoteValid}
					name="intent"
					onClick={() => setIntent("reject")}
					size="sm"
					type="submit"
					value="reject"
					variant="destructive"
				>
					<XCircle /> {REVIEW_MODE_LABELS.reject}
				</Button>
			</div>
		</form>
	);
}

function Dossier({
	actions,
	dossier,
}: {
	actions: ReviewActionsApi;
	dossier: ReviewDossier | null | undefined;
}) {
	if (dossier === undefined) {
		return (
			<div className="p-6 text-muted-foreground text-sm">
				Loading dossier...
			</div>
		);
	}
	if (dossier === null) {
		return (
			<div className="p-6 text-muted-foreground text-sm">
				Select an application.
			</div>
		);
	}

	const application = dossier.application;
	const snapshot = application.verificationSnapshot;
	let fraudSignal = "Not available";
	if (snapshot) {
		fraudSignal = snapshot.identityVerification.fraudSignal ? "Yes" : "No";
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 className="font-semibold text-xl">
						{formatName(application.draftData.selfReportedName)}
					</h1>
					<p className="text-muted-foreground text-sm">
						{application.draftData.brokerageName ?? "No brokerage"} /{" "}
						{application.draftData.licenseNumber ?? "No license"}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<StatusBadge status={application.status} />
					<StatusBadge status={application.downstreamHandoffStatus} />
				</div>
			</div>

			<DossierSection title="Submitted Data">
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					<KeyValue
						label="Legal name"
						value={formatName(application.draftData.selfReportedName)}
					/>
					<KeyValue
						label="Brokerage"
						value={application.draftData.brokerageName ?? "Missing"}
					/>
					<KeyValue
						label="Brokerage number"
						value={application.draftData.brokerageNumber ?? "Missing"}
					/>
					<KeyValue
						label="License"
						value={application.draftData.licenseNumber ?? "Missing"}
					/>
					<KeyValue
						label="Province"
						value={application.draftData.licenseProvince ?? "Missing"}
					/>
					<KeyValue
						label="Portal slug"
						value={application.draftData.requestedPortalSlug ?? "Missing"}
					/>
				</div>
			</DossierSection>

			<DossierSection title="Normalized Evidence">
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					<KeyValue
						label="Recommendation"
						value={snapshot?.recommendation ?? "Not available"}
					/>
					<KeyValue
						label="Regulator status"
						value={snapshot?.regulator.status ?? "Not available"}
					/>
					<KeyValue
						label="Regulator freshness"
						value={snapshot?.regulator.freshness ?? "Not available"}
					/>
					<KeyValue
						label="IDV status"
						value={snapshot?.identityVerification.status ?? "Not available"}
					/>
					<KeyValue label="Fraud signal" value={fraudSignal} />
					<KeyValue
						label="Effective score"
						value={snapshot?.similarityScores.effectiveScore ?? "Not available"}
					/>
				</div>
				<div className="flex flex-wrap gap-1">
					{(snapshot?.reasonCodes ?? []).map((reasonCode) => (
						<Badge key={reasonCode} variant="secondary">
							{reasonCode}
						</Badge>
					))}
				</div>
			</DossierSection>

			<DossierSection title="Handoff And Activation">
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					<KeyValue label="Application state" value={application.status} />
					<KeyValue
						label="Handoff state"
						value={application.downstreamHandoffStatus}
					/>
					<KeyValue
						label="Onboarding request"
						value={dossier.downstreamOnboardingRequest?._id ?? "Not linked"}
					/>
					<KeyValue
						label="Request status"
						value={dossier.downstreamOnboardingRequest?.status ?? "Not started"}
					/>
					<KeyValue
						label="Activated broker"
						value={application.activationOutcome?.brokerId ?? "Not activated"}
					/>
					<KeyValue
						label="Activated portal"
						value={application.activationOutcome?.portalId ?? "Not activated"}
					/>
				</div>
			</DossierSection>

			<ReviewActions
				actions={actions}
				applicationId={application._id}
				status={application.status}
			/>

			<AuditHistory entries={dossier.auditHistory} />
			<ReviewThread entries={dossier.reviewEntries} />
		</div>
	);
}

export function BrokerOnboardingReviewWorkspace({
	actions,
	dossier,
	onSelectedIdChange,
	onViewChange,
	queue,
	selectedId,
	view,
}: {
	actions: ReviewActionsApi;
	dossier: ReviewDossier | null | undefined;
	onSelectedIdChange: (id: ApplicationId) => void;
	onViewChange: (view: QueueView) => void;
	queue: ReviewQueueItem[] | undefined;
	selectedId: ApplicationId | null;
	view: QueueView;
}) {
	const queueItems = queue ?? [];

	return (
		<div className="flex h-full min-h-[calc(100vh-5rem)] flex-col gap-4 p-4">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="font-semibold text-2xl">Broker Onboarding</h1>
					<p className="text-muted-foreground text-sm">
						Review submitted applications and downstream activation state.
					</p>
				</div>
				<Badge variant="outline">
					<Clock3 /> {queueItems.length} records
				</Badge>
			</header>

			<div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
				<aside className="min-h-0 space-y-3 rounded-md border p-3">
					<div className="grid w-full grid-cols-2 gap-1 lg:grid-cols-1">
						{QUEUE_TABS.map((tab) => (
							<Button
								aria-pressed={view === tab.value}
								key={tab.value}
								onClick={() => onViewChange(tab.value)}
								size="sm"
								type="button"
								variant={view === tab.value ? "default" : "outline"}
							>
								{tab.label}
							</Button>
						))}
					</div>
					<Button className="w-full" disabled size="sm" variant="outline">
						<RefreshCw /> Live queue
					</Button>
					<QueueList
						items={queueItems}
						onSelect={onSelectedIdChange}
						selectedId={selectedId}
					/>
				</aside>
				<main className="min-w-0 overflow-auto rounded-md border p-4">
					<Dossier
						actions={actions}
						dossier={selectedId ? dossier : null}
					/>
				</main>
			</div>
		</div>
	);
}

export function BrokerOnboardingReviewPage() {
	const [view, setView] = useState<QueueView>("submitted");
	const [selectedId, setSelectedId] = useState<ApplicationId | null>(null);
	const queue = useQuery(
		api.onboarding.brokerApplication.queries.listReviewQueue,
		{
			view,
		}
	);
	const dossier = useQuery(
		api.onboarding.brokerApplication.queries.getReviewDossier,
		selectedId ? { applicationId: selectedId } : "skip"
	);
	const queueItems = useMemo(() => queue ?? [], [queue]);
	const actions = {
		approve: useAction(
			api.onboarding.brokerApplication.mutations.approveForReview
		),
		reject: useAction(
			api.onboarding.brokerApplication.mutations.rejectForReview
		),
		requestChanges: useAction(
			api.onboarding.brokerApplication.mutations.requestChangesForReview
		),
	} satisfies ReviewActionsApi;

	useEffect(() => {
		if (queue !== undefined) {
			setSelectedId((current) =>
				resolveBrokerOnboardingReviewSelection(current, queueItems)
			);
		}
	}, [queue, queueItems]);

	return (
		<BrokerOnboardingReviewWorkspace
			actions={actions}
			dossier={dossier}
			onSelectedIdChange={setSelectedId}
			onViewChange={setView}
			queue={queue}
			selectedId={selectedId}
			view={view}
		/>
	);
}
