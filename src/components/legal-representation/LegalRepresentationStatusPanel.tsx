"use client";

import { useMutation } from "convex/react";
import { MailCheck, RefreshCw, ShieldAlert, UserRoundPen } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LegalRepresentationStatusProjection } from "../../../convex/legalRepresentation/status";

interface LegalRepresentationStatusPanelProps {
	readonly dealId: Id<"deals">;
	readonly projection: LegalRepresentationStatusProjection;
	readonly surface: "admin" | "lender";
}

type ReplacementType = "guest_lawyer" | "platform_lawyer";

function actionTitle(value: string) {
	return value
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function fieldId(prefix: string, name: string) {
	return `${prefix}-${name}`;
}

export function LegalRepresentationStatusPanel({
	dealId,
	projection,
	surface,
}: LegalRepresentationStatusPanelProps) {
	const resendInvitation = useMutation(
		api.legalRepresentation.management.resendLegalRepresentationInvitation
	);
	const changeEmail = useMutation(
		api.legalRepresentation.management.changeLegalRepresentationGuestEmail
	);
	const replaceLawyer = useMutation(
		api.legalRepresentation.management.replaceLegalRepresentationLawyer
	);
	const [guestEmail, setGuestEmail] = useState(
		projection.currentInvitation.targetEmail ??
			projection.selectedLawyer.email ??
			""
	);
	const [replacementType, setReplacementType] =
		useState<ReplacementType>("guest_lawyer");
	const [replacementName, setReplacementName] = useState("");
	const [replacementEmail, setReplacementEmail] = useState("");
	const [replacementFirm, setReplacementFirm] = useState("");
	const [replacementLawyerId, setReplacementLawyerId] = useState("");
	const [busyAction, setBusyAction] = useState<string | null>(null);

	if (!projection.showInDealViews) {
		return null;
	}

	async function runAction<T>(name: string, operation: () => Promise<T>) {
		try {
			setBusyAction(name);
			await operation();
			toast.success(`${actionTitle(name)} complete.`);
		} catch (error) {
			toast.error(`${actionTitle(name)} failed`, {
				description:
					error instanceof Error ? error.message : "Unexpected error occurred.",
			});
		} finally {
			setBusyAction(null);
		}
	}

	const canSubmitReplacement =
		replacementName.trim().length > 0 &&
		replacementEmail.trim().length > 0 &&
		(replacementType === "guest_lawyer" ||
			replacementLawyerId.trim().length > 0);

	return (
		<section className="space-y-4 rounded-md border border-border/70 p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<MailCheck className="size-4 text-muted-foreground" />
						<h2 className="font-medium text-base">Legal Representation</h2>
						<Badge variant="secondary">{projection.label}</Badge>
					</div>
					<p className="text-muted-foreground text-sm">{projection.summary}</p>
				</div>
				<Badge variant="outline">{surface}</Badge>
			</div>

			<div className="grid gap-3 sm:grid-cols-3">
				<StatusFact
					label="Lawyer"
					value={projection.selectedLawyer.name ?? "Unassigned"}
				/>
				<StatusFact
					label="Invitation"
					value={
						projection.currentInvitation.status === "none"
							? "No invitation"
							: [
									actionTitle(projection.currentInvitation.status),
									projection.currentInvitation.deliveryStatus
										? `Delivery ${actionTitle(projection.currentInvitation.deliveryStatus)}`
										: null,
								]
									.filter(Boolean)
									.join(" · ")
					}
				/>
				<StatusFact
					label="Active Access"
					value={`${projection.activeLawyerAccessCount} lawyer grant${projection.activeLawyerAccessCount === 1 ? "" : "s"}`}
				/>
			</div>

			{projection.gate.reasonCodes.length > 0 ? (
				<div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
					<ShieldAlert className="mt-0.5 size-4" />
					<div className="space-y-1">
						<p className="font-medium text-sm">{projection.gate.message}</p>
						<p className="text-xs">
							{projection.gate.reasonCodes.map(actionTitle).join(", ")}
						</p>
					</div>
				</div>
			) : null}

			<div className="grid gap-4 lg:grid-cols-3">
				<div className="space-y-3 rounded-md border border-border/70 p-3">
					<div>
						<p className="font-medium text-sm">Resend Invitation</p>
						<p className="text-muted-foreground text-xs">
							Rotates the pending link without extending expiry.
						</p>
					</div>
					<Button
						disabled={
							!projection.actions.resendInvitation.allowed ||
							busyAction !== null
						}
						onClick={() =>
							void runAction("resend_invitation", () =>
								resendInvitation({ dealId })
							)
						}
						size="sm"
						type="button"
					>
						<RefreshCw className="mr-2 size-4" />
						Resend
					</Button>
					<ActionReason action={projection.actions.resendInvitation} />
				</div>

				<div className="space-y-3 rounded-md border border-border/70 p-3">
					<div>
						<p className="font-medium text-sm">Change Guest Email</p>
						<p className="text-muted-foreground text-xs">
							Revokes the old link and issues a new target.
						</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor={fieldId(surface, "guest-email")}>Email</Label>
						<Input
							id={fieldId(surface, "guest-email")}
							onChange={(event) => setGuestEmail(event.target.value)}
							type="email"
							value={guestEmail}
						/>
					</div>
					<Button
						disabled={
							!projection.actions.changeGuestEmail.allowed ||
							guestEmail.trim().length === 0 ||
							busyAction !== null
						}
						onClick={() =>
							void runAction("change_guest_email", () =>
								changeEmail({ dealId, newEmail: guestEmail })
							)
						}
						size="sm"
						type="button"
						variant="outline"
					>
						<UserRoundPen className="mr-2 size-4" />
						Change Email
					</Button>
					<ActionReason action={projection.actions.changeGuestEmail} />
				</div>

				<div className="space-y-3 rounded-md border border-border/70 p-3">
					<div>
						<p className="font-medium text-sm">Replace Lawyer</p>
						<p className="text-muted-foreground text-xs">
							Revokes current lawyer access and starts a new workflow.
						</p>
					</div>
					<div className="grid gap-2">
						<Select
							onValueChange={(value) =>
								setReplacementType(value as ReplacementType)
							}
							value={replacementType}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="guest_lawyer">Guest lawyer</SelectItem>
								<SelectItem value="platform_lawyer">Platform lawyer</SelectItem>
							</SelectContent>
						</Select>
						<Input
							aria-label="Replacement lawyer name"
							onChange={(event) => setReplacementName(event.target.value)}
							placeholder="Name"
							value={replacementName}
						/>
						<Input
							aria-label="Replacement lawyer email"
							onChange={(event) => setReplacementEmail(event.target.value)}
							placeholder="Email"
							type="email"
							value={replacementEmail}
						/>
						<Input
							aria-label="Replacement lawyer firm"
							onChange={(event) => setReplacementFirm(event.target.value)}
							placeholder="Firm"
							value={replacementFirm}
						/>
						{replacementType === "platform_lawyer" ? (
							<Input
								aria-label="Platform lawyer auth ID"
								onChange={(event) => setReplacementLawyerId(event.target.value)}
								placeholder="WorkOS auth ID"
								value={replacementLawyerId}
							/>
						) : null}
					</div>
					<Button
						disabled={
							!(
								projection.actions.replaceLawyer.allowed && canSubmitReplacement
							) || busyAction !== null
						}
						onClick={() =>
							void runAction("replace_lawyer", () =>
								replaceLawyer({
									dealId,
									newSelectedLawyer:
										replacementType === "guest_lawyer"
											? {
													email: replacementEmail,
													...(replacementFirm.trim().length > 0
														? { firm: replacementFirm }
														: {}),
													name: replacementName,
													source: "manual",
													type: "guest_lawyer",
												}
											: {
													email: replacementEmail,
													...(replacementFirm.trim().length > 0
														? { firm: replacementFirm }
														: {}),
													lawyerId: replacementLawyerId,
													name: replacementName,
													type: "platform_lawyer",
												},
								})
							)
						}
						size="sm"
						type="button"
						variant="outline"
					>
						<UserRoundPen className="mr-2 size-4" />
						Replace
					</Button>
					<ActionReason action={projection.actions.replaceLawyer} />
				</div>
			</div>
		</section>
	);
}

function StatusFact({
	label,
	value,
}: {
	readonly label: string;
	readonly value: string;
}) {
	return (
		<div className="rounded-md border border-border/70 p-3">
			<p className="text-muted-foreground text-xs uppercase">{label}</p>
			<p className="mt-1 font-medium text-sm">{value}</p>
		</div>
	);
}

function ActionReason({
	action,
}: {
	readonly action: {
		readonly allowed: boolean;
		readonly reason: string | null;
	};
}) {
	if (action.allowed || !action.reason) {
		return null;
	}
	return <p className="text-muted-foreground text-xs">{action.reason}</p>;
}
