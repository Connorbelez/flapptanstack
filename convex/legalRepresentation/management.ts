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
import { authedMutation, type Viewer } from "../fluent";
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
		const invitation = await latestPendingInvitation(ctx, {
			dealId: args.dealId,
			now,
		});
		const token = await createGuestInvitationDelivery(ctx, {
			baseUrl: args.baseUrl,
			createdBy: ctx.viewer.authId,
			deal,
			expiresAt: invitation.expiresAt,
			now,
			selectedLawyer:
				invitation.selectedLawyerSnapshot.type === "guest_lawyer"
					? invitation.selectedLawyerSnapshot
					: undefined,
			targetEmail: invitation.targetEmail,
		});
		await revokeActiveGuestInvitationsForDeal(ctx, {
			dealId: args.dealId,
			exceptInvitationId: token.invitationId,
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
				previousInvitationId: String(invitation._id),
			},
			now,
			payload: {
				expiresAt: invitation.expiresAt,
				targetEmail: invitation.targetEmail,
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
