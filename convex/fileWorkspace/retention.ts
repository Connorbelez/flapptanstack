import type { Doc } from "../_generated/dataModel";

export function permanentDeleteAvailableAt(args: {
	deletedAt: number;
	policy: Pick<
		Doc<"fileBoxes">["retentionPolicy"],
		"managerPermanentDeleteAfterDays" | "minRetentionLockedUntil"
	>;
}): number | undefined {
	if (args.policy.managerPermanentDeleteAfterDays === undefined) {
		return undefined;
	}
	const daysMs =
		args.policy.managerPermanentDeleteAfterDays * 24 * 60 * 60 * 1000;
	return Math.max(
		args.deletedAt + daysMs,
		args.policy.minRetentionLockedUntil ?? 0
	);
}

export function canPermanentlyDelete(args: {
	deletedAt?: number;
	now: number;
	policy: Pick<
		Doc<"fileBoxes">["retentionPolicy"],
		"managerPermanentDeleteAfterDays" | "minRetentionLockedUntil"
	>;
}) {
	if (args.deletedAt === undefined) {
		return {
			allowed: false,
			availableAt: undefined,
			reasonCode: "node_not_deleted",
		} as const;
	}
	const availableAt = permanentDeleteAvailableAt({
		deletedAt: args.deletedAt,
		policy: args.policy,
	});
	if (availableAt === undefined || availableAt > args.now) {
		return {
			allowed: false,
			availableAt,
			reasonCode: "retention_window_active",
		} as const;
	}
	return { allowed: true, availableAt } as const;
}

export function canRestoreFromTrash(args: {
	deletedAt?: number;
	isEditor: boolean;
	now: number;
	policy: Pick<
		Doc<"fileBoxes">["retentionPolicy"],
		"allowEditorRestore" | "trashRetentionDays"
	>;
}) {
	if (args.deletedAt === undefined) {
		return { allowed: false, reasonCode: "node_not_deleted" } as const;
	}
	if (args.isEditor && !args.policy.allowEditorRestore) {
		return { allowed: false, reasonCode: "editor_restore_disabled" } as const;
	}
	const expiresAt =
		args.deletedAt + args.policy.trashRetentionDays * 24 * 60 * 60 * 1000;
	if (expiresAt <= args.now) {
		return { allowed: false, reasonCode: "trash_retention_expired" } as const;
	}
	return { allowed: true } as const;
}
