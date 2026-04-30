"use client";

import { EmbedSignDocument } from "@documenso/embed-react";
import type { FunctionReturnType } from "convex/server";
import {
	ArrowLeft,
	Check,
	Circle,
	FileSignature,
	FileText,
	RefreshCw,
	ShieldCheck,
	UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import type { api } from "../../../../convex/_generated/api";

type BackendPipelineState = FunctionReturnType<
	typeof api.demo.dealClosingPipeline.getState
>;
type PortalDocumentPackageState = FunctionReturnType<
	typeof api.documents.dealPackages.getPortalDocumentPackage
>;
type PortalPackageInstance = PortalDocumentPackageState["instances"][number];
type Recipient = NonNullable<
	PortalPackageInstance["signing"]
>["recipients"][number];

export type DealClosingPipelineState = BackendPipelineState & {
	portalDocumentPackage?: PortalDocumentPackageState | null;
};

export interface DealClosingPipelineSigningSession {
	error: string | null;
	expiresAt: number | null;
	host: string | null;
	instanceId: string;
	isPending: boolean;
	token: string | null;
	url: string | null;
}

export interface DealClosingPipelineCreateSigningSessionArgs {
	dealId: string;
	instanceId: string;
}

interface DealClosingPipelineDemoProps {
	data?: unknown;
	onCreateSigningSession?: (
		args: DealClosingPipelineCreateSigningSessionArgs
	) => Promise<void>;
	onReset?: () => Promise<void> | void;
	resetPending?: boolean;
	signingSession?: DealClosingPipelineSigningSession | null;
	state?: DealClosingPipelineState | undefined;
}

type ClosingStage =
	| "locked"
	| "lawyer"
	| "documents"
	| "transfer"
	| "review"
	| "completed";

const stages: Array<{ id: ClosingStage; label: string }> = [
	{ id: "locked", label: "Locked" },
	{ id: "lawyer", label: "Lawyer" },
	{ id: "documents", label: "Documents" },
	{ id: "transfer", label: "Transfer" },
	{ id: "review", label: "Review" },
	{ id: "completed", label: "Completed" },
];

const panelClassName = "island-shell rounded-xl p-6";
const panelHeadingClassName =
	"font-semibold text-[var(--sea-ink)] text-sm uppercase tracking-[0.04em]";
const mutedTextClassName = "text-[var(--sea-ink-soft)]";

function formatEnumLabel(value: string | null | undefined) {
	if (!value) {
		return "Unavailable";
	}

	return value
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function formatDate(value: number | null | undefined) {
	if (typeof value !== "number") {
		return "Unavailable";
	}

	return new Date(value).toLocaleDateString();
}

function formatDateTime(value: number | null | undefined) {
	if (typeof value !== "number") {
		return "Unavailable";
	}

	return new Date(value).toLocaleString();
}

function formatCurrency(value: number | null | undefined) {
	if (typeof value !== "number") {
		return "Unavailable";
	}

	return new Intl.NumberFormat("en-CA", {
		currency: "CAD",
		maximumFractionDigits: 0,
		style: "currency",
	}).format(value);
}

function getStatusTone(status: string | null | undefined) {
	switch (status) {
		case "ready":
		case "active":
		case "sent":
		case "partially_signed":
		case "completed":
		case "signed":
			return "green";
		case "provider_error":
		case "failed":
		case "generation_failed":
		case "declined":
			return "red";
		case "draft":
		case "pending":
		case "available":
			return "blue";
		default:
			return "gray";
	}
}

function getDocumensoEmbedErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "string" && error.trim().length > 0) {
		return error.trim();
	}

	return "Documenso embedded signing failed.";
}

function currentStageForState(state: DealClosingPipelineState): ClosingStage {
	const packageStatus = state.portalDocumentPackage?.package?.status;
	if (packageStatus === "archived") {
		return "completed";
	}
	if (packageStatus === "ready") {
		return "documents";
	}
	if (state.deal) {
		return "locked";
	}
	return "lawyer";
}

function isSignableInstance(instance: PortalPackageInstance) {
	return instance.class === "private_templated_signable";
}

function findCurrentRecipient(
	instance: PortalPackageInstance
): Recipient | null {
	return (
		instance.signing?.recipients.find(
			(recipient) => recipient.isCurrentViewer
		) ?? null
	);
}

export function DealClosingPipelineDemo({
	onCreateSigningSession = async () => undefined,
	onReset = () => undefined,
	resetPending = false,
	signingSession = null,
	state,
}: DealClosingPipelineDemoProps) {
	const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
		null
	);
	const [dismissedSigningInstanceId, setDismissedSigningInstanceId] = useState<
		string | null
	>(null);
	const [embedMessage, setEmbedMessage] = useState<string | null>(null);
	const [embedError, setEmbedError] = useState<string | null>(null);
	const instances = state?.portalDocumentPackage?.instances ?? [];
	const effectiveSelectedInstanceId =
		selectedInstanceId ??
		(signingSession?.instanceId !== dismissedSigningInstanceId
			? (signingSession?.instanceId ?? null)
			: null);
	const selectedInstance = useMemo(
		() =>
			instances.find(
				(instance) => instance.instanceId === effectiveSelectedInstanceId
			) ?? null,
		[effectiveSelectedInstanceId, instances]
	);
	const activeSigningSession =
		signingSession?.instanceId === effectiveSelectedInstanceId
			? signingSession
			: null;
	const activeSignableInstance =
		instances.find(
			(instance) =>
				isSignableInstance(instance) &&
				instance.signing?.canLaunchEmbeddedSigning
		) ?? null;

	const launchSigning = (instance: PortalPackageInstance) => {
		if (!state?.deal) {
			return;
		}

		setEmbedMessage(null);
		setEmbedError(null);
		setDismissedSigningInstanceId(null);
		setSelectedInstanceId(instance.instanceId);
		void onCreateSigningSession({
			dealId: state.deal.id,
			instanceId: instance.instanceId,
		});
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
				<Button
					disabled={resetPending || !state?.canReset}
					onClick={() => void onReset()}
					size="sm"
					variant="outline"
				>
					<RefreshCw
						className={cn("mr-2 size-4", resetPending && "animate-spin")}
					/>
					{resetPending ? "Regenerating..." : "Reset and regenerate"}
				</Button>
			</header>

			<main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 lg:px-16">
				{state ? (
					<section className="flex flex-col gap-6">
						<DealHeader state={state} />
						<Lifecycle currentStage={currentStageForState(state)} />
						{embedMessage ? (
							<div className="rounded-lg border border-[color-mix(in_oklab,var(--palm)_26%,var(--line))] bg-[color-mix(in_oklab,var(--palm)_8%,var(--surface-strong))] px-4 py-3 text-[var(--palm)] text-sm">
								{embedMessage}
							</div>
						) : null}
						{activeSignableInstance ? (
							<DocumentsActionCard
								instance={activeSignableInstance}
								onOpen={() => launchSigning(activeSignableInstance)}
							/>
						) : null}

						<div className="grid gap-6 xl:grid-cols-[minmax(0,948px)_340px]">
							<div className="space-y-6">
								<SetupAndPackage state={state} />
								<DealContext state={state} />
								<PackageInstances
									instances={instances}
									onLaunchSigning={launchSigning}
									state={state}
								/>
							</div>
							<aside className="space-y-5">
								<SummaryRail state={state} />
								<AuditRail state={state} />
							</aside>
						</div>
					</section>
				) : (
					<div className="grid min-h-[420px] place-items-center">
						<div className="text-center">
							<FileText className="mx-auto size-8 text-[var(--sea-ink-soft)]" />
							<p className="mt-3 font-semibold">Loading deal closing state</p>
							<p className={cn(mutedTextClassName, "mt-1 text-sm")}>
								Convex is preparing the live demo package state.
							</p>
						</div>
					</div>
				)}
			</main>

			<SigningDialog
				error={embedError}
				onCompleted={() => {
					setSelectedInstanceId(null);
					setDismissedSigningInstanceId(signingSession?.instanceId ?? null);
					setEmbedError(null);
					setEmbedMessage(
						"Signing completed. Refresh status after Task 6 webhook sync is available."
					);
				}}
				onError={(error) => {
					setEmbedError(getDocumensoEmbedErrorMessage(error));
				}}
				onOpenChange={(isOpen) => {
					if (!isOpen) {
						setSelectedInstanceId(null);
						setDismissedSigningInstanceId(signingSession?.instanceId ?? null);
						setEmbedError(null);
					}
				}}
				selectedInstance={selectedInstance}
				session={activeSigningSession}
			/>
		</div>
	);
}

function DealHeader({ state }: { state: DealClosingPipelineState }) {
	const property = state.deal?.property;
	const title = property
		? `${property.streetAddress}, ${property.city}`
		: state.packageDefinition.expectedTitle;

	return (
		<div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
			<div className="space-y-2">
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="font-semibold text-3xl tracking-normal sm:text-[32px] sm:leading-[38px]">
						{title}
					</h1>
					<StatusBadge status={state.setup.status} />
				</div>
				<p className={cn(mutedTextClassName, "text-sm")}>
					Fixed package {state.packageDefinition.expectedTitle} -{" "}
					{state.packageDefinition.id}
				</p>
			</div>
			<div className="text-left lg:text-right">
				<p className="font-semibold text-[11px] text-[var(--sea-ink-soft)] uppercase tracking-[0.1em]">
					Lender
				</p>
				<p className="mt-2 font-semibold text-lg">{state.lender.name}</p>
				<p className={cn(mutedTextClassName, "text-sm")}>
					{state.lender.email}
				</p>
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
	instance,
	onOpen,
}: {
	instance: PortalPackageInstance;
	onOpen: () => void;
}) {
	const recipient = findCurrentRecipient(instance);

	return (
		<section className="island-shell rounded-xl p-6 ring-1 ring-[color-mix(in_oklab,var(--palm)_14%,transparent)]">
			<div className="flex flex-col justify-between gap-5 md:flex-row">
				<div className="max-w-2xl space-y-4">
					<p className="font-semibold text-[var(--palm)] text-xs uppercase tracking-[0.06em]">
						Ready for signature
					</p>
					<h2 className="font-semibold text-2xl leading-tight">
						{instance.displayName} needs{" "}
						{recipient?.name ?? "the current signer"}&apos;s signature
					</h2>
					<p className={cn(mutedTextClassName, "text-sm leading-6")}>
						Convex resolved this package instance as eligible for embedded
						Documenso signing for the current viewer.
					</p>
				</div>
				<div className="shrink-0 md:text-right">
					<p className="font-semibold text-[11px] text-[var(--sea-ink-soft)] uppercase tracking-[0.1em]">
						Envelope
					</p>
					<p
						className="mt-2 font-semibold text-sm"
						data-testid="active-provider-envelope-id"
					>
						{instance.signing?.providerEnvelopeId ?? "Pending"}
					</p>
					<StatusBadge status={instance.signing?.status ?? instance.status} />
				</div>
			</div>

			<div className="mt-7 flex flex-col gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)]/74 p-4 md:flex-row md:items-center md:justify-between">
				<div className="flex min-w-0 items-center gap-4">
					<div className="grid size-11 shrink-0 place-items-center rounded-lg border border-[color-mix(in_oklab,var(--palm)_24%,var(--line))] bg-[var(--surface-strong)] text-[var(--palm)]">
						<FileSignature className="size-5" />
					</div>
					<div className="min-w-0">
						<p className="font-semibold text-[11px] text-[var(--sea-ink-soft)] uppercase tracking-[0.08em]">
							Current required signer
						</p>
						<p className="mt-1 truncate font-semibold text-sm">
							{recipient?.name ?? "Current viewer"} -{" "}
							{formatEnumLabel(recipient?.platformRole)}
						</p>
						<p className={cn(mutedTextClassName, "mt-1 text-xs")}>
							Last provider sync:{" "}
							{formatDateTime(instance.signing?.lastProviderSyncAt)}
						</p>
					</div>
				</div>
				<Button
					aria-label={`Sign ${instance.displayName}`}
					className="bg-[var(--sea-ink)] text-white hover:bg-[color-mix(in_oklab,var(--sea-ink)_88%,white)] dark:bg-[var(--lagoon)] dark:text-slate-950 dark:hover:bg-[var(--lagoon-deep)]"
					onClick={onOpen}
				>
					Sign in portal
				</Button>
			</div>
		</section>
	);
}

function SetupAndPackage({ state }: { state: DealClosingPipelineState }) {
	const packageState = state.portalDocumentPackage?.package;

	return (
		<section className={panelClassName}>
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h2 className={panelHeadingClassName}>Package Setup</h2>
					<p className={cn(mutedTextClassName, "mt-2 text-sm")}>
						Fixed package title and id are read from the demo reset backend.
					</p>
				</div>
				<StatusBadge status={state.setup.status} />
			</div>
			<div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<InfoTile
					label="Expected title"
					value={state.packageDefinition.expectedTitle}
				/>
				<InfoTile label="Fixed package id" value={state.packageDefinition.id} />
				<InfoTile
					label="Published version"
					value={
						state.packageDefinition.currentPublishedVersion?.toString() ??
						"Unavailable"
					}
				/>
				<InfoTile
					label="Generated package"
					value={
						packageState?.packageId ??
						state.package?.packageDefinitionId ??
						"None"
					}
				/>
				<InfoTile
					label="Package status"
					value={formatEnumLabel(packageState?.status)}
				/>
				<InfoTile
					label="Package updated"
					value={formatDateTime(packageState?.updatedAt)}
				/>
				<InfoTile
					label="Package version id"
					value={state.package?.packageVersionId ?? "Unavailable"}
				/>
				<InfoTile
					label="Mortgage id"
					value={state.package?.mortgageId ?? "Unavailable"}
				/>
			</div>
		</section>
	);
}

function DealContext({ state }: { state: DealClosingPipelineState }) {
	const property = state.deal?.property;

	return (
		<section className={panelClassName}>
			<h2 className={panelHeadingClassName}>Deal Context</h2>
			<div className="mt-6 grid gap-x-12 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
				<InfoTile label="Deal id" value={state.deal?.id ?? "No demo deal"} />
				<InfoTile
					label="Deal status"
					value={formatEnumLabel(state.deal?.status)}
				/>
				<InfoTile
					label="Fractional share"
					value={formatCurrency(state.deal?.fractionalShare)}
				/>
				<InfoTile
					label="Closing date"
					value={formatDate(state.deal?.closingDate)}
				/>
				<InfoTile
					label="Address"
					value={
						property
							? `${property.streetAddress}${property.unit ? ` ${property.unit}` : ""}`
							: "Unavailable"
					}
				/>
				<InfoTile label="City" value={property?.city ?? "Unavailable"} />
				<InfoTile
					label="Province"
					value={property?.province ?? "Unavailable"}
				/>
				<InfoTile
					label="Postal code"
					value={property?.postalCode ?? "Unavailable"}
				/>
			</div>
		</section>
	);
}

function PackageInstances({
	instances,
	onLaunchSigning,
	state,
}: {
	instances: PortalPackageInstance[];
	onLaunchSigning: (instance: PortalPackageInstance) => void;
	state: DealClosingPipelineState;
}) {
	return (
		<section
			className={cn(panelClassName, "scroll-mt-24")}
			id="document-envelopes"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className={panelHeadingClassName}>Package Instances</h2>
					<p className={cn(mutedTextClassName, "mt-2 text-sm")}>
						Generated package documents, signing envelopes, and recipients from
						Convex.
					</p>
				</div>
				<Badge className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)]/70 text-[var(--sea-ink)]">
					{instances.length} instances
				</Badge>
			</div>

			{instances.length > 0 ? (
				<div className="mt-5 space-y-3">
					{instances.map((instance) => (
						<InstanceRow
							canLaunch={Boolean(
								state.deal && instance.signing?.canLaunchEmbeddedSigning
							)}
							instance={instance}
							key={instance.instanceId}
							onLaunch={() => onLaunchSigning(instance)}
						/>
					))}
				</div>
			) : (
				<p className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)]/60 p-4 text-[var(--sea-ink-soft)] text-sm">
					No generated package instances are available for this demo deal yet.
				</p>
			)}
		</section>
	);
}

function InstanceRow({
	canLaunch,
	instance,
	onLaunch,
}: {
	canLaunch: boolean;
	instance: PortalPackageInstance;
	onLaunch: () => void;
}) {
	const recipientCount = instance.signing?.recipients.length ?? 0;

	return (
		<div
			className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)]/72 p-4"
			data-testid={`package-instance-${instance.instanceId}`}
		>
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<div className="grid size-10 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface-strong)]">
							{isSignableInstance(instance) ? (
								<FileSignature className="size-5 text-[var(--palm)]" />
							) : (
								<FileText className="size-5 text-[var(--lagoon-deep)]" />
							)}
						</div>
						<div className="min-w-0">
							<p className="truncate font-semibold text-sm">
								{instance.displayName}
							</p>
							<p className={cn(mutedTextClassName, "truncate text-xs")}>
								Instance {instance.instanceId}
							</p>
							{instance.signing?.providerEnvelopeId ? (
								<p className="sr-only" data-testid="provider-envelope-id">
									{instance.signing.providerEnvelopeId}
								</p>
							) : null}
						</div>
					</div>
					<div className="mt-3 flex flex-wrap gap-2">
						<StatusBadge status={instance.status} />
						<StatusBadge status={instance.signing?.status ?? null} />
						{instance.signing?.generatedDocumentSigningStatus ? (
							<StatusBadge
								status={instance.signing.generatedDocumentSigningStatus}
							/>
						) : null}
						<Badge className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)]/70 text-[var(--sea-ink)]">
							{formatEnumLabel(instance.class)}
						</Badge>
						<Badge className="rounded-md border border-[var(--line)] bg-[var(--surface-strong)]/70 text-[var(--sea-ink)]">
							{recipientCount} recipients
						</Badge>
					</div>
				</div>
				{canLaunch ? (
					<Button
						aria-label={`Sign ${instance.displayName}`}
						onClick={onLaunch}
						size="sm"
					>
						<FileSignature className="mr-2 size-4" />
						Sign in portal
					</Button>
				) : null}
			</div>

			{instance.signing?.recipients.length ? (
				<div className="mt-4 grid gap-2 md:grid-cols-2">
					{instance.signing.recipients.map((recipient) => (
						<RecipientPill
							key={`${instance.instanceId}-${recipient.platformRole}-${recipient.email}`}
							recipient={recipient}
						/>
					))}
				</div>
			) : (
				<p className={cn(mutedTextClassName, "mt-4 text-sm")}>
					No signing recipients are attached to this instance.
				</p>
			)}

			{instance.lastError || instance.signing?.lastError ? (
				<p className="mt-3 text-destructive text-sm">
					{instance.signing?.lastError ?? instance.lastError}
				</p>
			) : null}
		</div>
	);
}

function RecipientPill({ recipient }: { recipient: Recipient }) {
	return (
		<div className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-strong)]/64 px-3 py-2 text-sm">
			<div className="grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--sea-ink-soft)]">
				<UserRound className="size-4" />
			</div>
			<div className="min-w-0">
				<p className="truncate font-semibold">
					{recipient.name}
					{recipient.isCurrentViewer ? " (you)" : ""}
				</p>
				<p className={cn(mutedTextClassName, "truncate text-xs")}>
					{recipient.email} - {formatEnumLabel(recipient.status)} - order{" "}
					{recipient.signingOrder}
				</p>
			</div>
		</div>
	);
}

function SummaryRail({ state }: { state: DealClosingPipelineState }) {
	return (
		<section className={panelClassName}>
			<h2 className={panelHeadingClassName}>Deal Summary</h2>
			<div className="mt-4 divide-y divide-[var(--line)]">
				<SummaryRow label="Setup" value={formatEnumLabel(state.setup.status)} />
				<SummaryRow
					label="Can reset"
					value={state.canReset ? "Available" : "Unavailable"}
				/>
				<SummaryRow
					label="Lender user"
					value={state.lender.userId ?? "Unlinked"}
				/>
				<SummaryRow
					label="Expected lender id"
					value={state.lender.expectedUserId}
				/>
				<SummaryRow
					label="User id match"
					value={state.lender.fixedUserIdMatches ? "Yes" : "No"}
				/>
				<SummaryRow
					label="Instances"
					value={`${state.portalDocumentPackage?.instances.length ?? 0}`}
				/>
			</div>
		</section>
	);
}

function SummaryRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex justify-between gap-4 py-3">
			<p className={cn(mutedTextClassName, "text-sm")}>{label}</p>
			<p className="truncate text-right font-semibold text-sm">{value}</p>
		</div>
	);
}

function AuditRail({ state }: { state: DealClosingPipelineState }) {
	return (
		<section className={panelClassName}>
			<h2 className={panelHeadingClassName}>Audit Trail</h2>
			<div className="mt-5">
				{state.auditTrail.length > 0 ? (
					state.auditTrail.map((entry, index) => (
						<div className="flex gap-3" key={entry.id}>
							<div className="flex w-3 shrink-0 flex-col items-center">
								<div className="size-2 rounded-full bg-[var(--palm)]" />
								{index < state.auditTrail.length - 1 ? (
									<div className="h-12 w-px bg-[var(--line)]" />
								) : null}
							</div>
							<div>
								<p className="font-semibold text-sm">{entry.message}</p>
								<p className={cn(mutedTextClassName, "mt-1 text-xs")}>
									{formatDateTime(entry.timestamp)} - {entry.actorId}
								</p>
							</div>
						</div>
					))
				) : (
					<p className="rounded-lg border border-[var(--line)] bg-[var(--surface-strong)]/60 p-3 text-[var(--sea-ink-soft)] text-sm">
						No demo audit events recorded yet.
					</p>
				)}
			</div>
		</section>
	);
}

function SigningDialog({
	error,
	onCompleted,
	onError,
	onOpenChange,
	selectedInstance,
	session,
}: {
	error: string | null;
	onCompleted: () => void;
	onError: (error: unknown) => void;
	onOpenChange: (isOpen: boolean) => void;
	selectedInstance: PortalPackageInstance | null;
	session: DealClosingPipelineSigningSession | null;
}) {
	const recipient = selectedInstance
		? findCurrentRecipient(selectedInstance)
		: null;

	if (!selectedInstance) {
		return null;
	}

	return (
		<div
			aria-labelledby="deal-closing-signing-title"
			aria-modal="true"
			className="fixed inset-3 z-50 grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface-strong)] text-[var(--sea-ink)] shadow-[0_24px_80px_rgba(10,32,34,0.22)] sm:inset-4"
			role="dialog"
		>
			<div className="flex items-start justify-between gap-4 border-[var(--line)] border-b px-5 py-4">
				<div>
					<h2 className="font-semibold text-lg" id="deal-closing-signing-title">
						{selectedInstance.displayName}
					</h2>
					<p className="mt-1 text-[var(--sea-ink-soft)] text-sm">
						Documenso recipient signing token issued by Convex for this package
						instance.
					</p>
				</div>
				<Button
					onClick={() => onOpenChange(false)}
					size="sm"
					type="button"
					variant="outline"
				>
					Close
				</Button>
			</div>
			<SigningSessionBody
				error={error}
				onCompleted={onCompleted}
				onError={onError}
				recipient={recipient}
				session={session}
			/>
		</div>
	);
}

function SigningSessionBody({
	error,
	onCompleted,
	onError,
	recipient,
	session,
}: {
	error: string | null;
	onCompleted: () => void;
	onError: (error: unknown) => void;
	recipient: Recipient | null;
	session: DealClosingPipelineSigningSession | null;
}) {
	if (session?.isPending) {
		return (
			<div className="grid h-full min-h-[70vh] place-items-center px-6 text-center">
				<div>
					<RefreshCw className="mx-auto size-8 animate-spin text-[var(--sea-ink-soft)]" />
					<p className="mt-3 font-semibold">
						Creating embedded signing session
					</p>
					<p className={cn(mutedTextClassName, "mt-1 text-sm")}>
						Convex is requesting a Documenso recipient signing token.
					</p>
				</div>
			</div>
		);
	}

	const visibleError = error ?? session?.error;
	if (visibleError) {
		return (
			<div className="grid h-full min-h-[70vh] place-items-center px-6 text-center">
				<div>
					<ShieldCheck className="mx-auto size-8 text-destructive" />
					<p className="mt-3 font-semibold">Embedded signing unavailable</p>
					<p className="mt-1 text-destructive text-sm">{visibleError}</p>
				</div>
			</div>
		);
	}

	if (session?.token) {
		return (
			<EmbedSignDocument
				className="h-[70vh] w-full rounded-b-lg border-0"
				host={session.host ?? undefined}
				language="en"
				lockName={Boolean(recipient?.name)}
				name={recipient?.name ?? undefined}
				onDocumentCompleted={onCompleted}
				onDocumentError={onError}
				onDocumentReady={() => undefined}
				token={session.token}
			/>
		);
	}

	return (
		<div className="grid h-full min-h-[70vh] place-items-center px-6 text-center">
			<div>
				<FileText className="mx-auto size-8 text-[var(--sea-ink-soft)]" />
				<p className="mt-3 font-semibold">No active signing session</p>
				<p className={cn(mutedTextClassName, "mt-1 text-sm")}>
					Choose an eligible signable package instance to start signing.
				</p>
			</div>
		</div>
	);
}

function InfoTile({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0">
			<p className={cn(mutedTextClassName, "text-sm")}>{label}</p>
			<p className="mt-1 truncate font-semibold text-base">{value}</p>
		</div>
	);
}

function StatusBadge({ status }: { status: string | null | undefined }) {
	const tone = getStatusTone(status);

	return (
		<Badge
			className={cn(
				"rounded-md border bg-[var(--surface-strong)]/70 px-2.5 py-1 font-semibold",
				tone === "green" &&
					"border-[color-mix(in_oklab,var(--palm)_24%,var(--line))] text-[var(--palm)]",
				tone === "blue" &&
					"border-[color-mix(in_oklab,var(--lagoon-deep)_24%,var(--line))] text-[color-mix(in_oklab,var(--lagoon-deep)_76%,black)] dark:text-[var(--lagoon-deep)]",
				tone === "red" && "border-destructive/30 text-destructive",
				tone === "gray" && "border-[var(--line)] text-[var(--sea-ink)]"
			)}
		>
			{formatEnumLabel(status)}
		</Badge>
	);
}
