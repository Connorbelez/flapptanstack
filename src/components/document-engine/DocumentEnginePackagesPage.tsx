"use client";

import { useMutation, useQuery } from "convex/react";
import {
	FileText,
	FolderOpen,
	PackageOpen,
	Plus,
	ScrollText,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { PackageVariableMatrix } from "#/components/document-engine/PackageVariableMatrix";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type DraftItem =
	| {
			groupVersionId: Id<"documentGroupVersions">;
			kind: "group";
			label?: string;
			order: number;
	  }
	| {
			kind: "standalone_template";
			label?: string;
			order: number;
			templateId: Id<"documentTemplates">;
	  }
	| {
			assetId: Id<"documentAssets">;
			kind: "static_asset";
			label?: string;
			order: number;
	  };

type DraftItemInput =
	| Omit<Extract<DraftItem, { kind: "group" }>, "order">
	| Omit<Extract<DraftItem, { kind: "standalone_template" }>, "order">
	| Omit<Extract<DraftItem, { kind: "static_asset" }>, "order">;

export function DocumentEnginePackagesPage() {
	const packages = useQuery(api.documentEngine.packages.list);
	const groupVersions = useQuery(
		api.documentEngine.templateGroups.listAllVersions
	);
	const templateVersions = useQuery(
		api.documentEngine.templateVersions.listAll
	);
	const assets = useQuery(api.documents.assets.list);
	const createPackage = useMutation(api.documentEngine.packages.create);
	const updateDraft = useMutation(api.documentEngine.packages.updateDraft);
	const publishPackage = useMutation(api.documentEngine.packages.publish);

	const [createOpen, setCreateOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [selectedPackageId, setSelectedPackageId] =
		useState<Id<"documentPackageDefinitions"> | null>(null);

	const selectedPackage =
		packages?.find((definition) => definition._id === selectedPackageId) ??
		packages?.[0] ??
		null;
	const draftItems = (selectedPackage?.draft.items ?? []) as DraftItem[];
	const requiredVariableKeys = useMemo(() => {
		const keys = new Set<string>();
		for (const item of draftItems) {
			if (item.kind === "group") {
				const groupVersion = groupVersions?.find(
					(version) => version._id === item.groupVersionId
				);
				for (const key of groupVersion?.snapshot.requiredVariableKeys ?? []) {
					keys.add(key);
				}
			}
			if (item.kind === "standalone_template") {
				const version = templateVersions?.find(
					(candidate) => candidate.templateId === item.templateId
				);
				for (const field of version?.snapshot.fields ?? []) {
					if (field.type === "interpolable" && field.variableKey) {
						keys.add(field.variableKey);
					}
				}
			}
		}
		return [...keys].sort();
	}, [draftItems, groupVersions, templateVersions]);

	const handleCreate = useCallback(async () => {
		try {
			const packageId = await createPackage({
				description: description.trim() || undefined,
				name: name.trim(),
			});
			setSelectedPackageId(packageId);
			setCreateOpen(false);
			setName("");
			setDescription("");
			toast.success("Package created");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to create package"
			);
		}
	}, [createPackage, description, name]);

	const appendItem = useCallback(
		async (item: DraftItemInput) => {
			if (!selectedPackage) {
				return;
			}
			const nextItem = { ...item, order: draftItems.length } as DraftItem;
			try {
				await updateDraft({
					items: [...draftItems, nextItem],
					packageId: selectedPackage._id,
				});
				toast.success("Package draft updated");
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : "Failed to update package"
				);
			}
		},
		[draftItems, selectedPackage, updateDraft]
	);

	const handlePublish = useCallback(async () => {
		if (!selectedPackage) {
			return;
		}
		try {
			const version = await publishPackage({ packageId: selectedPackage._id });
			toast.success(`Package published v${version.version}`);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to publish package"
			);
		}
	}, [publishPackage, selectedPackage]);

	return (
		<div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between gap-3">
						<div>
							<CardTitle className="text-base">Packages</CardTitle>
							<CardDescription>
								Standards made of envelope groups and standalone documents.
							</CardDescription>
						</div>
						<Dialog onOpenChange={setCreateOpen} open={createOpen}>
							<DialogTrigger asChild>
								<Button size="icon" variant="outline">
									<Plus className="size-4" />
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Create Document Package</DialogTitle>
									<DialogDescription>
										Create a reusable package standard for future deal locks.
									</DialogDescription>
								</DialogHeader>
								<div className="space-y-4">
									<Input
										onChange={(event) => setName(event.target.value)}
										placeholder="Standard Closing Package"
										value={name}
									/>
									<Textarea
										onChange={(event) => setDescription(event.target.value)}
										placeholder="Description"
										value={description}
									/>
									<Button
										className="w-full"
										disabled={!name.trim()}
										onClick={handleCreate}
									>
										Create Package
									</Button>
								</div>
							</DialogContent>
						</Dialog>
					</div>
				</CardHeader>
				<CardContent className="space-y-2">
					{packages?.map((definition) => (
						<button
							className={`w-full rounded-md border p-3 text-left text-sm transition-colors ${
								selectedPackage?._id === definition._id
									? "border-primary bg-primary/5"
									: "hover:bg-muted/50"
							}`}
							key={definition._id}
							onClick={() => setSelectedPackageId(definition._id)}
							type="button"
						>
							<div className="flex items-center justify-between gap-2">
								<span className="font-medium">{definition.name}</span>
								{definition.currentPublishedVersion ? (
									<Badge variant="secondary">
										v{definition.currentPublishedVersion}
									</Badge>
								) : (
									<Badge variant="outline">Draft</Badge>
								)}
							</div>
							<p className="mt-1 text-muted-foreground text-xs">
								{definition.draft.items.length} item
								{definition.draft.items.length === 1 ? "" : "s"}
							</p>
						</button>
					))}
				</CardContent>
			</Card>

			{selectedPackage ? (
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<div className="flex items-start justify-between gap-4">
								<div>
									<CardTitle>{selectedPackage.name}</CardTitle>
									<CardDescription>
										{selectedPackage.description ??
											"Package standard for deal document generation."}
									</CardDescription>
								</div>
								<Button onClick={handlePublish}>
									<PackageOpen className="mr-2 size-4" />
									Publish
								</Button>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid gap-3 md:grid-cols-3">
								<GroupVersionPicker
									groupVersions={groupVersions ?? []}
									onAdd={(groupVersionId) =>
										appendItem({ groupVersionId, kind: "group" })
									}
								/>
								<TemplateVersionPicker
									onAdd={(templateId) =>
										appendItem({ kind: "standalone_template", templateId })
									}
									templateVersions={templateVersions ?? []}
								/>
								<AssetPicker
									assets={assets ?? []}
									onAdd={(assetId) =>
										appendItem({ assetId, kind: "static_asset" })
									}
								/>
							</div>
							<div className="divide-y rounded-md border">
								{draftItems.length === 0 ? (
									<p className="p-4 text-muted-foreground text-sm">
										Add groups, standalone templates, or static assets to build
										this package.
									</p>
								) : (
									draftItems.map((item) => (
										<div
											className="flex items-center gap-3 p-3"
											key={`${item.kind}:${item.order}`}
										>
											<ItemIcon kind={item.kind} />
											<div className="min-w-0 flex-1">
												<p className="font-medium text-sm">
													{describeDraftItem(item, {
														assets: assets ?? [],
														groupVersions: groupVersions ?? [],
														templateVersions: templateVersions ?? [],
													})}
												</p>
												<p className="text-muted-foreground text-xs">
													{item.kind.replaceAll("_", " ")}
												</p>
											</div>
											<Badge variant="outline">#{item.order + 1}</Badge>
										</div>
									))
								)}
							</div>
						</CardContent>
					</Card>
					<PackageVariableMatrix requiredVariableKeys={requiredVariableKeys} />
				</div>
			) : (
				<Card>
					<CardContent className="flex min-h-[320px] flex-col items-center justify-center text-center">
						<PackageOpen className="mb-3 size-10 text-muted-foreground" />
						<p className="font-medium">No package selected</p>
						<p className="text-muted-foreground text-sm">
							Create a package to start building package-wide document
							standards.
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function GroupVersionPicker({
	groupVersions,
	onAdd,
}: {
	groupVersions: Array<{
		_id: Id<"documentGroupVersions">;
		groupName: string;
		version: number;
	}>;
	onAdd: (groupVersionId: Id<"documentGroupVersions">) => void;
}) {
	return (
		<Select
			onValueChange={(value) => onAdd(value as Id<"documentGroupVersions">)}
		>
			<SelectTrigger>
				<SelectValue placeholder="Add group" />
			</SelectTrigger>
			<SelectContent>
				{groupVersions.map((version) => (
					<SelectItem key={version._id} value={version._id}>
						{version.groupName} v{version.version}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function TemplateVersionPicker({
	templateVersions,
	onAdd,
}: {
	onAdd: (templateId: Id<"documentTemplates">) => void;
	templateVersions: Array<{
		templateId: Id<"documentTemplates">;
		templateName: string;
		version: number;
	}>;
}) {
	return (
		<Select onValueChange={(value) => onAdd(value as Id<"documentTemplates">)}>
			<SelectTrigger>
				<SelectValue placeholder="Add standalone" />
			</SelectTrigger>
			<SelectContent>
				{templateVersions.map((version) => (
					<SelectItem
						key={`${version.templateId}:${version.version}`}
						value={version.templateId}
					>
						{version.templateName} v{version.version}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function AssetPicker({
	assets,
	onAdd,
}: {
	assets: Array<{ _id: Id<"documentAssets">; name: string }>;
	onAdd: (assetId: Id<"documentAssets">) => void;
}) {
	return (
		<Select onValueChange={(value) => onAdd(value as Id<"documentAssets">)}>
			<SelectTrigger>
				<SelectValue placeholder="Add static asset" />
			</SelectTrigger>
			<SelectContent>
				{assets.map((asset) => (
					<SelectItem key={asset._id} value={asset._id}>
						{asset.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function ItemIcon({ kind }: { kind: DraftItem["kind"] }) {
	if (kind === "group") {
		return <FolderOpen className="size-4 text-muted-foreground" />;
	}
	if (kind === "standalone_template") {
		return <FileText className="size-4 text-muted-foreground" />;
	}
	return <ScrollText className="size-4 text-muted-foreground" />;
}

function describeDraftItem(
	item: DraftItem,
	lookups: {
		assets: Array<{ _id: Id<"documentAssets">; name: string }>;
		groupVersions: Array<{
			_id: Id<"documentGroupVersions">;
			groupName: string;
			version: number;
		}>;
		templateVersions: Array<{
			templateId: Id<"documentTemplates">;
			templateName: string;
			version: number;
		}>;
	}
) {
	if (item.kind === "group") {
		const version = lookups.groupVersions.find(
			(candidate) => candidate._id === item.groupVersionId
		);
		return version ? `${version.groupName} v${version.version}` : "Group";
	}
	if (item.kind === "standalone_template") {
		const version = lookups.templateVersions.find(
			(candidate) => candidate.templateId === item.templateId
		);
		return version
			? `${version.templateName} v${version.version}`
			: "Standalone document";
	}
	return (
		lookups.assets.find((asset) => asset._id === item.assetId)?.name ??
		"Static asset"
	);
}
