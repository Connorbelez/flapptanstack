import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { RepresentationEngagementProvider } from "./validators";

type EngagementMutationCtx = Pick<MutationCtx, "db">;
type EngagementQueryCtx = Pick<QueryCtx, "db">;

export interface RecordManualRepresentationEngagementArgs {
	readonly createdAt?: number;
	readonly dealDocumentInstanceId?: Id<"dealDocumentInstances">;
	readonly dealId: Id<"deals">;
	readonly documentPackageId?: string;
	readonly evidenceHash: string;
	readonly lawyerAuthId: string;
	readonly lawyerProfileId?: Id<"lawyerProfiles">;
	readonly provider?: RepresentationEngagementProvider;
	readonly providerEnvelopeId?: string;
	readonly signedAt?: number;
}

function assertSignedEvidence(args: {
	readonly evidenceHash?: string;
	readonly lawyerAuthId: string;
}) {
	if (args.lawyerAuthId.trim().length === 0) {
		throw new ConvexError("Representation engagement requires lawyerAuthId");
	}
	if (!args.evidenceHash || args.evidenceHash.trim().length === 0) {
		throw new ConvexError(
			"Signed representation engagement requires evidenceHash"
		);
	}
}

export async function recordSignedRepresentationEngagementRow(
	ctx: EngagementMutationCtx,
	args: RecordManualRepresentationEngagementArgs
): Promise<Id<"representationEngagements">> {
	assertSignedEvidence(args);
	const now = args.createdAt ?? Date.now();
	return await ctx.db.insert("representationEngagements", {
		dealId: args.dealId,
		lawyerAuthId: args.lawyerAuthId,
		lawyerProfileId: args.lawyerProfileId,
		status: "signed",
		provider: args.provider ?? "manual_admin",
		documentPackageId: args.documentPackageId,
		dealDocumentInstanceId: args.dealDocumentInstanceId,
		providerEnvelopeId: args.providerEnvelopeId,
		signedAt: args.signedAt ?? now,
		evidenceHash: args.evidenceHash,
		createdAt: now,
		updatedAt: now,
	});
}

export async function listRepresentationEngagementsForDeal(
	ctx: EngagementQueryCtx,
	dealId: Id<"deals">
): Promise<Doc<"representationEngagements">[]> {
	return await ctx.db
		.query("representationEngagements")
		.withIndex("by_deal", (query) => query.eq("dealId", dealId))
		.collect();
}

export async function getLatestSignedRepresentationEngagementForLawyer(
	ctx: EngagementQueryCtx,
	args: {
		readonly dealId: Id<"deals">;
		readonly lawyerAuthId: string;
	}
): Promise<Doc<"representationEngagements"> | null> {
	const signed = await ctx.db
		.query("representationEngagements")
		.withIndex("by_deal_status", (query) =>
			query.eq("dealId", args.dealId).eq("status", "signed")
		)
		.collect();
	return (
		signed
			.filter((engagement) => engagement.lawyerAuthId === args.lawyerAuthId)
			.sort((left, right) => right.createdAt - left.createdAt)[0] ?? null
	);
}
