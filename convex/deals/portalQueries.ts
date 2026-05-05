import { ConvexError, v } from "convex/values";
import { resolveDealAccessDecision } from "../../src/lib/deals/access-policy/resolve";
import type {
	DealAccessDecision,
	DealPersonaReadiness,
} from "../../src/lib/deals/access-policy/types";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { readDealDocumentPackageSurface } from "../documents/dealPackages";
import { authedQuery, type Viewer } from "../fluent";
import {
	buildLegalRepresentationStatusProjection,
	type LegalRepresentationStatusProjection,
} from "../legalRepresentation/status";
import {
	buildDealParticipantProjection,
	type DealParticipantProjection,
} from "./participantProjection";
import {
	activeDealPortalScreenForStatus,
	canUploadManualPaymentProof,
	type DealPortalCapability,
	type DealPortalPersona,
	type DealPortalScreen,
	type PortalBlocker,
} from "./portalContracts";

type PortalQueryCtx = Pick<QueryCtx, "db" | "storage"> & { viewer: Viewer };
type DealPaymentProofRow = Doc<"dealPaymentProofs">;
type LawyerOnboardingSessionRow = Doc<"lawyerOnboardingSessions">;
type DealDocumentPackageSurface = Awaited<
	ReturnType<typeof readDealDocumentPackageSurface>
>;

interface PortalViewerProjection {
	authId: string;
	email: string | null;
	isFairLendAdmin: boolean;
	persona: DealPortalPersona;
	readiness: DealPersonaReadiness;
	userId: Id<"users"> | null;
}

interface PortalDealProjection {
	closingDate: number | null;
	createdAt: number;
	dealId: Id<"deals">;
	fractionalShareDisplayPercent: number | null;
	fractionalShareUnits: number;
	lawyerId: string | null;
	lawyerType: Doc<"deals">["lawyerType"] | null;
	lenderId: Id<"lenders"> | null;
	mortgageId: Id<"mortgages">;
	selectedLawyer: Doc<"deals">["selectedLawyer"] | null;
	status: string;
}

interface ParticipantSafePaymentProof {
	amount: number;
	attachmentCount: number;
	currency: "CAD";
	institutionName: string | null;
	note: string | null;
	proofId: Id<"dealPaymentProofs">;
	referenceNumber: string | null;
	reviewedAt: number | null;
	reviewReason: string | null;
	sendingParty: string;
	status: DealPaymentProofRow["status"];
	submittedBy: string;
	submittedByRole: DealPaymentProofRow["submittedByRole"];
	transferDate: number;
}

interface AdminPaymentProofReview {
	amount: number;
	attachmentIds: Id<"documentAssets">[];
	cashLedgerJournalEntryIds: Id<"cash_ledger_journal_entries">[];
	cashLedgerPostingGroupId: string | null;
	currency: "CAD";
	fundsEvidenceId: Id<"dealFundsEvidence"> | null;
	institutionName: string | null;
	leg1TransferId: Id<"transferRequests"> | null;
	leg2TransferId: Id<"transferRequests"> | null;
	note: string | null;
	proofId: Id<"dealPaymentProofs">;
	referenceNumber: string | null;
	reviewedAt: number | null;
	reviewedBy: string | null;
	reviewReason: string | null;
	sendingParty: string;
	status: DealPaymentProofRow["status"];
	submittedBy: string;
	submittedByRole: DealPaymentProofRow["submittedByRole"];
	transferDate: number;
}

interface PaymentProjection {
	adminReview: { proofs: AdminPaymentProofReview[] } | null;
	hasApprovedProof: boolean;
	hasPendingProof: boolean;
	proofs: ParticipantSafePaymentProof[];
}

interface CompletionProjection {
	completed: boolean;
	completedAt: number | null;
}

interface OnboardingProjection {
	nextRoute: string | null;
	required: boolean;
	sessionId: Id<"lawyerOnboardingSessions"> | null;
}

interface DealPortalWorkspace {
	accessDecision: DealAccessDecision;
	activeScreen: DealPortalScreen;
	blockers: PortalBlocker[];
	capabilities: DealPortalCapability[];
	completion: CompletionProjection;
	deal: PortalDealProjection;
	documents: DealDocumentPackageSurface;
	onboarding: OnboardingProjection;
	participants: DealParticipantProjection;
	payment: PaymentProjection;
	representation: LegalRepresentationStatusProjection;
	viewer: PortalViewerProjection;
}

function normalizeEmail(value: string | null | undefined): string | null {
	const trimmed = value?.trim().toLowerCase();
	return trimmed && trimmed.length > 0 ? trimmed : null;
}

async function getViewerUserIdByAuthId(
	ctx: Pick<QueryCtx, "db">,
	authId: string
): Promise<Id<"users"> | null> {
	const user = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", authId))
		.first();
	return user?._id ?? null;
}

async function getActiveOnboardingSessionForViewer(
	ctx: Pick<QueryCtx, "db">,
	args: {
		dealId: Id<"deals">;
		viewer: Viewer;
	}
): Promise<LawyerOnboardingSessionRow | null> {
	const matchingSessions: LawyerOnboardingSessionRow[] = [];
	const email = normalizeEmail(args.viewer.verifiedEmail ?? args.viewer.email);
	if (email) {
		const byEmail = await ctx.db
			.query("lawyerOnboardingSessions")
			.withIndex("by_target_email_deal", (query) =>
				query.eq("normalizedTargetEmail", email).eq("dealId", args.dealId)
			)
			.collect();
		matchingSessions.push(...byEmail);
	}
	const byWorkos = await ctx.db
		.query("lawyerOnboardingSessions")
		.withIndex("by_workos_deal", (query) =>
			query.eq("workosUserId", args.viewer.authId).eq("dealId", args.dealId)
		)
		.collect();
	matchingSessions.push(...byWorkos);

	const byId = new Map<
		Id<"lawyerOnboardingSessions">,
		LawyerOnboardingSessionRow
	>();
	for (const session of matchingSessions) {
		byId.set(session._id, session);
	}
	return (
		[...byId.values()].sort((left, right) => {
			if (right.updatedAt !== left.updatedAt) {
				return right.updatedAt - left.updatedAt;
			}
			if (right.createdAt !== left.createdAt) {
				return right.createdAt - left.createdAt;
			}
			return String(right._id).localeCompare(String(left._id));
		})[0] ?? null
	);
}

function addCapability(
	capabilities: Set<DealPortalCapability>,
	capability: DealPortalCapability
) {
	capabilities.add(capability);
}

function buildCapabilities(args: {
	activeScreen: DealPortalScreen;
	deal: Doc<"deals">;
	persona: DealPortalPersona;
	representation: LegalRepresentationStatusProjection;
}): DealPortalCapability[] {
	const capabilities = new Set<DealPortalCapability>();

	if (args.persona === "fairlend_admin") {
		for (const capability of [
			"representation.adminOverride",
			"documents.generate",
			"payment.proof.review",
			"payment.proof.approve",
			"payment.proof.reject",
		] as const) {
			addCapability(capabilities, capability);
		}
	}

	if (
		args.persona === "fairlend_admin" ||
		args.persona === "purchasing_lender"
	) {
		if (args.representation.actions.resendInvitation.allowed) {
			addCapability(capabilities, "representation.invitation.resend");
		}
		if (args.representation.actions.replaceLawyer.allowed) {
			addCapability(capabilities, "representation.lawyer.replace");
		}
	}

	if (
		args.persona === "primary_lawyer" &&
		args.deal.status === "lawyerOnboarding.verified"
	) {
		addCapability(capabilities, "representation.confirm");
	}
	if (
		(args.persona === "fairlend_admin" || args.persona === "primary_lawyer") &&
		(args.deal.status === "lawyerOnboarding.pending" ||
			args.deal.status === "lawyerOnboarding.verified")
	) {
		addCapability(capabilities, "representation.progressDeal");
	}

	if (
		args.persona === "primary_lawyer" &&
		args.deal.status === "documentReview.pending"
	) {
		addCapability(capabilities, "documents.approve");
	}

	if (
		args.deal.status === "fundsTransfer.pending" &&
		canUploadManualPaymentProof(args.persona)
	) {
		addCapability(capabilities, "payment.proof.upload");
	}

	return [...capabilities].sort();
}

function paymentProofSummary(
	proof: DealPaymentProofRow
): ParticipantSafePaymentProof {
	return {
		amount: proof.amount,
		attachmentCount: proof.attachmentIds.length,
		currency: proof.currency,
		institutionName: proof.institutionName ?? null,
		note: proof.note ?? null,
		proofId: proof._id,
		referenceNumber: proof.referenceNumber ?? null,
		reviewReason: null,
		reviewedAt: proof.reviewedAt ?? null,
		sendingParty: proof.sendingParty,
		status: proof.status,
		submittedBy: proof.submittedBy,
		submittedByRole: proof.submittedByRole,
		transferDate: proof.transferDate,
	};
}

function adminPaymentProofReview(
	proof: DealPaymentProofRow
): AdminPaymentProofReview {
	return {
		amount: proof.amount,
		attachmentIds: proof.attachmentIds,
		cashLedgerJournalEntryIds: proof.cashLedgerJournalEntryIds ?? [],
		cashLedgerPostingGroupId: proof.cashLedgerPostingGroupId ?? null,
		currency: proof.currency,
		fundsEvidenceId: proof.fundsEvidenceId ?? null,
		institutionName: proof.institutionName ?? null,
		leg1TransferId: proof.leg1TransferId ?? null,
		leg2TransferId: proof.leg2TransferId ?? null,
		note: proof.note ?? null,
		proofId: proof._id,
		referenceNumber: proof.referenceNumber ?? null,
		reviewReason: proof.reviewReason ?? null,
		reviewedAt: proof.reviewedAt ?? null,
		reviewedBy: proof.reviewedBy ?? null,
		sendingParty: proof.sendingParty,
		status: proof.status,
		submittedBy: proof.submittedBy,
		submittedByRole: proof.submittedByRole,
		transferDate: proof.transferDate,
	};
}

async function readPaymentProjection(
	ctx: Pick<QueryCtx, "db">,
	args: { dealId: Id<"deals">; isAdmin: boolean }
): Promise<PaymentProjection> {
	const proofs = await ctx.db
		.query("dealPaymentProofs")
		.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
		.collect();
	const orderedProofs = proofs.sort((left, right) => {
		if (right.createdAt !== left.createdAt) {
			return right.createdAt - left.createdAt;
		}
		return String(right._id).localeCompare(String(left._id));
	});

	return {
		adminReview: args.isAdmin
			? { proofs: orderedProofs.map(adminPaymentProofReview) }
			: null,
		hasApprovedProof: orderedProofs.some(
			(proof) => proof.status === "approved"
		),
		hasPendingProof: orderedProofs.some(
			(proof) => proof.status === "pending_review"
		),
		proofs: orderedProofs.map(paymentProofSummary),
	};
}

function buildBlockers(args: {
	activeScreen: DealPortalScreen;
	payment: PaymentProjection;
	persona: DealPortalPersona;
}): PortalBlocker[] {
	if (args.persona === "primary_lawyer") {
		return [];
	}
	if (
		args.activeScreen === "payment" &&
		!(args.payment.hasApprovedProof || args.payment.hasPendingProof)
	) {
		return [
			{
				code: "payment_proof_missing",
				message: "Payment proof is required before funds can be reviewed.",
				recoverableAction: "payment.proof.upload",
				severity: "warning",
			},
		];
	}
	return [];
}

function projectDeal(args: {
	deal: Doc<"deals">;
	participants: DealParticipantProjection;
}): PortalDealProjection {
	return {
		closingDate: args.deal.closingDate ?? null,
		createdAt: args.deal.createdAt,
		dealId: args.deal._id,
		fractionalShareDisplayPercent:
			args.participants.fractionalShareDisplayPercent,
		fractionalShareUnits: args.participants.fractionalShareUnits,
		lawyerId: args.deal.lawyerId ?? null,
		lawyerType: args.deal.lawyerType ?? null,
		lenderId: args.deal.lenderId ?? null,
		mortgageId: args.deal.mortgageId,
		selectedLawyer: args.deal.selectedLawyer ?? null,
		status: args.deal.status,
	};
}

function redactedParticipants(dealId: Id<"deals">): DealParticipantProjection {
	const hiddenLender = {
		accessRole: "lender" as const,
		authId: "redacted",
		displayName: "Hidden until onboarding completes",
		email: null,
		lenderId: null,
		userId: null,
	};
	const hiddenLawyer = {
		authId: null,
		displayName: null,
		email: null,
		hasActiveDealAccess: false,
		lawyerType: null,
	};
	return {
		buyer: hiddenLender,
		dealId,
		fractionalShareDisplayPercent: null,
		fractionalShareStatus: {
			fractionalShareDisplayPercent: null,
			fractionalShareUnits: 0,
			isValid: true,
			validationError: null,
		},
		fractionalShareUnits: 0,
		involvedParties: [],
		lawyer: hiddenLawyer,
		personas: {
			assigned_broker: "assigned_broker",
			broker_of_record: "broker_of_record",
			fairlend_admin: "fairlend_admin",
			primary_borrower: "primary_borrower",
			primary_lawyer: "primary_lawyer",
			purchasing_lender: "purchasing_lender",
			selling_lender: "selling_lender",
		},
		primary_borrower: {
			authId: null,
			borrowerId: null,
			displayName: null,
			email: null,
			persona: "primary_borrower",
			userId: null,
		},
		primary_lawyer: {
			...hiddenLawyer,
			persona: "primary_lawyer",
		},
		purchasing_lender: {
			...hiddenLender,
			persona: "purchasing_lender",
		},
		seller: {
			...hiddenLender,
			borrowerId: null,
		},
		selling_lender: {
			...hiddenLender,
			persona: "selling_lender",
		},
	};
}

function redactedRepresentation(): LegalRepresentationStatusProjection {
	const action = { allowed: false, reason: "onboarding_required" };
	return {
		actions: {
			changeGuestEmail: action,
			replaceLawyer: action,
			resendInvitation: action,
		},
		activeLawyerAccessCount: 0,
		currentInvitation: {
			acceptedAt: null,
			deliveredAt: null,
			deliveryError: null,
			deliveryProvider: null,
			deliveryStatus: null,
			expiresAt: null,
			invitationId: null,
			lastDeliveryAttemptAt: null,
			status: "none",
			targetEmail: null,
			updatedAt: null,
			workosInvitationId: null,
		},
		gate: {
			message: "Complete lawyer onboarding before viewing this deal.",
			reasonCodes: [],
		},
		kind: "blocked",
		label: "Onboarding required",
		overrideEvidence: null,
		selectedLawyer: {
			email: null,
			lawyerId: null,
			name: null,
			type: null,
		},
		showInDealViews: false,
		summary: "Complete lawyer onboarding before viewing this deal.",
	};
}

function onboardingOnlyWorkspace(args: {
	accessDecision: DealAccessDecision;
	deal: Doc<"deals">;
	onboardingSession: LawyerOnboardingSessionRow | null;
	viewer: Viewer;
	viewerUserId: Id<"users"> | null;
}): DealPortalWorkspace {
	const participants = redactedParticipants(args.deal._id);
	const nextRoute =
		args.onboardingSession?.nextRoute ??
		args.accessDecision.redirectTo ??
		(args.onboardingSession
			? `/lawyer/onboarding/${String(args.onboardingSession._id)}`
			: null);
	return {
		accessDecision: args.accessDecision,
		activeScreen: "unavailable",
		blockers: [],
		capabilities: [],
		completion: {
			completed: false,
			completedAt: null,
		},
		deal: {
			closingDate: null,
			createdAt: 0,
			dealId: args.deal._id,
			fractionalShareDisplayPercent: null,
			fractionalShareUnits: 0,
			lawyerId: null,
			lawyerType: null,
			lenderId: null,
			mortgageId: args.deal.mortgageId,
			selectedLawyer: null,
			status: "onboarding_required",
		},
		documents: {
			instances: [],
			package: null,
			participants: null,
		},
		onboarding: {
			nextRoute,
			required: true,
			sessionId: args.onboardingSession?._id ?? null,
		},
		participants,
		payment: {
			adminReview: null,
			hasApprovedProof: false,
			hasPendingProof: false,
			proofs: [],
		},
		representation: redactedRepresentation(),
		viewer: {
			authId: args.viewer.authId,
			email: normalizeEmail(args.viewer.email),
			isFairLendAdmin: args.viewer.isFairLendAdmin,
			persona: args.accessDecision.persona,
			readiness: args.accessDecision.readiness,
			userId: args.viewerUserId,
		},
	};
}

export const getDealPortalWorkspace = authedQuery
	.input({ dealId: v.id("deals") })
	.handler(
		async (ctx: PortalQueryCtx, args): Promise<DealPortalWorkspace | null> => {
			const deal = await ctx.db.get(args.dealId);
			if (!deal) {
				return null;
			}

			const [accessDecision, viewerUserId] = await Promise.all([
				resolveDealAccessDecision(ctx, {
					dealId: args.dealId,
					intent: "deal.portal.view",
					viewer: ctx.viewer,
				}),
				getViewerUserIdByAuthId(ctx, ctx.viewer.authId),
			]);
			if (!accessDecision) {
				return null;
			}
			if (!(accessDecision.allowed || accessDecision.redirectTo)) {
				throw new ConvexError(
					`Forbidden: no deal access for ${String(args.dealId)}`
				);
			}
			const onboardingSession = await getActiveOnboardingSessionForViewer(ctx, {
				dealId: deal._id,
				viewer: ctx.viewer,
			});
			if (!accessDecision.allowed) {
				return onboardingOnlyWorkspace({
					accessDecision,
					deal,
					onboardingSession,
					viewer: ctx.viewer,
					viewerUserId,
				});
			}
			const persona = accessDecision.persona;

			const [representation, participants, documents, payment] =
				await Promise.all([
					buildLegalRepresentationStatusProjection(ctx, { deal }),
					buildDealParticipantProjection(ctx, deal),
					readDealDocumentPackageSurface(ctx, deal._id, {
						isFairLendAdmin: ctx.viewer.isFairLendAdmin,
						userId: viewerUserId ?? undefined,
					}),
					readPaymentProjection(ctx, {
						dealId: deal._id,
						isAdmin: ctx.viewer.isFairLendAdmin,
					}),
				]);
			const activeScreen = activeDealPortalScreenForStatus(deal.status);

			return {
				activeScreen,
				accessDecision,
				blockers: buildBlockers({ activeScreen, payment, persona }),
				capabilities: accessDecision.allowed
					? buildCapabilities({
							activeScreen,
							deal,
							persona,
							representation,
						})
					: [],
				completion: {
					completed: deal.status === "confirmed",
					completedAt:
						deal.status === "confirmed"
							? (deal.lastTransitionAt ?? null)
							: null,
				},
				deal: projectDeal({ deal, participants }),
				documents,
				onboarding: {
					nextRoute:
						onboardingSession?.nextRoute ??
						accessDecision.redirectTo ??
						(onboardingSession
							? `/lawyer/onboarding/${String(onboardingSession._id)}`
							: null),
					required:
						persona === "primary_lawyer" &&
						accessDecision.readiness !== "active",
					sessionId: onboardingSession?._id ?? null,
				},
				participants,
				payment,
				representation,
				viewer: {
					authId: ctx.viewer.authId,
					email: normalizeEmail(ctx.viewer.email),
					isFairLendAdmin: ctx.viewer.isFairLendAdmin,
					persona,
					readiness: accessDecision.readiness,
					userId: viewerUserId,
				},
			};
		}
	)
	.public();
