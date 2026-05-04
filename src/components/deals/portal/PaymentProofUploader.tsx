import { useQueryClient } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type PaymentProofMimeType =
	| "application/pdf"
	| "image/jpeg"
	| "image/png"
	| "image/webp";

const ACCEPTED_PAYMENT_PROOF_TYPES = new Set<PaymentProofMimeType>([
	"application/pdf",
	"image/jpeg",
	"image/png",
	"image/webp",
]);
const FILE_EXTENSION_SUFFIX_PATTERN = /\.[^.]+$/u;

const todayInputValue = () => new Date().toISOString().slice(0, 10);

export function PaymentProofUploader({
	dealId,
}: {
	readonly dealId: Id<"deals">;
}) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [amount, setAmount] = useState("");
	const [institutionName, setInstitutionName] = useState("");
	const [referenceNumber, setReferenceNumber] = useState("");
	const [sendingParty, setSendingParty] = useState("");
	const [transferDate, setTransferDate] = useState(todayInputValue);
	const [status, setStatus] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const queryClient = useQueryClient();

	const generateUploadUrl = useMutation(api.documents.assets.generateUploadUrl);
	const createAsset = useMutation(api.documents.assets.create);
	const uploadProof = useMutation(
		api.deals.paymentProofs.uploadManualPaymentProof
	);

	async function submitProof() {
		const file = fileRef.current?.files?.[0];
		if (!file) {
			setStatus("Choose a PDF or image receipt.");
			return;
		}
		if (!isPaymentProofMimeType(file.type)) {
			setStatus("Upload a PDF, JPG, PNG, or WebP receipt.");
			return;
		}
		const amountNumber = Number(amount);
		if (!(Number.isFinite(amountNumber) && amountNumber > 0)) {
			setStatus("Enter a positive payment amount.");
			return;
		}
		if (!sendingParty.trim()) {
			setStatus("Enter the sending party.");
			return;
		}

		setSubmitting(true);
		setStatus(null);
		try {
			const { uploadUrl } = await generateUploadUrl({});
			const uploadResponse = await fetch(uploadUrl, {
				body: file,
				headers: { "Content-Type": file.type },
				method: "POST",
			});
			if (!uploadResponse.ok) {
				throw new Error("Receipt upload failed.");
			}
			const { storageId } = (await uploadResponse.json()) as {
				storageId: Id<"_storage">;
			};
			const asset = await createAsset({
				fileHash: await sha256Hex(file),
				fileRef: storageId,
				fileSize: file.size,
				mimeType: file.type,
				name:
					file.name.replace(FILE_EXTENSION_SUFFIX_PATTERN, "") ||
					"Payment proof",
				originalFilename: file.name,
				source: "payment_proof_upload",
			});
			await uploadProof({
				amount: Math.round(amountNumber * 100),
				attachmentIds: [asset.assetId],
				currency: "CAD",
				dealId,
				institutionName: optionalText(institutionName),
				referenceNumber: optionalText(referenceNumber),
				sendingParty: sendingParty.trim(),
				transferDate: Date.parse(`${transferDate}T12:00:00.000Z`),
			});
			await queryClient.invalidateQueries();
			setStatus("Payment proof submitted for admin review.");
			setAmount("");
			setInstitutionName("");
			setReferenceNumber("");
			setSendingParty("");
			if (fileRef.current) {
				fileRef.current.value = "";
			}
		} catch (error) {
			setStatus(
				error instanceof Error ? error.message : "Payment proof upload failed."
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
			<div className="flex items-start gap-3">
				<Upload className="mt-1 size-5 text-slate-600" />
				<div>
					<h3 className="font-semibold text-lg">Manual Wire Proof</h3>
					<p className="mt-1 text-slate-600 text-sm leading-6">
						Upload the wire receipt so FairLend can review and record the funds
						on the cash ledger.
					</p>
				</div>
			</div>

			<div className="mt-5 grid gap-3 sm:grid-cols-2">
				<LabeledInput
					label="Amount"
					onChange={setAmount}
					placeholder="1250.00"
					type="number"
					value={amount}
				/>
				<LabeledInput
					label="Transfer Date"
					onChange={setTransferDate}
					type="date"
					value={transferDate}
				/>
				<LabeledInput
					label="Sending Party"
					onChange={setSendingParty}
					placeholder="Lender legal trust"
					value={sendingParty}
				/>
				<LabeledInput
					label="Reference Number"
					onChange={setReferenceNumber}
					placeholder="WIRE-123"
					value={referenceNumber}
				/>
				<LabeledInput
					label="Institution"
					onChange={setInstitutionName}
					placeholder="Bank name"
					value={institutionName}
				/>
				<label className="grid gap-1 text-sm">
					<span className="font-medium text-slate-700">Receipt</span>
					<input
						accept="application/pdf,image/jpeg,image/png,image/webp"
						className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
						ref={fileRef}
						type="file"
					/>
				</label>
			</div>

			<div className="mt-4 flex flex-wrap items-center gap-3">
				<button
					className="rounded-md bg-slate-950 px-3 py-2 font-medium text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-400"
					disabled={submitting}
					onClick={() => void submitProof()}
					type="button"
				>
					{submitting ? "Uploading proof" : "Upload proof"}
				</button>
				{status ? <p className="text-slate-600 text-sm">{status}</p> : null}
			</div>
		</div>
	);
}

function isPaymentProofMimeType(value: string): value is PaymentProofMimeType {
	return ACCEPTED_PAYMENT_PROOF_TYPES.has(value as PaymentProofMimeType);
}

function optionalText(value: string): string | undefined {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

async function sha256Hex(file: File): Promise<string> {
	const hashBuffer = await crypto.subtle.digest(
		"SHA-256",
		await file.arrayBuffer()
	);
	return Array.from(new Uint8Array(hashBuffer))
		.map((value) => value.toString(16).padStart(2, "0"))
		.join("");
}

function LabeledInput({
	label,
	onChange,
	placeholder,
	type = "text",
	value,
}: {
	readonly label: string;
	readonly onChange: (value: string) => void;
	readonly placeholder?: string;
	readonly type?: "date" | "number" | "text";
	readonly value: string;
}) {
	return (
		<label className="grid gap-1 text-sm">
			<span className="font-medium text-slate-700">{label}</span>
			<input
				className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
				onChange={(event) => onChange(event.currentTarget.value)}
				placeholder={placeholder}
				type={type}
				value={value}
			/>
		</label>
	);
}
