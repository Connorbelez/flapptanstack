import { Link2, Shield, Trash2, Users } from "lucide-react";
import type { FormEvent } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Separator } from "#/components/ui/separator";
import { formatFileWorkspaceDate, humanizeFileWorkspaceValue } from "./display";
import type { FileWorkspaceManagerSettings } from "./types";

type ManagedFileWorkspaceRole = "viewer" | "editor" | "manager";

interface ShareSettingsProps {
	onCreateLink?: () => void;
	onRemoveParticipant?: (participantId: string) => Promise<void> | void;
	onUpsertParticipant?: (grant: {
		authId?: string;
		email?: string;
		role: ManagedFileWorkspaceRole;
	}) => Promise<void> | void;
	participantStatus?: string | null;
	settings: FileWorkspaceManagerSettings;
}

const MANAGED_ROLES: ManagedFileWorkspaceRole[] = [
	"viewer",
	"editor",
	"manager",
];

function participantLabel(
	participant: FileWorkspaceManagerSettings["participants"][number]
) {
	return participant.email ?? participant.authId ?? participant.participantKey;
}

export function ShareSettings({
	onCreateLink,
	onRemoveParticipant,
	onUpsertParticipant,
	participantStatus,
	settings,
}: ShareSettingsProps) {
	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const formData = new FormData(form);
		const trimmedEmail = String(formData.get("email") ?? "").trim();
		const role = formData.get("role") as ManagedFileWorkspaceRole;
		if (!trimmedEmail) {
			return;
		}
		await onUpsertParticipant?.({ email: trimmedEmail, role });
		form.reset();
	}

	return (
		<section className="grid gap-5 border-(--line) border-t bg-[var(--surface-strong)] p-4 lg:grid-cols-3">
			<div>
				<div className="mb-3 flex items-center gap-2 font-semibold text-(--sea-ink)">
					<Users className="size-4 text-(--sea-ink-soft)" />
					Participants
				</div>
				<form className="mb-3 grid gap-2" onSubmit={handleSubmit}>
					<Input
						aria-label="Participant email"
						name="email"
						placeholder="person@example.com"
						type="email"
					/>
					<div className="flex min-w-0 gap-2">
						<select
							aria-label="Participant role"
							className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
							defaultValue="viewer"
							name="role"
						>
							{MANAGED_ROLES.map((roleOption) => (
								<option key={roleOption} value={roleOption}>
									{humanizeFileWorkspaceValue(roleOption)}
								</option>
							))}
						</select>
						<Button className="shrink-0" size="sm" type="submit">
							Save participant
						</Button>
					</div>
					{participantStatus ? (
						<p aria-live="polite" className="m-0 text-(--sea-ink-soft) text-xs">
							{participantStatus}
						</p>
					) : null}
				</form>
				<div className="space-y-2">
					{settings.participants.map((participant) => {
						const label = participantLabel(participant);
						return (
							<div
								className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 text-sm"
								key={participant.participantId}
							>
								<span className="min-w-0 truncate" title={label}>
									{label}
								</span>
								<select
									aria-label={`Role for ${label}`}
									className="h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
									onChange={(event) =>
										void onUpsertParticipant?.({
											authId: participant.authId,
											email: participant.email,
											role: event.currentTarget
												.value as ManagedFileWorkspaceRole,
										})
									}
									value={participant.role}
								>
									{MANAGED_ROLES.map((roleOption) => (
										<option key={roleOption} value={roleOption}>
											{humanizeFileWorkspaceValue(roleOption)}
										</option>
									))}
								</select>
								<Button
									aria-label={`Remove ${label}`}
									onClick={() =>
										void onRemoveParticipant?.(participant.participantId)
									}
									size="icon-xs"
									type="button"
									variant="ghost"
								>
									<Trash2 />
								</Button>
							</div>
						);
					})}
					{settings.participants.length === 0 ? (
						<Badge variant="outline">No active participants</Badge>
					) : null}
				</div>
			</div>
			<div>
				<div className="mb-3 flex items-center justify-between gap-3">
					<div className="flex items-center gap-2 font-semibold text-(--sea-ink)">
						<Link2 className="size-4 text-(--sea-ink-soft)" />
						Links
					</div>
					<Button
						onClick={onCreateLink}
						size="sm"
						type="button"
						variant="outline"
					>
						Create link
					</Button>
				</div>
				<div className="space-y-2">
					{settings.links.map((link) => (
						<div
							className="grid gap-1 border-(--line) border-l-2 pl-3 text-sm"
							key={link.linkId}
						>
							<div className="flex items-center justify-between gap-2">
								<span>{humanizeFileWorkspaceValue(link.linkKind)}</span>
								<Badge variant={link.revokedAt ? "destructive" : "outline"}>
									{link.revokedAt ? "Revoked" : "Active"}
								</Badge>
							</div>
							<span className="text-(--sea-ink-soft) text-xs">
								{link.downloadEnabled ? "Downloads enabled" : "View only"} ·{" "}
								{link.expiresAt
									? `Expires ${formatFileWorkspaceDate(link.expiresAt)}`
									: "No expiry"}
							</span>
						</div>
					))}
					{settings.links.length === 0 ? (
						<p className="m-0 text-(--sea-ink-soft) text-sm">
							No share links configured.
						</p>
					) : null}
				</div>
			</div>
			<div>
				<div className="mb-3 flex items-center gap-2 font-semibold text-(--sea-ink)">
					<Shield className="size-4 text-(--sea-ink-soft)" />
					Policies
				</div>
				<div className="grid gap-2 text-sm">
					<div className="flex justify-between gap-3">
						<span className="text-(--sea-ink-soft)">Visibility</span>
						<span>{humanizeFileWorkspaceValue(settings.box.visibility)}</span>
					</div>
					<Separator />
					<div className="flex justify-between gap-3">
						<span className="text-(--sea-ink-soft)">Public downloads</span>
						<span>{settings.box.downloadPolicy.publicLink ? "On" : "Off"}</span>
					</div>
					<div className="flex justify-between gap-3">
						<span className="text-(--sea-ink-soft)">Magic downloads</span>
						<span>{settings.box.downloadPolicy.magicLink ? "On" : "Off"}</span>
					</div>
					<div className="flex justify-between gap-3">
						<span className="text-(--sea-ink-soft)">Trash retention</span>
						<span>{settings.box.retentionPolicy.trashRetentionDays} days</span>
					</div>
				</div>
			</div>
		</section>
	);
}
