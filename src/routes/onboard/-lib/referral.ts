import { sanitizeRedirectPath } from "#/lib/auth-redirect";
import type { Id } from "../../../../convex/_generated/dataModel";

export type OnboardingReferralSource = "broker_invite" | "self_signup";

export interface OnboardingReferralSearch {
	invitedByBrokerId?: string;
	ref?: string;
	referralSource?: OnboardingReferralSource;
}

const SAFE_TOKEN_PATTERN = /^[a-zA-Z0-9_-]{1,160}$/;

function cleanToken(input: unknown): string | undefined {
	if (typeof input !== "string") {
		return undefined;
	}
	const trimmed = input.trim();
	return SAFE_TOKEN_PATTERN.test(trimmed) ? trimmed : undefined;
}

export function parseOnboardingSearch(
	search: Record<string, unknown>
): OnboardingReferralSearch {
	const invitedByBrokerId = cleanToken(
		search.invitedByBrokerId ?? search.invited_by_broker_id
	);
	const ref = cleanToken(search.ref ?? search.referral ?? search.referralToken);
	const requestedReferralSource =
		search.referralSource === "broker_invite" ||
		search.source === "broker_invite"
			? "broker_invite"
			: undefined;
	const referralSource =
		invitedByBrokerId && requestedReferralSource === "broker_invite"
			? "broker_invite"
			: "self_signup";

	return {
		invitedByBrokerId,
		ref,
		referralSource,
	};
}

export function cleanOnboardingSearch(
	search: OnboardingReferralSearch
): OnboardingReferralSearch {
	const next: OnboardingReferralSearch = {};
	if (search.invitedByBrokerId) {
		next.invitedByBrokerId = search.invitedByBrokerId;
	}
	if (search.ref) {
		next.ref = search.ref;
	}
	if (search.referralSource === "broker_invite") {
		next.referralSource = "broker_invite";
	}
	return next;
}

export function buildOnboardingRedirect(search: OnboardingReferralSearch) {
	const query = new URLSearchParams();
	const clean = cleanOnboardingSearch(search);
	if (clean.invitedByBrokerId) {
		query.set("invitedByBrokerId", clean.invitedByBrokerId);
	}
	if (clean.ref) {
		query.set("ref", clean.ref);
	}
	if (clean.referralSource) {
		query.set("referralSource", clean.referralSource);
	}
	const suffix = query.toString();
	return sanitizeRedirectPath(suffix ? `/onboard?${suffix}` : "/onboard");
}

export function buildReferralMutationArgs(
	search: OnboardingReferralSearch,
	portalId?: Id<"portals">
) {
	return {
		invitedByBrokerId: search.invitedByBrokerId,
		portalId,
		referralSource: search.referralSource ?? "self_signup",
		referralToken: search.ref,
	};
}
