"use client";

import { useAction, useMutation } from "convex/react";
import { FileUp, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import {
	defaultDocumentAssetName,
	uploadDocumentAsset,
} from "#/lib/documents/uploadDocumentAsset";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { VelocityPackageDocumentRole } from "../../../../convex/velocity/constants";
import type { VelocityDocumentLink } from "./types";

const DOCUMENT_ROLE_LABELS = {
	pad_evidence: "PAD evidence",
	property_image: "Property image",
	supporting_document: "Supporting document",
	valuation: "Valuation",
} as const satisfies Record<VelocityPackageDocumentRole, string>;

function formatDateTime(value: number) {
	return new Intl.DateTimeFormat("en-CA", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function activeDocuments(documents: readonly VelocityDocumentLink[]) {
	return documents.filter((document) => document.supersededAt == null);
}

interface VelocityDocumentPanelProps {
	readonly documents: readonly VelocityDocumentLink[];
	readonly workspaceId: Id<"velocityPackageWorkspaces">;
}

export function VelocityDocumentPanel({
	documents,
	workspaceId,
}: VelocityDocumentPanelProps) {
	const [file, setFile] = useState<File | null>(null);
	const [role, setRole] = useState<VelocityPackageDocumentRole>("pad_evidence");
	const [isUploading, setIsUploading] = useState(false);
	const generateUploadUrl = useMutation(api.documents.assets.generateUploadUrl);
	const extractPdfMetadata = useAction(api.documents.assets.extractPdfMetadata);
	const createAsset = useMutation(api.documents.assets.create);
	const linkDocument = useMutation(
		api.velocity.documents.linkVelocityPackageDocument
	);
	const currentDocuments = activeDocuments(documents);

	async function handleUploadAndLink() {
		if (!file) {
			toast.error("Choose a PDF before linking a package document.");
			return;
		}

		setIsUploading(true);
		try {
			const createdAsset = await uploadDocumentAsset(
				{ createAsset, extractPdfMetadata, generateUploadUrl },
				{
					file,
					name: defaultDocumentAssetName(file) || DOCUMENT_ROLE_LABELS[role],
				}
			);
			await linkDocument({
				documentAssetId: createdAsset.assetId,
				role,
				workspaceId,
			});
			setFile(null);
			toast.success(
				createdAsset.duplicate
					? "Existing PDF linked to package."
					: "PDF uploaded and linked to package."
			);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Package document upload failed."
			);
		} finally {
			setIsUploading(false);
		}
	}

	return (
		<section className="space-y-4 rounded-md border border-border/70 p-4">
			<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<div>
					<h2 className="font-semibold text-lg">Package documents</h2>
					<p className="text-muted-foreground text-sm">
						PAD evidence and supporting PDFs link through the shared document
						asset surface.
					</p>
				</div>
				<div className="grid gap-3 md:grid-cols-[11rem_minmax(14rem,1fr)_auto] md:items-end">
					<div className="space-y-2">
						<label className="font-medium text-sm" htmlFor="velocity-doc-role">
							Role
						</label>
						<Select
							onValueChange={(value) =>
								setRole(value as VelocityPackageDocumentRole)
							}
							value={role}
						>
							<SelectTrigger className="w-full" id="velocity-doc-role">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(DOCUMENT_ROLE_LABELS).map(([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<label className="font-medium text-sm" htmlFor="velocity-doc-file">
							PDF
						</label>
						<Input
							accept="application/pdf,.pdf"
							id="velocity-doc-file"
							onChange={(event) => setFile(event.target.files?.[0] ?? null)}
							type="file"
						/>
					</div>
					<Button disabled={isUploading} onClick={handleUploadAndLink}>
						<FileUp className="mr-2 size-4" />
						{isUploading ? "Linking..." : "Upload"}
					</Button>
				</div>
			</div>

			{currentDocuments.length > 0 ? (
				<div className="grid gap-3 md:grid-cols-2">
					{currentDocuments.map((document) => (
						<div
							className="rounded-md border border-border/70 bg-muted/30 p-3"
							key={document.linkId}
						>
							<div className="flex items-start gap-2">
								<LinkIcon className="mt-0.5 size-4 text-muted-foreground" />
								<div className="min-w-0 space-y-1">
									<p className="truncate font-medium text-sm">
										{document.documentAsset?.name ??
											document.documentAsset?.originalFilename ??
											"Linked document"}
									</p>
									<p className="text-muted-foreground text-xs">
										{DOCUMENT_ROLE_LABELS[document.role]} linked{" "}
										{formatDateTime(document.linkedAt)}
									</p>
									{document.documentAsset?.fileHash ? (
										<p className="break-all text-muted-foreground text-xs">
											Hash {document.documentAsset.fileHash}
										</p>
									) : null}
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div className="rounded-md border border-border/70 border-dashed px-4 py-6 text-center text-muted-foreground text-sm">
					No active package documents are linked.
				</div>
			)}
		</section>
	);
}
