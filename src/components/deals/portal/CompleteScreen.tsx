import { CheckCircle2, Users } from "lucide-react";
import { formatDate, formatEnumLabel } from "./format";
import type { DealPortalWorkspace } from "./types";

export function CompleteScreen({
	workspace,
}: {
	readonly workspace: DealPortalWorkspace;
}) {
	const approvedProofs = workspace.payment.proofs.filter(
		(proof) => proof.status === "approved"
	);
	const adminProofs = workspace.payment.adminReview?.proofs ?? [];

	return (
		<div className="space-y-5">
			<div>
				<h2 className="font-semibold text-xl">
					{workspace.completion.completed ? "Deal Complete" : "Deal Status"}
				</h2>
				<p className="mt-1 text-slate-600 text-sm leading-6">
					{workspace.completion.completed
						? "The governed close transition has finalized the deal."
						: "The deal has not reached the confirmed terminal state."}
				</p>
			</div>

			<section className="grid gap-4 md:grid-cols-3">
				<SummaryCard
					label="Outcome"
					value={formatEnumLabel(workspace.deal.status)}
				/>
				<SummaryCard
					label="Completed"
					value={formatDate(workspace.completion.completedAt)}
				/>
				<SummaryCard
					label="Governed Transition"
					value={workspace.completion.completed ? "Confirmed" : "Pending"}
				/>
			</section>

			<section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
				<div className="flex items-start gap-3">
					<Users className="mt-1 size-5 text-slate-600" />
					<div>
						<h3 className="font-semibold text-lg">Parties</h3>
						<p className="mt-1 text-slate-600 text-sm leading-6">
							Participant-safe closing parties and assigned counsel.
						</p>
					</div>
				</div>
				<div className="mt-5 grid gap-3 sm:grid-cols-3">
					<Snapshot
						label="Buyer"
						value={workspace.participants.buyer.displayName ?? "Not available"}
					/>
					<Snapshot
						label="Seller"
						value={workspace.participants.seller.displayName ?? "Not available"}
					/>
					<Snapshot
						label="Lawyer"
						value={workspace.participants.lawyer.displayName ?? "Not assigned"}
					/>
				</div>
			</section>

			<section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
				<div className="flex items-start gap-3">
					<CheckCircle2 className="mt-1 size-5 text-slate-600" />
					<div>
						<h3 className="font-semibold text-lg">Funds Evidence</h3>
						<p className="mt-1 text-slate-600 text-sm leading-6">
							Signed document, payment evidence, and governed transition
							references available to this viewer.
						</p>
					</div>
				</div>
				<div className="mt-5 grid gap-3">
					{approvedProofs.length > 0 ? (
						approvedProofs.map((proof) => (
							<div
								className="rounded-md border border-slate-200 p-3"
								key={String(proof.proofId)}
							>
								<p className="font-medium text-sm">
									{formatEnumLabel(proof.status)} payment proof
								</p>
								<p className="mt-1 text-slate-600 text-sm">
									{proof.referenceNumber ?? "No reference"} ·{" "}
									{formatDate(proof.reviewedAt)}
								</p>
							</div>
						))
					) : (
						<p className="text-slate-600 text-sm">
							No approved payment proof is visible yet.
						</p>
					)}
				</div>
			</section>

			{workspace.viewer.persona === "admin" && adminProofs.length > 0 ? (
				<section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
					<h3 className="font-semibold text-lg">Admin Ledger Evidence</h3>
					<div className="mt-4 grid gap-3">
						{adminProofs.map((proof) => (
							<div
								className="rounded-md border border-slate-200 p-3 text-sm"
								key={String(proof.proofId)}
							>
								<p className="font-medium">
									Proof {String(proof.proofId).slice(-8)}
								</p>
								<p className="mt-1 text-slate-600">
									Ledger entries: {proof.cashLedgerJournalEntryIds.length}
								</p>
								<p className="mt-1 text-slate-600">
									Posting group:{" "}
									{proof.cashLedgerPostingGroupId ?? "Not posted"}
								</p>
							</div>
						))}
					</div>
				</section>
			) : null}
		</div>
	);
}

function SummaryCard({
	label,
	value,
}: {
	readonly label: string;
	readonly value: string;
}) {
	return (
		<div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
			<p className="text-slate-500 text-xs">{label}</p>
			<p className="mt-1 font-semibold text-lg">{value}</p>
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
		<div className="rounded-md bg-slate-50 p-3">
			<p className="text-slate-500 text-xs">{label}</p>
			<p className="mt-1 font-medium text-slate-950 text-sm">{value}</p>
		</div>
	);
}
