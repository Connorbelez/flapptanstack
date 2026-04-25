import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import { internalAction } from "../../_generated/server";

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;
const MAX_WAVES_PER_RUN = 500;

function clampBatchSize(batchSize: number | undefined) {
	return Math.max(1, Math.min(batchSize ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE));
}

function buildSchedulerExecutionIdempotencyKey(planEntryId: string) {
	return `collection-plan-runner:${planEntryId}`;
}

interface DuePlanEntriesSummary {
	alreadyExecutedCount: number;
	attemptCreatedCount: number;
	attemptedCount: number;
	batchSize: number;
	drainedAllEligibleWork: boolean;
	handoffFailureCount: number;
	maxWavesReached: boolean;
	noopCount: number;
	notEligibleCount: number;
	rejectedCount: number;
	remainingEligibleCount: number;
	requestedAt: number;
	selectedCount: number;
	wavesRun: number;
}

export const processDuePlanEntries = internalAction({
	args: {
		asOf: v.optional(v.number()),
		batchSize: v.optional(v.number()),
		mortgageId: v.optional(v.id("mortgages")),
	},
	handler: async (ctx, args): Promise<DuePlanEntriesSummary> => {
		const requestedAt = args.asOf ?? Date.now();
		const batchSize = clampBatchSize(args.batchSize);

		const summary: DuePlanEntriesSummary = {
			requestedAt,
			batchSize,
			selectedCount: 0,
			attemptedCount: 0,
			attemptCreatedCount: 0,
			alreadyExecutedCount: 0,
			notEligibleCount: 0,
			rejectedCount: 0,
			noopCount: 0,
			handoffFailureCount: 0,
			wavesRun: 0,
			drainedAllEligibleWork: true,
			remainingEligibleCount: 0,
			maxWavesReached: false,
		};

		let sawExecutionError = false;

		while (summary.wavesRun < MAX_WAVES_PER_RUN) {
			const dueEntries: Doc<"collectionPlanEntries">[] = await ctx.runQuery(
				internal.payments.collectionPlan.queries.getDuePlannedEntries,
				{
					asOf: requestedAt,
					limit: batchSize,
					mortgageId: args.mortgageId,
				}
			);
			if (dueEntries.length === 0) {
				break;
			}

			summary.wavesRun += 1;
			summary.selectedCount += dueEntries.length;

			for (const entry of dueEntries) {
				summary.attemptedCount += 1;

				try {
					const result = await ctx.runAction(
						internal.payments.collectionPlan.execution.executePlanEntry,
						{
							planEntryId: entry._id,
							triggerSource: "system_scheduler",
							requestedAt,
							idempotencyKey: buildSchedulerExecutionIdempotencyKey(
								`${entry._id}`
							),
							requestedByActorType: "system",
							requestedByActorId: "collection-plan-runner",
						}
					);

					switch (result.outcome) {
						case "attempt_created":
							summary.attemptCreatedCount += 1;
							if (result.reasonCode === "transfer_handoff_failed") {
								summary.handoffFailureCount += 1;
							}
							break;
						case "already_executed":
							summary.alreadyExecutedCount += 1;
							break;
						case "not_eligible":
							summary.notEligibleCount += 1;
							break;
						case "rejected":
							summary.rejectedCount += 1;
							break;
						case "noop":
							summary.noopCount += 1;
							break;
						default:
							break;
					}
				} catch (error) {
					sawExecutionError = true;
					console.error(
						"[collection-plan-runner] failed to execute due plan entry",
						{
							error,
							planEntryId: `${entry._id}`,
						}
					);
				}
			}

			if (dueEntries.length < batchSize) {
				break;
			}
		}

		if (summary.wavesRun >= MAX_WAVES_PER_RUN || sawExecutionError) {
			summary.remainingEligibleCount = await ctx.runQuery(
				internal.payments.collectionPlan.queries.countDuePlannedEntries,
				{
					asOf: requestedAt,
					mortgageId: args.mortgageId,
				}
			);
			summary.maxWavesReached =
				summary.wavesRun >= MAX_WAVES_PER_RUN &&
				summary.remainingEligibleCount > 0;
			summary.drainedAllEligibleWork =
				!sawExecutionError && summary.remainingEligibleCount === 0;
		} else {
			summary.drainedAllEligibleWork = true;
			summary.remainingEligibleCount = 0;
		}

		console.info(
			"[collection-plan-runner] processed due plan entries",
			summary
		);
		return summary;
	},
});
