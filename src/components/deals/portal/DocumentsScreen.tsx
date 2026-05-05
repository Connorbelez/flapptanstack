import { useQueryClient } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { FileText, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { api } from "../../../../convex/_generated/api";
import { EmbeddedSigningPanel } from "./EmbeddedSigningPanel";
import { formatDate, formatEnumLabel } from "./format";
import {
	type DealPortalDocumentInstance,
	type DealPortalWorkspace,
	hasPortalCapability,
} from "./types";

export function DocumentsScreen({
	workspace,
}: {
	readonly workspace: DealPortalWorkspace;
}) {
	const signableInstances = workspace.documents.instances.filter(
		(instance) => instance.signing?.canLaunchEmbeddedSigning === true
	);
	const queryClient = useQueryClient();
	const skipEmptyDocumentSigning = useMutation(
		api.deals.portalMutations.skipEmptyDocumentSigning
	);
	const [submitting, setSubmitting] = useState(false);
	const [status, setStatus] = useState<string | null>(null);
	const canSkipEmptyDocuments =
		workspace.documents.instances.length === 0 &&
		hasPortalCapability(workspace, "documents.skipEmpty");

	async function runSkipEmptyDocumentSigning() {
		setSubmitting(true);
		setStatus(null);
		try {
			await skipEmptyDocumentSigning({ dealId: workspace.deal.dealId });
			await queryClient.invalidateQueries();
			setStatus("Deal progressed.");
		} catch (error) {
			setStatus(
				error instanceof Error ? error.message : "Deal could not be progressed."
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="space-y-5">
			<div>
				<h2
					className="font-semibold text-2xl tracking-tight"
					style={{ color: "var(--sea-ink)" }}
				>
					Document Signing
				</h2>
				<p
					className="mt-2 max-w-2xl text-sm leading-6"
					style={{ color: "var(--sea-ink-soft)" }}
				>
					Generated closing documents are completed through the embedded signing
					provider.
				</p>
			</div>

			{signableInstances.map((instance) => (
				<EmbeddedSigningPanel
					dealId={workspace.deal.dealId}
					instanceId={instance.instanceId}
					key={String(instance.instanceId)}
				/>
			))}

			<div className="grid gap-3">
				{workspace.documents.instances.map((instance) => (
					<DocumentRow instance={instance} key={String(instance.instanceId)} />
				))}
				{workspace.documents.instances.length === 0 ? (
					<div
						className="rounded-xl border p-5 text-sm shadow-xs sm:p-6"
						style={{
							background:
								"color-mix(in oklab, var(--surface-strong) 92%, var(--lagoon) 8%)",
							borderColor:
								"color-mix(in oklab, var(--line) 72%, var(--lagoon) 28%)",
						}}
					>
						<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div className="flex min-w-0 gap-3">
								<div
									className="flex size-10 shrink-0 items-center justify-center rounded-full"
									style={{
										background:
											"color-mix(in oklab, var(--lagoon) 16%, transparent)",
										color: "var(--lagoon)",
									}}
								>
									<ShieldCheck className="size-5" />
								</div>
								<div className="min-w-0">
									<h3
										className="font-semibold text-base"
										style={{ color: "var(--sea-ink)" }}
									>
										{emptyDocumentTitle(workspace)}
									</h3>
									<p
										className="mt-1 max-w-2xl leading-6"
										style={{ color: "var(--sea-ink-soft)" }}
									>
										{emptyDocumentMessage(workspace)}
									</p>
									{canSkipEmptyDocuments ? (
										<p
											className="mt-2 text-xs"
											style={{ color: "var(--sea-ink-soft)" }}
										>
											Only available because no document envelopes exist.
										</p>
									) : null}
								</div>
							</div>
							{canSkipEmptyDocuments ? (
								<div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
									<Button
										disabled={submitting}
										onClick={() => void runSkipEmptyDocumentSigning()}
										size="sm"
									>
										Progress deal
									</Button>
									{status ? (
										<p
											className="basis-full text-right text-sm"
											style={{ color: "var(--sea-ink-soft)" }}
										>
											{status}
										</p>
									) : null}
								</div>
							) : null}
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}

function emptyDocumentTitle(workspace: DealPortalWorkspace) {
	const packageStatus = workspace.documents.package?.status ?? null;
	if (
		workspace.deal.status === "documentReview.pending" &&
		packageStatus !== "pending"
	) {
		return "No documents required";
	}
	if (packageStatus === "pending") {
		return "Document package generating";
	}
	if (packageStatus === "failed" || packageStatus === "partial_failure") {
		return "Document generation needs attention";
	}
	return "No document envelopes";
}

function emptyDocumentMessage(workspace: DealPortalWorkspace) {
	const packageStatus = workspace.documents.package?.status ?? null;
	if (workspace.deal.status === "lawyerOnboarding.pending") {
		return "Document envelopes will appear here after legal representation is confirmed.";
	}
	if (workspace.deal.status === "lawyerOnboarding.verified") {
		return "Document envelopes will appear here after representation confirmation is recorded.";
	}
	if (packageStatus === null) {
		return "No signing envelopes are present for this deal.";
	}
	if (packageStatus === "pending") {
		return "Document package generation is in progress. Envelopes will appear here when generation completes.";
	}
	if (packageStatus === "failed" || packageStatus === "partial_failure") {
		return "Document package generation needs attention before envelopes can be signed.";
	}
	return "No signing envelopes are present for this deal.";
}

function DocumentRow({
	instance,
}: {
	readonly instance: DealPortalDocumentInstance;
}) {
	return (
		<div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex items-start gap-3">
					<FileText className="mt-1 size-5 text-slate-600" />
					<div>
						<h3 className="font-semibold text-base">{instance.displayName}</h3>
						<p className="mt-1 text-slate-600 text-sm">
							{formatEnumLabel(instance.status)} ·{" "}
							{formatEnumLabel(instance.class)}
						</p>
					</div>
				</div>
				{instance.url ? (
					<a
						className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-950 text-sm"
						href={instance.url}
						rel="noreferrer"
						target="_blank"
					>
						Open document
					</a>
				) : null}
			</div>
			{instance.signing ? (
				<div className="mt-4 grid gap-3 sm:grid-cols-3">
					<Snapshot
						label="Envelope"
						value={formatEnumLabel(instance.signing.status)}
					/>
					<Snapshot
						label="Last Sync"
						value={formatDate(instance.signing.lastProviderSyncAt)}
					/>
					<Snapshot
						label="Recipients"
						value={`${instance.signing.recipients.length}`}
					/>
				</div>
			) : null}
		</div>
	);
}

function Snapshot({
	label,
	value,
}: {
	readonly label: string;
	readonly value: string;
}) {
	return (
		<div>
			<p className="text-slate-500 text-xs">{label}</p>
			<p className="mt-1 font-medium text-slate-950 text-sm">{value}</p>
		</div>
	);
}
