import { FileUpIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	defaultDocumentAssetName,
	uploadDocumentAsset,
} from "#/lib/documents/uploadDocumentAsset";
import type { Id } from "../../../../../convex/_generated/dataModel";

interface ScheduleReplacementPadUploadProps {
	createAsset: Parameters<typeof uploadDocumentAsset>[0]["createAsset"];
	extractPdfMetadata: Parameters<
		typeof uploadDocumentAsset
	>[0]["extractPdfMetadata"];
	generateUploadUrl: Parameters<
		typeof uploadDocumentAsset
	>[0]["generateUploadUrl"];
	onUploaded: (assetId: Id<"documentAssets">) => void;
}

export function ScheduleReplacementPadUpload({
	createAsset,
	extractPdfMetadata,
	generateUploadUrl,
	onUploaded,
}: ScheduleReplacementPadUploadProps) {
	const [file, setFile] = useState<File | null>(null);
	const [isUploading, setIsUploading] = useState(false);

	async function handleUpload() {
		if (!file) {
			return;
		}
		setIsUploading(true);
		try {
			const result = await uploadDocumentAsset(
				{ createAsset, extractPdfMetadata, generateUploadUrl },
				{
					description: "Replacement payment schedule PAD authorization",
					file,
					name:
						defaultDocumentAssetName(file) || "Replacement PAD authorization",
				}
			);
			onUploaded(result.assetId);
		} finally {
			setIsUploading(false);
		}
	}

	return (
		<div className="space-y-3 rounded-md border p-3">
			<div className="space-y-1">
				<Label htmlFor="replacement-pad-upload">New PAD approval</Label>
				<p className="text-muted-foreground text-sm">
					Rotessa replacements require a newly uploaded signed PAD PDF.
				</p>
			</div>
			<div className="flex flex-col gap-2 sm:flex-row">
				<Input
					accept="application/pdf"
					id="replacement-pad-upload"
					onChange={(event) => setFile(event.target.files?.[0] ?? null)}
					type="file"
				/>
				<Button
					disabled={!file || isUploading}
					onClick={handleUpload}
					type="button"
				>
					<FileUpIcon className="size-4" />
					{isUploading ? "Uploading" : "Upload"}
				</Button>
			</div>
		</div>
	);
}
