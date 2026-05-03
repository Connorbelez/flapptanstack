import { formatCurrency, formatDate, formatEnumLabel } from "./format";
import { PaymentProofReviewPanel } from "./PaymentProofReviewPanel";
import { PaymentProofUploader } from "./PaymentProofUploader";
import { type DealPortalWorkspace, hasPortalCapability } from "./types";

export function PaymentScreen({
	workspace,
}: {
	readonly workspace: DealPortalWorkspace;
}) {
	const canUpload = hasPortalCapability(workspace, "payment.proof.upload");

	return (
		<div className="space-y-5">
			<div>
				<h2 className="font-semibold text-xl">Payment Confirmation</h2>
				<p className="mt-1 text-slate-600 text-sm leading-6">
					Manual wire proof is reviewed by FairLend before the governed close
					transition runs.
				</p>
			</div>

			{workspace.payment.proofs.length > 0 ? (
				<div className="grid gap-3">
					{workspace.payment.proofs.map((proof) => (
						<div
							className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs"
							key={String(proof.proofId)}
						>
							<div className="grid gap-3 sm:grid-cols-4">
								<Snapshot
									label="Status"
									value={formatEnumLabel(proof.status)}
								/>
								<Snapshot label="Amount" value={formatCurrency(proof.amount)} />
								<Snapshot
									label="Transfer Date"
									value={formatDate(proof.transferDate)}
								/>
								<Snapshot
									label="Reference"
									value={proof.referenceNumber ?? "Not provided"}
								/>
							</div>
						</div>
					))}
				</div>
			) : null}

			{canUpload ? (
				<PaymentProofUploader dealId={workspace.deal.dealId} />
			) : (
				<div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-600 text-sm shadow-xs">
					Payment proof is awaiting lender or lawyer action.
				</div>
			)}

			{workspace.payment.adminReview ? (
				<PaymentProofReviewPanel review={workspace.payment.adminReview} />
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
