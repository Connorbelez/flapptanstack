import { v } from "convex/values";

export const DEAL_PERSONAS = [
	"fairlend_admin",
	"purchasing_lender",
	"selling_lender",
	"participating_lender",
	"primary_borrower",
	"co_borrower_1",
	"co_borrower_2",
	"broker_of_record",
	"assigned_broker",
	"primary_lawyer",
	"closing_team_member",
] as const;

export type DealPersona = (typeof DEAL_PERSONAS)[number];

export const dealPersonaValidator = v.union(
	v.literal("fairlend_admin"),
	v.literal("purchasing_lender"),
	v.literal("selling_lender"),
	v.literal("participating_lender"),
	v.literal("primary_borrower"),
	v.literal("co_borrower_1"),
	v.literal("co_borrower_2"),
	v.literal("broker_of_record"),
	v.literal("assigned_broker"),
	v.literal("primary_lawyer"),
	v.literal("closing_team_member")
);

export const DEAL_PERSONA_READINESS = [
	"active",
	"invited",
	"onboarding_required",
	"onboarding_in_progress",
	"verification_required",
	"engagement_required",
	"suspended",
	"revoked",
] as const;

export type DealPersonaReadiness = (typeof DEAL_PERSONA_READINESS)[number];

export const DEAL_ACCESS_INTENTS = [
	"deal.portal.view",
	"lawyer.onboarding.bootstrap",
	"lawyer.onboarding.resume",
	"lawyer.representation.confirm",
	"lawyer.document.review",
	"deal.document.view",
	"deal.transfer.view",
	"deal.payment_proof.upload",
	"admin.deal.manage",
] as const;

export type DealAccessIntent = (typeof DEAL_ACCESS_INTENTS)[number];

export type DealAccessScope = "full_deal" | "party_limited" | "onboarding_only";

export type DealAccessCapability =
	| DealAccessIntent
	| "representation.onboarding.resume"
	| "representation.confirm"
	| "documents.approve"
	| "payment.proof.upload";

interface DealAccessDecisionBase {
	capabilities: DealAccessCapability[];
	persona: DealPersona;
	readiness: DealPersonaReadiness;
	reason: string;
}

export interface AllowedDealAccessDecision extends DealAccessDecisionBase {
	allowed: true;
	redirectTo?: never;
	scope: DealAccessScope;
}

export interface DeniedDealAccessDecision extends DealAccessDecisionBase {
	allowed: false;
	redirectTo: string | null;
	scope: "none";
}

export type DealAccessDecision =
	| AllowedDealAccessDecision
	| DeniedDealAccessDecision;

export const LEGACY_DEAL_ACCESS_STORAGE_ROLES = [
	"lender",
	"borrower",
	"platform_lawyer",
	"guest_lawyer",
	"broker_of_record",
	"assigned_broker",
] as const;

export type LegacyDealAccessStorageRole =
	(typeof LEGACY_DEAL_ACCESS_STORAGE_ROLES)[number];

export type LawyerSourceKind = "platform_lawyer" | "guest_lawyer";

export function isDealPersona(value: string): value is DealPersona {
	return (DEAL_PERSONAS as readonly string[]).includes(value);
}
