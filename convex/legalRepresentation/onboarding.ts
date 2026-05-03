import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { grantDealAccess } from "../deals/mutations";
import { convex, lawyerMutation, lawyerQuery, type Viewer } from "../fluent";
import { recordSignedRepresentationEngagementRow } from "./engagements";
import {
	normalizeBarNumber,
	normalizeJurisdiction,
	normalizeLawyerEmail,
	normalizeLegalSourceSnapshot,
} from "./normalization";
import { recordLawyerVerificationRow } from "./verifications";

type OnboardingMutationCtx = Pick<MutationCtx, "db">;
type OwnedOnboardingMutationCtx = OnboardingMutationCtx & {
	readonly viewer: Viewer;
};
type OwnedSessionResult =
	| {
			readonly blocked: false;
			readonly session: Doc<"lawyerOnboardingSessions">;
	  }
	| {
			readonly blocked: true;
			readonly session: Doc<"lawyerOnboardingSessions">;
	  };

const LSO_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24 * 90;
const IDV_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24 * 365;

function onboardingRoute(sessionId: Id<"lawyerOnboardingSessions">) {
	return `/lawyer/onboarding/${String(sessionId)}`;
}

function dealRoute(dealId: Id<"deals">) {
	return `/deals/${String(dealId)}`;
}

function viewerEmail(viewer: Viewer) {
	return viewer.verifiedEmail ?? viewer.email;
}

function isActiveInvitationStatus(status: Doc<"lawyerInvitations">["status"]) {
	return status === "pending" || status === "accepted";
}

async function assertActiveInvitation(
	ctx: OnboardingMutationCtx,
	invitation: Doc<"lawyerInvitations">,
	now: number
) {
	if (invitation.status === "revoked") {
		throw new ConvexError("Lawyer invitation revoked");
	}
	if (
		invitation.status === "expired" ||
		(isActiveInvitationStatus(invitation.status) && invitation.expiresAt <= now)
	) {
		if (invitation.status !== "expired") {
			await ctx.db.patch(invitation._id, {
				status: "expired",
				updatedAt: now,
			});
		}
		throw new ConvexError("Lawyer invitation expired");
	}
	if (!isActiveInvitationStatus(invitation.status)) {
		throw new ConvexError("Lawyer invitation is not active");
	}
}

function checkpointStepAndStatus(
	session: Doc<"lawyerOnboardingSessions">
): Pick<Doc<"lawyerOnboardingSessions">, "currentStep" | "status"> {
	if (session.engagementAcceptedAt !== undefined) {
		return { currentStep: "complete", status: "complete" };
	}
	if (session.idvCompletedAt !== undefined) {
		return { currentStep: "engagement", status: "engagement_pending" };
	}
	if (session.lsoVerifiedAt !== undefined) {
		return { currentStep: "idv", status: "idv_pending" };
	}
	if (session.identityConfirmedAt !== undefined) {
		return { currentStep: "lso", status: "lso_pending" };
	}
	return { currentStep: "auth", status: "auth_pending" };
}

async function getSessionAfterPatch(
	ctx: OnboardingMutationCtx,
	sessionId: Id<"lawyerOnboardingSessions">
) {
	const session = await ctx.db.get(sessionId);
	if (!session) {
		throw new ConvexError("Lawyer onboarding session missing after update");
	}
	return session;
}

export async function startOrResumeForInvitationInMutation(
	ctx: OnboardingMutationCtx,
	args: {
		readonly invitationId: Id<"lawyerInvitations">;
		readonly now?: number;
	}
): Promise<Doc<"lawyerOnboardingSessions">> {
	const invitation = await ctx.db.get(args.invitationId);
	if (!invitation) {
		throw new ConvexError("Lawyer invitation not found");
	}
	const now = args.now ?? Date.now();
	await assertActiveInvitation(ctx, invitation, now);
	const existing = await ctx.db
		.query("lawyerOnboardingSessions")
		.withIndex("by_invitation", (query) =>
			query.eq("invitationId", args.invitationId)
		)
		.first();
	if (existing) {
		return existing;
	}
	const sessionId = await ctx.db.insert("lawyerOnboardingSessions", {
		createdAt: now,
		currentStep: "auth",
		dealId: invitation.dealId,
		invitationId: invitation._id,
		normalizedTargetEmail: invitation.normalizedTargetEmail,
		path: "guest_invited",
		returnPath: dealRoute(invitation.dealId),
		status: "auth_pending",
		updatedAt: now,
	});
	await ctx.db.patch(sessionId, {
		nextRoute: onboardingRoute(sessionId),
	});
	return await getSessionAfterPatch(ctx, sessionId);
}

async function getOwnedSession(
	ctx: OwnedOnboardingMutationCtx,
	sessionId: Id<"lawyerOnboardingSessions">
): Promise<OwnedSessionResult> {
	const session = await ctx.db.get(sessionId);
	if (!session) {
		throw new ConvexError("Lawyer onboarding session not found");
	}
	const email = viewerEmail(ctx.viewer);
	const normalizedViewerEmail =
		email === undefined ? undefined : normalizeLawyerEmail(email);
	if (
		session.workosUserId !== undefined &&
		session.workosUserId !== ctx.viewer.authId
	) {
		throw new ConvexError("Lawyer onboarding session belongs to another user");
	}
	if (
		session.status === "blocked" &&
		session.blockedReasonCodes?.includes("email_mismatch") &&
		session.normalizedTargetEmail !== undefined &&
		normalizedViewerEmail === session.normalizedTargetEmail
	) {
		await ctx.db.patch(session._id, {
			blockedReasonCodes: undefined,
			...checkpointStepAndStatus(session),
			updatedAt: Date.now(),
		});
		return {
			blocked: false,
			session: await getSessionAfterPatch(ctx, session._id),
		};
	}
	if (
		session.normalizedTargetEmail !== undefined &&
		normalizedViewerEmail !== session.normalizedTargetEmail
	) {
		throw new ConvexError("Lawyer onboarding session email does not match");
	}
	if (
		session.workosUserId === undefined &&
		session.normalizedTargetEmail === undefined
	) {
		throw new ConvexError("Lawyer onboarding session is not bound to viewer");
	}
	if (session.status === "blocked") {
		return { blocked: true, session };
	}
	if (session.status === "expired") {
		throw new ConvexError("Lawyer onboarding session is expired");
	}
	return { blocked: false, session };
}

async function loadActiveInvitationForSession(
	ctx: OnboardingMutationCtx,
	session: Doc<"lawyerOnboardingSessions">,
	now: number
) {
	if (session.invitationId === undefined) {
		return null;
	}
	const invitation = await ctx.db.get(session.invitationId);
	if (!invitation) {
		throw new ConvexError("Lawyer invitation not found");
	}
	await assertActiveInvitation(ctx, invitation, now);
	return invitation;
}

async function selectedLsoEvidenceForSession(
	ctx: OnboardingMutationCtx,
	session: Doc<"lawyerOnboardingSessions">,
	now: number
) {
	const invitation = await loadActiveInvitationForSession(ctx, session, now);
	const invitationLso = invitation?.selectedLawyerSnapshot.lso;
	if (invitationLso) {
		return {
			barNumber: invitationLso.barNumber,
			jurisdiction: invitationLso.jurisdiction,
			lsoLawyerId: invitation?.lsoLawyerId ?? invitationLso.lsoLawyerId,
		};
	}
	const deal = await ctx.db.get(session.dealId);
	const dealLso =
		deal?.selectedLawyer?.type === "guest_lawyer"
			? deal.selectedLawyer.lso
			: undefined;
	return {
		barNumber: dealLso?.barNumber,
		jurisdiction: dealLso?.jurisdiction,
		lsoLawyerId: dealLso?.lsoLawyerId,
	};
}

async function assertSubmittedLsoMatchesSelection(
	ctx: OnboardingMutationCtx,
	args: {
		readonly barNumber: string;
		readonly jurisdiction: string;
		readonly session: Doc<"lawyerOnboardingSessions">;
		readonly now: number;
	}
) {
	const selected = await selectedLsoEvidenceForSession(
		ctx,
		args.session,
		args.now
	);
	if (!(selected.barNumber && selected.jurisdiction)) {
		throw new ConvexError("Selected lawyer LSO evidence is required");
	}
	const normalizedSubmittedBar = normalizeBarNumber(args.barNumber);
	const normalizedSubmittedJurisdiction = normalizeJurisdiction(
		args.jurisdiction
	);
	if (
		normalizeBarNumber(selected.barNumber) !== normalizedSubmittedBar ||
		normalizeJurisdiction(selected.jurisdiction) !==
			normalizedSubmittedJurisdiction
	) {
		throw new ConvexError(
			"Submitted LSO license must match selected lawyer evidence"
		);
	}
	if (selected.lsoLawyerId !== undefined) {
		const lsoLawyer = await ctx.db.get(selected.lsoLawyerId);
		if (
			!lsoLawyer ||
			normalizeBarNumber(lsoLawyer.barNumber) !== normalizedSubmittedBar ||
			normalizeJurisdiction(lsoLawyer.jurisdiction) !==
				normalizedSubmittedJurisdiction
		) {
			throw new ConvexError(
				"Submitted LSO license must match selected lawyer evidence"
			);
		}
		if (
			lsoLawyer.licenseeType !== "lawyer" ||
			!lsoLawyer.entitledToPractise ||
			lsoLawyer.licensingStatus !== "licensed" ||
			lsoLawyer.restrictionStatus !== "clear"
		) {
			throw new ConvexError("Selected LSO lawyer is not selectable");
		}
	}
	return {
		barNumber: normalizedSubmittedBar,
		jurisdiction: normalizedSubmittedJurisdiction,
		lsoLawyerId: selected.lsoLawyerId,
	};
}

function requireCheckpoint(
	session: Doc<"lawyerOnboardingSessions">,
	checkpoint: keyof Pick<
		Doc<"lawyerOnboardingSessions">,
		| "engagementAcceptedAt"
		| "identityConfirmedAt"
		| "idvCompletedAt"
		| "lsoVerifiedAt"
	>,
	message: string
) {
	if (session[checkpoint] === undefined) {
		throw new ConvexError(message);
	}
}

async function revokeActiveProvisionalEmailAccess(
	ctx: OnboardingMutationCtx,
	args: {
		readonly dealId: Id<"deals">;
		readonly normalizedTargetEmail: string | undefined;
		readonly now: number;
	}
) {
	if (args.normalizedTargetEmail === undefined) {
		return;
	}
	const normalizedTargetEmail = args.normalizedTargetEmail;
	const rows = await ctx.db
		.query("dealAccess")
		.withIndex("by_user_and_deal", (query) =>
			query.eq("userId", normalizedTargetEmail).eq("dealId", args.dealId)
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

export async function completeSessionInternal(
	ctx: OwnedOnboardingMutationCtx,
	sessionId: Id<"lawyerOnboardingSessions">
) {
	const now = Date.now();
	const owned = await getOwnedSession(ctx, sessionId);
	const session = owned.session;
	if (owned.blocked) {
		return session;
	}
	if (session.completedAt !== undefined && session.status === "complete") {
		return session;
	}
	const invitation = await loadActiveInvitationForSession(ctx, session, now);
	requireCheckpoint(
		session,
		"engagementAcceptedAt",
		"Representation engagement checkpoint is required before completion"
	);
	await grantDealAccess(ctx.db, {
		dealId: session.dealId,
		grantedBy: `lawyer-onboarding:${String(session._id)}`,
		role: "guest_lawyer",
		userId: ctx.viewer.authId,
	});
	await revokeActiveProvisionalEmailAccess(ctx, {
		dealId: session.dealId,
		normalizedTargetEmail: session.normalizedTargetEmail,
		now,
	});
	const deal = await ctx.db.get(session.dealId);
	if (
		deal &&
		deal.lawyerType === "guest_lawyer" &&
		deal.lawyerId === session.normalizedTargetEmail
	) {
		await ctx.db.patch(deal._id, {
			lawyerId: ctx.viewer.authId,
		});
	}
	if (session.invitationId !== undefined) {
		await ctx.db.patch(session.invitationId, {
			acceptedAt: invitation?.acceptedAt ?? now,
			resolvedAuthId: ctx.viewer.authId,
			status: "verified",
			updatedAt: now,
			verifiedAt: now,
		});
	}
	await ctx.db.patch(session._id, {
		completedAt: now,
		currentStep: "complete",
		nextRoute: dealRoute(session.dealId),
		status: "complete",
		updatedAt: now,
		workosUserId: ctx.viewer.authId,
	});
	return await getSessionAfterPatch(ctx, session._id);
}

export const startOrResumeForInvitationInternal = convex
	.mutation()
	.input({ invitationId: v.id("lawyerInvitations") })
	.handler(async (ctx, args) => {
		const session = await startOrResumeForInvitationInMutation(ctx, args);
		return { session };
	})
	.internal();

export const getLawyerOnboardingSession = lawyerQuery
	.input({ sessionId: v.id("lawyerOnboardingSessions") })
	.handler(async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) {
			return null;
		}
		if (
			session.workosUserId !== undefined &&
			session.workosUserId !== ctx.viewer.authId
		) {
			return null;
		}
		const email = viewerEmail(ctx.viewer);
		const normalizedViewerEmail =
			email === undefined ? undefined : normalizeLawyerEmail(email);
		if (
			session.workosUserId === ctx.viewer.authId ||
			(session.normalizedTargetEmail !== undefined &&
				normalizedViewerEmail === session.normalizedTargetEmail)
		) {
			return session;
		}
		return null;
	})
	.public();

export const confirmIdentity = lawyerMutation
	.input({ sessionId: v.id("lawyerOnboardingSessions") })
	.handler(async (ctx, args) => {
		const now = Date.now();
		const owned = await getOwnedSession(ctx, args.sessionId);
		const session = owned.session;
		if (owned.blocked) {
			return session;
		}
		if (session.identityConfirmedAt !== undefined) {
			return session;
		}
		await ctx.db.patch(session._id, {
			authCompletedAt: session.authCompletedAt ?? now,
			currentStep: "lso",
			identityConfirmedAt: now,
			status: "lso_pending",
			updatedAt: now,
			workosUserId: ctx.viewer.authId,
		});
		return await getSessionAfterPatch(ctx, session._id);
	})
	.public();

export const submitLsoLicense = lawyerMutation
	.input({
		barNumber: v.string(),
		jurisdiction: v.string(),
		sessionId: v.id("lawyerOnboardingSessions"),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		const owned = await getOwnedSession(ctx, args.sessionId);
		const session = owned.session;
		if (owned.blocked) {
			return session;
		}
		if (session.lsoVerifiedAt !== undefined) {
			return session;
		}
		requireCheckpoint(
			session,
			"identityConfirmedAt",
			"Identity checkpoint is required before LSO submission"
		);
		const submittedLso = await assertSubmittedLsoMatchesSelection(ctx, {
			barNumber: args.barNumber,
			jurisdiction: args.jurisdiction,
			now,
			session,
		});
		await recordLawyerVerificationRow(ctx, {
			authId: ctx.viewer.authId,
			barNumber: submittedLso.barNumber,
			checkType: "initial_lso",
			createdAt: now,
			createdBy: `lawyer-onboarding:${String(session._id)}`,
			dealId: session.dealId,
			jurisdiction: submittedLso.jurisdiction,
			lawyerProfileId: session.lawyerProfileId,
			lsoLawyerId: submittedLso.lsoLawyerId,
			normalizedEmail: viewerEmail(ctx.viewer),
			providerResult: {
				evidenceHash: `sha256:onboarding-lso:${String(session._id)}:${ctx.viewer.authId}:${now}`,
				expiresAt: now + LSO_VERIFICATION_TTL_MS,
				outcome: "eligible",
				provider: "lso",
				providerReferenceId: `${submittedLso.jurisdiction}:${submittedLso.barNumber}`,
				reasonCodes: ["active_license"],
				sourceSnapshot: normalizeLegalSourceSnapshot({
					barNumber: submittedLso.barNumber,
					jurisdiction: submittedLso.jurisdiction,
					source: "lawyer_onboarding_submission",
					sessionId: String(session._id),
				}),
			},
		});
		await ctx.db.patch(session._id, {
			currentStep: "idv",
			lsoSubmittedAt: now,
			lsoVerifiedAt: now,
			status: "idv_pending",
			updatedAt: now,
			workosUserId: ctx.viewer.authId,
		});
		return await getSessionAfterPatch(ctx, session._id);
	})
	.public();

export const completeMockIdv = lawyerMutation
	.input({ sessionId: v.id("lawyerOnboardingSessions") })
	.handler(async (ctx, args) => {
		const now = Date.now();
		const owned = await getOwnedSession(ctx, args.sessionId);
		const session = owned.session;
		if (owned.blocked) {
			return session;
		}
		if (session.idvCompletedAt !== undefined) {
			return session;
		}
		requireCheckpoint(
			session,
			"lsoVerifiedAt",
			"LSO checkpoint is required before IDV"
		);
		await recordLawyerVerificationRow(ctx, {
			authId: ctx.viewer.authId,
			checkType: "idv",
			createdAt: now,
			createdBy: `lawyer-onboarding:${String(session._id)}`,
			dealId: session.dealId,
			lawyerProfileId: session.lawyerProfileId,
			normalizedEmail: viewerEmail(ctx.viewer),
			providerResult: {
				evidenceHash: `sha256:onboarding-idv:${String(session._id)}:${ctx.viewer.authId}:${now}`,
				expiresAt: now + IDV_VERIFICATION_TTL_MS,
				outcome: "eligible",
				provider: "idv",
				providerReferenceId: `mock-idv:${String(session._id)}`,
				reasonCodes: ["identity_confirmed"],
				sourceSnapshot: normalizeLegalSourceSnapshot({
					source: "mock_idv_screen",
					sessionId: String(session._id),
				}),
			},
		});
		await ctx.db.patch(session._id, {
			currentStep: "engagement",
			idvCompletedAt: now,
			status: "engagement_pending",
			updatedAt: now,
			workosUserId: ctx.viewer.authId,
		});
		return await getSessionAfterPatch(ctx, session._id);
	})
	.public();

export const acceptRepresentationEngagement = lawyerMutation
	.input({ sessionId: v.id("lawyerOnboardingSessions") })
	.handler(async (ctx, args) => {
		const now = Date.now();
		const owned = await getOwnedSession(ctx, args.sessionId);
		const session = owned.session;
		if (owned.blocked) {
			return session;
		}
		if (session.engagementAcceptedAt !== undefined) {
			return await completeSessionInternal(ctx, session._id);
		}
		requireCheckpoint(
			session,
			"idvCompletedAt",
			"IDV checkpoint is required before engagement acceptance"
		);
		await recordSignedRepresentationEngagementRow(ctx, {
			createdAt: now,
			dealId: session.dealId,
			evidenceHash: `sha256:onboarding-engagement:${String(session._id)}:${ctx.viewer.authId}:${now}`,
			lawyerAuthId: ctx.viewer.authId,
			lawyerProfileId: session.lawyerProfileId,
			provider: "manual_admin",
			signedAt: now,
		});
		await ctx.db.patch(session._id, {
			acceptedEngagementAt: now,
			currentStep: "complete",
			engagementAcceptedAt: now,
			status: "complete",
			updatedAt: now,
			workosUserId: ctx.viewer.authId,
		});
		return await completeSessionInternal(ctx, session._id);
	})
	.public();

export const completeSession = lawyerMutation
	.input({ sessionId: v.id("lawyerOnboardingSessions") })
	.handler(
		async (ctx, args) => await completeSessionInternal(ctx, args.sessionId)
	)
	.public();
