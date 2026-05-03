import { useQueryClient } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { Mail, Scale, ShieldCheck } from "lucide-react";
import { type ReactNode, useState } from "react";
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

	const statusMessage = status ? (
		<p className="text-slate-600 text-sm">{status}</p>
	) : null;
	const showAdminOverride = hasPortalCapability(
		workspace,
		"representation.adminOverride"
	);

	return (
		<div className="space-y-5">
			<ScreenHeading
				body="A deal cannot move to document signing until counsel is verified and representation is confirmed."
				title="Legal Representation"
			/>

			<section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
				<div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
					<div className="flex items-start gap-3">
						<Scale className="mt-1 size-5 text-slate-600" />
						<div>
							<h3 className="font-semibold text-lg">{representation.label}</h3>
							<p className="mt-1 text-slate-600 text-sm leading-6">
								{representation.summary}
							</p>
						</div>
					</div>

					<div className="mt-5 grid gap-3 sm:grid-cols-2">
						<Snapshot
							label="Selected Lawyer"
							value={selectedLawyer?.name ?? "Not selected"}
						/>
						<Snapshot
							label="Lawyer Type"
							value={formatEnumLabel(selectedLawyer?.type)}
						/>
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

				<InvitationCard
					canSendOrResend={canResendInvitation}
					currentInvitation={currentInvitation}
					onSendOrResend={() => void runResendInvitation()}
					selectedLawyer={selectedLawyer}
					submitting={submitting}
				/>
			</section>

			{representation.gate ? (
				<div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
					<div className="flex items-start gap-3">
						<ShieldCheck className="mt-1 size-5 text-slate-600" />
						<div>
							<h3 className="font-semibold text-lg">Representation Gate</h3>
							<p className="mt-1 text-slate-600 text-sm leading-6">
								{representation.gate.message}
							</p>
							{representation.gate.reasonCodes.length > 0 ? (
								<p className="mt-2 text-slate-500 text-xs">
									{representation.gate.reasonCodes
										.map(formatEnumLabel)
										.join(", ")}
								</p>
							) : null}
						</div>
					</div>
				</div>
			) : null}

			<div className="flex flex-wrap gap-2">
				{hasPortalCapability(workspace, "representation.confirm") ? (
					<ActionButton
						disabled={submitting}
						label="Confirm representation"
						onClick={() => void runConfirmRepresentation()}
					/>
				) : null}
				{hasPortalCapability(workspace, "representation.lawyer.replace") ? (
					<ActionButton label="Replace lawyer" />
				) : null}
			</div>
			{showAdminOverride ? (
				<div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
					<h3 className="font-semibold text-lg">
						Admin Override Representation
					</h3>
					<p className="mt-1 text-slate-600 text-sm leading-6">
						Record manual representation evidence and run the governed
						representation confirmation transition.
					</p>
					<div className="mt-4 grid gap-3 sm:grid-cols-2">
						<label className="grid gap-1 text-sm">
							<span className="font-medium text-slate-700">Reason</span>
							<input
								className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
								onChange={(event) =>
									setOverrideReason(event.currentTarget.value)
								}
								value={overrideReason}
							/>
						</label>
						<label className="grid gap-1 text-sm">
							<span className="font-medium text-slate-700">Evidence note</span>
							<input
								className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
								onChange={(event) =>
									setOverrideEvidenceNote(event.currentTarget.value)
								}
								value={overrideEvidenceNote}
							/>
						</label>
					</div>
					<div className="mt-4 flex flex-wrap items-center gap-3">
						<button
							className="rounded-md bg-slate-950 px-3 py-2 font-medium text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-400"
							disabled={submitting}
							onClick={() => void runAdminOverride()}
							type="button"
						>
							Confirm representation
						</button>
						{statusMessage}
					</div>
				</div>
			) : (
				statusMessage
			)}
		</div>
	);
}

function ScreenHeading({
	body,
	title,
}: {
	readonly body: string;
	readonly title: string;
}) {
	return (
		<div>
			<h2 className="font-semibold text-xl">{title}</h2>
			<p className="mt-1 text-slate-600 text-sm leading-6">{body}</p>
		</div>
	);
}

function InvitationCard({
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
		<div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-start gap-3">
					<Mail className="mt-1 size-5 text-slate-600" />
					<div>
						<h3 className="font-semibold text-lg">Invitation</h3>
						<p className="mt-1 text-slate-600 text-sm leading-6">
							{invitationSummary}
						</p>
					</div>
				</div>
				{canSendOrResend ? (
					<ActionButton
						disabled={submitting}
						label={hasInvitation ? "Resend invite" : "Send invite"}
						onClick={onSendOrResend}
					/>
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
			<div className="mt-4 grid gap-3">
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
			<div className="mt-4 grid gap-3">
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
		<div className="rounded-md bg-slate-50 p-3">
			<p className="text-slate-500 text-xs">{label}</p>
			<p className="mt-1 font-medium text-slate-950 text-sm">{value}</p>
		</div>
	);
}

function ActionButton({
	disabled = false,
	label,
	onClick,
}: {
	readonly disabled?: boolean;
	readonly label: string;
	readonly onClick?: () => void;
}) {
	return (
		<button
			className="rounded-md border border-slate-300 bg-white px-3 py-2 font-medium text-slate-950 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
			disabled={disabled}
			onClick={onClick}
			type="button"
		>
			{label}
		</button>
	);
}
