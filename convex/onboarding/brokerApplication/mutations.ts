import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { auditLog } from "../../auditLog";
import { appendAuditJournalEntry } from "../../engine/auditJournal";
import { buildSource } from "../../engine/commands";
import { INITIAL_BROKER_ONBOARDING_APPLICATION_MACHINE_CONTEXT } from "../../engine/machines/brokerOnboardingApplication.machine";
import { executeTransition } from "../../engine/transition";
import { authedMutation, requirePermission } from "../../fluent";
import { referralSourceValidator } from "../validators";
import {
	appendBrokerOnboardingReviewEntry,
	assertViewerCanAccessBrokerApplication,
	type BrokerOnboardingApplicationDoc,
	buildBrokerOnboardingApplicationReadModel,
	buildResumeWindowPatch,
	getViewerUserOrThrow,
	isBrokerOnboardingApplicationExpired,
	isBrokerOnboardingResumeWindowStatus,
	isBrokerOnboardingTerminalStatus,
	listCandidateBrokerApplications,
	mergeBrokerOnboardingDraftData,
	mergeBrokerOnboardingMachineContext,
	resolveBrokerOnboardingPortalId,
	resolveReopenedFieldsForResubmission,
	selectResumableBrokerApplication,
} from "./helpers";
import { brokerOnboardingDraftDataValidator } from "./validators";

const brokerOnboardingMutation = authedMutation.use(
	requirePermission("onboarding:access")
);

async function getFreshReadModel(
	ctx: Pick<MutationCtx, "db">,
	applicationId: Id<"brokerOnboardingApplications">,
	now: number
) {
	const application = await ctx.db.get(applicationId);
	if (!application) {
		throw new ConvexError("Broker onboarding application not found");
	}

	return buildBrokerOnboardingApplicationReadModel(ctx, application, now);
}

async function expireStaleBrokerApplications(
	ctx: Pick<MutationCtx, "db">,
	applications: readonly BrokerOnboardingApplicationDoc[],
	now: number
) {
	for (const application of applications) {
		if (
			application.expiredAt ||
			!isBrokerOnboardingApplicationExpired(application, now)
		) {
			continue;
		}

		await ctx.db.patch(application._id, {
			expiredAt: now,
			updatedAt: now,
		});
		await appendBrokerOnboardingReviewEntry(ctx, {
			applicationId: application._id,
			body: "Resume window expired after 30 days of inactivity.",
			createdAt: now,
			entryType: "system_event",
			systemEventType: "resume_window_expired",
		});
	}
}

export const startOrResume = brokerOnboardingMutation
	.input({
		invitedByBrokerId: v.optional(v.string()),
		portalId: v.optional(v.id("portals")),
		referralSource: v.optional(referralSourceValidator),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		const referralSource = args.referralSource ?? "self_signup";
		if (referralSource === "broker_invite" && !args.invitedByBrokerId) {
			throw new ConvexError(
				"broker_invite referral requires invitedByBrokerId"
			);
		}
		const user = await getViewerUserOrThrow(ctx, ctx.viewer.authId);
		const verifiedEmail = ctx.viewer.verifiedEmail;
		const candidates = await listCandidateBrokerApplications(ctx, {
			authUserId: ctx.viewer.authId,
			verifiedEmail,
		});
		const resumableApplication = selectResumableBrokerApplication(
			candidates,
			now
		);

		if (resumableApplication) {
			const patch = isBrokerOnboardingResumeWindowStatus(
				resumableApplication.status
			)
				? buildResumeWindowPatch(now)
				: { lastActivityAt: now, updatedAt: now };
			await ctx.db.patch(resumableApplication._id, {
				...patch,
				...(verifiedEmail &&
				resumableApplication.verifiedEmail !== verifiedEmail
					? { verifiedEmail }
					: {}),
			});
			await auditLog.log(ctx, {
				action: "onboarding.broker_application_resumed",
				actorId: ctx.viewer.authId,
				resourceType: "brokerOnboardingApplications",
				resourceId: resumableApplication._id,
				severity: "info",
				metadata: {
					status: resumableApplication.status,
					verifiedEmailPresent: Boolean(verifiedEmail),
				},
			});
			return getFreshReadModel(ctx, resumableApplication._id, now);
		}

		await expireStaleBrokerApplications(ctx, candidates, now);

		const portalId = await resolveBrokerOnboardingPortalId(ctx, {
			requestedPortalId: args.portalId,
			user,
		});
		const createdAt = now;
		const applicationId = await ctx.db.insert("brokerOnboardingApplications", {
			status: "draft",
			machineContext: INITIAL_BROKER_ONBOARDING_APPLICATION_MACHINE_CONTEXT,
			lastTransitionAt: createdAt,
			userId: user._id,
			authUserId: ctx.viewer.authId,
			verifiedEmail,
			portalId,
			referralSource,
			invitedByBrokerId: args.invitedByBrokerId,
			draftData: {},
			reopenedFields: [],
			startedAt: createdAt,
			lastActivityAt: createdAt,
			expiresAt: createdAt + 30 * 24 * 60 * 60 * 1000,
			downstreamHandoffStatus: "not_started",
			createdAt,
			updatedAt: createdAt,
		});
		const createdApplication = await ctx.db.get(applicationId);
		if (!createdApplication) {
			throw new ConvexError(
				"Broker onboarding application could not be created"
			);
		}

		const journalEntryId = await appendAuditJournalEntry(ctx, {
			actorId: ctx.viewer.authId,
			actorType: "member",
			channel: "onboarding_portal",
			beforeState: { _id: applicationId, status: "none" },
			afterState: {
				...createdApplication,
				_id: applicationId,
			},
			entityId: applicationId,
			entityType: "brokerOnboardingApplication",
			eventCategory: "governed_transition",
			eventType: "CREATED",
			newState: "draft",
			outcome: "transitioned",
			payload: {
				portalId,
				verifiedEmailPresent: Boolean(verifiedEmail),
				referralSource,
				...(args.invitedByBrokerId
					? { invitedByBrokerId: args.invitedByBrokerId }
					: {}),
			},
			previousState: "none",
			timestamp: createdAt,
		});

		await auditLog.log(ctx, {
			action: "transition.brokerOnboardingApplication.created",
			actorId: ctx.viewer.authId,
			resourceType: "brokerOnboardingApplications",
			resourceId: applicationId,
			severity: "info",
			metadata: {
				entityType: "brokerOnboardingApplication",
				eventType: "CREATED",
				journalEntryId,
				newState: "draft",
				outcome: "transitioned",
				portalId,
				previousState: "none",
				verifiedEmailPresent: Boolean(verifiedEmail),
				referralSource,
				...(args.invitedByBrokerId
					? { invitedByBrokerId: args.invitedByBrokerId }
					: {}),
			},
		});

		return buildBrokerOnboardingApplicationReadModel(
			ctx,
			createdApplication,
			now
		);
	})
	.public();

export const saveDraft = brokerOnboardingMutation
	.input({
		applicationId: v.id("brokerOnboardingApplications"),
		currentStep: v.optional(v.string()),
		draftData: brokerOnboardingDraftDataValidator,
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		const application = await ctx.db.get(args.applicationId);
		if (!application) {
			throw new ConvexError("Broker onboarding application not found");
		}

		const verifiedEmail = ctx.viewer.verifiedEmail;
		assertViewerCanAccessBrokerApplication(application, {
			authUserId: ctx.viewer.authId,
			verifiedEmail,
		});

		if (
			!(
				application.status === "draft" ||
				application.status === "changes_requested"
			)
		) {
			throw new ConvexError(
				"Only draft or changes-requested applications can be edited"
			);
		}
		if (isBrokerOnboardingApplicationExpired(application, now)) {
			throw new ConvexError("Broker onboarding application has expired");
		}

		await ctx.db.patch(args.applicationId, {
			draftData: mergeBrokerOnboardingDraftData(
				application.draftData,
				args.draftData
			),
			machineContext: mergeBrokerOnboardingMachineContext(
				application.machineContext,
				{
					currentStep:
						args.currentStep ?? application.machineContext.currentStep,
					draftLastSavedAt: now,
				}
			),
			...buildResumeWindowPatch(now),
			...(verifiedEmail && application.verifiedEmail !== verifiedEmail
				? { verifiedEmail }
				: {}),
		});

		await auditLog.log(ctx, {
			action: "onboarding.broker_application_draft_saved",
			actorId: ctx.viewer.authId,
			resourceType: "brokerOnboardingApplications",
			resourceId: args.applicationId,
			severity: "info",
			metadata: {
				currentStep: args.currentStep ?? application.machineContext.currentStep,
			},
		});

		return getFreshReadModel(ctx, args.applicationId, now);
	})
	.public();

export const appendBrokerNote = brokerOnboardingMutation
	.input({
		applicationId: v.id("brokerOnboardingApplications"),
		body: v.string(),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		const application = await ctx.db.get(args.applicationId);
		if (!application) {
			throw new ConvexError("Broker onboarding application not found");
		}

		const verifiedEmail = ctx.viewer.verifiedEmail;
		assertViewerCanAccessBrokerApplication(application, {
			authUserId: ctx.viewer.authId,
			verifiedEmail,
		});
		if (isBrokerOnboardingTerminalStatus(application.status)) {
			throw new ConvexError(
				"Broker notes are not accepted for terminal applications"
			);
		}
		if (isBrokerOnboardingApplicationExpired(application, now)) {
			throw new ConvexError("Broker onboarding application has expired");
		}

		const body = args.body.trim();
		if (!body) {
			throw new ConvexError("Broker note body cannot be empty");
		}

		const source = buildSource(ctx.viewer, "onboarding_portal");
		await appendBrokerOnboardingReviewEntry(ctx, {
			applicationId: args.applicationId,
			body,
			authorAuthId: ctx.viewer.authId,
			authorType: source.actorType,
			createdAt: now,
			entryType: "broker_note",
		});
		await ctx.db.patch(args.applicationId, {
			lastActivityAt: now,
			updatedAt: now,
			...(isBrokerOnboardingResumeWindowStatus(application.status)
				? { expiresAt: now + 30 * 24 * 60 * 60 * 1000 }
				: {}),
		});
		await auditLog.log(ctx, {
			action: "onboarding.broker_application_note_added",
			actorId: ctx.viewer.authId,
			resourceType: "brokerOnboardingApplications",
			resourceId: args.applicationId,
			severity: "info",
			metadata: {
				entryType: "broker_note",
			},
		});

		return getFreshReadModel(ctx, args.applicationId, now);
	})
	.public();

export const submit = brokerOnboardingMutation
	.input({
		applicationId: v.id("brokerOnboardingApplications"),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		const application = await ctx.db.get(args.applicationId);
		if (!application) {
			throw new ConvexError("Broker onboarding application not found");
		}

		const verifiedEmail = ctx.viewer.verifiedEmail;
		assertViewerCanAccessBrokerApplication(application, {
			authUserId: ctx.viewer.authId,
			verifiedEmail,
		});

		if (
			!(
				application.status === "draft" ||
				application.status === "changes_requested"
			)
		) {
			throw new ConvexError(
				"Only draft or changes-requested applications can be submitted"
			);
		}
		if (isBrokerOnboardingApplicationExpired(application, now)) {
			throw new ConvexError("Broker onboarding application has expired");
		}

		const result = await executeTransition(ctx, {
			entityType: "brokerOnboardingApplication",
			entityId: args.applicationId,
			eventType: "SUBMIT",
			payload: { submittedAt: now },
			source: buildSource(ctx.viewer, "onboarding_portal"),
		});
		if (!result.success) {
			throw new ConvexError(
				result.reason ?? "Broker onboarding submit transition failed"
			);
		}

		await ctx.db.patch(args.applicationId, {
			submittedAt: now,
			reopenedFields:
				application.status === "changes_requested"
					? resolveReopenedFieldsForResubmission(application.reopenedFields, {
							resolvedAt: now,
							resolvedByAuthId: ctx.viewer.authId,
						})
					: application.reopenedFields,
			...buildResumeWindowPatch(now),
			...(verifiedEmail && application.verifiedEmail !== verifiedEmail
				? { verifiedEmail }
				: {}),
		});

		await appendBrokerOnboardingReviewEntry(ctx, {
			applicationId: args.applicationId,
			body: "Application submitted for review.",
			createdAt: now,
			entryType: "system_event",
			systemEventType: "application_submitted",
			metadata: {
				previousState: result.previousState,
			},
		});
		await ctx.scheduler.runAfter(
			0,
			internal.onboarding.verification.actions
				.recomputeBrokerOnboardingVerificationInternal,
			{
				applicationId: args.applicationId,
				authorAuthId: ctx.viewer.authId,
				authorType: "member",
				trigger: "submit",
			}
		);

		return getFreshReadModel(ctx, args.applicationId, now);
	})
	.public();
