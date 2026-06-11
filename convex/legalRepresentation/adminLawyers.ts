import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { FAIRLEND_LAWYERS_ORG_ID } from "../constants";
import {
	isActiveLawyerMatterStatus,
	isPastLawyerMatterStatus,
} from "../deals/status";
import { getWorkosProvisioning } from "../engine/effects/workosProvisioning";
import { adminMutation, adminQuery, convex } from "../fluent";
import {
	normalizeBarNumber,
	normalizeJurisdiction,
	normalizeLawyerEmail,
	normalizeLegalWhitespace,
} from "./normalization";
import {
	type UpsertGuestLawyerProfileArgs,
	type UpsertPlatformLawyerProfileArgs,
	upsertGuestLawyerProfile,
	upsertPlatformLawyerProfile,
} from "./profiles";
import { buildManualLawyerVerificationResult } from "./providers";
import {
	type LawyerVerificationOutcome,
	legalRepresentationPlatformStatusValidator,
	type PlatformLawyerCapacityWarningLevel,
	type PlatformLawyerRestrictionRecheckStatus,
	type PlatformLawyerSlaReviewStatus,
} from "./validators";
import { recordLawyerVerificationRow } from "./verifications";

const MAX_PAGE_SIZE = 50;
const MAX_ROSTER_SCAN = 500;
const INVITATION_EXPIRING_WINDOW_MS = 48 * 60 * 60 * 1000;
const LAWYER_ROLE_SLUG = "lawyer";
const DELIVERY_ERROR_MAX_LENGTH = 400;
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

const lawyerIdentityRepairOverridesValidator = v.optional(
	v.object({
		authId: v.optional(v.string()),
		barNumber: v.optional(v.string()),
		displayName: v.optional(v.string()),
		email: v.optional(v.string()),
		firmName: v.optional(v.string()),
		jurisdiction: v.optional(v.string()),
		lsoLawyerId: v.optional(v.id("lsoLawyers")),
	})
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
	readonly identityRepair: {
		readonly repairKey: string;
		readonly totalEvidenceRecords: number;
	} | null;
	readonly identityStatus: "linked" | "missing_profile";
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
	readonly pastDealCount: number;
	readonly pendingDealInviteCount: number;
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
	readonly profileId: Id<"lawyerProfiles"> | null;
	readonly profileKind: Doc<"lawyerProfiles">["profileKind"];
	readonly restrictionRecheckStatus:
		| PlatformLawyerRestrictionRecheckStatus
		| "due"
		| "none";
	readonly rowKey: string;
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

function addLawyerTarget(targets: Set<string>, value: string | undefined) {
	if (value === undefined) {
		return;
	}
	const normalized = value.trim();
	if (normalized.length === 0) {
		return;
	}
	targets.add(normalized);
	targets.add(normalized.toLowerCase());
}

async function lawyerAuthTargets(
	ctx: Pick<QueryCtx, "db">,
	profile: Doc<"lawyerProfiles">
) {
	const targets = new Set<string>();
	addLawyerTarget(targets, profile.authId);
	addLawyerTarget(targets, profile.normalizedEmail);
	addLawyerTarget(targets, profile.email);
	const userByEmail = await ctx.db
		.query("users")
		.withIndex("by_email", (query) => query.eq("email", profile.email))
		.first();
	const userByNormalizedEmail =
		profile.normalizedEmail === profile.email
			? null
			: await ctx.db
					.query("users")
					.withIndex("by_email", (query) =>
						query.eq("email", profile.normalizedEmail)
					)
					.first();
	addLawyerTarget(targets, userByEmail?.authId);
	addLawyerTarget(targets, userByNormalizedEmail?.authId);
	return targets;
}

function isLawyerDealAccess(access: Doc<"dealAccess">) {
	return access.role === "platform_lawyer" || access.role === "guest_lawyer";
}

async function addDealById(
	ctx: Pick<QueryCtx, "db">,
	args: {
		readonly dealId: Id<"deals">;
		readonly deals: Doc<"deals">[];
		readonly seen: Set<Id<"deals">>;
	}
) {
	if (args.seen.has(args.dealId)) {
		return;
	}
	const deal = await ctx.db.get(args.dealId);
	if (!deal) {
		return;
	}
	args.seen.add(deal._id);
	args.deals.push(deal);
}

async function dealsForProfile(
	ctx: Pick<QueryCtx, "db">,
	profile: Doc<"lawyerProfiles">
) {
	const targets = await lawyerAuthTargets(ctx, profile);
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
		const accessRows = await ctx.db
			.query("dealAccess")
			.withIndex("by_user", (query) => query.eq("userId", target))
			.collect();
		for (const access of accessRows) {
			if (access.status !== "active" || !isLawyerDealAccess(access)) {
				continue;
			}
			await addDealById(ctx, { dealId: access.dealId, deals, seen });
		}
		const engagements = await ctx.db
			.query("representationEngagements")
			.withIndex("by_lawyer", (query) => query.eq("lawyerAuthId", target))
			.collect();
		for (const engagement of engagements) {
			await addDealById(ctx, { dealId: engagement.dealId, deals, seen });
		}
	}
	return deals.filter((deal) => {
		if (deal.lawyerId && targets.has(deal.lawyerId.toLowerCase())) {
			return true;
		}
		if (seen.has(deal._id)) {
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
	return deals.filter((deal) => isActiveLawyerMatterStatus(deal.status)).length;
}

function primaryAdminActionDealId(deals: readonly Doc<"deals">[]) {
	const activeDeal = deals.find((deal) =>
		ACTIVE_DEAL_STATUSES.has(deal.status)
	);
	return activeDeal?._id ?? deals[0]?._id ?? null;
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

function rowProfileKindMatches(
	row: AdminLawyerRosterRow,
	filter: "all" | "platform" | "guest" | "both"
) {
	if (filter === "all") {
		return true;
	}
	return row.profileKind === filter;
}

function matchesRosterRowSearch(row: AdminLawyerRosterRow, search: string) {
	const normalized = search.trim().toLowerCase();
	if (normalized.length === 0) {
		return true;
	}
	return [
		row.displayName,
		row.email,
		row.firmName ?? "",
		row.barNumber ?? "",
		row.jurisdiction ?? "",
	]
		.join(" ")
		.toLowerCase()
		.includes(normalized);
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
	const pendingDealInviteCount = invitations.filter(
		(row) => row.status === "pending"
	).length;
	const dealCount = activeDealCount(deals);
	const pastDealCount = deals.filter((deal) =>
		isPastLawyerMatterStatus(deal.status)
	).length;
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
		pastDealCount,
		pendingDealInviteCount,
		platformStatus: includesPlatform(profile)
			? (profile.platformStatus ?? "invited")
			: "not_platform",
		platformInvitation: summarizePlatformInvitation(platformInvitation),
		platformOnboardingSession: summarizeOnboardingSession(onboardingSession),
		jurisdiction: profile.jurisdiction ?? null,
		latestVerification: summarizeVerification(verification),
		identityRepair: null,
		identityStatus: "linked",
		profileId: profile._id,
		profileKind: profile.profileKind,
		restrictionRecheckStatus: restrictionStatus,
		rowKey: `profile:${String(profile._id)}`,
		slaStatus,
		urgency,
		verificationStatus: verification?.outcome ?? "not_verified",
	};
}

function summarizeRows(rows: readonly AdminLawyerRosterRow[]) {
	return {
		atCapacity: rows.filter((row) => row.urgency === "at_capacity").length,
		identityRepairs: rows.filter(
			(row) => row.identityStatus === "missing_profile"
		).length,
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
		const profileRows = await Promise.all(
			boundedProfiles.map(
				async (profile) => await buildRosterRow(ctx, profile, now)
			)
		);
		const repairRows = (await collectLawyerProfileRepairCandidates(ctx)).map(
			buildRepairRosterRow
		);
		const rows = [...profileRows, ...repairRows].filter(
			(row) =>
				matchesRosterRowSearch(row, args.search) &&
				rowProfileKindMatches(row, args.filters.profileKind)
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
		const actionDealId = primaryAdminActionDealId(deals);
		return {
			actionTargets: {
				replacementDealId: actionDealId,
				representationDealId: actionDealId,
			},
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
				active: deals.filter((deal) => isActiveLawyerMatterStatus(deal.status)),
				recent: deals.filter((deal) => isPastLawyerMatterStatus(deal.status)),
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

interface LawyerProfileRepairCandidateDraft {
	authId: string | null;
	barNumber: string | null;
	dealIds: Set<Id<"deals">>;
	displayName: string | null;
	email: string | null;
	engagementIds: Set<Id<"representationEngagements">>;
	firmName: string | null;
	invitationIds: Set<Id<"lawyerInvitations">>;
	jurisdiction: string | null;
	latestActivityAt: number;
	latestInvitation: Doc<"lawyerInvitations"> | null;
	latestVerification: Doc<"lawyerVerifications"> | null;
	onboardingSessionIds: Set<Id<"lawyerOnboardingSessions">>;
	repairKey: string;
	sourceKinds: Set<string>;
	verificationIds: Set<Id<"lawyerVerifications">>;
}

type RepairCandidateMap = Map<string, LawyerProfileRepairCandidateDraft>;
type RepairEvidenceTable =
	| "deals"
	| "lawyerInvitations"
	| "lawyerOnboardingSessions"
	| "lawyerVerifications"
	| "representationEngagements";

interface RepairEvidenceRecord {
	readonly label: string;
	readonly recordId: string;
	readonly summary: string;
	readonly table: RepairEvidenceTable;
}

function repairKeyForIdentity(args: {
	readonly authId?: string | null;
	readonly barNumber?: string | null;
	readonly email?: string | null;
	readonly jurisdiction?: string | null;
}) {
	if (args.authId) {
		return `auth:${args.authId}`;
	}
	if (args.email) {
		return `email:${normalizeLawyerEmail(args.email)}`;
	}
	if (args.barNumber && args.jurisdiction) {
		return `license:${normalizeBarNumber(args.barNumber)}:${normalizeJurisdiction(args.jurisdiction)}`;
	}
	return null;
}

function repairKeysForIdentity(args: {
	readonly authId?: string | null;
	readonly barNumber?: string | null;
	readonly email?: string | null;
	readonly jurisdiction?: string | null;
}) {
	const keys: string[] = [];
	if (args.authId) {
		keys.push(`auth:${args.authId}`);
	}
	if (args.email) {
		keys.push(`email:${normalizeLawyerEmail(args.email)}`);
	}
	if (args.barNumber && args.jurisdiction) {
		keys.push(
			`license:${normalizeBarNumber(args.barNumber)}:${normalizeJurisdiction(args.jurisdiction)}`
		);
	}
	return keys;
}

function emptyRepairCandidate(args: {
	readonly authId?: string | null;
	readonly barNumber?: string | null;
	readonly displayName?: string | null;
	readonly email?: string | null;
	readonly firmName?: string | null;
	readonly jurisdiction?: string | null;
	readonly latestActivityAt: number;
	readonly repairKey: string;
}) {
	return {
		authId: args.authId ?? null,
		barNumber: args.barNumber ?? null,
		dealIds: new Set<Id<"deals">>(),
		displayName: args.displayName ?? null,
		email: args.email ? normalizeLawyerEmail(args.email) : null,
		engagementIds: new Set<Id<"representationEngagements">>(),
		firmName: args.firmName ?? null,
		jurisdiction: args.jurisdiction
			? normalizeJurisdiction(args.jurisdiction)
			: null,
		latestActivityAt: args.latestActivityAt,
		onboardingSessionIds: new Set<Id<"lawyerOnboardingSessions">>(),
		invitationIds: new Set<Id<"lawyerInvitations">>(),
		latestInvitation: null,
		latestVerification: null,
		repairKey: args.repairKey,
		sourceKinds: new Set<string>(),
		verificationIds: new Set<Id<"lawyerVerifications">>(),
	} satisfies LawyerProfileRepairCandidateDraft;
}

function mergeRepairCandidateIdentity(
	candidate: LawyerProfileRepairCandidateDraft,
	args: {
		readonly authId?: string | null;
		readonly barNumber?: string | null;
		readonly displayName?: string | null;
		readonly email?: string | null;
		readonly firmName?: string | null;
		readonly jurisdiction?: string | null;
		readonly latestActivityAt: number;
	}
) {
	candidate.authId ??= args.authId ?? null;
	candidate.barNumber ??=
		args.barNumber === undefined || args.barNumber === null
			? null
			: normalizeBarNumber(args.barNumber);
	candidate.displayName ??= optionalText(args.displayName ?? undefined) ?? null;
	candidate.email ??= args.email ? normalizeLawyerEmail(args.email) : null;
	candidate.firmName ??= optionalText(args.firmName ?? undefined) ?? null;
	candidate.jurisdiction ??= args.jurisdiction
		? normalizeJurisdiction(args.jurisdiction)
		: null;
	candidate.latestActivityAt = Math.max(
		candidate.latestActivityAt,
		args.latestActivityAt
	);
}

function selectedGuestLawyerIdentity(deal: Doc<"deals"> | null) {
	if (deal?.selectedLawyer?.type !== "guest_lawyer") {
		return {
			barNumber: null,
			displayName: null,
			email: null,
			firmName: null,
			jurisdiction: null,
		};
	}
	return {
		barNumber: deal.selectedLawyer.lso?.barNumber ?? null,
		displayName: deal.selectedLawyer.name,
		email: deal.selectedLawyer.email,
		firmName: deal.selectedLawyer.firm,
		jurisdiction: deal.selectedLawyer.lso?.jurisdiction ?? null,
	};
}

async function userIdentityForAuthId(
	ctx: Pick<QueryCtx, "db">,
	authId: string | null | undefined
) {
	if (!authId) {
		return {
			displayName: null,
			email: null,
		};
	}
	const user = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", authId))
		.first();
	if (!user) {
		return {
			displayName: null,
			email: null,
		};
	}
	return {
		displayName: `${user.firstName} ${user.lastName}`.trim() || null,
		email: user.email,
	};
}

async function profileExistsForRepairCandidate(
	ctx: Pick<QueryCtx, "db">,
	args: {
		readonly authId?: string | null;
		readonly email?: string | null;
	}
) {
	const authId = args.authId ?? undefined;
	if (authId) {
		const byAuth = await ctx.db
			.query("lawyerProfiles")
			.withIndex("by_auth_id", (query) => query.eq("authId", authId))
			.first();
		if (byAuth) {
			return byAuth;
		}
	}
	const email = args.email ?? undefined;
	if (email) {
		return await ctx.db
			.query("lawyerProfiles")
			.withIndex("by_normalized_email", (query) =>
				query.eq("normalizedEmail", normalizeLawyerEmail(email))
			)
			.first();
	}
	return null;
}

function upsertRepairCandidate(
	candidates: RepairCandidateMap,
	args: {
		readonly authId?: string | null;
		readonly barNumber?: string | null;
		readonly displayName?: string | null;
		readonly email?: string | null;
		readonly firmName?: string | null;
		readonly jurisdiction?: string | null;
		readonly latestActivityAt: number;
		readonly sourceKind: string;
	}
) {
	const repairKey = repairKeyForIdentity(args);
	if (!repairKey) {
		return null;
	}
	const existingKey = repairKeysForIdentity(args).find((key) =>
		candidates.has(key)
	);
	const candidate =
		(existingKey ? candidates.get(existingKey) : undefined) ??
		emptyRepairCandidate({
			...args,
			repairKey,
		});
	if (existingKey && existingKey !== repairKey) {
		candidates.delete(existingKey);
		candidate.repairKey = repairKey;
	}
	mergeRepairCandidateIdentity(candidate, args);
	candidate.sourceKinds.add(args.sourceKind);
	candidates.set(repairKey, candidate);
	return candidate;
}

function attachRepairInvitation(
	candidate: LawyerProfileRepairCandidateDraft | null,
	invitation: Doc<"lawyerInvitations">
) {
	if (!candidate) {
		return;
	}
	candidate.invitationIds.add(invitation._id);
	if (
		candidate.latestInvitation === null ||
		invitation.updatedAt > candidate.latestInvitation.updatedAt
	) {
		candidate.latestInvitation = invitation;
	}
}

async function collectUnprofiledGuestInvitationCandidates(
	ctx: Pick<QueryCtx, "db">,
	candidates: RepairCandidateMap
) {
	const invitations = await ctx.db
		.query("lawyerInvitations")
		.take(MAX_ROSTER_SCAN);
	for (const invitation of invitations) {
		const profile = await profileExistsForRepairCandidate(ctx, {
			authId: invitation.resolvedAuthId ?? null,
			email: invitation.normalizedTargetEmail,
		});
		if (profile) {
			continue;
		}
		const selected = invitation.selectedLawyerSnapshot;
		const userIdentity = await userIdentityForAuthId(
			ctx,
			invitation.resolvedAuthId
		);
		const candidate = upsertRepairCandidate(candidates, {
			authId: invitation.resolvedAuthId ?? null,
			barNumber: selected.lso?.barNumber ?? null,
			displayName: selected.name ?? userIdentity.displayName,
			email: invitation.normalizedTargetEmail,
			firmName: selected.firm,
			jurisdiction: selected.lso?.jurisdiction ?? null,
			latestActivityAt: invitation.updatedAt,
			sourceKind: "invitation",
		});
		attachRepairInvitation(candidate, invitation);
		candidate?.dealIds.add(invitation.dealId);
	}
}

async function collectUnprofiledGuestDealCandidates(
	ctx: Pick<QueryCtx, "db">,
	candidates: RepairCandidateMap
) {
	const deals = await ctx.db.query("deals").take(MAX_ROSTER_SCAN);
	for (const deal of deals) {
		if (deal.lawyerType !== "guest_lawyer") {
			continue;
		}
		const selected = selectedGuestLawyerIdentity(deal);
		const authId = deal.lawyerId?.includes("@") ? null : deal.lawyerId;
		const userIdentity = await userIdentityForAuthId(ctx, authId);
		const email =
			selected.email ??
			userIdentity.email ??
			(deal.lawyerId?.includes("@") ? deal.lawyerId : null);
		const profile = await profileExistsForRepairCandidate(ctx, {
			authId,
			email,
		});
		if (profile) {
			continue;
		}
		const candidate = upsertRepairCandidate(candidates, {
			authId,
			barNumber: selected.barNumber,
			displayName: selected.displayName ?? userIdentity.displayName,
			email,
			firmName: selected.firmName,
			jurisdiction: selected.jurisdiction,
			latestActivityAt: deal.createdAt,
			sourceKind: "deal",
		});
		candidate?.dealIds.add(deal._id);
	}
}

async function collectUnlinkedOnboardingSessionCandidates(
	ctx: Pick<QueryCtx, "db">,
	candidates: RepairCandidateMap
) {
	const sessions = await ctx.db
		.query("lawyerOnboardingSessions")
		.take(MAX_ROSTER_SCAN);
	for (const session of sessions) {
		if (session.lawyerProfileId !== undefined) {
			continue;
		}
		const deal = session.dealId ? await ctx.db.get(session.dealId) : null;
		const selected = selectedGuestLawyerIdentity(deal);
		const userIdentity = await userIdentityForAuthId(ctx, session.workosUserId);
		const candidate = upsertRepairCandidate(candidates, {
			authId: session.workosUserId ?? null,
			barNumber: selected.barNumber,
			displayName: selected.displayName ?? userIdentity.displayName,
			email:
				session.normalizedTargetEmail ?? selected.email ?? userIdentity.email,
			firmName: selected.firmName,
			jurisdiction: selected.jurisdiction,
			latestActivityAt: session.updatedAt,
			sourceKind: "onboarding_session",
		});
		candidate?.onboardingSessionIds.add(session._id);
		if (session.dealId) {
			candidate?.dealIds.add(session.dealId);
		}
	}
}

async function collectUnlinkedVerificationCandidates(
	ctx: Pick<QueryCtx, "db">,
	candidates: RepairCandidateMap
) {
	const verifications = await ctx.db
		.query("lawyerVerifications")
		.take(MAX_ROSTER_SCAN);
	for (const verification of verifications) {
		if (verification.lawyerProfileId !== undefined) {
			continue;
		}
		const deal = verification.dealId
			? await ctx.db.get(verification.dealId)
			: null;
		const selected = selectedGuestLawyerIdentity(deal);
		const userIdentity = await userIdentityForAuthId(ctx, verification.authId);
		const candidate = upsertRepairCandidate(candidates, {
			authId: verification.authId ?? null,
			barNumber: verification.barNumber ?? selected.barNumber,
			displayName: selected.displayName ?? userIdentity.displayName,
			email:
				verification.normalizedEmail ?? selected.email ?? userIdentity.email,
			firmName: selected.firmName,
			jurisdiction: verification.jurisdiction ?? selected.jurisdiction,
			latestActivityAt: verification.createdAt,
			sourceKind: "verification",
		});
		candidate?.verificationIds.add(verification._id);
		if (
			candidate &&
			(candidate.latestVerification === null ||
				verification.createdAt > candidate.latestVerification.createdAt)
		) {
			candidate.latestVerification = verification;
		}
		if (verification.dealId) {
			candidate?.dealIds.add(verification.dealId);
		}
	}
}

async function collectUnlinkedEngagementCandidates(
	ctx: Pick<QueryCtx, "db">,
	candidates: RepairCandidateMap
) {
	const engagements = await ctx.db
		.query("representationEngagements")
		.take(MAX_ROSTER_SCAN);
	for (const engagement of engagements) {
		if (engagement.lawyerProfileId !== undefined) {
			continue;
		}
		const deal = await ctx.db.get(engagement.dealId);
		const selected = selectedGuestLawyerIdentity(deal);
		const userIdentity = await userIdentityForAuthId(
			ctx,
			engagement.lawyerAuthId
		);
		const candidate = upsertRepairCandidate(candidates, {
			authId: engagement.lawyerAuthId,
			barNumber: selected.barNumber,
			displayName: userIdentity.displayName ?? selected.displayName,
			email: userIdentity.email ?? selected.email,
			firmName: selected.firmName,
			jurisdiction: selected.jurisdiction,
			latestActivityAt: engagement.updatedAt,
			sourceKind: "representation_engagement",
		});
		candidate?.engagementIds.add(engagement._id);
		candidate?.dealIds.add(engagement.dealId);
	}
}

async function collectLawyerProfileRepairCandidates(ctx: Pick<QueryCtx, "db">) {
	const candidates = new Map<string, LawyerProfileRepairCandidateDraft>();
	await collectUnprofiledGuestInvitationCandidates(ctx, candidates);
	await collectUnprofiledGuestDealCandidates(ctx, candidates);
	await collectUnlinkedOnboardingSessionCandidates(ctx, candidates);
	await collectUnlinkedVerificationCandidates(ctx, candidates);
	await collectUnlinkedEngagementCandidates(ctx, candidates);

	return [...candidates.values()]
		.filter(
			(candidate) =>
				candidate.dealIds.size > 0 ||
				candidate.invitationIds.size > 0 ||
				candidate.onboardingSessionIds.size > 0 ||
				candidate.verificationIds.size > 0 ||
				candidate.engagementIds.size > 0
		)
		.sort((left, right) => right.latestActivityAt - left.latestActivityAt);
}

function serializeRepairCandidate(
	candidate: LawyerProfileRepairCandidateDraft
) {
	const totalEvidenceRecords =
		candidate.dealIds.size +
		candidate.invitationIds.size +
		candidate.onboardingSessionIds.size +
		candidate.verificationIds.size +
		candidate.engagementIds.size;
	return {
		authId: candidate.authId,
		barNumber: candidate.barNumber,
		displayName: candidate.displayName ?? candidate.email ?? "Unknown lawyer",
		email: candidate.email,
		firmName: candidate.firmName,
		jurisdiction: candidate.jurisdiction,
		latestActivityAt: candidate.latestActivityAt,
		recordCounts: {
			deals: candidate.dealIds.size,
			engagements: candidate.engagementIds.size,
			invitations: candidate.invitationIds.size,
			onboardingSessions: candidate.onboardingSessionIds.size,
			verifications: candidate.verificationIds.size,
		},
		repairKey: candidate.repairKey,
		sourceKinds: [...candidate.sourceKinds].sort(),
		totalEvidenceRecords,
	};
}

function repairCandidateSuggestedProfile(
	candidate: LawyerProfileRepairCandidateDraft
) {
	return {
		authId: candidate.authId,
		barNumber: candidate.barNumber,
		displayName: candidate.displayName ?? candidate.email ?? "",
		email: candidate.email,
		firmName: candidate.firmName,
		jurisdiction: candidate.jurisdiction,
		lsoLawyerId: candidate.latestVerification?.lsoLawyerId ?? null,
	};
}

function repairEvidenceRecords(
	candidate: LawyerProfileRepairCandidateDraft
): RepairEvidenceRecord[] {
	return [
		...[...candidate.dealIds].map((recordId) => ({
			label: "Deal",
			recordId: String(recordId),
			summary: "Deal selected or references this lawyer identity.",
			table: "deals" as const,
		})),
		...[...candidate.invitationIds].map((recordId) => ({
			label: "Guest invitation",
			recordId: String(recordId),
			summary: "Invitation target and selected lawyer snapshot.",
			table: "lawyerInvitations" as const,
		})),
		...[...candidate.onboardingSessionIds].map((recordId) => ({
			label: "Onboarding session",
			recordId: String(recordId),
			summary: "Onboarding session that is not linked to a lawyer profile.",
			table: "lawyerOnboardingSessions" as const,
		})),
		...[...candidate.verificationIds].map((recordId) => ({
			label: "Verification",
			recordId: String(recordId),
			summary: "License verification evidence.",
			table: "lawyerVerifications" as const,
		})),
		...[...candidate.engagementIds].map((recordId) => ({
			label: "Representation engagement",
			recordId: String(recordId),
			summary: "Signed or recorded representation evidence.",
			table: "representationEngagements" as const,
		})),
	];
}

function buildRepairRosterRow(
	candidate: LawyerProfileRepairCandidateDraft
): AdminLawyerRosterRow {
	const totalEvidenceRecords =
		candidate.dealIds.size +
		candidate.invitationIds.size +
		candidate.onboardingSessionIds.size +
		candidate.verificationIds.size +
		candidate.engagementIds.size;
	const invitation = candidate.latestInvitation;
	const verification = candidate.latestVerification;
	return {
		activeDealCount: candidate.dealIds.size,
		activeInvitation: summarizeInvitation(
			invitation?.status === "pending" ? invitation : null
		),
		barNumber: candidate.barNumber,
		capacityLimit: null,
		capacityWarning: null,
		displayName: candidate.displayName ?? candidate.email ?? "Unknown lawyer",
		email: candidate.email ?? "Missing email",
		firmName: candidate.firmName,
		identityRepair: {
			repairKey: candidate.repairKey,
			totalEvidenceRecords,
		},
		identityStatus: "missing_profile",
		invitationStatus: invitation?.status ?? "none",
		jurisdiction: candidate.jurisdiction,
		latestActivityAt: candidate.latestActivityAt,
		latestVerification: summarizeVerification(verification),
		nextAction: "Repair lawyer identity",
		pastDealCount: 0,
		pendingDealInviteCount: invitation?.status === "pending" ? 1 : 0,
		platformInvitation: null,
		platformOnboardingSession: null,
		platformStatus: "not_platform",
		profileId: null,
		profileKind: "guest",
		restrictionRecheckStatus: "none",
		rowKey: `repair:${candidate.repairKey}`,
		slaStatus: "none",
		urgency: "pending_onboarding",
		verificationStatus: verification?.outcome ?? "not_verified",
	};
}

function guestProfileArgsForRepairCandidate(
	candidate: LawyerProfileRepairCandidateDraft,
	overrides?: {
		readonly authId?: string;
		readonly barNumber?: string;
		readonly displayName?: string;
		readonly email?: string;
		readonly firmName?: string;
		readonly jurisdiction?: string;
	}
): UpsertGuestLawyerProfileArgs {
	const email = optionalText(overrides?.email) ?? candidate.email;
	if (!email) {
		throw new ConvexError("Lawyer profile repair requires an email");
	}
	return {
		authId: optionalText(overrides?.authId) ?? candidate.authId ?? undefined,
		barNumber:
			optionalText(overrides?.barNumber) ?? candidate.barNumber ?? undefined,
		displayName:
			optionalText(overrides?.displayName) ?? candidate.displayName ?? email,
		email,
		firmName:
			optionalText(overrides?.firmName) ?? candidate.firmName ?? undefined,
		jurisdiction:
			optionalText(overrides?.jurisdiction) ??
			candidate.jurisdiction ??
			undefined,
	};
}

async function recordManualLsoRepairEvidence(
	ctx: Pick<MutationCtx, "db">,
	args: {
		readonly actorId: string;
		readonly authId?: string;
		readonly barNumber?: string;
		readonly email: string;
		readonly jurisdiction?: string;
		readonly lsoLawyerId: Id<"lsoLawyers">;
		readonly profileId: Id<"lawyerProfiles">;
	}
) {
	const now = Date.now();
	const verificationId = await recordLawyerVerificationRow(ctx, {
		authId: args.authId,
		barNumber: args.barNumber,
		checkType: "manual_admin",
		createdAt: now,
		createdBy: args.actorId,
		jurisdiction: args.jurisdiction,
		lawyerProfileId: args.profileId,
		lsoLawyerId: args.lsoLawyerId,
		normalizedEmail: normalizeLawyerEmail(args.email),
		providerResult: buildManualLawyerVerificationResult({
			evidenceHash: `lawyer-identity-repair:${String(args.profileId)}:${String(args.lsoLawyerId)}:${now}`,
			expiresAt: now + 365 * 24 * 60 * 60 * 1000,
			outcome: "eligible",
			reasonCodes: ["active_license"],
			sourceSnapshot: {
				action: "lawyer_identity_repair",
				actorId: args.actorId,
				lsoLawyerId: String(args.lsoLawyerId),
				profileId: String(args.profileId),
			},
		}),
	});
	await ctx.db.patch(args.profileId, {
		latestVerificationId: verificationId,
		updatedAt: now,
	});
}

async function linkRepairOnboardingSessions(
	ctx: Pick<MutationCtx, "db">,
	candidate: LawyerProfileRepairCandidateDraft,
	profileId: Id<"lawyerProfiles">
) {
	let linkedCount = 0;
	for (const sessionId of candidate.onboardingSessionIds) {
		const session = await ctx.db.get(sessionId);
		if (session && session.lawyerProfileId !== profileId) {
			await ctx.db.patch(session._id, {
				lawyerProfileId: profileId,
				updatedAt: Date.now(),
			});
			linkedCount += 1;
		}
	}
	return linkedCount;
}

async function linkRepairVerifications(
	ctx: Pick<MutationCtx, "db">,
	candidate: LawyerProfileRepairCandidateDraft,
	profileId: Id<"lawyerProfiles">
) {
	let linkedCount = 0;
	let latestVerification: Doc<"lawyerVerifications"> | null = null;
	for (const verificationId of candidate.verificationIds) {
		const verification = await ctx.db.get(verificationId);
		if (!verification) {
			continue;
		}
		if (verification.lawyerProfileId !== profileId) {
			await ctx.db.patch(verification._id, { lawyerProfileId: profileId });
			linkedCount += 1;
		}
		if (
			verification.outcome === "eligible" &&
			(!latestVerification ||
				verification.createdAt > latestVerification.createdAt)
		) {
			latestVerification = verification;
		}
	}
	if (latestVerification) {
		await ctx.db.patch(profileId, {
			latestVerificationId: latestVerification._id,
			updatedAt: Date.now(),
		});
	}
	return linkedCount;
}

async function linkRepairEngagements(
	ctx: Pick<MutationCtx, "db">,
	candidate: LawyerProfileRepairCandidateDraft,
	profileId: Id<"lawyerProfiles">
) {
	let linkedCount = 0;
	for (const engagementId of candidate.engagementIds) {
		const engagement = await ctx.db.get(engagementId);
		if (engagement && engagement.lawyerProfileId !== profileId) {
			await ctx.db.patch(engagement._id, { lawyerProfileId: profileId });
			linkedCount += 1;
		}
	}
	return linkedCount;
}

export const listLawyerProfileRepairQueue = adminQuery
	.input({})
	.handler(async (ctx) => {
		const candidates = await collectLawyerProfileRepairCandidates(ctx);
		const rows = candidates.map(serializeRepairCandidate);
		return {
			candidates: rows,
			summary: {
				orphanedCandidates: rows.length,
				totalEvidenceRecords: rows.reduce(
					(total, row) => total + row.totalEvidenceRecords,
					0
				),
			},
		};
	})
	.public();

export const getLawyerProfileRepairPreview = adminQuery
	.input({ repairKey: v.string() })
	.handler(async (ctx, args) => {
		const candidates = await collectLawyerProfileRepairCandidates(ctx);
		const candidate = candidates.find(
			(row) => row.repairKey === args.repairKey
		);
		if (!candidate) {
			throw new ConvexError("Lawyer profile repair candidate not found");
		}
		const suggestedProfile = repairCandidateSuggestedProfile(candidate);
		return {
			canAutoRepair: Boolean(suggestedProfile.email),
			candidate: serializeRepairCandidate(candidate),
			evidenceRecords: repairEvidenceRecords(candidate),
			suggestedProfile,
			warnings: [
				...(suggestedProfile.email ? [] : ["Email is required before repair."]),
				...(suggestedProfile.displayName
					? []
					: ["Display name is missing and should be supplied manually."]),
				...(suggestedProfile.lsoLawyerId
					? []
					: ["No linked LSO profile was found in the evidence set."]),
			],
		};
	})
	.public();

export const repairLawyerProfileLsoLink = adminMutation
	.input({
		lsoLawyerId: v.id("lsoLawyers"),
		profileId: v.id("lawyerProfiles"),
	})
	.handler(async (ctx, args) => {
		const profile = await ctx.db.get(args.profileId);
		if (!profile) {
			throw new ConvexError("Lawyer profile not found");
		}
		const lsoLawyer = await ctx.db.get(args.lsoLawyerId);
		if (!lsoLawyer) {
			throw new ConvexError("LSO lawyer not found");
		}
		await recordManualLsoRepairEvidence(ctx, {
			actorId: ctx.viewer.authId,
			authId: profile.authId,
			barNumber: profile.barNumber,
			email: profile.email,
			jurisdiction: profile.jurisdiction,
			lsoLawyerId: args.lsoLawyerId,
			profileId: profile._id,
		});
		return {
			lsoLawyerId: args.lsoLawyerId,
			profileId: profile._id,
		};
	})
	.public();

export const updateLawyerProfileAdmin = adminMutation
	.input({
		barNumber: v.optional(v.string()),
		displayName: v.string(),
		email: v.string(),
		firmName: v.optional(v.string()),
		jurisdiction: v.optional(v.string()),
		profileId: v.id("lawyerProfiles"),
	})
	.handler(async (ctx, args) => {
		const profile = await ctx.db.get(args.profileId);
		if (!profile) {
			throw new ConvexError("Lawyer profile not found");
		}
		const displayName = optionalText(args.displayName);
		const email = optionalText(args.email);
		if (!displayName) {
			throw new ConvexError("Lawyer display name is required");
		}
		if (!email) {
			throw new ConvexError("Lawyer email is required");
		}
		await ctx.db.patch(profile._id, {
			barNumber:
				args.barNumber === undefined
					? undefined
					: normalizeBarNumber(args.barNumber),
			displayName,
			email,
			firmName: optionalText(args.firmName),
			jurisdiction:
				args.jurisdiction === undefined
					? undefined
					: normalizeJurisdiction(args.jurisdiction),
			normalizedEmail: normalizeLawyerEmail(email),
			updatedAt: Date.now(),
		});
		return { profileId: profile._id };
	})
	.public();

export const repairLawyerProfileIdentity = adminMutation
	.input({
		overrides: lawyerIdentityRepairOverridesValidator,
		repairKey: v.string(),
	})
	.handler(async (ctx, args) => {
		const candidates = await collectLawyerProfileRepairCandidates(ctx);
		const candidate = candidates.find(
			(row) => row.repairKey === args.repairKey
		);
		if (!candidate) {
			throw new ConvexError("Lawyer profile repair candidate not found");
		}
		const profileArgs = guestProfileArgsForRepairCandidate(
			candidate,
			args.overrides
		);
		const existingProfile = await profileExistsForRepairCandidate(ctx, {
			authId: profileArgs.authId,
			email: profileArgs.email,
		});
		const profileId = await upsertGuestLawyerProfile(ctx, profileArgs);
		const onboardingSessions = await linkRepairOnboardingSessions(
			ctx,
			candidate,
			profileId
		);
		const verifications = await linkRepairVerifications(
			ctx,
			candidate,
			profileId
		);
		const engagements = await linkRepairEngagements(ctx, candidate, profileId);
		if (args.overrides?.lsoLawyerId) {
			await recordManualLsoRepairEvidence(ctx, {
				actorId: ctx.viewer.authId,
				authId: profileArgs.authId,
				barNumber: profileArgs.barNumber,
				email: profileArgs.email,
				jurisdiction: profileArgs.jurisdiction,
				lsoLawyerId: args.overrides.lsoLawyerId,
				profileId,
			});
		}
		return {
			action: existingProfile ? "linked_existing_profile" : "created_profile",
			linkedCounts: {
				engagements,
				onboardingSessions,
				verifications,
			},
			profileId,
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
	const rows = await ctx.db.query("users").collect();
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
			v.literal("sending"),
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

export const reservePlatformInvitationDeliveryInternal = convex
	.mutation()
	.input({
		invitationId: v.id("platformLawyerInvitations"),
		now: v.number(),
	})
	.handler(async (ctx, args) => {
		const invitation = await ctx.db.get(args.invitationId);
		if (
			!invitation ||
			invitation.status !== "pending" ||
			invitation.deliveryStatus !== "pending"
		) {
			return null;
		}
		await ctx.db.patch(invitation._id, {
			deliveryError: undefined,
			deliveryStatus: "sending",
			lastDeliveryAttemptAt: args.now,
			updatedAt: args.now,
		});
		return {
			...invitation,
			deliveryError: undefined,
			deliveryStatus: "sending" as const,
			lastDeliveryAttemptAt: args.now,
			updatedAt: args.now,
		};
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
			const reserved: Doc<"platformLawyerInvitations"> | null =
				await ctx.runMutation(
					internal.legalRepresentation.adminLawyers
						.reservePlatformInvitationDeliveryInternal,
					{ invitationId: args.invitationId, now: Date.now() }
				);
			if (!reserved) {
				return { status: "skipped" as const };
			}
			return await deliverPlatformInvite(ctx, reserved);
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
		if (
			args.authId &&
			resolution !== "create_pending" &&
			args.authId !== syncedUser?.authId &&
			args.authId !== existingProfile?.authId
		) {
			throw new ConvexError("Provided authId does not match WorkOS identity");
		}
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
