import { ConvexError, v } from "convex/values";
import { auditLog } from "../../auditLog";
import { executeTransition } from "../../engine/transition";
import { actorTypeValidator } from "../../engine/validators";
import { convex } from "../../fluent";
import { createImportedFsraProviderBindings } from "../verification/fsraImport";
import { createBrokerOnboardingVerificationRegistry } from "../verification/registry";
import {
	buildStoredEmailVerificationInput,
	createBrokerOnboardingVerificationRuntimeSnapshot,
	createNotStartedIdentityVerificationCheck,
} from "../verification/runtime";
import {
	appendBrokerOnboardingReviewEntry,
	assertPortalActiveAndPublished,
	type BrokerOnboardingApplicationDoc,
	buildBrokerOnboardingApplicationReadModel,
	buildResumeWindowPatch,
	getBrokerOnboardingVerificationState,
	isBrokerOnboardingApplicationExpired,
	isBrokerOnboardingResumeWindowStatus,
	isBrokerOnboardingTerminalStatus,
	isIdentityVerificationInvalidationField,
	isRegulatorVerificationInvalidationField,
	mergeBrokerOnboardingVerificationState,
	resolveVerificationInvalidationFieldPaths,
} from "./helpers";
import {
	brokerOnboardingVerificationSnapshotValidator,
	brokerOnboardingVerificationStateValidator,
} from "./validators";

interface ReopenedBrokerOnboardingField {
	fieldPath: string;
	reason?: string;
	requestedAt: number;
	requestedByAuthId?: string;
	status: "open";
}

function resolveAuthor(args: {
	authorAuthId?: string;
	authorType?: "borrower" | "broker" | "member" | "admin" | "system";
}) {
	return {
		authorAuthId: args.authorAuthId,
		authorType: args.authorType ?? "system",
	};
}

function buildRegulatorLookupForReverification(args: {
	application: BrokerOnboardingApplicationDoc;
	now: number;
	registry: ReturnType<typeof createBrokerOnboardingVerificationRegistry>;
	shouldInvalidateRegulator: boolean;
}) {
	const licenseNumber = args.application.draftData.licenseNumber;
	const licenseProvince = args.application.draftData.licenseProvince;

	if (args.shouldInvalidateRegulator || !licenseNumber || !licenseProvince) {
		return null;
	}

	return () =>
		args.registry.regulatorDirectory.lookupLicense({
			expectedBrokerageName: args.application.draftData.brokerageName ?? null,
			expectedBrokerageNumber:
				args.application.draftData.brokerageNumber ?? null,
			licenseNumber,
			province: licenseProvince,
			requestedAt: args.now,
			selfReportedName: args.application.draftData.selfReportedName ?? {},
		});
}

function buildIdentityVerificationForReverification(args: {
	application: BrokerOnboardingApplicationDoc;
	now: number;
	registry: ReturnType<typeof createBrokerOnboardingVerificationRegistry>;
	shouldInvalidateIdentity: boolean;
}) {
	const currentVerificationState = getBrokerOnboardingVerificationState(
		args.application
	);

	if (!args.shouldInvalidateIdentity) {
		return (
			args.application.verificationSnapshot?.identityVerification ??
			createNotStartedIdentityVerificationCheck({
				checkedAt: args.now,
				provider:
					currentVerificationState.currentIdvProviderKey ??
					args.registry.identityVerification.providerKey,
			})
		);
	}

	return createNotStartedIdentityVerificationCheck({
		checkedAt: args.now,
		provider:
			currentVerificationState.currentIdvProviderKey ??
			args.application.verificationSnapshot?.identityVerification.provider ??
			args.registry.identityVerification.providerKey,
	});
}

async function buildVerificationInvalidationPatch(
	ctx: Parameters<typeof createImportedFsraProviderBindings>[0],
	args: {
		application: BrokerOnboardingApplicationDoc;
		invalidatedFieldPaths: string[];
		now: number;
	}
): Promise<Record<string, unknown>> {
	const shouldInvalidateIdentity = args.invalidatedFieldPaths.some(
		isIdentityVerificationInvalidationField
	);
	const shouldInvalidateRegulator = args.invalidatedFieldPaths.some(
		isRegulatorVerificationInvalidationField
	);
	const verificationRegistry = createBrokerOnboardingVerificationRegistry({
		configOverrides: {
			providers: { regulatorDirectory: "imported_fsra" },
		},
		importedFsra: createImportedFsraProviderBindings(ctx, {
			now: () => args.now,
		}),
	});
	const currentVerificationState = getBrokerOnboardingVerificationState(
		args.application
	);
	const invalidatedSnapshot =
		await createBrokerOnboardingVerificationRuntimeSnapshot({
			capturedAt: args.now,
			emailVerification: verificationRegistry.emailVerification.normalize(
				buildStoredEmailVerificationInput({
					application: args.application,
					checkedAt: args.now,
				})
			),
			identityVerification: buildIdentityVerificationForReverification({
				application: args.application,
				now: args.now,
				registry: verificationRegistry,
				shouldInvalidateIdentity,
			}),
			licenseNumber: args.application.draftData.licenseNumber,
			policy: verificationRegistry.config,
			province:
				args.application.draftData.licenseProvince ??
				args.application.verificationSnapshot?.province,
			regulatorLookup: buildRegulatorLookupForReverification({
				application: args.application,
				now: args.now,
				registry: verificationRegistry,
				shouldInvalidateRegulator,
			}),
			regulatorProviderKey:
				args.application.verificationSnapshot?.regulator.provider ??
				verificationRegistry.regulatorDirectory.providerKey,
			requestedBrokerageName: args.application.draftData.brokerageName,
			requestedBrokerageNumber: args.application.draftData.brokerageNumber,
			selfReportedName: args.application.draftData.selfReportedName,
		});

	return {
		verificationRecommendation: invalidatedSnapshot.recommendation,
		verificationReasonCodes: invalidatedSnapshot.reasonCodes,
		verificationSnapshot: invalidatedSnapshot,
		verificationState: mergeBrokerOnboardingVerificationState(
			currentVerificationState,
			{
				...(shouldInvalidateIdentity
					? {
							currentIdvLaunchUrl: null,
							currentIdvProviderKey: null,
							currentIdvSessionId: null,
							idvCompletedAt: null,
							idvStartedAt: null,
						}
					: {}),
				lastRecomputedAt: args.now,
				requiresReverification: true,
				reverificationFieldPaths: args.invalidatedFieldPaths,
				reverificationRequiredAt: args.now,
			}
		),
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

export const getApplicationByLooseId = convex
	.query()
	.input({
		applicationId: v.string(),
	})
	.handler(async (ctx, args) => {
		const normalizedApplicationId = ctx.db.normalizeId(
			"brokerOnboardingApplications",
			args.applicationId
		);
		return normalizedApplicationId ? ctx.db.get(normalizedApplicationId) : null;
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
		verificationState: v.optional(brokerOnboardingVerificationStateValidator),
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
			...(args.verificationState
				? { verificationState: args.verificationState }
				: {}),
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

export const setVerificationState = convex
	.mutation()
	.input({
		applicationId: v.id("brokerOnboardingApplications"),
		state: brokerOnboardingVerificationStateValidator,
	})
	.handler(async (ctx, args) => {
		const application = await ctx.db.get(args.applicationId);
		if (!application) {
			throw new ConvexError("Broker onboarding application not found");
		}
		if (isBrokerOnboardingTerminalStatus(application.status)) {
			throw new ConvexError(
				"Verification state cannot be updated for terminal applications"
			);
		}

		const now = Date.now();
		await ctx.db.patch(args.applicationId, {
			verificationState: args.state,
			lastActivityAt: now,
			updatedAt: now,
			...(isBrokerOnboardingResumeWindowStatus(application.status)
				? { expiresAt: now + 30 * 24 * 60 * 60 * 1000 }
				: {}),
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

		const reopenedFields: ReopenedBrokerOnboardingField[] =
			args.reopenedFields.map((reopenedField) => ({
				fieldPath: reopenedField.fieldPath,
				reason: reopenedField.reason,
				requestedAt: now,
				requestedByAuthId: args.authorAuthId,
				status: "open" as const,
			}));
		const invalidatedFieldPaths =
			resolveVerificationInvalidationFieldPaths(reopenedFields);
		const patch: Record<string, unknown> = {
			changesRequestedAt: now,
			reopenedFields,
			...buildResumeWindowPatch(now),
		};

		if (invalidatedFieldPaths.length > 0) {
			Object.assign(
				patch,
				await buildVerificationInvalidationPatch(ctx, {
					application,
					invalidatedFieldPaths,
					now,
				})
			);
		}

		await ctx.db.patch(args.applicationId, patch);
		await appendBrokerOnboardingReviewEntry(ctx, {
			applicationId: args.applicationId,
			body: args.body.trim() || "Changes requested.",
			createdAt: now,
			entryType: "reviewer_note",
			reopenedFields,
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

export const applyVerificationRecommendation = convex
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
			isBrokerOnboardingTerminalStatus(application.status) ||
			application.status === "approved" ||
			application.status !== "submitted"
		) {
			return buildBrokerOnboardingApplicationReadModel(ctx, application, now);
		}
		if (!application.verificationSnapshot) {
			throw new ConvexError(
				"Verification recommendation cannot be applied without a verification snapshot"
			);
		}

		const recommendation = application.verificationSnapshot.recommendation;
		if (recommendation === "auto_approve_candidate") {
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
					result.reason ?? "Broker onboarding auto-approval transition failed"
				);
			}

			await ctx.db.patch(args.applicationId, {
				approvedAt: now,
				lastActivityAt: now,
				updatedAt: now,
			});
			await appendBrokerOnboardingReviewEntry(ctx, {
				applicationId: args.applicationId,
				body: "Application approved automatically from verification outcome.",
				createdAt: now,
				entryType: "system_event",
				systemEventType: "application_approved",
				metadata: {
					reasonCodes: application.verificationSnapshot.reasonCodes,
					recommendation,
					source: "verification_runtime",
				},
				...resolveAuthor(args),
			});
			await auditLog.log(ctx, {
				action: "onboarding.broker_application_verification_auto_approved",
				actorId: args.authorAuthId ?? "system",
				resourceType: "brokerOnboardingApplications",
				resourceId: args.applicationId,
				severity: "info",
				metadata: {
					reasonCodes: application.verificationSnapshot.reasonCodes,
				},
			});
		} else if (recommendation === "rejected") {
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
					result.reason ??
						"Broker onboarding verification rejection transition failed"
				);
			}

			await ctx.db.patch(args.applicationId, {
				rejectedAt: now,
				lastActivityAt: now,
				updatedAt: now,
			});
			await appendBrokerOnboardingReviewEntry(ctx, {
				applicationId: args.applicationId,
				body: "Application rejected automatically from verification outcome.",
				createdAt: now,
				entryType: "system_event",
				systemEventType: "application_rejected",
				metadata: {
					reasonCodes: application.verificationSnapshot.reasonCodes,
					recommendation,
					source: "verification_runtime",
				},
				...resolveAuthor(args),
			});
			await auditLog.log(ctx, {
				action: "onboarding.broker_application_verification_rejected",
				actorId: args.authorAuthId ?? "system",
				resourceType: "brokerOnboardingApplications",
				resourceId: args.applicationId,
				severity: "info",
				metadata: {
					reasonCodes: application.verificationSnapshot.reasonCodes,
				},
			});
		}

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
		if (isBrokerOnboardingApplicationExpired(application, Date.now())) {
			throw new ConvexError("Broker onboarding application has expired");
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
		if (isBrokerOnboardingApplicationExpired(application, Date.now())) {
			throw new ConvexError("Broker onboarding application has expired");
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
		const targetHandoffStatus =
			downstreamRequest.status === "role_assigned" ? "role_assigned" : "linked";
		if (
			application.downstreamOnboardingRequestId === args.onboardingRequestId &&
			application.downstreamHandoffStatus === targetHandoffStatus &&
			downstreamRequest.brokerOnboardingApplicationId === args.applicationId &&
			downstreamRequest.portalId === application.portalId
		) {
			return buildBrokerOnboardingApplicationReadModel(ctx, application, now);
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
		if (application.downstreamHandoffStatus === "role_assigned") {
			return buildBrokerOnboardingApplicationReadModel(ctx, application, now);
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
