import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { SelectedLawyerSnapshot } from "../checkout/validators";
import { adminMutation, authedMutation, convex } from "../fluent";
import {
	normalizeLawyerEmail,
	normalizeLegalSourceSnapshot,
	normalizeLegalWhitespace,
} from "./normalization";
import { startOrResumeForInvitationInMutation } from "./onboarding";
import { buildManualLawyerVerificationResult } from "./providers";
import {
	calculateInvitationExpiry,
	generateInvitationToken,
	hashInvitationToken,
	isInvitationExpired,
} from "./tokenUtils";
import { recordLawyerVerificationRow } from "./verifications";

type LegalRepresentationMutationCtx = Pick<MutationCtx, "db">;
type LegalRepresentationQueryCtx = Pick<QueryCtx, "db">;

const DEFAULT_INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const LAWYER_ACCESS_PERMISSION = "lawyer:access";
const TRAILING_SLASH = /\/$/u;

type GuestSelectedLawyerSnapshot = Extract<
	SelectedLawyerSnapshot,
	{ type: "guest_lawyer" }
>;

export interface GuestInvitationDeliveryResult {
	readonly deliveryStatus: "pending";
	readonly invitationId: Id<"lawyerInvitations">;
	readonly inviteUrl: string;
	readonly token: string;
}

export type InvitationAcceptResult =
	| {
			readonly status: "verified";
			readonly accessId: Id<"dealAccess">;
			readonly dealId: Id<"deals">;
			readonly invitationId: Id<"lawyerInvitations">;
			readonly lawyerProfileId: Id<"lawyerProfiles">;
			readonly verificationId: Id<"lawyerVerifications">;
	  }
	| {
			readonly status:
				| "expired"
				| "failed"
				| "requires_review"
				| "revoked"
				| "used";
			readonly dealId?: Id<"deals">;
			readonly invitationId?: Id<"lawyerInvitations">;
			readonly reason: string;
			readonly verificationId?: Id<"lawyerVerifications">;
	  }
	| {
			readonly status: "onboarding_required";
			readonly dealId: Id<"deals">;
			readonly invitationId: Id<"lawyerInvitations">;
			readonly nextRoute?: string;
			readonly onboardingSessionId: Id<"lawyerOnboardingSessions">;
			readonly returnPath: string;
			readonly targetEmail: string;
	  };

function requiredText(value: string, fieldName: string): string {
	const normalized = normalizeLegalWhitespace(value);
	if (normalized.length === 0) {
		throw new ConvexError(`${fieldName} is required`);
	}
	return normalized;
}

function isActiveInvitationStatus(status: Doc<"lawyerInvitations">["status"]) {
	return status === "pending" || status === "accepted";
}

function isLawyerViewer(viewer: {
	readonly permissions: ReadonlySet<string>;
	readonly role?: string | undefined;
	readonly roles: ReadonlySet<string>;
}) {
	return (
		viewer.role === "lawyer" ||
		viewer.roles.has("lawyer") ||
		viewer.permissions.has(LAWYER_ACCESS_PERMISSION)
	);
}

function assertCanonicalLawyerViewer(viewer: {
	readonly permissions: ReadonlySet<string>;
	readonly role?: string | undefined;
	readonly roles: ReadonlySet<string>;
}) {
	if (!isLawyerViewer(viewer)) {
		throw new ConvexError("Guest invitation acceptance requires lawyer access");
	}
}

function inviteUrl(args: {
	readonly baseUrl?: string;
	readonly token: string;
}) {
	if (!args.baseUrl) {
		return `/lawyer/verify/${encodeURIComponent(args.token)}`;
	}
	return `${args.baseUrl.replace(TRAILING_SLASH, "")}/lawyer/verify/${encodeURIComponent(args.token)}`;
}

function selectedLawyerFromDeal(
	deal: Doc<"deals">
): GuestSelectedLawyerSnapshot {
	if (!deal.selectedLawyer || deal.selectedLawyer.type !== "guest_lawyer") {
		throw new ConvexError("Deal does not have a selected guest lawyer");
	}
	return deal.selectedLawyer;
}

function lsoLawyerIdFromSnapshot(
	selectedLawyer: GuestSelectedLawyerSnapshot
): Id<"lsoLawyers"> | undefined {
	return selectedLawyer.lso?.lsoLawyerId;
}

async function revokeActiveInvitationsForDeal(
	ctx: LegalRepresentationMutationCtx & {
		readonly scheduler?: MutationCtx["scheduler"];
	},
	args: {
		readonly dealId: Id<"deals">;
		readonly exceptInvitationId?: Id<"lawyerInvitations">;
		readonly exceptWorkosInvitationId?: string;
		readonly now: number;
	}
) {
	const rows = await ctx.db
		.query("lawyerInvitations")
		.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
		.collect();
	for (const row of rows) {
		if (
			row._id !== args.exceptInvitationId &&
			isActiveInvitationStatus(row.status)
		) {
			await ctx.db.patch(row._id, {
				status: "revoked",
				updatedAt: args.now,
			});
			if (
				row.workosInvitationId &&
				row.workosInvitationId !== args.exceptWorkosInvitationId &&
				process.env.SKIP_WORKOS_INVITATION_REVOKE !== "true"
			) {
				await ctx.scheduler?.runAfter(
					1,
					internal.legalRepresentation.workosInvitations
						.revokeWorkosInvitationDelivery,
					{
						invitationId: row._id,
						workosInvitationId: row.workosInvitationId,
					}
				);
			}
		}
	}
}

export async function revokeActiveGuestInvitationsForDeal(
	ctx: LegalRepresentationMutationCtx & {
		readonly scheduler?: MutationCtx["scheduler"];
	},
	args: {
		readonly dealId: Id<"deals">;
		readonly exceptInvitationId?: Id<"lawyerInvitations">;
		readonly exceptWorkosInvitationId?: string;
		readonly now: number;
	}
) {
	await revokeActiveInvitationsForDeal(ctx, args);
}

async function getInvitationByToken(
	ctx: LegalRepresentationQueryCtx,
	token: string
): Promise<Doc<"lawyerInvitations"> | null> {
	const tokenHash = await hashInvitationToken(token);
	return await ctx.db
		.query("lawyerInvitations")
		.withIndex("by_token_hash", (query) => query.eq("tokenHash", tokenHash))
		.unique();
}

async function getInvitationByWorkosInvitationId(
	ctx: LegalRepresentationQueryCtx,
	workosInvitationId: string
): Promise<Doc<"lawyerInvitations"> | null> {
	const rows = await ctx.db
		.query("lawyerInvitations")
		.withIndex("by_workos_invitation", (query) =>
			query.eq("workosInvitationId", workosInvitationId)
		)
		.collect();
	return (
		rows.find((row) => row.status === "pending" || row.status === "accepted") ??
		null
	);
}

export async function getLatestGuestInvitationForDeal(
	ctx: LegalRepresentationQueryCtx,
	dealId: Id<"deals">
): Promise<Doc<"lawyerInvitations"> | null> {
	const rows = await ctx.db
		.query("lawyerInvitations")
		.withIndex("by_deal", (query) => query.eq("dealId", dealId))
		.collect();
	return (
		rows.sort((left, right) => {
			if (right.updatedAt !== left.updatedAt) {
				return right.updatedAt - left.updatedAt;
			}
			return right.createdAt - left.createdAt;
		})[0] ?? null
	);
}

async function recordInvitationFailure(
	ctx: LegalRepresentationMutationCtx,
	args: {
		readonly authId?: string;
		readonly invitation: Doc<"lawyerInvitations">;
		readonly now: number;
		readonly reason: string;
	}
) {
	return await recordLawyerVerificationRow(ctx, {
		authId: args.authId,
		barNumber: args.invitation.selectedLawyerSnapshot.lso?.barNumber,
		checkType: "initial_lso",
		createdAt: args.now,
		createdBy: `lawyer-invitation:${String(args.invitation._id)}`,
		dealId: args.invitation.dealId,
		jurisdiction: args.invitation.selectedLawyerSnapshot.lso?.jurisdiction,
		lsoLawyerId: args.invitation.lsoLawyerId,
		normalizedEmail: args.invitation.normalizedTargetEmail,
		providerResult: buildManualLawyerVerificationResult({
			outcome: "failed",
			reasonCodes: ["identity_mismatch"],
			sourceSnapshot: normalizeLegalSourceSnapshot({
				action: "guest_invitation_failed",
				invitationId: String(args.invitation._id),
				reason: args.reason,
			}),
		}),
	});
}

async function acceptInvitationForOnboarding(
	ctx: LegalRepresentationMutationCtx,
	args: {
		readonly authId: string;
		readonly invitation: Doc<"lawyerInvitations">;
		readonly now: number;
	}
): Promise<Extract<InvitationAcceptResult, { status: "onboarding_required" }>> {
	const session = await startOrResumeForInvitationInMutation(ctx, {
		invitationId: args.invitation._id,
		now: args.now,
	});
	await ctx.db.patch(args.invitation._id, {
		acceptedAt: args.invitation.acceptedAt ?? args.now,
		resolvedAuthId: args.authId,
		status: "accepted",
		updatedAt: args.now,
	});
	return {
		dealId: args.invitation.dealId,
		invitationId: args.invitation._id,
		nextRoute: session.nextRoute,
		onboardingSessionId: session._id,
		returnPath: session.returnPath,
		status: "onboarding_required",
		targetEmail: args.invitation.targetEmail,
	};
}

export async function createGuestInvitationDelivery(
	ctx: LegalRepresentationMutationCtx & {
		readonly scheduler?: MutationCtx["scheduler"];
		readonly viewer?: { readonly authId: string };
	},
	args: {
		readonly baseUrl?: string;
		readonly createdBy?: string;
		readonly deal: Doc<"deals">;
		readonly expiresAt?: number;
		readonly now: number;
		readonly scheduleDelivery?: boolean;
		readonly selectedLawyer?: GuestSelectedLawyerSnapshot;
		readonly targetEmail?: string;
		readonly ttlMs?: number;
		readonly workosInvitationId?: string;
	}
): Promise<GuestInvitationDeliveryResult> {
	const selectedLawyer =
		args.selectedLawyer ?? selectedLawyerFromDeal(args.deal);
	const targetEmail = requiredText(
		args.targetEmail ?? selectedLawyer.email,
		"selectedLawyer.email"
	);
	const normalizedTargetEmail = normalizeLawyerEmail(targetEmail);
	const token = await generateInvitationToken();
	const selectedLawyerSnapshot = {
		...selectedLawyer,
		email: targetEmail,
	};
	const invitationId = await ctx.db.insert("lawyerInvitations", {
		createdAt: args.now,
		createdBy:
			args.createdBy ?? ctx.viewer?.authId ?? `system:${String(args.deal._id)}`,
		dealId: args.deal._id,
		deliveryProvider: "workos",
		deliveryStatus: "pending",
		expiresAt:
			args.expiresAt ??
			calculateInvitationExpiry({
				now: args.now,
				ttlMs: args.ttlMs ?? DEFAULT_INVITATION_TTL_MS,
			}),
		lsoLawyerId: lsoLawyerIdFromSnapshot(selectedLawyerSnapshot),
		normalizedTargetEmail,
		selectedLawyerSnapshot,
		status: "pending",
		targetEmail,
		tokenHash: token.tokenHash,
		updatedAt: args.now,
		workosInvitationId: args.workosInvitationId,
	});
	if (
		args.scheduleDelivery &&
		process.env.SKIP_WORKOS_INVITATION_DELIVERY !== "true"
	) {
		await ctx.scheduler?.runAfter(
			1,
			args.workosInvitationId
				? internal.legalRepresentation.workosInvitations
						.resendGuestInvitationDelivery
				: internal.legalRepresentation.workosInvitations.deliverGuestInvitation,
			{ invitationId }
		);
	}
	return {
		deliveryStatus: "pending",
		invitationId,
		inviteUrl: inviteUrl({ baseUrl: args.baseUrl, token: token.token }),
		token: token.token,
	};
}

export const getInvitationStatusByToken = convex
	.query()
	.input({ now: v.optional(v.number()), token: v.string() })
	.handler(async (ctx, args) => {
		const invitation = await getInvitationByToken(ctx, args.token);
		const now = args.now ?? Date.now();
		if (!invitation) {
			return { status: "not_found" as const };
		}
		if (
			invitation.status === "pending" &&
			isInvitationExpired({ expiresAt: invitation.expiresAt, now })
		) {
			return {
				dealId: invitation.dealId,
				expiresAt: invitation.expiresAt,
				status: "expired" as const,
			};
		}
		return {
			dealId: invitation.dealId,
			status: invitation.status,
			expiresAt: invitation.expiresAt,
		};
	})
	.public();

export const createGuestInvitationForDeal = adminMutation
	.input({
		baseUrl: v.optional(v.string()),
		dealId: v.id("deals"),
		deliverViaWorkos: v.optional(v.boolean()),
		now: v.optional(v.number()),
		ttlMs: v.optional(v.number()),
	})
	.handler(async (ctx, args) => {
		const now = args.now ?? Date.now();
		const deal = await ctx.db.get(args.dealId);
		if (!deal) {
			throw new ConvexError("Deal not found");
		}
		const selectedLawyer = selectedLawyerFromDeal(deal);
		const targetEmail = requiredText(
			selectedLawyer.email,
			"selectedLawyer.email"
		);
		const normalizedTargetEmail = normalizeLawyerEmail(targetEmail);
		if (
			deal.lawyerType === "guest_lawyer" &&
			deal.lawyerId !== normalizedTargetEmail
		) {
			throw new ConvexError("Guest lawyer already has a resolved auth ID");
		}
		await revokeActiveInvitationsForDeal(ctx, {
			dealId: deal._id,
			now,
		});
		return await createGuestInvitationDelivery(ctx, {
			baseUrl: args.baseUrl,
			deal,
			now,
			scheduleDelivery: args.deliverViaWorkos,
			selectedLawyer,
			targetEmail,
			ttlMs: args.ttlMs,
		});
	})
	.public();

export const resendGuestInvitation = adminMutation
	.input({
		baseUrl: v.optional(v.string()),
		deliverViaWorkos: v.optional(v.boolean()),
		invitationId: v.id("lawyerInvitations"),
		now: v.optional(v.number()),
		ttlMs: v.optional(v.number()),
	})
	.handler(async (ctx, args) => {
		const now = args.now ?? Date.now();
		const invitation = await ctx.db.get(args.invitationId);
		if (!invitation) {
			throw new ConvexError("Invitation not found");
		}
		await revokeActiveInvitationsForDeal(ctx, {
			dealId: invitation.dealId,
			exceptInvitationId: invitation._id,
			exceptWorkosInvitationId: invitation.workosInvitationId,
			now,
		});
		const token = await generateInvitationToken();
		await ctx.db.patch(invitation._id, {
			acceptedAt: undefined,
			expiresAt:
				args.ttlMs === undefined
					? invitation.expiresAt
					: calculateInvitationExpiry({
							now,
							ttlMs: args.ttlMs,
						}),
			resolvedAuthId: undefined,
			deliveryProvider: "workos",
			deliveryStatus: "pending",
			deliveryError: undefined,
			lastDeliveryAttemptAt: undefined,
			deliveredAt: undefined,
			status: "pending",
			tokenHash: token.tokenHash,
			updatedAt: now,
			verificationId: undefined,
			verifiedAt: undefined,
		});
		if (
			args.deliverViaWorkos &&
			process.env.SKIP_WORKOS_INVITATION_DELIVERY !== "true"
		) {
			await ctx.scheduler.runAfter(
				1,
				invitation.workosInvitationId
					? internal.legalRepresentation.workosInvitations
							.resendGuestInvitationDelivery
					: internal.legalRepresentation.workosInvitations
							.deliverGuestInvitation,
				{ invitationId: invitation._id }
			);
		}
		return {
			deliveryStatus: "pending" as const,
			invitationId: invitation._id,
			inviteUrl: inviteUrl({ baseUrl: args.baseUrl, token: token.token }),
			token: token.token,
		};
	})
	.public();

export const revokeGuestInvitation = adminMutation
	.input({
		invitationId: v.id("lawyerInvitations"),
		now: v.optional(v.number()),
	})
	.handler(async (ctx, args) => {
		const invitation = await ctx.db.get(args.invitationId);
		if (!invitation) {
			return { status: "not_found" as const };
		}
		if (invitation.status === "verified") {
			throw new ConvexError("Verified invitations cannot be revoked");
		}
		await ctx.db.patch(invitation._id, {
			status: "revoked",
			updatedAt: args.now ?? Date.now(),
		});
		return { status: "revoked" as const };
	})
	.public();

export const acceptGuestInvitation = authedMutation
	.input({
		now: v.optional(v.number()),
		token: v.string(),
	})
	.handler(async (ctx, args): Promise<InvitationAcceptResult> => {
		assertCanonicalLawyerViewer(ctx.viewer);
		const now = args.now ?? Date.now();
		const invitation = await getInvitationByToken(ctx, args.token);
		if (!invitation) {
			return { reason: "Invitation token was not found", status: "failed" };
		}
		if (invitation.status === "verified") {
			return {
				dealId: invitation.dealId,
				invitationId: invitation._id,
				reason: "Invitation was already verified",
				status: "used",
				verificationId: invitation.verificationId,
			};
		}
		if (invitation.status === "revoked") {
			return {
				dealId: invitation.dealId,
				invitationId: invitation._id,
				reason: "Invitation was revoked",
				status: "revoked",
			};
		}
		if (
			invitation.status === "expired" ||
			isInvitationExpired({ expiresAt: invitation.expiresAt, now })
		) {
			await ctx.db.patch(invitation._id, {
				status: "expired",
				updatedAt: now,
			});
			return {
				dealId: invitation.dealId,
				invitationId: invitation._id,
				reason: "Invitation expired",
				status: "expired",
			};
		}
		const verifiedEmail = ctx.viewer.verifiedEmail ?? ctx.viewer.email;
		if (!verifiedEmail) {
			const verificationId = await recordInvitationFailure(ctx, {
				authId: ctx.viewer.authId,
				invitation,
				now,
				reason: "missing_verified_email",
			});
			await ctx.db.patch(invitation._id, {
				status: "failed",
				updatedAt: now,
				verificationId,
			});
			return {
				dealId: invitation.dealId,
				invitationId: invitation._id,
				reason: "Verified WorkOS email is required",
				status: "failed",
				verificationId,
			};
		}
		const normalizedVerifiedEmail = normalizeLawyerEmail(verifiedEmail);
		if (normalizedVerifiedEmail !== invitation.normalizedTargetEmail) {
			const verificationId = await recordInvitationFailure(ctx, {
				authId: ctx.viewer.authId,
				invitation,
				now,
				reason: "email_mismatch",
			});
			await ctx.db.patch(invitation._id, {
				status: "failed",
				updatedAt: now,
				verificationId,
			});
			return {
				dealId: invitation.dealId,
				invitationId: invitation._id,
				reason: "Signed-in lawyer email does not match invitation",
				status: "failed",
				verificationId,
			};
		}
		return await acceptInvitationForOnboarding(ctx, {
			authId: ctx.viewer.authId,
			invitation,
			now,
		});
	})
	.public();

const workosInvitationViewerValidator = v.object({
	authId: v.string(),
	email: v.optional(v.string()),
	permissions: v.array(v.string()),
	role: v.optional(v.string()),
	roles: v.array(v.string()),
	verifiedEmail: v.optional(v.string()),
});

export const getPendingInvitationByWorkosInvitationIdInternal = convex
	.query()
	.input({ workosInvitationId: v.string() })
	.handler(async (ctx, args) => {
		return await getInvitationByWorkosInvitationId(
			ctx,
			args.workosInvitationId
		);
	})
	.internal();

export const acceptWorkosInvitationForOnboardingInternal = convex
	.mutation()
	.input({
		invitationEmail: v.string(),
		now: v.optional(v.number()),
		viewer: workosInvitationViewerValidator,
		workosInvitationId: v.string(),
	})
	.handler(async (ctx, args): Promise<InvitationAcceptResult> => {
		const viewer = {
			...args.viewer,
			permissions: new Set(args.viewer.permissions),
			roles: new Set(args.viewer.roles),
		};
		assertCanonicalLawyerViewer(viewer);
		const now = args.now ?? Date.now();
		const invitation = await getInvitationByWorkosInvitationId(
			ctx,
			args.workosInvitationId
		);
		if (!invitation) {
			throw new ConvexError("FairLend lawyer invitation was not found");
		}
		if (
			normalizeLawyerEmail(args.invitationEmail) !==
			invitation.normalizedTargetEmail
		) {
			throw new ConvexError("WorkOS invitation email does not match");
		}
		if (
			invitation.status === "expired" ||
			isInvitationExpired({ expiresAt: invitation.expiresAt, now })
		) {
			await ctx.db.patch(invitation._id, {
				status: "expired",
				updatedAt: now,
			});
			return {
				dealId: invitation.dealId,
				invitationId: invitation._id,
				reason: "Invitation expired",
				status: "expired",
			};
		}
		const verifiedEmail = viewer.verifiedEmail ?? viewer.email;
		if (!verifiedEmail) {
			const verificationId = await recordInvitationFailure(ctx, {
				authId: viewer.authId,
				invitation,
				now,
				reason: "missing_verified_email",
			});
			await ctx.db.patch(invitation._id, {
				status: "failed",
				updatedAt: now,
				verificationId,
			});
			return {
				dealId: invitation.dealId,
				invitationId: invitation._id,
				reason: "Verified WorkOS email is required",
				status: "failed",
				verificationId,
			};
		}
		if (
			normalizeLawyerEmail(verifiedEmail) !== invitation.normalizedTargetEmail
		) {
			const verificationId = await recordInvitationFailure(ctx, {
				authId: viewer.authId,
				invitation,
				now,
				reason: "email_mismatch",
			});
			await ctx.db.patch(invitation._id, {
				status: "failed",
				updatedAt: now,
				verificationId,
			});
			return {
				dealId: invitation.dealId,
				invitationId: invitation._id,
				reason: "Signed-in lawyer email does not match invitation",
				status: "failed",
				verificationId,
			};
		}
		return await acceptInvitationForOnboarding(ctx, {
			authId: viewer.authId,
			invitation,
			now,
		});
	})
	.internal();

export const acceptGuestInvitationByWorkosInvitationInternal = convex
	.mutation()
	.input({
		invitationEmail: v.string(),
		now: v.optional(v.number()),
		viewer: workosInvitationViewerValidator,
		workosInvitationId: v.string(),
	})
	.handler(async (ctx, args): Promise<InvitationAcceptResult> => {
		const viewer = {
			...args.viewer,
			permissions: new Set(args.viewer.permissions),
			roles: new Set(args.viewer.roles),
		};
		assertCanonicalLawyerViewer(viewer);
		const now = args.now ?? Date.now();
		const invitation = await getInvitationByWorkosInvitationId(
			ctx,
			args.workosInvitationId
		);
		if (!invitation) {
			throw new ConvexError("FairLend lawyer invitation was not found");
		}
		if (
			normalizeLawyerEmail(args.invitationEmail) !==
			invitation.normalizedTargetEmail
		) {
			throw new ConvexError("WorkOS invitation email does not match");
		}
		if (invitation.status === "verified") {
			return {
				dealId: invitation.dealId,
				invitationId: invitation._id,
				reason: "Invitation was already verified",
				status: "used",
				verificationId: invitation.verificationId,
			};
		}
		if (invitation.status === "revoked") {
			return {
				dealId: invitation.dealId,
				invitationId: invitation._id,
				reason: "Invitation was revoked",
				status: "revoked",
			};
		}
		if (
			invitation.status === "expired" ||
			isInvitationExpired({ expiresAt: invitation.expiresAt, now })
		) {
			await ctx.db.patch(invitation._id, {
				status: "expired",
				updatedAt: now,
			});
			return {
				dealId: invitation.dealId,
				invitationId: invitation._id,
				reason: "Invitation expired",
				status: "expired",
			};
		}
		const verifiedEmail = viewer.verifiedEmail ?? viewer.email;
		if (!verifiedEmail) {
			const verificationId = await recordInvitationFailure(ctx, {
				authId: viewer.authId,
				invitation,
				now,
				reason: "missing_verified_email",
			});
			await ctx.db.patch(invitation._id, {
				status: "failed",
				updatedAt: now,
				verificationId,
			});
			return {
				dealId: invitation.dealId,
				invitationId: invitation._id,
				reason: "Verified WorkOS email is required",
				status: "failed",
				verificationId,
			};
		}
		const normalizedVerifiedEmail = normalizeLawyerEmail(verifiedEmail);
		if (normalizedVerifiedEmail !== invitation.normalizedTargetEmail) {
			const verificationId = await recordInvitationFailure(ctx, {
				authId: viewer.authId,
				invitation,
				now,
				reason: "email_mismatch",
			});
			await ctx.db.patch(invitation._id, {
				status: "failed",
				updatedAt: now,
				verificationId,
			});
			return {
				dealId: invitation.dealId,
				invitationId: invitation._id,
				reason: "Signed-in lawyer email does not match invitation",
				status: "failed",
				verificationId,
			};
		}
		return await acceptInvitationForOnboarding(ctx, {
			authId: viewer.authId,
			invitation,
			now,
		});
	})
	.internal();
