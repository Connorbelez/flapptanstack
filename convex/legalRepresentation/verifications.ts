import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
	normalizeBarNumber,
	normalizeJurisdiction,
	normalizeLawyerEmail,
	normalizeReasonCodes,
} from "./normalization";
import type { LawyerVerificationProviderResult } from "./providers";
import type {
	LawyerVerificationCheckType,
	LawyerVerificationReasonCode,
	LegalCheckpoint,
	LegalCheckpointDecision,
	LegalCheckpointResult,
	LegalSourceSnapshot,
} from "./validators";

type LegalRepresentationMutationCtx = Pick<MutationCtx, "db">;
type LegalRepresentationQueryCtx = Pick<QueryCtx, "db">;

export interface RecordLawyerVerificationArgs {
	readonly authId?: string;
	readonly barNumber?: string;
	readonly checkType: LawyerVerificationCheckType;
	readonly createdAt?: number;
	readonly createdBy: string;
	readonly dealId?: Id<"deals">;
	readonly jurisdiction?: string;
	readonly lawyerProfileId?: Id<"lawyerProfiles">;
	readonly lsoLawyerId?: Id<"lsoLawyers">;
	readonly normalizedEmail?: string;
	readonly providerResult: LawyerVerificationProviderResult;
}

export async function recordLawyerVerificationRow(
	ctx: LegalRepresentationMutationCtx,
	args: RecordLawyerVerificationArgs
): Promise<Id<"lawyerVerifications">> {
	const createdAt = args.createdAt ?? Date.now();
	const reasonCodes = normalizeReasonCodes(args.providerResult.reasonCodes);
	if (reasonCodes.length === 0) {
		throw new ConvexError(
			"Lawyer verification requires at least one reason code"
		);
	}
	if (
		args.providerResult.outcome === "eligible" &&
		args.providerResult.expiresAt === undefined
	) {
		throw new ConvexError("Eligible lawyer verification requires expiresAt");
	}
	return await ctx.db.insert("lawyerVerifications", {
		lawyerProfileId: args.lawyerProfileId,
		dealId: args.dealId,
		lsoLawyerId: args.lsoLawyerId,
		authId: args.authId,
		normalizedEmail:
			args.normalizedEmail === undefined
				? undefined
				: normalizeLawyerEmail(args.normalizedEmail),
		barNumber:
			args.barNumber === undefined
				? undefined
				: normalizeBarNumber(args.barNumber),
		jurisdiction:
			args.jurisdiction === undefined
				? undefined
				: normalizeJurisdiction(args.jurisdiction),
		checkType: args.checkType,
		outcome: args.providerResult.outcome,
		reasonCodes,
		sourceSnapshot: args.providerResult.sourceSnapshot,
		provider: args.providerResult.provider,
		evidenceHash: args.providerResult.evidenceHash,
		expiresAt: args.providerResult.expiresAt,
		providerStatus: "completed",
		providerReferenceId: args.providerResult.providerReferenceId,
		providerCompletedAt: createdAt,
		createdAt,
		createdBy: args.createdBy,
	});
}

export async function completePendingLawyerVerificationRow(
	ctx: LegalRepresentationMutationCtx,
	args: {
		readonly evidenceHash?: string;
		readonly providerCompletedAt?: number;
		readonly providerReferenceId?: string;
		readonly sourceSnapshot?: LegalSourceSnapshot;
		readonly verificationId: Id<"lawyerVerifications">;
	}
): Promise<void> {
	const row = await ctx.db.get(args.verificationId);
	if (!row) {
		throw new ConvexError("Lawyer verification not found");
	}
	if (row.providerStatus !== "pending") {
		throw new ConvexError(
			"Only pending lawyer verification rows can receive provider completion fields"
		);
	}
	await ctx.db.patch(args.verificationId, {
		evidenceHash: args.evidenceHash,
		providerCompletedAt: args.providerCompletedAt ?? Date.now(),
		providerReferenceId: args.providerReferenceId,
		providerStatus: "completed",
		sourceSnapshot: args.sourceSnapshot ?? row.sourceSnapshot,
	});
}

export function isLawyerVerificationCurrent(
	verification: Pick<Doc<"lawyerVerifications">, "expiresAt" | "outcome">,
	now: number
): boolean {
	if (
		verification.outcome === "eligible" &&
		verification.expiresAt === undefined
	) {
		return false;
	}
	return verification.expiresAt === undefined || verification.expiresAt > now;
}

export function isEligibleCurrentLawyerVerification(
	verification: Pick<Doc<"lawyerVerifications">, "expiresAt" | "outcome">,
	now: number
): boolean {
	return (
		verification.outcome === "eligible" &&
		isLawyerVerificationCurrent(verification, now)
	);
}

export async function listLawyerVerificationsForDeal(
	ctx: LegalRepresentationQueryCtx,
	args: {
		readonly checkType?: LawyerVerificationCheckType;
		readonly dealId: Id<"deals">;
	}
): Promise<Doc<"lawyerVerifications">[]> {
	const { checkType, dealId } = args;
	if (checkType) {
		return await ctx.db
			.query("lawyerVerifications")
			.withIndex("by_deal_check_created", (query) =>
				query.eq("dealId", dealId).eq("checkType", checkType)
			)
			.order("desc")
			.collect();
	}
	return await ctx.db
		.query("lawyerVerifications")
		.withIndex("by_deal_created", (query) => query.eq("dealId", dealId))
		.order("desc")
		.collect();
}

export async function getLatestLawyerVerificationForProfile(
	ctx: LegalRepresentationQueryCtx,
	args: {
		readonly checkType: LawyerVerificationCheckType;
		readonly lawyerProfileId: Id<"lawyerProfiles">;
	}
): Promise<Doc<"lawyerVerifications"> | null> {
	const rows = await ctx.db
		.query("lawyerVerifications")
		.withIndex("by_profile_check_created", (query) =>
			query
				.eq("lawyerProfileId", args.lawyerProfileId)
				.eq("checkType", args.checkType)
		)
		.order("desc")
		.first();
	return rows;
}

export async function getLatestLawyerVerificationForAuth(
	ctx: LegalRepresentationQueryCtx,
	args: {
		readonly authId: string;
		readonly checkType: LawyerVerificationCheckType;
	}
): Promise<Doc<"lawyerVerifications"> | null> {
	const rows = await ctx.db
		.query("lawyerVerifications")
		.withIndex("by_auth_check_created", (query) =>
			query.eq("authId", args.authId).eq("checkType", args.checkType)
		)
		.order("desc")
		.first();
	return rows;
}

export async function getLatestLawyerVerificationForBar(
	ctx: LegalRepresentationQueryCtx,
	args: {
		readonly barNumber: string;
		readonly checkType: LawyerVerificationCheckType;
		readonly jurisdiction: string;
	}
): Promise<Doc<"lawyerVerifications"> | null> {
	const rows = await ctx.db
		.query("lawyerVerifications")
		.withIndex("by_bar_jurisdiction_check_created", (query) =>
			query
				.eq("barNumber", normalizeBarNumber(args.barNumber))
				.eq("jurisdiction", normalizeJurisdiction(args.jurisdiction))
				.eq("checkType", args.checkType)
		)
		.order("desc")
		.first();
	return rows;
}

export async function listExpiringLawyerVerifications(
	ctx: LegalRepresentationQueryCtx,
	args: {
		readonly checkType: LawyerVerificationCheckType;
		readonly expiresAtOrBefore: number;
	}
): Promise<Doc<"lawyerVerifications">[]> {
	return await ctx.db
		.query("lawyerVerifications")
		.withIndex("by_check_expires_at", (query) =>
			query
				.eq("checkType", args.checkType)
				.lte("expiresAt", args.expiresAtOrBefore)
		)
		.collect();
}

function reasonsForVerification(
	verification: Doc<"lawyerVerifications"> | null,
	now: number
): LawyerVerificationReasonCode[] {
	if (!verification) {
		return ["license_not_found"];
	}
	if (!isLawyerVerificationCurrent(verification, now)) {
		return ["evidence_expired"];
	}
	return verification.reasonCodes;
}

function decisionForVerification(
	verification: Doc<"lawyerVerifications"> | null,
	now: number
): LegalCheckpointDecision {
	if (!(verification && isLawyerVerificationCurrent(verification, now))) {
		return "block";
	}
	if (verification.outcome === "eligible") {
		return "allow";
	}
	if (verification.outcome === "requires_review") {
		return "requires_review";
	}
	return "block";
}

export function decideLegalCheckpoint(args: {
	readonly checkpoint: LegalCheckpoint;
	readonly engagement?: Pick<
		Doc<"representationEngagements">,
		"_id" | "status"
	> | null;
	readonly now: number;
	readonly profile?: Pick<Doc<"lawyerProfiles">, "platformStatus"> | null;
	readonly verification: Doc<"lawyerVerifications"> | null;
}): LegalCheckpointResult {
	const verificationDecision = decisionForVerification(
		args.verification,
		args.now
	);
	const baseReasons = reasonsForVerification(args.verification, args.now);
	if (verificationDecision !== "allow") {
		return {
			checkpoint: args.checkpoint,
			decision: verificationDecision,
			reasonCodes: baseReasons,
			verificationId: args.verification?._id,
			expiresAt: args.verification?.expiresAt,
		};
	}

	if (args.checkpoint === "platform_activation") {
		if (args.profile?.platformStatus === "suspended") {
			return {
				checkpoint: args.checkpoint,
				decision: "block",
				reasonCodes: ["profile_suspended"],
				verificationId: args.verification?._id,
				expiresAt: args.verification?.expiresAt,
			};
		}
		if (args.profile?.platformStatus === "offboarded") {
			return {
				checkpoint: args.checkpoint,
				decision: "block",
				reasonCodes: ["profile_offboarded"],
				verificationId: args.verification?._id,
				expiresAt: args.verification?.expiresAt,
			};
		}
	}

	if (
		args.checkpoint === "REPRESENTATION_CONFIRMED" &&
		args.engagement?.status !== "signed"
	) {
		return {
			checkpoint: args.checkpoint,
			decision: "block",
			reasonCodes: ["engagement_missing"],
			verificationId: args.verification?._id,
			expiresAt: args.verification?.expiresAt,
		};
	}

	return {
		checkpoint: args.checkpoint,
		decision: "allow",
		reasonCodes:
			args.checkpoint === "REPRESENTATION_CONFIRMED"
				? normalizeReasonCodes([...baseReasons, "engagement_signed"])
				: baseReasons,
		verificationId: args.verification?._id,
		engagementId: args.engagement?._id,
		expiresAt: args.verification?.expiresAt,
	};
}

export function verificationBlocksCheckpoint(args: {
	readonly checkpoint: LegalCheckpoint;
	readonly engagement?: Pick<
		Doc<"representationEngagements">,
		"_id" | "status"
	> | null;
	readonly now: number;
	readonly profile?: Pick<Doc<"lawyerProfiles">, "platformStatus"> | null;
	readonly verification: Doc<"lawyerVerifications"> | null;
}): boolean {
	return decideLegalCheckpoint(args).decision === "block";
}
