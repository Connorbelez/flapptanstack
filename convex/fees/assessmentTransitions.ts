import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { executeTransition } from "../engine/transition";
import type { CommandSource } from "../engine/types";

export type FeeAssessmentPersistedStatus =
	| "draft"
	| "assessed"
	| "invoiced"
	| "partially_settled"
	| "settled"
	| "reversed";

export type FeeAssessmentPublicStatus = Exclude<
	FeeAssessmentPersistedStatus,
	"draft"
>;

const EVENT_BY_STATUS: Record<FeeAssessmentPublicStatus, string> = {
	assessed: "ASSESS",
	invoiced: "INVOICE",
	partially_settled: "PARTIALLY_SETTLE",
	reversed: "REVERSE",
	settled: "SETTLE",
};

export async function transitionFeeAssessmentToStatus(
	ctx: MutationCtx,
	args: {
		assessmentId: Id<"feeAssessments">;
		source: CommandSource;
		status: FeeAssessmentPublicStatus;
	}
) {
	const assessment = await ctx.db.get(args.assessmentId);
	if (!assessment) {
		throw new ConvexError(`Fee assessment not found: ${args.assessmentId}`);
	}
	if (assessment.status === args.status) {
		return {
			success: true,
			previousState: assessment.status,
			newState: assessment.status,
		};
	}
	const eventType = EVENT_BY_STATUS[args.status];
	const result = await executeTransition(ctx, {
		entityId: String(args.assessmentId),
		entityType: "feeAssessment",
		eventType,
		source: args.source,
	});
	if (!result.success) {
		throw new ConvexError(
			result.reason ??
				`Fee assessment transition failed: ${assessment.status} -> ${args.status}`
		);
	}
	return result;
}
