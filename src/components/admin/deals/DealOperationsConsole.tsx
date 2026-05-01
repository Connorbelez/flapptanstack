"use client";

import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	CircleDashed,
	FileSignature,
	Landmark,
	ReceiptText,
	Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { LegalRepresentationStatusPanel } from "#/components/legal-representation/LegalRepresentationStatusPanel";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { AdminDealOperationsDetail } from "../../../../convex/deals/queries";
import { DealOperationActionControls } from "./DealOperationActionControls";
import { DealPortalLinks } from "./DealPortalLinks";
import {
	DEAL_OPERATIONS_PHASES,
	formatDealOperationPhase,
	formatDealShare,
	formatEnumLabel,
	lifecycleProgress,
} from "./dealOperationsViewModel";

function formatDateTime(value: number | null | undefined) {
	if (value == null) {
		return "Unavailable";
	}
	return new Date(value).toLocaleString();
}

function formatCurrency(value: number | null | undefined) {
	if (value == null) {
		return "Unavailable";
	}
	return new Intl.NumberFormat("en-US", {
		currency: "USD",
		maximumFractionDigits: 0,
		style: "currency",
	}).format(value);
}

function Section({
	children,
	description,
	icon,
	title,
}: {
	readonly children: ReactNode;
	readonly description: string;
	readonly icon: ReactNode;
	readonly title: string;
}) {
	return (
		<section className="space-y-4 border-border/70 border-t pt-5">
			<div className="flex gap-3">
				<div className="mt-0.5 text-muted-foreground">{icon}</div>
				<div className="space-y-1">
					<h2 className="font-medium text-base">{title}</h2>
					<p className="text-muted-foreground text-sm">{description}</p>
				</div>
			</div>
			{children}
		</section>
	);
}

function FactGrid({
	items,
}: {
	readonly items: ReadonlyArray<{ label: string; value: ReactNode }>;
}) {
	return (
		<div className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
			{items.map((item) => (
				<div className="border-border/60 border-t py-3" key={item.label}>
					<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
						{item.label}
					</p>
					<div className="mt-1 break-words font-medium text-sm">
						{item.value}
					</div>
				</div>
			))}
		</div>
	);
}

function LifecycleRail({
	detail,
}: {
	readonly detail: AdminDealOperationsDetail;
}) {
	const progress = lifecycleProgress(detail.lifecycle.phase);
	return (
		<div className="grid gap-2 md:grid-cols-5">
			{DEAL_OPERATIONS_PHASES.filter(
				(phase) => phase.id !== "failed" && phase.id !== "unknown"
			).map((phase) => {
				const isComplete = progress.completed.includes(phase.id);
				const isCurrent = progress.current === phase.id;
				return (
					<div
						className="rounded-md border border-border/70 p-3"
						key={phase.id}
					>
						<div className="mb-2 flex items-center gap-2">
							{isComplete ? (
								<CheckCircle2 className="size-4 text-emerald-600" />
							) : (
								<CircleDashed
									className={
										isCurrent
											? "size-4 text-primary"
											: "size-4 text-muted-foreground"
									}
								/>
							)}
							<span className="font-medium text-sm">{phase.title}</span>
						</div>
						<p className="text-muted-foreground text-xs">
							{isCurrent
								? "Current stage"
								: isComplete
									? "Complete"
									: "Upcoming"}
						</p>
					</div>
				);
			})}
		</div>
	);
}

function BlockersPanel({
	detail,
}: {
	readonly detail: AdminDealOperationsDetail;
}) {
	if (detail.blockers.length === 0) {
		return (
			<div className="rounded-md border border-border/70 p-4 text-muted-foreground text-sm">
				No operational blockers are projected for this deal.
			</div>
		);
	}
	return (
		<div className="divide-y divide-border/70 rounded-md border border-border/70">
			{detail.blockers.map((blocker) => (
				<div
					className="flex gap-3 p-3"
					key={`${blocker.kind}-${blocker.message}`}
				>
					<AlertTriangle className="mt-0.5 size-4 text-amber-600" />
					<div>
						<p className="font-medium text-sm">
							{formatEnumLabel(blocker.kind)}
						</p>
						<p className="text-muted-foreground text-sm">{blocker.message}</p>
					</div>
					<Badge className="ml-auto" variant="outline">
						{blocker.severity}
					</Badge>
				</div>
			))}
		</div>
	);
}

export function DealOperationsConsole({
	dealId,
}: {
	readonly dealId: Id<"deals">;
}) {
	const detail = useQuery(api.deals.queries.getAdminDealOperationsDetail, {
		dealId,
	}) as AdminDealOperationsDetail | null | undefined;

	if (detail === undefined) {
		return (
			<div className="space-y-5 p-6">
				<div className="h-8 w-72 rounded bg-muted" />
				<div className="h-64 rounded-md bg-muted" />
			</div>
		);
	}

	if (detail === null) {
		return (
			<div className="p-6">
				<div className="rounded-md border border-border/70 p-6">
					<h1 className="font-semibold text-xl">Deal not found</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						The requested deal is unavailable or no longer accessible.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6 p-6">
			<header className="space-y-4">
				<Button asChild size="sm" variant="outline">
					<Link
						search={{
							detailOpen: false,
							entityType: undefined,
							recordId: undefined,
						}}
						to="/admin/deals"
					>
						<ArrowLeft className="mr-2 size-4" />
						Deal operations
					</Link>
				</Button>
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="space-y-2">
						<h1 className="font-semibold text-2xl tracking-tight">
							Deal {String(detail.deal.dealId).slice(-6)}
						</h1>
						<div className="flex flex-wrap gap-2">
							<Badge>
								{formatDealOperationPhase(
									detail.lifecycle.status,
									detail.lifecycle.subState
								)}
							</Badge>
							<Badge variant="outline">
								Share{" "}
								{formatDealShare(detail.deal.fractionalShareDisplayPercent)}
							</Badge>
							<Badge
								variant={detail.blockers.length > 0 ? "destructive" : "outline"}
							>
								{detail.blockers.length} blocker
								{detail.blockers.length === 1 ? "" : "s"}
							</Badge>
						</div>
					</div>
					<DealOperationActionControls
						actions={detail.nextActions}
						dealId={detail.deal.dealId}
						mode="full"
					/>
				</div>
			</header>

			<Section
				description="Server-projected lifecycle status from the governed deal machine."
				icon={<CheckCircle2 className="size-5" />}
				title="Lifecycle"
			>
				<LifecycleRail detail={detail} />
			</Section>

			<Section
				description="Exceptions, missing contract data, and close-side blockers that need operator attention."
				icon={<AlertTriangle className="size-5" />}
				title="Blockers And Exceptions"
			>
				<BlockersPanel detail={detail} />
			</Section>

			{detail.legalRepresentation.showInDealViews ? (
				<Section
					description="Invitation, verification, access, and representation-management status."
					icon={<Users className="size-5" />}
					title="Legal Representation"
				>
					<LegalRepresentationStatusPanel
						dealId={detail.deal.dealId}
						projection={detail.legalRepresentation}
						surface="admin"
					/>
				</Section>
			) : null}

			<Section
				description="Normalized buyer, seller, lawyer, and scoped deal access from server contracts."
				icon={<Users className="size-5" />}
				title="Parties And Access"
			>
				<FactGrid
					items={[
						{
							label: "Buyer",
							value: `${detail.participants.buyer.displayName} (${detail.participants.buyer.email ?? "no email"})`,
						},
						{
							label: "Seller",
							value: `${detail.participants.seller.displayName} (${detail.participants.seller.email ?? "no email"})`,
						},
						{
							label: "Lawyer",
							value:
								detail.participants.lawyer.displayName ??
								"Optional lawyer not assigned",
						},
						{
							label: "Active access",
							value: `${detail.access.active.length} active grants`,
						},
						{
							label: "Revoked access",
							value: `${detail.access.revoked.length} revoked grants`,
						},
						{
							label: "Fraction",
							value: `${detail.deal.fractionalShareUnits} units / ${formatDealShare(detail.deal.fractionalShareDisplayPercent)}`,
						},
					]}
				/>
			</Section>

			<Section
				description="Package, envelope attempt, required recipient progress, and signing exception state."
				icon={<FileSignature className="size-5" />}
				title="Package And Signing"
			>
				<FactGrid
					items={[
						{
							label: "Package status",
							value: detail.documentPackage?.status
								? formatEnumLabel(detail.documentPackage.status)
								: "Missing package",
						},
						{
							label: "Package ready",
							value: formatDateTime(detail.documentPackage?.readyAt),
						},
						{
							label: "Signing status",
							value: formatEnumLabel(detail.signing.status),
						},
						{
							label: "Required signers",
							value: `${detail.signing.recipients.filter((recipient) => recipient.required && recipient.signingStatus === "completed").length}/${detail.signing.recipients.filter((recipient) => recipient.required).length}`,
						},
						{
							label: "Open exceptions",
							value: `${detail.signing.exceptions.filter((exception) => exception.status === "open").length}`,
						},
						{
							label: "Documents",
							value: `${detail.documentInstances.length} package rows`,
						},
					]}
				/>
				<div className="divide-y divide-border/70 rounded-md border border-border/70">
					{detail.signing.recipients.length > 0 ? (
						detail.signing.recipients.map((recipient) => (
							<div
								className="flex flex-wrap items-center gap-3 p-3"
								key={`${recipient.platformRole}-${recipient.signingOrder}`}
							>
								<p className="font-medium text-sm">{recipient.name}</p>
								<Badge variant="outline">
									{formatEnumLabel(recipient.platformRole)}
								</Badge>
								<Badge variant="secondary">
									{formatEnumLabel(recipient.signingStatus)}
								</Badge>
								<span className="ml-auto text-muted-foreground text-xs">
									Order {recipient.signingOrder}
								</span>
							</div>
						))
					) : (
						<p className="p-3 text-muted-foreground text-sm">
							No active recipient roster is available.
						</p>
					)}
				</div>
			</Section>

			<Section
				description="Funds evidence, signed archive state, reservation and close-side effect outcomes."
				icon={<Landmark className="size-5" />}
				title="Financial Consequences"
			>
				<FactGrid
					items={[
						{
							label: "Locking fee",
							value: formatCurrency(detail.deal.lockingFeeAmount),
						},
						{
							label: "Reservation",
							value: detail.deal.reservationId
								? String(detail.deal.reservationId)
								: "No reservation linked",
						},
						{
							label: "Funds source",
							value: detail.closeEvidence.funds
								? formatEnumLabel(detail.closeEvidence.funds.sourceKind)
								: "No funds evidence",
						},
						{
							label: "Funds received",
							value: formatDateTime(detail.closeEvidence.funds?.receivedAt),
						},
						{
							label: "Signed archives",
							value: `${detail.closeEvidence.archives.length} archive records`,
						},
						{
							label: "Close effects",
							value: `${detail.closeEvidence.effectOutcomes.length} outcomes`,
						},
					]}
				/>
			</Section>

			<Section
				description="Recent transition receipts, including rejected governed attempts."
				icon={<ReceiptText className="size-5" />}
				title="Audit Timeline"
			>
				<div className="divide-y divide-border/70 rounded-md border border-border/70">
					{detail.auditTimeline.length > 0 ? (
						detail.auditTimeline.map((event) => (
							<div className="p-3" key={event.eventId}>
								<div className="flex flex-wrap items-center gap-2">
									<p className="font-medium text-sm">{event.eventType}</p>
									<Badge variant="outline">{event.outcome}</Badge>
								</div>
								<p className="mt-1 text-muted-foreground text-sm">
									{event.previousState ?? "unknown"} -{" "}
									{event.newState ?? "unknown"}
								</p>
								<p className="mt-1 text-muted-foreground text-xs">
									{formatDateTime(event.timestamp)}
								</p>
							</div>
						))
					) : (
						<p className="p-3 text-muted-foreground text-sm">
							No audit events are available for this deal.
						</p>
					)}
				</div>
			</Section>

			<DealPortalLinks dealId={detail.deal.dealId} />
		</div>
	);
}
