import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
	normalizeBarNumber,
	normalizeJurisdiction,
	normalizeLawyerEmail,
	normalizeLegalWhitespace,
} from "./normalization";
import { buildManualLawyerVerificationResult } from "./providers";
import type {
	LawyerVerificationOutcome,
	LawyerVerificationReasonCode,
	LegalRepresentationPlatformStatus,
} from "./validators";
import {
	decideLegalCheckpoint,
	getLatestLawyerVerificationForProfile,
	isEligibleCurrentLawyerVerification,
	recordLawyerVerificationRow,
} from "./verifications";

type LegalRepresentationMutationCtx = Pick<MutationCtx, "db">;
type LegalRepresentationQueryCtx = Pick<QueryCtx, "db">;

const PLATFORM_CHECK_TYPES = [
	"platform_periodic",
	"fresh_restriction",
	"manual_admin",
	"initial_lso",
] as const;

const PLATFORM_EVIDENCE_TTL_MS = 1000 * 60 * 60 * 24 * 90;
const CANONICAL_LAWYER_WORKOS_ROLE_SLUG = "lawyer";

export type PlatformLawyerEligibilityStatus =
	| "eligible"
	| "blocked"
	| "requires_review";

export interface PlatformLawyerOption {
	readonly barNumber?: string;
	readonly eligibilityStatus: PlatformLawyerEligibilityStatus;
	readonly email: string;
	readonly firm?: string;
	readonly jurisdiction?: string;
	readonly latestVerificationId?: Id<"lawyerVerifications">;
	readonly lawyerId: string;
	readonly lawyerProfileId: Id<"lawyerProfiles">;
	readonly name: string;
	readonly platformStatus: LegalRepresentationPlatformStatus;
	readonly type: "platform_lawyer";
}

export interface PlatformLawyerProfileInput {
	readonly authId?: string;
	readonly barNumber?: string;
	readonly displayName: string;
	readonly email: string;
	readonly firmName?: string;
	readonly jurisdiction?: string;
}

export interface UpsertPlatformLawyerProfileArgs
	extends PlatformLawyerProfileInput {
	readonly actorId: string;
	readonly createdAt?: number;
	readonly platformStatus?: LegalRepresentationPlatformStatus;
}

export interface UpsertGuestLawyerProfileArgs {
	readonly authId?: string;
	readonly barNumber?: string;
	readonly createdAt?: number;
	readonly displayName: string;
	readonly email: string;
	readonly firmName?: string;
	readonly jurisdiction?: string;
}

export interface StatusEvidenceArgs {
	readonly actorId: string;
	readonly note?: string;
	readonly now?: number;
	readonly outcome: LawyerVerificationOutcome;
	readonly profile: Doc<"lawyerProfiles">;
	readonly reasonCodes: readonly LawyerVerificationReasonCode[];
	readonly status: LegalRepresentationPlatformStatus;
}

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
	return normalized.length === 0 ? undefined : normalized;
}

function normalizeAuthId(authId: string | undefined): string | undefined {
	return optionalText(authId);
}

function normalizeProfileInput(input: PlatformLawyerProfileInput) {
	const email = requiredText(input.email, "email");
	return {
		authId: normalizeAuthId(input.authId),
		email,
		normalizedEmail: normalizeLawyerEmail(email),
		displayName: requiredText(input.displayName, "displayName"),
		firmName: optionalText(input.firmName),
		barNumber:
			input.barNumber === undefined
				? undefined
				: normalizeBarNumber(input.barNumber),
		jurisdiction:
			input.jurisdiction === undefined
				? undefined
				: normalizeJurisdiction(input.jurisdiction),
	};
}

function profileHasPlatformKind(
	profileKind: Doc<"lawyerProfiles">["profileKind"]
) {
	return profileKind === "platform" || profileKind === "both";
}

function mergeProfileKindForPlatform(
	profileKind: Doc<"lawyerProfiles">["profileKind"]
): Doc<"lawyerProfiles">["profileKind"] {
	return profileKind === "guest" ? "both" : "platform";
}

function mergeProfileKindForGuest(
	profileKind: Doc<"lawyerProfiles">["profileKind"]
): Doc<"lawyerProfiles">["profileKind"] {
	return profileKind === "platform" ? "both" : profileKind;
}

async function getProfileByAuthId(
	ctx: LegalRepresentationQueryCtx,
	authId: string | undefined
): Promise<Doc<"lawyerProfiles"> | null> {
	if (!authId) {
		return null;
	}
	return await ctx.db
		.query("lawyerProfiles")
		.withIndex("by_auth_id", (query) => query.eq("authId", authId))
		.unique();
}

function hasLawyerRole(
	membership: Pick<
		Doc<"organizationMemberships">,
		"roleSlug" | "roleSlugs" | "status"
	>
): boolean {
	const roleSlugs = new Set([
		membership.roleSlug,
		...(membership.roleSlugs ?? []),
	]);
	return (
		membership.status === "active" &&
		roleSlugs.has(CANONICAL_LAWYER_WORKOS_ROLE_SLUG)
	);
}

async function assertCanonicalWorkosLawyerIdentity(
	ctx: LegalRepresentationQueryCtx,
	args: {
		readonly authId: string | undefined;
		readonly normalizedEmail?: string;
	}
) {
	if (!args.authId) {
		throw new ConvexError(
			"Platform lawyer profile requires WorkOS lawyer authId before activation"
		);
	}
	const authId = args.authId;
	const user = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", authId))
		.unique();
	if (!user) {
		throw new ConvexError(
			"Platform lawyer authId must resolve to a synced WorkOS user"
		);
	}
	if (
		args.normalizedEmail &&
		normalizeLawyerEmail(user.email) !== args.normalizedEmail
	) {
		throw new ConvexError(
			"Platform lawyer authId must resolve to the profile email"
		);
	}
	const memberships = await ctx.db
		.query("organizationMemberships")
		.withIndex("byUser", (query) => query.eq("userWorkosId", authId))
		.collect();
	if (!memberships.some(hasLawyerRole)) {
		throw new ConvexError(
			"Platform lawyer authId must have an active WorkOS lawyer role"
		);
	}
}

async function isCanonicalWorkosLawyerIdentity(
	ctx: LegalRepresentationQueryCtx,
	args: {
		readonly authId: string | undefined;
		readonly normalizedEmail?: string;
	}
): Promise<boolean> {
	try {
		await assertCanonicalWorkosLawyerIdentity(ctx, args);
		return true;
	} catch {
		return false;
	}
}

async function getProfileByNormalizedEmail(
	ctx: LegalRepresentationQueryCtx,
	normalizedEmail: string
): Promise<Doc<"lawyerProfiles"> | null> {
	return await ctx.db
		.query("lawyerProfiles")
		.withIndex("by_normalized_email", (query) =>
			query.eq("normalizedEmail", normalizedEmail)
		)
		.unique();
}

export async function getLatestPlatformLawyerVerification(
	ctx: LegalRepresentationQueryCtx,
	profile: Pick<Doc<"lawyerProfiles">, "_id" | "latestVerificationId">
): Promise<Doc<"lawyerVerifications"> | null> {
	if (profile.latestVerificationId) {
		const latest = await ctx.db.get(profile.latestVerificationId);
		if (latest) {
			return latest;
		}
	}
	const candidates = await Promise.all(
		PLATFORM_CHECK_TYPES.map((checkType) =>
			getLatestLawyerVerificationForProfile(ctx, {
				checkType,
				lawyerProfileId: profile._id,
			})
		)
	);
	return (
		candidates
			.filter((candidate): candidate is Doc<"lawyerVerifications"> =>
				Boolean(candidate)
			)
			.sort((left, right) => right.createdAt - left.createdAt)[0] ?? null
	);
}

export function projectPlatformLawyerEligibility(args: {
	readonly now: number;
	readonly profile: Doc<"lawyerProfiles">;
	readonly verification: Doc<"lawyerVerifications"> | null;
}): PlatformLawyerEligibilityStatus {
	if (!args.profile.authId) {
		return "blocked";
	}
	if (!profileHasPlatformKind(args.profile.profileKind)) {
		return "blocked";
	}
	if (args.profile.platformStatus !== "active") {
		return args.profile.platformStatus === "invited"
			? "requires_review"
			: "blocked";
	}
	const decision = decideLegalCheckpoint({
		checkpoint: "selection",
		now: args.now,
		profile: args.profile,
		verification: args.verification,
	}).decision;
	if (decision === "allow") {
		return "eligible";
	}
	return decision === "requires_review" ? "requires_review" : "blocked";
}

export async function toPlatformLawyerOption(
	ctx: LegalRepresentationQueryCtx,
	profile: Doc<"lawyerProfiles">,
	now: number
): Promise<PlatformLawyerOption | null> {
	if (
		!(await isCanonicalWorkosLawyerIdentity(ctx, {
			authId: profile.authId,
			normalizedEmail: profile.normalizedEmail,
		}))
	) {
		return null;
	}
	const verification = await getLatestPlatformLawyerVerification(ctx, profile);
	const eligibilityStatus = projectPlatformLawyerEligibility({
		now,
		profile,
		verification,
	});
	if (!(profile.authId && profile.platformStatus)) {
		return null;
	}
	return {
		type: "platform_lawyer",
		lawyerProfileId: profile._id,
		lawyerId: profile.authId,
		name: profile.displayName,
		email: profile.email,
		firm: profile.firmName,
		jurisdiction: profile.jurisdiction,
		barNumber: profile.barNumber,
		eligibilityStatus,
		platformStatus: profile.platformStatus,
		latestVerificationId: verification?._id,
	};
}

export async function listPlatformLawyerProfiles(
	ctx: LegalRepresentationQueryCtx
): Promise<Doc<"lawyerProfiles">[]> {
	const profiles = await ctx.db.query("lawyerProfiles").collect();
	return profiles
		.filter((profile) => profileHasPlatformKind(profile.profileKind))
		.sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export async function listPlatformLawyerOptions(
	ctx: LegalRepresentationQueryCtx,
	args?: { readonly includeIneligible?: boolean; readonly now?: number }
): Promise<PlatformLawyerOption[]> {
	const now = args?.now ?? Date.now();
	const activeProfiles = await ctx.db
		.query("lawyerProfiles")
		.withIndex("by_platform_status", (query) =>
			query.eq("platformStatus", "active")
		)
		.collect();
	const options = await Promise.all(
		activeProfiles
			.filter((profile) => profileHasPlatformKind(profile.profileKind))
			.map((profile) => toPlatformLawyerOption(ctx, profile, now))
	);
	return options
		.filter((option): option is PlatformLawyerOption => Boolean(option))
		.filter(
			(option) =>
				args?.includeIneligible || option.eligibilityStatus === "eligible"
		)
		.sort((left, right) => left.name.localeCompare(right.name));
}

export async function upsertPlatformLawyerProfile(
	ctx: LegalRepresentationMutationCtx,
	args: UpsertPlatformLawyerProfileArgs
): Promise<Id<"lawyerProfiles">> {
	const now = args.createdAt ?? Date.now();
	const normalized = normalizeProfileInput(args);
	const nextPlatformStatus = args.platformStatus ?? "invited";
	if (nextPlatformStatus === "active") {
		await assertCanonicalWorkosLawyerIdentity(ctx, {
			authId: normalized.authId,
			normalizedEmail: normalized.normalizedEmail,
		});
	}
	const existingByAuth = await getProfileByAuthId(ctx, normalized.authId);
	const existingByEmail = await getProfileByNormalizedEmail(
		ctx,
		normalized.normalizedEmail
	);
	const existing = existingByAuth ?? existingByEmail;
	if (
		existingByAuth &&
		existingByEmail &&
		existingByAuth._id !== existingByEmail._id
	) {
		throw new ConvexError(
			"Platform lawyer authId and email resolve to different profiles"
		);
	}
	if (!existing) {
		const profileId = await ctx.db.insert("lawyerProfiles", {
			...normalized,
			profileKind: "platform",
			platformStatus: nextPlatformStatus,
			createdAt: now,
			updatedAt: now,
		});
		const profile = await ctx.db.get(profileId);
		if (!profile) {
			throw new ConvexError("Platform lawyer profile insert failed");
		}
		await recordPlatformStatusEvidence(ctx, {
			actorId: args.actorId,
			now,
			outcome:
				profile.platformStatus === "active" ? "eligible" : "requires_review",
			profile,
			reasonCodes:
				profile.platformStatus === "active"
					? ["manual_override"]
					: ["requires_admin_review"],
			status: profile.platformStatus ?? "invited",
		});
		return profileId;
	}
	const existingNextPlatformStatus =
		args.platformStatus ?? existing.platformStatus ?? "invited";
	if (existingNextPlatformStatus === "active") {
		await assertCanonicalWorkosLawyerIdentity(ctx, {
			authId: normalized.authId,
			normalizedEmail: normalized.normalizedEmail,
		});
	}
	await ctx.db.patch(existing._id, {
		...normalized,
		profileKind: mergeProfileKindForPlatform(existing.profileKind),
		platformStatus: existingNextPlatformStatus,
		updatedAt: now,
	});
	return existing._id;
}

export async function upsertGuestLawyerProfile(
	ctx: LegalRepresentationMutationCtx,
	args: UpsertGuestLawyerProfileArgs
): Promise<Id<"lawyerProfiles">> {
	const now = args.createdAt ?? Date.now();
	const normalized = normalizeProfileInput(args);
	const existingByAuth = await getProfileByAuthId(ctx, normalized.authId);
	const existingByEmail = await getProfileByNormalizedEmail(
		ctx,
		normalized.normalizedEmail
	);
	const existing = existingByAuth ?? existingByEmail;
	if (
		existingByAuth &&
		existingByEmail &&
		existingByAuth._id !== existingByEmail._id
	) {
		throw new ConvexError(
			"Guest lawyer authId and email resolve to different profiles"
		);
	}
	if (!existing) {
		return await ctx.db.insert("lawyerProfiles", {
			...normalized,
			createdAt: now,
			profileKind: "guest",
			updatedAt: now,
		});
	}
	await ctx.db.patch(existing._id, {
		...normalized,
		profileKind: mergeProfileKindForGuest(existing.profileKind),
		updatedAt: now,
	});
	return existing._id;
}

export async function setPlatformLawyerStatus(
	ctx: LegalRepresentationMutationCtx,
	args: {
		readonly actorId: string;
		readonly now?: number;
		readonly profileId: Id<"lawyerProfiles">;
		readonly reasonCodes?: readonly LawyerVerificationReasonCode[];
		readonly status: LegalRepresentationPlatformStatus;
	}
): Promise<Id<"lawyerProfiles">> {
	const now = args.now ?? Date.now();
	const profile = await ctx.db.get(args.profileId);
	if (!(profile && profileHasPlatformKind(profile.profileKind))) {
		throw new ConvexError("Platform lawyer profile not found");
	}
	if (args.status === "active") {
		await assertCanonicalWorkosLawyerIdentity(ctx, {
			authId: profile.authId,
			normalizedEmail: profile.normalizedEmail,
		});
	}
	await ctx.db.patch(profile._id, {
		platformStatus: args.status,
		updatedAt: now,
	});
	const patched = await ctx.db.get(profile._id);
	if (!patched) {
		throw new ConvexError("Platform lawyer profile update failed");
	}
	await recordPlatformStatusEvidence(ctx, {
		actorId: args.actorId,
		now,
		outcome: outcomeForStatus(args.status, args.reasonCodes),
		profile: patched,
		reasonCodes: args.reasonCodes ?? reasonCodesForStatus(args.status),
		status: args.status,
	});
	return profile._id;
}

function outcomeForStatus(
	status: LegalRepresentationPlatformStatus,
	reasonCodes: readonly LawyerVerificationReasonCode[] | undefined
): LawyerVerificationOutcome {
	if (status === "active") {
		return reasonCodes?.includes("requires_admin_review")
			? "requires_review"
			: "eligible";
	}
	if (status === "invited") {
		return "requires_review";
	}
	return "ineligible";
}

function reasonCodesForStatus(
	status: LegalRepresentationPlatformStatus
): readonly LawyerVerificationReasonCode[] {
	if (status === "active") {
		return ["manual_override"];
	}
	if (status === "suspended") {
		return ["profile_suspended"];
	}
	if (status === "offboarded") {
		return ["profile_offboarded"];
	}
	return ["requires_admin_review"];
}

export async function recordPlatformStatusEvidence(
	ctx: LegalRepresentationMutationCtx,
	args: StatusEvidenceArgs
): Promise<Id<"lawyerVerifications">> {
	const now = args.now ?? Date.now();
	const verificationId = await recordLawyerVerificationRow(ctx, {
		authId: args.profile.authId,
		barNumber: args.profile.barNumber,
		checkType: "manual_admin",
		createdAt: now,
		createdBy: args.actorId,
		jurisdiction: args.profile.jurisdiction,
		lawyerProfileId: args.profile._id,
		normalizedEmail: args.profile.normalizedEmail,
		providerResult: buildManualLawyerVerificationResult({
			evidenceHash: `platform-lawyer-status:${String(args.profile._id)}:${args.status}:${now}`,
			expiresAt:
				args.outcome === "eligible"
					? now + PLATFORM_EVIDENCE_TTL_MS
					: undefined,
			outcome: args.outcome,
			reasonCodes: args.reasonCodes,
			sourceSnapshot: {
				action: "platform_lawyer_status_change",
				actorId: args.actorId,
				platformStatus: args.status,
				profileId: String(args.profile._id),
				...(args.note ? { note: args.note } : {}),
			},
		}),
	});
	await ctx.db.patch(args.profile._id, {
		latestVerificationId: verificationId,
		updatedAt: now,
	});
	return verificationId;
}

export async function assertProfileSelectableForCheckout(
	ctx: LegalRepresentationQueryCtx,
	args: { readonly now?: number; readonly profileId: Id<"lawyerProfiles"> }
): Promise<PlatformLawyerOption> {
	const profile = await ctx.db.get(args.profileId);
	if (!profile) {
		throw new ConvexError("Platform lawyer profile not found");
	}
	const option = await toPlatformLawyerOption(
		ctx,
		profile,
		args.now ?? Date.now()
	);
	if (!option || option.eligibilityStatus !== "eligible") {
		throw new ConvexError(
			"Platform lawyer is not eligible for new checkout selection"
		);
	}
	return option;
}

export async function assertPlatformLawyerAuthSelectableForCheckout(
	ctx: LegalRepresentationQueryCtx,
	args: { readonly authId: string | undefined; readonly now?: number }
): Promise<PlatformLawyerOption> {
	const profile = await getProfileByAuthId(ctx, args.authId);
	if (!profile) {
		throw new ConvexError("Platform lawyer profile not found");
	}
	return await assertProfileSelectableForCheckout(ctx, {
		now: args.now,
		profileId: profile._id,
	});
}

export function isProfileEligibleForCheckout(args: {
	readonly now: number;
	readonly profile: Doc<"lawyerProfiles">;
	readonly verification: Doc<"lawyerVerifications"> | null;
}): boolean {
	return (
		args.profile.platformStatus === "active" &&
		Boolean(args.profile.authId) &&
		args.verification !== null &&
		isEligibleCurrentLawyerVerification(args.verification, args.now)
	);
}
