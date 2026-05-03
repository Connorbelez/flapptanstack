import { useMutation, useQuery } from "convex/react";
import { ExternalLink, X } from "lucide-react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
	type AdminLawyerDetailResult,
	formatAdminEnum,
} from "./admin-lawyers-model";

type EvidenceMode = "verify" | "override";

export function AdminLawyersDetailSheet(props: {
	readonly onOpenChange: (open: boolean) => void;
	readonly profileId: Id<"lawyerProfiles"> | null;
}) {
	const [evidenceNote, setEvidenceNote] = useState("");
	const [replaceName, setReplaceName] = useState("");
	const [replaceEmail, setReplaceEmail] = useState("");
	const [replaceFirm, setReplaceFirm] = useState("");
	const [evidenceMode, setEvidenceMode] = useState<EvidenceMode | null>(null);
	const [showReplace, setShowReplace] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const detail = useQuery(
		api.legalRepresentation.adminLawyers.getLawyerAdminDetail,
		props.profileId ? { profileId: props.profileId } : "skip"
	) as AdminLawyerDetailResult | undefined;
	const recordOverride = useMutation(
		api.legalRepresentation.management.adminOverrideRepresentationConfirmation
	);
	const verifyRepresentation = useMutation(
		api.legalRepresentation.management.adminVerifyRepresentationConfirmation
	);
	const resendInvitation = useMutation(
		api.legalRepresentation.management.resendLegalRepresentationInvitation
	);
	const cancelInvitation = useMutation(
		api.legalRepresentation.invitations.revokeGuestInvitation
	);
	const replaceLawyer = useMutation(
		api.legalRepresentation.management.replaceLegalRepresentationLawyer
	);

	if (!(props.profileId && detail)) {
		return null;
	}

	const primaryDeal = detail.deals.active[0] ?? detail.deals.recent[0] ?? null;
	const activeInvitation = detail.invitations.active[0] ?? null;

	function submitEvidence() {
		if (evidenceNote.trim().length === 0) {
			setError("Evidence note is required.");
			return;
		}
		if (!(primaryDeal && evidenceMode)) {
			setError("A deal is required for this evidence action.");
			return;
		}
		const payload = {
			attachmentIds: [],
			dealId: primaryDeal._id,
			evidenceNote,
			reason:
				evidenceMode === "verify"
					? "Admin verified representation from lawyer operations detail sheet"
					: "Admin override from lawyer operations detail sheet",
		};
		if (evidenceMode === "verify") {
			void verifyRepresentation(payload);
		} else {
			void recordOverride(payload);
		}
	}

	function submitReplacement() {
		if (!primaryDeal) {
			setError("A deal is required for lawyer replacement.");
			return;
		}
		if (!(replaceName.trim() && replaceEmail.trim())) {
			setError("Replacement name and email are required.");
			return;
		}
		void replaceLawyer({
			dealId: primaryDeal._id,
			newSelectedLawyer: {
				email: replaceEmail,
				firm: replaceFirm.trim() || undefined,
				name: replaceName,
				source: "manual",
				type: "guest_lawyer",
			},
		});
	}

	return (
		<div
			aria-label={detail.profile.displayName}
			aria-modal="true"
			role="dialog"
		>
			<div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l bg-background shadow-xl">
				<header className="flex items-start justify-between gap-3 border-b p-5">
					<div>
						<h2 className="font-semibold text-xl">
							{detail.profile.displayName}
						</h2>
						<p className="text-muted-foreground text-sm">
							{detail.profile.email}
						</p>
					</div>
					<button
						aria-label="Close lawyer detail"
						className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
						onClick={() => props.onOpenChange(false)}
						type="button"
					>
						<X aria-hidden="true" className="size-4" />
					</button>
				</header>
				<div className="flex-1 space-y-5 overflow-auto p-5">
					<Section title="Overview">
						<div className="grid grid-cols-2 gap-2 text-sm">
							<Snapshot
								label="Kind"
								value={formatAdminEnum(detail.profile.profileKind)}
							/>
							<Snapshot
								label="Firm"
								value={detail.profile.firmName ?? "None"}
							/>
							<Snapshot
								label="License"
								value={detail.profile.barNumber ?? "Missing"}
							/>
							<Snapshot
								label="Jurisdiction"
								value={detail.profile.jurisdiction ?? "Missing"}
							/>
						</div>
					</Section>

					<Section title="Operational Work">
						<div className="space-y-3">
							{detail.invitations.active.map((invitation) => (
								<div className="rounded-md border p-3" key={invitation._id}>
									<div className="flex items-center justify-between gap-3">
										<span className="text-sm">
											Invitation {formatAdminEnum(invitation.status)}
										</span>
										<div className="flex gap-2">
											<button
												className="rounded-md border px-3 py-2 text-sm"
												onClick={() =>
													void resendInvitation({ dealId: invitation.dealId })
												}
												type="button"
											>
												Resend invitation
											</button>
											<button
												className="rounded-md border px-3 py-2 text-sm"
												onClick={() =>
													void cancelInvitation({
														invitationId: invitation._id,
													})
												}
												type="button"
											>
												Cancel invitation
											</button>
										</div>
									</div>
								</div>
							))}
							{primaryDeal ? (
								<div className="rounded-md border p-3">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<span className="text-sm">
											Deal {formatAdminEnum(primaryDeal.status)}
										</span>
										<div className="flex flex-wrap gap-2">
											<button
												className="rounded-md border px-3 py-2 text-sm"
												onClick={() => {
													setError(null);
													setEvidenceMode("verify");
												}}
												type="button"
											>
												Verify representation
											</button>
											<button
												className="rounded-md border px-3 py-2 text-sm"
												onClick={() => setShowReplace((current) => !current)}
												type="button"
											>
												Replace lawyer
											</button>
											<a
												className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm"
												href={`/admin/deals/${primaryDeal._id}`}
											>
												<ExternalLink aria-hidden="true" className="size-4" />
												Jump to deal
											</a>
										</div>
									</div>
								</div>
							) : null}
							<button
								className="rounded-md bg-secondary px-3 py-2 font-medium text-secondary-foreground text-sm"
								onClick={() => {
									setError(null);
									setEvidenceMode("override");
								}}
								type="button"
							>
								Override representation
							</button>
							{evidenceMode ? (
								<div className="rounded-md border p-3">
									<label className="block font-medium text-sm">
										{evidenceMode === "verify"
											? "Verification evidence note"
											: "Evidence note"}
										<textarea
											aria-label={
												evidenceMode === "verify"
													? "Verification evidence note"
													: "Evidence note"
											}
											className="mt-1 min-h-24 w-full rounded-md border bg-background px-3 py-2 font-normal"
											onChange={(event) => {
												setError(null);
												setEvidenceNote(event.target.value);
											}}
											onInput={(event) => {
												setError(null);
												setEvidenceNote(event.currentTarget.value);
											}}
											value={evidenceNote}
										/>
									</label>
									{error ? (
										<p className="mt-2 text-destructive text-sm">{error}</p>
									) : null}
									<button
										className="mt-3 rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm"
										onClick={submitEvidence}
										type="button"
									>
										{evidenceMode === "verify"
											? "Submit verification"
											: "Submit override"}
									</button>
								</div>
							) : null}
							{showReplace ? (
								<div className="rounded-md border p-3">
									<label className="block text-sm">
										Replacement name
										<input
											className="mt-1 h-9 w-full rounded-md border bg-background px-3"
											onChange={(event) => setReplaceName(event.target.value)}
											value={replaceName}
										/>
									</label>
									<label className="mt-2 block text-sm">
										Replacement email
										<input
											className="mt-1 h-9 w-full rounded-md border bg-background px-3"
											onChange={(event) => setReplaceEmail(event.target.value)}
											value={replaceEmail}
										/>
									</label>
									<label className="mt-2 block text-sm">
										Replacement firm
										<input
											className="mt-1 h-9 w-full rounded-md border bg-background px-3"
											onChange={(event) => setReplaceFirm(event.target.value)}
											value={replaceFirm}
										/>
									</label>
									<button
										className="mt-3 rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm"
										onClick={submitReplacement}
										type="button"
									>
										Submit replacement
									</button>
								</div>
							) : null}
							{activeInvitation || primaryDeal ? null : (
								<p className="text-muted-foreground text-sm">
									No open operational actions.
								</p>
							)}
						</div>
					</Section>

					<Section title="Deals">
						<p className="text-muted-foreground text-sm">
							{detail.deals.active.length} active, {detail.deals.recent.length}{" "}
							recent
						</p>
					</Section>

					<Section title="Verifications">
						<p className="text-muted-foreground text-sm">
							{detail.verifications.length === 0
								? "No verification history"
								: `${detail.verifications.length} verification records`}
						</p>
					</Section>

					<Section title="Invitations">
						<p className="text-muted-foreground text-sm">
							{detail.invitations.active.length} active,{" "}
							{detail.invitations.historical.length} historical
						</p>
					</Section>

					<Section title="Platform Ops">
						<div className="grid grid-cols-2 gap-2 text-sm">
							<Snapshot
								label="Capacity"
								value={
									detail.platform.assignment
										? String(detail.platform.assignment.capacityLimit)
										: "Unassigned"
								}
							/>
							<Snapshot
								label="Availability"
								value={`${detail.platform.availability.windows.length} windows`}
							/>
							<Snapshot
								label="Exceptions"
								value={`${detail.platform.availability.exceptions.length} exceptions`}
							/>
							<Snapshot
								label="Escalations"
								value={`${detail.platform.escalations.length} open`}
							/>
						</div>
					</Section>

					<Section title="Audit / Activity">
						<ul className="space-y-2">
							{detail.activity.events.map((event) => (
								<li
									className="text-sm"
									key={`${event.kind}-${event.entityId}-${event.at}`}
								>
									<span className="font-medium">{event.label}</span>
									<span className="block text-muted-foreground text-xs">
										{new Date(event.at).toLocaleString()}
									</span>
								</li>
							))}
						</ul>
					</Section>
				</div>
			</div>
		</div>
	);
}

function Section(props: {
	readonly children: React.ReactNode;
	readonly title: string;
}) {
	return (
		<section>
			<h3 className="font-medium">{props.title}</h3>
			<div className="mt-2">{props.children}</div>
		</section>
	);
}

function Snapshot(props: { readonly label: string; readonly value: string }) {
	return (
		<div className="rounded-md border p-2">
			<span className="block text-muted-foreground text-xs">{props.label}</span>
			<span>{props.value}</span>
		</div>
	);
}
