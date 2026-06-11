import { useQueryClient } from "@tanstack/react-query";
import { useAction, useMutation } from "convex/react";
import { ExternalLink, FileText, ImageIcon, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PdfPreviewViewer } from "#/components/shared/PdfPreviewViewer";
import { api } from "../../../../convex/_generated/api";
import { formatCurrency, formatDate, formatEnumLabel } from "./format";
import type {
	DealPortalPaymentReview,
	DealPortalPaymentReviewProof,
} from "./types";

export function PaymentProofReviewPanel({
	canApprove,
	canReject,
	review,
	title = "Admin Review",
}: {
	readonly canApprove: boolean;
	readonly canReject: boolean;
	readonly review: DealPortalPaymentReview;
	readonly title?: string;
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
					<h3 className="font-semibold text-lg">{title}</h3>
					<p className="mt-1 text-slate-600 text-sm leading-6">
						Approve only after confirming off-platform funds and ledger
						evidence.
					</p>
				</div>
			</div>
			<div className="mt-5 space-y-3">
				{review.proofs.map((proof) => (
					<PaymentProofReviewRow
						canApprove={canApprove}
						canReject={canReject}
						key={String(proof.proofId)}
						proof={proof}
					/>
				))}
			</div>
		</div>
	);
}

function PaymentProofReviewRow({
	canApprove,
	canReject,
	proof,
}: {
	readonly canApprove: boolean;
	readonly canReject: boolean;
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
	const canAct = canApprove || canReject;

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
			<PaymentProofAttachments attachments={proof.attachments} />
			{canAct ? (
				<>
					<label className="mt-4 grid gap-1 text-sm">
						<span className="font-medium text-slate-700">Review Note</span>
						<textarea
							className="min-h-20 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
							onChange={(event) => setNote(event.currentTarget.value)}
							value={note}
						/>
					</label>
					<div className="mt-3 flex flex-wrap items-center gap-2">
						{canApprove ? (
							<button
								className="rounded-md bg-slate-950 px-3 py-2 font-medium text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-400"
								disabled={!isPending || submitting}
								onClick={() => void approve()}
								type="button"
							>
								Approve proof
							</button>
						) : null}
						{canReject ? (
							<button
								className="rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-950 text-sm disabled:cursor-not-allowed disabled:text-slate-400"
								disabled={!isPending || submitting}
								onClick={() => void reject()}
								type="button"
							>
								Reject proof
							</button>
						) : null}
						{status ? <p className="text-slate-600 text-sm">{status}</p> : null}
					</div>
				</>
			) : null}
		</div>
	);
}

function PaymentProofAttachments({
	attachments,
}: {
	readonly attachments: DealPortalPaymentReviewProof["attachments"];
}) {
	return (
		<section className="mt-4 space-y-3">
			<div className="flex items-center justify-between gap-3">
				<h4 className="font-medium text-slate-700 text-sm">Attachments</h4>
				<p className="text-slate-500 text-xs">{attachments.length} file(s)</p>
			</div>
			{attachments.length > 0 ? (
				<div className="grid gap-3">
					{attachments.map((attachment) => (
						<PaymentProofAttachmentCard
							attachment={attachment}
							key={String(attachment.assetId)}
						/>
					))}
				</div>
			) : (
				<div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-600 text-sm">
					No files were attached to this payment proof.
				</div>
			)}
		</section>
	);
}

function PaymentProofAttachmentCard({
	attachment,
}: {
	readonly attachment: DealPortalPaymentReviewProof["attachments"][number];
}) {
	const isImage = attachment.mimeType?.startsWith("image/");
	const isPdf = attachment.mimeType === "application/pdf";
	const fileLabel = attachment.originalFilename || attachment.name;

	return (
		<div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
			<div className="flex flex-wrap items-center justify-between gap-3 border-slate-200 border-b bg-white px-3 py-2">
				<div className="flex min-w-0 items-center gap-2">
					{isImage ? (
						<ImageIcon className="size-4 shrink-0 text-slate-500" />
					) : (
						<FileText className="size-4 shrink-0 text-slate-500" />
					)}
					<div className="min-w-0">
						<p className="truncate font-medium text-slate-800 text-sm">
							{fileLabel}
						</p>
						<p className="text-slate-500 text-xs">
							{attachment.mimeType ?? "Unknown type"}
							{attachment.fileSize !== null
								? ` · ${formatFileSize(attachment.fileSize)}`
								: ""}
						</p>
					</div>
				</div>
				{attachment.url && !isPdf ? (
					<a
						className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 font-medium text-slate-700 text-xs hover:bg-slate-100"
						href={attachment.url}
						rel="noreferrer"
						target="_blank"
					>
						Open file
						<ExternalLink className="size-3" />
					</a>
				) : null}
			</div>
			<div className="bg-slate-100 p-3">
				{attachment.url && isImage ? (
					<img
						alt={fileLabel}
						className="max-h-80 w-full rounded border border-slate-200 bg-white object-contain"
						height={320}
						src={attachment.url}
						width={640}
					/>
				) : null}
				{attachment.url && isPdf ? (
					<div className="h-[28rem] rounded border border-slate-200 bg-white p-3">
						<PdfPreviewViewer
							fileName={fileLabel}
							fileUrl={attachment.url}
							label={fileLabel}
							meta={[
								attachment.mimeType ?? "PDF document",
								attachment.fileSize !== null
									? formatFileSize(attachment.fileSize)
									: null,
							]
								.filter(Boolean)
								.join(" · ")}
							mobile
							openFileLabel="Open file"
							unavailableMessage="File unavailable."
						/>
					</div>
				) : null}
				{attachment.url ? null : (
					<div className="rounded border border-slate-300 border-dashed bg-white p-4 text-slate-600 text-sm">
						File unavailable.
					</div>
				)}
				{attachment.url && !(isImage || isPdf) ? (
					<div className="rounded border border-slate-200 bg-white p-4 text-slate-600 text-sm">
						Preview is not available for this file type.
					</div>
				) : null}
			</div>
		</div>
	);
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${Math.round(bytes / 1024)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
