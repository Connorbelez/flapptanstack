import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import { actorTypeValidator } from "../../engine/validators";
import {
	adminAction,
	authedAction,
	convex,
	requirePermissionAction,
} from "../../fluent";
import type { BrokerOnboardingApplicationDoc } from "../brokerApplication/helpers";
import {
	assertViewerCanAccessBrokerApplication,
	type BrokerOnboardingApplicationReadModel,
	getBrokerOnboardingVerificationState,
	isBrokerOnboardingApplicationExpired,
	mergeBrokerOnboardingVerificationState,
	resolveVerifiedEmailFromIdentity,
} from "../brokerApplication/helpers";
import {
	buildBrokerOnboardingRateLimitKey,
	limitBrokerOnboardingIdvStart,
	limitBrokerOnboardingVerificationRecompute,
} from "./abuse";
import type { FsraSourceRecord } from "./fsraFixtures";
import type { RegulatorDirectoryProvider } from "./interface";
import {
	type BrokerOnboardingVerificationRegistry,
	createBrokerOnboardingVerificationRegistry,
} from "./registry";
import {
	buildStoredEmailVerificationInput,
	buildWorkosSessionEmailVerificationInput,
	createBrokerOnboardingVerificationRuntimeSnapshot,
	createNotStartedIdentityVerificationCheck,
} from "./runtime";
import { fsraSourceRecordValidator } from "./validators";

const onboardingManageAction = adminAction.use(
	requirePermissionAction("onboarding:manage")
);
const brokerOnboardingAction = authedAction.use(
	requirePermissionAction("onboarding:access")
);

const runFsraImportRefreshRef = makeFunctionReference<
	"action",
	{ records?: FsraSourceRecord[]; trigger: "cron" | "manual" },
	Promise<{
		createdCount: number;
		failedCount: number;
		recordCount: number;
		runId: string;
		status: "failed" | "success";
		updatedCount: number;
	}>
>("onboarding/verification/fsraImport:runFsraImportRefresh");

type VerificationActorType =
	| "borrower"
	| "broker"
	| "member"
	| "admin"
	| "system";
type VerificationRuntimeSnapshot = Awaited<
	ReturnType<typeof createBrokerOnboardingVerificationRuntimeSnapshot>
>;
type EmailVerificationCheck = ReturnType<
	BrokerOnboardingVerificationRegistry["emailVerification"]["normalize"]
>;
type IdentityVerificationCheck = Awaited<
	ReturnType<
		BrokerOnboardingVerificationRegistry["identityVerification"]["getReview"]
	>
>;
interface VerificationRuntimeResult {
	application: BrokerOnboardingApplicationReadModel;
	snapshot: VerificationRuntimeSnapshot;
	trigger: "callback" | "manual" | "submit";
}
type RecomputeVerificationActionResult =
	| { error: "rate_limited"; ok: false; retryAfter: number }
	| ({ ok: true } & VerificationRuntimeResult);
type StartIdentityVerificationResult =
	| {
			emailVerification?: EmailVerificationCheck;
			ok: true;
			session: {
				launchUrl?: string;
				providerKey: string;
				sessionId: string;
				status: "reused" | "started";
			};
	  }
	| {
			blockedReasonCodes: string[];
			emailVerification: EmailVerificationCheck;
			ok: false;
			recommendation: string;
	  }
	| { error: "rate_limited"; ok: false; retryAfter: number }
	| {
			error: "provider_unavailable";
			ok: false;
			session: {
				launchUrl?: string;
				providerKey: string;
				sessionId: string;
				status: "provider_unavailable";
			};
			snapshot: VerificationRuntimeSnapshot;
	  };

function createImportedFsraActionProvider(
	ctx: ActionCtx
): RegulatorDirectoryProvider {
	return {
		mode: "imported_fsra",
		providerKey: "imported_fsra",
		lookupBrokerage: (request) =>
			ctx.runQuery(
				internal.onboarding.verification.fsraImport.lookupImportedFsraBrokerage,
				{
					brokerageNumber: request.brokerageNumber,
					province: request.province,
					requestedAt: request.requestedAt,
				}
			),
		lookupLicense: (request) =>
			ctx.runQuery(
				internal.onboarding.verification.fsraImport.lookupImportedFsraLicense,
				{
					expectedBrokerageName: request.expectedBrokerageName,
					expectedBrokerageNumber: request.expectedBrokerageNumber,
					licenseNumber: request.licenseNumber,
					province: request.province,
					requestedAt: request.requestedAt,
					selfReportedFullName: request.selfReportedName.fullName ?? null,
				}
			),
	};
}

export function createActionVerificationRegistry(
	ctx: ActionCtx
): BrokerOnboardingVerificationRegistry {
	return createBrokerOnboardingVerificationRegistry({
		configOverrides: {
			providers: { regulatorDirectory: "imported_fsra" },
		},
		regulatorProviders: {
			imported_fsra: createImportedFsraActionProvider(ctx),
		},
	});
}

async function loadBrokerOnboardingApplication(
	ctx: Pick<ActionCtx, "runQuery">,
	applicationId: BrokerOnboardingApplicationDoc["_id"]
): Promise<BrokerOnboardingApplicationDoc> {
	const application = await ctx.runQuery(
		internal.onboarding.brokerApplication.internal.getApplicationById,
		{ applicationId }
	);
	if (!application) {
		throw new ConvexError("Broker onboarding application not found");
	}
	return application;
}

async function persistVerificationRuntimeResult(
	ctx: ActionCtx,
	args: {
		application: BrokerOnboardingApplicationDoc;
		authorAuthId?: string;
		authorType?: VerificationActorType;
		snapshot: VerificationRuntimeSnapshot;
		verificationStatePatch?: Partial<
			NonNullable<BrokerOnboardingApplicationDoc["verificationState"]>
		>;
	}
): Promise<BrokerOnboardingApplicationReadModel> {
	const currentVerificationState = getBrokerOnboardingVerificationState(
		args.application
	);
	const nextVerificationState = mergeBrokerOnboardingVerificationState(
		currentVerificationState,
		{
			currentIdvLaunchUrl:
				args.snapshot.identityVerification.completedAt !== null
					? null
					: currentVerificationState.currentIdvLaunchUrl,
			currentIdvProviderKey:
				currentVerificationState.currentIdvProviderKey ??
				args.snapshot.identityVerification.provider,
			idvCompletedAt:
				args.snapshot.identityVerification.completedAt ??
				currentVerificationState.idvCompletedAt,
			lastRecomputedAt: args.snapshot.capturedAt,
			requiresReverification: false,
			reverificationFieldPaths: [],
			reverificationRequiredAt: null,
			...args.verificationStatePatch,
		}
	);

	await ctx.runMutation(
		internal.onboarding.brokerApplication.internal.upsertVerificationSnapshot,
		{
			applicationId: args.application._id,
			authorAuthId: args.authorAuthId,
			authorType: args.authorType,
			snapshot: args.snapshot,
			verificationState: nextVerificationState,
		}
	);

	return ctx.runMutation(
		internal.onboarding.brokerApplication.internal
			.applyVerificationRecommendation,
		{
			applicationId: args.application._id,
			authorAuthId: args.authorAuthId,
			authorType: args.authorType,
		}
	);
}

export async function recomputeBrokerOnboardingVerificationForApplication(
	ctx: ActionCtx,
	args: {
		application: BrokerOnboardingApplicationDoc;
		authorAuthId?: string;
		authorType?: VerificationActorType;
		capturedAt?: number;
		emailVerification?: EmailVerificationCheck;
		identityVerification?: IdentityVerificationCheck;
		trigger: "callback" | "manual" | "submit";
		verificationStatePatch?: Partial<
			NonNullable<BrokerOnboardingApplicationDoc["verificationState"]>
		>;
	}
): Promise<VerificationRuntimeResult> {
	const capturedAt = args.capturedAt ?? Date.now();
	const registry = createActionVerificationRegistry(ctx);
	const currentVerificationState = getBrokerOnboardingVerificationState(
		args.application
	);
	const licenseNumber = args.application.draftData.licenseNumber;
	const licenseProvince = args.application.draftData.licenseProvince;
	const emailVerification =
		args.emailVerification ??
		registry.emailVerification.normalize(
			buildStoredEmailVerificationInput({
				application: args.application,
				checkedAt: capturedAt,
			})
		);
	const identityVerification =
		args.identityVerification ??
		(currentVerificationState.currentIdvSessionId
			? await registry.identityVerification.getReview({
					applicantName: args.application.draftData.selfReportedName,
					applicationId: String(args.application._id),
					reviewedAt: capturedAt,
					sessionId: currentVerificationState.currentIdvSessionId,
				})
			: createNotStartedIdentityVerificationCheck({
					checkedAt: capturedAt,
					provider:
						currentVerificationState.currentIdvProviderKey ??
						registry.identityVerification.providerKey,
				}));
	const regulatorLookup =
		licenseNumber && licenseProvince
			? () =>
					registry.regulatorDirectory.lookupLicense({
						expectedBrokerageName:
							args.application.draftData.brokerageName ?? null,
						expectedBrokerageNumber:
							args.application.draftData.brokerageNumber ?? null,
						licenseNumber,
						province: licenseProvince,
						requestedAt: capturedAt,
						selfReportedName: args.application.draftData.selfReportedName ?? {},
					})
			: null;
	const snapshot = await createBrokerOnboardingVerificationRuntimeSnapshot({
		capturedAt,
		emailVerification,
		identityVerification,
		licenseNumber,
		policy: registry.config,
		province: licenseProvince,
		regulatorLookup,
		regulatorProviderKey: registry.regulatorDirectory.providerKey,
		requestedBrokerageName: args.application.draftData.brokerageName,
		requestedBrokerageNumber: args.application.draftData.brokerageNumber,
		selfReportedName: args.application.draftData.selfReportedName,
	});
	const application = await persistVerificationRuntimeResult(ctx, {
		application: args.application,
		authorAuthId: args.authorAuthId,
		authorType: args.authorType,
		snapshot,
		verificationStatePatch: args.verificationStatePatch,
	});

	return {
		application,
		snapshot,
		trigger: args.trigger,
	};
}

export const startBrokerOnboardingIdentityVerification = brokerOnboardingAction
	.input({
		applicationId: v.id("brokerOnboardingApplications"),
	})
	.handler(async (ctx, args): Promise<StartIdentityVerificationResult> => {
		const application = await loadBrokerOnboardingApplication(
			ctx,
			args.applicationId
		);
		const identity = await ctx.auth.getUserIdentity();
		const verifiedEmail = resolveVerifiedEmailFromIdentity(identity);
		assertViewerCanAccessBrokerApplication(application, {
			authUserId: ctx.viewer.authId,
			verifiedEmail,
		});
		if (
			!(
				application.status === "draft" ||
				application.status === "submitted" ||
				application.status === "changes_requested"
			)
		) {
			throw new ConvexError(
				"Identity verification can only start for draft, submitted, or changes-requested applications"
			);
		}

		const now = Date.now();
		if (isBrokerOnboardingApplicationExpired(application, now)) {
			throw new ConvexError("Broker onboarding application has expired");
		}

		const currentVerificationState =
			getBrokerOnboardingVerificationState(application);
		if (
			currentVerificationState.currentIdvSessionId &&
			currentVerificationState.idvCompletedAt === null
		) {
			return {
				ok: true as const,
				session: {
					launchUrl: currentVerificationState.currentIdvLaunchUrl ?? undefined,
					providerKey:
						currentVerificationState.currentIdvProviderKey ??
						"unknown_identity_provider",
					sessionId: currentVerificationState.currentIdvSessionId,
					status: "reused" as const,
				},
			};
		}

		const registry = createActionVerificationRegistry(ctx);
		const blockedLicenseNumber = application.draftData.licenseNumber;
		const blockedLicenseProvince = application.draftData.licenseProvince;
		const emailGate =
			registry.emailVerification.gateTrustedIdentityVerification(
				buildWorkosSessionEmailVerificationInput({
					authUserId: application.authUserId,
					checkedAt: now,
					email: verifiedEmail ?? application.verifiedEmail ?? null,
					emailVerified: Boolean(verifiedEmail),
					verifiedAt: verifiedEmail ? now : null,
				})
			);
		if (!emailGate.isSatisfied) {
			const snapshot = await createBrokerOnboardingVerificationRuntimeSnapshot({
				capturedAt: now,
				emailVerification: emailGate.normalizedEmailVerification,
				identityVerification: createNotStartedIdentityVerificationCheck({
					checkedAt: now,
					provider: registry.identityVerification.providerKey,
				}),
				licenseNumber: blockedLicenseNumber,
				policy: registry.config,
				province: blockedLicenseProvince,
				regulatorLookup:
					blockedLicenseNumber && blockedLicenseProvince
						? () =>
								registry.regulatorDirectory.lookupLicense({
									expectedBrokerageName:
										application.draftData.brokerageName ?? null,
									expectedBrokerageNumber:
										application.draftData.brokerageNumber ?? null,
									licenseNumber: blockedLicenseNumber,
									province: blockedLicenseProvince,
									requestedAt: now,
									selfReportedName:
										application.draftData.selfReportedName ?? {},
								})
						: null,
				regulatorProviderKey: registry.regulatorDirectory.providerKey,
				requestedBrokerageName: application.draftData.brokerageName,
				requestedBrokerageNumber: application.draftData.brokerageNumber,
				selfReportedName: application.draftData.selfReportedName,
			});
			await persistVerificationRuntimeResult(ctx, {
				application,
				authorAuthId: ctx.viewer.authId,
				authorType: "member",
				snapshot,
				verificationStatePatch: { lastRecomputedAt: now },
			});
			return {
				blockedReasonCodes: emailGate.blockedReasonCodes,
				emailVerification: emailGate.normalizedEmailVerification,
				ok: false as const,
				recommendation: emailGate.blockedRecommendation,
			};
		}

		const limitStatus = await limitBrokerOnboardingIdvStart(
			ctx,
			buildBrokerOnboardingRateLimitKey({
				applicationId: String(application._id),
				authUserId: application.authUserId,
				scope: "idv_start",
			})
		);
		if (!limitStatus.ok) {
			return {
				error: "rate_limited" as const,
				ok: false as const,
				retryAfter: limitStatus.retryAfter,
			};
		}

		const session = await registry.identityVerification.startVerification({
			applicantName: application.draftData.selfReportedName ?? {},
			applicationId: String(application._id),
			email: emailGate.normalizedEmailVerification.email ?? "",
			province: application.draftData.licenseProvince ?? "ON",
			requestedAt: now,
		});
		const nextVerificationState = mergeBrokerOnboardingVerificationState(
			currentVerificationState,
			{
				currentIdvLaunchUrl: session.launchUrl ?? null,
				currentIdvProviderKey: session.providerKey,
				currentIdvSessionId: session.sessionId,
				idvCompletedAt: null,
				idvStartedAt: now,
			}
		);
		await ctx.runMutation(
			internal.onboarding.brokerApplication.internal.setVerificationState,
			{
				applicationId: application._id,
				state: nextVerificationState,
			}
		);

		if (session.status === "provider_unavailable") {
			const providerUnavailableResult =
				await recomputeBrokerOnboardingVerificationForApplication(ctx, {
					application: {
						...application,
						verificationState: nextVerificationState,
					},
					authorAuthId: ctx.viewer.authId,
					authorType: "member",
					capturedAt: now,
					emailVerification: emailGate.normalizedEmailVerification,
					identityVerification: {
						provider: session.providerKey,
						status: "provider_unavailable",
						legalName: null,
						checkedAt: now,
						completedAt: null,
						fraudSignal: false,
						evidenceReferences: [],
					},
					trigger: "manual",
					verificationStatePatch: {
						currentIdvLaunchUrl: null,
					},
				});
			return {
				error: "provider_unavailable" as const,
				ok: false as const,
				session: {
					launchUrl: session.launchUrl,
					providerKey: session.providerKey,
					sessionId: session.sessionId,
					status: "provider_unavailable" as const,
				},
				snapshot: providerUnavailableResult.snapshot,
			};
		}

		return {
			emailVerification: emailGate.normalizedEmailVerification,
			ok: true as const,
			session: {
				launchUrl: session.launchUrl,
				providerKey: session.providerKey,
				sessionId: session.sessionId,
				status: session.status === "reused" ? "reused" : "started",
			},
		};
	})
	.public();

export const recomputeBrokerOnboardingVerification = brokerOnboardingAction
	.input({
		applicationId: v.id("brokerOnboardingApplications"),
	})
	.handler(async (ctx, args): Promise<RecomputeVerificationActionResult> => {
		const application = await loadBrokerOnboardingApplication(
			ctx,
			args.applicationId
		);
		const identity = await ctx.auth.getUserIdentity();
		const verifiedEmail = resolveVerifiedEmailFromIdentity(identity);
		assertViewerCanAccessBrokerApplication(application, {
			authUserId: ctx.viewer.authId,
			verifiedEmail,
		});

		const now = Date.now();
		if (isBrokerOnboardingApplicationExpired(application, now)) {
			throw new ConvexError("Broker onboarding application has expired");
		}

		const limitStatus = await limitBrokerOnboardingVerificationRecompute(
			ctx,
			buildBrokerOnboardingRateLimitKey({
				applicationId: String(application._id),
				authUserId: application.authUserId,
				scope: "recompute",
			})
		);
		if (!limitStatus.ok) {
			return {
				error: "rate_limited" as const,
				ok: false as const,
				retryAfter: limitStatus.retryAfter,
			};
		}

		const registry = createActionVerificationRegistry(ctx);
		const result = await recomputeBrokerOnboardingVerificationForApplication(
			ctx,
			{
				application,
				authorAuthId: ctx.viewer.authId,
				authorType: "member",
				capturedAt: now,
				emailVerification: registry.emailVerification.normalize(
					buildWorkosSessionEmailVerificationInput({
						authUserId: application.authUserId,
						checkedAt: now,
						email: verifiedEmail ?? application.verifiedEmail ?? null,
						emailVerified: Boolean(verifiedEmail),
						verifiedAt: verifiedEmail ? now : null,
					})
				),
				trigger: "manual",
			}
		);

		return {
			ok: true as const,
			...result,
		};
	})
	.public();

export const recomputeBrokerOnboardingVerificationInternal = convex
	.action()
	.input({
		applicationId: v.id("brokerOnboardingApplications"),
		authorAuthId: v.optional(v.string()),
		authorType: v.optional(actorTypeValidator),
		trigger: v.union(
			v.literal("callback"),
			v.literal("manual"),
			v.literal("submit")
		),
	})
	.handler(async (ctx, args): Promise<RecomputeVerificationActionResult> => {
		const application = await loadBrokerOnboardingApplication(
			ctx,
			args.applicationId
		);
		if (args.trigger !== "submit") {
			const limitStatus = await limitBrokerOnboardingVerificationRecompute(
				ctx,
				buildBrokerOnboardingRateLimitKey({
					applicationId: String(application._id),
					authUserId: application.authUserId,
					scope: "recompute",
				})
			);
			if (!limitStatus.ok) {
				return {
					error: "rate_limited" as const,
					ok: false as const,
					retryAfter: limitStatus.retryAfter,
				};
			}
		}

		const result = await recomputeBrokerOnboardingVerificationForApplication(
			ctx,
			{
				application,
				authorAuthId: args.authorAuthId,
				authorType: args.authorType,
				trigger: args.trigger,
			}
		);
		return {
			ok: true as const,
			...result,
		};
	})
	.internal();

export const refreshFsraImportedDataNow = onboardingManageAction
	.input({
		records: v.optional(v.array(fsraSourceRecordValidator)),
	})
	.handler((ctx, args) =>
		ctx.runAction(runFsraImportRefreshRef, {
			records: args.records,
			trigger: "manual",
		})
	)
	.public();
