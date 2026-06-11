import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { assertDealAccess } from "../authz/resourceAccess";
import {
	type SelectedLawyerSnapshot,
	selectedLawyerSnapshotValidator,
} from "../checkout/validators";
import { grantDealAccess } from "../deals/mutations";
import { appendAuditJournalEntry } from "../engine/auditJournal";
import { buildSource } from "../engine/commands";
import { executeTransition } from "../engine/transition";
import { adminMutation, authedMutation, type Viewer } from "../fluent";
import { recordSignedRepresentationEngagementRow } from "./engagements";
import { evaluateDealLegalGate, type LegalGateResult } from "./gates";
import {
	createGuestInvitationDelivery,
	getLatestGuestInvitationForDeal,
	revokeActiveGuestInvitationsForDeal,
} from "./invitations";
import { normalizeLawyerEmail } from "./normalization";
import { buildLegalRepresentationStatusProjection } from "./status";
import { isInvitationExpired } from "./tokenUtils";

type LegalManagementMutationCtx = MutationCtx & { viewer: Viewer };
type LegalManagementQueryCtx = Pick<QueryCtx, "db">;

function hexFromBuffer(buffer: ArrayBuffer) {
	return Array.from(new Uint8Array(buffer))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

async function hashAdminVerificationEvidence(args: {
	readonly attachmentIds: readonly Id<"documentAssets">[];
	readonly dealId: Id<"deals">;
	readonly evidenceNote: string;
	readonly reason: string;
}) {
	const payload = JSON.stringify({
		attachmentIds: [...args.attachmentIds].map(String).sort(),
		dealId: String(args.dealId),
		evidenceNote: args.evidenceNote,
		reason: args.reason,
	});
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(payload)
	);
	return `sha256:${hexFromBuffer(digest)}`;
}

function isLawyerAccessRole(role: Doc<"dealAccess">["role"]) {
	return role === "platform_lawyer" || role === "guest_lawyer";
}

function assertBeforeConfirmation(deal: Doc<"deals">) {
	if (
		deal.status !== "lawyerOnboarding.pending" &&
		deal.status !== "initiated"
	) {
		throw new ConvexError(
			"Lawyer management is only available before lawyer verification completes"
		);
	}
}

async function assertLenderOrAdminDealManagement(
	ctx: LegalManagementMutationCtx,
	dealId: Id<"deals">
) {
	if (ctx.viewer.isFairLendAdmin) {
		return;
	}
	await assertDealAccess(ctx, dealId);
	const lenderAccess = await ctx.db
		.query("dealAccess")
		.withIndex("by_user_and_deal", (query) =>
			query.eq("userId", ctx.viewer.authId).eq("dealId", dealId)
		)
		.filter((query) => query.eq(query.field("status"), "active"))
		.first();
	if (!lenderAccess || lenderAccess.role !== "lender") {
		throw new ConvexError(
			"Only the deal lender or a FairLend admin can manage lawyer assignment"
		);
	}
}

async function latestPendingInvitation(
	ctx: LegalManagementQueryCtx,
	args: { readonly dealId: Id<"deals">; readonly now: number }
) {
	const invitation = await getLatestGuestInvitationForDeal(ctx, args.dealId);
	if (!invitation || invitation.status !== "pending") {
		throw new ConvexError("A pending guest invitation is required");
	}
	if (isInvitationExpired({ expiresAt: invitation.expiresAt, now: args.now })) {
		throw new ConvexError("Expired guest invitations cannot be managed");
	}
	return invitation;
}

async function latestReusableInvitation(
	ctx: LegalManagementQueryCtx,
	args: { readonly dealId: Id<"deals">; readonly now: number }
) {
	const invitation = await getLatestGuestInvitationForDeal(ctx, args.dealId);
	if (
		invitation?.status === "pending" &&
		!isInvitationExpired({ expiresAt: invitation.expiresAt, now: args.now })
	) {
		return invitation;
	}
	return null;
}

async function revokeActiveLawyerAccessForDeal(
	ctx: LegalManagementMutationCtx,
	args: { readonly dealId: Id<"deals">; readonly now: number }
) {
	const rows = await ctx.db
		.query("dealAccess")
		.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
		.collect();
	const revokedIds: Id<"dealAccess">[] = [];
	for (const row of rows) {
		if (row.status === "active" && isLawyerAccessRole(row.role)) {
			await ctx.db.patch(row._id, {
				revokedAt: args.now,
				status: "revoked",
			});
			revokedIds.push(row._id);
		}
	}
	return revokedIds;
}

async function voidPendingRepresentationEngagements(
	ctx: LegalManagementMutationCtx,
	args: { readonly dealId: Id<"deals">; readonly now: number }
) {
	const rows = await ctx.db
		.query("representationEngagements")
		.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
		.collect();
	const voidedIds: Id<"representationEngagements">[] = [];
	for (const row of rows) {
		if (row.status === "pending") {
			await ctx.db.patch(row._id, {
				status: "voided",
				updatedAt: args.now,
			});
			voidedIds.push(row._id);
		}
	}
	return voidedIds;
}

function selectedLawyerAccessTarget(selectedLawyer: SelectedLawyerSnapshot) {
	if (selectedLawyer.type === "platform_lawyer") {
		if (!selectedLawyer.lawyerId) {
			throw new ConvexError("Platform lawyer replacement requires lawyerId");
		}
		return {
			lawyerId: selectedLawyer.lawyerId,
			lawyerType: selectedLawyer.type,
			userId: selectedLawyer.lawyerId,
		};
	}
	const normalizedEmail = normalizeLawyerEmail(selectedLawyer.email);
	return {
		lawyerId: normalizedEmail,
		lawyerType: selectedLawyer.type,
		userId: normalizedEmail,
	};
}

function requireNonEmptyTrimmed(value: string, fieldName: string) {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		throw new ConvexError(`${fieldName} is required`);
	}
	return trimmed;
}

function resolveSelectedLawyerAuthId(deal: Doc<"deals">) {
	if (deal.lawyerId && deal.lawyerId.trim().length > 0) {
		if (deal.selectedLawyer?.type === "guest_lawyer") {
			return normalizeLawyerEmail(deal.lawyerId);
		}
		return deal.lawyerId;
	}
	if (deal.selectedLawyer?.type === "platform_lawyer") {
		return deal.selectedLawyer.lawyerId;
	}
	if (deal.selectedLawyer?.type === "guest_lawyer") {
		return normalizeLawyerEmail(deal.selectedLawyer.email);
	}
	return null;
}

async function assertDocumentAssetsExist(
	ctx: LegalManagementMutationCtx,
	attachmentIds: readonly Id<"documentAssets">[]
) {
	for (const attachmentId of attachmentIds) {
		const asset = await ctx.db.get(attachmentId);
		if (!asset) {
			throw new ConvexError(
				`Representation override attachment not found: ${String(attachmentId)}`
			);
		}
	}
}

function throwLegalGateBlocked(gate: LegalGateResult): never {
	throw new ConvexError({
		code: "LEGAL_REPRESENTATION_GATE_BLOCKED",
		message: gate.message,
		reasonCodes: [...gate.reasonCodes],
	});
}

async function recordLegalManagementAudit(
	ctx: LegalManagementMutationCtx,
	args: {
		readonly afterState: Record<string, unknown>;
		readonly beforeState: Record<string, unknown>;
		readonly deal: Doc<"deals">;
		readonly eventType: string;
		readonly linkedRecordIds?: Record<string, unknown>;
		readonly now: number;
		readonly payload: Record<string, unknown>;
	}
) {
	const source = buildSource(
		ctx.viewer,
		ctx.viewer.isFairLendAdmin ? "admin_dashboard" : "borrower_portal"
	);
	return await appendAuditJournalEntry(ctx, {
		actorId: source.actorId ?? ctx.viewer.authId,
		actorType: source.actorType,
		afterState: args.afterState,
		beforeState: args.beforeState,
		channel: source.channel,
		entityId: String(args.deal._id),
		entityType: "deal",
		eventCategory: "legal_representation_management",
		eventType: args.eventType,
		linkedRecordIds: {
			dealId: String(args.deal._id),
			mortgageId: String(args.deal.mortgageId),
			...args.linkedRecordIds,
		},
		mortgageId: String(args.deal.mortgageId),
		newState: String(args.afterState.kind ?? "unknown"),
		organizationId: ctx.viewer.orgId,
		outcome: "transitioned",
		payload: args.payload,
		previousState: String(args.beforeState.kind ?? "unknown"),
		timestamp: args.now,
	});
}

function statusAuditSnapshot(projection: {
	readonly activeLawyerAccessCount: number;
	readonly currentInvitation: {
		readonly invitationId: Id<"lawyerInvitations"> | null;
		readonly status: Doc<"lawyerInvitations">["status"] | "none";
		readonly targetEmail: string | null;
	};
	readonly kind: string;
	readonly selectedLawyer: {
		readonly lawyerId: string | null;
		readonly name: string | null;
		readonly type: Doc<"deals">["lawyerType"] | null;
	};
}) {
	return {
		activeLawyerAccessCount: projection.activeLawyerAccessCount,
		currentInvitationId:
			projection.currentInvitation.invitationId === null
				? null
				: String(projection.currentInvitation.invitationId),
		invitationStatus: projection.currentInvitation.status,
		kind: projection.kind,
		lawyerId: projection.selectedLawyer.lawyerId,
		lawyerName: projection.selectedLawyer.name,
		lawyerType: projection.selectedLawyer.type,
		targetEmail: projection.currentInvitation.targetEmail,
	};
}

export const adminOverrideRepresentationConfirmation = adminMutation
	.input({
		attachmentIds: v.optional(v.array(v.id("documentAssets"))),
		dealId: v.id("deals"),
		evidenceNote: v.string(),
		reason: v.string(),
	})
	.handler(async (ctx, args) => {
		const reason = requireNonEmptyTrimmed(args.reason, "Override reason");
		const evidenceNote = requireNonEmptyTrimmed(
			args.evidenceNote,
			"Override evidence note"
		);
		const attachmentIds = args.attachmentIds ?? [];
		const deal = await ctx.db.get(args.dealId);
		if (!deal) {
			throw new ConvexError("Deal not found");
		}
		if (deal.status !== "lawyerOnboarding.verified") {
			throw new ConvexError(
				`Admin representation override requires deal status lawyerOnboarding.verified; found ${deal.status}`
			);
		}
		if (!deal.selectedLawyer) {
			throw new ConvexError(
				"Admin representation override requires a selected lawyer"
			);
		}
		const lawyerAuthId = resolveSelectedLawyerAuthId(deal);
		if (!lawyerAuthId) {
			throw new ConvexError(
				"Admin representation override requires selected lawyer auth identity"
			);
		}
		await assertDocumentAssetsExist(ctx, attachmentIds);
		const now = Date.now();
		const overrideEvidenceId = await ctx.db.insert(
			"representationOverrideEvidence",
			{
				adminActorId: ctx.viewer.authId,
				attachmentIds,
				createdAt: now,
				dealId: args.dealId,
				evidenceNote,
				reason,
				selectedLawyerSnapshot: deal.selectedLawyer,
			}
		);
		const engagementId = await recordSignedRepresentationEngagementRow(ctx, {
			createdAt: now,
			dealId: args.dealId,
			evidenceHash: `sha256:admin-override:${overrideEvidenceId}`,
			lawyerAuthId,
			provider: "manual_admin",
			signedAt: now,
		});
		const gateDeal =
			deal.lawyerId === lawyerAuthId
				? deal
				: { ...deal, lawyerId: lawyerAuthId };
		const gate = await evaluateDealLegalGate(ctx, {
			access: { requireActiveAccess: true },
			checkpoint: "REPRESENTATION_CONFIRMED",
			deal: gateDeal,
		});
		if (gate.decision !== "allow") {
			throwLegalGateBlocked(gate);
		}
		const transition = await executeTransition(ctx, {
			entityId: args.dealId,
			entityType: "deal",
			eventType: "REPRESENTATION_CONFIRMED",
			source: buildSource(ctx.viewer, "admin_dashboard"),
		});
		if (!transition.success) {
			throw new ConvexError(
				transition.reason ?? "Representation confirmation transition rejected"
			);
		}
		if (!transition.journalEntryId) {
			throw new ConvexError(
				"Representation confirmation transition did not return a journal entry"
			);
		}
		await ctx.db.patch(overrideEvidenceId, {
			engagementId,
			transitionJournalEntryId: transition.journalEntryId,
		});
		return {
			engagementId,
			overrideEvidenceId,
			transition,
		};
	})
	.public();

export const adminVerifyRepresentationConfirmation = adminMutation
	.input({
		attachmentIds: v.optional(v.array(v.id("documentAssets"))),
		dealId: v.id("deals"),
		evidenceNote: v.string(),
		reason: v.string(),
	})
	.handler(async (ctx, args) => {
		const reason = requireNonEmptyTrimmed(args.reason, "Verification reason");
		const evidenceNote = requireNonEmptyTrimmed(
			args.evidenceNote,
			"Verification evidence note"
		);
		const attachmentIds = args.attachmentIds ?? [];
		const deal = await ctx.db.get(args.dealId);
		if (!deal) {
			throw new ConvexError("Deal not found");
		}
		if (deal.status !== "lawyerOnboarding.verified") {
			throw new ConvexError(
				`Admin representation verification requires deal status lawyerOnboarding.verified; found ${deal.status}`
			);
		}
		if (!deal.selectedLawyer) {
			throw new ConvexError(
				"Admin representation verification requires a selected lawyer"
			);
		}
		const lawyerAuthId = resolveSelectedLawyerAuthId(deal);
		if (!lawyerAuthId) {
			throw new ConvexError(
				"Admin representation verification requires selected lawyer auth identity"
			);
		}
		await assertDocumentAssetsExist(ctx, attachmentIds);
		const now = Date.now();
		const evidenceHash = await hashAdminVerificationEvidence({
			attachmentIds,
			dealId: args.dealId,
			evidenceNote,
			reason,
		});
		const engagementId = await recordSignedRepresentationEngagementRow(ctx, {
			createdAt: now,
			dealId: args.dealId,
			evidenceHash,
			lawyerAuthId,
			provider: "manual_admin",
			signedAt: now,
		});
		const gateDeal =
			deal.lawyerId === lawyerAuthId
				? deal
				: { ...deal, lawyerId: lawyerAuthId };
		const gate = await evaluateDealLegalGate(ctx, {
			access: { requireActiveAccess: true },
			checkpoint: "REPRESENTATION_CONFIRMED",
			deal: gateDeal,
		});
		if (gate.decision !== "allow") {
			throwLegalGateBlocked(gate);
		}
		const transition = await executeTransition(ctx, {
			entityId: args.dealId,
			entityType: "deal",
			eventType: "REPRESENTATION_CONFIRMED",
			source: buildSource(ctx.viewer, "admin_dashboard"),
		});
		if (!transition.success) {
			throw new ConvexError(
				transition.reason ?? "Representation confirmation transition rejected"
			);
		}
		await recordLegalManagementAudit(ctx, {
			afterState: {
				engagementId: String(engagementId),
				kind: "representation_verified",
			},
			beforeState: { kind: "lawyerOnboarding.verified" },
			deal,
			eventType: "LEGAL_REPRESENTATION_CONFIRMED_BY_ADMIN",
			linkedRecordIds: {
				attachmentIds: attachmentIds.map(String),
				engagementId: String(engagementId),
				transitionJournalEntryId: transition.journalEntryId,
			},
			now,
			payload: {
				evidenceNote,
				reason,
			},
		});
		return {
			engagementId,
			transition,
		};
	})
	.public();

export const resendLegalRepresentationInvitation = authedMutation
	.input({
		baseUrl: v.optional(v.string()),
		dealId: v.id("deals"),
		now: v.optional(v.number()),
	})
	.handler(async (ctx, args) => {
		const now = args.now ?? Date.now();
		await assertLenderOrAdminDealManagement(ctx, args.dealId);
		const deal = await ctx.db.get(args.dealId);
		if (!deal) {
			throw new ConvexError("Deal not found");
		}
		assertBeforeConfirmation(deal);
		const before = statusAuditSnapshot(
			await buildLegalRepresentationStatusProjection(ctx, { deal, now })
		);
		const invitation = await latestReusableInvitation(ctx, {
			dealId: args.dealId,
			now,
		});
		if (!invitation && deal.selectedLawyer?.type !== "guest_lawyer") {
			throw new ConvexError("A guest lawyer selection is required");
		}
		const token = await createGuestInvitationDelivery(ctx, {
			baseUrl: args.baseUrl,
			createdBy: ctx.viewer.authId,
			deal,
			expiresAt: invitation?.expiresAt,
			now,
			scheduleDelivery: true,
			selectedLawyer:
				invitation?.selectedLawyerSnapshot.type === "guest_lawyer"
					? invitation.selectedLawyerSnapshot
					: undefined,
			targetEmail: invitation?.targetEmail,
			workosInvitationId: invitation?.workosInvitationId,
		});
		await revokeActiveGuestInvitationsForDeal(ctx, {
			dealId: args.dealId,
			exceptInvitationId: token.invitationId,
			exceptWorkosInvitationId: invitation?.workosInvitationId,
			now,
		});
		const afterDeal = (await ctx.db.get(args.dealId)) ?? deal;
		const after = statusAuditSnapshot(
			await buildLegalRepresentationStatusProjection(ctx, {
				deal: afterDeal,
				now,
			})
		);
		await recordLegalManagementAudit(ctx, {
			afterState: after,
			beforeState: before,
			deal: afterDeal,
			eventType: "LEGAL_REPRESENTATION_INVITATION_RESENT",
			linkedRecordIds: {
				newInvitationId: String(token.invitationId),
				previousInvitationId: invitation ? String(invitation._id) : undefined,
			},
			now,
			payload: {
				expiresAt: invitation?.expiresAt,
				targetEmail: invitation?.targetEmail ?? deal.selectedLawyer?.email,
			},
		});
		return token;
	})
	.public();

export const changeLegalRepresentationGuestEmail = authedMutation
	.input({
		baseUrl: v.optional(v.string()),
		dealId: v.id("deals"),
		newEmail: v.string(),
		now: v.optional(v.number()),
	})
	.handler(async (ctx, args) => {
		const now = args.now ?? Date.now();
		await assertLenderOrAdminDealManagement(ctx, args.dealId);
		const deal = await ctx.db.get(args.dealId);
		if (!deal) {
			throw new ConvexError("Deal not found");
		}
		assertBeforeConfirmation(deal);
		if (!deal.selectedLawyer || deal.selectedLawyer.type !== "guest_lawyer") {
			throw new ConvexError("Guest lawyer selection is required");
		}
		const before = statusAuditSnapshot(
			await buildLegalRepresentationStatusProjection(ctx, { deal, now })
		);
		const invitation = await latestPendingInvitation(ctx, {
			dealId: args.dealId,
			now,
		});
		const normalizedEmail = normalizeLawyerEmail(args.newEmail);
		const selectedLawyer: SelectedLawyerSnapshot = {
			...deal.selectedLawyer,
			email: args.newEmail,
		};
		await revokeActiveLawyerAccessForDeal(ctx, { dealId: args.dealId, now });
		await revokeActiveGuestInvitationsForDeal(ctx, {
			dealId: args.dealId,
			now,
		});
		await ctx.db.patch(args.dealId, {
			lawyerId: normalizedEmail,
			lawyerType: "guest_lawyer",
			selectedLawyer,
		});
		const accessId = await grantDealAccess(ctx.db, {
			dealId: args.dealId,
			grantedBy: `legal-management:${ctx.viewer.authId}`,
			role: "guest_lawyer",
			userId: normalizedEmail,
		});
		const patchedDeal = (await ctx.db.get(args.dealId)) ?? {
			...deal,
			lawyerId: normalizedEmail,
			selectedLawyer,
		};
		const token = await createGuestInvitationDelivery(ctx, {
			baseUrl: args.baseUrl,
			createdBy: ctx.viewer.authId,
			deal: patchedDeal,
			expiresAt: invitation.expiresAt,
			now,
			scheduleDelivery: true,
			selectedLawyer: selectedLawyer as Extract<
				SelectedLawyerSnapshot,
				{ type: "guest_lawyer" }
			>,
			targetEmail: args.newEmail,
		});
		const after = statusAuditSnapshot(
			await buildLegalRepresentationStatusProjection(ctx, {
				deal: patchedDeal,
				now,
			})
		);
		await recordLegalManagementAudit(ctx, {
			afterState: after,
			beforeState: before,
			deal: patchedDeal,
			eventType: "LEGAL_REPRESENTATION_GUEST_EMAIL_CHANGED",
			linkedRecordIds: {
				accessId: String(accessId),
				newInvitationId: String(token.invitationId),
				previousInvitationId: String(invitation._id),
			},
			now,
			payload: {
				newTargetEmail: args.newEmail,
				normalizedNewTargetEmail: normalizedEmail,
				previousTargetEmail: invitation.targetEmail,
			},
		});
		return {
			...token,
			accessId,
			normalizedTargetEmail: normalizedEmail,
		};
	})
	.public();

export const replaceLegalRepresentationLawyer = authedMutation
	.input({
		baseUrl: v.optional(v.string()),
		dealId: v.id("deals"),
		newSelectedLawyer: selectedLawyerSnapshotValidator,
		now: v.optional(v.number()),
	})
	.handler(async (ctx, args) => {
		const now = args.now ?? Date.now();
		await assertLenderOrAdminDealManagement(ctx, args.dealId);
		const deal = await ctx.db.get(args.dealId);
		if (!deal) {
			throw new ConvexError("Deal not found");
		}
		assertBeforeConfirmation(deal);
		const before = statusAuditSnapshot(
			await buildLegalRepresentationStatusProjection(ctx, { deal, now })
		);
		const target = selectedLawyerAccessTarget(args.newSelectedLawyer);
		const [revokedAccessIds, voidedEngagementIds] = await Promise.all([
			revokeActiveLawyerAccessForDeal(ctx, { dealId: args.dealId, now }),
			voidPendingRepresentationEngagements(ctx, { dealId: args.dealId, now }),
		]);
		await revokeActiveGuestInvitationsForDeal(ctx, {
			dealId: args.dealId,
			now,
		});
		await ctx.db.patch(args.dealId, {
			lawyerId: target.lawyerId,
			lawyerType: target.lawyerType,
			selectedLawyer: args.newSelectedLawyer,
		});
		const accessId = await grantDealAccess(ctx.db, {
			dealId: args.dealId,
			grantedBy: `legal-management:${ctx.viewer.authId}`,
			role: target.lawyerType,
			userId: target.userId,
		});
		const patchedDeal = (await ctx.db.get(args.dealId)) ?? {
			...deal,
			lawyerId: target.lawyerId,
			lawyerType: target.lawyerType,
			selectedLawyer: args.newSelectedLawyer,
		};
		const invitation =
			args.newSelectedLawyer.type === "guest_lawyer"
				? await createGuestInvitationDelivery(ctx, {
						baseUrl: args.baseUrl,
						createdBy: ctx.viewer.authId,
						deal: patchedDeal,
						now,
						scheduleDelivery: true,
						selectedLawyer: args.newSelectedLawyer,
						targetEmail: args.newSelectedLawyer.email,
					})
				: null;
		const after = statusAuditSnapshot(
			await buildLegalRepresentationStatusProjection(ctx, {
				deal: patchedDeal,
				now,
			})
		);
		await recordLegalManagementAudit(ctx, {
			afterState: after,
			beforeState: before,
			deal: patchedDeal,
			eventType: "LEGAL_REPRESENTATION_LAWYER_REPLACED",
			linkedRecordIds: {
				accessId: String(accessId),
				newInvitationId:
					invitation === null ? undefined : String(invitation.invitationId),
				revokedAccessIds: revokedAccessIds.map(String),
				voidedEngagementIds: voidedEngagementIds.map(String),
			},
			now,
			payload: {
				newLawyerId: target.lawyerId,
				newLawyerType: target.lawyerType,
				previousLawyerId: deal.lawyerId,
				previousLawyerType: deal.lawyerType,
			},
		});
		return {
			accessId,
			invitation,
			revokedAccessIds,
			voidedEngagementIds,
		};
	})
	.public();
