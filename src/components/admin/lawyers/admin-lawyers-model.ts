import type { Id } from "../../../../convex/_generated/dataModel";

export type AdminLawyerUrgency =
	| "sla_breached"
	| "representation_override_needed"
	| "verification_requires_review"
	| "invitation_expiring"
	| "restriction_recheck_due"
	| "at_capacity"
	| "pending_onboarding"
	| "normal";

export type AdminLawyerProfileKind = "all" | "platform" | "guest" | "both";
export type AdminLawyerRosterSort = "urgency" | "latest_activity" | "name";
export type AdminLawyerPlatformStatusFilter =
	| "all"
	| "invited"
	| "active"
	| "requires_review"
	| "suspended"
	| "offboarded"
	| "not_platform";
export type AdminLawyerVerificationStatusFilter =
	| "all"
	| "eligible"
	| "ineligible"
	| "requires_review"
	| "failed"
	| "not_verified";
export type AdminLawyerInvitationStatusFilter =
	| "all"
	| "pending"
	| "accepted"
	| "verified"
	| "expired"
	| "revoked"
	| "failed"
	| "sent"
	| "canceled"
	| "none";
export type AdminLawyerCapacitySlaFilter =
	| "all"
	| "sla_breached"
	| "at_capacity"
	| "restriction_recheck_due";

export type AdminLawyerSummaryKey =
	| "needsAction"
	| "slaBreached"
	| "invitationsExpiring"
	| "verificationReview"
	| "atCapacity"
	| "restrictionRecheckDue";

export interface AdminLawyerRosterFilters {
	readonly capacitySla?: AdminLawyerCapacitySlaFilter;
	readonly invitationStatus?: AdminLawyerInvitationStatusFilter;
	readonly platformStatus?: AdminLawyerPlatformStatusFilter;
	readonly profileKind: AdminLawyerProfileKind;
	readonly urgency: AdminLawyerUrgency | "all";
	readonly verificationStatus?: AdminLawyerVerificationStatusFilter;
}

export interface AdminLawyerRosterRow {
	readonly activeDealCount: number;
	readonly activeInvitation: {
		readonly dealId: Id<"deals">;
		readonly deliveryStatus: string | null;
		readonly expiresAt: number;
		readonly invitationId: Id<"lawyerInvitations">;
		readonly status: string;
		readonly targetEmail: string;
		readonly updatedAt: number;
	} | null;
	readonly barNumber: string | null;
	readonly capacityLimit: number | null;
	readonly capacityWarning?: string | null;
	readonly displayName: string;
	readonly email: string;
	readonly firmName: string | null;
	readonly invitationStatus: string;
	readonly jurisdiction: string | null;
	readonly latestActivityAt: number;
	readonly latestVerification: {
		readonly checkType: string;
		readonly createdAt: number;
		readonly expiresAt: number | null;
		readonly outcome: string;
		readonly reasonCodes: readonly string[];
		readonly verificationId: Id<"lawyerVerifications">;
	} | null;
	readonly nextAction: string;
	readonly platformInvitation: {
		readonly deliveryStatus: string | null;
		readonly invitationId: Id<"platformLawyerInvitations">;
		readonly status: string;
		readonly targetEmail: string;
		readonly updatedAt: number;
	} | null;
	readonly platformOnboardingSession: {
		readonly currentStep: string;
		readonly nextRoute: string | null;
		readonly sessionId: Id<"lawyerOnboardingSessions">;
		readonly status: string;
		readonly updatedAt: number;
	} | null;
	readonly platformStatus: string;
	readonly profileId: Id<"lawyerProfiles">;
	readonly profileKind: "platform" | "guest" | "both";
	readonly restrictionRecheckStatus?: string;
	readonly slaStatus?: string;
	readonly urgency: AdminLawyerUrgency;
	readonly verificationStatus: string;
}

export interface AdminLawyerRosterResult {
	readonly nextCursor: number | null;
	readonly rows: readonly AdminLawyerRosterRow[];
	readonly summary: Record<AdminLawyerSummaryKey, number>;
	readonly totalCount: number;
}

export interface AdminLawyerDetailResult {
	readonly activity: {
		readonly events: readonly {
			readonly at: number;
			readonly entityId: string;
			readonly kind: string;
			readonly label: string;
		}[];
		readonly latestActivityAt: number;
	};
	readonly allowedActions: {
		readonly cancelInvitation: boolean;
		readonly replaceLawyer: boolean;
		readonly resendInvitation: boolean;
		readonly verifyRepresentation: boolean;
	};
	readonly deals: {
		readonly active: readonly {
			readonly _id: Id<"deals">;
			readonly lawyerType?: "platform_lawyer" | "guest_lawyer";
			readonly selectedLawyer?: {
				readonly email?: string;
				readonly firm?: string;
				readonly lawyerId?: string;
				readonly name: string;
				readonly source: string;
				readonly type: "platform_lawyer" | "guest_lawyer";
			};
			readonly status: string;
		}[];
		readonly recent: readonly {
			readonly _id: Id<"deals">;
			readonly status: string;
		}[];
	};
	readonly invitations: {
		readonly active: readonly {
			readonly _id: Id<"lawyerInvitations">;
			readonly dealId: Id<"deals">;
			readonly status: string;
		}[];
		readonly historical: readonly { readonly status: string }[];
	};
	readonly platform: {
		readonly assignment: { readonly capacityLimit: number } | null;
		readonly availability: {
			readonly exceptions: readonly unknown[];
			readonly windows: readonly unknown[];
		};
		readonly escalations: readonly {
			readonly message?: string;
			readonly status?: string;
		}[];
		readonly invitations: {
			readonly active: readonly { readonly status: string }[];
			readonly historical: readonly { readonly status: string }[];
		};
		readonly metrics: unknown | null;
		readonly onboardingSessions: {
			readonly active: readonly { readonly status: string }[];
			readonly historical: readonly { readonly status: string }[];
		};
		readonly restrictionRecheck: unknown | null;
		readonly slaReview: unknown | null;
	};
	readonly profile: {
		readonly _id: Id<"lawyerProfiles">;
		readonly barNumber?: string;
		readonly displayName: string;
		readonly email: string;
		readonly firmName?: string;
		readonly jurisdiction?: string;
		readonly profileKind: "platform" | "guest" | "both";
	};
	readonly representation: {
		readonly engagements: readonly unknown[];
		readonly overrideEvidence: readonly unknown[];
	};
	readonly verifications: readonly { readonly outcome?: string }[];
}

export interface PlatformInviteResolution {
	readonly normalizedEmail: string;
	readonly profile: {
		readonly authId: string | null;
		readonly displayName: string;
		readonly email: string;
		readonly firmName: string | null;
		readonly platformStatus: string | null;
		readonly profileId: Id<"lawyerProfiles">;
		readonly profileKind: "platform" | "guest" | "both";
	} | null;
	readonly recommendedAction:
		| "attach_existing_user"
		| "designate_existing_profile"
		| "create_pending";
	readonly user: {
		readonly authId: string;
		readonly displayName: string;
		readonly email: string;
		readonly userId: Id<"users">;
	} | null;
}

const URGENCY_LABELS: Record<AdminLawyerUrgency, string> = {
	at_capacity: "At capacity",
	invitation_expiring: "Invitation expiring",
	normal: "Normal",
	pending_onboarding: "Pending onboarding",
	representation_override_needed: "Representation override needed",
	restriction_recheck_due: "Restriction recheck due",
	sla_breached: "SLA breached",
	verification_requires_review: "Verification review",
};

export function formatLawyerUrgencyLabel(urgency: AdminLawyerUrgency) {
	return URGENCY_LABELS[urgency];
}

export function formatLawyerProfileKind(kind: "platform" | "guest" | "both") {
	if (kind === "both") {
		return "Platform and guest";
	}
	return kind === "platform" ? "Platform" : "Guest";
}

export function formatAdminEnum(value: string | null | undefined) {
	if (!value || value === "none") {
		return "None";
	}
	if (value === "not_platform") {
		return "Not platform";
	}
	return value
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

export function getLawyerRosterFilterFromSummaryCard(
	key: AdminLawyerSummaryKey
): AdminLawyerRosterFilters {
	switch (key) {
		case "slaBreached":
			return { profileKind: "all", urgency: "sla_breached" };
		case "invitationsExpiring":
			return { profileKind: "all", urgency: "invitation_expiring" };
		case "verificationReview":
			return { profileKind: "all", urgency: "verification_requires_review" };
		case "atCapacity":
			return { profileKind: "all", urgency: "at_capacity" };
		case "restrictionRecheckDue":
			return { profileKind: "all", urgency: "restriction_recheck_due" };
		case "needsAction":
			return { profileKind: "all", urgency: "all" };
		default:
			return { profileKind: "all", urgency: "all" };
	}
}
