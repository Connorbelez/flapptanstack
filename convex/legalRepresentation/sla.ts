import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { adminMutation, adminQuery, convex } from "../fluent";
import { normalizeLegalSourceSnapshot } from "./normalization";
import {
	countActivePlatformLawyerDeals,
	type PlatformLawyerCapacityWarning,
	patchProfileAfterRestrictionOutcome,
} from "./platformLawyers";
import {
	DeterministicLawyerVerificationProvider,
	normalizeLawyerIdentity,
} from "./providers";
import { recordLawyerVerificationRow } from "./verifications";

type SlaMutationCtx = Pick<MutationCtx, "db">;
type SlaQueryCtx = Pick<QueryCtx, "db">;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const DEFAULT_RECHECK_INTERVAL_DAYS = 30;

function assertPositiveHours(reviewHours: number): void {
	if (!Number.isFinite(reviewHours) || reviewHours <= 0) {
		throw new ConvexError("SLA reviewHours must be positive");
	}
}

function capacityWarningLevelForMetrics(
	activeDealCount: number,
	capacityLimit: number
): PlatformLawyerCapacityWarning {
	if (capacityLimit <= 0) {
		return activeDealCount > 0 ? "over_capacity" : "full";
	}
	if (activeDealCount > capacityLimit) {
		return "over_capacity";
	}
	if (activeDealCount === capacityLimit) {
		return "full";
	}
	if (activeDealCount >= Math.max(1, Math.floor(capacityLimit * 0.8))) {
		return "approaching";
	}
	return "none";
}

async function getActiveAssignmentForProfile(
	ctx: SlaQueryCtx,
	lawyerProfileId: Id<"lawyerProfiles">
) {
	return await ctx.db
		.query("platformLawyerAssignments")
		.withIndex("by_lawyer_profile", (q) =>
			q.eq("lawyerProfileId", lawyerProfileId)
		)
		.unique();
}

async function createEscalationOnce(
	ctx: SlaMutationCtx,
	args: {
		readonly createdAt: number;
		readonly createdBy: string;
		readonly dealId?: Id<"deals">;
		readonly idempotencyKey: string;
		readonly kind: "active_deal_review" | "restriction_recheck" | "sla_breach";
		readonly lawyerProfileId: Id<"lawyerProfiles">;
		readonly message: string;
		readonly metadata?: Record<string, string>;
	}
): Promise<Id<"platformLawyerEscalations">> {
	const existing = await ctx.db
		.query("platformLawyerEscalations")
		.withIndex("by_idempotency", (q) =>
			q.eq("idempotencyKey", args.idempotencyKey)
		)
		.unique();
	if (existing) {
		return existing._id;
	}
	return await ctx.db.insert("platformLawyerEscalations", {
		lawyerProfileId: args.lawyerProfileId,
		dealId: args.dealId,
		kind: args.kind,
		status: "open",
		idempotencyKey: args.idempotencyKey,
		message: args.message,
		metadata: args.metadata,
		createdAt: args.createdAt,
		createdBy: args.createdBy,
	});
}

export async function ensureSlaReviewForDeal(
	ctx: SlaMutationCtx,
	args: {
		readonly deal: Doc<"deals">;
		readonly now?: number;
	}
): Promise<Id<"platformLawyerSlaReviews"> | null> {
	if (
		args.deal.status !== "documentReview.pending" ||
		args.deal.lawyerType !== "platform_lawyer" ||
		!args.deal.lawyerId
	) {
		return null;
	}
	const profile = await ctx.db
		.query("lawyerProfiles")
		.withIndex("by_auth_id", (q) => q.eq("authId", args.deal.lawyerId))
		.unique();
	if (!profile || profile.platformStatus !== "active") {
		return null;
	}
	const assignment = await getActiveAssignmentForProfile(ctx, profile._id);
	if (!assignment?.slaTierId) {
		return null;
	}
	const tier = await ctx.db.get(assignment.slaTierId);
	if (!tier || tier.status !== "active") {
		return null;
	}
	const idempotencyKey = `platform-lawyer-sla:${String(args.deal._id)}:${String(profile._id)}`;
	const existing = await ctx.db
		.query("platformLawyerSlaReviews")
		.withIndex("by_idempotency", (q) => q.eq("idempotencyKey", idempotencyKey))
		.unique();
	if (existing) {
		return existing._id;
	}
	const startedAt = args.deal.lastTransitionAt ?? args.now ?? Date.now();
	const dueAt = startedAt + tier.reviewHours * HOUR_MS;
	return await ctx.db.insert("platformLawyerSlaReviews", {
		lawyerProfileId: profile._id,
		dealId: args.deal._id,
		slaTierId: tier._id,
		status: "active",
		startedAt,
		dueAt,
		idempotencyKey,
		createdAt: args.now ?? Date.now(),
		updatedAt: args.now ?? Date.now(),
	});
}

export async function recalculatePlatformLawyerMetrics(
	ctx: SlaMutationCtx,
	args: {
		readonly lawyerProfileId: Id<"lawyerProfiles">;
		readonly now?: number;
	}
): Promise<Id<"platformLawyerMetrics">> {
	const now = args.now ?? Date.now();
	const profile = await ctx.db.get(args.lawyerProfileId);
	if (!profile?.authId) {
		throw new ConvexError("Lawyer profile authId is required for metrics");
	}
	const assignment = await getActiveAssignmentForProfile(
		ctx,
		args.lawyerProfileId
	);
	const reviews = await ctx.db
		.query("platformLawyerSlaReviews")
		.withIndex("by_lawyer_status_due", (q) =>
			q.eq("lawyerProfileId", args.lawyerProfileId).eq("status", "completed")
		)
		.collect();
	const completedDealCount = reviews.length;
	const compliantCount = reviews.filter(
		(review) =>
			review.completedAt !== undefined && review.completedAt <= review.dueAt
	).length;
	const completedDurations = reviews.flatMap((review) =>
		review.completedAt === undefined
			? []
			: [(review.completedAt - review.startedAt) / HOUR_MS]
	);
	const averageTurnaroundHours =
		completedDurations.length === 0
			? undefined
			: completedDurations.reduce((sum, value) => sum + value, 0) /
				completedDurations.length;
	const activeDealCount = await countActivePlatformLawyerDeals(ctx, {
		lawyerAuthId: profile.authId,
	});
	const breachCount = (
		await ctx.db
			.query("platformLawyerSlaReviews")
			.withIndex("by_lawyer_status_due", (q) =>
				q.eq("lawyerProfileId", args.lawyerProfileId).eq("status", "breached")
			)
			.collect()
	).length;
	const capacityLimit = assignment?.capacityLimit ?? 3;
	const capacityWarningLevel = capacityWarningLevelForMetrics(
		activeDealCount,
		capacityLimit
	);
	const existing = await ctx.db
		.query("platformLawyerMetrics")
		.withIndex("by_lawyer_profile", (q) =>
			q.eq("lawyerProfileId", args.lawyerProfileId)
		)
		.unique();
	const metric = {
		lawyerProfileId: args.lawyerProfileId,
		activeDealCount,
		completedDealCount,
		averageTurnaroundHours,
		slaComplianceRate:
			completedDealCount === 0
				? undefined
				: compliantCount / completedDealCount,
		breachCount,
		capacityLimit,
		capacityWarningLevel,
		calculatedAt: now,
	};
	if (existing) {
		await ctx.db.patch(existing._id, metric);
		return existing._id;
	}
	return await ctx.db.insert("platformLawyerMetrics", metric);
}

export const upsertSlaTier = adminMutation
	.input({
		tierId: v.optional(v.id("platformLawyerSlaTiers")),
		name: v.string(),
		description: v.optional(v.string()),
		reviewHours: v.number(),
		status: v.union(v.literal("active"), v.literal("inactive")),
	})
	.handler(async (ctx, args) => {
		assertPositiveHours(args.reviewHours);
		const now = Date.now();
		if (args.tierId) {
			await ctx.db.patch(args.tierId, {
				name: args.name,
				description: args.description,
				reviewHours: args.reviewHours,
				status: args.status,
				updatedAt: now,
				updatedBy: ctx.viewer.authId,
			});
			return args.tierId;
		}
		return await ctx.db.insert("platformLawyerSlaTiers", {
			name: args.name,
			description: args.description,
			reviewHours: args.reviewHours,
			status: args.status,
			createdAt: now,
			createdBy: ctx.viewer.authId,
			updatedAt: now,
			updatedBy: ctx.viewer.authId,
		});
	})
	.public();

export const listSlaTiers = adminQuery
	.input({})
	.handler(
		async (ctx) =>
			await ctx.db.query("platformLawyerSlaTiers").order("desc").collect()
	)
	.public();

export const ensureSlaReviewsForPendingDeals = convex
	.mutation()
	.input({ now: v.optional(v.number()), limit: v.optional(v.number()) })
	.handler(async (ctx, args) => {
		const limit = Math.min(args.limit ?? 50, 100);
		const deals = await ctx.db
			.query("deals")
			.withIndex("by_status", (q) => q.eq("status", "documentReview.pending"))
			.take(limit);
		let created = 0;
		for (const deal of deals) {
			const reviewId = await ensureSlaReviewForDeal(ctx, {
				deal,
				now: args.now,
			});
			if (reviewId) {
				created++;
			}
		}
		return { checked: deals.length, created };
	})
	.internal();

export const checkSlaBreaches = convex
	.mutation()
	.input({ now: v.optional(v.number()), limit: v.optional(v.number()) })
	.handler(async (ctx, args) => {
		const now = args.now ?? Date.now();
		const reviews = await ctx.db
			.query("platformLawyerSlaReviews")
			.withIndex("by_status_due", (q) =>
				q.eq("status", "active").lte("dueAt", now)
			)
			.take(Math.min(args.limit ?? 50, 100));
		for (const review of reviews) {
			await ctx.db.patch(review._id, {
				status: "breached",
				breachedAt: now,
				updatedAt: now,
			});
			await createEscalationOnce(ctx, {
				lawyerProfileId: review.lawyerProfileId,
				dealId: review.dealId,
				kind: "sla_breach",
				idempotencyKey: `platform-lawyer-sla-breach:${String(review._id)}`,
				message: "Platform lawyer SLA review is overdue.",
				metadata: {
					reviewId: String(review._id),
					dueAt: String(review.dueAt),
				},
				createdAt: now,
				createdBy: "system:platform-lawyer-sla",
			});
			await recalculatePlatformLawyerMetrics(ctx, {
				lawyerProfileId: review.lawyerProfileId,
				now,
			});
		}
		return { breached: reviews.length };
	})
	.internal();

export const runPeriodicRestrictionRechecks = convex
	.mutation()
	.input({ now: v.optional(v.number()), limit: v.optional(v.number()) })
	.handler(async (ctx, args) => {
		const now = args.now ?? Date.now();
		const due = await ctx.db
			.query("platformLawyerAssignments")
			.withIndex("by_next_recheck", (q) =>
				q.lte("nextRestrictionRecheckAt", now)
			)
			.take(Math.min(args.limit ?? 25, 100));
		const provider = new DeterministicLawyerVerificationProvider("test");
		let checked = 0;
		for (const assignment of due) {
			const profile = await ctx.db.get(assignment.lawyerProfileId);
			if (!profile || profile.platformStatus === "offboarded") {
				continue;
			}
			const idempotencyKey = `platform-lawyer-recheck:${String(profile._id)}:${String(assignment.nextRestrictionRecheckAt)}`;
			const existing = await ctx.db
				.query("platformLawyerRestrictionRechecks")
				.withIndex("by_idempotency", (q) =>
					q.eq("idempotencyKey", idempotencyKey)
				)
				.unique();
			if (existing?.status === "completed") {
				continue;
			}
			const recheckId =
				existing?._id ??
				(await ctx.db.insert("platformLawyerRestrictionRechecks", {
					lawyerProfileId: profile._id,
					status: "pending",
					idempotencyKey,
					startedAt: now,
				}));
			const lso = profile.barNumber
				? await ctx.db
						.query("lsoLawyers")
						.withIndex("by_bar_jurisdiction", (q) =>
							q
								.eq("barNumber", profile.barNumber ?? "")
								.eq("jurisdiction", profile.jurisdiction ?? "")
						)
						.unique()
				: null;
			const result = await provider.verify({
				checkType: "platform_periodic",
				identity: normalizeLawyerIdentity({
					authId: profile.authId,
					displayName: profile.displayName,
					email: profile.email,
					barNumber: profile.barNumber,
					jurisdiction: profile.jurisdiction,
				}),
				lsoReference: lso
					? {
							barNumber: lso.barNumber,
							displayName: lso.displayName,
							jurisdiction: lso.jurisdiction,
							licensingStatus: lso.licensingStatus,
							lsoLawyerId: lso._id,
							restrictionStatus: lso.restrictionStatus,
							restrictionSummary: lso.restrictionSummary,
							source: lso.source,
							sourceSnapshot: lso.sourceSnapshot,
						}
					: undefined,
				requestedAt: now,
				requestedBy: "system:platform-lawyer-recheck",
			});
			const verificationId = await recordLawyerVerificationRow(ctx, {
				authId: profile.authId,
				barNumber: profile.barNumber,
				checkType: "platform_periodic",
				createdAt: now,
				createdBy: "system:platform-lawyer-recheck",
				jurisdiction: profile.jurisdiction,
				lawyerProfileId: profile._id,
				lsoLawyerId: lso?._id,
				normalizedEmail: profile.email,
				providerResult: {
					...result,
					sourceSnapshot: normalizeLegalSourceSnapshot({
						...result.sourceSnapshot,
						idempotencyKey,
					}),
				},
			});
			await patchProfileAfterRestrictionOutcome(ctx, {
				lawyerProfileId: profile._id,
				outcome: result.outcome,
				now,
			});
			await ctx.db.patch(recheckId, {
				status: "completed",
				verificationId,
				completedAt: now,
			});
			await ctx.db.patch(assignment._id, {
				lastRestrictionRecheckAt: now,
				nextRestrictionRecheckAt:
					now +
					(assignment.recheckIntervalDays || DEFAULT_RECHECK_INTERVAL_DAYS) *
						DAY_MS,
				updatedAt: now,
				updatedBy: "system:platform-lawyer-recheck",
			});
			if (result.outcome !== "eligible") {
				await createEscalationOnce(ctx, {
					lawyerProfileId: profile._id,
					kind: "restriction_recheck",
					idempotencyKey: `platform-lawyer-recheck-escalation:${String(recheckId)}`,
					message: "Platform lawyer restriction recheck requires review.",
					metadata: {
						outcome: result.outcome,
						verificationId: String(verificationId),
					},
					createdAt: now,
					createdBy: "system:platform-lawyer-recheck",
				});
				const activeDeals = await ctx.db
					.query("deals")
					.withIndex("by_lawyer", (q) => q.eq("lawyerId", profile.authId ?? ""))
					.collect();
				for (const deal of activeDeals) {
					await createEscalationOnce(ctx, {
						lawyerProfileId: profile._id,
						dealId: deal._id,
						kind: "active_deal_review",
						idempotencyKey: `platform-lawyer-active-deal-review:${String(recheckId)}:${String(deal._id)}`,
						message:
							"Active deal has a platform lawyer with a non-eligible restriction recheck.",
						createdAt: now,
						createdBy: "system:platform-lawyer-recheck",
					});
				}
			}
			checked++;
		}
		return { checked };
	})
	.internal();
