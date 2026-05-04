import { GripVertical, Plus, Trash2 } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import {
	DEMO_DOCUMENT_SIGNATORY_ROLE_OPTIONS,
	type DocumentSignatoryRoleOption,
} from "#/lib/document-engine/contracts";
import {
	getSignatoryColor,
	getSignatoryLabel,
} from "#/lib/document-engine/signatory-utils";
import type { SignatoryConfig } from "#/lib/document-engine/types";

interface SignatoryPanelProps {
	allowCustomRoles?: boolean;
	onChange: (signatories: SignatoryConfig[]) => void;
	readOnly?: boolean;
	roleOptions?: readonly DocumentSignatoryRoleOption[];
	signatories: SignatoryConfig[];
}

const SIGNATORY_ROLES = [
	{ value: "signatory", label: "Signatory" },
	{ value: "approver", label: "Approver" },
	{ value: "viewer", label: "Viewer" },
] as const;

const CUSTOM_SIGNATORY_VALUE = "__custom__";

function orderedSignatories(signatories: SignatoryConfig[]) {
	return [...signatories].sort((left, right) => {
		if (left.order !== right.order) {
			return left.order - right.order;
		}
		return left.platformRole.localeCompare(right.platformRole);
	});
}

function normalizeSignatoryOrder(signatories: SignatoryConfig[]) {
	return signatories.map((signatory, index) => ({
		...signatory,
		order: index,
	}));
}

function moveSignatory(
	signatories: SignatoryConfig[],
	sourcePlatformRole: string,
	targetPlatformRole: string
) {
	const ordered = orderedSignatories(signatories);
	const sourceIndex = ordered.findIndex(
		(signatory) => signatory.platformRole === sourcePlatformRole
	);
	const targetIndex = ordered.findIndex(
		(signatory) => signatory.platformRole === targetPlatformRole
	);

	if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
		return ordered;
	}

	const next = [...ordered];
	const [source] = next.splice(sourceIndex, 1);
	if (!source) {
		return ordered;
	}
	next.splice(targetIndex, 0, source);
	return normalizeSignatoryOrder(next);
}

function keyboardReorderDirection(key: string) {
	if (key === "ArrowUp") {
		return -1;
	}
	if (key === "ArrowDown") {
		return 1;
	}
	return 0;
}

export function SignatoryPanel({
	allowCustomRoles = true,
	roleOptions = DEMO_DOCUMENT_SIGNATORY_ROLE_OPTIONS,
	signatories,
	onChange,
	readOnly,
}: SignatoryPanelProps) {
	const [newRole, setNewRole] = useState("");
	const [customLabel, setCustomLabel] = useState("");
	const [draggedPlatformRole, setDraggedPlatformRole] = useState<string | null>(
		null
	);
	const [dropTargetPlatformRole, setDropTargetPlatformRole] = useState<
		string | null
	>(null);
	const [showCustomInput, setShowCustomInput] = useState(false);
	const ordered = orderedSignatories(signatories);

	const usedRoles = new Set(signatories.map((s) => s.platformRole));
	const availableRoleOptions = roleOptions.filter(
		(role) => !usedRoles.has(role.value)
	);

	const nextCustomId = (): string => {
		let n = 1;
		while (usedRoles.has(`signatory_${n}`)) {
			n++;
		}
		return `signatory_${n}`;
	};

	const handleAdd = () => {
		if (!newRole) {
			return;
		}
		onChange([
			...ordered,
			{
				platformRole: newRole,
				role: "signatory",
				order: ordered.length,
			},
		]);
		setNewRole("");
	};

	const handleAddCustom = () => {
		const id = nextCustomId();
		onChange([
			...ordered,
			{
				platformRole: id,
				role: "signatory",
				order: ordered.length,
				label:
					customLabel.trim() ||
					id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
			},
		]);
		setCustomLabel("");
		setShowCustomInput(false);
	};

	const handleRemove = (platformRole: string) => {
		const updated = ordered
			.filter((s) => s.platformRole !== platformRole)
			.map((s, i) => ({ ...s, order: i }));
		onChange(updated);
	};

	const handleRoleChange = (
		platformRole: string,
		role: "signatory" | "approver" | "viewer"
	) => {
		onChange(
			ordered.map((s) => (s.platformRole === platformRole ? { ...s, role } : s))
		);
	};

	const handleSelectChange = (value: string) => {
		if (value === CUSTOM_SIGNATORY_VALUE) {
			setShowCustomInput(true);
			setNewRole("");
		} else {
			setShowCustomInput(false);
			setNewRole(value);
		}
	};

	const handleMove = (
		sourcePlatformRole: string,
		targetPlatformRole: string
	) => {
		onChange(moveSignatory(ordered, sourcePlatformRole, targetPlatformRole));
	};

	const handleKeyboardMove = (
		event: KeyboardEvent<HTMLButtonElement>,
		platformRole: string
	) => {
		const currentIndex = ordered.findIndex(
			(signatory) => signatory.platformRole === platformRole
		);
		const direction = keyboardReorderDirection(event.key);
		if (direction === 0 || currentIndex < 0) {
			return;
		}

		const target = ordered[currentIndex + direction];
		if (!target) {
			return;
		}

		event.preventDefault();
		handleMove(platformRole, target.platformRole);
	};

	return (
		<div className="space-y-3">
			{signatories.length === 0 && (
				<p className="text-muted-foreground text-xs">
					No signatories added yet.
				</p>
			)}

			<div className="space-y-2" role="list">
				{ordered.map((sig) => {
					const signatoryLabel = getSignatoryLabel(
						sig.platformRole,
						sig.label,
						roleOptions
					);
					const isDropTarget = dropTargetPlatformRole === sig.platformRole;

					return (
						// biome-ignore lint/a11y/noNoninteractiveElementInteractions: This list item is a native drag-and-drop target for the signatory handle.
						<div
							aria-label={`${signatoryLabel} signing order ${sig.order + 1}`}
							className={`rounded-md border p-2 transition-colors ${
								isDropTarget
									? "border-primary/70 bg-primary/10"
									: "border-border"
							}`}
							key={sig.platformRole}
							onDragLeave={() => {
								if (dropTargetPlatformRole === sig.platformRole) {
									setDropTargetPlatformRole(null);
								}
							}}
							onDragOver={(event) => {
								if (
									!draggedPlatformRole ||
									draggedPlatformRole === sig.platformRole
								) {
									return;
								}
								event.preventDefault();
								event.dataTransfer.dropEffect = "move";
								setDropTargetPlatformRole(sig.platformRole);
							}}
							onDrop={(event) => {
								event.preventDefault();
								const sourcePlatformRole =
									event.dataTransfer.getData("text/plain") ||
									draggedPlatformRole;
								setDraggedPlatformRole(null);
								setDropTargetPlatformRole(null);
								if (
									sourcePlatformRole &&
									sourcePlatformRole !== sig.platformRole
								) {
									handleMove(sourcePlatformRole, sig.platformRole);
								}
							}}
							role="listitem"
						>
							<div className="flex items-center gap-2">
								<button
									aria-label={`Drag ${signatoryLabel} to reorder signing order`}
									className="inline-flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing disabled:cursor-default disabled:opacity-50"
									disabled={readOnly || ordered.length < 2}
									draggable={!readOnly && ordered.length > 1}
									onDragEnd={() => {
										setDraggedPlatformRole(null);
										setDropTargetPlatformRole(null);
									}}
									onDragStart={(event) => {
										setDraggedPlatformRole(sig.platformRole);
										event.dataTransfer.effectAllowed = "move";
										event.dataTransfer.setData("text/plain", sig.platformRole);
									}}
									onKeyDown={(event) =>
										handleKeyboardMove(event, sig.platformRole)
									}
									title="Drag to reorder signing order"
									type="button"
								>
									<GripVertical className="size-4" />
								</button>
								<div
									className="size-3 shrink-0 rounded-full"
									style={{
										backgroundColor: getSignatoryColor(
											sig.platformRole,
											roleOptions
										),
									}}
								/>
								<span className="min-w-0 flex-1 truncate text-sm">
									{signatoryLabel}
								</span>
								{!readOnly && (
									<Button
										className="shrink-0"
										onClick={() => handleRemove(sig.platformRole)}
										size="icon"
										variant="ghost"
									>
										<Trash2 className="size-3" />
									</Button>
								)}
							</div>
							{readOnly ? (
								<div className="mt-1 pl-9">
									<Badge variant="outline">{sig.role}</Badge>
								</div>
							) : (
								<div className="mt-1 pl-9">
									<Select
										onValueChange={(v) =>
											handleRoleChange(
												sig.platformRole,
												v as SignatoryConfig["role"]
											)
										}
										value={sig.role}
									>
										<SelectTrigger className="h-7 text-xs">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{SIGNATORY_ROLES.map((r) => (
												<SelectItem key={r.value} value={r.value}>
													{r.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}
						</div>
					);
				})}
			</div>

			{!readOnly && (
				<div className="space-y-2">
					<div className="flex gap-2">
						<Select
							onValueChange={handleSelectChange}
							value={showCustomInput ? CUSTOM_SIGNATORY_VALUE : newRole}
						>
							<SelectTrigger className="h-8 text-xs">
								<SelectValue placeholder="Add signatory..." />
							</SelectTrigger>
							<SelectContent>
								{availableRoleOptions.map((role) => (
									<SelectItem key={role.value} value={role.value}>
										{role.label}
									</SelectItem>
								))}
								{allowCustomRoles ? (
									<SelectItem value={CUSTOM_SIGNATORY_VALUE}>
										+ Custom Signatory
									</SelectItem>
								) : null}
							</SelectContent>
						</Select>
						{!showCustomInput && (
							<Button
								disabled={!newRole}
								onClick={handleAdd}
								size="sm"
								variant="outline"
							>
								<Plus className="size-3" />
							</Button>
						)}
					</div>

					{showCustomInput && (
						<div className="flex gap-2">
							<Input
								className="h-8 text-xs"
								onChange={(e) => setCustomLabel(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										handleAddCustom();
									}
								}}
								placeholder="Display label (e.g. Guarantor)"
								value={customLabel}
							/>
							<Button onClick={handleAddCustom} size="sm" variant="outline">
								<Plus className="size-3" />
							</Button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
