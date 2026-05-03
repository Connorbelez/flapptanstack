import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { FAIRLEND_LAWYERS_ORG_ID } from "../constants";
import { getWorkosProvisioning } from "../engine/effects/workosProvisioning";
import { adminMutation, adminQuery, convex } from "../fluent";
import {
	normalizeLawyerEmail,
	normalizeLegalWhitespace,
} from "./normalization";
import {
	type UpsertPlatformLawyerProfileArgs,
	upsertPlatformLawyerProfile,
} from "./profiles";
import {
	type LawyerVerificationOutcome,
	legalRepresentationPlatformStatusValidator,
	type PlatformLawyerCapacityWarningLevel,
	type PlatformLawyerRestrictionRecheckStatus,
	type PlatformLawyerSlaReviewStatus,
} from "./validators";

const MAX_PAGE_SIZE = 50;
const MAX_ROSTER_SCAN = 500;
const INVITATION_EXPIRING_WINDOW_MS = 48 * 60 * 60 * 1000;
const LAWYER_ROLE_SLUG = "lawyer";
const DELIVERY_ERROR_MAX_LENGTH = 400;
const ACTIVE_DEAL_STATUSES = new Set([
	"lawyerOnboarding.pending",
	"lawyerOnboarding.verified",
	"documentReview.pending",
	"documentReview.signed",
]);

const urgencyValidator = v.union(
	v.literal("all"),
	v.literal("sla_breached"),
	v.literal("representation_override_needed"),
	v.literal("verification_requires_review"),
	v.literal("invitation_expiring"),
	v.literal("restriction_recheck_due"),
	v.literal("at_capacity"),
	v.literal("pending_onboarding"),
	v.literal("normal")
);

const profileKindFilterValidator = v.union(
	v.literal("all"),
	v.literal("platform"),
	v.literal("guest"),
	v.literal("both")
);

const platformStatusFilterValidator = v.union(
	v.literal("all"),
	v.literal("invited"),
	v.literal("active"),
	v.literal("requires_review"),
	v.literal("suspended"),
	v.literal("offboarded"),
	v.literal("not_platform")
);

const verificationStatusFilterValidator = v.union(
	v.literal("all"),
	v.literal("eligible"),
	v.literal("ineligible"),
	v.literal("requires_review"),
	v.literal("failed"),
	v.literal("not_verified")
);

const invitationStatusFilterValidator = v.union(
	v.literal("all"),
	v.literal("pending"),
	v.literal("accepted"),
	v.literal("verified"),
	v.literal("expired"),
	v.literal("revoked"),
	v.literal("failed"),
	v.literal("sent"),
	v.literal("canceled"),
	v.literal("none")
);

const capacitySlaFilterValidator = v.union(
	v.literal("all"),
	v.literal("sla_breached"),
	v.literal("at_capacity"),
	v.literal("restriction_recheck_due")
);

const rosterSortValidator = v.union(
	v.literal("urgency"),
	v.literal("latest_activity"),
	v.literal("name")
);

const platformInviteResolutionValidator = v.union(
	v.literal("attach_existing_user"),
	v.literal("designate_existing_profile"),
	v.literal("create_pending")
);

export type AdminLawyerUrgency =
	| "sla_breached"
	| "representation_override_needed"
	| "verification_requires_review"
	| "invitation_expiring"
	| "restriction_recheck_due"
	| "at_capacity"
	| "pending_onboarding"
	| "normal";

export interface AdminLawyerRosterRow {
	readonly activeDealCount: number;
	readonly activeInvitation: {
		readonly dealId: Id<"deals">;
		readonly deliveryStatus: Doc<"lawyerInvitations">["deliveryStatus"] | null;
		readonly expiresAt: number;
		readonly invitationId: Id<"lawyerInvitations">;
		readonly status: Doc<"lawyerInvitations">["status"];
		readonly targetEmail: string;
		readonly updatedAt: number;
	} | null;
	readonly barNumber: string | null;
	readonly capacityLimit: number | null;
	readonly capacityWarning: PlatformLawyerCapacityWarningLevel | null;
	readonly displayName: string;
	readonly email: string;
	readonly firmName: string | null;
	readonly invitationStatus:
		| Doc<"lawyerInvitations">["status"]
		| Doc<"platformLawyerInvitations">["status"]
		| "none";
	readonly jurisdiction: string | null;
	readonly latestActivityAt: number;
	readonly latestVerification: {
		readonly checkType: Doc<"lawyerVerifications">["checkType"];
		readonly createdAt: number;
		readonly expiresAt: number | null;
		readonly outcome: Doc<"lawyerVerifications">["outcome"];
		readonly reasonCodes: readonly Doc<"lawyerVerifications">["reasonCodes"][number][];
		readonly verificationId: Id<"lawyerVerifications">;
	} | null;
	readonly nextAction: string;
	readonly platformInvitation: {
		readonly deliveryStatus:
			| Doc<"platformLawyerInvitations">["deliveryStatus"]
			| null;
		readonly invitationId: Id<"platformLawyerInvitations">;
		readonly status: Doc<"platformLawyerInvitations">["status"];
		readonly targetEmail: string;
		readonly updatedAt: number;
	} | null;
	readonly platformOnboardingSession: {
		readonly currentStep: string;
		readonly nextRoute: string | null;
		readonly sessionId: Id<"lawyerOnboardingSessions">;
		readonly status: Doc<"lawyerOnboardingSessions">["status"];
		readonly updatedAt: number;
	} | null;
	readonly platformStatus:
		| Doc<"lawyerProfiles">["platformStatus"]
		| "not_platform";
	readonly profileId: Id<"lawyerProfiles">;
	readonly profileKind: Doc<"lawyerProfiles">["profileKind"];
	readonly restrictionRecheckStatus:
		| PlatformLawyerRestrictionRecheckStatus
		| "due"
		| "none";
	readonly slaStatus: PlatformLawyerSlaReviewStatus | "none";
	readonly urgency: AdminLawyerUrgency;
	readonly verificationStatus: LawyerVerificationOutcome | "not_verified";
}

const URGENCY_ORDER: readonly AdminLawyerUrgency[] = [
	"sla_breached",
	"representation_override_needed",
	"verification_requires_review",
	"invitation_expiring",
	"restriction_recheck_due",
	"at_capacity",
	"pending_onboarding",
	"normal",
];

function compareUrgency(a: AdminLawyerUrgency, b: AdminLawyerUrgency) {
	return URGENCY_ORDER.indexOf(a) - URGENCY_ORDER.indexOf(b);
}

function includesPlatform(profile: Doc<"lawyerProfiles">) {
	return profile.profileKind === "platform" || profile.profileKind === "both";
}

async function latestVerification(
	ctx: Pick<QueryCtx, "db">,
	profileId: Id<"lawyerProfiles">
) {
	const rows = await ctx.db
		.query("lawyerVerifications")
		.withIndex("by_profile_check_created", (query) =>
			query.eq("lawyerProfileId", profileId)
		)
		.collect();
	return rows.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

async function invitationsForProfile(
	ctx: Pick<QueryCtx, "db">,
	profile: Doc<"lawyerProfiles">
) {
	return await ctx.db
		.query("lawyerInvitations")
		.withIndex("by_target_email_status", (query) =>
			query.eq("normalizedTargetEmail", profile.normalizedEmail)
		)
		.collect();
}

async function platformInvitationsForProfile(
	ctx: Pick<QueryCtx, "db">,
	profileId: Id<"lawyerProfiles">
) {
	return await ctx.db
		.query("platformLawyerInvitations")
		.withIndex("by_profile_status", (query) =>
			query.eq("lawyerProfileId", profileId)
		)
		.collect();
}

async function onboardingSessionsForProfile(
	ctx: Pick<QueryCtx, "db">,
	profileId: Id<"lawyerProfiles">
) {
	return await ctx.db
		.query("lawyerOnboardingSessions")
		.withIndex("by_lawyer_profile_status", (query) =>
			query.eq("lawyerProfileId", profileId)
		)
		.collect();
}

function latestInvitation(invitations: readonly Doc<"lawyerInvitations">[]) {
	return [...invitations].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

function latestPlatformInvitation(
	invitations: readonly Doc<"platformLawyerInvitations">[]
) {
	return [...invitations].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

function latestOnboardingSession(
	sessions: readonly Doc<"lawyerOnboardingSessions">[]
) {
	return [...sessions].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

function summarizeInvitation(invitation: Doc<"lawyerInvitations"> | null) {
	if (!invitation) {
		return null;
	}
	return {
		dealId: invitation.dealId,
		deliveryStatus: invitation.deliveryStatus ?? null,
		expiresAt: invitation.expiresAt,
		invitationId: invitation._id,
		status: invitation.status,
		targetEmail: invitation.targetEmail,
		updatedAt: invitation.updatedAt,
	};
}

function summarizePlatformInvitation(
	invitation: Doc<"platformLawyerInvitations"> | null
) {
	if (!invitation) {
		return null;
	}
	return {
		deliveryStatus: invitation.deliveryStatus ?? null,
		invitationId: invitation._id,
		status: invitation.status,
		targetEmail: invitation.email,
		updatedAt: invitation.updatedAt,
	};
}

function summarizeOnboardingSession(
	session: Doc<"lawyerOnboardingSessions"> | null
) {
	if (!session) {
		return null;
	}
	return {
		currentStep: session.currentStep,
		nextRoute: session.nextRoute ?? null,
		sessionId: session._id,
		status: session.status,
		updatedAt: session.updatedAt,
	};
}

function summarizeVerification(
	verification: Doc<"lawyerVerifications"> | null
) {
	if (!verification) {
		return null;
	}
	return {
		checkType: verification.checkType,
		createdAt: verification.createdAt,
		expiresAt: verification.expiresAt ?? null,
		outcome: verification.outcome,
		reasonCodes: verification.reasonCodes,
		verificationId: verification._id,
	};
}

function requiredText(value: string, fieldName: string) {
	const normalized = normalizeLegalWhitespace(value);
	if (normalized.length === 0) {
		throw new ConvexError(`${fieldName} is required`);
	}
	return normalized;
}

function optionalText(value: string | undefined) {
	if (value === undefined) {
		return undefined;
	}
	const normalized = normalizeLegalWhitespace(value);
	return normalized.length > 0 ? normalized : undefined;
}

async function assignmentForProfile(
	ctx: Pick<QueryCtx, "db">,
	profileId: Id<"lawyerProfiles">
) {
	return await ctx.db
		.query("platformLawyerAssignments")
		.withIndex("by_lawyer_profile", (query) =>
			query.eq("lawyerProfileId", profileId)
		)
		.unique();
}

async function latestSlaReview(
	ctx: Pick<QueryCtx, "db">,
	profileId: Id<"lawyerProfiles">
) {
	const rows = await ctx.db
		.query("platformLawyerSlaReviews")
		.withIndex("by_lawyer_status_due", (query) =>
			query.eq("lawyerProfileId", profileId)
		)
		.collect();
	return rows.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

async function latestRestrictionRecheck(
	ctx: Pick<QueryCtx, "db">,
	profileId: Id<"lawyerProfiles">
) {
	const rows = await ctx.db
		.query("platformLawyerRestrictionRechecks")
		.withIndex("by_lawyer_started", (query) =>
			query.eq("lawyerProfileId", profileId)
		)
		.collect();
	return rows.sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
}

async function latestMetrics(
	ctx: Pick<QueryCtx, "db">,
	profileId: Id<"lawyerProfiles">
) {
	return await ctx.db
		.query("platformLawyerMetrics")
		.withIndex("by_lawyer_profile", (query) =>
			query.eq("lawyerProfileId", profileId)
		)
		.order("desc")
		.first();
}

async function openEscalations(
	ctx: Pick<QueryCtx, "db">,
	profileId: Id<"lawyerProfiles">
) {
	return await ctx.db
		.query("platformLawyerEscalations")
		.withIndex("by_lawyer_status", (query) =>
			query.eq("lawyerProfileId", profileId).eq("status", "open")
		)
		.collect();
}

async function availabilityForProfile(
	ctx: Pick<QueryCtx, "db">,
	profileId: Id<"lawyerProfiles">
) {
	const [windows, exceptions] = await Promise.all([
		ctx.db
			.query("platformLawyerAvailabilityWindows")
			.withIndex("by_lawyer", (query) => query.eq("lawyerProfileId", profileId))
			.collect(),
		ctx.db
			.query("platformLawyerAvailabilityExceptions")
			.withIndex("by_lawyer_date", (query) =>
				query.eq("lawyerProfileId", profileId)
			)
			.collect(),
	]);
	return {
		exceptions: exceptions.sort((a, b) =>
			a.businessDate.localeCompare(b.businessDate)
		),
		windows: windows.sort((a, b) => {
			if (a.dayOfWeek !== b.dayOfWeek) {
				return a.dayOfWeek - b.dayOfWeek;
			}
			return a.startMinute - b.startMinute;
		}),
	};
}

function lawyerAuthTargets(profile: Doc<"lawyerProfiles">) {
	return new Set(
		[
			profile.authId,
			profile.normalizedEmail,
			profile.email.toLowerCase(),
		].filter(
			(target): target is string =>
				typeof target === "string" && target.length > 0
		)
	);
}

async function dealsForProfile(
	ctx: Pick<QueryCtx, "db">,
	profile: Doc<"lawyerProfiles">
) {
	const targets = lawyerAuthTargets(profile);
	const deals: Doc<"deals">[] = [];
	const seen = new Set<Id<"deals">>();
	for (const target of targets) {
		const matches = await ctx.db
			.query("deals")
			.withIndex("by_lawyer", (query) => query.eq("lawyerId", target))
			.collect();
		for (const deal of matches) {
			if (!seen.has(deal._id)) {
				seen.add(deal._id);
				deals.push(deal);
			}
		}
	}
	return deals.filter((deal) => {
		if (deal.lawyerId && targets.has(deal.lawyerId.toLowerCase())) {
			return true;
		}
		const selectedLawyer = deal.selectedLawyer;
		if (!selectedLawyer) {
			return false;
		}
		if (selectedLawyer.type === "platform_lawyer") {
			return Boolean(
				selectedLawyer.lawyerId && targets.has(selectedLawyer.lawyerId)
			);
		}
		return targets.has(selectedLawyer.email.toLowerCase());
	});
}

function selectedLawyerAuthTarget(deal: Doc<"deals">) {
	if (deal.selectedLawyer?.type === "platform_lawyer") {
		return deal.selectedLawyer.lawyerId ?? deal.lawyerId ?? null;
	}
	if (deal.selectedLawyer?.type === "guest_lawyer") {
		return normalizeLawyerEmail(deal.selectedLawyer.email);
	}
	return deal.lawyerId ?? null;
}

async function dealNeedsRepresentationOverride(
	ctx: Pick<QueryCtx, "db">,
	deal: Doc<"deals">
) {
	if (deal.status !== "lawyerOnboarding.verified") {
		return false;
	}
	const lawyerAuthId = selectedLawyerAuthTarget(deal);
	if (!lawyerAuthId) {
		return true;
	}
	const signed = await ctx.db
		.query("representationEngagements")
		.withIndex("by_deal_status", (query) =>
			query.eq("dealId", deal._id).eq("status", "signed")
		)
		.collect();
	return !signed.some((engagement) => engagement.lawyerAuthId === lawyerAuthId);
}

async function needsRepresentationOverride(
	ctx: Pick<QueryCtx, "db">,
	deals: readonly Doc<"deals">[]
) {
	for (const deal of deals) {
		if (await dealNeedsRepresentationOverride(ctx, deal)) {
			return true;
		}
	}
	return false;
}

function activeDealCount(deals: readonly Doc<"deals">[]) {
	return deals.filter((deal) => ACTIVE_DEAL_STATUSES.has(deal.status)).length;
}

function deriveSlaStatus(args: {
	readonly now: number;
	readonly review: Doc<"platformLawyerSlaReviews"> | null;
}): PlatformLawyerSlaReviewStatus | "none" {
	if (!args.review) {
		return "none";
	}
	if (args.review.status === "active" && args.review.dueAt <= args.now) {
		return "breached";
	}
	return args.review.status;
}

function deriveRestrictionStatus(args: {
	readonly assignment: Doc<"platformLawyerAssignments"> | null;
	readonly now: number;
	readonly recheck: Doc<"platformLawyerRestrictionRechecks"> | null;
}): PlatformLawyerRestrictionRecheckStatus | "due" | "none" {
	if (args.recheck?.status === "pending" || args.recheck?.status === "failed") {
		return args.recheck.status;
	}
	if (args.assignment && args.assignment.nextRestrictionRecheckAt <= args.now) {
		return "due";
	}
	return args.recheck?.status ?? "none";
}

function deriveUrgency(args: {
	readonly capacityWarning: PlatformLawyerCapacityWarningLevel | null;
	readonly invitation: Doc<"lawyerInvitations"> | null;
	readonly needsRepresentationOverride: boolean;
	readonly now: number;
	readonly openEscalationCount: number;
	readonly profile: Doc<"lawyerProfiles">;
	readonly restrictionStatus:
		| PlatformLawyerRestrictionRecheckStatus
		| "due"
		| "none";
	readonly slaStatus: PlatformLawyerSlaReviewStatus | "none";
	readonly verification: Doc<"lawyerVerifications"> | null;
}): AdminLawyerUrgency {
	if (args.slaStatus === "breached" || args.openEscalationCount > 0) {
		return "sla_breached";
	}
	if (args.needsRepresentationOverride) {
		return "representation_override_needed";
	}
	if (args.verification?.outcome === "requires_review") {
		return "verification_requires_review";
	}
	if (
		args.invitation?.status === "pending" &&
		args.invitation.expiresAt - args.now <= INVITATION_EXPIRING_WINDOW_MS
	) {
		return "invitation_expiring";
	}
	if (args.restrictionStatus === "due" || args.restrictionStatus === "failed") {
		return "restriction_recheck_due";
	}
	if (
		args.capacityWarning === "full" ||
		args.capacityWarning === "over_capacity"
	) {
		return "at_capacity";
	}
	if (
		includesPlatform(args.profile) &&
		args.profile.platformStatus !== "active"
	) {
		return "pending_onboarding";
	}
	return "normal";
}

function nextActionForUrgency(urgency: AdminLawyerUrgency) {
	switch (urgency) {
		case "sla_breached":
			return "Review SLA breach";
		case "representation_override_needed":
			return "Verify representation";
		case "verification_requires_review":
			return "Review verification";
		case "invitation_expiring":
			return "Resend or cancel invitation";
		case "restriction_recheck_due":
			return "Run restriction recheck";
		case "at_capacity":
			return "Review capacity";
		case "pending_onboarding":
			return "Complete platform onboarding";
		case "normal":
			return "Monitor";
		default:
			return "Review lawyer operations";
	}
}

function matchesSearch(profile: Doc<"lawyerProfiles">, search: string) {
	const normalized = search.trim().toLowerCase();
	if (normalized.length === 0) {
		return true;
	}
	return [
		profile.displayName,
		profile.email,
		profile.firmName ?? "",
		profile.barNumber ?? "",
		profile.jurisdiction ?? "",
	]
		.join(" ")
		.toLowerCase()
		.includes(normalized);
}

function profileKindMatches(
	profile: Doc<"lawyerProfiles">,
	filter: "all" | "platform" | "guest" | "both"
) {
	if (filter === "all") {
		return true;
	}
	return profile.profileKind === filter;
}

function platformStatusMatches(
	row: AdminLawyerRosterRow,
	filter: AdminLawyerRosterRow["platformStatus"] | "all"
) {
	return filter === "all" || row.platformStatus === filter;
}

function verificationStatusMatches(
	row: AdminLawyerRosterRow,
	filter: AdminLawyerRosterRow["verificationStatus"] | "all"
) {
	return filter === "all" || row.verificationStatus === filter;
}

function invitationStatusMatches(
	row: AdminLawyerRosterRow,
	filter: AdminLawyerRosterRow["invitationStatus"] | "all"
) {
	return filter === "all" || row.invitationStatus === filter;
}

function capacitySlaMatches(
	row: AdminLawyerRosterRow,
	filter: "all" | "sla_breached" | "at_capacity" | "restriction_recheck_due"
) {
	if (filter === "all") {
		return true;
	}
	return row.urgency === filter;
}

async function buildRosterRow(
	ctx: Pick<QueryCtx, "db">,
	profile: Doc<"lawyerProfiles">,
	now: number
): Promise<AdminLawyerRosterRow> {
	const [
		verification,
		invitations,
		platformInvitations,
		onboardingSessions,
		assignment,
		slaReview,
		restrictionRecheck,
		metrics,
		escalations,
		deals,
	] = await Promise.all([
		latestVerification(ctx, profile._id),
		invitationsForProfile(ctx, profile),
		platformInvitationsForProfile(ctx, profile._id),
		onboardingSessionsForProfile(ctx, profile._id),
		assignmentForProfile(ctx, profile._id),
		latestSlaReview(ctx, profile._id),
		latestRestrictionRecheck(ctx, profile._id),
		latestMetrics(ctx, profile._id),
		openEscalations(ctx, profile._id),
		dealsForProfile(ctx, profile),
	]);
	const invitation = latestInvitation(invitations);
	const platformInvitation = latestPlatformInvitation(platformInvitations);
	const onboardingSession = latestOnboardingSession(onboardingSessions);
	const dealCount = metrics?.activeDealCount ?? activeDealCount(deals);
	const capacityLimit =
		metrics?.capacityLimit ?? assignment?.capacityLimit ?? null;
	const capacityWarning =
		metrics?.capacityWarningLevel ??
		(capacityLimit !== null && dealCount >= capacityLimit ? "full" : null);
	const slaStatus = deriveSlaStatus({ now, review: slaReview });
	const restrictionStatus = deriveRestrictionStatus({
		assignment,
		now,
		recheck: restrictionRecheck,
	});
	const urgency = deriveUrgency({
		capacityWarning,
		invitation,
		needsRepresentationOverride: await needsRepresentationOverride(ctx, deals),
		now,
		openEscalationCount: escalations.length,
		profile,
		restrictionStatus,
		slaStatus,
		verification,
	});
	return {
		activeDealCount: dealCount,
		activeInvitation: summarizeInvitation(
			invitation?.status === "pending" ? invitation : null
		),
		barNumber: profile.barNumber ?? null,
		capacityLimit,
		capacityWarning,
		displayName: profile.displayName,
		email: profile.normalizedEmail,
		firmName: profile.firmName ?? null,
		invitationStatus:
			invitation?.status ?? platformInvitation?.status ?? "none",
		latestActivityAt: Math.max(
			profile.updatedAt,
			verification?.createdAt ?? 0,
			invitation?.updatedAt ?? 0,
			platformInvitation?.updatedAt ?? 0,
			onboardingSession?.updatedAt ?? 0,
			slaReview?.updatedAt ?? 0,
			restrictionRecheck?.startedAt ?? 0,
			metrics?.calculatedAt ?? 0,
			...deals.map((deal) => deal.createdAt)
		),
		nextAction: nextActionForUrgency(urgency),
		platformStatus: includesPlatform(profile)
			? (profile.platformStatus ?? "invited")
			: "not_platform",
		platformInvitation: summarizePlatformInvitation(platformInvitation),
		platformOnboardingSession: summarizeOnboardingSession(onboardingSession),
		jurisdiction: profile.jurisdiction ?? null,
		latestVerification: summarizeVerification(verification),
		profileId: profile._id,
		profileKind: profile.profileKind,
		restrictionRecheckStatus: restrictionStatus,
		slaStatus,
		urgency,
		verificationStatus: verification?.outcome ?? "not_verified",
	};
}

function summarizeRows(rows: readonly AdminLawyerRosterRow[]) {
	return {
		atCapacity: rows.filter((row) => row.urgency === "at_capacity").length,
		invitationsExpiring: rows.filter(
			(row) => row.urgency === "invitation_expiring"
		).length,
		needsAction: rows.filter((row) => row.urgency !== "normal").length,
		restrictionRecheckDue: rows.filter(
			(row) => row.urgency === "restriction_recheck_due"
		).length,
		slaBreached: rows.filter((row) => row.urgency === "sla_breached").length,
		verificationReview: rows.filter(
			(row) => row.urgency === "verification_requires_review"
		).length,
	};
}

function activityEvents(args: {
	readonly deals: readonly Doc<"deals">[];
	readonly escalations: readonly Doc<"platformLawyerEscalations">[];
	readonly invitations: readonly Doc<"lawyerInvitations">[];
	readonly onboardingSessions: readonly Doc<"lawyerOnboardingSessions">[];
	readonly overrideEvidence: readonly Doc<"representationOverrideEvidence">[];
	readonly platformInvitations: readonly Doc<"platformLawyerInvitations">[];
	readonly profile: Doc<"lawyerProfiles">;
	readonly verifications: readonly Doc<"lawyerVerifications">[];
}) {
	const events = [
		{
			at: args.profile.updatedAt,
			entityId: String(args.profile._id),
			kind: "profile_updated",
			label: "Profile updated",
		},
		...args.invitations.map((invitation) => ({
			at: invitation.updatedAt,
			entityId: String(invitation._id),
			kind: "invitation_updated",
			label: `Invitation ${invitation.status}`,
		})),
		...args.platformInvitations.map((invitation) => ({
			at: invitation.updatedAt,
			entityId: String(invitation._id),
			kind: "platform_invitation_updated",
			label: `Platform invitation ${invitation.status}`,
		})),
		...args.onboardingSessions.map((session) => ({
			at: session.updatedAt,
			entityId: String(session._id),
			kind: "onboarding_session_updated",
			label: `Onboarding ${session.status}`,
		})),
		...args.verifications.map((verification) => ({
			at: verification.createdAt,
			entityId: String(verification._id),
			kind: "verification_recorded",
			label: `Verification ${verification.outcome}`,
		})),
		...args.deals.map((deal) => ({
			at: deal.createdAt,
			entityId: String(deal._id),
			kind: "deal_linked",
			label: `Deal ${deal.status}`,
		})),
		...args.escalations.map((escalation) => ({
			at: escalation.createdAt,
			entityId: String(escalation._id),
			kind: "escalation_opened",
			label: escalation.message,
		})),
		...args.overrideEvidence.map((evidence) => ({
			at: evidence.createdAt,
			entityId: String(evidence._id),
			kind: "representation_override",
			label: evidence.reason,
		})),
	];
	return events.sort((a, b) => b.at - a.at).slice(0, 25);
}

export const listLawyerRosterPage = adminQuery
	.input({
		filters: v.object({
			capacitySla: v.optional(capacitySlaFilterValidator),
			invitationStatus: v.optional(invitationStatusFilterValidator),
			platformStatus: v.optional(platformStatusFilterValidator),
			profileKind: profileKindFilterValidator,
			urgency: urgencyValidator,
			verificationStatus: v.optional(verificationStatusFilterValidator),
		}),
		pagination: v.object({
			cursor: v.union(v.null(), v.number()),
			pageSize: v.number(),
		}),
		search: v.string(),
		sort: rosterSortValidator,
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		const pageSize = Math.min(
			Math.max(args.pagination.pageSize, 1),
			MAX_PAGE_SIZE
		);
		const start = Math.max(args.pagination.cursor ?? 0, 0);
		const profiles = await ctx.db
			.query("lawyerProfiles")
			.take(MAX_ROSTER_SCAN + 1);
		const boundedProfiles = profiles.slice(0, MAX_ROSTER_SCAN);
		const rows = await Promise.all(
			boundedProfiles
				.filter((profile) => matchesSearch(profile, args.search))
				.filter((profile) =>
					profileKindMatches(profile, args.filters.profileKind)
				)
				.map(async (profile) => await buildRosterRow(ctx, profile, now))
		);
		const filteredRows = rows.filter(
			(row) =>
				(args.filters.urgency === "all" ||
					row.urgency === args.filters.urgency) &&
				platformStatusMatches(row, args.filters.platformStatus ?? "all") &&
				verificationStatusMatches(
					row,
					args.filters.verificationStatus ?? "all"
				) &&
				invitationStatusMatches(row, args.filters.invitationStatus ?? "all") &&
				capacitySlaMatches(row, args.filters.capacitySla ?? "all")
		);
		const sortedRows = filteredRows.sort((a, b) => {
			if (args.sort === "name") {
				return a.displayName.localeCompare(b.displayName);
			}
			if (args.sort === "latest_activity") {
				return b.latestActivityAt - a.latestActivityAt;
			}
			const urgencyDelta = compareUrgency(a.urgency, b.urgency);
			return urgencyDelta === 0
				? b.latestActivityAt - a.latestActivityAt
				: urgencyDelta;
		});
		return {
			nextCursor:
				start + pageSize < sortedRows.length ? start + pageSize : null,
			rows: sortedRows.slice(start, start + pageSize),
			summary: summarizeRows(rows),
			totalCount: sortedRows.length,
		};
	})
	.public();

export const getLawyerAdminDetail = adminQuery
	.input({ profileId: v.id("lawyerProfiles") })
	.handler(async (ctx, args) => {
		const profile = await ctx.db.get(args.profileId);
		if (!profile) {
			throw new ConvexError("Lawyer profile not found");
		}
		const [
			verifications,
			invitations,
			platformInvitations,
			onboardingSessions,
			assignment,
			slaReview,
			restrictionRecheck,
			metrics,
			escalations,
			deals,
			availability,
		] = await Promise.all([
			ctx.db
				.query("lawyerVerifications")
				.withIndex("by_profile_check_created", (query) =>
					query.eq("lawyerProfileId", args.profileId)
				)
				.collect(),
			invitationsForProfile(ctx, profile),
			platformInvitationsForProfile(ctx, args.profileId),
			onboardingSessionsForProfile(ctx, args.profileId),
			assignmentForProfile(ctx, args.profileId),
			latestSlaReview(ctx, args.profileId),
			latestRestrictionRecheck(ctx, args.profileId),
			latestMetrics(ctx, args.profileId),
			openEscalations(ctx, args.profileId),
			dealsForProfile(ctx, profile),
			availabilityForProfile(ctx, args.profileId),
		]);
		const dealIds = new Set(deals.map((deal) => deal._id));
		const engagements = (
			await ctx.db.query("representationEngagements").collect()
		).filter(
			(engagement) =>
				engagement.lawyerProfileId === args.profileId ||
				dealIds.has(engagement.dealId)
		);
		const overrideEvidence = (
			await ctx.db.query("representationOverrideEvidence").collect()
		).filter((evidence) => dealIds.has(evidence.dealId));
		const activeInvitations = invitations.filter(
			(invitation) => invitation.status === "pending"
		);
		const activePlatformInvitations = platformInvitations.filter(
			(invitation) =>
				invitation.status === "pending" || invitation.status === "sent"
		);
		const activeOnboardingSessions = onboardingSessions.filter(
			(session) =>
				session.status !== "complete" &&
				session.status !== "expired" &&
				session.status !== "blocked"
		);
		return {
			allowedActions: {
				cancelInvitation: activeInvitations.length > 0,
				replaceLawyer: deals.length > 0,
				resendInvitation: activeInvitations.length > 0,
				verifyRepresentation: deals.length > 0,
			},
			activity: {
				events: activityEvents({
					deals,
					escalations,
					invitations,
					onboardingSessions,
					overrideEvidence,
					platformInvitations,
					profile,
					verifications,
				}),
				latestActivityAt: Math.max(
					profile.updatedAt,
					...invitations.map((invitation) => invitation.updatedAt),
					...platformInvitations.map((invitation) => invitation.updatedAt),
					...onboardingSessions.map((session) => session.updatedAt),
					...verifications.map((verification) => verification.createdAt),
					...deals.map((deal) => deal.createdAt)
				),
			},
			deals: {
				active: deals.filter((deal) => ACTIVE_DEAL_STATUSES.has(deal.status)),
				recent: deals.filter((deal) => !ACTIVE_DEAL_STATUSES.has(deal.status)),
			},
			invitations: {
				active: activeInvitations,
				historical: invitations.filter(
					(invitation) => invitation.status !== "pending"
				),
			},
			platform: {
				assignment,
				availability,
				escalations,
				invitations: {
					active: activePlatformInvitations,
					historical: platformInvitations.filter(
						(invitation) =>
							invitation.status !== "pending" && invitation.status !== "sent"
					),
				},
				metrics,
				onboardingSessions: {
					active: activeOnboardingSessions,
					historical: onboardingSessions.filter(
						(session) =>
							session.status === "complete" ||
							session.status === "expired" ||
							session.status === "blocked"
					),
				},
				restrictionRecheck,
				slaReview,
			},
			profile,
			representation: {
				engagements,
				overrideEvidence,
			},
			verifications: [...verifications].sort(
				(a, b) => b.createdAt - a.createdAt
			),
		};
	})
	.public();

async function findSyncedUserByEmail(ctx: Pick<QueryCtx, "db">, email: string) {
	const normalizedEmail = normalizeLawyerEmail(email);
	const exact = await ctx.db
		.query("users")
		.withIndex("by_email", (query) => query.eq("email", normalizedEmail))
		.first();
	if (exact) {
		return exact;
	}
	const rows = await ctx.db.query("users").take(100);
	return (
		rows.find((user) => normalizeLawyerEmail(user.email) === normalizedEmail) ??
		null
	);
}

async function findLawyerProfileByEmail(
	ctx: Pick<QueryCtx, "db">,
	email: string
) {
	return await ctx.db
		.query("lawyerProfiles")
		.withIndex("by_normalized_email", (query) =>
			query.eq("normalizedEmail", normalizeLawyerEmail(email))
		)
		.unique();
}

function platformInviteAction(args: {
	readonly profile: Doc<"lawyerProfiles"> | null;
	readonly resolution:
		| "attach_existing_user"
		| "designate_existing_profile"
		| "create_pending";
	readonly user: Doc<"users"> | null;
}) {
	if (args.resolution === "create_pending") {
		return "created_pending_invite" as const;
	}
	if (args.user) {
		return "attached_existing_user" as const;
	}
	if (args.profile) {
		return "designated_existing_profile" as const;
	}
	return "created_pending_invite" as const;
}

function recommendedPlatformInviteAction(args: {
	readonly profile: Doc<"lawyerProfiles"> | null;
	readonly user: Doc<"users"> | null;
}) {
	if (args.user) {
		return "attach_existing_user" as const;
	}
	if (args.profile) {
		return "designate_existing_profile" as const;
	}
	return "create_pending" as const;
}

function sanitizeDeliveryError(error: unknown) {
	return (error instanceof Error ? error.message : String(error)).slice(
		0,
		DELIVERY_ERROR_MAX_LENGTH
	);
}

export const resolvePlatformLawyerInvite = adminQuery
	.input({ email: v.string() })
	.handler(async (ctx, args) => {
		const normalizedEmail = normalizeLawyerEmail(args.email);
		const [user, profile] = await Promise.all([
			findSyncedUserByEmail(ctx, normalizedEmail),
			findLawyerProfileByEmail(ctx, normalizedEmail),
		]);
		return {
			normalizedEmail,
			profile: profile
				? {
						authId: profile.authId ?? null,
						displayName: profile.displayName,
						email: profile.email,
						firmName: profile.firmName ?? null,
						platformStatus: profile.platformStatus ?? null,
						profileId: profile._id,
						profileKind: profile.profileKind,
					}
				: null,
			recommendedAction: recommendedPlatformInviteAction({ profile, user }),
			user: user
				? {
						authId: user.authId,
						displayName: `${user.firstName} ${user.lastName}`.trim(),
						email: user.email,
						userId: user._id,
					}
				: null,
		};
	})
	.public();

export const updatePlatformInvitationDeliveryInternal = convex
	.mutation()
	.input({
		acceptInvitationUrl: v.optional(v.string()),
		deliveryError: v.optional(v.string()),
		deliveryStatus: v.union(
			v.literal("pending"),
			v.literal("sent"),
			v.literal("failed")
		),
		invitationId: v.id("platformLawyerInvitations"),
		lastDeliveryAttemptAt: v.number(),
		status: v.union(
			v.literal("pending"),
			v.literal("sent"),
			v.literal("failed")
		),
		workosInvitationId: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		await ctx.db.patch(args.invitationId, {
			acceptInvitationUrl: args.acceptInvitationUrl,
			deliveredAt:
				args.deliveryStatus === "sent" ? args.lastDeliveryAttemptAt : undefined,
			deliveryError: args.deliveryError,
			deliveryStatus: args.deliveryStatus,
			lastDeliveryAttemptAt: args.lastDeliveryAttemptAt,
			status: args.status,
			updatedAt: args.lastDeliveryAttemptAt,
			workosInvitationId: args.workosInvitationId,
		});
	})
	.internal();

async function deliverPlatformInvite(
	ctx: Pick<ActionCtx, "runMutation">,
	invitation: Doc<"platformLawyerInvitations">
) {
	const now = Date.now();
	try {
		const sendInvitation = getWorkosProvisioning().sendInvitation;
		if (!sendInvitation) {
			throw new ConvexError("WorkOS invitation delivery is not configured");
		}
		const result = await sendInvitation({
			email: invitation.email,
			organizationId: FAIRLEND_LAWYERS_ORG_ID,
			roleSlug: LAWYER_ROLE_SLUG,
		});
		await ctx.runMutation(
			internal.legalRepresentation.adminLawyers
				.updatePlatformInvitationDeliveryInternal,
			{
				acceptInvitationUrl: result.acceptInvitationUrl,
				deliveryStatus: "sent",
				invitationId: invitation._id,
				lastDeliveryAttemptAt: now,
				status: "sent",
				workosInvitationId: result.id,
			}
		);
		return { status: "sent" as const, workosInvitationId: result.id };
	} catch (error) {
		await ctx.runMutation(
			internal.legalRepresentation.adminLawyers
				.updatePlatformInvitationDeliveryInternal,
			{
				deliveryError: sanitizeDeliveryError(error),
				deliveryStatus: "failed",
				invitationId: invitation._id,
				lastDeliveryAttemptAt: now,
				status: "failed",
			}
		);
		return { status: "failed" as const };
	}
}

export const getPlatformLawyerInvitationForDeliveryInternal = convex
	.query()
	.input({ invitationId: v.id("platformLawyerInvitations") })
	.handler(async (ctx, args) => await ctx.db.get(args.invitationId))
	.internal();

export const getPlatformInvitationByWorkosInvitationIdInternal = convex
	.query()
	.input({ workosInvitationId: v.string() })
	.handler(async (ctx, args) => {
		return await ctx.db
			.query("platformLawyerInvitations")
			.withIndex("by_workos_invitation", (query) =>
				query.eq("workosInvitationId", args.workosInvitationId)
			)
			.first();
	})
	.internal();

export const deliverPlatformLawyerInvitation = convex
	.action()
	.input({ invitationId: v.id("platformLawyerInvitations") })
	.handler(
		async (
			ctx,
			args
		): Promise<
			| { readonly status: "failed" | "skipped" }
			| { readonly status: "sent"; readonly workosInvitationId: string }
		> => {
			const invitation: Doc<"platformLawyerInvitations"> | null =
				await ctx.runQuery(
					internal.legalRepresentation.adminLawyers
						.getPlatformLawyerInvitationForDeliveryInternal,
					{ invitationId: args.invitationId }
				);
			if (!invitation || invitation.status !== "pending") {
				return { status: "skipped" as const };
			}
			return await deliverPlatformInvite(ctx, invitation);
		}
	)
	.internal();

export const invitePlatformLawyer = adminMutation
	.input({
		authId: v.optional(v.string()),
		barNumber: v.optional(v.string()),
		deliverViaWorkos: v.optional(v.boolean()),
		displayName: v.string(),
		email: v.string(),
		firmName: v.optional(v.string()),
		jurisdiction: v.optional(v.string()),
		platformStatus: v.optional(legalRepresentationPlatformStatusValidator),
		resolution: v.optional(platformInviteResolutionValidator),
	})
	.handler(async (ctx, args) => {
		const normalizedEmail = normalizeLawyerEmail(args.email);
		const displayName = requiredText(args.displayName, "Lawyer name");
		const [syncedUser, existingProfile] = await Promise.all([
			findSyncedUserByEmail(ctx, normalizedEmail),
			findLawyerProfileByEmail(ctx, normalizedEmail),
		]);
		const resolution =
			args.resolution ??
			recommendedPlatformInviteAction({
				profile: existingProfile,
				user: syncedUser,
			});
		if (resolution === "attach_existing_user" && !(args.authId || syncedUser)) {
			throw new ConvexError("A synced WorkOS user is required to attach");
		}
		const authId =
			resolution === "create_pending"
				? args.authId
				: (args.authId ?? syncedUser?.authId ?? existingProfile?.authId);
		const upsertArgs: UpsertPlatformLawyerProfileArgs = {
			actorId: ctx.viewer.authId,
			authId,
			barNumber: optionalText(args.barNumber),
			displayName,
			email: normalizedEmail,
			firmName: optionalText(args.firmName),
			jurisdiction: optionalText(args.jurisdiction),
			platformStatus: args.platformStatus ?? "invited",
		};
		const profileId = await upsertPlatformLawyerProfile(
			ctx as Pick<MutationCtx, "db">,
			upsertArgs
		);
		const action = platformInviteAction({
			profile: existingProfile,
			resolution,
			user: syncedUser,
		});
		if (action !== "created_pending_invite") {
			return {
				action,
				deliveryStatus: "not_sent" as const,
				invitationId: null,
				profileId,
			};
		}
		const now = Date.now();
		const invitationId = await ctx.db.insert("platformLawyerInvitations", {
			barNumber: optionalText(args.barNumber),
			createdAt: now,
			createdBy: ctx.viewer.authId,
			deliveryStatus: "pending",
			displayName,
			email: normalizedEmail,
			firmName: optionalText(args.firmName),
			jurisdiction: optionalText(args.jurisdiction),
			lawyerProfileId: profileId,
			normalizedEmail,
			status: "pending",
			updatedAt: now,
		});
		if (args.deliverViaWorkos !== false) {
			await ctx.scheduler.runAfter(
				1,
				internal.legalRepresentation.adminLawyers
					.deliverPlatformLawyerInvitation,
				{ invitationId }
			);
		}
		return {
			action,
			deliveryStatus: "pending" as const,
			invitationId,
			profileId,
		};
	})
	.public();
