import type { Doc, Id } from "../_generated/dataModel";
import type { SelectedLawyerSnapshot } from "../checkout/validators";
import {
	normalizeBarNumber,
	normalizeJurisdiction,
	normalizeLawyerEmail,
	normalizeLawyerName,
	normalizeLegalSourceSnapshot,
} from "./normalization";

export type LsoLawyerFixture = Omit<Doc<"lsoLawyers">, "_creationTime" | "_id">;
export type LawyerProfileFixture = Omit<
	Doc<"lawyerProfiles">,
	"_creationTime" | "_id"
>;
export type LawyerInvitationFixture = Omit<
	Doc<"lawyerInvitations">,
	"_creationTime" | "_id"
>;
export type RepresentationEngagementFixture = Omit<
	Doc<"representationEngagements">,
	"_creationTime" | "_id"
>;

export interface LegalRepresentationFixtureOptions {
	readonly actorId?: string;
	readonly dealId?: Id<"deals">;
	readonly lawyerAuthId?: string;
	readonly lawyerProfileId?: Id<"lawyerProfiles">;
	readonly lsoLawyerId?: Id<"lsoLawyers">;
	readonly now?: number;
}

const DEFAULT_NOW = 1_770_000_000_000;
const DEFAULT_ACTOR = "system:test-fixture";
const DEFAULT_DEAL_ID = "deal_test" as Id<"deals">;
const DEFAULT_PROFILE_ID = "lawyerProfile_test" as Id<"lawyerProfiles">;
const DEFAULT_LSO_ID = "lsoLawyer_test" as Id<"lsoLawyers">;

function fixtureNow(options?: LegalRepresentationFixtureOptions) {
	return options?.now ?? DEFAULT_NOW;
}

function fixtureActor(options?: LegalRepresentationFixtureOptions) {
	return options?.actorId ?? DEFAULT_ACTOR;
}

export function buildEligiblePlatformLsoLawyerFixture(
	options?: LegalRepresentationFixtureOptions
): LsoLawyerFixture {
	const now = fixtureNow(options);
	return {
		normalizedName: normalizeLawyerName("Avery Chen"),
		displayName: "Avery Chen",
		barNumber: normalizeBarNumber("LSO-123456"),
		jurisdiction: normalizeJurisdiction("ON"),
		licenseeType: "lawyer",
		entitledToPractise: true,
		licensingStatus: "licensed",
		restrictionStatus: "clear",
		primaryEmail: "avery.chen@example.test",
		firmName: "FairLend Panel Law",
		source: "manual_admin",
		sourceSnapshot: normalizeLegalSourceSnapshot({
			status: "licensed",
			restrictions: "none",
		}),
		sourceFetchedAt: now,
		updatedAt: now,
	};
}

export function buildRestrictedLsoLawyerFixture(
	options?: LegalRepresentationFixtureOptions
): LsoLawyerFixture {
	const now = fixtureNow(options);
	return {
		normalizedName: normalizeLawyerName("Jordan Restricted"),
		displayName: "Jordan Restricted",
		barNumber: normalizeBarNumber("LSO-999999"),
		jurisdiction: normalizeJurisdiction("ON"),
		licenseeType: "lawyer",
		entitledToPractise: true,
		licensingStatus: "licensed",
		restrictionStatus: "restricted",
		restrictionSummary: "Real-estate trust handling restricted",
		primaryEmail: "restricted@example.test",
		firmName: "Restricted LLP",
		source: "manual_admin",
		sourceSnapshot: normalizeLegalSourceSnapshot({
			status: "licensed",
			restrictions: "real-estate trust handling restricted",
		}),
		sourceFetchedAt: now,
		updatedAt: now,
	};
}

export function buildEligiblePlatformLawyerProfileFixture(
	options?: LegalRepresentationFixtureOptions
): LawyerProfileFixture {
	const now = fixtureNow(options);
	const email = "avery.chen@example.test";
	return {
		authId: options?.lawyerAuthId ?? "user_lawyer_platform",
		email,
		normalizedEmail: normalizeLawyerEmail(email),
		displayName: "Avery Chen",
		firmName: "FairLend Panel Law",
		barNumber: normalizeBarNumber("LSO-123456"),
		jurisdiction: normalizeJurisdiction("ON"),
		profileKind: "platform",
		platformStatus: "active",
		createdAt: now,
		updatedAt: now,
	};
}

export function buildReturningGuestLawyerProfileFixture(
	options?: LegalRepresentationFixtureOptions
): LawyerProfileFixture {
	const now = fixtureNow(options);
	const email = "returning.guest@example.test";
	return {
		authId: options?.lawyerAuthId ?? "user_returning_guest_lawyer",
		email,
		normalizedEmail: normalizeLawyerEmail(email),
		displayName: "Riley Guest",
		firmName: "Guest Legal",
		barNumber: normalizeBarNumber("LSO-654321"),
		jurisdiction: normalizeJurisdiction("ON"),
		profileKind: "guest",
		createdAt: now,
		updatedAt: now,
	};
}

export function buildGuestSelectedLawyerSnapshotFixture(
	options?: LegalRepresentationFixtureOptions
): SelectedLawyerSnapshot {
	return {
		type: "guest_lawyer",
		source: "lso_search",
		name: "Riley Guest",
		email: "returning.guest@example.test",
		firm: "Guest Legal",
		lso: {
			barNumber: normalizeBarNumber("LSO-654321"),
			jurisdiction: normalizeJurisdiction("ON"),
			licensingStatus: "licensed",
			restrictionStatus: "clear",
			lsoLawyerId: options?.lsoLawyerId ?? DEFAULT_LSO_ID,
			source: "test_fixture",
			sourceFetchedAt: fixtureNow(options),
		},
	};
}

export function buildNewGuestLawyerInvitationFixture(
	options?: LegalRepresentationFixtureOptions
): LawyerInvitationFixture {
	const now = fixtureNow(options);
	const targetEmail = "new.guest@example.test";
	return {
		dealId: options?.dealId ?? DEFAULT_DEAL_ID,
		selectedLawyerSnapshot: {
			type: "guest_lawyer",
			source: "manual",
			name: "New Guest",
			email: targetEmail,
			firm: "New Guest Law",
		},
		lsoLawyerId: options?.lsoLawyerId,
		targetEmail,
		normalizedTargetEmail: normalizeLawyerEmail(targetEmail),
		tokenHash: "fixture-token-hash",
		status: "pending",
		expiresAt: now + 1000 * 60 * 60 * 24 * 7,
		createdBy: fixtureActor(options),
		createdAt: now,
		updatedAt: now,
	};
}

export function buildExpiredInvitationFixture(
	options?: LegalRepresentationFixtureOptions
): LawyerInvitationFixture {
	const now = fixtureNow(options);
	return {
		...buildNewGuestLawyerInvitationFixture(options),
		status: "expired",
		expiresAt: now - 1,
		updatedAt: now,
	};
}

export function buildSignedEngagementEvidenceFixture(
	options?: LegalRepresentationFixtureOptions
): RepresentationEngagementFixture {
	const now = fixtureNow(options);
	return {
		dealId: options?.dealId ?? DEFAULT_DEAL_ID,
		lawyerAuthId: options?.lawyerAuthId ?? "user_lawyer_platform",
		lawyerProfileId: options?.lawyerProfileId ?? DEFAULT_PROFILE_ID,
		status: "signed",
		provider: "manual_admin",
		documentPackageId: "fixture-document-package",
		providerEnvelopeId: "fixture-envelope",
		signedAt: now,
		evidenceHash: "sha256:fixture-engagement",
		createdAt: now,
		updatedAt: now,
	};
}
