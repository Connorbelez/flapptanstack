import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
	AlertTriangle,
	ArrowLeft,
	CalendarDays,
	CheckCircle2,
	FileSignature,
	Home,
	RefreshCcw,
	Scale,
	ShieldCheck,
	UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { api } from "../../../../convex/_generated/api";
import {
	buildLawyerActionStates,
	buildLawyerTimeline,
	isLawyerWorkspaceReadOnly,
	summarizeLawyerSigners,
} from "./lawyerDealViewModel";

type Workspace = NonNullable<
	FunctionReturnType<typeof api.deals.lawyerQueries.getLawyerDealWorkspace>
>;

function formatCurrency(value: number) {
	return new Intl.NumberFormat("en-CA", {
		currency: "CAD",
		maximumFractionDigits: 0,
		style: "currency",
	}).format(value);
}

function formatDate(value: number | null | undefined) {
	if (typeof value !== "number") {
		return "Unavailable";
	}
	return new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(new Date(value));
}

function labelFromToken(value: string) {
	return value
		.split(".")
		.flatMap((segment) => segment.split("_"))
		.map((segment) =>
			segment.length > 0
				? `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`
				: segment
		)
		.join(" ");
}

function formatFractionalShare(
	participants: Workspace["matterOverview"]["participants"]
) {
	if (typeof participants.fractionalShareDisplayPercent === "number") {
		return `${participants.fractionalShareDisplayPercent}%`;
	}
	return participants.fractionalShareStatus.validationError ?? "Unavailable";
}

interface LawyerDealWorkspacePageProps {
	workspace: Workspace;
}

export function LawyerDealWorkspacePage({
	workspace,
}: LawyerDealWorkspacePageProps) {
	const queryClient = useQueryClient();
	const confirmRepresentation = useMutation(
		api.deals.lawyerMutations.confirmRepresentation
	);
	const approveDocuments = useMutation(
		api.deals.lawyerMutations.approveDocuments
	);
	const signerSummary = summarizeLawyerSigners({
		attempts: workspace.envelope.attempts,
		exceptions: workspace.envelope.exceptions,
	});
	const timeline = buildLawyerTimeline({
		attempts: workspace.envelope.attempts,
		closeMilestones: workspace.timeline.closeMilestones.map((entry) => ({
			...entry,
			type: "close" as const,
		})),
		exceptions: workspace.envelope.exceptions,
		legalActions: workspace.timeline.legalActions.map((entry) => ({
			...entry,
			type: "legal_action" as const,
		})),
	});
	const actions = buildLawyerActionStates({
		accessState: workspace.access.accessState,
		packageReview: {
			instances: workspace.packageReview.instances.map((instance) => ({
				class: instance.class,
				displayName: instance.displayName,
				signingState: instance.signingState?.status ?? undefined,
				status: instance.status,
			})),
			openExceptions: workspace.envelope.exceptions.filter(
				(exception) => exception.status === "open"
			),
			packageStatus: workspace.packageReview.package?.status ?? null,
		},
		status: workspace.deal.status,
	});
	const readOnly = isLawyerWorkspaceReadOnly(workspace.access.accessState);

	async function runAction(
		action: "confirmRepresentation" | "approvePackageForSigning"
	) {
		try {
			if (action === "confirmRepresentation") {
				await confirmRepresentation({ dealId: workspace.deal.dealId });
				toast.success("Representation confirmed.");
			} else {
				await approveDocuments({ dealId: workspace.deal.dealId });
				toast.success("Package approved for signing.");
			}
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "The lawyer action could not be completed."
			);
		} finally {
			await queryClient.invalidateQueries();
		}
	}

	return (
		<main className="min-h-dvh bg-slate-50">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
				<header className="grid gap-5 border-slate-200 border-b pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
					<div className="space-y-4">
						<Button asChild size="sm" variant="ghost">
							<Link to="/lawyer">
								<ArrowLeft className="size-4" />
								Assigned closings
							</Link>
						</Button>
						<div className="space-y-2">
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="outline">
									{labelFromToken(workspace.deal.status)}
								</Badge>
								<Badge variant={readOnly ? "secondary" : "default"}>
									{readOnly ? "Read-only" : "Active matter"}
								</Badge>
								<Badge variant="secondary">
									{workspace.access.accessRole === "guest_lawyer"
										? "Guest lawyer"
										: "Platform lawyer"}
								</Badge>
							</div>
							<h1 className="font-semibold text-3xl text-slate-950">
								{workspace.matterOverview.participants.buyer.displayName} /{" "}
								{workspace.matterOverview.participants.seller.displayName}
							</h1>
							<p className="max-w-3xl text-slate-600 text-sm leading-6">
								Review the closing package, signer order, exceptions, and legal
								action history for this assigned deal.
							</p>
						</div>
					</div>
					<div className="grid gap-2 sm:grid-cols-2">
						<ActionButton
							action={actions.confirmRepresentation}
							onClick={() => void runAction("confirmRepresentation")}
						/>
						<ActionButton
							action={actions.approvePackageForSigning}
							onClick={() => void runAction("approvePackageForSigning")}
						/>
					</div>
				</header>

				<div className="grid gap-4 lg:grid-cols-4">
					<SummaryTile
						icon={CalendarDays}
						label="Closing date"
						value={formatDate(workspace.deal.closingDate)}
					/>
					<SummaryTile
						icon={ShieldCheck}
						label="Package"
						value={workspace.packageReview.package?.status ?? "not ready"}
					/>
					<SummaryTile
						icon={UsersRound}
						label="Signer progress"
						value={`${signerSummary.completedRequiredCount}/${signerSummary.requiredCount}`}
					/>
					<SummaryTile
						icon={Scale}
						label="Fractional share"
						value={
							typeof workspace.deal.fractionalShareDisplayPercent === "number"
								? `${workspace.deal.fractionalShareDisplayPercent}%`
								: "Unavailable"
						}
					/>
				</div>

				<Tabs defaultValue="overview">
					<TabsList
						className="w-full justify-start overflow-x-auto"
						variant="line"
					>
						<TabsTrigger value="overview">Overview</TabsTrigger>
						<TabsTrigger value="package">Package Review</TabsTrigger>
						<TabsTrigger value="signers">Signers</TabsTrigger>
						<TabsTrigger value="timeline">Timeline</TabsTrigger>
					</TabsList>
					<TabsContent forceMount value="overview">
						<OverviewTab workspace={workspace} />
					</TabsContent>
					<TabsContent forceMount value="package">
						<PackageTab workspace={workspace} />
					</TabsContent>
					<TabsContent forceMount value="signers">
						<SignersTab signerSummary={signerSummary} workspace={workspace} />
					</TabsContent>
					<TabsContent forceMount value="timeline">
						<TimelineTab timeline={timeline} />
					</TabsContent>
				</Tabs>
			</div>
		</main>
	);
}

function ActionButton({
	action,
	onClick,
}: {
	action: ReturnType<typeof buildLawyerActionStates>[keyof ReturnType<
		typeof buildLawyerActionStates
	>];
	onClick: () => void;
}) {
	return (
		<Button
			disabled={!action.enabled}
			onClick={onClick}
			title={action.disabledReason ?? action.label}
			variant={action.enabled ? "default" : "outline"}
		>
			{action.label}
		</Button>
	);
}

function SummaryTile({
	icon: Icon,
	label,
	value,
}: {
	icon: typeof CalendarDays;
	label: string;
	value: string;
}) {
	return (
		<div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
			<div className="flex items-center gap-2 text-slate-500 text-xs">
				<Icon className="size-4" />
				<span>{label}</span>
			</div>
			<p className="mt-2 font-semibold text-slate-950 text-xl">{value}</p>
		</div>
	);
}

function OverviewTab({ workspace }: { workspace: Workspace }) {
	const { mortgage, participants, property } = workspace.matterOverview;
	return (
		<div className="grid gap-4 lg:grid-cols-3">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<Home className="size-4" />
						Property
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<Fact
						label="Address"
						value={property?.streetAddress ?? "Unavailable"}
					/>
					<Fact
						label="City"
						value={
							property
								? `${property.city}, ${property.province}`
								: "Unavailable"
						}
					/>
					<Fact label="Type" value={property?.propertyType ?? "Unavailable"} />
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Mortgage</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<Fact label="Principal" value={formatCurrency(mortgage.principal)} />
					<Fact label="Rate" value={`${mortgage.interestRate}%`} />
					<Fact
						label="Payment"
						value={formatCurrency(mortgage.paymentAmount)}
					/>
					<Fact label="Maturity" value={mortgage.maturityDate} />
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Participants</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<Fact label="Buyer" value={participants.buyer.displayName} />
					<Fact label="Seller" value={participants.seller.displayName} />
					<Fact
						label="Lawyer"
						value={participants.lawyer?.displayName ?? "Unassigned"}
					/>
					<Fact
						label="Fractional share"
						value={formatFractionalShare(participants)}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

function PackageTab({ workspace }: { workspace: Workspace }) {
	return (
		<div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<FileSignature className="size-4" />
						Document Instances
					</CardTitle>
					<CardDescription>
						Generated and signable documents visible to the lawyer workspace.
					</CardDescription>
				</CardHeader>
				<CardContent className="divide-y divide-slate-100">
					{workspace.packageReview.instances.length === 0 ? (
						<p className="py-6 text-slate-500 text-sm">No package documents.</p>
					) : (
						workspace.packageReview.instances.map((instance) => (
							<div
								className="grid gap-3 py-3 md:grid-cols-[1fr_auto] md:items-center"
								key={instance.instanceId}
							>
								<div>
									<p className="font-medium text-slate-950 text-sm">
										{instance.displayName}
									</p>
									<p className="text-slate-500 text-xs">
										{labelFromToken(instance.class)} /{" "}
										{labelFromToken(instance.kind)}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Badge variant="outline">
										{labelFromToken(instance.status)}
									</Badge>
									{instance.url ? (
										<Button asChild size="sm" variant="outline">
											<a href={instance.url}>Open</a>
										</Button>
									) : null}
								</div>
							</div>
						))
					)}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Approval Gate</CardTitle>
					<CardDescription>
						All blockers must clear before the package can move to signing.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{workspace.packageReview.approval.eligible ? (
						<div className="flex gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-950 text-sm">
							<CheckCircle2 className="mt-0.5 size-4" />
							<span>Package is ready for lawyer approval.</span>
						</div>
					) : (
						workspace.packageReview.approval.blockers.map((blocker) => (
							<div
								className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950 text-sm"
								key={blocker}
							>
								<AlertTriangle className="mt-0.5 size-4" />
								<span>{blocker}</span>
							</div>
						))
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function SignersTab({
	signerSummary,
	workspace,
}: {
	signerSummary: ReturnType<typeof summarizeLawyerSigners>;
	workspace: Workspace;
}) {
	const latestAttempt = [...workspace.envelope.attempts].sort(
		(left, right) => right.attemptNumber - left.attemptNumber
	)[0];
	return (
		<div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						{signerSummary.statusLabel}
					</CardTitle>
					<CardDescription>
						{signerSummary.hasReissueHistory
							? "This envelope has reissue history."
							: "Current signing attempt summary."}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<Fact
						label="Required complete"
						value={`${signerSummary.completedRequiredCount}/${signerSummary.requiredCount}`}
					/>
					<Fact
						label="Next signer"
						value={
							signerSummary.nextSignerNames.length > 0
								? signerSummary.nextSignerNames.join(", ")
								: "None"
						}
					/>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Signer Order</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{latestAttempt ? (
						latestAttempt.recipients.map((recipient) => (
							<div
								className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[3rem_1fr_auto] md:items-center"
								key={`${recipient.email}-${recipient.signingOrder}`}
							>
								<div className="flex size-9 items-center justify-center rounded-md bg-slate-100 font-semibold text-slate-700 text-sm">
									{recipient.signingOrder}
								</div>
								<div>
									<p className="font-medium text-slate-950 text-sm">
										{recipient.name}
									</p>
									<p className="text-slate-500 text-xs">
										{recipient.email} / {recipient.platformRole}
									</p>
								</div>
								<Badge
									variant={
										recipient.signingStatus === "completed"
											? "default"
											: "outline"
									}
								>
									{labelFromToken(recipient.signingStatus)}
								</Badge>
							</div>
						))
					) : (
						<p className="text-slate-500 text-sm">No envelope attempt yet.</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function TimelineTab({
	timeline,
}: {
	timeline: ReturnType<typeof buildLawyerTimeline>;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<RefreshCcw className="size-4" />
					Closing Timeline
				</CardTitle>
			</CardHeader>
			<CardContent>
				{timeline.length === 0 ? (
					<p className="text-slate-500 text-sm">
						No legal timeline entries yet.
					</p>
				) : (
					<ol className="space-y-3">
						{timeline.map((entry) => (
							<li
								className="grid gap-3 sm:grid-cols-[8rem_1fr]"
								key={`${entry.type}-${entry.at}-${entry.title}-${entry.description}`}
							>
								<time className="text-slate-500 text-xs">
									{formatDate(entry.at)}
								</time>
								<div className="rounded-md border border-slate-200 bg-white p-3">
									<p className="font-medium text-slate-950 text-sm">
										{entry.title}
									</p>
									<p className="mt-1 text-slate-600 text-sm">
										{entry.description}
									</p>
								</div>
							</li>
						))}
					</ol>
				)}
			</CardContent>
		</Card>
	);
}

function Fact({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-start justify-between gap-4 border-slate-100 border-b py-2 last:border-b-0">
			<span className="text-slate-500">{label}</span>
			<span className="text-right font-medium text-slate-950">{value}</span>
		</div>
	);
}
