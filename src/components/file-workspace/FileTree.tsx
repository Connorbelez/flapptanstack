import {
	ChevronDown,
	ChevronRight,
	FileIcon,
	Folder,
	FolderOpen,
	Loader2,
	Trash2,
} from "lucide-react";
import type { KeyboardEvent } from "react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

export interface FileTreeNode {
	disabled?: boolean;
	dragTarget?: boolean;
	expanded?: boolean;
	id: string;
	loading?: boolean;
	name: string;
	parentId?: string;
	trashed?: boolean;
	type: "file" | "folder";
}

export interface FileTreeProps {
	"aria-label"?: string;
	className?: string;
	expandedNodeIds: ReadonlySet<string>;
	loading?: boolean;
	nodes: readonly FileTreeNode[];
	onExpandedChange: (nodeId: string, expanded: boolean) => void;
	onSelect: (nodeId: string) => void;
	selectedNodeId?: string;
}

interface VisibleTreeNode {
	depth: number;
	node: FileTreeNode;
}

function getVisibleNodes(
	nodes: readonly FileTreeNode[],
	expandedNodeIds: ReadonlySet<string>
): VisibleTreeNode[] {
	const byParent = new Map<string | undefined, FileTreeNode[]>();
	for (const node of nodes) {
		const siblings = byParent.get(node.parentId) ?? [];
		siblings.push(node);
		byParent.set(node.parentId, siblings);
	}

	const visible: VisibleTreeNode[] = [];
	const visit = (parentId: string | undefined, depth: number) => {
		for (const node of byParent.get(parentId) ?? []) {
			visible.push({ depth, node });
			if (node.type === "folder" && expandedNodeIds.has(node.id)) {
				visit(node.id, depth + 1);
			}
		}
	};
	visit(undefined, 0);
	return visible;
}

function findParentIndex(
	visibleNodes: readonly VisibleTreeNode[],
	node: FileTreeNode
) {
	if (!node.parentId) {
		return -1;
	}
	return visibleNodes.findIndex((entry) => entry.node.id === node.parentId);
}

function focusTreeButton(event: KeyboardEvent<HTMLElement>, index: number) {
	const tree = event.currentTarget.closest('[role="tree"]');
	if (!tree) {
		return;
	}
	const buttons = Array.from(
		tree.querySelectorAll<HTMLButtonElement>("[data-file-tree-node-button]")
	);
	const nextIndex = Math.min(Math.max(index, 0), buttons.length - 1);
	buttons[nextIndex]?.focus();
}

function getFolderIcon(isExpanded: boolean) {
	return isExpanded ? FolderOpen : Folder;
}

function getNodeIcon(node: FileTreeNode, isExpanded: boolean) {
	if (node.loading) {
		return <Loader2 className="animate-spin" />;
	}
	if (node.trashed) {
		return <Trash2 />;
	}
	const Icon = node.type === "folder" ? getFolderIcon(isExpanded) : FileIcon;
	return <Icon />;
}

function handleTreeNodeNavigation(args: {
	event: KeyboardEvent<HTMLButtonElement>;
	index: number;
	isExpanded: boolean;
	isFolder: boolean;
	node: FileTreeNode;
	onExpandedChange: (nodeId: string, expanded: boolean) => void;
	visibleNodes: readonly VisibleTreeNode[];
}) {
	switch (args.event.key) {
		case "ArrowDown":
			args.event.preventDefault();
			focusTreeButton(args.event, args.index + 1);
			return true;
		case "ArrowUp":
			args.event.preventDefault();
			focusTreeButton(args.event, args.index - 1);
			return true;
		case "ArrowRight":
			if (args.isFolder) {
				args.event.preventDefault();
				if (!args.isExpanded) {
					args.onExpandedChange(args.node.id, true);
				}
				return true;
			}
			return false;
		case "ArrowLeft":
			args.event.preventDefault();
			if (args.isFolder && args.isExpanded) {
				args.onExpandedChange(args.node.id, false);
				return true;
			}
			focusTreeButton(
				args.event,
				findParentIndex(args.visibleNodes, args.node)
			);
			return true;
		default:
			return false;
	}
}

function handleTreeNodeActivation(args: {
	event: KeyboardEvent<HTMLButtonElement>;
	node: FileTreeNode;
	onSelect: (nodeId: string) => void;
}) {
	if (args.event.key !== "Enter" && args.event.key !== " ") {
		return;
	}
	args.event.preventDefault();
	if (!args.node.disabled) {
		args.onSelect(args.node.id);
	}
}

interface FileTreeRowProps {
	depth: number;
	expandedNodeIds: ReadonlySet<string>;
	index: number;
	node: FileTreeNode;
	onExpandedChange: (nodeId: string, expanded: boolean) => void;
	onSelect: (nodeId: string) => void;
	selectedNodeId?: string;
	visibleNodes: readonly VisibleTreeNode[];
}

function FileTreeRow({
	depth,
	expandedNodeIds,
	index,
	node,
	onExpandedChange,
	onSelect,
	selectedNodeId,
	visibleNodes,
}: FileTreeRowProps) {
	const isFolder = node.type === "folder";
	const isExpanded = expandedNodeIds.has(node.id);
	const isSelected = selectedNodeId === node.id;

	return (
		<div
			aria-disabled={node.disabled || undefined}
			aria-expanded={isFolder ? isExpanded : undefined}
			aria-level={depth + 1}
			aria-selected={isSelected}
			className={cn(
				"group flex h-11 min-w-0 items-center gap-1 rounded-md border border-transparent text-(--sea-ink) transition",
				isSelected &&
					"border-[color-mix(in_oklab,var(--lagoon)_45%,var(--line))] bg-[color-mix(in_oklab,var(--lagoon)_12%,transparent)]",
				node.dragTarget &&
					"border-[color-mix(in_oklab,var(--palm)_70%,var(--line))] border-dashed bg-[color-mix(in_oklab,var(--palm)_10%,transparent)]",
				node.trashed && "text-[var(--sea-ink-soft)] opacity-75",
				node.disabled && "cursor-not-allowed opacity-55"
			)}
			key={node.id}
			role="treeitem"
			style={{ paddingLeft: `${0.25 + depth * 1.25}rem` }}
			tabIndex={-1}
		>
			<Button
				aria-label={
					isFolder
						? `${isExpanded ? "Collapse" : "Expand"} ${node.name}`
						: `${node.name} has no child folders`
				}
				className={cn(
					"size-8 shrink-0 text-(--sea-ink-soft)",
					!isFolder && "invisible"
				)}
				disabled={!isFolder || node.disabled}
				onClick={() => onExpandedChange(node.id, !isExpanded)}
				size="icon-sm"
				type="button"
				variant="ghost"
			>
				{isExpanded ? <ChevronDown /> : <ChevronRight />}
			</Button>
			<button
				aria-current={isSelected ? "page" : undefined}
				className={cn(
					"flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--lagoon)_55%,transparent)]",
					node.disabled
						? "cursor-not-allowed"
						: "hover:bg-[color-mix(in_oklab,var(--line)_38%,transparent)]"
				)}
				data-file-tree-node-button=""
				onClick={() => {
					if (!node.disabled) {
						onSelect(node.id);
					}
				}}
				onKeyDown={(event) => {
					if (
						handleTreeNodeNavigation({
							event,
							index,
							isExpanded,
							isFolder,
							node,
							onExpandedChange,
							visibleNodes,
						})
					) {
						return;
					}
					handleTreeNodeActivation({ event, node, onSelect });
				}}
				tabIndex={0}
				type="button"
			>
				<span className="flex size-5 shrink-0 items-center justify-center text-(--sea-ink-soft)">
					{getNodeIcon(node, isExpanded)}
				</span>
				<span className="min-w-0 flex-1 truncate" title={node.name}>
					{node.name}
				</span>
			</button>
		</div>
	);
}

export function FileTree({
	"aria-label": ariaLabel = "Files",
	className,
	expandedNodeIds,
	loading = false,
	nodes,
	onExpandedChange,
	onSelect,
	selectedNodeId,
}: FileTreeProps) {
	const visibleNodes = getVisibleNodes(nodes, expandedNodeIds);

	if (loading) {
		return (
			<div
				aria-label={ariaLabel}
				className={cn("space-y-2", className)}
				role="tree"
			>
				{Array.from({ length: 5 }).map((_, index) => (
					<div
						className="h-9 rounded-md bg-[color-mix(in_oklab,var(--line)_45%,transparent)]"
						key={`tree-skeleton-${index.toString()}`}
						style={{ marginLeft: `${Math.min(index, 2) * 1.25}rem` }}
					/>
				))}
			</div>
		);
	}

	return (
		<div
			aria-label={ariaLabel}
			className={cn("select-none space-y-1", className)}
			role="tree"
		>
			{visibleNodes.map(({ depth, node }, index) => (
				<FileTreeRow
					depth={depth}
					expandedNodeIds={expandedNodeIds}
					index={index}
					key={node.id}
					node={node}
					onExpandedChange={onExpandedChange}
					onSelect={onSelect}
					selectedNodeId={selectedNodeId}
					visibleNodes={visibleNodes}
				/>
			))}
		</div>
	);
}
