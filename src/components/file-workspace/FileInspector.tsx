import {
	Activity,
	FileText,
	Link2,
	MessageSquare,
	ShieldCheck,
	Tags,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Badge } from "#/components/ui/badge";
import { Separator } from "#/components/ui/separator";
import { cn } from "#/lib/utils";
import {
	formatFileSize,
	formatFileWorkspaceDate,
	humanizeFileWorkspaceValue,
	scanStateTone,
} from "./display";
import type {
	FileWorkspaceBoxDetail,
	FileWorkspaceCommentList,
	FileWorkspaceManagerSettings,
	FileWorkspaceNodeListItem,
	FileWorkspaceTagList,
	FileWorkspaceVersionList,
} from "./types";

interface FileInspectorProps {
	box: FileWorkspaceBoxDetail;
	className?: string;
	comments?: FileWorkspaceCommentList;
	managerSettings?: FileWorkspaceManagerSettings | null;
	selectedNode?: FileWorkspaceNodeListItem;
	tags?: FileWorkspaceTagList;
	versions?: FileWorkspaceVersionList;
}

function InspectorSection(props: {
	children: ReactNode;
	icon: ComponentType<{ className?: string }>;
	title: string;
}) {
	const Icon = props.icon;
	return (
		<section className="py-4">
			<div className="mb-3 flex items-center gap-2 font-semibold text-(--sea-ink) text-sm">
				<Icon className="size-4 text-(--sea-ink-soft)" />
				<span>{props.title}</span>
			</div>
			{props.children}
		</section>
	);
}

export function FileInspector({
	box,
	className,
	comments = [],
	managerSettings,
	selectedNode,
	tags = [],
	versions = [],
}: FileInspectorProps) {
	const currentVersion = selectedNode?.currentVersion;

	return (
		<aside
			className={cn(
				"min-h-0 overflow-auto border-(--line) border-l bg-[var(--surface-strong)] px-4",
				className
			)}
		>
			<header className="sticky top-0 z-10 border-(--line) border-b bg-[var(--surface-strong)] py-4">
				<p className="m-0 font-semibold text-(--sea-ink-soft) text-xs uppercase tracking-[0.12em]">
					Inspector
				</p>
				<h2 className="m-0 mt-1 truncate font-semibold text-(--sea-ink)">
					{selectedNode?.displayName ?? box.name}
				</h2>
			</header>

			<InspectorSection icon={FileText} title="Details">
				<dl className="grid gap-2 text-sm">
					<div className="flex justify-between gap-3">
						<dt className="text-(--sea-ink-soft)">Type</dt>
						<dd className="m-0 font-medium">
							{selectedNode
								? humanizeFileWorkspaceValue(selectedNode.nodeType)
								: "Box"}
						</dd>
					</div>
					<div className="flex justify-between gap-3">
						<dt className="text-(--sea-ink-soft)">Size</dt>
						<dd className="m-0 font-medium">
							{formatFileSize(currentVersion?.sizeBytes)}
						</dd>
					</div>
					<div className="flex justify-between gap-3">
						<dt className="text-(--sea-ink-soft)">Updated</dt>
						<dd className="m-0 text-right font-medium">
							{formatFileWorkspaceDate(
								selectedNode?.updatedAt ?? box.updatedAt
							)}
						</dd>
					</div>
				</dl>
			</InspectorSection>
			<Separator />
			<InspectorSection icon={ShieldCheck} title="Access and scan">
				<div className="flex flex-wrap gap-2">
					<Badge variant="outline">
						{humanizeFileWorkspaceValue(box.role)}
					</Badge>
					<Badge variant="outline">
						{humanizeFileWorkspaceValue(box.visibility)}
					</Badge>
					<Badge
						className={scanStateTone(currentVersion?.scanState)}
						variant="outline"
					>
						{currentVersion?.scanState
							? humanizeFileWorkspaceValue(currentVersion.scanState)
							: "No scan state"}
					</Badge>
					{box.status === "archived" ? (
						<Badge variant="outline">Retention active</Badge>
					) : null}
				</div>
			</InspectorSection>
			<Separator />
			<InspectorSection icon={MessageSquare} title="Comments">
				<div className="space-y-3">
					{comments.slice(0, 3).map((comment) => (
						<div
							className="border-(--line) border-l-2 pl-3"
							key={comment.commentId}
						>
							<p className="m-0 text-(--sea-ink) text-sm">{comment.body}</p>
							<p className="m-0 mt-1 text-(--sea-ink-soft) text-xs">
								{formatFileWorkspaceDate(comment.updatedAt)}
							</p>
						</div>
					))}
					{comments.length === 0 ? (
						<p className="m-0 text-(--sea-ink-soft) text-sm">
							No comments on this file.
						</p>
					) : null}
				</div>
			</InspectorSection>
			<Separator />
			<InspectorSection icon={Tags} title="Versions and tags">
				<div className="space-y-3 text-sm">
					<div className="flex flex-wrap gap-2">
						{tags.length > 0 ? (
							tags.map((tag) => (
								<Badge key={tag.tagId} variant="secondary">
									{tag.name}
								</Badge>
							))
						) : (
							<span className="text-(--sea-ink-soft)">No tags</span>
						)}
					</div>
					<div className="space-y-2">
						{versions.slice(0, 4).map((version) => (
							<div
								className="flex items-center justify-between gap-3"
								key={version.versionId}
							>
								<span>v{version.versionNumber}</span>
								<Badge
									className={scanStateTone(version.scanState)}
									variant="outline"
								>
									{humanizeFileWorkspaceValue(version.scanState)}
								</Badge>
							</div>
						))}
						{versions.length === 0 ? (
							<span className="text-(--sea-ink-soft)">No versions loaded</span>
						) : null}
					</div>
				</div>
			</InspectorSection>
			<Separator />
			<InspectorSection icon={Link2} title="Link state">
				<p className="m-0 text-(--sea-ink-soft) text-sm">
					{managerSettings
						? `${managerSettings.links.length} links configured`
						: "Manager link details unavailable for this role."}
				</p>
			</InspectorSection>
			<Separator />
			<InspectorSection icon={Activity} title="Activity">
				<p className="m-0 text-(--sea-ink-soft) text-sm">
					Latest workspace activity updates as the backend read model changes.
				</p>
			</InspectorSection>
		</aside>
	);
}
