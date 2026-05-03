import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { assertDealAccess } from "../authz/resourceAccess";
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
type DealAccessRow = Doc<"dealAccess">;
type DealPaymentProofRow = Doc<"dealPaymentProofs">;
type DealDocumentPackageSurface = Awaited<
	ReturnType<typeof readDealDocumentPackageSurface>
>;

interface PortalViewerProjection {
	authId: string;
	email: string | null;
	isFairLendAdmin: boolean;
	persona: DealPortalPersona;
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

interface DealPortalWorkspace {
	activeScreen: DealPortalScreen;
	blockers: PortalBlocker[];
	capabilities: DealPortalCapability[];
	completion: CompletionProjection;
	deal: PortalDealProjection;
	documents: DealDocumentPackageSurface;
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

function activeAccessRowsForViewer(
	accessRows: readonly DealAccessRow[],
	viewer: Viewer
) {
	const normalizedViewerEmail = normalizeEmail(
		viewer.verifiedEmail ?? viewer.email
	);
	return accessRows.filter((row) => {
		if (row.status !== "active") {
			return false;
		}
		if (row.userId === viewer.authId) {
			return true;
		}
		return (
			row.role === "guest_lawyer" &&
			normalizedViewerEmail !== null &&
			normalizeEmail(row.userId) === normalizedViewerEmail
		);
	});
}

function hasActiveRole(
	activeAccessRows: readonly DealAccessRow[],
	roles: ReadonlySet<DealAccessRow["role"]>
) {
	return activeAccessRows.some((row) => roles.has(row.role));
}

function selectedLawyerMatchesViewer(deal: Doc<"deals">, viewer: Viewer) {
	const normalizedViewerEmail = normalizeEmail(
		viewer.verifiedEmail ?? viewer.email
	);
	const selectedLawyerEmail = normalizeEmail(deal.selectedLawyer?.email);
	const selectedLawyerId =
		deal.selectedLawyer?.type === "platform_lawyer"
			? deal.selectedLawyer.lawyerId
			: undefined;

	return (
		deal.lawyerId === viewer.authId ||
		selectedLawyerId === viewer.authId ||
		(normalizedViewerEmail !== null &&
			selectedLawyerEmail === normalizedViewerEmail)
	);
}

function resolveViewerPersona(args: {
	activeAccessRows: readonly DealAccessRow[];
	deal: Doc<"deals">;
	viewer: Viewer;
}): DealPortalPersona {
	if (args.viewer.isFairLendAdmin) {
		return "admin";
	}
	if (
		args.deal.buyerId === args.viewer.authId ||
		hasActiveRole(args.activeAccessRows, new Set(["lender"]))
	) {
		return "lender";
	}
	if (
		hasActiveRole(
			args.activeAccessRows,
			new Set(["guest_lawyer", "platform_lawyer"])
		) ||
		selectedLawyerMatchesViewer(args.deal, args.viewer)
	) {
		return "selected_lawyer";
	}
	if (
		hasActiveRole(
			args.activeAccessRows,
			new Set(["assigned_broker", "broker_of_record"])
		)
	) {
		return "broker";
	}
	if (
		args.deal.sellerId === args.viewer.authId ||
		hasActiveRole(args.activeAccessRows, new Set(["borrower"]))
	) {
		return "seller";
	}

	throw new ConvexError("Forbidden: no deal portal persona for viewer");
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

	if (args.persona === "admin") {
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

	if (args.persona === "admin" || args.persona === "lender") {
		if (args.representation.actions.resendInvitation.allowed) {
			addCapability(capabilities, "representation.invitation.resend");
		}
		if (args.representation.actions.replaceLawyer.allowed) {
			addCapability(capabilities, "representation.lawyer.replace");
		}
	}

	if (
		args.persona === "selected_lawyer" &&
		args.deal.status === "lawyerOnboarding.verified"
	) {
		addCapability(capabilities, "representation.confirm");
	}

	if (
		args.persona === "selected_lawyer" &&
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
}): PortalBlocker[] {
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

export const getDealPortalWorkspace = authedQuery
	.input({ dealId: v.id("deals") })
	.handler(
		async (ctx: PortalQueryCtx, args): Promise<DealPortalWorkspace | null> => {
			const deal = await ctx.db.get(args.dealId);
			if (!deal) {
				return null;
			}

			await assertDealAccess(ctx, args.dealId);

			const [accessRows, viewerUserId] = await Promise.all([
				ctx.db
					.query("dealAccess")
					.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
					.collect(),
				getViewerUserIdByAuthId(ctx, ctx.viewer.authId),
			]);
			const activeViewerAccessRows = activeAccessRowsForViewer(
				accessRows,
				ctx.viewer
			);
			const persona = resolveViewerPersona({
				activeAccessRows: activeViewerAccessRows,
				deal,
				viewer: ctx.viewer,
			});

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
				blockers: buildBlockers({ activeScreen, payment }),
				capabilities: buildCapabilities({
					activeScreen,
					deal,
					persona,
					representation,
				}),
				completion: {
					completed: deal.status === "confirmed",
					completedAt:
						deal.status === "confirmed"
							? (deal.lastTransitionAt ?? null)
							: null,
				},
				deal: projectDeal({ deal, participants }),
				documents,
				participants,
				payment,
				representation,
				viewer: {
					authId: ctx.viewer.authId,
					email: normalizeEmail(ctx.viewer.email),
					isFairLendAdmin: ctx.viewer.isFairLendAdmin,
					persona,
					userId: viewerUserId,
				},
			};
		}
	)
	.public();
