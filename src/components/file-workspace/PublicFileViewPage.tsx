import { Download, Eye, FileIcon, Folder, ShieldAlert } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	formatFileSize,
	humanizeFileWorkspaceValue,
	scanStateTone,
} from "./display";
import type {
	FileWorkspacePublicLink,
	FileWorkspacePublicNodeList,
} from "./types";

export type PublicFileViewState =
	| { kind: "loading" }
	| { kind: "inaccessible"; message?: string }
	| {
			kind: "ready";
			link: FileWorkspacePublicLink;
			nodeList: FileWorkspacePublicNodeList;
	  };

interface PublicFileViewPageProps {
	onDownload?: (nodeId: string) => void;
	onOpenFolder?: (nodeId: string) => void;
	onPreview?: (nodeId: string) => void;
	state: PublicFileViewState;
}

function PublicInaccessibleState({ message }: { message?: string }) {
	return (
		<div className="mx-auto flex min-h-[60dvh] max-w-2xl flex-col items-center justify-center text-center">
			<div className="mb-4 flex size-12 items-center justify-center rounded-full border border-(--line) bg-[var(--surface-strong)] text-(--sea-ink-soft)">
				<ShieldAlert className="size-5" />
			</div>
			<h1 className="m-0 font-serif text-(--sea-ink) text-3xl">
				This file share is unavailable
			</h1>
			<p className="mt-3 max-w-md text-(--sea-ink-soft) text-sm">
				{message ??
					"The link may be expired, revoked, malformed, or no longer available."}
			</p>
		</div>
	);
}

export function PublicFileViewPage({
	onDownload,
	onOpenFolder,
	onPreview,
	state,
}: PublicFileViewPageProps) {
	if (state.kind === "loading") {
		return (
			<main className="min-h-dvh bg-[var(--surface)] px-4 py-8">
				<section className="mx-auto max-w-5xl border border-(--line) bg-[var(--surface-strong)] p-6">
					<p className="m-0 font-semibold text-(--sea-ink-soft) text-xs uppercase tracking-[0.14em]">
						FairLend File Share
					</p>
					<div className="mt-6 grid gap-3">
						<div className="h-8 max-w-xs rounded-md bg-[color-mix(in_oklab,var(--line)_45%,transparent)]" />
						<div className="h-14 rounded-md bg-[color-mix(in_oklab,var(--line)_35%,transparent)]" />
						<div className="h-14 rounded-md bg-[color-mix(in_oklab,var(--line)_35%,transparent)]" />
					</div>
				</section>
			</main>
		);
	}

	if (state.kind === "inaccessible") {
		return (
			<main className="min-h-dvh bg-[var(--surface)] px-4 py-8">
				<PublicInaccessibleState message={state.message} />
			</main>
		);
	}

	const { link, nodeList } = state;
	const downloadAllowed = link.downloadEnabled;

	return (
		<main className="min-h-dvh bg-[var(--surface)] px-4 py-6 sm:px-6 lg:px-8">
			<section className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-6xl flex-col border border-(--line) bg-[var(--surface-strong)]">
				<header className="border-(--line) border-b px-4 py-4 sm:px-6">
					<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
						<div>
							<p className="m-0 font-semibold text-(--sea-ink-soft) text-xs uppercase tracking-[0.14em]">
								FairLend File Share
							</p>
							<h1 className="m-0 mt-1 font-serif text-(--sea-ink) text-3xl">
								Shared files
							</h1>
						</div>
						<div className="flex flex-wrap gap-2">
							<Badge variant="outline">
								{humanizeFileWorkspaceValue(link.linkKind)}
							</Badge>
							<Badge variant="outline">View only</Badge>
							<Badge variant={downloadAllowed ? "outline" : "secondary"}>
								{downloadAllowed ? "Downloads enabled" : "Downloads off"}
							</Badge>
						</div>
					</div>
				</header>
				<div className="min-h-0 flex-1 overflow-auto">
					<div className="min-w-[560px]">
						<div className="grid grid-cols-[minmax(18rem,1fr)_8rem_9rem_7rem] gap-3 border-(--line) border-b px-4 py-2 font-semibold text-(--sea-ink-soft) text-xs uppercase tracking-[0.1em]">
							<span>Name</span>
							<span>Size</span>
							<span>Scan</span>
							<span className="text-right">Actions</span>
						</div>
						{nodeList.nodes.map((node) => {
							const currentVersion = node.currentVersion;
							const canOpen =
								node.nodeType === "folder" ||
								currentVersion?.scanState === "clean" ||
								currentVersion?.scanState === "released_by_admin";
							return (
								<div
									className="grid min-h-14 grid-cols-[minmax(18rem,1fr)_8rem_9rem_7rem] items-center gap-3 border-(--line) border-b px-4 py-2 text-sm"
									key={node.nodeId}
								>
									<button
										className="flex min-w-0 items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--lagoon)_55%,transparent)]"
										onClick={() => {
											if (node.nodeType === "folder") {
												onOpenFolder?.(node.nodeId);
											} else if (canOpen) {
												onPreview?.(node.nodeId);
											}
										}}
										type="button"
									>
										{node.nodeType === "folder" ? (
											<Folder className="size-4 shrink-0 text-(--sea-ink-soft)" />
										) : (
											<FileIcon className="size-4 shrink-0 text-(--sea-ink-soft)" />
										)}
										<span className="min-w-0 truncate">{node.displayName}</span>
									</button>
									<span className="text-(--sea-ink-soft)">
										{formatFileSize(currentVersion?.sizeBytes)}
									</span>
									<Badge
										className={scanStateTone(currentVersion?.scanState)}
										variant="outline"
									>
										{currentVersion?.scanState
											? humanizeFileWorkspaceValue(currentVersion.scanState)
											: "Folder"}
									</Badge>
									<div className="flex justify-end gap-1">
										<Button
											aria-label={`Preview ${node.displayName}`}
											disabled={!canOpen}
											onClick={() => {
												if (node.nodeType === "folder") {
													onOpenFolder?.(node.nodeId);
												} else {
													onPreview?.(node.nodeId);
												}
											}}
											size="icon-xs"
											type="button"
											variant="ghost"
										>
											<Eye />
										</Button>
										{downloadAllowed ? (
											<Button
												aria-label={`Download ${node.displayName}`}
												disabled={!canOpen || node.nodeType === "folder"}
												onClick={() => onDownload?.(node.nodeId)}
												size="icon-xs"
												type="button"
												variant="ghost"
											>
												<Download />
											</Button>
										) : null}
									</div>
								</div>
							);
						})}
						{nodeList.nodes.length === 0 ? (
							<div className="flex min-h-56 items-center justify-center p-8 text-center text-(--sea-ink-soft)">
								No shared files are available.
							</div>
						) : null}
					</div>
				</div>
			</section>
		</main>
	);
}
