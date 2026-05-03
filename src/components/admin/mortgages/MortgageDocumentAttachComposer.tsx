"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { Loader2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import { SUPPORTED_DEAL_DOCUMENT_VARIABLE_KEYS } from "#/lib/document-engine/contracts";
import {
	defaultDocumentAssetName,
	uploadDocumentAsset,
} from "#/lib/documents/uploadDocumentAsset";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { MortgageDocumentMappingOverrides as BackendMortgageDocumentMappingOverrides } from "../../../../convex/documents/contracts";
import {
	MortgageDocumentMappingEditor,
	type MortgageDocumentMappingOverrides,
} from "./MortgageDocumentMappingEditor";

interface MortgageDocumentAttachComposerProps {
	readonly mortgageId: string;
	readonly onOpenChange: (open: boolean) => void;
	readonly open: boolean;
}

type ComposerStep = "type" | "source" | "mappings" | "review";
type ComposerClass =
	| "public_static"
	| "private_templated_non_signable"
	| "private_templated_signable";

interface AttachableTemplate {
	readonly compatibility?: Partial<
		Record<
			Extract<
				ComposerClass,
				"private_templated_non_signable" | "private_templated_signable"
			>,
			{
				readonly compatible: boolean;
				readonly reason?: string;
			}
		>
	>;
	readonly currentPublishedVersion: number | null;
	readonly description: string | null;
	readonly name: string;
	readonly templateId: Id<"documentTemplates">;
}

interface MappingPreview {
	readonly effectiveMappings: MortgageDocumentMappingOverrides;
	readonly templateName: string;
	readonly templateVersion: number;
	readonly validationSummary: {
		readonly containsSignableFields: boolean;
		readonly requiredPlatformRoles: readonly string[];
		readonly requiredVariableKeys: readonly string[];
		readonly unsupportedPlatformRoles: readonly string[];
		readonly unsupportedVariableKeys: readonly string[];
	};
}

const ALLOWED_VARIABLE_KEYS = SUPPORTED_DEAL_DOCUMENT_VARIABLE_KEYS;

const ALLOWED_PLATFORM_ROLES = [
	"borrower_primary",
	"borrower_co_1",
	"borrower_co_2",
	"broker_of_record",
	"assigned_broker",
	"lawyer_primary",
	"lender_primary",
] as const;

const EMPTY_MAPPING_OVERRIDES: MortgageDocumentMappingOverrides = {
	signatories: [],
	variables: [],
};

export function MortgageDocumentAttachComposer({
	mortgageId,
	onOpenChange,
	open,
}: MortgageDocumentAttachComposerProps) {
	const [step, setStep] = useState<ComposerStep>("type");
	const [documentClass, setDocumentClass] =
		useState<ComposerClass>("public_static");
	const [selectedTemplateId, setSelectedTemplateId] = useState("");
	const [mappingOverrides, setMappingOverrides] =
		useState<MortgageDocumentMappingOverrides>(EMPTY_MAPPING_OVERRIDES);
	const [displayName, setDisplayName] = useState("");
	const [description, setDescription] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);
	const backendMappingOverrides =
		mappingOverrides as BackendMortgageDocumentMappingOverrides;

	const templatesResult = useQuery(
		api.documents.mortgageBlueprints.listAttachableTemplates,
		{}
	);
	const mappingPreviewResult = useQuery(
		api.documents.mortgageBlueprints.previewTemplateMappings,
		selectedTemplateId
			? {
					class: documentClass,
					mappingOverrides: backendMappingOverrides,
					templateId: selectedTemplateId as Id<"documentTemplates">,
				}
			: "skip"
	);
	const generateUploadUrl = useMutation(api.documents.assets.generateUploadUrl);
	const extractPdfMetadata = useAction(api.documents.assets.extractPdfMetadata);
	const createAsset = useMutation(api.documents.assets.create);
	const createStaticBlueprint = useMutation(
		api.documents.mortgageBlueprints.createStaticBlueprint
	);
	const attachTemplateVersion = useMutation(
		api.documents.mortgageBlueprints.attachTemplateVersion
	);

	const attachableTemplates = Array.isArray(templatesResult)
		? (templatesResult as AttachableTemplate[])
		: [];
	const isTemplated = documentClass !== "public_static";
	const templateOptions = buildTemplateOptions({
		documentClass,
		templates: attachableTemplates,
	});
	const mappingPreview =
		mappingPreviewResult && !Array.isArray(mappingPreviewResult)
			? (mappingPreviewResult as MappingPreview)
			: null;
	const defaultVariableMappings = useMemo(
		() =>
			buildCanonicalDefaultMappings(
				mappingPreview?.validationSummary.requiredVariableKeys ?? [],
				ALLOWED_VARIABLE_KEYS
			),
		[mappingPreview]
	);
	const defaultSignatoryMappings = useMemo(
		() =>
			buildCanonicalDefaultMappings(
				mappingPreview?.validationSummary.requiredPlatformRoles ?? [],
				ALLOWED_PLATFORM_ROLES
			),
		[mappingPreview]
	);
	const unresolvedVariableKeys =
		mappingPreview?.validationSummary.unsupportedVariableKeys ?? [];
	const unresolvedPlatformRoles =
		mappingPreview?.validationSummary.unsupportedPlatformRoles ?? [];
	const hasUnresolvedMappings =
		isTemplated &&
		(unresolvedVariableKeys.length > 0 || unresolvedPlatformRoles.length > 0);

	function resetComposer() {
		setStep("type");
		setDocumentClass("public_static");
		setSelectedTemplateId("");
		setMappingOverrides({ signatories: [], variables: [] });
		setDisplayName("");
		setDescription("");
		setError(null);
		setSubmitting(false);
		if (fileRef.current) {
			fileRef.current.value = "";
		}
	}

	function handleOpenChange(nextOpen: boolean) {
		if (!nextOpen) {
			resetComposer();
		}
		onOpenChange(nextOpen);
	}

	function handleClassChange(value: string) {
		const nextClass = value as ComposerClass;
		setDocumentClass(nextClass);
		setSelectedTemplateId("");
		setMappingOverrides({ signatories: [], variables: [] });
		setError(null);
		setStep("source");
	}

	async function handleStaticUpload() {
		const file = fileRef.current?.files?.[0];
		if (!file) {
			setError("Choose a PDF to upload.");
			return;
		}

		setSubmitting(true);
		setError(null);
		try {
			const resolvedName = displayName.trim() || defaultDocumentAssetName(file);
			if (!resolvedName) {
				throw new Error("Document name is required.");
			}
			const createdAsset = await uploadDocumentAsset(
				{
					createAsset,
					extractPdfMetadata,
					generateUploadUrl,
				},
				{
					description: description.trim() || undefined,
					file,
					name: resolvedName,
				}
			);
			await createStaticBlueprint({
				assetId: createdAsset.assetId,
				class: "public_static",
				description: description.trim() || undefined,
				displayName: resolvedName,
				mortgageId: mortgageId as Id<"mortgages">,
			});
			handleOpenChange(false);
		} catch (uploadError) {
			setError(normalizeError(uploadError, "Unable to attach static document"));
		} finally {
			setSubmitting(false);
		}
	}

	async function handleTemplateAttach() {
		if (!selectedTemplateId) {
			setError("Choose a template.");
			return;
		}
		if (hasUnresolvedMappings) {
			setError("Resolve all required mappings before attaching this document.");
			return;
		}

		setSubmitting(true);
		setError(null);
		try {
			await attachTemplateVersion({
				class: documentClass,
				description: description.trim() || undefined,
				displayName: displayName.trim() || undefined,
				mappingOverrides: backendMappingOverrides,
				mortgageId: mortgageId as Id<"mortgages">,
				templateId: selectedTemplateId as Id<"documentTemplates">,
			});
			handleOpenChange(false);
		} catch (attachError) {
			setError(normalizeError(attachError, "Unable to attach template"));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Attach mortgage document</DialogTitle>
					<DialogDescription className="sr-only">
						Create a future-only mortgage document blueprint.
					</DialogDescription>
				</DialogHeader>
				<DocumentTypeSection
					documentClass={documentClass}
					onChange={handleClassChange}
				/>
				{step !== "type" ? (
					<section className="space-y-4 border-t pt-4">
						<h3 className="font-medium text-sm">Source</h3>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="mortgage-document-display-name">
									Display name
								</Label>
								<Input
									id="mortgage-document-display-name"
									onChange={(event) => setDisplayName(event.target.value)}
									placeholder={
										isTemplated
											? "Defaults to template name"
											: "Defaults to uploaded file name"
									}
									value={displayName}
								/>
							</div>
							{isTemplated ? (
								<div className="space-y-2">
									<Label>Template</Label>
									<Select
										onValueChange={(value) => {
											setMappingOverrides({ signatories: [], variables: [] });
											setSelectedTemplateId(value);
											setError(null);
											setStep("mappings");
										}}
										value={selectedTemplateId}
									>
										<SelectTrigger aria-label="Template" className="w-full">
											<SelectValue placeholder="Choose a published template" />
										</SelectTrigger>
										<SelectContent className="z-[70]" position="popper">
											{templateOptions.map((template) => (
												<SelectItem
													disabled={!template.compatibilityForClass.compatible}
													key={template.templateId}
													value={template.templateId}
												>
													{template.name}
													{template.currentPublishedVersion
														? ` v${template.currentPublishedVersion}`
														: ""}
													{template.compatibilityForClass.compatible
														? ""
														: ` ${template.compatibilityForClass.reason}`}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							) : (
								<div className="space-y-2">
									<Label htmlFor="mortgage-document-file">PDF upload</Label>
									<Input
										accept="application/pdf"
										id="mortgage-document-file"
										ref={fileRef}
										type="file"
									/>
								</div>
							)}
						</div>
						<div className="space-y-2">
							<Label htmlFor="mortgage-document-description">Description</Label>
							<Textarea
								id="mortgage-document-description"
								onChange={(event) => setDescription(event.target.value)}
								placeholder="Optional operator note"
								value={description}
							/>
						</div>
					</section>
				) : null}
				{isTemplated && mappingPreview ? (
					<section className="space-y-4 border-t pt-4">
						<div>
							<h3 className="font-medium text-sm">Mappings</h3>
							<p className="text-muted-foreground text-sm">
								{mappingPreview.templateName} v{mappingPreview.templateVersion}
							</p>
						</div>
						<MortgageDocumentMappingEditor
							allowedPlatformRoles={ALLOWED_PLATFORM_ROLES}
							allowedVariableKeys={ALLOWED_VARIABLE_KEYS}
							defaultSignatoryMappings={defaultSignatoryMappings}
							defaultVariableMappings={defaultVariableMappings}
							mappingOverrides={mappingOverrides}
							onChange={(nextOverrides) => {
								setMappingOverrides(nextOverrides);
								setStep("mappings");
							}}
							requiredPlatformRoles={
								mappingPreview.validationSummary.requiredPlatformRoles
							}
							requiredVariableKeys={
								mappingPreview.validationSummary.requiredVariableKeys
							}
						/>
						{hasUnresolvedMappings ? (
							<MappingResolutionNotice
								platformRoles={unresolvedPlatformRoles}
								variableKeys={unresolvedVariableKeys}
							/>
						) : null}
					</section>
				) : null}
				{step === "review" ? (
					<section className="space-y-2 border-t pt-4">
						<h3 className="font-medium text-sm">Review</h3>
						<p className="text-muted-foreground text-sm">
							This document blueprint applies to future deal packages only.
						</p>
					</section>
				) : null}
				{error ? <p className="text-destructive text-sm">{error}</p> : null}
				<ComposerFooter
					onContinue={() => setStep("source")}
					onReview={() => setStep("review")}
					onSubmit={isTemplated ? handleTemplateAttach : handleStaticUpload}
					reviewDisabled={hasUnresolvedMappings}
					step={step}
					submitting={submitting}
				/>
			</DialogContent>
		</Dialog>
	);
}

function normalizeError(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

function MappingResolutionNotice({
	platformRoles,
	variableKeys,
}: {
	readonly platformRoles: readonly string[];
	readonly variableKeys: readonly string[];
}) {
	return (
		<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 text-sm">
			<p className="font-medium">
				Resolve all required variable and signatory mappings before review.
			</p>
			{variableKeys.length > 0 ? (
				<p className="mt-1">Unmapped variables: {variableKeys.join(", ")}</p>
			) : null}
			{platformRoles.length > 0 ? (
				<p className="mt-1">
					Unmapped signatory roles: {platformRoles.join(", ")}
				</p>
			) : null}
		</div>
	);
}

function buildCanonicalDefaultMappings(
	requiredKeys: readonly string[],
	allowedKeys: readonly string[]
) {
	return new Map(
		requiredKeys
			.filter((key) => allowedKeys.includes(key))
			.map((key) => [key, key] as const)
	);
}

function buildTemplateOptions({
	documentClass,
	templates,
}: {
	readonly documentClass: ComposerClass;
	readonly templates: readonly AttachableTemplate[];
}) {
	if (documentClass === "public_static") {
		return [];
	}
	return templates.map((template) => ({
		...template,
		compatibilityForClass: template.compatibility?.[documentClass] ?? {
			compatible: true,
		},
	}));
}

function DocumentTypeSection({
	documentClass,
	onChange,
}: {
	readonly documentClass: ComposerClass;
	readonly onChange: (value: string) => void;
}) {
	return (
		<section className="space-y-3">
			<h3 className="font-medium text-sm" id="mortgage-document-type-heading">
				Document type
			</h3>
			<RadioGroup
				aria-labelledby="mortgage-document-type-heading"
				onValueChange={onChange}
				value={documentClass}
			>
				<div className="flex items-start gap-3 rounded-lg border p-3">
					<RadioGroupItem id="public-static" value="public_static" />
					<Label htmlFor="public-static">Public static PDF/doc</Label>
				</div>
				<div className="flex items-start gap-3 rounded-lg border p-3">
					<RadioGroupItem
						id="private-templated"
						value="private_templated_non_signable"
					/>
					<Label htmlFor="private-templated">Private templated read-only</Label>
				</div>
				<div className="flex items-start gap-3 rounded-lg border p-3">
					<RadioGroupItem
						id="private-signable"
						value="private_templated_signable"
					/>
					<Label htmlFor="private-signable">Private signable template</Label>
				</div>
			</RadioGroup>
		</section>
	);
}

function ComposerFooter({
	onContinue,
	onReview,
	onSubmit,
	reviewDisabled,
	step,
	submitting,
}: {
	readonly onContinue: () => void;
	readonly onReview: () => void;
	readonly onSubmit: () => void;
	readonly reviewDisabled: boolean;
	readonly step: ComposerStep;
	readonly submitting: boolean;
}) {
	return (
		<div className="flex flex-wrap justify-end gap-2 border-t pt-4">
			{step === "type" ? (
				<Button onClick={onContinue} type="button">
					Continue
				</Button>
			) : null}
			{step !== "type" && step !== "review" ? (
				<Button
					disabled={reviewDisabled}
					onClick={onReview}
					type="button"
					variant="outline"
				>
					Review
				</Button>
			) : null}
			{step === "review" ? (
				<Button
					disabled={submitting || reviewDisabled}
					onClick={onSubmit}
					type="button"
				>
					{submitting ? (
						<>
							<Loader2 className="mr-2 size-4 animate-spin" />
							Attaching
						</>
					) : (
						<>
							<Upload className="mr-2 size-4" />
							Attach future-only document
						</>
					)}
				</Button>
			) : null}
		</div>
	);
}
