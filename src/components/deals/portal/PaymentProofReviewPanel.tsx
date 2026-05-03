import { useQueryClient } from "@tanstack/react-query";
import { useAction, useMutation } from "convex/react";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { formatCurrency, formatDate, formatEnumLabel } from "./format";
import type {
	DealPortalPaymentReview,
	DealPortalPaymentReviewProof,
} from "./types";

export function PaymentProofReviewPanel({
	review,
}: {
	readonly review: DealPortalPaymentReview;
}) {
	if (review.proofs.length === 0) {
		return (
			<div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-600 text-sm shadow-xs">
				No manual payment proofs have been submitted yet.
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
			<div className="flex items-start gap-3">
				<ShieldCheck className="mt-1 size-5 text-slate-600" />
				<div>
					<h3 className="font-semibold text-lg">Admin Review</h3>
					<p className="mt-1 text-slate-600 text-sm leading-6">
						Approve only after confirming off-platform funds and ledger
						evidence.
					</p>
				</div>
			</div>
			<div className="mt-5 space-y-3">
				{review.proofs.map((proof) => (
					<PaymentProofReviewRow key={String(proof.proofId)} proof={proof} />
				))}
			</div>
		</div>
	);
}

function PaymentProofReviewRow({
	proof,
}: {
	readonly proof: DealPortalPaymentReviewProof;
}) {
	const [note, setNote] = useState("Funds reviewed and confirmed.");
	const [status, setStatus] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const queryClient = useQueryClient();
	const approveProof = useAction(
		api.deals.paymentProofs.approveManualPaymentProof
	);
	const rejectProof = useMutation(
		api.deals.paymentProofs.rejectManualPaymentProof
	);
	const isPending = proof.status === "pending_review";

	async function approve() {
		setSubmitting(true);
		setStatus(null);
		try {
			await approveProof({ proofId: proof.proofId, reviewNote: note });
			await queryClient.invalidateQueries();
			setStatus("Payment proof approved.");
		} catch (error) {
			setStatus(error instanceof Error ? error.message : "Approval failed.");
		} finally {
			setSubmitting(false);
		}
	}

	async function reject() {
		setSubmitting(true);
		setStatus(null);
		try {
			await rejectProof({ proofId: proof.proofId, reason: note });
			await queryClient.invalidateQueries();
			setStatus("Payment proof rejected.");
		} catch (error) {
			setStatus(error instanceof Error ? error.message : "Rejection failed.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="rounded-md border border-slate-200 p-4">
			<div className="grid gap-3 sm:grid-cols-4">
				<Snapshot label="Amount" value={formatCurrency(proof.amount)} />
				<Snapshot label="Status" value={formatEnumLabel(proof.status)} />
				<Snapshot
					label="Transfer Date"
					value={formatDate(proof.transferDate)}
				/>
				<Snapshot
					label="Reference"
					value={proof.referenceNumber ?? "Not provided"}
				/>
			</div>
			<label className="mt-4 grid gap-1 text-sm">
				<span className="font-medium text-slate-700">Review Note</span>
				<textarea
					className="min-h-20 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
					onChange={(event) => setNote(event.currentTarget.value)}
					value={note}
				/>
			</label>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				<button
					className="rounded-md bg-slate-950 px-3 py-2 font-medium text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-400"
					disabled={!isPending || submitting}
					onClick={() => void approve()}
					type="button"
				>
					Approve proof
				</button>
				<button
					className="rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-950 text-sm disabled:cursor-not-allowed disabled:text-slate-400"
					disabled={!isPending || submitting}
					onClick={() => void reject()}
					type="button"
				>
					Reject proof
				</button>
				{status ? <p className="text-slate-600 text-sm">{status}</p> : null}
			</div>
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
			<p className="mt-1 font-medium text-sm">{value}</p>
		</div>
	);
}
