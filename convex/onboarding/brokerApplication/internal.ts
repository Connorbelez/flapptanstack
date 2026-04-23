import { ConvexError, v } from "convex/values";
import { auditLog } from "../../auditLog";
import { executeTransition } from "../../engine/transition";
import { actorTypeValidator } from "../../engine/validators";
import { convex } from "../../fluent";
import {
	appendBrokerOnboardingReviewEntry,
	assertPortalActiveAndPublished,
	buildBrokerOnboardingApplicationReadModel,
	buildResumeWindowPatch,
	isBrokerOnboardingApplicationExpired,
	isBrokerOnboardingResumeWindowStatus,
	isBrokerOnboardingTerminalStatus,
} from "./helpers";
import { brokerOnboardingVerificationSnapshotValidator } from "./validators";

function resolveAuthor(args: {
	authorAuthId?: string;
	authorType?: "borrower" | "broker" | "member" | "admin" | "system";
}) {
	return {
		authorAuthId: args.authorAuthId,
		authorType: args.authorType ?? "system",
	};
}

export const getApplicationById = convex
	.query()
	.input({
		applicationId: v.id("brokerOnboardingApplications"),
	})
	.handler(async (ctx, args) => {
		return ctx.db.get(args.applicationId);
	})
	.internal();

export const getApplicationByDownstreamOnboardingRequestId = convex
	.query()
	.input({
		onboardingRequestId: v.id("onboardingRequests"),
	})
	.handler(async (ctx, args) => {
		return ctx.db
			.query("brokerOnboardingApplications")
			.withIndex("by_downstream_onboarding_request", (query) =>
				query.eq("downstreamOnboardingRequestId", args.onboardingRequestId)
			)
			.unique();
	})
	.internal();

export const upsertVerificationSnapshot = convex
	.mutation()
	.input({
		applicationId: v.id("brokerOnboardingApplications"),
		authorAuthId: v.optional(v.string()),
		authorType: v.optional(actorTypeValidator),
		snapshot: brokerOnboardingVerificationSnapshotValidator,
	})
	.handler(async (ctx, args) => {
		const application = await ctx.db.get(args.applicationId);
		if (!application) {
			throw new ConvexError("Broker onboarding application not found");
		}
		if (isBrokerOnboardingTerminalStatus(application.status)) {
			throw new ConvexError(
				"Verification snapshots cannot be updated for terminal applications"
			);
		}

		const now = Date.now();
		await ctx.db.patch(args.applicationId, {
			verificationSnapshot: args.snapshot,
			verificationRecommendation: args.snapshot.recommendation,
			verificationReasonCodes: args.snapshot.reasonCodes,
			lastActivityAt: now,
			updatedAt: now,
			...(isBrokerOnboardingResumeWindowStatus(application.status)
				? { expiresAt: now + 30 * 24 * 60 * 60 * 1000 }
				: {}),
		});
		await appendBrokerOnboardingReviewEntry(ctx, {
			applicationId: args.applicationId,
			body: "Verification snapshot updated.",
			createdAt: now,
			entryType: "system_event",
			systemEventType: "verification_snapshot_updated",
			metadata: {
				reasonCodes: args.snapshot.reasonCodes,
				recommendation: args.snapshot.recommendation,
			},
			...resolveAuthor(args),
		});
		await auditLog.log(ctx, {
			action: "onboarding.broker_application_verification_snapshot_upserted",
			actorId: args.authorAuthId ?? "system",
			resourceType: "brokerOnboardingApplications",
			resourceId: args.applicationId,
			severity: "info",
			metadata: {
				recommendation: args.snapshot.recommendation,
				reasonCodes: args.snapshot.reasonCodes,
			},
		});
		const freshApplication = await ctx.db.get(args.applicationId);
		if (!freshApplication) {
			throw new ConvexError("Broker onboarding application not found");
		}
		return buildBrokerOnboardingApplicationReadModel(
			ctx,
			freshApplication,
			now
		);
	})
	.internal();

export const requestChanges = convex
	.mutation()
	.input({
		applicationId: v.id("brokerOnboardingApplications"),
		authorAuthId: v.optional(v.string()),
		authorType: v.optional(actorTypeValidator),
		body: v.string(),
		reopenedFields: v.array(
			v.object({
				fieldPath: v.string(),
				reason: v.optional(v.string()),
			})
		),
	})
	.handler(async (ctx, args) => {
		const application = await ctx.db.get(args.applicationId);
		if (!application) {
			throw new ConvexError("Broker onboarding application not found");
		}
		if (application.status !== "submitted") {
			throw new ConvexError(
				"Only submitted applications can transition to changes requested"
			);
		}
		if (isBrokerOnboardingApplicationExpired(application, Date.now())) {
			throw new ConvexError("Broker onboarding application has expired");
		}

		const now = Date.now();
		const result = await executeTransition(ctx, {
			entityType: "brokerOnboardingApplication",
			entityId: args.applicationId,
			eventType: "REQUEST_CHANGES",
			payload: { requestedAt: now },
			source: {
				actorId: args.authorAuthId,
				actorType: args.authorType ?? "system",
				channel: "admin_dashboard",
			},
		});
		if (!result.success) {
			throw new ConvexError(
				result.reason ?? "Broker onboarding request-changes transition failed"
			);
		}

		await ctx.db.patch(args.applicationId, {
			changesRequestedAt: now,
			reopenedFields: args.reopenedFields.map((reopenedField) => ({
				fieldPath: reopenedField.fieldPath,
				reason: reopenedField.reason,
				requestedAt: now,
				requestedByAuthId: args.authorAuthId,
				status: "open",
			})),
			...buildResumeWindowPatch(now),
		});
		await appendBrokerOnboardingReviewEntry(ctx, {
			applicationId: args.applicationId,
			body: args.body.trim() || "Changes requested.",
			createdAt: now,
			entryType: "reviewer_note",
			reopenedFields: args.reopenedFields.map((reopenedField) => ({
				fieldPath: reopenedField.fieldPath,
				reason: reopenedField.reason,
				requestedAt: now,
				requestedByAuthId: args.authorAuthId,
				status: "open",
			})),
			...resolveAuthor(args),
		});
		const freshApplication = await ctx.db.get(args.applicationId);
		if (!freshApplication) {
			throw new ConvexError("Broker onboarding application not found");
		}
		return buildBrokerOnboardingApplicationReadModel(
			ctx,
			freshApplication,
			now
		);
	})
	.internal();

export const approveApplication = convex
	.mutation()
	.input({
		applicationId: v.id("brokerOnboardingApplications"),
		authorAuthId: v.optional(v.string()),
		authorType: v.optional(actorTypeValidator),
	})
	.handler(async (ctx, args) => {
		const application = await ctx.db.get(args.applicationId);
		if (!application) {
			throw new ConvexError("Broker onboarding application not found");
		}
		if (application.status !== "submitted") {
			throw new ConvexError(
				"Only submitted applications can transition to approved"
			);
		}

		const now = Date.now();
		const result = await executeTransition(ctx, {
			entityType: "brokerOnboardingApplication",
			entityId: args.applicationId,
			eventType: "APPROVE",
			payload: { approvedAt: now },
			source: {
				actorId: args.authorAuthId,
				actorType: args.authorType ?? "system",
				channel: "admin_dashboard",
			},
		});
		if (!result.success) {
			throw new ConvexError(
				result.reason ?? "Broker onboarding approve transition failed"
			);
		}

		await ctx.db.patch(args.applicationId, {
			approvedAt: now,
			lastActivityAt: now,
			updatedAt: now,
		});
		await appendBrokerOnboardingReviewEntry(ctx, {
			applicationId: args.applicationId,
			body: "Application approved for downstream provisioning handoff.",
			createdAt: now,
			entryType: "system_event",
			systemEventType: "application_approved",
			...resolveAuthor(args),
		});
		const freshApplication = await ctx.db.get(args.applicationId);
		if (!freshApplication) {
			throw new ConvexError("Broker onboarding application not found");
		}
		return buildBrokerOnboardingApplicationReadModel(
			ctx,
			freshApplication,
			now
		);
	})
	.internal();

export const rejectApplication = convex
	.mutation()
	.input({
		applicationId: v.id("brokerOnboardingApplications"),
		authorAuthId: v.optional(v.string()),
		authorType: v.optional(actorTypeValidator),
		body: v.string(),
	})
	.handler(async (ctx, args) => {
		const application = await ctx.db.get(args.applicationId);
		if (!application) {
			throw new ConvexError("Broker onboarding application not found");
		}
		if (
			!(
				application.status === "submitted" ||
				application.status === "changes_requested"
			)
		) {
			throw new ConvexError(
				"Only submitted or changes-requested applications can be rejected"
			);
		}

		const body = args.body.trim();
		if (!body) {
			throw new ConvexError("Rejection note cannot be empty");
		}

		const now = Date.now();
		const result = await executeTransition(ctx, {
			entityType: "brokerOnboardingApplication",
			entityId: args.applicationId,
			eventType: "REJECT",
			payload: { rejectedAt: now },
			source: {
				actorId: args.authorAuthId,
				actorType: args.authorType ?? "system",
				channel: "admin_dashboard",
			},
		});
		if (!result.success) {
			throw new ConvexError(
				result.reason ?? "Broker onboarding reject transition failed"
			);
		}

		await ctx.db.patch(args.applicationId, {
			rejectedAt: now,
			lastActivityAt: now,
			updatedAt: now,
		});
		await appendBrokerOnboardingReviewEntry(ctx, {
			applicationId: args.applicationId,
			body,
			createdAt: now,
			entryType: "reviewer_note",
			...resolveAuthor(args),
		});
		const freshApplication = await ctx.db.get(args.applicationId);
		if (!freshApplication) {
			throw new ConvexError("Broker onboarding application not found");
		}
		return buildBrokerOnboardingApplicationReadModel(
			ctx,
			freshApplication,
			now
		);
	})
	.internal();

export const linkDownstreamOnboardingRequest = convex
	.mutation()
	.input({
		applicationId: v.id("brokerOnboardingApplications"),
		authorAuthId: v.optional(v.string()),
		authorType: v.optional(actorTypeValidator),
		onboardingRequestId: v.id("onboardingRequests"),
	})
	.handler(async (ctx, args) => {
		const application = await ctx.db.get(args.applicationId);
		if (!application) {
			throw new ConvexError("Broker onboarding application not found");
		}
		const now = Date.now();
		if (
			application.status === "activated" ||
			application.downstreamHandoffStatus === "activated"
		) {
			if (
				application.downstreamOnboardingRequestId !== args.onboardingRequestId
			) {
				throw new ConvexError(
					"Activated broker onboarding application is already linked to a different onboarding request"
				);
			}
			return buildBrokerOnboardingApplicationReadModel(ctx, application, now);
		}
		if (application.status !== "approved") {
			throw new ConvexError(
				"Only approved applications can link a downstream onboarding request"
			);
		}

		const downstreamRequest = await ctx.db.get(args.onboardingRequestId);
		if (!downstreamRequest) {
			throw new ConvexError("Downstream onboarding request not found");
		}
		if (downstreamRequest.requestedRole !== "broker") {
			throw new ConvexError(
				"Broker onboarding applications must link to broker onboarding requests"
			);
		}
		if (downstreamRequest.userId !== application.userId) {
			throw new ConvexError(
				"Downstream onboarding request does not belong to the same user"
			);
		}
		if (
			downstreamRequest.brokerOnboardingApplicationId &&
			downstreamRequest.brokerOnboardingApplicationId !== args.applicationId
		) {
			throw new ConvexError(
				"Downstream onboarding request is already linked to a different broker application"
			);
		}
		if (
			application.downstreamOnboardingRequestId &&
			application.downstreamOnboardingRequestId !== args.onboardingRequestId
		) {
			throw new ConvexError(
				"Broker onboarding application is already linked to a different onboarding request"
			);
		}
		if (
			downstreamRequest.portalId &&
			downstreamRequest.portalId !== application.portalId
		) {
			throw new ConvexError(
				"Downstream onboarding request portal attribution does not match the broker application"
			);
		}

		await ctx.db.patch(args.onboardingRequestId, {
			brokerOnboardingApplicationId: args.applicationId,
			...(downstreamRequest.portalId ? {} : { portalId: application.portalId }),
		});
		await ctx.db.patch(args.applicationId, {
			downstreamOnboardingRequestId: args.onboardingRequestId,
			downstreamHandoffStatus:
				downstreamRequest.status === "role_assigned"
					? "role_assigned"
					: "linked",
			downstreamLinkedAt: application.downstreamLinkedAt ?? now,
			...(downstreamRequest.status === "role_assigned"
				? { downstreamRoleAssignedAt: now }
				: {}),
			lastActivityAt: now,
			updatedAt: now,
		});
		await appendBrokerOnboardingReviewEntry(ctx, {
			applicationId: args.applicationId,
			body: "Linked downstream onboarding request.",
			createdAt: now,
			entryType: "system_event",
			systemEventType: "downstream_onboarding_request_linked",
			metadata: {
				onboardingRequestId: args.onboardingRequestId,
			},
			...resolveAuthor(args),
		});
		const freshApplication = await ctx.db.get(args.applicationId);
		if (!freshApplication) {
			throw new ConvexError("Broker onboarding application not found");
		}
		return buildBrokerOnboardingApplicationReadModel(
			ctx,
			freshApplication,
			now
		);
	})
	.internal();

export const markDownstreamRoleAssigned = convex
	.mutation()
	.input({
		applicationId: v.id("brokerOnboardingApplications"),
		authorAuthId: v.optional(v.string()),
		authorType: v.optional(actorTypeValidator),
	})
	.handler(async (ctx, args) => {
		const application = await ctx.db.get(args.applicationId);
		if (!application) {
			throw new ConvexError("Broker onboarding application not found");
		}
		const now = Date.now();
		if (
			application.status === "activated" ||
			application.downstreamHandoffStatus === "activated"
		) {
			return buildBrokerOnboardingApplicationReadModel(ctx, application, now);
		}
		if (!application.downstreamOnboardingRequestId) {
			throw new ConvexError(
				"Broker onboarding application does not have a linked onboarding request"
			);
		}

		const downstreamRequest = await ctx.db.get(
			application.downstreamOnboardingRequestId
		);
		if (!downstreamRequest) {
			throw new ConvexError("Downstream onboarding request not found");
		}
		if (downstreamRequest.status !== "role_assigned") {
			throw new ConvexError(
				"Downstream onboarding request has not reached role_assigned"
			);
		}

		await ctx.db.patch(args.applicationId, {
			downstreamHandoffStatus: "role_assigned",
			downstreamRoleAssignedAt: now,
			lastActivityAt: now,
			updatedAt: now,
		});
		await appendBrokerOnboardingReviewEntry(ctx, {
			applicationId: args.applicationId,
			body: "Downstream onboarding request reached role_assigned.",
			createdAt: now,
			entryType: "system_event",
			systemEventType: "downstream_role_assigned",
			metadata: {
				onboardingRequestId: application.downstreamOnboardingRequestId,
			},
			...resolveAuthor(args),
		});
		const freshApplication = await ctx.db.get(args.applicationId);
		if (!freshApplication) {
			throw new ConvexError("Broker onboarding application not found");
		}
		return buildBrokerOnboardingApplicationReadModel(
			ctx,
			freshApplication,
			now
		);
	})
	.internal();

export const markActivated = convex
	.mutation()
	.input({
		applicationId: v.id("brokerOnboardingApplications"),
		activatedHomePortalId: v.id("portals"),
		activatedPortalId: v.id("portals"),
		authorAuthId: v.optional(v.string()),
		authorType: v.optional(actorTypeValidator),
	})
	.handler(async (ctx, args) => {
		const application = await ctx.db.get(args.applicationId);
		if (!application) {
			throw new ConvexError("Broker onboarding application not found");
		}
		if (application.status === "activated") {
			return buildBrokerOnboardingApplicationReadModel(
				ctx,
				application,
				Date.now()
			);
		}
		if (application.status !== "approved") {
			throw new ConvexError(
				"Only approved broker onboarding applications can be activated"
			);
		}
		if (!application.downstreamOnboardingRequestId) {
			throw new ConvexError(
				"Broker onboarding application does not have a linked onboarding request"
			);
		}

		const [downstreamRequest, user, activatedPortal, activatedHomePortal] =
			await Promise.all([
				ctx.db.get(application.downstreamOnboardingRequestId),
				ctx.db.get(application.userId),
				ctx.db.get(args.activatedPortalId),
				ctx.db.get(args.activatedHomePortalId),
			]);
		if (!downstreamRequest) {
			throw new ConvexError("Downstream onboarding request not found");
		}
		if (downstreamRequest.status !== "role_assigned") {
			throw new ConvexError(
				"Broker onboarding application cannot activate before the downstream onboarding request reaches role_assigned"
			);
		}
		if (!user) {
			throw new ConvexError("Broker onboarding user not found");
		}
		const activePortal = assertPortalActiveAndPublished(
			activatedPortal,
			"Activated portal evidence must be active and published"
		);
		const activeHomePortal = assertPortalActiveAndPublished(
			activatedHomePortal,
			"Activated home-portal evidence must be active and published"
		);
		if (args.activatedPortalId !== args.activatedHomePortalId) {
			throw new ConvexError(
				"Activated portal must match the synchronized home portal"
			);
		}
		if (user.homePortalId !== args.activatedHomePortalId) {
			throw new ConvexError(
				"User home portal has not been synchronized to the activated portal"
			);
		}
		if (
			activePortal._id !== args.activatedPortalId ||
			activeHomePortal._id !== args.activatedHomePortalId
		) {
			throw new ConvexError("Activated portal evidence is inconsistent");
		}

		const now = Date.now();
		const result = await executeTransition(ctx, {
			entityType: "brokerOnboardingApplication",
			entityId: args.applicationId,
			eventType: "MARK_ACTIVATED",
			payload: { activatedAt: now },
			source: {
				actorId: args.authorAuthId,
				actorType: args.authorType ?? "system",
				channel: "admin_dashboard",
			},
		});
		if (!result.success) {
			throw new ConvexError(
				result.reason ?? "Broker onboarding activation transition failed"
			);
		}

		await ctx.db.patch(args.applicationId, {
			activatedAt: now,
			activatedPortalId: args.activatedPortalId,
			activatedHomePortalId: args.activatedHomePortalId,
			downstreamActivatedAt: now,
			downstreamHandoffStatus: "activated",
			downstreamRoleAssignedAt: application.downstreamRoleAssignedAt ?? now,
			lastActivityAt: now,
			updatedAt: now,
		});
		await appendBrokerOnboardingReviewEntry(ctx, {
			applicationId: args.applicationId,
			body: "Application activated after downstream provisioning completed.",
			createdAt: now,
			entryType: "system_event",
			systemEventType: "application_activated",
			metadata: {
				activatedHomePortalId: args.activatedHomePortalId,
				activatedPortalId: args.activatedPortalId,
				onboardingRequestId: application.downstreamOnboardingRequestId,
			},
			...resolveAuthor(args),
		});
		const freshApplication = await ctx.db.get(args.applicationId);
		if (!freshApplication) {
			throw new ConvexError("Broker onboarding application not found");
		}
		return buildBrokerOnboardingApplicationReadModel(
			ctx,
			freshApplication,
			now
		);
	})
	.internal();
