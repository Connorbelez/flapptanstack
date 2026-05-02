import { FolderPlus, Grid2X2, List, Share2, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "#/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { cn } from "#/lib/utils";
import type { FileWorkspaceCapability, FileWorkspaceViewMode } from "./types";

interface UploadControlsProps {
	capabilities: ReadonlySet<FileWorkspaceCapability>;
	className?: string;
	onCreateFolder?: () => void;
	onShare?: () => void;
	onUpload?: () => void;
	onViewModeChange?: (viewMode: FileWorkspaceViewMode) => void;
	viewMode: FileWorkspaceViewMode;
}

function hasCapability(
	capabilities: ReadonlySet<FileWorkspaceCapability>,
	capability: FileWorkspaceCapability
) {
	return capabilities.has(capability);
}

function ToolbarIconButton(props: {
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
					size="icon-sm"
					type="button"
					variant="outline"
				>
					{props.children}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{props.label}</TooltipContent>
		</Tooltip>
	);
}

export function UploadControls({
	capabilities,
	className,
	onCreateFolder,
	onShare,
	onUpload,
	onViewModeChange,
	viewMode,
}: UploadControlsProps) {
	const canUpload = hasCapability(capabilities, "upload_file");
	const canCreateFolder = hasCapability(capabilities, "create_folder");
	const canShare = hasCapability(capabilities, "manage_links");

	return (
		<TooltipProvider>
			<div className={cn("flex flex-wrap items-center gap-2", className)}>
				<Button
					className="min-w-0"
					disabled={!canUpload}
					onClick={onUpload}
					size="sm"
					type="button"
				>
					<Upload />
					<span>Upload</span>
				</Button>
				<ToolbarIconButton
					disabled={!canCreateFolder}
					label="Create folder"
					onClick={onCreateFolder}
				>
					<FolderPlus />
				</ToolbarIconButton>
				<ToolbarIconButton
					disabled={!canShare}
					label="Share settings"
					onClick={onShare}
				>
					<Share2 />
				</ToolbarIconButton>
				<div className="ml-0 flex items-center gap-1 rounded-md border border-(--line) p-1 sm:ml-2">
					<ToolbarIconButton
						label="Table view"
						onClick={() => onViewModeChange?.("table")}
					>
						<Grid2X2
							className={cn(viewMode === "table" && "text-(--lagoon)")}
						/>
					</ToolbarIconButton>
					<ToolbarIconButton
						label="List view"
						onClick={() => onViewModeChange?.("list")}
					>
						<List className={cn(viewMode === "list" && "text-(--lagoon)")} />
					</ToolbarIconButton>
				</div>
			</div>
		</TooltipProvider>
	);
}
