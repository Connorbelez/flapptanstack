import { FileText } from "lucide-react";
import { EmbeddedSigningPanel } from "./EmbeddedSigningPanel";
import { formatDate, formatEnumLabel } from "./format";
import type { DealPortalDocumentInstance, DealPortalWorkspace } from "./types";

export function DocumentsScreen({
	workspace,
}: {
	readonly workspace: DealPortalWorkspace;
}) {
	const signableInstances = workspace.documents.instances.filter(
		(instance) => instance.signing?.canLaunchEmbeddedSigning === true
	);

	return (
		<div className="space-y-5">
			<div>
				<h2 className="font-semibold text-xl">Document Signing</h2>
				<p className="mt-1 text-slate-600 text-sm leading-6">
					Generated deal documents are signed in the embedded signing provider.
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
					<div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-600 text-sm shadow-xs">
						Document envelopes will appear here after legal representation is
						confirmed.
					</div>
				) : null}
			</div>
		</div>
	);
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
