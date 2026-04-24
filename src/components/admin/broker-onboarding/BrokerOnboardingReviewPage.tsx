"use client";

import { useAction, useQuery } from "convex/react";
import {
	BadgeCheck,
	CheckCircle2,
	Clock3,
	MessageSquareText,
	RefreshCw,
	XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { Textarea } from "#/components/ui/textarea";
import { cn } from "#/lib/utils";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type QueueView =
	| "submitted"
	| "changes_requested"
	| "recently_updated"
	| "rejected";
type ApplicationId = Id<"brokerOnboardingApplications">;

interface ReviewQueueItem {
	applicationId: ApplicationId;
	changesRequestedAt: number | null;
	downstreamHandoffStatus:
		| "not_started"
		| "linked"
		| "role_assigned"
		| "activated";
	draftSummary: {
		brokerageName: string | null;
		brokerageNumber: string | null;
		licenseNumber: string | null;
		licenseProvince: string | null;
		requestedPortalSlug: string | null;
		selfReportedName: {
			firstName?: string;
			fullName?: string;
			lastName?: string;
			middleName?: string;
		} | null;
	};
	freshness: string | null;
	identityVerificationStatus: string | null;
	latestReviewEntry: {
		body: string;
		createdAt: number;
		entryType: "broker_note" | "reviewer_note" | "system_event";
	} | null;
	reasonCodes: string[];
	regulatorStatus: string | null;
	requiresReverification: boolean;
	status:
		| "draft"
		| "submitted"
		| "changes_requested"
		| "approved"
		| "rejected"
		| "activated";
	submittedAt: number | null;
	updatedAt: number;
	verificationRecommendation: string | null;
	verifiedEmail: string | null;
}

interface ReviewEntry {
	_id: string;
	authorAuthId?: string;
	authorType?: string;
	body: string;
	createdAt: number;
	entryType: "broker_note" | "reviewer_note" | "system_event";
	systemEventType?: string;
}

interface ReviewDossier {
	application: {
		_id: ApplicationId;
		activationOutcome?: {
			brokerId: string;
			homePortalId: string;
			onboardingRequestId: string;
			portalId: string;
			targetOrganizationId: string;
		};
		downstreamHandoffStatus: ReviewQueueItem["downstreamHandoffStatus"];
		downstreamOnboardingRequestId?: string;
		draftData: ReviewQueueItem["draftSummary"];
		reopenedFields: Array<{
			fieldPath: string;
			reason?: string;
			status: "open" | "resolved";
		}>;
		status: ReviewQueueItem["status"];
		verificationSnapshot?: {
			emailVerification: {
				email: string | null;
				status: string;
				verifiedAt: number | null;
			};
			evidenceReferences: Array<{
				label?: string;
				provider: string;
				referenceId: string;
				referenceType: string;
				uri?: string;
			}>;
			identityVerification: {
				fraudSignal: boolean;
				status: string;
			};
			reasonCodes: string[];
			recommendation: string;
			regulator: {
				brokerageName: string | null;
				brokerageNumber: string | null;
				freshness: string;
				licenseNumber: string | null;
				provider: string;
				status: string;
			};
			similarityScores: {
				effectiveScore: number | null;
				regulatorVsIdentity: number | null;
				selfReportedVsIdentity: number | null;
				selfReportedVsRegulator: number | null;
			};
		};
		verificationState?: {
			requiresReverification: boolean;
			reverificationFieldPaths: string[];
		};
	};
	auditHistory: Array<{
		actorId: string;
		eventType: string;
		newState: string;
		outcome: "transitioned" | "rejected";
		previousState: string;
		timestamp: number;
	}>;
	downstreamOnboardingRequest: {
		_id: string;
		status: string;
	} | null;
	queueItem: ReviewQueueItem;
	reviewEntries: ReviewEntry[];
}

const QUEUE_TABS: Array<{ label: string; value: QueueView }> = [
	{ label: "Submitted", value: "submitted" },
	{ label: "Changes Requested", value: "changes_requested" },
	{ label: "Recently Updated", value: "recently_updated" },
	{ label: "Rejected", value: "rejected" },
];

const REOPENABLE_FIELDS = [
	{ label: "Legal name", value: "draftData.selfReportedName" },
	{ label: "License number", value: "draftData.licenseNumber" },
	{ label: "License province", value: "draftData.licenseProvince" },
	{ label: "Brokerage name", value: "draftData.brokerageName" },
	{ label: "Brokerage number", value: "draftData.brokerageNumber" },
	{ label: "Portal slug", value: "draftData.requestedPortalSlug" },
] as const;

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
	return (
		name.fullName ??
		[name.firstName, name.middleName, name.lastName]
			.filter(Boolean)
			.join(" ") ??
		"No name"
	);
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

function DossierSection({
	children,
	title,
}: {
	children: React.ReactNode;
	title: string;
}) {
	return (
		<section className="space-y-3 rounded-md border p-4">
			<h2 className="font-semibold text-base">{title}</h2>
			{children}
		</section>
	);
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div>
			<div className="text-muted-foreground text-xs">{label}</div>
			<div className="break-words font-medium text-sm">{value}</div>
		</div>
	);
}

function ReviewActions({
	applicationId,
	onCompleted,
}: {
	applicationId: ApplicationId;
	onCompleted: () => void;
}) {
	const approve = useAction(
		api.onboarding.brokerApplication.mutations.approveForReview
	);
	const requestChanges = useAction(
		api.onboarding.brokerApplication.mutations.requestChangesForReview
	);
	const reject = useAction(
		api.onboarding.brokerApplication.mutations.rejectForReview
	);
	const [mode, setMode] = useState<"approve" | "request_changes" | "reject">(
		"approve"
	);
	const [note, setNote] = useState("");
	const [selectedFields, setSelectedFields] = useState<string[]>([]);
	const [requiresIdentity, setRequiresIdentity] = useState(false);
	const [requiresRegulator, setRequiresRegulator] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	async function submit() {
		setMessage(null);
		setIsSubmitting(true);
		try {
			if (mode === "approve") {
				await approve({ applicationId, reviewerNote: note });
			} else if (mode === "reject") {
				await reject({ applicationId, reviewerNote: note });
			} else {
				await requestChanges({
					applicationId,
					reopenedFields: selectedFields.map((fieldPath) => ({ fieldPath })),
					reverificationFlags: {
						identityVerification: requiresIdentity,
						regulatorLookup: requiresRegulator,
					},
					reviewerNote: note,
				});
			}
			setNote("");
			setSelectedFields([]);
			setRequiresIdentity(false);
			setRequiresRegulator(false);
			setMessage("Review action saved.");
			onCompleted();
		} catch (error) {
			setMessage(
				error instanceof Error ? error.message : "Review action failed."
			);
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<section className="space-y-3 rounded-md border p-4">
			<div className="flex flex-wrap gap-2">
				<Button
					onClick={() => setMode("approve")}
					size="sm"
					variant={mode === "approve" ? "default" : "outline"}
				>
					<CheckCircle2 /> Approve
				</Button>
				<Button
					onClick={() => setMode("request_changes")}
					size="sm"
					variant={mode === "request_changes" ? "default" : "outline"}
				>
					<MessageSquareText /> Request changes
				</Button>
				<Button
					onClick={() => setMode("reject")}
					size="sm"
					variant={mode === "reject" ? "destructive" : "outline"}
				>
					<XCircle /> Reject
				</Button>
			</div>
			<Textarea
				onChange={(event) => setNote(event.target.value)}
				placeholder="Reviewer note"
				value={note}
			/>
			{mode === "request_changes" ? (
				<div className="space-y-3">
					<div className="grid gap-2 sm:grid-cols-2">
						{REOPENABLE_FIELDS.map((field) => (
							<div
								className="flex items-center gap-2 rounded-md border p-2 text-sm"
								key={field.value}
							>
								<Checkbox
									aria-label={field.label}
									checked={selectedFields.includes(field.value)}
									onCheckedChange={(checked) =>
										setSelectedFields((current) =>
											checked === true
												? [...new Set([...current, field.value])]
												: current.filter((value) => value !== field.value)
										)
									}
								/>
								<span>{field.label}</span>
							</div>
						))}
					</div>
					<div className="grid gap-2 sm:grid-cols-2">
						<div className="flex items-center gap-2 rounded-md border p-2 text-sm">
							<Checkbox
								aria-label="Require IDV reverification"
								checked={requiresIdentity}
								onCheckedChange={(checked) =>
									setRequiresIdentity(checked === true)
								}
							/>
							<span>Require IDV reverification</span>
						</div>
						<div className="flex items-center gap-2 rounded-md border p-2 text-sm">
							<Checkbox
								aria-label="Require regulator reverification"
								checked={requiresRegulator}
								onCheckedChange={(checked) =>
									setRequiresRegulator(checked === true)
								}
							/>
							<span>Require regulator reverification</span>
						</div>
					</div>
				</div>
			) : null}
			<div className="flex items-center gap-3">
				<Button disabled={isSubmitting} onClick={submit}>
					<BadgeCheck /> Save decision
				</Button>
				{message ? (
					<span className="text-muted-foreground text-sm">{message}</span>
				) : null}
			</div>
		</section>
	);
}

function Dossier({
	dossier,
	onActionCompleted,
}: {
	dossier: ReviewDossier | null | undefined;
	onActionCompleted: () => void;
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
					<KeyValue
						label="Fraud signal"
						value={snapshot?.identityVerification.fraudSignal ? "Yes" : "No"}
					/>
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
				applicationId={application._id}
				onCompleted={onActionCompleted}
			/>

			<ReviewThread entries={dossier.reviewEntries} />
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
	) as ReviewQueueItem[] | undefined;
	const dossier = useQuery(
		api.onboarding.brokerApplication.queries.getReviewDossier,
		selectedId ? { applicationId: selectedId } : "skip"
	) as ReviewDossier | null | undefined;
	const queueItems = useMemo(() => queue ?? [], [queue]);

	useEffect(() => {
		if (!selectedId && queueItems[0]) {
			setSelectedId(queueItems[0].applicationId);
		}
		if (
			selectedId &&
			queueItems.length > 0 &&
			!queueItems.some((item) => item.applicationId === selectedId)
		) {
			setSelectedId(queueItems[0].applicationId);
		}
	}, [queueItems, selectedId]);

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
					<Tabs
						onValueChange={(value) => setView(value as QueueView)}
						value={view}
					>
						<TabsList
							className="grid w-full grid-cols-2 lg:grid-cols-1"
							variant="line"
						>
							{QUEUE_TABS.map((tab) => (
								<TabsTrigger key={tab.value} value={tab.value}>
									{tab.label}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
					<Button className="w-full" disabled size="sm" variant="outline">
						<RefreshCw /> Live queue
					</Button>
					<QueueList
						items={queueItems}
						onSelect={setSelectedId}
						selectedId={selectedId}
					/>
				</aside>
				<main className="min-w-0 overflow-auto rounded-md border p-4">
					<Dossier
						dossier={dossier}
						onActionCompleted={() => {
							setSelectedId((current) => current);
						}}
					/>
				</main>
			</div>
		</div>
	);
}
