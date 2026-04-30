import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
	getLatestSignedRepresentationEngagementForLawyer,
	listRepresentationEngagementsForDeal,
} from "./engagements";
import { normalizeBarNumber, normalizeJurisdiction } from "./normalization";
import type {
	LawyerVerificationCheckType,
	LawyerVerificationReasonCode,
	LegalCheckpoint,
	LegalCheckpointDecision,
} from "./validators";
import {
	decideLegalCheckpoint,
	getLatestLawyerVerificationForAuth,
	getLatestLawyerVerificationForBar,
	getLatestLawyerVerificationForProfile,
	listLawyerVerificationsForDeal,
} from "./verifications";

type GateCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

const VERIFICATION_CHECK_TYPES: readonly LawyerVerificationCheckType[] = [
	"fresh_restriction",
	"initial_lso",
	"platform_periodic",
	"manual_admin",
];

export type LegalGateReasonCode =
	| LawyerVerificationReasonCode
	| "selected_lawyer_missing"
	| "selected_lawyer_mismatch"
	| "lawyer_access_missing"
	| "lawyer_profile_missing";

export interface LegalGateAccessInput {
	readonly requireActiveAccess?: boolean;
	readonly sourceActorId?: string;
}

export interface LegalGateResult {
	readonly checkpoint: LegalCheckpoint;
	readonly decision: LegalCheckpointDecision;
	readonly engagementId?: Id<"representationEngagements">;
	readonly expiresAt?: number;
	readonly lawyerAuthId?: string;
	readonly lawyerProfileId?: Id<"lawyerProfiles">;
	readonly message: string;
	readonly reasonCodes: readonly LegalGateReasonCode[];
	readonly verificationId?: Id<"lawyerVerifications">;
}

function messageForReasons(reasonCodes: readonly LegalGateReasonCode[]) {
	if (reasonCodes.includes("selected_lawyer_missing")) {
		return "No selected lawyer is recorded for this deal.";
	}
	if (reasonCodes.includes("selected_lawyer_mismatch")) {
		return "The acting lawyer does not match the selected lawyer for this deal.";
	}
	if (reasonCodes.includes("lawyer_access_missing")) {
		return "Active lawyer deal access is required.";
	}
	if (reasonCodes.includes("lawyer_profile_missing")) {
		return "Selected lawyer profile evidence is missing.";
	}
	if (reasonCodes.includes("engagement_missing")) {
		return "Signed representation engagement evidence is required.";
	}
	if (reasonCodes.includes("evidence_expired")) {
		return "Lawyer verification evidence is expired.";
	}
	if (
		reasonCodes.includes("profile_suspended") ||
		reasonCodes.includes("profile_offboarded")
	) {
		return "Selected lawyer profile is not eligible.";
	}
	if (
		reasonCodes.includes("license_restricted") ||
		reasonCodes.includes("license_suspended") ||
		reasonCodes.includes("license_not_found")
	) {
		return "Current eligible lawyer verification evidence is required.";
	}
	if (reasonCodes.includes("requires_admin_review")) {
		return "Lawyer verification requires admin review.";
	}
	return "Legal representation gate is satisfied.";
}

function blockResult(args: {
	readonly checkpoint: LegalCheckpoint;
	readonly engagementId?: Id<"representationEngagements">;
	readonly expiresAt?: number;
	readonly lawyerAuthId?: string;
	readonly lawyerProfileId?: Id<"lawyerProfiles">;
	readonly reasonCodes: readonly LegalGateReasonCode[];
	readonly verificationId?: Id<"lawyerVerifications">;
}): LegalGateResult {
	return {
		checkpoint: args.checkpoint,
		decision: "block",
		engagementId: args.engagementId,
		expiresAt: args.expiresAt,
		lawyerAuthId: args.lawyerAuthId,
		lawyerProfileId: args.lawyerProfileId,
		message: messageForReasons(args.reasonCodes),
		reasonCodes: args.reasonCodes,
		verificationId: args.verificationId,
	};
}

function selectedLawyerAuthId(deal: Doc<"deals">): string | undefined {
	if (deal.lawyerId) {
		return deal.lawyerId;
	}
	if (deal.selectedLawyer?.type === "platform_lawyer") {
		return deal.selectedLawyer.lawyerId;
	}
	return undefined;
}

function isLawyerAccessRole(role: Doc<"dealAccess">["role"]) {
	return role === "platform_lawyer" || role === "guest_lawyer";
}

async function hasActiveLawyerAccess(
	ctx: GateCtx,
	args: {
		readonly dealId: Id<"deals">;
		readonly lawyerAuthId: string;
	}
) {
	const access = await ctx.db
		.query("dealAccess")
		.withIndex("by_user_and_deal", (query) =>
			query.eq("userId", args.lawyerAuthId).eq("dealId", args.dealId)
		)
		.filter((query) => query.eq(query.field("status"), "active"))
		.first();
	return Boolean(access && isLawyerAccessRole(access.role));
}

async function getProfileForSelectedLawyer(
	ctx: GateCtx,
	args: {
		readonly deal: Doc<"deals">;
		readonly lawyerAuthId?: string;
	}
): Promise<Doc<"lawyerProfiles"> | null> {
	if (args.lawyerAuthId) {
		const byAuth = await ctx.db
			.query("lawyerProfiles")
			.withIndex("by_auth_id", (query) => query.eq("authId", args.lawyerAuthId))
			.unique();
		if (byAuth) {
			return byAuth;
		}
	}
	const email = args.deal.selectedLawyer?.email;
	if (email) {
		const byEmail = await ctx.db
			.query("lawyerProfiles")
			.withIndex("by_normalized_email", (query) =>
				query.eq("normalizedEmail", email.trim().toLowerCase())
			)
			.unique();
		if (byEmail) {
			return byEmail;
		}
	}
	return null;
}

function verificationMatchesSelectedLawyer(
	verification: Doc<"lawyerVerifications">,
	args: {
		readonly deal: Doc<"deals">;
		readonly lawyerAuthId?: string;
		readonly profile?: Doc<"lawyerProfiles"> | null;
	}
) {
	if (args.lawyerAuthId && verification.authId === args.lawyerAuthId) {
		return true;
	}
	if (args.profile && verification.lawyerProfileId === args.profile._id) {
		return true;
	}
	const lso = args.deal.selectedLawyer?.lso;
	if (
		lso?.barNumber &&
		lso.jurisdiction &&
		verification.barNumber === normalizeBarNumber(lso.barNumber) &&
		verification.jurisdiction === normalizeJurisdiction(lso.jurisdiction)
	) {
		return true;
	}
	return false;
}

async function getLatestSelectedLawyerVerification(
	ctx: GateCtx,
	args: {
		readonly deal: Doc<"deals">;
		readonly lawyerAuthId?: string;
		readonly profile?: Doc<"lawyerProfiles"> | null;
	}
): Promise<Doc<"lawyerVerifications"> | null> {
	const candidates: Doc<"lawyerVerifications">[] = [];
	candidates.push(
		...(await listLawyerVerificationsForDeal(ctx, { dealId: args.deal._id }))
	);
	if (args.lawyerAuthId) {
		candidates.push(
			...(
				await Promise.all(
					VERIFICATION_CHECK_TYPES.map((checkType) =>
						getLatestLawyerVerificationForAuth(ctx, {
							authId: args.lawyerAuthId ?? "",
							checkType,
						})
					)
				)
			).filter((verification): verification is Doc<"lawyerVerifications"> =>
				Boolean(verification)
			)
		);
	}
	if (args.profile) {
		candidates.push(
			...(
				await Promise.all(
					VERIFICATION_CHECK_TYPES.map((checkType) =>
						getLatestLawyerVerificationForProfile(ctx, {
							lawyerProfileId: args.profile?._id as Id<"lawyerProfiles">,
							checkType,
						})
					)
				)
			).filter((verification): verification is Doc<"lawyerVerifications"> =>
				Boolean(verification)
			)
		);
	}
	const lso = args.deal.selectedLawyer?.lso;
	if (lso?.barNumber && lso.jurisdiction) {
		candidates.push(
			...(
				await Promise.all(
					VERIFICATION_CHECK_TYPES.map((checkType) =>
						getLatestLawyerVerificationForBar(ctx, {
							barNumber: lso.barNumber ?? "",
							jurisdiction: lso.jurisdiction ?? "",
							checkType,
						})
					)
				)
			).filter((verification): verification is Doc<"lawyerVerifications"> =>
				Boolean(verification)
			)
		);
	}

	const unique = new Map<
		Id<"lawyerVerifications">,
		Doc<"lawyerVerifications">
	>();
	for (const verification of candidates) {
		if (verificationMatchesSelectedLawyer(verification, args)) {
			unique.set(verification._id, verification);
		}
	}
	return (
		[...unique.values()].sort(
			(left, right) => right.createdAt - left.createdAt
		)[0] ?? null
	);
}

async function hasAnySignedEngagementForAnotherLawyer(
	ctx: GateCtx,
	args: {
		readonly dealId: Id<"deals">;
		readonly lawyerAuthId: string;
	}
) {
	const engagements = await listRepresentationEngagementsForDeal(
		ctx,
		args.dealId
	);
	return engagements.some(
		(engagement) =>
			engagement.status === "signed" &&
			engagement.lawyerAuthId !== args.lawyerAuthId
	);
}

export async function evaluateDealLegalGate(
	ctx: GateCtx,
	args: {
		readonly access?: LegalGateAccessInput;
		readonly checkpoint: LegalCheckpoint;
		readonly deal: Doc<"deals">;
		readonly now?: number;
	}
): Promise<LegalGateResult> {
	const now = args.now ?? Date.now();
	const selectedAuthId = selectedLawyerAuthId(args.deal);
	const actorId = args.access?.sourceActorId;
	const lawyerAuthId = actorId ?? selectedAuthId;

	if (!(args.deal.selectedLawyer || selectedAuthId)) {
		return blockResult({
			checkpoint: args.checkpoint,
			reasonCodes: ["selected_lawyer_missing"],
		});
	}
	if (actorId && selectedAuthId && actorId !== selectedAuthId) {
		return blockResult({
			checkpoint: args.checkpoint,
			lawyerAuthId,
			reasonCodes: ["selected_lawyer_mismatch"],
		});
	}
	if (!lawyerAuthId) {
		return blockResult({
			checkpoint: args.checkpoint,
			reasonCodes: ["lawyer_profile_missing"],
		});
	}
	if (
		args.access?.requireActiveAccess &&
		!(await hasActiveLawyerAccess(ctx, {
			dealId: args.deal._id,
			lawyerAuthId,
		}))
	) {
		return blockResult({
			checkpoint: args.checkpoint,
			lawyerAuthId,
			reasonCodes: ["lawyer_access_missing"],
		});
	}

	const profile = await getProfileForSelectedLawyer(ctx, {
		deal: args.deal,
		lawyerAuthId,
	});
	if (
		profile?.platformStatus === "suspended" ||
		profile?.platformStatus === "offboarded"
	) {
		return blockResult({
			checkpoint: args.checkpoint,
			lawyerAuthId,
			lawyerProfileId: profile._id,
			reasonCodes: [
				profile.platformStatus === "suspended"
					? "profile_suspended"
					: "profile_offboarded",
			],
		});
	}

	const verification = await getLatestSelectedLawyerVerification(ctx, {
		deal: args.deal,
		lawyerAuthId,
		profile,
	});
	const engagement =
		args.checkpoint === "REPRESENTATION_CONFIRMED"
			? await getLatestSignedRepresentationEngagementForLawyer(ctx, {
					dealId: args.deal._id,
					lawyerAuthId,
				})
			: null;
	const decision = decideLegalCheckpoint({
		checkpoint: args.checkpoint,
		engagement,
		now,
		profile,
		verification,
	});

	if (
		args.checkpoint === "REPRESENTATION_CONFIRMED" &&
		decision.reasonCodes.includes("engagement_missing") &&
		(await hasAnySignedEngagementForAnotherLawyer(ctx, {
			dealId: args.deal._id,
			lawyerAuthId,
		}))
	) {
		return blockResult({
			checkpoint: args.checkpoint,
			expiresAt: decision.expiresAt,
			lawyerAuthId,
			lawyerProfileId: profile?._id,
			reasonCodes: ["selected_lawyer_mismatch"],
			verificationId: decision.verificationId,
		});
	}

	return {
		checkpoint: args.checkpoint,
		decision: decision.decision,
		engagementId: decision.engagementId,
		expiresAt: decision.expiresAt,
		lawyerAuthId,
		lawyerProfileId: profile?._id,
		message: messageForReasons(decision.reasonCodes),
		reasonCodes: decision.reasonCodes,
		verificationId: decision.verificationId,
	};
}

export function assertLegalGateAllowed(gate: LegalGateResult): void {
	if (gate.decision !== "allow") {
		throw new Error(`${gate.message} (${gate.reasonCodes.join(",")})`);
	}
}
