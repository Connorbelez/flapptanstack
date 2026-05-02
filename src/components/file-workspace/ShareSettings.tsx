import { Link2, Shield, Users } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Separator } from "#/components/ui/separator";
import { formatFileWorkspaceDate, humanizeFileWorkspaceValue } from "./display";
import type { FileWorkspaceManagerSettings } from "./types";

interface ShareSettingsProps {
	onCreateLink?: () => void;
	settings: FileWorkspaceManagerSettings;
}

export function ShareSettings({ onCreateLink, settings }: ShareSettingsProps) {
	return (
		<section className="grid gap-5 border-(--line) border-t bg-[var(--surface-strong)] p-4 lg:grid-cols-3">
			<div>
				<div className="mb-3 flex items-center gap-2 font-semibold text-(--sea-ink)">
					<Users className="size-4 text-(--sea-ink-soft)" />
					Participants
				</div>
				<div className="space-y-2">
					{settings.participants.map((participant) => (
						<div
							className="flex items-center justify-between gap-3 text-sm"
							key={participant.participantId}
						>
							<span className="min-w-0 truncate">
								{participant.email ??
									participant.authId ??
									participant.participantKey}
							</span>
							<Badge variant="outline">
								{humanizeFileWorkspaceValue(participant.role)}
							</Badge>
						</div>
					))}
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
