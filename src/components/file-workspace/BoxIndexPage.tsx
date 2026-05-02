import {
	Archive,
	Boxes,
	Plus,
	Search,
	Share2,
	UserRoundCheck,
} from "lucide-react";
import type { ComponentType } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { cn } from "#/lib/utils";
import {
	boxStatusTone,
	formatFileWorkspaceDate,
	roleLabel,
	visibilityLabel,
} from "./display";
import type { FileWorkspaceBoxIndexItem } from "./types";

export type BoxIndexFilter = "all" | "owned" | "shared" | "public" | "archived";

interface BoxIndexPageProps {
	activeFilter?: BoxIndexFilter;
	boxes: readonly FileWorkspaceBoxIndexItem[];
	onCreateBox?: (name: string) => void;
	onFilterChange?: (filter: BoxIndexFilter) => void;
}

const filters: Array<{
	icon: ComponentType<{ className?: string }>;
	key: BoxIndexFilter;
	label: string;
}> = [
	{ icon: Boxes, key: "all", label: "All" },
	{ icon: UserRoundCheck, key: "owned", label: "Owned" },
	{ icon: Boxes, key: "shared", label: "Shared" },
	{ icon: Share2, key: "public", label: "Public links" },
	{ icon: Archive, key: "archived", label: "Archived" },
];

function boxMatchesFilter(
	box: FileWorkspaceBoxIndexItem,
	filter: BoxIndexFilter
) {
	switch (filter) {
		case "owned":
			return box.role === "manager" || box.role === "platform_admin";
		case "shared":
			return box.role === "viewer" || box.role === "editor";
		case "public":
			return (
				box.visibility === "public_link" || box.visibility === "magic_link"
			);
		case "archived":
			return box.status === "archived";
		default:
			return true;
	}
}

export function BoxIndexPage({
	activeFilter = "all",
	boxes,
	onCreateBox,
	onFilterChange,
}: BoxIndexPageProps) {
	const visibleBoxes = boxes.filter((box) =>
		boxMatchesFilter(box, activeFilter)
	);

	return (
		<main className="flex min-h-0 flex-1 flex-col bg-[var(--surface)]">
			<header className="border-(--line) border-b bg-[var(--surface-strong)] px-4 py-4 sm:px-6">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p className="m-0 font-semibold text-(--sea-ink-soft) text-xs uppercase tracking-[0.14em]">
							File Workspace
						</p>
						<h1 className="m-0 mt-1 font-serif text-(--sea-ink) text-3xl">
							Files
						</h1>
					</div>
					<form
						className="flex min-w-0 flex-col gap-2 sm:flex-row"
						onSubmit={(event) => {
							event.preventDefault();
							const formData = new FormData(event.currentTarget);
							const name = String(formData.get("boxName") ?? "").trim();
							onCreateBox?.(name || "New file box");
							event.currentTarget.reset();
						}}
					>
						<Input
							aria-label="New box name"
							className="min-w-0 sm:w-56"
							name="boxName"
							placeholder="New box name"
						/>
						<Button type="submit">
							<Plus />
							<span>Create box</span>
						</Button>
					</form>
				</div>
				<div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
					<div className="relative max-w-xl flex-1">
						<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--sea-ink-soft)" />
						<Input
							aria-label="Search file boxes"
							className="pl-9"
							placeholder="Search boxes"
							type="search"
						/>
					</div>
					<div className="flex gap-2 overflow-x-auto pb-1">
						{filters.map((filter) => {
							const Icon = filter.icon;
							const active = activeFilter === filter.key;
							return (
								<Button
									className={cn("shrink-0", active && "border-(--lagoon)")}
									key={filter.key}
									onClick={() => onFilterChange?.(filter.key)}
									size="sm"
									type="button"
									variant={active ? "outline" : "ghost"}
								>
									<Icon />
									<span>{filter.label}</span>
								</Button>
							);
						})}
					</div>
				</div>
			</header>
			<section className="grid min-h-0 gap-3 overflow-auto p-4 sm:p-6 lg:grid-cols-2 xl:grid-cols-3">
				{visibleBoxes.map((box) => (
					<a
						className="group flex min-h-44 flex-col justify-between rounded-md border border-(--line) bg-[var(--surface-strong)] p-4 text-(--sea-ink) no-underline transition hover:border-[color-mix(in_oklab,var(--lagoon)_45%,var(--line))] hover:shadow-[0_18px_42px_rgba(22,80,70,0.08)]"
						href={`/files/${box.boxId}`}
						key={box.boxId}
					>
						<div className="min-w-0">
							<div className="flex items-start justify-between gap-3">
								<h2 className="m-0 min-w-0 truncate font-semibold text-lg">
									{box.name}
								</h2>
								<Badge className={boxStatusTone(box.status)} variant="outline">
									{box.status}
								</Badge>
							</div>
							<p className="mt-2 line-clamp-2 min-h-10 text-(--sea-ink-soft) text-sm">
								{box.description ?? "No description recorded"}
							</p>
						</div>
						<div className="mt-5 grid gap-2 text-sm">
							<div className="flex items-center justify-between gap-3">
								<span className="text-(--sea-ink-soft)">Role</span>
								<span className="font-medium">{roleLabel(box.role)}</span>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-(--sea-ink-soft)">Visibility</span>
								<span className="font-medium">
									{visibilityLabel(box.visibility)}
								</span>
							</div>
							<div className="flex items-center justify-between gap-3">
								<span className="text-(--sea-ink-soft)">Last activity</span>
								<span className="text-right font-medium">
									{formatFileWorkspaceDate(box.updatedAt)}
								</span>
							</div>
						</div>
					</a>
				))}
				{visibleBoxes.length === 0 ? (
					<div className="col-span-full flex min-h-56 items-center justify-center border border-(--line) border-dashed bg-[var(--surface-strong)] p-8 text-center text-(--sea-ink-soft)">
						No boxes match the selected filter.
					</div>
				) : null}
			</section>
		</main>
	);
}
