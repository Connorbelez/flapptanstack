"use client";

import type { FunctionReturnType } from "convex/server";
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	ExternalLink,
	FileText,
	Scale,
	Signature,
	Users,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { LegalRepresentationStatusPanel } from "#/components/legal-representation/LegalRepresentationStatusPanel";
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

type ParticipantDealWorkspace = NonNullable<
	FunctionReturnType<typeof api.deals.queries.getParticipantDealWorkspace>
>;

interface ParticipantDealWorkspacePageProps {
	backTo: "/lender/deals" | "/borrower/deals";
	workspace: ParticipantDealWorkspace;
}

export function ParticipantDealWorkspacePage({
	backTo,
	workspace,
}: ParticipantDealWorkspacePageProps) {
	const signingHref = safeHttpUrl(workspace.signing.embeddedSigningToken);
	const hasCloseReceiptEvidence = Boolean(
		workspace.closeReceipt.closedAt ||
			workspace.closeReceipt.funds ||
			workspace.closeReceipt.signedArchiveStatus === "archived"
	);

	return (
		<div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
			<header className="space-y-4">
				<Button asChild size="sm" variant="ghost">
					<a href={backTo}>
						<ArrowLeft className="mr-2 size-4" />
						My Closings
					</a>
				</Button>
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="outline">{workspace.persona}</Badge>
					<Badge variant="secondary">{workspace.queueGroup}</Badge>
					<Badge variant="secondary">{workspace.deal.status}</Badge>
				</div>
				<div className="space-y-1">
					<h1 className="font-semibold text-3xl tracking-tight">
						{workspace.property
							? `${workspace.property.streetAddress}, ${workspace.property.city}`
							: "Deal Workspace"}
					</h1>
					<p className="text-muted-foreground text-sm">
						{workspace.nextAction}
					</p>
				</div>
			</header>

			{workspace.blockers.length > 0 ? (
				<div className="grid gap-3 md:grid-cols-2">
					{workspace.blockers.map((blocker) => (
						<div
							className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4"
							key={`${blocker.kind}:${blocker.message}`}
						>
							<AlertTriangle className="mt-0.5 size-4 text-amber-600" />
							<div>
								<p className="font-medium text-sm">
									{formatEnumLabel(blocker.kind)}
								</p>
								<p className="text-muted-foreground text-sm">
									{blocker.message}
								</p>
							</div>
						</div>
					))}
				</div>
			) : null}

			<div className="grid gap-4 md:grid-cols-3">
				<Metric
					label="Principal"
					value={formatCurrency(workspace.mortgage.principal)}
				/>
				<Metric
					label="Fractional Share"
					value={formatPercent(workspace.deal.fractionalShareDisplayPercent)}
				/>
				<Metric
					label="Closing Date"
					value={formatDate(workspace.deal.closingDate)}
				/>
			</div>

			{backTo === "/lender/deals" &&
			workspace.legalRepresentation.showInDealViews ? (
				<LegalRepresentationStatusPanel
					dealId={workspace.deal.dealId}
					projection={workspace.legalRepresentation}
					surface="lender"
				/>
			) : null}

			<div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
				<Panel
					description="Deal, property, and mortgage context."
					icon={FileText}
					title="Overview"
				>
					<div className="grid gap-3 sm:grid-cols-2">
						<Snapshot
							label="Mortgage Status"
							value={workspace.mortgage.status}
						/>
						<Snapshot
							label="Payment"
							value={formatCurrency(workspace.mortgage.paymentAmount)}
						/>
						<Snapshot
							label="Interest Rate"
							value={`${workspace.mortgage.interestRate}%`}
						/>
						<Snapshot
							label="Maturity"
							value={workspace.mortgage.maturityDate}
						/>
					</div>
				</Panel>

				<Panel
					description="Current package and signing task state."
					icon={Signature}
					title="Documents & Signatures"
				>
					<div className="space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
							<div>
								<p className="font-medium text-sm">
									{formatEnumLabel(workspace.signing.status)}
								</p>
								<p className="text-muted-foreground text-sm">
									{workspace.signing.recipientName ?? "Recipient sequence"}
								</p>
							</div>
							<SigningAction
								hasToken={Boolean(workspace.signing.embeddedSigningToken)}
								signingHref={signingHref}
							/>
						</div>
						<div className="space-y-2">
							{workspace.documentInstances.map((document) => (
								<DocumentRow document={document} key={document.instanceId} />
							))}
							{workspace.documentInstances.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									No deal documents are available yet.
								</p>
							) : null}
						</div>
					</div>
				</Panel>

				<Panel
					description="Closing milestones from package, signing, and receipt state."
					icon={CheckCircle2}
					title="Timeline"
				>
					<div className="space-y-3">
						{workspace.timeline.map((entry) => (
							<div className="flex gap-3" key={entry.label}>
								<Badge className="h-fit" variant="outline">
									{entry.status}
								</Badge>
								<div>
									<p className="font-medium text-sm">{entry.label}</p>
									<p className="text-muted-foreground text-sm">
										{entry.description}
									</p>
									<p className="mt-1 text-muted-foreground text-xs">
										{formatDate(entry.at)}
									</p>
								</div>
							</div>
						))}
					</div>
				</Panel>

				<Panel
					description="Role-specific parties and assigned counsel."
					icon={Users}
					title="Parties & Counsel"
				>
					<div className="grid gap-3 sm:grid-cols-2">
						<Snapshot
							label="Purchasing Lender"
							value={workspace.parties.lender.name}
						/>
						<Snapshot
							label="Selling Lender"
							value={workspace.parties.seller.name}
						/>
						<Snapshot
							label="Assigned Lawyer"
							value={workspace.parties.assignedLawyer.name ?? "Unassigned"}
						/>
						<Snapshot
							label="Representation"
							value={
								workspace.participants.lawyer.hasActiveDealAccess
									? "Confirmed"
									: "Pending"
							}
						/>
					</div>
				</Panel>
			</div>

			{hasCloseReceiptEvidence ? (
				<Panel
					description="Participant-safe close evidence."
					icon={Scale}
					title="Completion Receipt"
				>
					<div className="grid gap-3 sm:grid-cols-3">
						<Snapshot
							label="Closed At"
							value={formatDate(workspace.closeReceipt.closedAt)}
						/>
						<Snapshot
							label="Funds"
							value={
								workspace.closeReceipt.funds
									? formatEnumLabel(workspace.closeReceipt.funds.sourceKind)
									: "Unavailable"
							}
						/>
						<Snapshot
							label="Archive"
							value={
								workspace.closeReceipt.signedArchiveStatus ?? "Unavailable"
							}
						/>
					</div>
				</Panel>
			) : null}
		</div>
	);
}

function safeHttpUrl(value: string | null) {
	if (!value) {
		return null;
	}
	try {
		const url = new URL(value);
		if (url.protocol === "https:" || url.protocol === "http:") {
			return url.toString();
		}
	} catch {
		return null;
	}
	return null;
}

function SigningAction({
	hasToken,
	signingHref,
}: {
	hasToken: boolean;
	signingHref: string | null;
}) {
	if (signingHref) {
		return (
			<Button asChild size="sm">
				<a href={signingHref} rel="noreferrer" target="_blank">
					<ExternalLink className="mr-2 size-4" />
					Open signing
				</a>
			</Button>
		);
	}
	if (hasToken) {
		return <Badge variant="secondary">Signing task ready</Badge>;
	}
	return <Badge variant="outline">No active signing link</Badge>;
}

function Panel({
	children,
	description,
	icon: Icon,
	title,
}: {
	children: ReactNode;
	description: string;
	icon: ComponentType<{ className?: string }>;
	title: string;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-lg">
					<Icon className="size-4 text-muted-foreground" />
					{title}
				</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardDescription>{label}</CardDescription>
				<CardTitle className="text-xl">{value}</CardTitle>
			</CardHeader>
		</Card>
	);
}

function Snapshot({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-border/60 p-3">
			<p className="text-muted-foreground text-xs uppercase">{label}</p>
			<p className="mt-2 font-medium text-sm">{value}</p>
		</div>
	);
}

function DocumentRow({
	document,
}: {
	document: ParticipantDealWorkspace["documentInstances"][number];
}) {
	const canOpen = Boolean(document.url);
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
			<div>
				<p className="font-medium text-sm">{document.displayName}</p>
				<p className="text-muted-foreground text-xs">
					{document.packageLabel ?? "Deal package"} ·{" "}
					{formatEnumLabel(document.class)}
				</p>
			</div>
			{canOpen ? (
				<Button asChild size="sm" variant="outline">
					<a href={document.url ?? "#"} rel="noreferrer" target="_blank">
						<FileText className="mr-2 size-4" />
						Open PDF
					</a>
				</Button>
			) : (
				<Badge variant="outline">{formatEnumLabel(document.status)}</Badge>
			)}
		</div>
	);
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

function formatDate(value: number | null | undefined) {
	if (typeof value !== "number") {
		return "Unavailable";
	}
	return new Date(value).toLocaleDateString("en-CA", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function formatEnumLabel(value: string) {
	return value
		.split("_")
		.map((segment) =>
			segment.length > 0
				? `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`
				: segment
		)
		.join(" ");
}

function formatPercent(value: number | null | undefined) {
	if (typeof value !== "number") {
		return "Invalid share";
	}
	return `${value}%`;
}
