import type {
	DealAccessCapability,
	DealAccessDecision,
	DealAccessIntent,
	DealAccessScope,
	DealPersona,
	DealPersonaReadiness,
	LawyerSourceKind,
	LegacyDealAccessStorageRole,
} from "./types";

export type LegacyDocumentSignatoryRole =
	| "lender"
	| "borrower"
	| "lender_primary"
	| "borrower_primary"
	| "borrower_co_1"
	| "borrower_co_2"
	| "lawyer_primary"
	| "broker_of_record"
	| "assigned_broker"
	| "fairlend_broker";

export interface NormalizedDealAccessFacts {
	activeDealAccess: readonly {
		persona: DealPersona;
		source?: LegacyDealAccessStorageRole | LawyerSourceKind;
	}[];
	closingTeam: boolean;
	dealId: string;
	intent: DealAccessIntent;
	isFairLendAdmin: boolean;
	lawyer: {
		hasAcceptedEngagement: boolean;
		hasCurrentVerification: boolean;
		hasOwnedOnboardingSession: boolean;
		invitationTargetMatchesViewer: boolean;
		isSelectedByAuthId: boolean;
		isSelectedByEmail: boolean;
		kind: LawyerSourceKind | null;
		onboardingSessionId: string | null;
		onboardingStatus:
			| "auth_pending"
			| "identity_pending"
			| "lso_pending"
			| "idv_pending"
			| "engagement_pending"
			| "complete"
			| "blocked"
			| "expired"
			| "pending"
			| "verified"
			| null;
	};
	mortgageBorrower: {
		persona: Extract<
			DealPersona,
			"primary_borrower" | "co_borrower_1" | "co_borrower_2"
		>;
		authId: string;
	} | null;
	purchasingLenderAuthId?: string | null;
	sellingLenderAuthId?: string | null;
	viewerAuthId: string;
	workosRoles: readonly string[];
}

export function legacyStorageRoleToDealPersona(args: {
	dealPosition?: "purchasing" | "selling";
	role: LegacyDealAccessStorageRole;
}): DealPersona | null {
	switch (args.role) {
		case "lender":
			if (args.dealPosition === "purchasing") {
				return "purchasing_lender";
			}
			if (args.dealPosition === "selling") {
				return "selling_lender";
			}
			return null;
		case "borrower":
			return null;
		case "platform_lawyer":
		case "guest_lawyer":
			return "primary_lawyer";
		case "broker_of_record":
		case "assigned_broker":
			return args.role;
		default:
			return args.role satisfies never;
	}
}

export function legacyDocumentSignatoryRoleToDealPersona(
	role: LegacyDocumentSignatoryRole | string
): DealPersona | null {
	switch (role) {
		case "lender_primary":
		case "lender":
			return "purchasing_lender";
		case "borrower_primary":
		case "borrower":
			return "primary_borrower";
		case "borrower_co_1":
			return "co_borrower_1";
		case "borrower_co_2":
			return "co_borrower_2";
		case "lawyer_primary":
			return "primary_lawyer";
		case "broker_of_record":
		case "fairlend_broker":
			return "broker_of_record";
		case "assigned_broker":
			return "assigned_broker";
		default:
			return null;
	}
}

export function dealPersonaToDocumentSignatoryRole(
	persona: DealPersona
): DealPersona | null {
	switch (persona) {
		case "purchasing_lender":
		case "selling_lender":
		case "primary_borrower":
		case "co_borrower_1":
		case "co_borrower_2":
		case "broker_of_record":
		case "assigned_broker":
		case "primary_lawyer":
			return persona;
		default:
			return null;
	}
}

export function dealPersonaToTemplateVariablePrefix(
	persona: DealPersona
): string | null {
	switch (persona) {
		case "purchasing_lender":
		case "selling_lender":
		case "primary_borrower":
		case "co_borrower_1":
		case "co_borrower_2":
		case "broker_of_record":
		case "assigned_broker":
		case "primary_lawyer":
			return persona;
		default:
			return null;
	}
}

function capabilities(
	intent: DealAccessIntent,
	extra: readonly DealAccessCapability[] = []
): DealAccessCapability[] {
	return [...new Set<DealAccessCapability>([intent, ...extra])].sort();
}

function allow(args: {
	capabilities?: DealAccessCapability[];
	persona: DealPersona;
	readiness?: DealPersonaReadiness;
	reason: string;
	scope?: DealAccessScope;
}): DealAccessDecision {
	return {
		allowed: true,
		capabilities: args.capabilities ?? [],
		persona: args.persona,
		readiness: args.readiness ?? "active",
		reason: args.reason,
		scope: args.scope ?? "full_deal",
	};
}

function deny(args: {
	capabilities?: DealAccessCapability[];
	persona: DealPersona;
	readiness: DealPersonaReadiness;
	reason: string;
	redirectTo?: string | null;
}): DealAccessDecision {
	return {
		allowed: false,
		capabilities: args.capabilities ?? [],
		persona: args.persona,
		readiness: args.readiness,
		reason: args.reason,
		redirectTo: args.redirectTo ?? null,
		scope: "none",
	};
}

function activeAccessPersona(
	facts: NormalizedDealAccessFacts,
	persona: DealPersona
) {
	return facts.activeDealAccess.some((access) => access.persona === persona);
}

function onboardingRoute(facts: NormalizedDealAccessFacts) {
	return facts.lawyer.onboardingSessionId
		? `/lawyer/onboarding/${facts.lawyer.onboardingSessionId}`
		: `/lawyer/deals/${facts.dealId}`;
}

function lawyerReadiness(
	facts: NormalizedDealAccessFacts
): DealPersonaReadiness {
	if (facts.lawyer.onboardingStatus === "expired") {
		return "revoked";
	}
	if (
		!facts.lawyer.hasOwnedOnboardingSession &&
		(facts.lawyer.invitationTargetMatchesViewer ||
			facts.lawyer.isSelectedByEmail)
	) {
		return "invited";
	}
	if (
		facts.lawyer.onboardingStatus === "pending" ||
		facts.lawyer.onboardingStatus === "verified" ||
		facts.lawyer.onboardingStatus === "auth_pending" ||
		facts.lawyer.onboardingStatus === "identity_pending" ||
		facts.lawyer.onboardingStatus === "lso_pending" ||
		facts.lawyer.onboardingStatus === "idv_pending" ||
		facts.lawyer.onboardingStatus === "engagement_pending" ||
		facts.lawyer.onboardingStatus === "blocked"
	) {
		return "onboarding_in_progress";
	}
	if (
		facts.lawyer.hasOwnedOnboardingSession ||
		facts.lawyer.isSelectedByAuthId ||
		activeAccessPersona(facts, "primary_lawyer")
	) {
		if (!facts.lawyer.hasCurrentVerification) {
			return "verification_required";
		}
		if (!facts.lawyer.hasAcceptedEngagement) {
			return "engagement_required";
		}
		return "active";
	}
	return "invited";
}

function isLawyerIntent(intent: DealAccessIntent) {
	return (
		intent === "lawyer.onboarding.bootstrap" ||
		intent === "lawyer.onboarding.resume" ||
		intent === "lawyer.representation.confirm" ||
		intent === "lawyer.document.review"
	);
}

function classifyLawyer(facts: NormalizedDealAccessFacts) {
	const lawyerRelated =
		facts.lawyer.invitationTargetMatchesViewer ||
		facts.lawyer.isSelectedByAuthId ||
		facts.lawyer.isSelectedByEmail ||
		facts.lawyer.hasOwnedOnboardingSession ||
		activeAccessPersona(facts, "primary_lawyer");
	if (!lawyerRelated) {
		return null;
	}

	const readiness = lawyerReadiness(facts);
	const route = onboardingRoute(facts);
	if (
		(facts.intent === "lawyer.onboarding.bootstrap" ||
			facts.intent === "lawyer.onboarding.resume") &&
		(readiness === "invited" ||
			readiness === "onboarding_required" ||
			readiness === "onboarding_in_progress" ||
			readiness === "verification_required" ||
			readiness === "engagement_required")
	) {
		return allow({
			capabilities: capabilities(facts.intent),
			persona: "primary_lawyer",
			readiness,
			reason: "lawyer_onboarding_access",
			scope: "onboarding_only",
		});
	}

	if (readiness !== "active") {
		return deny({
			persona: "primary_lawyer",
			readiness,
			reason: "lawyer_not_ready",
			redirectTo:
				facts.intent === "deal.portal.view" || isLawyerIntent(facts.intent)
					? route
					: null,
		});
	}

	const scope =
		facts.intent === "lawyer.document.review" ||
		facts.intent === "lawyer.representation.confirm"
			? "party_limited"
			: "full_deal";
	return allow({
		capabilities: capabilities(facts.intent, [
			"representation.confirm",
			"documents.approve",
			"payment.proof.upload",
		]),
		persona: "primary_lawyer",
		reason: "active_primary_lawyer",
		scope,
	});
}

export function classifyDealAccessFacts(
	facts: NormalizedDealAccessFacts
): DealAccessDecision {
	if (facts.isFairLendAdmin) {
		return allow({
			capabilities: capabilities(facts.intent),
			persona: "fairlend_admin",
			reason: "fairlend_admin",
		});
	}

	const lawyerDecision = classifyLawyer(facts);
	if (lawyerDecision) {
		return lawyerDecision;
	}

	if (
		facts.viewerAuthId === facts.purchasingLenderAuthId ||
		activeAccessPersona(facts, "purchasing_lender")
	) {
		return allow({
			capabilities: capabilities(facts.intent, ["payment.proof.upload"]),
			persona: "purchasing_lender",
			reason: "purchasing_lender",
		});
	}

	if (
		facts.viewerAuthId === facts.sellingLenderAuthId ||
		activeAccessPersona(facts, "selling_lender")
	) {
		return allow({
			capabilities: capabilities(facts.intent),
			persona: "selling_lender",
			reason: "selling_lender",
		});
	}

	if (activeAccessPersona(facts, "participating_lender")) {
		return allow({
			capabilities: capabilities(facts.intent),
			persona: "participating_lender",
			reason: "participating_lender",
			scope: "party_limited",
		});
	}

	if (facts.mortgageBorrower?.authId === facts.viewerAuthId) {
		return allow({
			capabilities: capabilities(facts.intent),
			persona: facts.mortgageBorrower.persona,
			reason: facts.mortgageBorrower.persona,
			scope: "party_limited",
		});
	}

	if (activeAccessPersona(facts, "broker_of_record")) {
		return allow({
			capabilities: capabilities(facts.intent),
			persona: "broker_of_record",
			reason: "broker_of_record",
			scope: "party_limited",
		});
	}

	if (activeAccessPersona(facts, "assigned_broker")) {
		return allow({
			capabilities: capabilities(facts.intent),
			persona: "assigned_broker",
			reason: "assigned_broker",
			scope: "party_limited",
		});
	}

	if (facts.closingTeam) {
		return allow({
			capabilities: capabilities(facts.intent),
			persona: "closing_team_member",
			reason: "closing_team_member",
			scope: "party_limited",
		});
	}

	return deny({
		persona: "participating_lender",
		readiness: "revoked",
		reason: "no_deal_access",
	});
}
