import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { SelectedLawyerSnapshot } from "../checkout/validators";
import { grantDealAccess } from "../deals/mutations";
import { adminMutation, authedMutation, convex } from "../fluent";
import {
	normalizeBarNumber,
	normalizeJurisdiction,
	normalizeLawyerEmail,
	normalizeLegalSourceSnapshot,
	normalizeLegalWhitespace,
} from "./normalization";
import {
	buildManualLawyerVerificationResult,
	DeterministicLawyerVerificationProvider,
	normalizeLawyerIdentity,
} from "./providers";
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
	readonly invitationId: Id<"lawyerInvitations">;
	readonly inviteUrl: string;
	readonly token: string;
}

export type InvitationAcceptResult =
	| {
			readonly status: "verified";
			readonly accessId: Id<"dealAccess">;
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
			readonly invitationId?: Id<"lawyerInvitations">;
			readonly reason: string;
			readonly verificationId?: Id<"lawyerVerifications">;
	  };

function requiredText(value: string, fieldName: string): string {
	const normalized = normalizeLegalWhitespace(value);
	if (normalized.length === 0) {
		throw new ConvexError(`${fieldName} is required`);
	}
	return normalized;
}

function optionalText(value: string | undefined): string | undefined {
	if (value === undefined) {
		return undefined;
	}
	const normalized = normalizeLegalWhitespace(value);
	return normalized.length > 0 ? normalized : undefined;
}

function normalizeAuthId(authId: string | undefined): string | undefined {
	return optionalText(authId);
}

function isActiveInvitationStatus(status: Doc<"lawyerInvitations">["status"]) {
	return status === "pending" || status === "accepted";
}

function isLawyerViewer(viewer: {
	readonly permissions: ReadonlySet<string>;
	readonly role: string | undefined;
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
	readonly role: string | undefined;
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
	ctx: LegalRepresentationMutationCtx,
	args: {
		readonly dealId: Id<"deals">;
		readonly exceptInvitationId?: Id<"lawyerInvitations">;
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
		}
	}
}

export async function revokeActiveGuestInvitationsForDeal(
	ctx: LegalRepresentationMutationCtx,
	args: {
		readonly dealId: Id<"deals">;
		readonly exceptInvitationId?: Id<"lawyerInvitations">;
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

function selectedLawyerFromInvitation(
	invitation: Doc<"lawyerInvitations">
): GuestSelectedLawyerSnapshot {
	if (invitation.selectedLawyerSnapshot.type !== "guest_lawyer") {
		throw new ConvexError("Invitation is not for a guest lawyer");
	}
	return invitation.selectedLawyerSnapshot;
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

async function findProfileByAuthId(
	ctx: LegalRepresentationQueryCtx,
	authId: string | undefined
) {
	if (!authId) {
		return null;
	}
	return await ctx.db
		.query("lawyerProfiles")
		.withIndex("by_auth_id", (query) => query.eq("authId", authId))
		.unique();
}

async function findProfileByEmail(
	ctx: LegalRepresentationQueryCtx,
	normalizedEmail: string
) {
	return await ctx.db
		.query("lawyerProfiles")
		.withIndex("by_normalized_email", (query) =>
			query.eq("normalizedEmail", normalizedEmail)
		)
		.unique();
}

async function findProfileByBar(
	ctx: LegalRepresentationQueryCtx,
	args: {
		readonly barNumber?: string;
		readonly jurisdiction?: string;
	}
) {
	if (!(args.barNumber && args.jurisdiction)) {
		return null;
	}
	return await ctx.db
		.query("lawyerProfiles")
		.withIndex("by_bar_jurisdiction", (query) =>
			query
				.eq("barNumber", args.barNumber)
				.eq("jurisdiction", args.jurisdiction)
		)
		.unique();
}

function mergeGuestProfileKind(
	profileKind: Doc<"lawyerProfiles">["profileKind"]
): Doc<"lawyerProfiles">["profileKind"] {
	return profileKind === "platform" ? "both" : "guest";
}

function assertSameProfile(
	left: Doc<"lawyerProfiles"> | null,
	right: Doc<"lawyerProfiles"> | null,
	message: string
) {
	if (left && right && left._id !== right._id) {
		throw new ConvexError(message);
	}
}

async function assertSyncedWorkosLawyerUser(
	ctx: LegalRepresentationQueryCtx,
	args: { readonly authId: string; readonly normalizedEmail: string }
) {
	const user = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", args.authId))
		.unique();
	if (!user) {
		throw new ConvexError(
			"Resolved lawyer auth ID must have a synced WorkOS user"
		);
	}
	if (normalizeLawyerEmail(user.email) !== args.normalizedEmail) {
		throw new ConvexError(
			"Resolved lawyer auth ID email does not match invite"
		);
	}
}

async function resolveOrProvisionGuestLawyerProfile(
	ctx: LegalRepresentationMutationCtx,
	args: {
		readonly authId: string;
		readonly email: string;
		readonly selectedLawyer: GuestSelectedLawyerSnapshot;
		readonly now: number;
	}
): Promise<Id<"lawyerProfiles">> {
	const normalizedEmail = normalizeLawyerEmail(args.email);
	const barNumber =
		args.selectedLawyer.lso?.barNumber === undefined
			? undefined
			: normalizeBarNumber(args.selectedLawyer.lso.barNumber);
	const jurisdiction =
		args.selectedLawyer.lso?.jurisdiction === undefined
			? undefined
			: normalizeJurisdiction(args.selectedLawyer.lso.jurisdiction);
	await assertSyncedWorkosLawyerUser(ctx, {
		authId: args.authId,
		normalizedEmail,
	});
	const existingByAuth = await findProfileByAuthId(ctx, args.authId);
	const existingByEmail = await findProfileByEmail(ctx, normalizedEmail);
	const existingByBar = await findProfileByBar(ctx, {
		barNumber,
		jurisdiction,
	});
	assertSameProfile(
		existingByAuth,
		existingByEmail,
		"Guest lawyer auth ID and email resolve to different profiles"
	);
	assertSameProfile(
		existingByAuth ?? existingByEmail,
		existingByBar,
		"Guest lawyer identity and bar evidence resolve to different profiles"
	);
	const existing = existingByAuth ?? existingByEmail ?? existingByBar;
	const patch = {
		authId: args.authId,
		barNumber,
		displayName: requiredText(args.selectedLawyer.name, "selectedLawyer.name"),
		email: args.email,
		firmName: optionalText(args.selectedLawyer.firm),
		jurisdiction,
		normalizedEmail,
		updatedAt: args.now,
	};
	if (!existing) {
		return await ctx.db.insert("lawyerProfiles", {
			...patch,
			createdAt: args.now,
			profileKind: "guest",
		});
	}
	await ctx.db.patch(existing._id, {
		...patch,
		profileKind: mergeGuestProfileKind(existing.profileKind),
	});
	return existing._id;
}

async function loadLsoReference(
	ctx: LegalRepresentationQueryCtx,
	invitation: Doc<"lawyerInvitations">
) {
	if (invitation.lsoLawyerId) {
		const row = await ctx.db.get(invitation.lsoLawyerId);
		if (row) {
			return row;
		}
	}
	return null;
}

function lsoReferenceFromInvitation(
	invitation: Doc<"lawyerInvitations">,
	lsoRow: Doc<"lsoLawyers"> | null
) {
	const snapshot = invitation.selectedLawyerSnapshot.lso;
	return {
		barNumber: lsoRow?.barNumber ?? snapshot?.barNumber,
		displayName: lsoRow?.displayName ?? invitation.selectedLawyerSnapshot.name,
		jurisdiction: lsoRow?.jurisdiction ?? snapshot?.jurisdiction,
		licensingStatus: lsoRow?.licensingStatus ?? snapshot?.licensingStatus,
		lsoLawyerId: lsoRow?._id ?? snapshot?.lsoLawyerId,
		restrictionStatus: lsoRow?.restrictionStatus ?? snapshot?.restrictionStatus,
		restrictionSummary: lsoRow?.restrictionSummary,
		source: lsoRow?.source ?? snapshot?.source,
		sourceSnapshot: lsoRow?.sourceSnapshot,
	};
}

async function recordInvitationVerification(
	ctx: LegalRepresentationMutationCtx,
	args: {
		readonly authId: string;
		readonly invitation: Doc<"lawyerInvitations">;
		readonly lawyerProfileId?: Id<"lawyerProfiles">;
		readonly now: number;
	}
) {
	const lsoRow = await loadLsoReference(ctx, args.invitation);
	const provider = new DeterministicLawyerVerificationProvider("test");
	const providerResult = await provider.verify({
		checkType: "initial_lso",
		dealContext: {
			dealId: args.invitation.dealId,
			lawyerProfileId: args.lawyerProfileId,
		},
		identity: normalizeLawyerIdentity({
			authId: args.authId,
			barNumber: args.invitation.selectedLawyerSnapshot.lso?.barNumber,
			displayName: args.invitation.selectedLawyerSnapshot.name,
			email: args.invitation.targetEmail,
			jurisdiction: args.invitation.selectedLawyerSnapshot.lso?.jurisdiction,
		}),
		lsoReference: lsoReferenceFromInvitation(args.invitation, lsoRow),
		requestedAt: args.now,
		requestedBy: `lawyer-invitation:${String(args.invitation._id)}`,
	});
	return await recordLawyerVerificationRow(ctx, {
		authId: args.authId,
		barNumber: args.invitation.selectedLawyerSnapshot.lso?.barNumber,
		checkType: "initial_lso",
		createdAt: args.now,
		createdBy: `lawyer-invitation:${String(args.invitation._id)}`,
		dealId: args.invitation.dealId,
		jurisdiction: args.invitation.selectedLawyerSnapshot.lso?.jurisdiction,
		lawyerProfileId: args.lawyerProfileId,
		lsoLawyerId: args.invitation.lsoLawyerId,
		normalizedEmail: args.invitation.normalizedTargetEmail,
		providerResult,
	});
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

async function revokeProvisionalEmailAccess(
	ctx: LegalRepresentationMutationCtx,
	args: {
		readonly dealId: Id<"deals">;
		readonly normalizedEmail: string;
		readonly now: number;
	}
) {
	const rows = await ctx.db
		.query("dealAccess")
		.withIndex("by_user_and_deal", (query) =>
			query.eq("userId", args.normalizedEmail).eq("dealId", args.dealId)
		)
		.collect();
	for (const row of rows) {
		if (row.status === "active" && row.role === "guest_lawyer") {
			await ctx.db.patch(row._id, {
				revokedAt: args.now,
				status: "revoked",
			});
		}
	}
}

export async function createGuestInvitationDelivery(
	ctx: LegalRepresentationMutationCtx & {
		readonly viewer?: { readonly authId: string };
	},
	args: {
		readonly baseUrl?: string;
		readonly createdBy?: string;
		readonly deal: Doc<"deals">;
		readonly expiresAt?: number;
		readonly now: number;
		readonly selectedLawyer?: GuestSelectedLawyerSnapshot;
		readonly targetEmail?: string;
		readonly ttlMs?: number;
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
	});
	return {
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
			return { status: "expired" as const };
		}
		return {
			status: invitation.status,
			expiresAt: invitation.expiresAt,
		};
	})
	.public();

export const createGuestInvitationForDeal = adminMutation
	.input({
		baseUrl: v.optional(v.string()),
		dealId: v.id("deals"),
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
			selectedLawyer,
			targetEmail,
			ttlMs: args.ttlMs,
		});
	})
	.public();

export const resendGuestInvitation = adminMutation
	.input({
		baseUrl: v.optional(v.string()),
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
			status: "pending",
			tokenHash: token.tokenHash,
			updatedAt: now,
			verificationId: undefined,
			verifiedAt: undefined,
		});
		return {
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
				invitationId: invitation._id,
				reason: "Invitation was already verified",
				status: "used",
				verificationId: invitation.verificationId,
			};
		}
		if (invitation.status === "revoked") {
			return {
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
				invitationId: invitation._id,
				reason: "Signed-in lawyer email does not match invitation",
				status: "failed",
				verificationId,
			};
		}
		const lawyerProfileId = await resolveOrProvisionGuestLawyerProfile(ctx, {
			authId: normalizeAuthId(ctx.viewer.authId) ?? ctx.viewer.authId,
			email: verifiedEmail,
			now,
			selectedLawyer: selectedLawyerFromInvitation(invitation),
		});
		const verificationId = await recordInvitationVerification(ctx, {
			authId: ctx.viewer.authId,
			invitation,
			lawyerProfileId,
			now,
		});
		const verification = await ctx.db.get(verificationId);
		if (!verification || verification.outcome !== "eligible") {
			await ctx.db.patch(invitation._id, {
				acceptedAt: now,
				resolvedAuthId: ctx.viewer.authId,
				status: "failed",
				updatedAt: now,
				verificationId,
			});
			return {
				invitationId: invitation._id,
				reason:
					verification?.outcome === "requires_review"
						? "Lawyer verification requires review"
						: "Lawyer verification failed",
				status:
					verification?.outcome === "requires_review"
						? "requires_review"
						: "failed",
				verificationId,
			};
		}
		const accessId = await grantDealAccess(ctx.db, {
			dealId: invitation.dealId,
			grantedBy: `lawyer-invitation:${String(invitation._id)}`,
			role: "guest_lawyer",
			userId: ctx.viewer.authId,
		});
		await revokeProvisionalEmailAccess(ctx, {
			dealId: invitation.dealId,
			normalizedEmail: invitation.normalizedTargetEmail,
			now,
		});
		const deal = await ctx.db.get(invitation.dealId);
		if (
			deal &&
			deal.lawyerType === "guest_lawyer" &&
			deal.lawyerId === invitation.normalizedTargetEmail
		) {
			await ctx.db.patch(deal._id, {
				lawyerId: ctx.viewer.authId,
			});
		}
		await ctx.db.patch(lawyerProfileId, {
			latestVerificationId: verificationId,
			updatedAt: now,
		});
		await ctx.db.patch(invitation._id, {
			acceptedAt: now,
			resolvedAuthId: ctx.viewer.authId,
			status: "verified",
			updatedAt: now,
			verificationId,
			verifiedAt: now,
		});
		return {
			accessId,
			invitationId: invitation._id,
			lawyerProfileId,
			status: "verified",
			verificationId,
		};
	})
	.public();
