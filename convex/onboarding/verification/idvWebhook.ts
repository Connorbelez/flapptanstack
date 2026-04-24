import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { httpAction } from "../../_generated/server";
import { convex } from "../../fluent";
import { jsonResponse } from "../../payments/webhooks/utils";
import {
	brokerOnboardingApprovalRecommendationValidator,
	brokerOnboardingIdentityVerificationStatusValidator,
	brokerOnboardingVerificationReasonCodeValidator,
} from "../brokerApplication/validators";
import {
	buildBrokerOnboardingRateLimitKey,
	limitBrokerOnboardingIdvCallbackProcessing,
} from "./abuse";
import {
	createActionVerificationRegistry,
	recomputeBrokerOnboardingVerificationForApplication,
} from "./actions";
import type { BrokerOnboardingCallbackVerificationResult } from "./callbackVerification";
import {
	buildStoredEmailVerificationInput,
	buildWorkosSessionEmailVerificationInput,
} from "./runtime";
import {
	brokerOnboardingVerificationCallbackHeadersValidator,
	brokerOnboardingVerificationCallbackProcessingStatusValidator,
} from "./validators";

export const BROKER_ONBOARDING_IDV_WEBHOOK_PATH =
	"/webhooks/onboarding/broker-idv";
export const MOCK_IDENTITY_CALLBACK_PROVIDER = "mock_identity";
export const MOCK_IDENTITY_SIGNATURE_HEADER = "x-fairlend-mock-signature";

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

function parseCallbackPayload(body: string): unknown | null {
	try {
		return JSON.parse(body) as unknown;
	} catch {
		return null;
	}
}

function normalizeCallbackHeaders(headers: Headers): Record<string, string> {
	const normalized: Record<string, string> = {};
	headers.forEach((value, key) => {
		normalized[key.toLowerCase()] = value;
	});
	return normalized;
}

function deriveApplicationIdFromMockSessionId(sessionId: string | null) {
	if (!sessionId) {
		return null;
	}

	const parts = sessionId.split(":");
	if (parts.length !== 3 || parts[0] !== "mock-idv") {
		return null;
	}

	return parts[2] ?? null;
}

export function extractMockIdentityCallbackMetadata(
	payload: unknown,
	receivedAt: number
): {
	applicationId: string | null;
	providerEventId: string;
	sessionId: string | null;
} {
	if (!isRecord(payload)) {
		return {
			applicationId: null,
			providerEventId: `mock_identity:received:${receivedAt}`,
			sessionId: null,
		};
	}

	const applicationId =
		typeof payload.applicationId === "string" ? payload.applicationId : null;
	const sessionId =
		typeof payload.sessionId === "string" ? payload.sessionId : null;
	const providerEventId =
		typeof payload.eventId === "string"
			? payload.eventId
			: (sessionId ?? `mock_identity:received:${receivedAt}`);

	return {
		applicationId:
			applicationId ?? deriveApplicationIdFromMockSessionId(sessionId),
		providerEventId,
		sessionId,
	};
}

export const getBrokerOnboardingVerificationCallbackEvent = convex
	.query()
	.input({
		callbackEventId: v.id("brokerOnboardingVerificationCallbackEvents"),
	})
	.handler(async (ctx, args) => ctx.db.get(args.callbackEventId))
	.internal();

export const persistBrokerOnboardingVerificationCallbackEvent = convex
	.mutation()
	.input({
		applicationId: v.optional(v.id("brokerOnboardingApplications")),
		headers: v.optional(brokerOnboardingVerificationCallbackHeadersValidator),
		identityVerificationSessionId: v.optional(v.string()),
		provider: v.string(),
		providerEventId: v.string(),
		rawBody: v.string(),
		receivedAt: v.number(),
		signatureVerified: v.boolean(),
	})
	.handler(async (ctx, args) => {
		const existing = await ctx.db
			.query("brokerOnboardingVerificationCallbackEvents")
			.withIndex("by_provider_event", (query) =>
				query
					.eq("provider", args.provider)
					.eq("providerEventId", args.providerEventId)
			)
			.unique();

		if (existing) {
			const patch: {
				applicationId?: Id<"brokerOnboardingApplications">;
				errorMessage?: string;
				headers?: Record<string, string>;
				identityVerificationSessionId?: string;
				rawBody?: string;
				receivedAt?: number;
				signatureVerified?: boolean;
				status?: "pending";
			} = {};

			if (
				args.signatureVerified &&
				!existing.applicationId &&
				args.applicationId
			) {
				patch.applicationId = args.applicationId;
			}
			if (
				args.signatureVerified &&
				!existing.identityVerificationSessionId &&
				args.identityVerificationSessionId
			) {
				patch.identityVerificationSessionId =
					args.identityVerificationSessionId;
			}
			if (
				existing.signatureVerified !== args.signatureVerified &&
				args.signatureVerified
			) {
				patch.signatureVerified = args.signatureVerified;
			}
			if ((!existing.headers || args.signatureVerified) && args.headers) {
				patch.headers = args.headers;
			}
			if (
				args.signatureVerified &&
				existing.status === "failed" &&
				existing.errorMessage === "invalid_signature"
			) {
				patch.errorMessage = undefined;
				patch.rawBody = args.rawBody;
				patch.receivedAt = args.receivedAt;
				patch.status = "pending";
			}
			if (Object.keys(patch).length > 0) {
				await ctx.db.patch(existing._id, patch);
			}
			return existing._id;
		}

		return ctx.db.insert("brokerOnboardingVerificationCallbackEvents", {
			applicationId: args.applicationId,
			headers: args.headers,
			identityVerificationSessionId: args.identityVerificationSessionId,
			provider: args.provider,
			providerEventId: args.providerEventId,
			rawBody: args.rawBody,
			receivedAt: args.receivedAt,
			signatureVerified: args.signatureVerified,
			status: "pending",
			attempts: 0,
		});
	})
	.internal();

export const finalizeBrokerOnboardingVerificationCallbackEvent = convex
	.mutation()
	.input({
		callbackEventId: v.id("brokerOnboardingVerificationCallbackEvents"),
		errorMessage: v.optional(v.string()),
		normalizedIdentityStatus: v.optional(
			brokerOnboardingIdentityVerificationStatusValidator
		),
		reasonCodes: v.optional(
			v.array(brokerOnboardingVerificationReasonCodeValidator)
		),
		recommendation: v.optional(brokerOnboardingApprovalRecommendationValidator),
		status: brokerOnboardingVerificationCallbackProcessingStatusValidator,
	})
	.handler(async (ctx, args) => {
		const event = await ctx.db.get(args.callbackEventId);
		if (!event) {
			return null;
		}
		if (event.status !== "pending") {
			return event;
		}

		await ctx.db.patch(args.callbackEventId, {
			attempts: event.attempts + 1,
			errorMessage: args.errorMessage,
			normalizedIdentityStatus: args.normalizedIdentityStatus,
			processedAt: Date.now(),
			reasonCodes: args.reasonCodes,
			recommendation: args.recommendation,
			status: args.status,
		});

		return ctx.db.get(args.callbackEventId);
	})
	.internal();

export const processBrokerOnboardingIdentityCallback = convex
	.action()
	.input({
		callbackEventId: v.id("brokerOnboardingVerificationCallbackEvents"),
	})
	.handler(async (ctx, args): Promise<Record<string, unknown>> => {
		const event: Doc<"brokerOnboardingVerificationCallbackEvents"> | null =
			await ctx.runQuery(
				internal.onboarding.verification.idvWebhook
					.getBrokerOnboardingVerificationCallbackEvent,
				{ callbackEventId: args.callbackEventId }
			);
		if (!event) {
			return {
				error: "callback_event_not_found" as const,
				ok: false as const,
			};
		}
		if (event.status !== "pending") {
			return {
				idempotent: true as const,
				ok: true as const,
				status: event.status,
			};
		}

		const limitStatus = await limitBrokerOnboardingIdvCallbackProcessing(
			ctx,
			buildBrokerOnboardingRateLimitKey({
				applicationId: event.applicationId ? String(event.applicationId) : null,
				provider: event.provider,
				scope: "callback",
				sessionId: event.identityVerificationSessionId ?? null,
			})
		);
		if (!limitStatus.ok) {
			await ctx.scheduler.runAfter(
				Math.max(1, Math.ceil(limitStatus.retryAfter)),
				internal.onboarding.verification.idvWebhook
					.processBrokerOnboardingIdentityCallback,
				{
					callbackEventId: event._id,
				}
			);
			return {
				error: "rate_limited" as const,
				ok: false as const,
				requeued: true as const,
				retryAfter: limitStatus.retryAfter,
			};
		}

		if (!event.signatureVerified) {
			await ctx.runMutation(
				internal.onboarding.verification.idvWebhook
					.finalizeBrokerOnboardingVerificationCallbackEvent,
				{
					callbackEventId: event._id,
					errorMessage: "invalid_signature",
					status: "failed",
				}
			);
			return {
				error: "invalid_signature" as const,
				ok: false as const,
			};
		}

		const application = event.applicationId
			? await ctx.runQuery(
					internal.onboarding.brokerApplication.internal.getApplicationById,
					{ applicationId: event.applicationId }
				)
			: null;
		if (!application) {
			await ctx.runMutation(
				internal.onboarding.verification.idvWebhook
					.finalizeBrokerOnboardingVerificationCallbackEvent,
				{
					callbackEventId: event._id,
					errorMessage: "application_not_found",
					status: "failed",
				}
			);
			return {
				error: "application_not_found" as const,
				ok: false as const,
			};
		}
		const currentSessionId = getBrokerOnboardingCurrentSessionId(application);
		if (
			!event.identityVerificationSessionId ||
			event.identityVerificationSessionId !== currentSessionId
		) {
			await ctx.runMutation(
				internal.onboarding.verification.idvWebhook
					.finalizeBrokerOnboardingVerificationCallbackEvent,
				{
					callbackEventId: event._id,
					errorMessage: "identity_session_mismatch",
					status: "failed",
				}
			);
			return {
				error: "identity_session_mismatch" as const,
				ok: false as const,
			};
		}

		const registry = createActionVerificationRegistry(ctx);
		const emailVerification = registry.emailVerification.normalize(
			buildCallbackEmailVerificationInput({
				application,
				checkedAt: event.receivedAt,
			})
		);
		if (emailVerification.status !== "verified") {
			await ctx.runMutation(
				internal.onboarding.verification.idvWebhook
					.finalizeBrokerOnboardingVerificationCallbackEvent,
				{
					callbackEventId: event._id,
					errorMessage: "email_unverified",
					status: "failed",
				}
			);
			return {
				error: "email_unverified" as const,
				ok: false as const,
			};
		}

		const payload = parseCallbackPayload(event.rawBody);
		const identityVerification =
			await registry.identityVerification.handleCallback({
				applicantName: application.draftData.selfReportedName,
				applicationId: String(application._id),
				headers: event.headers,
				payload,
				receivedAt: event.receivedAt,
				sessionId: event.identityVerificationSessionId,
			});
		const result = await recomputeBrokerOnboardingVerificationForApplication(
			ctx,
			{
				application,
				authorAuthId: `webhook:${event.provider}`,
				authorType: "system",
				capturedAt: event.receivedAt,
				emailVerification,
				identityVerification,
				trigger: "callback",
				verificationStatePatch: {
					currentIdvLaunchUrl: null,
					currentIdvProviderKey: identityVerification.provider,
					currentIdvSessionId: event.identityVerificationSessionId,
					lastCallbackEventId: event._id,
					lastCallbackProcessedAt: Date.now(),
					lastCallbackReceivedAt: event.receivedAt,
					lastCallbackSignatureVerified: event.signatureVerified,
				},
			}
		);
		await ctx.runMutation(
			internal.onboarding.verification.idvWebhook
				.finalizeBrokerOnboardingVerificationCallbackEvent,
			{
				callbackEventId: event._id,
				errorMessage:
					identityVerification.status === "callback_invalid"
						? "malformed_callback"
						: undefined,
				normalizedIdentityStatus: identityVerification.status,
				reasonCodes: result.snapshot.reasonCodes,
				recommendation: result.snapshot.recommendation,
				status:
					identityVerification.status === "callback_invalid"
						? "failed"
						: "processed",
			}
		);

		return {
			application: result.application,
			ok: true as const,
			snapshot: result.snapshot,
		};
	})
	.internal();

function getBrokerOnboardingCurrentSessionId(
	application: Doc<"brokerOnboardingApplications">
) {
	return application.verificationState?.currentIdvSessionId ?? null;
}

function buildCallbackEmailVerificationInput(args: {
	application: Doc<"brokerOnboardingApplications">;
	checkedAt: number;
}) {
	if (args.application.verifiedEmail) {
		return buildStoredEmailVerificationInput(args);
	}

	return buildWorkosSessionEmailVerificationInput({
		authUserId: args.application.authUserId,
		checkedAt: args.checkedAt,
		email: null,
		emailVerified: true,
		verifiedAt:
			args.application.verificationState?.idvStartedAt ?? args.checkedAt,
	});
}

export const brokerOnboardingIdentityWebhook = httpAction(
	async (ctx, request) => {
		const receivedAt = Date.now();
		const body = await request.text();
		const headers = normalizeCallbackHeaders(request.headers);
		const payload = parseCallbackPayload(body);
		const metadata = extractMockIdentityCallbackMetadata(payload, receivedAt);
		const verification: BrokerOnboardingCallbackVerificationResult =
			await ctx.runAction(
				internal.onboarding.verification.callbackVerification
					.verifyBrokerOnboardingCallbackSignatureAction,
				{
					body,
					provider: MOCK_IDENTITY_CALLBACK_PROVIDER,
					signature:
						request.headers.get(MOCK_IDENTITY_SIGNATURE_HEADER) ?? undefined,
				}
			);

		if (!verification.ok && verification.error === "missing_secret") {
			return jsonResponse({ error: "server_configuration_error" }, 500);
		}
		if (!verification.ok && verification.error === "unsupported_provider") {
			return jsonResponse({ error: "unsupported_provider" }, 400);
		}

		const resolvedApplication =
			verification.ok && metadata.applicationId !== null
				? await ctx.runQuery(
						internal.onboarding.brokerApplication.internal
							.getApplicationByLooseId,
						{ applicationId: metadata.applicationId }
					)
				: null;

		const callbackEventId = await ctx.runMutation(
			internal.onboarding.verification.idvWebhook
				.persistBrokerOnboardingVerificationCallbackEvent,
			{
				applicationId: verification.ok ? resolvedApplication?._id : undefined,
				headers,
				identityVerificationSessionId: verification.ok
					? (metadata.sessionId ?? undefined)
					: undefined,
				provider: MOCK_IDENTITY_CALLBACK_PROVIDER,
				providerEventId: metadata.providerEventId,
				rawBody: body,
				receivedAt,
				signatureVerified: verification.ok,
			}
		);

		if (!verification.ok) {
			await ctx.runMutation(
				internal.onboarding.verification.idvWebhook
					.finalizeBrokerOnboardingVerificationCallbackEvent,
				{
					callbackEventId,
					errorMessage: verification.error,
					status: "failed",
				}
			);
			return jsonResponse(
				{
					error: verification.error,
					providerEventId: metadata.providerEventId,
				},
				401
			);
		}

		await ctx.scheduler.runAfter(
			0,
			internal.onboarding.verification.idvWebhook
				.processBrokerOnboardingIdentityCallback,
			{
				callbackEventId,
			}
		);

		return jsonResponse({
			accepted: true,
			callbackEventId,
			processing: "deferred",
			providerEventId: metadata.providerEventId,
		});
	}
);
