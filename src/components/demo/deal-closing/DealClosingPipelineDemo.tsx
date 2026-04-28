"use client";

import {
	ArrowLeft,
	ArrowRight,
	Check,
	Circle,
	Clock3,
	FileSignature,
	FileText,
	Send,
	ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { cn } from "#/lib/utils";
import type {
	ClosingEnvelopeFixture,
	ClosingQuickActionFixture,
	ClosingStage,
	DealClosingPipelineFixture,
	EnvelopeTone,
} from "./fixtures";

interface DealClosingPipelineDemoProps {
	data: DealClosingPipelineFixture;
}

const stages: Array<{ id: ClosingStage; label: string }> = [
	{ id: "locked", label: "Locked" },
	{ id: "lawyer", label: "Lawyer" },
	{ id: "documents", label: "Documents" },
	{ id: "transfer", label: "Transfer" },
	{ id: "review", label: "Review" },
	{ id: "completed", label: "Completed" },
];

const toneClasses: Record<
	EnvelopeTone,
	{
		bar: string;
		border: string;
		icon: string;
		text: string;
	}
> = {
	blue: {
		bar: "bg-[var(--lagoon-deep)]",
		border:
			"border-[color-mix(in_oklab,var(--lagoon-deep)_22%,var(--line))] bg-[var(--surface-strong)]/76",
		icon: "text-[color-mix(in_oklab,var(--lagoon-deep)_76%,black)] dark:text-[var(--lagoon-deep)]",
		text: "text-[color-mix(in_oklab,var(--lagoon-deep)_76%,black)] dark:text-[var(--lagoon-deep)]",
	},
	green: {
		bar: "bg-[var(--palm)]",
		border:
			"border-[color-mix(in_oklab,var(--palm)_24%,var(--line))] bg-[var(--surface-strong)]/76",
		icon: "text-[var(--palm)]",
		text: "text-[var(--palm)]",
	},
	orange: {
		bar: "bg-amber-700",
		border: "border-amber-700/25 bg-[var(--surface-strong)]/76",
		icon: "text-amber-700 dark:text-amber-400",
		text: "text-amber-800 dark:text-amber-300",
	},
	purple: {
		bar: "bg-violet-700",
		border: "border-violet-700/22 bg-[var(--surface-strong)]/76",
		icon: "text-violet-700 dark:text-violet-300",
		text: "text-violet-800 dark:text-violet-300",
	},
};

const panelClassName = "island-shell rounded-xl p-6";
const panelHeadingClassName =
	"font-semibold text-[var(--sea-ink)] text-sm uppercase tracking-[0.04em]";
const mutedTextClassName = "text-[var(--sea-ink-soft)]";

export function DealClosingPipelineDemo({
	data,
}: DealClosingPipelineDemoProps) {
	const [openEnvelopeId, setOpenEnvelopeId] = useState<string | null>(null);
	const [remindedActionId, setRemindedActionId] = useState<string | null>(null);
	const selectedEnvelope = useMemo(
		() => data.envelopes.find((envelope) => envelope.id === openEnvelopeId),
		[data.envelopes, openEnvelopeId]
	);
	const activeEnvelope =
		data.envelopes.find((envelope) => envelope.id === data.activeEnvelopeId) ??
		data.envelopes[0];
	const handleQuickAction = (action: ClosingQuickActionFixture) => {
		if (action.destination.type === "embeddedSigning") {
			setOpenEnvelopeId(action.destination.envelopeId);
			return;
		}

		document
			.getElementById(action.destination.sectionId)
			?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<div className="min-h-dvh text-[var(--sea-ink)]">
			<header className="flex h-[70px] items-center justify-between border-[var(--line)] border-b bg-[var(--header-bg)] px-4 backdrop-blur-lg sm:px-8 lg:px-16">
				<a
					className="inline-flex items-center gap-3 font-semibold text-[var(--sea-ink)] text-sm no-underline hover:text-[color-mix(in_oklab,var(--lagoon-deep)_76%,black)] dark:hover:text-[var(--lagoon-deep)]"
					href="/demo"
				>
					<ArrowLeft className="size-4" />
					Back to Pipeline
				</a>
				<div className="flex items-center gap-3">
					<Button className="border-red-900/50" size="sm" variant="outline">
						Cancel Deal
					</Button>
					<Button size="sm" variant="outline">
						Archive
					</Button>
				</div>
			</header>

			<main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-16">
				<section className="flex flex-col gap-6">
					<DealHeader data={data} />
					<Lifecycle currentStage={data.deal.stage} />

					<div className="grid gap-6 xl:grid-cols-[minmax(0,948px)_340px]">
						<div className="space-y-6">
							<DocumentsActionCard
								envelope={activeEnvelope}
								onOpen={() => {
									setOpenEnvelopeId(activeEnvelope.id);
								}}
							/>
							<PropertyAndParties data={data} />
							<DocumentEnvelopes
								envelopes={data.envelopes}
								onOpenEnvelope={(envelope) => {
									setOpenEnvelopeId(envelope.id);
								}}
							/>
						</div>
						<aside className="space-y-5">
							<SummaryRail data={data} />
							<AuditRail data={data} />
							<QuickActionsPanel
								actions={data.quickActions}
								onActionSelect={handleQuickAction}
								onSendReminder={(action) => {
									setRemindedActionId(action.id);
								}}
								remindedActionId={remindedActionId}
								viewer={data.viewer}
							/>
						</aside>
					</div>
				</section>
			</main>

			<Dialog
				onOpenChange={(isOpen) => {
					if (!isOpen) {
						setOpenEnvelopeId(null);
					}
				}}
				open={Boolean(selectedEnvelope)}
			>
				<DialogContent className="!inset-3 !h-auto !max-h-none !w-auto !max-w-none !translate-x-0 !translate-y-0 sm:!inset-4 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden border-[var(--line)] bg-[var(--surface-strong)] p-0 text-[var(--sea-ink)] shadow-[0_24px_80px_rgba(10,32,34,0.22)]">
					<DialogHeader className="border-[var(--line)] border-b px-5 py-4">
						<DialogTitle>
							{selectedEnvelope?.name ?? "Embedded signing"}
						</DialogTitle>
						<DialogDescription>
							Embedded Documenso signing surface for envelope{" "}
							{selectedEnvelope?.envelopeId}.
						</DialogDescription>
					</DialogHeader>
					{selectedEnvelope?.signingHtml ? (
						<iframe
							className="h-full min-h-0 w-full rounded-b-lg"
							sandbox="allow-forms allow-scripts allow-same-origin"
							srcDoc={selectedEnvelope.signingHtml}
							title={`Embedded Documenso signing for ${selectedEnvelope.name}`}
						/>
					) : (
						<div className="grid h-full place-items-center px-6 text-center">
							<div>
								<FileText className="mx-auto size-8 text-muted-foreground" />
								<p className="mt-3 font-semibold">No active signing session</p>
								<p className="mt-1 text-muted-foreground text-sm">
									This mock envelope is visible for sequencing only.
								</p>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}

function DealHeader({ data }: { data: DealClosingPipelineFixture }) {
	return (
		<div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
			<div className="space-y-2">
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="font-semibold text-3xl tracking-normal sm:text-[32px] sm:leading-[38px]">
						{data.deal.title}
					</h1>
					<Badge
						className={cn(
							"rounded-[4px] px-3 py-1.5 font-semibold text-white uppercase",
							data.deal.statusTone === "green" && "bg-[var(--palm)]",
							data.deal.statusTone === "orange" && "bg-amber-700",
							data.deal.statusTone === "purple" && "bg-violet-700"
						)}
					>
						{data.deal.statusLabel}
					</Badge>
				</div>
				<p className={cn(mutedTextClassName, "text-sm")}>
					Deal #{data.deal.id} - {data.deal.createdLabel}
				</p>
			</div>
			<div className="text-left lg:text-right">
				<p className="font-semibold text-[11px] text-[var(--sea-ink-soft)] uppercase tracking-[0.1em]">
					Current action
				</p>
				<p className="mt-2 font-semibold text-lg">{data.deal.currentAction}</p>
			</div>
		</div>
	);
}

function Lifecycle({ currentStage }: { currentStage: ClosingStage }) {
	const currentIndex = stages.findIndex((stage) => stage.id === currentStage);

	return (
		<div className="overflow-x-auto pb-2">
			<div className="flex min-w-[860px] items-start justify-between px-8">
				{stages.map((stage, index) => {
					const isComplete = index < currentIndex;
					const isCurrent = index === currentIndex;
					return (
						<div className="contents" key={stage.id}>
							<div className="flex w-[90px] shrink-0 flex-col items-center gap-2">
								<div
									className={cn(
										"grid size-8 place-items-center rounded-full",
										isComplete && "bg-[var(--palm)] text-white",
										isCurrent &&
											"bg-[var(--palm)] text-white ring-4 ring-[color-mix(in_oklab,var(--palm)_16%,transparent)]",
										!(isComplete || isCurrent) &&
											"bg-[color-mix(in_oklab,var(--sea-ink-soft)_18%,transparent)] text-[var(--sea-ink-soft)]"
									)}
								>
									{isComplete ? (
										<Check className="size-4" />
									) : (
										<Circle
											className={cn(
												"size-3 fill-current",
												isCurrent && "size-4"
											)}
										/>
									)}
								</div>
								<p
									className={cn(
										"font-semibold text-[11px]",
										isComplete || isCurrent
											? "text-[var(--sea-ink)]"
											: "text-[var(--sea-ink-soft)] opacity-75"
									)}
								>
									{stage.label}
								</p>
							</div>
							{index < stages.length - 1 ? (
								<div
									className={cn(
										"mt-4 h-0.5 min-w-20 flex-1",
										index < currentIndex
											? "bg-[var(--palm)]"
											: "bg-[color-mix(in_oklab,var(--sea-ink-soft)_20%,transparent)]"
									)}
								/>
							) : null}
						</div>
					);
				})}
			</div>
		</div>
	);
}

function DocumentsActionCard({
	envelope,
	onOpen,
}: {
	envelope: ClosingEnvelopeFixture;
	onOpen: () => void;
}) {
	return (
		<section className="island-shell rounded-xl p-6 ring-1 ring-[color-mix(in_oklab,var(--palm)_14%,transparent)]">
			<div className="flex flex-col justify-between gap-5 md:flex-row">
				<div className="max-w-2xl space-y-4">
					<p className="font-semibold text-[var(--palm)] text-xs uppercase tracking-[0.06em]">
						Ready for signature
					</p>
					<h2 className="font-semibold text-2xl leading-tight">
						{envelope.name} needs Sarah Chen&apos;s signature
					</h2>
					<p className={cn(mutedTextClassName, "text-sm leading-6")}>
						The lawyer package is complete. Documents are now moving through
						ordered participant signing before funds transfer can open.
					</p>
				</div>
				<div className="shrink-0 md:text-right">
					<p className="font-semibold text-[11px] text-[var(--sea-ink-soft)] uppercase tracking-[0.1em]">
						Waiting
					</p>
					<p className="mt-2 font-semibold text-2xl">18h 12m</p>
					<Badge className="mt-2 rounded-md border border-[color-mix(in_oklab,var(--palm)_24%,var(--line))] bg-[var(--surface-strong)]/70 text-[var(--palm)]">
						On schedule
					</Badge>
				</div>
			</div>

			<div className="mt-7 flex flex-col gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)]/74 p-4 md:flex-row md:items-center md:justify-between">
				<div className="flex min-w-0 items-center gap-4">
					<div className="grid size-11 shrink-0 place-items-center rounded-lg border border-[color-mix(in_oklab,var(--palm)_24%,var(--line))] bg-[var(--surface-strong)] text-[var(--palm)]">
						<FileSignature className="size-5" />
					</div>
					<div className="min-w-0">
						<p className="font-semibold text-[11px] text-[var(--sea-ink-soft)] uppercase tracking-[0.08em]">
							Current required signer / action
						</p>
						<p className="mt-1 truncate font-semibold text-sm">
							Sarah Chen - investor signature on {envelope.envelopeId}
						</p>
						<p className={cn(mutedTextClassName, "mt-1 text-xs")}>
							Reminder sent 2 hours ago - automatic escalation in 30 hours
						</p>
					</div>
				</div>
				<Button
					className="bg-[var(--sea-ink)] text-white hover:bg-[color-mix(in_oklab,var(--sea-ink)_88%,white)] dark:bg-[var(--lagoon)] dark:text-slate-950 dark:hover:bg-[var(--lagoon-deep)]"
					onClick={onOpen}
				>
					Open signing
				</Button>
			</div>
		</section>
	);
}

function PropertyAndParties({ data }: { data: DealClosingPipelineFixture }) {
	return (
		<section className={panelClassName}>
			<h2 className={panelHeadingClassName}>Deal Context</h2>
			<div className="mt-6 grid gap-x-12 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
				{data.property.map((item) => (
					<div
						className={cn(
							"min-w-0",
							item.label === "Address" && "sm:col-span-2"
						)}
						key={item.label}
					>
						<p className={cn(mutedTextClassName, "text-sm")}>{item.label}</p>
						<p className="mt-1 truncate font-semibold text-base">
							{item.value}
						</p>
					</div>
				))}
			</div>
			<h3 className={cn(panelHeadingClassName, "mt-7")}>Parties</h3>
			<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{data.parties.map((party) => (
					<div
						className={cn(
							"rounded-lg border border-[var(--line)] bg-[var(--surface-strong)]/70 p-4",
							toneClasses[party.tone].border
						)}
						key={party.role}
					>
						<p
							className={cn(
								"font-semibold text-[11px] uppercase tracking-[0.08em]",
								toneClasses[party.tone].text
							)}
						>
							{party.role}
						</p>
						<p className="mt-2 font-semibold text-sm">{party.name}</p>
						<p className={cn(mutedTextClassName, "mt-1 text-xs")}>
							{party.detail}
						</p>
					</div>
				))}
			</div>
		</section>
	);
}

function DocumentEnvelopes({
	envelopes,
	onOpenEnvelope,
}: {
	envelopes: ClosingEnvelopeFixture[];
	onOpenEnvelope: (envelope: ClosingEnvelopeFixture) => void;
}) {
	return (
		<section
			className={cn(panelClassName, "scroll-mt-24")}
			id="document-envelopes"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className={panelHeadingClassName}>Document Envelopes</h2>
					<p className={cn(mutedTextClassName, "mt-2 text-sm")}>
						Documenso signing packages tracked by ordered participant actions.
					</p>
				</div>
				<div className="flex gap-2">
					<Badge className="rounded-md border border-[color-mix(in_oklab,var(--palm)_24%,var(--line))] bg-[var(--surface-strong)]/70 text-[var(--palm)]">
						3 active
					</Badge>
					<Badge className="rounded-md border border-amber-700/24 bg-[var(--surface-strong)]/70 text-amber-800 dark:text-amber-300">
						1 aging
					</Badge>
				</div>
			</div>
			<div className="mt-5 space-y-3">
				{envelopes.map((envelope) => (
					<EnvelopeRow
						envelope={envelope}
						key={envelope.id}
						onOpen={() => {
							onOpenEnvelope(envelope);
						}}
					/>
				))}
			</div>
		</section>
	);
}

function EnvelopeRow({
	envelope,
	onOpen,
}: {
	envelope: ClosingEnvelopeFixture;
	onOpen: () => void;
}) {
	return (
		<button
			className={cn(
				"grid w-full grid-cols-[minmax(0,1fr)] items-center gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)]/72 p-3 text-left transition hover:border-[color-mix(in_oklab,var(--lagoon-deep)_42%,var(--line))] hover:bg-[var(--surface-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon)]/40 lg:grid-cols-[318px_210px_100px_126px]",
				envelope.status === "aging" &&
					"border-amber-700/30 bg-[var(--surface-strong)]/76"
			)}
			onClick={onOpen}
			type="button"
		>
			<div className="flex min-w-0 items-center gap-3">
				<div
					className={cn(
						"grid size-10 shrink-0 place-items-center rounded-lg border",
						toneClasses[envelope.tone].border
					)}
				>
					<FileText className={cn("size-5", toneClasses[envelope.tone].icon)} />
				</div>
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<p className="truncate font-semibold text-sm">{envelope.name}</p>
						{envelope.isSignableTemplateSource ? (
							<Badge className="hidden rounded-md border border-[color-mix(in_oklab,var(--palm)_24%,var(--line))] bg-[var(--surface-strong)]/72 text-[var(--palm)] sm:inline-flex">
								published template
							</Badge>
						) : null}
					</div>
					<p className={cn(mutedTextClassName, "truncate text-xs")}>
						Envelope {envelope.envelopeId}
					</p>
				</div>
			</div>
			<Lane label="Next required" value={envelope.nextRequired} />
			<Lane label="Waiting" value={envelope.waitingFor} />
			<div className="flex items-center gap-3">
				<div className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--sea-ink-soft)_18%,transparent)]">
					<div
						className={cn(
							"h-full rounded-full",
							toneClasses[envelope.tone].bar
						)}
						style={{ width: `${envelope.progress}%` }}
					/>
				</div>
				<p
					className={cn(
						"w-10 shrink-0 text-right font-semibold text-xs",
						toneClasses[envelope.tone].text
					)}
				>
					{envelope.progress}%
				</p>
			</div>
		</button>
	);
}

function Lane({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0">
			<p className="font-semibold text-[11px] text-[var(--sea-ink-soft)] uppercase tracking-[0.08em]">
				{label}
			</p>
			<p className="mt-1 truncate font-semibold text-sm">{value}</p>
		</div>
	);
}

function SummaryRail({ data }: { data: DealClosingPipelineFixture }) {
	return (
		<section className={panelClassName}>
			<h2 className={panelHeadingClassName}>Deal Summary</h2>
			<div className="mt-4 divide-y divide-[var(--line)]">
				{data.summary.map((item) => (
					<div className="flex justify-between gap-4 py-3" key={item.label}>
						<p className={cn(mutedTextClassName, "text-sm")}>{item.label}</p>
						<p className="font-semibold text-sm">{item.value}</p>
					</div>
				))}
			</div>
		</section>
	);
}

function AuditRail({ data }: { data: DealClosingPipelineFixture }) {
	return (
		<section className={panelClassName}>
			<h2 className={panelHeadingClassName}>Audit Trail</h2>
			<div className="mt-5">
				{data.auditTrail.map((entry, index) => (
					<div className="flex gap-3" key={`${entry.label}-${entry.when}`}>
						<div className="flex w-3 shrink-0 flex-col items-center">
							<div
								className={cn(
									"size-2 rounded-full",
									entry.state === "future"
										? "bg-[color-mix(in_oklab,var(--sea-ink-soft)_24%,transparent)]"
										: "bg-[var(--palm)]"
								)}
							/>
							{index < data.auditTrail.length - 1 ? (
								<div className="h-12 w-px bg-[var(--line)]" />
							) : null}
						</div>
						<div className={cn(entry.state === "future" && "opacity-55")}>
							<p className="font-semibold text-sm">{entry.label}</p>
							<p className={cn(mutedTextClassName, "mt-1 text-xs")}>
								{entry.when ? `${entry.when} - ${entry.actor}` : entry.actor}
							</p>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

function QuickActionsPanel({
	actions,
	onActionSelect,
	onSendReminder,
	remindedActionId,
	viewer,
}: {
	actions: ClosingQuickActionFixture[];
	onActionSelect: (action: ClosingQuickActionFixture) => void;
	onSendReminder: (action: ClosingQuickActionFixture) => void;
	remindedActionId: string | null;
	viewer: DealClosingPipelineFixture["viewer"];
}) {
	const currentUserActions = actions.filter(
		(action) => action.assigneeUserId === viewer.userId
	);
	const otherUserActions = actions.filter(
		(action) => action.assigneeUserId !== viewer.userId
	);

	return (
		<section className="island-shell rounded-xl p-5">
			<div>
				<h2 className={panelHeadingClassName}>Quick Actions</h2>
				<p className={cn(mutedTextClassName, "mt-1 text-xs")}>
					Acting as {viewer.name} - {viewer.role}
				</p>
			</div>

			<div className="mt-5 space-y-5">
				<div>
					<div className="flex items-center justify-between gap-3">
						<h3 className="font-semibold text-[11px] text-[var(--sea-ink-soft)] uppercase tracking-[0.08em]">
							Assigned to you
						</h3>
						<Badge className="rounded-md border border-[color-mix(in_oklab,var(--palm)_24%,var(--line))] bg-[var(--surface-strong)]/70 text-[var(--palm)]">
							{currentUserActions.length}
						</Badge>
					</div>
					<div className="mt-3 grid gap-3">
						{currentUserActions.length > 0 ? (
							currentUserActions.map((action) => (
								<button
									className="group w-full rounded-lg border border-[color-mix(in_oklab,var(--palm)_24%,var(--line))] bg-[var(--surface-strong)]/74 p-3 text-left text-[var(--sea-ink)] shadow-[0_8px_20px_rgba(23,58,64,0.08)] transition hover:border-[var(--palm)] hover:bg-[var(--surface-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon)]/45"
									key={action.id}
									onClick={() => {
										onActionSelect(action);
									}}
									type="button"
								>
									<div className="flex items-start gap-3">
										<div className="grid size-9 shrink-0 place-items-center rounded-lg border border-[color-mix(in_oklab,var(--palm)_22%,var(--line))] bg-[var(--surface-strong)] text-[var(--palm)]">
											<QuickActionIcon action={action} />
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex items-start justify-between gap-3">
												<p className="font-semibold text-sm leading-5">
													{action.label}
												</p>
												<span className="shrink-0 rounded-md border border-[color-mix(in_oklab,var(--palm)_22%,var(--line))] bg-[var(--surface-strong)]/70 px-2 py-0.5 font-semibold text-[11px] text-[var(--palm)]">
													{action.dueLabel}
												</span>
											</div>
											<p
												className={cn(
													mutedTextClassName,
													"mt-1 text-xs leading-5"
												)}
											>
												{action.description}
											</p>
											<p className="mt-2 inline-flex items-center gap-1 font-semibold text-[var(--palm)] text-xs">
												Open action
												<ArrowRight className="size-3 transition group-hover:translate-x-0.5" />
											</p>
										</div>
									</div>
								</button>
							))
						) : (
							<p className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)]/60 p-3 text-[var(--sea-ink-soft)] text-sm">
								No actions are assigned to you.
							</p>
						)}
					</div>
				</div>

				<div className="border-[var(--line)] border-t pt-5">
					<div className="flex items-center justify-between gap-3">
						<h3 className="font-semibold text-[11px] text-[var(--sea-ink-soft)] uppercase tracking-[0.08em]">
							Assigned to others
						</h3>
						<Badge className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)]/70 text-[var(--sea-ink)]">
							{otherUserActions.length}
						</Badge>
					</div>
					<div className="mt-3 grid gap-3">
						{otherUserActions.map((action) => {
							const reminderSent = remindedActionId === action.id;

							return (
								<div
									className={cn(
										"rounded-lg border border-[var(--line)] bg-[var(--surface-strong)]/58 p-3",
										action.priority === "aging" &&
											"border-amber-700/30 bg-[var(--surface-strong)]/76"
									)}
									key={action.id}
								>
									<div className="flex items-start gap-3">
										<div className="grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--sea-ink-soft)]">
											<QuickActionIcon action={action} />
										</div>
										<div className="min-w-0 flex-1">
											<p className="font-semibold text-sm leading-5">
												{action.label}
											</p>
											<p className={cn(mutedTextClassName, "mt-1 text-xs")}>
												{action.assigneeName} - {action.assigneeRole}
											</p>
											<div className="mt-2 flex flex-wrap items-center gap-2">
												<span className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)]/70 px-2 py-0.5 font-semibold text-[11px] text-[var(--sea-ink-soft)]">
													{action.dueLabel}
												</span>
												{action.envelopeId ? (
													<span className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)]/70 px-2 py-0.5 font-semibold text-[11px] text-[var(--sea-ink-soft)]">
														{action.envelopeId}
													</span>
												) : null}
											</div>
										</div>
									</div>
									<Button
										className={cn(
											"mt-3 w-full border-[var(--line)] text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)]",
											reminderSent &&
												"bg-[color-mix(in_oklab,var(--palm)_10%,var(--surface-strong))] text-[var(--palm)]"
										)}
										onClick={() => {
											onSendReminder(action);
										}}
										variant="outline"
									>
										<Send className="mr-2 size-4" />
										{reminderSent ? "Reminder sent" : "Send reminder"}
									</Button>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</section>
	);
}

function QuickActionIcon({ action }: { action: ClosingQuickActionFixture }) {
	if (action.destination.type === "embeddedSigning") {
		return <FileSignature className="size-4" />;
	}

	return <ShieldCheck className="size-4" />;
}

export function DealClosingTemplateEvidence({
	data,
}: {
	data: DealClosingPipelineFixture;
}) {
	return (
		<div className="island-shell rounded-xl p-4 text-sm">
			<div className="flex items-center gap-2 font-semibold text-[var(--sea-ink)]">
				<Clock3 className="size-4" />
				Published signable template in use
			</div>
			<p className={cn(mutedTextClassName, "mt-2")}>
				Version {data.template.version} ({data.template.templateId}) provides{" "}
				{data.template.signatureFieldCount} signature fields for{" "}
				{data.template.signableRoles.join(" and ")}.
			</p>
		</div>
	);
}
