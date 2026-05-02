import type {
	FileWorkspaceBoxStatus,
	FileWorkspaceRole,
	FileWorkspaceVisibility,
} from "./types";

export function formatFileWorkspaceDate(timestamp?: number) {
	if (timestamp === undefined) {
		return "Not recorded";
	}
	return new Intl.DateTimeFormat("en-CA", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(timestamp));
}

export function formatFileSize(sizeBytes?: number) {
	if (sizeBytes === undefined) {
		return "Folder";
	}
	if (sizeBytes < 1024) {
		return `${sizeBytes} B`;
	}
	if (sizeBytes < 1024 * 1024) {
		return `${(sizeBytes / 1024).toFixed(1)} KB`;
	}
	return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function humanizeFileWorkspaceValue(value: string) {
	return value
		.split("_")
		.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

export function roleLabel(role: FileWorkspaceRole) {
	if (role === "platform_admin") {
		return "Platform admin";
	}
	return humanizeFileWorkspaceValue(role);
}

export function visibilityLabel(visibility: FileWorkspaceVisibility) {
	if (visibility === "public_link") {
		return "Public link";
	}
	if (visibility === "magic_link") {
		return "Magic link";
	}
	return humanizeFileWorkspaceValue(visibility);
}

export function scanStateTone(scanState?: string) {
	switch (scanState) {
		case "clean":
			return "border-[color-mix(in_oklab,var(--palm)_50%,var(--line))] bg-[color-mix(in_oklab,var(--palm)_12%,transparent)] text-(--sea-ink)";
		case "pending_scan":
			return "border-[color-mix(in_oklab,var(--lagoon)_50%,var(--line))] bg-[color-mix(in_oklab,var(--lagoon)_12%,transparent)] text-(--sea-ink)";
		case "released_by_admin":
			return "border-[color-mix(in_oklab,var(--sand)_70%,var(--line))] bg-[color-mix(in_oklab,var(--sand)_35%,transparent)] text-(--sea-ink)";
		case "rejected":
		case "scan_error":
			return "border-red-200 bg-red-50 text-red-800";
		default:
			return "border-(--line) bg-transparent text-(--sea-ink-soft)";
	}
}

export function boxStatusTone(status: FileWorkspaceBoxStatus) {
	switch (status) {
		case "active":
			return "border-[color-mix(in_oklab,var(--palm)_50%,var(--line))] bg-[color-mix(in_oklab,var(--palm)_10%,transparent)] text-(--sea-ink)";
		case "archived":
			return "border-[color-mix(in_oklab,var(--sand)_70%,var(--line))] bg-[color-mix(in_oklab,var(--sand)_30%,transparent)] text-(--sea-ink)";
		default:
			return "border-red-200 bg-red-50 text-red-800";
	}
}
