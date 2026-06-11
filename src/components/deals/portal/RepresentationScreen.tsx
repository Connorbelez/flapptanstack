import { useQueryClient } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { Mail, Scale, ShieldCheck } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "#/components/ui/button";
import { api } from "../../../../convex/_generated/api";
import { formatDate, formatEnumLabel } from "./format";
import { type DealPortalWorkspace, hasPortalCapability } from "./types";

type RepresentationProjection = DealPortalWorkspace["representation"];
type CurrentInvitation = RepresentationProjection["currentInvitation"];
type SelectedLawyer = RepresentationProjection["selectedLawyer"];

export function RepresentationScreen({
	workspace,
}: {
	readonly workspace: DealPortalWorkspace;
}) {
	const representation = workspace.representation;
	const selectedLawyer = representation.selectedLawyer;
	const currentInvitation = representation.currentInvitation;
	const canResendInvitation = hasPortalCapability(
		workspace,
		"representation.invitation.resend"
	);
	const queryClient = useQueryClient();
	const confirmRepresentation = useMutation(
		api.deals.lawyerMutations.confirmRepresentation
	);
	const progressLegalRepresentation = useMutation(
		api.deals.lawyerMutations.progressLegalRepresentation
	);
	const adminOverrideRepresentation = useMutation(
		api.legalRepresentation.management.adminOverrideRepresentationConfirmation
	);
	const resendInvitation = useMutation(
		api.legalRepresentation.management.resendLegalRepresentationInvitation
	);
	const [overrideReason, setOverrideReason] = useState("");
	const [overrideEvidenceNote, setOverrideEvidenceNote] = useState("");
	const [status, setStatus] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function refreshPortal() {
		await queryClient.invalidateQueries();
	}

	async function runConfirmRepresentation() {
		setSubmitting(true);
		setStatus(null);
		try {
			await confirmRepresentation({ dealId: workspace.deal.dealId });
			await refreshPortal();
			setStatus("Representation confirmed.");
		} catch (error) {
			setStatus(
				error instanceof Error
					? error.message
					: "Representation could not be confirmed."
			);
		} finally {
			setSubmitting(false);
		}
	}

	async function runAdminOverride() {
		setSubmitting(true);
		setStatus(null);
		try {
			await adminOverrideRepresentation({
				dealId: workspace.deal.dealId,
				evidenceNote: overrideEvidenceNote,
				reason: overrideReason,
			});
			await refreshPortal();
			setStatus("Representation override recorded.");
		} catch (error) {
			setStatus(
				error instanceof Error
					? error.message
					: "Representation override could not be recorded."
			);
		} finally {
			setSubmitting(false);
		}
	}

	async function runResendInvitation() {
		setSubmitting(true);
		setStatus(null);
		try {
			await resendInvitation({ dealId: workspace.deal.dealId });
			await refreshPortal();
			const hadInvitation =
				currentInvitation !== null && currentInvitation.status !== "none";
			setStatus(
				hadInvitation ? "Invitation resend queued." : "Invitation send queued."
			);
		} catch (error) {
			setStatus(
				error instanceof Error
					? error.message
					: "Invitation could not be resent."
			);
		} finally {
			setSubmitting(false);
		}
	}
	async function runProgressDeal() {
		setSubmitting(true);
		setStatus(null);
		try {
			await progressLegalRepresentation({ dealId: workspace.deal.dealId });
			await refreshPortal();
			setStatus("Deal progressed.");
		} catch (error) {
			setStatus(
				error instanceof Error ? error.message : "Deal could not be progressed."
			);
		} finally {
			setSubmitting(false);
		}
	}

	const statusMessage = status ? (
		<p className="text-sm" style={{ color: "var(--sea-ink-soft)" }}>
			{status}
		</p>
	) : null;
	const showAdminOverride = hasPortalCapability(
		workspace,
		"representation.adminOverride"
	);

	return (
		<div className="space-y-6">
			{/* Section heading */}
			<div>
				<h2
					className="font-semibold text-xl"
					style={{ color: "var(--sea-ink)" }}
				>
					Legal Representation
				</h2>
				<p
					className="mt-1 max-w-2xl text-sm leading-relaxed"
					style={{ color: "var(--sea-ink-soft)" }}
				>
					A deal cannot move to document signing until counsel is verified and
					representation is confirmed.
				</p>
			</div>

			{/* Counsel Desk — unified horizontal band */}
			<div className="island-shell rounded-xl p-6">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
					{/* Lawyer identity */}
					<div className="flex items-start gap-4">
						<div
							className="flex size-14 shrink-0 items-center justify-center rounded-full font-bold text-sm tracking-wide"
							style={{
								background: "color-mix(in oklab, var(--lagoon) 15%, white)",
								color: "var(--lagoon-deep)",
								boxShadow: "0 2px 8px rgba(23,58,64,0.08)",
							}}
						>
							<Scale className="size-5" />
						</div>
						<div>
							<p
								className="font-semibold text-xs uppercase tracking-widest"
								style={{ color: "var(--sea-ink-soft)" }}
							>
								{representation.label}
							</p>
							<p
								className="mt-0.5 font-semibold text-lg"
								style={{ color: "var(--sea-ink)" }}
							>
								{selectedLawyer?.name ?? "Not selected"}
							</p>
							<p
								className="mt-0.5 text-sm"
								style={{ color: "var(--sea-ink-soft)" }}
							>
								{formatEnumLabel(selectedLawyer?.type)}
							</p>
						</div>
					</div>

					{/* Divider */}
					<div
						className="hidden lg:block"
						style={{
							width: "1px",
							background: "var(--line)",
							minHeight: "4rem",
						}}
					/>

					{/* Contact details */}
					<div className="flex-1">
						<div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
							<Snapshot
								label="Email"
								value={selectedLawyer?.email ?? "Not provided"}
							/>
							<Snapshot
								label="Active Access"
								value={`${representation.activeLawyerAccessCount}`}
							/>
						</div>
					</div>
				</div>

				{/* Invitation ticket */}
				<InvitationTicket
					canSendOrResend={canResendInvitation}
					currentInvitation={currentInvitation}
					onSendOrResend={() => void runResendInvitation()}
					selectedLawyer={selectedLawyer}
					submitting={submitting}
				/>
			</div>

			{/* Gate status */}
			{representation.gate ? (
				<div
					className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-5 py-3"
					style={{
						background: "var(--surface)",
						border: "1px solid var(--line)",
					}}
				>
					<div className="flex items-center gap-2">
						<ShieldCheck className="size-4" style={{ color: "var(--palm)" }} />
						<p
							className="font-medium text-sm"
							style={{ color: "var(--sea-ink)" }}
						>
							Representation Gate
						</p>
					</div>
					<div
						className="hidden h-3 w-px sm:block"
						style={{ background: "var(--line)" }}
					/>
					<p className="text-sm" style={{ color: "var(--sea-ink-soft)" }}>
						{representation.gate.message}
					</p>
					{representation.gate.reasonCodes.length > 0 ? (
						<>
							<div
								className="hidden h-3 w-px sm:block"
								style={{ background: "var(--line)" }}
							/>
							<p className="text-xs" style={{ color: "var(--sea-ink-soft)" }}>
								{representation.gate.reasonCodes
									.map(formatEnumLabel)
									.join(", ")}
							</p>
						</>
					) : null}
				</div>
			) : null}

			{/* Actions */}
			<div className="flex flex-wrap gap-3">
				{hasPortalCapability(workspace, "representation.confirm") ? (
					<Button
						disabled={submitting}
						onClick={() => void runConfirmRepresentation()}
						size="sm"
					>
						Confirm representation
					</Button>
				) : null}
				{hasPortalCapability(workspace, "representation.lawyer.replace") ? (
					<Button disabled={submitting} size="sm" variant="outline">
						Replace lawyer
					</Button>
				) : null}
				{hasPortalCapability(workspace, "representation.progressDeal") ? (
					<Button
						disabled={submitting}
						onClick={() => void runProgressDeal()}
						size="sm"
						variant="outline"
					>
						Progress deal
					</Button>
				) : null}
			</div>

			{/* Admin override */}
			{showAdminOverride ? (
				<div className="island-shell rounded-xl p-6">
					<h3
						className="font-semibold text-lg"
						style={{ color: "var(--sea-ink)" }}
					>
						Admin Override Representation
					</h3>
					<p
						className="mt-1 text-sm leading-relaxed"
						style={{ color: "var(--sea-ink-soft)" }}
					>
						Record manual representation evidence and run the governed
						representation confirmation transition.
					</p>
					<div className="mt-5 grid gap-4 sm:grid-cols-2">
						<label className="grid gap-1.5 text-sm">
							<span className="font-medium" style={{ color: "var(--sea-ink)" }}>
								Reason
							</span>
							<input
								className="rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--lagoon)] focus:ring-2 focus:ring-[var(--lagoon)]/10"
								onChange={(event) =>
									setOverrideReason(event.currentTarget.value)
								}
								style={{
									borderColor: "var(--line)",
									background: "var(--surface-strong)",
									color: "var(--sea-ink)",
								}}
								value={overrideReason}
							/>
						</label>
						<label className="grid gap-1.5 text-sm">
							<span className="font-medium" style={{ color: "var(--sea-ink)" }}>
								Evidence note
							</span>
							<input
								className="rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--lagoon)] focus:ring-2 focus:ring-[var(--lagoon)]/10"
								onChange={(event) =>
									setOverrideEvidenceNote(event.currentTarget.value)
								}
								style={{
									borderColor: "var(--line)",
									background: "var(--surface-strong)",
									color: "var(--sea-ink)",
								}}
								value={overrideEvidenceNote}
							/>
						</label>
					</div>
					<div className="mt-5 flex flex-wrap items-center gap-3">
						<Button
							disabled={submitting}
							onClick={() => void runAdminOverride()}
							size="sm"
						>
							Confirm representation
						</Button>
						{statusMessage}
					</div>
				</div>
			) : (
				statusMessage
			)}
		</div>
	);
}

function InvitationTicket({
	canSendOrResend,
	currentInvitation,
	onSendOrResend,
	selectedLawyer,
	submitting,
}: {
	readonly canSendOrResend: boolean;
	readonly currentInvitation: CurrentInvitation;
	readonly onSendOrResend: () => void;
	readonly selectedLawyer: SelectedLawyer;
	readonly submitting: boolean;
}) {
	const activeInvitation =
		currentInvitation.status !== "none" ? currentInvitation : null;
	const hasInvitation = activeInvitation !== null;
	const invitationTargetEmail =
		activeInvitation?.targetEmail ?? selectedLawyer?.email ?? null;
	let invitationSummary = "No active invitation is present.";
	if (activeInvitation) {
		invitationSummary = `${formatEnumLabel(activeInvitation.status)} · ${invitationTargetEmail ?? "No email on file"}`;
	} else if (invitationTargetEmail) {
		invitationSummary = `No invitation has been sent to ${invitationTargetEmail}.`;
	}
	const invitationDetails = renderInvitationDetails({
		activeInvitation,
		invitationTargetEmail,
	});

	return (
		<div
			aria-label="Invitation"
			className="mt-6 border-t pt-5"
			role="region"
			style={{ borderColor: "var(--line)" }}
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex items-center gap-3">
					<div
						className="flex size-9 shrink-0 items-center justify-center rounded-full"
						style={{
							background: "color-mix(in oklab, var(--lagoon) 12%, white)",
							color: "var(--lagoon-deep)",
						}}
					>
						<Mail className="size-4" />
					</div>
					<div>
						<p
							className="font-semibold text-xs uppercase tracking-widest"
							style={{ color: "var(--sea-ink-soft)" }}
						>
							Invitation
						</p>
						<p className="mt-0.5 text-sm" style={{ color: "var(--sea-ink)" }}>
							{invitationSummary}
						</p>
					</div>
				</div>
				{canSendOrResend ? (
					<Button
						disabled={submitting}
						onClick={onSendOrResend}
						size="sm"
						variant="outline"
					>
						{hasInvitation ? "Resend invite" : "Send invite"}
					</Button>
				) : null}
			</div>
			{invitationDetails}
		</div>
	);
}

function renderInvitationDetails({
	activeInvitation,
	invitationTargetEmail,
}: {
	readonly activeInvitation: Exclude<
		CurrentInvitation,
		{ status: "none" }
	> | null;
	readonly invitationTargetEmail: string | null;
}): ReactNode {
	if (activeInvitation) {
		return (
			<div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-3">
				<Snapshot
					label="Expires"
					value={formatDate(activeInvitation.expiresAt)}
				/>
				<Snapshot
					label="Accepted"
					value={formatDate(activeInvitation.acceptedAt)}
				/>
				<Snapshot
					label="Delivery"
					value={
						activeInvitation.deliveryStatus
							? formatEnumLabel(activeInvitation.deliveryStatus)
							: "Not sent"
					}
				/>
				{activeInvitation.deliveryError ? (
					<Snapshot
						label="Delivery Error"
						value={activeInvitation.deliveryError}
					/>
				) : null}
			</div>
		);
	}
	if (invitationTargetEmail) {
		return (
			<div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
				<Snapshot label="Target email" value={invitationTargetEmail} />
				<Snapshot label="Delivery" value="Not sent" />
			</div>
		);
	}
	return null;
}

function Snapshot({
	label,
	value,
}: {
	readonly label: string;
	readonly value: string;
}) {
	return (
		<div>
			<p
				className="font-semibold text-xs uppercase tracking-widest"
				style={{ color: "var(--sea-ink-soft)" }}
			>
				{label}
			</p>
			<p
				className="mt-1 font-medium text-sm"
				style={{ color: "var(--sea-ink)" }}
			>
				{value}
			</p>
		</div>
	);
}
