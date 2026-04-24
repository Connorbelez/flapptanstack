import { v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import { adminQuery, authedQuery, requirePermission } from "../../fluent";
import {
	buildBrokerOnboardingApplicationReadModel,
	listCandidateBrokerApplications,
	selectMostRecentBrokerApplication,
} from "./helpers";
import { brokerOnboardingReviewQueueViewValidator } from "./validators";

const brokerOnboardingQuery = authedQuery.use(
	requirePermission("onboarding:access")
);
const brokerOnboardingReviewQuery = adminQuery.use(
	requirePermission("onboarding:review")
);

export const getCurrent = brokerOnboardingQuery
	.handler(async (ctx) => {
		const now = Date.now();
		const verifiedEmail = ctx.viewer.verifiedEmail;
		const candidates = await listCandidateBrokerApplications(ctx, {
			authUserId: ctx.viewer.authId,
			verifiedEmail,
		});
		const application = selectMostRecentBrokerApplication(candidates);
		if (!application) {
			return null;
		}

		return buildBrokerOnboardingApplicationReadModel(ctx, application, now);
	})
	.public();

const REVIEW_QUEUE_STATUSES_BY_VIEW = {
	changes_requested: ["changes_requested"],
	recently_updated: [
		"submitted",
		"changes_requested",
		"approved",
		"rejected",
		"activated",
	],
	rejected: ["rejected"],
	submitted: ["submitted"],
} as const satisfies Record<
	string,
	readonly Doc<"brokerOnboardingApplications">["status"][]
>;

function clampQueueLimit(limit: number | undefined) {
	if (limit === undefined) {
		return 50;
	}
	return Math.max(1, Math.min(Math.floor(limit), 100));
}

function buildLatestReviewEntry(
	reviewEntries: readonly Doc<"brokerOnboardingReviewEntries">[]
) {
	const entriesByNewest = [...reviewEntries].sort(
		(left, right) => right.createdAt - left.createdAt
	);
	const latest =
		entriesByNewest.find((entry) => entry.entryType !== "system_event") ??
		entriesByNewest[0];
	return latest
		? {
				authorAuthId: latest.authorAuthId ?? null,
				authorType: latest.authorType ?? null,
				body: latest.body,
				createdAt: latest.createdAt,
				entryType: latest.entryType,
				systemEventType: latest.systemEventType ?? null,
			}
		: null;
}

function buildQueueItem(args: {
	application: Doc<"brokerOnboardingApplications">;
	latestReviewEntry: ReturnType<typeof buildLatestReviewEntry>;
}) {
	const { application } = args;
	const verificationSnapshot = application.verificationSnapshot;
	return {
		applicationId: application._id,
		approvedAt: application.approvedAt ?? null,
		changesRequestedAt: application.changesRequestedAt ?? null,
		createdAt: application.createdAt,
		downstreamHandoffStatus: application.downstreamHandoffStatus,
		downstreamOnboardingRequestId:
			application.downstreamOnboardingRequestId ?? null,
		draftSummary: {
			brokerageName: application.draftData.brokerageName ?? null,
			brokerageNumber: application.draftData.brokerageNumber ?? null,
			licenseNumber: application.draftData.licenseNumber ?? null,
			licenseProvince: application.draftData.licenseProvince ?? null,
			requestedPortalSlug: application.draftData.requestedPortalSlug ?? null,
			selfReportedName: application.draftData.selfReportedName ?? null,
		},
		freshness: verificationSnapshot?.regulator.freshness ?? null,
		identityVerificationStatus:
			verificationSnapshot?.identityVerification.status ?? null,
		latestReviewEntry: args.latestReviewEntry,
		reasonCodes: application.verificationReasonCodes ?? [],
		regulatorStatus: verificationSnapshot?.regulator.status ?? null,
		rejectedAt: application.rejectedAt ?? null,
		requiresReverification:
			application.verificationState?.requiresReverification ?? false,
		status: application.status,
		submittedAt: application.submittedAt ?? null,
		updatedAt: application.updatedAt,
		verifiedEmail: application.verifiedEmail ?? null,
		verificationRecommendation: application.verificationRecommendation ?? null,
	};
}

async function listReviewEntries(
	ctx: Parameters<typeof buildBrokerOnboardingApplicationReadModel>[0],
	applicationId: Doc<"brokerOnboardingApplications">["_id"]
) {
	return ctx.db
		.query("brokerOnboardingReviewEntries")
		.withIndex("by_application_created_at", (query) =>
			query.eq("applicationId", applicationId)
		)
		.collect();
}

async function buildQueueItemWithThread(
	ctx: Parameters<typeof buildBrokerOnboardingApplicationReadModel>[0],
	application: Doc<"brokerOnboardingApplications">
) {
	const reviewEntries = await listReviewEntries(ctx, application._id);
	return buildQueueItem({
		application,
		latestReviewEntry: buildLatestReviewEntry(reviewEntries),
	});
}

async function listReviewQueueApplications(
	ctx: Parameters<typeof buildBrokerOnboardingApplicationReadModel>[0],
	args: {
		limit: number;
		statuses: readonly Doc<"brokerOnboardingApplications">["status"][];
		view: keyof typeof REVIEW_QUEUE_STATUSES_BY_VIEW;
	}
) {
	const applicationsByStatus = await Promise.all(
		args.statuses.map((status) => {
			const query =
				args.view === "recently_updated"
					? ctx.db
							.query("brokerOnboardingApplications")
							.withIndex("by_status_updated_at", (q) => q.eq("status", status))
					: ctx.db
							.query("brokerOnboardingApplications")
							.withIndex("by_status_last_activity_at", (q) =>
								q.eq("status", status)
							);
			return query.order("desc").take(args.limit);
		})
	);

	return applicationsByStatus
		.flat()
		.sort((left, right) => {
			if (args.view === "recently_updated") {
				return right.updatedAt - left.updatedAt;
			}
			return right.lastActivityAt - left.lastActivityAt;
		})
		.slice(0, args.limit);
}

export const listReviewQueue = brokerOnboardingReviewQuery
	.input({
		limit: v.optional(v.number()),
		view: brokerOnboardingReviewQueueViewValidator,
	})
	.handler(async (ctx, args) => {
		const limit = clampQueueLimit(args.limit);
		const statuses = REVIEW_QUEUE_STATUSES_BY_VIEW[args.view];
		const applications = await listReviewQueueApplications(ctx, {
			limit,
			statuses,
			view: args.view,
		});

		return Promise.all(
			applications.map((application) =>
				buildQueueItemWithThread(ctx, application)
			)
		);
	})
	.public();

export const getReviewDossier = brokerOnboardingReviewQuery
	.input({
		applicationId: v.id("brokerOnboardingApplications"),
	})
	.handler(async (ctx, args) => {
		const application = await ctx.db.get(args.applicationId);
		if (!application) {
			return null;
		}

		const now = Date.now();
		const readModel = await buildBrokerOnboardingApplicationReadModel(
			ctx,
			application,
			now
		);
		const auditHistory = await ctx.db
			.query("auditJournal")
			.withIndex("by_entity", (query) =>
				query
					.eq("entityType", "brokerOnboardingApplication")
					.eq("entityId", String(args.applicationId))
			)
			.order("desc")
			.take(50);

		return {
			application: readModel.application,
			auditHistory: auditHistory.map((entry) => ({
				actorId: entry.actorId,
				actorType: entry.actorType ?? null,
				channel: entry.channel,
				eventType: entry.eventType,
				newState: entry.newState,
				outcome: entry.outcome,
				previousState: entry.previousState,
				reason: entry.reason ?? null,
				timestamp: entry.timestamp,
			})),
			canResume: readModel.canResume,
			downstreamOnboardingRequest: readModel.downstreamOnboardingRequest,
			isExpired: readModel.isExpired,
			queueItem: buildQueueItem({
				application: readModel.application,
				latestReviewEntry: buildLatestReviewEntry(readModel.reviewEntries),
			}),
			reviewEntries: readModel.reviewEntries,
		};
	})
	.public();
