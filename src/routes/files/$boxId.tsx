import {
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	fileWorkspaceBoxQueryOptions,
	fileWorkspaceCapabilitiesQueryOptions,
	fileWorkspaceCommentsQueryOptions,
	fileWorkspaceManagerSettingsQueryOptions,
	fileWorkspaceNodesQueryOptions,
	fileWorkspaceTagsQueryOptions,
	fileWorkspaceVersionsQueryOptions,
} from "#/components/file-workspace/query-options";
import type { FileWorkspaceViewMode } from "#/components/file-workspace/types";
import { WorkspacePage } from "#/components/file-workspace/WorkspacePage";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/files/$boxId")({
	component: FileWorkspaceBoxRoutePage,
	loader: async ({ context, params }) => {
		const box = await context.queryClient.ensureQueryData(
			fileWorkspaceBoxQueryOptions(params.boxId as Id<"fileBoxes">)
		);
		await context.queryClient.ensureQueryData(
			fileWorkspaceCapabilitiesQueryOptions(params.boxId as Id<"fileBoxes">)
		);
		if (box.rootNodeId) {
			await context.queryClient.ensureQueryData(
				fileWorkspaceNodesQueryOptions(
					params.boxId as Id<"fileBoxes">,
					box.rootNodeId
				)
			);
		}
	},
});

export function FileWorkspaceBoxRoutePage() {
	const { boxId } = Route.useParams();
	const boxIdValue = boxId as Id<"fileBoxes">;
	const queryClient = useQueryClient();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [expandedNodeIds, setExpandedNodeIds] = useState<ReadonlySet<string>>(
		() => new Set()
	);
	const [parentNodeId, setParentNodeId] = useState<Id<"fileNodes"> | null>(
		null
	);
	const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
	const [viewMode, setViewMode] = useState<FileWorkspaceViewMode>("table");
	const createFolder = useMutation(api.fileWorkspace.nodes.createFolder);
	const restoreNode = useMutation(api.fileWorkspace.nodes.restoreNode);
	const requestUpload = useMutation(api.fileWorkspace.uploads.requestUpload);
	const finalizeUpload = useMutation(api.fileWorkspace.uploads.finalizeUpload);
	const createShareLink = useMutation(
		api.fileWorkspace.shareLinks.createShareLink
	);
	const getPreviewUrl = useMutation(api.fileWorkspace.versions.getPreviewUrl);
	const getDownloadUrl = useMutation(api.fileWorkspace.versions.getDownloadUrl);
	const { data: box } = useSuspenseQuery(
		fileWorkspaceBoxQueryOptions(boxIdValue)
	);
	const { data: capabilities } = useSuspenseQuery(
		fileWorkspaceCapabilitiesQueryOptions(boxIdValue)
	);
	const effectiveParentNodeId = (parentNodeId ??
		box.rootNodeId) as Id<"fileNodes">;
	const { data: nodeList } = useSuspenseQuery(
		fileWorkspaceNodesQueryOptions(boxIdValue, effectiveParentNodeId)
	);
	const capabilitySet = useMemo(
		() => new Set(capabilities.capabilities),
		[capabilities.capabilities]
	);
	const selectedNode =
		nodeList.nodes.find((node) => node.nodeId === selectedNodeId) ??
		nodeList.nodes[0];
	const selectedFileNodeId =
		selectedNode?.nodeType === "file"
			? (selectedNode.nodeId as Id<"fileNodes">)
			: (nodeList.parentNodeId as Id<"fileNodes">);
	const selectedFileQueryEnabled = selectedNode?.nodeType === "file";
	const { data: managerSettings } = useQuery({
		...fileWorkspaceManagerSettingsQueryOptions(boxIdValue),
		enabled: capabilitySet.has("manage_box_settings"),
	});
	const { data: comments } = useQuery({
		...fileWorkspaceCommentsQueryOptions(boxIdValue, selectedFileNodeId),
		enabled: selectedFileQueryEnabled && capabilitySet.has("view_comments"),
	});
	const { data: tags } = useQuery({
		...fileWorkspaceTagsQueryOptions(boxIdValue),
		enabled: capabilitySet.has("tag_node"),
	});
	const { data: versions } = useQuery({
		...fileWorkspaceVersionsQueryOptions(boxIdValue, selectedFileNodeId),
		enabled: selectedFileQueryEnabled && capabilitySet.has("view_versions"),
	});

	useEffect(() => {
		setExpandedNodeIds((current) => {
			const next = new Set(current);
			next.add(nodeList.parentNodeId);
			return next;
		});
		setSelectedNodeId((current) =>
			current && nodeList.nodes.some((node) => node.nodeId === current)
				? current
				: nodeList.nodes[0]?.nodeId
		);
	}, [nodeList]);

	async function invalidateFileWorkspaceQueries() {
		await queryClient.invalidateQueries();
	}

	function openStorageUrl(result: { denied?: true; url?: string | null }) {
		if (result.denied || !result.url) {
			return;
		}
		window.open(result.url, "_blank", "noopener,noreferrer");
	}

	function handleSelectNode(nodeId: string) {
		setSelectedNodeId(nodeId);
		const node = nodeList.nodes.find(
			(candidate) => candidate.nodeId === nodeId
		);
		if (node?.nodeType === "folder") {
			const folderId = node.nodeId as Id<"fileNodes">;
			setParentNodeId(folderId);
			setExpandedNodeIds((current) => new Set(current).add(folderId));
		}
	}

	async function handleCreateFolder() {
		await createFolder({
			boxId: boxIdValue,
			name: "New folder",
			parentNodeId: nodeList.parentNodeId as Id<"fileNodes">,
		});
		await invalidateFileWorkspaceQueries();
	}

	async function handleCreateLink() {
		const created = await createShareLink({
			boxId: boxIdValue,
			downloadEnabled: false,
			linkKind: "public_link",
		});
		const publicUrl = `${window.location.origin}/files/public/${created.rawToken}`;
		await invalidateFileWorkspaceQueries();
		try {
			await navigator.clipboard.writeText(publicUrl);
		} catch {
			// Clipboard is opportunistic; the new link is still visible in settings.
		}
	}

	async function handlePreview(nodeId: string) {
		openStorageUrl(
			await getPreviewUrl({
				boxId: boxIdValue,
				nodeId: nodeId as Id<"fileNodes">,
			})
		);
	}

	async function handleDownload(nodeId: string) {
		openStorageUrl(
			await getDownloadUrl({
				boxId: boxIdValue,
				nodeId: nodeId as Id<"fileNodes">,
			})
		);
	}

	async function handleRestore(nodeId: string) {
		await restoreNode({
			boxId: boxIdValue,
			nodeId: nodeId as Id<"fileNodes">,
		});
		await invalidateFileWorkspaceQueries();
	}

	async function handleUploadFile(file: File) {
		const declaredFile = {
			contentType: file.type || undefined,
			name: file.name,
			sizeBytes: file.size,
		};
		const request = await requestUpload({
			boxId: boxIdValue,
			declaredFile,
			parentNodeId: nodeList.parentNodeId as Id<"fileNodes">,
		});
		const response = await fetch(request.uploadUrl, {
			body: file,
			headers: { "Content-Type": file.type || "application/octet-stream" },
			method: "POST",
		});
		if (!response.ok) {
			throw new Error("Upload failed.");
		}
		const uploaded = (await response.json()) as { storageId: string };
		await finalizeUpload({
			boxId: boxIdValue,
			declaredFile,
			parentNodeId: nodeList.parentNodeId as Id<"fileNodes">,
			storageId: uploaded.storageId as Id<"_storage">,
		});
		await invalidateFileWorkspaceQueries();
	}

	return (
		<>
			<WorkspacePage
				box={box}
				capabilities={capabilitySet}
				comments={comments}
				expandedNodeIds={expandedNodeIds}
				managerSettings={managerSettings}
				nodeList={nodeList}
				onCreateFolder={handleCreateFolder}
				onCreateLink={handleCreateLink}
				onDownload={handleDownload}
				onPreview={handlePreview}
				onRestore={handleRestore}
				onSelectNode={handleSelectNode}
				onShare={handleCreateLink}
				onTreeExpand={(nodeId, expanded) =>
					setExpandedNodeIds((current) => {
						const next = new Set(current);
						if (expanded) {
							next.add(nodeId);
						} else {
							next.delete(nodeId);
						}
						return next;
					})
				}
				onUpload={() => fileInputRef.current?.click()}
				onViewModeChange={setViewMode}
				selectedNodeId={selectedNode?.nodeId}
				tags={tags}
				versions={versions}
				viewMode={viewMode}
			/>
			<input
				aria-label="Upload file to workspace"
				className="sr-only"
				onChange={(event) => {
					const file = event.currentTarget.files?.[0];
					event.currentTarget.value = "";
					if (file) {
						void handleUploadFile(file);
					}
				}}
				ref={fileInputRef}
				type="file"
			/>
		</>
	);
}
