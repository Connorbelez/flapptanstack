import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { evaluateDealLegalGate, type LegalGateReasonCode } from "./gates";
import { isInvitationExpired } from "./tokenUtils";

type StatusCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

export type LegalRepresentationStatusKind =
	| "not_selected"
	| "platform_selected"
	| "guest_invitation_sent"
	| "guest_invitation_accepted"
	| "guest_invitation_expired"
	| "guest_invitation_revoked"
	| "guest_invitation_failed"
	| "guest_verified"
	| "restriction_check"
	| "confirmation_requested"
	| "confirmed"
	| "blocked";

export interface LegalRepresentationManagementAction {
	readonly allowed: boolean;
	readonly reason: string | null;
}

export interface LegalRepresentationStatusProjection {
	readonly actions: {
		readonly changeGuestEmail: LegalRepresentationManagementAction;
		readonly replaceLawyer: LegalRepresentationManagementAction;
		readonly resendInvitation: LegalRepresentationManagementAction;
	};
	readonly activeLawyerAccessCount: number;
	readonly currentInvitation: {
		readonly acceptedAt: number | null;
		readonly deliveredAt: number | null;
		readonly deliveryError: string | null;
		readonly deliveryProvider:
			| Doc<"lawyerInvitations">["deliveryProvider"]
			| null;
		readonly deliveryStatus: Doc<"lawyerInvitations">["deliveryStatus"] | null;
		readonly expiresAt: number | null;
		readonly invitationId: Id<"lawyerInvitations"> | null;
		readonly lastDeliveryAttemptAt: number | null;
		readonly status: Doc<"lawyerInvitations">["status"] | "none";
		readonly targetEmail: string | null;
		readonly updatedAt: number | null;
		readonly workosInvitationId: string | null;
	};
	readonly gate: {
		readonly message: string;
		readonly reasonCodes: readonly LegalGateReasonCode[];
	};
	readonly kind: LegalRepresentationStatusKind;
	readonly label: string;
	readonly overrideEvidence?: {
		readonly attachmentCount: number;
		readonly createdAt: number;
		readonly engagementId: Id<"representationEngagements"> | null;
		readonly hasAttachments: boolean;
		readonly overrideEvidenceId: Id<"representationOverrideEvidence">;
		readonly transitionJournalEntryId: string | null;
	} | null;
	readonly selectedLawyer: {
		readonly email: string | null;
		readonly lawyerId: string | null;
		readonly name: string | null;
		readonly type: Doc<"deals">["lawyerType"] | null;
	};
	readonly showInDealViews: boolean;
	readonly summary: string;
}

const DOCUMENT_REVIEW_AND_AFTER = new Set([
	"documentReview.pending",
	"documentReview.signed",
	"documentReview.complete",
	"fundsTransfer.pending",
	"fundsTransfer.complete",
	"confirmed",
]);

function managementAction(
	allowed: boolean,
	reason: string | null = null
): LegalRepresentationManagementAction {
	return { allowed, reason };
}

function isDocumentReviewOrAfter(status: string) {
	return DOCUMENT_REVIEW_AND_AFTER.has(status);
}

function displayLawyerName(deal: Doc<"deals">) {
	return deal.selectedLawyer?.name ?? deal.lawyerId ?? null;
}

function latestInvitation(
	invitations: readonly Doc<"lawyerInvitations">[]
): Doc<"lawyerInvitations"> | null {
	return (
		[...invitations].sort((left, right) => {
			if (right.updatedAt !== left.updatedAt) {
				return right.updatedAt - left.updatedAt;
			}
			return right.createdAt - left.createdAt;
		})[0] ?? null
	);
}

function labelForKind(kind: LegalRepresentationStatusKind) {
	switch (kind) {
		case "platform_selected":
			return "Platform lawyer selected";
		case "guest_invitation_sent":
			return "Guest invitation sent";
		case "guest_invitation_accepted":
			return "Guest invitation accepted";
		case "guest_verified":
			return "Guest lawyer verified";
		case "restriction_check":
			return "Restriction check";
		case "confirmation_requested":
			return "Confirmation requested";
		case "confirmed":
			return "Representation confirmed";
		case "guest_invitation_expired":
			return "Guest invitation expired";
		case "guest_invitation_revoked":
			return "Guest invitation revoked";
		case "guest_invitation_failed":
			return "Guest invitation failed";
		case "blocked":
			return "Legal representation blocked";
		case "not_selected":
			return "No lawyer selected";
		default:
			return "Legal representation";
	}
}

function summaryForKind(args: {
	readonly gateMessage: string;
	readonly invitation: Doc<"lawyerInvitations"> | null;
	readonly kind: LegalRepresentationStatusKind;
	readonly lawyerName: string | null;
}) {
	const lawyer = args.lawyerName ?? "the selected lawyer";
	switch (args.kind) {
		case "platform_selected":
			return `${lawyer} is selected and awaiting verification checks.`;
		case "guest_invitation_sent":
			return `Invitation is pending for ${args.invitation?.targetEmail ?? "the guest lawyer"}.`;
		case "guest_invitation_accepted":
			return `${lawyer} accepted the invitation and verification is in progress.`;
		case "guest_verified":
			return `${lawyer} is verified and awaiting representation confirmation.`;
		case "restriction_check":
			return `${lawyer} is awaiting a current restriction check.`;
		case "confirmation_requested":
			return `${lawyer} can confirm representation once engagement evidence is complete.`;
		case "confirmed":
			return `${lawyer} has confirmed representation for this deal.`;
		case "guest_invitation_expired":
			return `The invitation for ${args.invitation?.targetEmail ?? "the guest lawyer"} expired.`;
		case "guest_invitation_revoked":
			return `The invitation for ${args.invitation?.targetEmail ?? "the guest lawyer"} was revoked.`;
		case "guest_invitation_failed":
			return `The invitation for ${args.invitation?.targetEmail ?? "the guest lawyer"} failed verification.`;
		case "blocked":
			return args.gateMessage;
		case "not_selected":
			return "No legal representative is currently selected for this deal.";
		default:
			return args.gateMessage;
	}
}

function statusKind(args: {
	readonly confirmationGateDecision: "allow" | "block" | "requires_review";
	readonly deal: Doc<"deals">;
	readonly invitation: Doc<"lawyerInvitations"> | null;
	readonly now: number;
	readonly verificationGateDecision: "allow" | "block" | "requires_review";
}): LegalRepresentationStatusKind {
	if (isDocumentReviewOrAfter(args.deal.status)) {
		return "confirmed";
	}
	if (!(args.deal.selectedLawyer || args.deal.lawyerId)) {
		return "not_selected";
	}
	if (args.confirmationGateDecision === "requires_review") {
		return "blocked";
	}
	if (args.deal.status === "lawyerOnboarding.verified") {
		return "confirmation_requested";
	}
	if (args.verificationGateDecision === "requires_review") {
		return "blocked";
	}
	if (args.deal.lawyerType === "platform_lawyer") {
		return args.verificationGateDecision === "allow"
			? "confirmation_requested"
			: "platform_selected";
	}
	if (args.deal.lawyerType !== "guest_lawyer") {
		return "restriction_check";
	}
	if (!args.invitation) {
		return args.verificationGateDecision === "allow"
			? "confirmation_requested"
			: "restriction_check";
	}
	if (
		args.invitation.status === "pending" &&
		isInvitationExpired({ expiresAt: args.invitation.expiresAt, now: args.now })
	) {
		return "guest_invitation_expired";
	}
	if (args.invitation.status === "pending") {
		return "guest_invitation_sent";
	}
	if (args.invitation.status === "accepted") {
		return "guest_invitation_accepted";
	}
	if (args.invitation.status === "verified") {
		return "guest_verified";
	}
	if (args.invitation.status === "revoked") {
		return "guest_invitation_revoked";
	}
	if (args.invitation.status === "expired") {
		return "guest_invitation_expired";
	}
	return "guest_invitation_failed";
}

function actionAvailability(args: {
	readonly deal: Doc<"deals">;
	readonly invitation: Doc<"lawyerInvitations"> | null;
	readonly now: number;
}) {
	const beforeVerified = args.deal.status === "lawyerOnboarding.pending";
	const beforeDocumentReview = !isDocumentReviewOrAfter(args.deal.status);
	const guest = args.deal.lawyerType === "guest_lawyer";
	const hasGuestLawyerSelection =
		guest && args.deal.selectedLawyer?.type === "guest_lawyer";
	const pendingInvitation =
		guest &&
		args.invitation?.status === "pending" &&
		!isInvitationExpired({
			expiresAt: args.invitation.expiresAt,
			now: args.now,
		});
	const replaceAllowed = beforeVerified || args.deal.status === "initiated";
	const canSendOrResendInvitation =
		(beforeVerified || args.deal.status === "initiated") &&
		(hasGuestLawyerSelection || pendingInvitation);

	return {
		changeGuestEmail: pendingInvitation
			? managementAction(true)
			: managementAction(
					false,
					guest
						? "Guest email can only be changed while the current invitation is pending."
						: "Only guest lawyer invitations have a contact email to change."
				),
		replaceLawyer:
			beforeDocumentReview && replaceAllowed
				? managementAction(true)
				: managementAction(
						false,
						beforeDocumentReview
							? "Lawyer replacement after verification requires a separate cancellation or reissue flow."
							: "Representation is already confirmed for this deal."
					),
		resendInvitation: canSendOrResendInvitation
			? managementAction(true)
			: managementAction(
					false,
					guest
						? "Guest invitations can only be sent before lawyer verification."
						: "Only guest lawyer invitations can be resent."
				),
	};
}

export async function buildLegalRepresentationStatusProjection(
	ctx: StatusCtx,
	args: {
		readonly deal: Doc<"deals">;
		readonly now?: number;
	}
): Promise<LegalRepresentationStatusProjection> {
	const now = args.now ?? Date.now();
	const [
		invitations,
		accessRows,
		verificationGate,
		confirmationGate,
		overrideEvidence,
	] = await Promise.all([
		ctx.db
			.query("lawyerInvitations")
			.withIndex("by_deal", (query) => query.eq("dealId", args.deal._id))
			.collect(),
		ctx.db
			.query("dealAccess")
			.withIndex("by_deal", (query) => query.eq("dealId", args.deal._id))
			.collect(),
		evaluateDealLegalGate(ctx, {
			checkpoint: "LAWYER_VERIFIED",
			deal: args.deal,
			now,
		}),
		evaluateDealLegalGate(ctx, {
			access: { requireActiveAccess: true },
			checkpoint: "REPRESENTATION_CONFIRMED",
			deal: args.deal,
			now,
		}),
		ctx.db
			.query("representationOverrideEvidence")
			.withIndex("by_deal", (query) => query.eq("dealId", args.deal._id))
			.order("desc")
			.first(),
	]);
	const invitation = latestInvitation(invitations);
	const kind = statusKind({
		confirmationGateDecision: confirmationGate.decision,
		deal: args.deal,
		invitation,
		now,
		verificationGateDecision: verificationGate.decision,
	});
	const lawyerName = displayLawyerName(args.deal);

	return {
		actions: actionAvailability({ deal: args.deal, invitation, now }),
		activeLawyerAccessCount: accessRows.filter(
			(row) =>
				row.status === "active" &&
				(row.role === "platform_lawyer" || row.role === "guest_lawyer")
		).length,
		currentInvitation: {
			acceptedAt: invitation?.acceptedAt ?? null,
			deliveredAt: invitation?.deliveredAt ?? null,
			deliveryError: invitation?.deliveryError ?? null,
			deliveryProvider: invitation?.deliveryProvider ?? null,
			deliveryStatus: invitation?.deliveryStatus ?? null,
			expiresAt: invitation?.expiresAt ?? null,
			invitationId: invitation?._id ?? null,
			lastDeliveryAttemptAt: invitation?.lastDeliveryAttemptAt ?? null,
			status: invitation?.status ?? "none",
			targetEmail: invitation?.targetEmail ?? null,
			updatedAt: invitation?.updatedAt ?? null,
			workosInvitationId: invitation?.workosInvitationId ?? null,
		},
		gate: {
			message:
				confirmationGate.decision === "block"
					? confirmationGate.message
					: verificationGate.message,
			reasonCodes:
				confirmationGate.decision === "block"
					? confirmationGate.reasonCodes
					: verificationGate.reasonCodes,
		},
		kind,
		label: labelForKind(kind),
		overrideEvidence: overrideEvidence
			? {
					attachmentCount: overrideEvidence.attachmentIds?.length ?? 0,
					createdAt: overrideEvidence.createdAt,
					engagementId: overrideEvidence.engagementId ?? null,
					hasAttachments: (overrideEvidence.attachmentIds?.length ?? 0) > 0,
					overrideEvidenceId: overrideEvidence._id,
					transitionJournalEntryId:
						overrideEvidence.transitionJournalEntryId ?? null,
				}
			: null,
		selectedLawyer: {
			email: args.deal.selectedLawyer?.email ?? null,
			lawyerId: args.deal.lawyerId ?? null,
			name: lawyerName,
			type: args.deal.lawyerType ?? null,
		},
		showInDealViews: !isDocumentReviewOrAfter(args.deal.status),
		summary: summaryForKind({
			gateMessage:
				confirmationGate.decision === "block"
					? confirmationGate.message
					: verificationGate.message,
			invitation,
			kind,
			lawyerName,
		}),
	};
}
