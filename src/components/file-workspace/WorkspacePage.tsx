import {
	ArchiveRestore,
	Download,
	Eye,
	FileIcon,
	Folder,
	MoreHorizontal,
	Search,
	Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import {
	formatFileSize,
	formatFileWorkspaceDate,
	humanizeFileWorkspaceValue,
	scanStateTone,
} from "./display";
import { FileInspector } from "./FileInspector";
import { FileTree, type FileTreeNode } from "./FileTree";
import { ShareSettings } from "./ShareSettings";
import type {
	FileWorkspaceBoxDetail,
	FileWorkspaceCapability,
	FileWorkspaceCommentList,
	FileWorkspaceManagerSettings,
	FileWorkspaceNodeList,
	FileWorkspaceNodeListItem,
	FileWorkspaceTagList,
	FileWorkspaceVersionList,
	FileWorkspaceViewMode,
} from "./types";
import { UploadControls } from "./UploadControls";

interface WorkspacePageProps {
	box: FileWorkspaceBoxDetail;
	capabilities: ReadonlySet<FileWorkspaceCapability>;
	comments?: FileWorkspaceCommentList;
	expandedNodeIds: ReadonlySet<string>;
	managerSettings?: FileWorkspaceManagerSettings | null;
	nodeList: FileWorkspaceNodeList;
	onCreateFolder?: () => void;
	onCreateLink?: () => void;
	onDownload?: (nodeId: string) => void;
	onPreview?: (nodeId: string) => void;
	onRestore?: (nodeId: string) => void;
	onSelectNode?: (nodeId: string) => void;
	onShare?: () => void;
	onTreeExpand?: (nodeId: string, expanded: boolean) => void;
	onUpload?: () => void;
	onViewModeChange?: (viewMode: FileWorkspaceViewMode) => void;
	selectedNodeId?: string;
	tags?: FileWorkspaceTagList;
	versions?: FileWorkspaceVersionList;
	viewMode: FileWorkspaceViewMode;
}

function toTreeNodes(nodeList: FileWorkspaceNodeList): FileTreeNode[] {
	return [
		{
			expanded: true,
			id: nodeList.parentNodeId,
			name: nodeList.breadcrumbs.at(-1)?.displayName ?? "Workspace",
			type: "folder",
		},
		...nodeList.nodes.map((node) => ({
			disabled: node.currentVersion?.scanState === "rejected",
			id: node.nodeId,
			name: node.displayName,
			parentId: nodeList.parentNodeId,
			type: node.nodeType,
		})),
	];
}

function canOpenNode(node: FileWorkspaceNodeListItem) {
	if (node.nodeType === "folder") {
		return true;
	}
	return (
		node.currentVersion?.scanState === "clean" ||
		node.currentVersion?.scanState === "released_by_admin"
	);
}

function NodeActionButton(props: {
	children: ReactNode;
	disabled?: boolean;
	label: string;
	onClick?: () => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					aria-label={props.label}
					disabled={props.disabled}
					onClick={props.onClick}
					size="icon-xs"
					type="button"
					variant="ghost"
				>
					{props.children}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{props.label}</TooltipContent>
		</Tooltip>
	);
}

export function WorkspacePage({
	box,
	capabilities,
	comments,
	expandedNodeIds,
	managerSettings,
	nodeList,
	onCreateFolder,
	onCreateLink,
	onDownload,
	onPreview,
	onRestore,
	onSelectNode,
	onShare,
	onTreeExpand,
	onUpload,
	onViewModeChange,
	selectedNodeId,
	tags,
	versions,
	viewMode,
}: WorkspacePageProps) {
	const selectedNode =
		nodeList.nodes.find((node) => node.nodeId === selectedNodeId) ??
		nodeList.nodes[0];
	const canRestore = capabilities.has("view_trash");

	return (
		<TooltipProvider>
			<main className="flex min-h-0 flex-1 flex-col bg-[var(--surface)] text-(--sea-ink)">
				<header className="shrink-0 border-(--line) border-b bg-[var(--surface-strong)] px-4 py-3">
					<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2 text-(--sea-ink-soft) text-sm">
								{nodeList.breadcrumbs.map((crumb, index) => (
									<span className="min-w-0 truncate" key={crumb.nodeId}>
										{index > 0 ? " / " : null}
										{crumb.displayName}
									</span>
								))}
							</div>
							<h1 className="m-0 mt-1 truncate font-serif text-2xl">
								{box.name}
							</h1>
						</div>
						<UploadControls
							capabilities={capabilities}
							onCreateFolder={onCreateFolder}
							onShare={onShare}
							onUpload={onUpload}
							onViewModeChange={onViewModeChange}
							viewMode={viewMode}
						/>
					</div>
				</header>

				<div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)_22rem]">
					<aside className="min-h-0 overflow-auto border-(--line) border-r bg-[var(--surface-strong)] p-3 max-lg:max-h-80">
						<div className="mb-3 flex items-center gap-2">
							<Search className="size-4 text-(--sea-ink-soft)" />
							<Input aria-label="Search files" placeholder="Search files" />
						</div>
						<FileTree
							expandedNodeIds={expandedNodeIds}
							nodes={toTreeNodes(nodeList)}
							onExpandedChange={(nodeId, expanded) =>
								onTreeExpand?.(nodeId, expanded)
							}
							onSelect={(nodeId) => onSelectNode?.(nodeId)}
							selectedNodeId={selectedNode?.nodeId ?? nodeList.parentNodeId}
						/>
						<Button
							className="mt-4 w-full justify-start"
							disabled={!canRestore}
							type="button"
							variant="ghost"
						>
							<Trash2 />
							<span>Trash</span>
						</Button>
					</aside>

					<section className="min-h-0 overflow-auto bg-[var(--surface)]">
						<div className="min-w-[680px]">
							<div className="grid grid-cols-[minmax(18rem,1fr)_8rem_9rem_8rem_7rem] gap-3 border-(--line) border-b px-4 py-2 font-semibold text-(--sea-ink-soft) text-xs uppercase tracking-[0.1em]">
								<span>Name</span>
								<span>Size</span>
								<span>Scan</span>
								<span>Updated</span>
								<span className="text-right">Actions</span>
							</div>
							{nodeList.nodes.map((node) => {
								const openAllowed = canOpenNode(node);
								return (
									<div
										className="grid min-h-14 grid-cols-[minmax(18rem,1fr)_8rem_9rem_8rem_7rem] items-center gap-3 border-(--line) border-b px-4 py-2 text-sm"
										key={node.nodeId}
									>
										<button
											className="flex min-w-0 items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--lagoon)_55%,transparent)]"
											onClick={() => onSelectNode?.(node.nodeId)}
											type="button"
										>
											{node.nodeType === "folder" ? (
												<Folder className="size-4 shrink-0 text-(--sea-ink-soft)" />
											) : (
												<FileIcon className="size-4 shrink-0 text-(--sea-ink-soft)" />
											)}
											<span className="min-w-0 truncate">
												{node.displayName}
											</span>
										</button>
										<span className="text-(--sea-ink-soft)">
											{formatFileSize(node.currentVersion?.sizeBytes)}
										</span>
										<Badge
											className={scanStateTone(node.currentVersion?.scanState)}
											variant="outline"
										>
											{node.currentVersion?.scanState
												? humanizeFileWorkspaceValue(
														node.currentVersion.scanState
													)
												: "Folder"}
										</Badge>
										<span className="text-(--sea-ink-soft)">
											{formatFileWorkspaceDate(node.updatedAt)}
										</span>
										<div className="flex justify-end gap-1">
											<NodeActionButton
												disabled={!openAllowed}
												label="Preview"
												onClick={() => onPreview?.(node.nodeId)}
											>
												<Eye />
											</NodeActionButton>
											<NodeActionButton
												disabled={!openAllowed || node.nodeType === "folder"}
												label="Download"
												onClick={() => onDownload?.(node.nodeId)}
											>
												<Download />
											</NodeActionButton>
											<NodeActionButton
												disabled={!canRestore}
												label="Restore"
												onClick={() => onRestore?.(node.nodeId)}
											>
												<ArchiveRestore />
											</NodeActionButton>
											<NodeActionButton label="More actions">
												<MoreHorizontal />
											</NodeActionButton>
										</div>
									</div>
								);
							})}
							{nodeList.nodes.length === 0 ? (
								<div className="flex min-h-72 items-center justify-center border-(--line) border-b p-8 text-center text-(--sea-ink-soft)">
									This folder is empty.
								</div>
							) : null}
						</div>
					</section>

					<FileInspector
						box={box}
						comments={comments}
						managerSettings={managerSettings}
						selectedNode={selectedNode}
						tags={tags}
						versions={versions}
					/>
				</div>

				{managerSettings ? (
					<ShareSettings
						onCreateLink={onCreateLink}
						settings={managerSettings}
					/>
				) : null}
			</main>
		</TooltipProvider>
	);
}
