import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { httpAction } from "../_generated/server";
import { convex } from "../fluent";
import { jsonResponse } from "../payments/webhooks/utils";
import { appendVelocityPackageAuditEntry } from "./audit";
import {
	buildVelocityWebhookEventIdempotencyKey,
	VELOCITY_PROVIDER,
} from "./constants";
import type {
	VelocityConnectorCredentialContext,
	VelocityPackageAuditEventType,
	VelocityWebhookAgent,
	VelocityWebhookPayload,
} from "./contracts";
import type {
	ProcessVelocityFullDealSyncArgs,
	VelocityFullDealSyncResult,
} from "./sync";

interface PersistedVelocityWebhookEvent {
	dealHref?: string;
	eventType?: number;
	isDuplicate: boolean;
	loanCode?: string;
	statusCode?: number;
	webhookEventId: Id<"velocityWebhookEvents">;
}

interface PersistVelocityWebhookEventsArgs {
	connectorCredentialContext: VelocityConnectorCredentialContext;
	payload: VelocityWebhookPayload;
	rawBody: string;
}

interface PersistVelocityWebhookEventsResult {
	acceptedEvents: PersistedVelocityWebhookEvent[];
	duplicateEvents: number;
}

type VelocityWebhookAuthResult =
	| { ok: true; credentialContext: VelocityConnectorCredentialContext }
	| { ok: false };

const optionalNullableString = v.optional(v.union(v.string(), v.null()));
const optionalNullableNumber = v.optional(v.union(v.number(), v.null()));

const persistVelocityWebhookEventsReference = makeFunctionReference<
	"mutation",
	Record<string, unknown> & PersistVelocityWebhookEventsArgs,
	Promise<PersistVelocityWebhookEventsResult>
>("velocity/webhook:persistVelocityWebhookEvents");

const processVelocityFullDealSyncReference = makeFunctionReference<
	"action",
	Record<string, unknown> & ProcessVelocityFullDealSyncArgs,
	Promise<VelocityFullDealSyncResult>
>("velocity/sync:processVelocityFullDealSync");

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown) {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value: unknown) {
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
}

function safeJsonParse(rawBody: string) {
	try {
		return JSON.parse(rawBody) as unknown;
	} catch {
		return null;
	}
}

function normalizeWebhookAgent(
	value: unknown
): VelocityWebhookAgent | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	return {
		email: optionalString(value.email) ?? null,
		firmCode: optionalString(value.firmCode) ?? null,
		firstName: optionalString(value.firstName) ?? null,
		lastName: optionalString(value.lastName) ?? null,
		tenantId: optionalString(value.tenantId) ?? null,
		username: optionalString(value.username) ?? null,
	};
}

function normalizeVelocityWebhookPayload(
	value: unknown
): VelocityWebhookPayload | null {
	if (!isRecord(value)) {
		return null;
	}

	const timestamp = optionalString(value.timestamp);
	if (!timestamp) {
		return null;
	}

	const events = Array.isArray(value.events)
		? value.events.filter(isRecord).map((event) => {
				const deal = isRecord(event.deal)
					? {
							loanCode: optionalString(event.deal.loanCode) ?? null,
							status: optionalNumber(event.deal.status) ?? null,
						}
					: null;
				const links = Array.isArray(event.links)
					? event.links.filter(isRecord).map((link) => ({
							href: optionalString(link.href) ?? null,
							method: optionalString(link.method) ?? null,
							rel: optionalString(link.rel) ?? null,
						}))
					: null;

				return {
					deal,
					eventType: optionalNumber(event.eventType) ?? null,
					links,
					timestamp: optionalString(event.timestamp) ?? null,
				};
			})
		: null;

	return {
		agent: normalizeWebhookAgent(value.agent) ?? null,
		events,
		timestamp,
	};
}

function timingSafeEqualString(left: string, right: string) {
	if (left.length !== right.length) {
		return false;
	}

	let result = 0;
	for (let index = 0; index < left.length; index += 1) {
		result |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return result === 0;
}

function bearerToken(header: string | null) {
	if (!header?.startsWith("Bearer ")) {
		return null;
	}

	return header.slice("Bearer ".length).trim();
}

function authenticateVelocityWebhook(
	request: Request
): VelocityWebhookAuthResult {
	const configuredSecret = process.env.VELOCITY_WEBHOOK_SECRET;
	const configuredToken =
		process.env.VELOCITY_WEBHOOK_TOKEN ?? process.env.VELOCITY_WEBHOOK_SECRET;
	const providedSecret = request.headers.get("x-velocity-webhook-secret");
	const providedToken = bearerToken(request.headers.get("authorization"));
	const isAuthenticated = Boolean(
		(configuredSecret &&
			providedSecret &&
			timingSafeEqualString(providedSecret, configuredSecret)) ||
			(configuredToken &&
				providedToken &&
				timingSafeEqualString(providedToken, configuredToken))
	);

	if (!isAuthenticated) {
		return { ok: false };
	}

	return {
		ok: true,
		credentialContext: {
			credentialId: process.env.VELOCITY_WEBHOOK_CREDENTIAL_ID ?? undefined,
			provider: VELOCITY_PROVIDER,
			scope: process.env.VELOCITY_WEBHOOK_CREDENTIAL_SCOPE ?? "webhook_ingress",
			usedFor: "webhook_ingress",
		},
	};
}

function extractDealHref(
	event: NonNullable<VelocityWebhookPayload["events"]>[number]
) {
	const links = event.links ?? [];
	return (
		links.find(
			(link) =>
				link.href &&
				link.rel?.toLowerCase() === "deal" &&
				(!link.method || link.method.toUpperCase() === "GET")
		)?.href ??
		links.find((link) => link.href)?.href ??
		undefined
	);
}

async function appendWebhookIngressAuditEntries(
	ctx: MutationCtx,
	args: {
		connectorCredentialContext: VelocityConnectorCredentialContext;
		error?: string;
		loanCode?: string;
		payload: VelocityWebhookPayload;
		providerEventId: string;
		status: "failed" | "pending";
		webhookEventId: Id<"velocityWebhookEvents">;
	}
) {
	const eventTypes: VelocityPackageAuditEventType[] = [
		"velocity_webhook_received",
		"velocity_webhook_provenance_recorded",
	];
	const workspaceId = `velocity_webhook:${String(args.webhookEventId)}`;

	for (const eventType of eventTypes) {
		await appendVelocityPackageAuditEntry(ctx, {
			actorId: args.payload.agent?.email ?? "velocity_webhook_system",
			actorType: "system",
			channel: "api_webhook",
			connectorCredentialContext: args.connectorCredentialContext,
			eventType,
			idempotencyKey: `${eventType}:${args.providerEventId}`,
			linkedRecordIds: {
				webhookEventId: String(args.webhookEventId),
			},
			outcome: args.status === "failed" ? "rejected" : "transitioned",
			payload: {
				error: args.error,
				loanCode: args.loanCode,
				providerEventId: args.providerEventId,
				status: args.status,
				webhookEventId: String(args.webhookEventId),
			},
			reason: args.error,
			webhookAgent: args.payload.agent ?? undefined,
			workspaceId,
		});
	}
}

export const persistVelocityWebhookEvents = convex
	.mutation()
	.input({
		connectorCredentialContext: v.object({
			credentialId: v.optional(v.string()),
			provider: v.literal("velocity"),
			scope: v.optional(v.string()),
			usedFor: v.literal("webhook_ingress"),
		}),
		payload: v.object({
			agent: v.optional(
				v.union(
					v.object({
						email: optionalNullableString,
						firmCode: optionalNullableString,
						firstName: optionalNullableString,
						lastName: optionalNullableString,
						tenantId: optionalNullableString,
						username: optionalNullableString,
					}),
					v.null()
				)
			),
			events: v.optional(
				v.union(
					v.array(
						v.object({
							deal: v.optional(
								v.union(
									v.object({
										loanCode: optionalNullableString,
										status: optionalNullableNumber,
									}),
									v.null()
								)
							),
							eventType: optionalNullableNumber,
							links: v.optional(
								v.union(
									v.array(
										v.object({
											href: optionalNullableString,
											method: optionalNullableString,
											rel: optionalNullableString,
										})
									),
									v.null()
								)
							),
							timestamp: optionalNullableString,
						})
					),
					v.null()
				)
			),
			timestamp: v.string(),
		}),
		rawBody: v.string(),
	})
	.handler(async (ctx, args): Promise<PersistVelocityWebhookEventsResult> => {
		const acceptedEvents: PersistedVelocityWebhookEvent[] = [];
		let duplicateEvents = 0;
		const now = Date.now();
		const events = args.payload.events ?? [];

		for (const event of events) {
			const loanCode = event.deal?.loanCode?.trim() || undefined;
			const idempotencyLoanCode = loanCode ?? "unknown";
			const providerEventId = buildVelocityWebhookEventIdempotencyKey({
				eventTimestamp: event.timestamp ?? args.payload.timestamp,
				eventType: event.eventType,
				loanCode: idempotencyLoanCode,
				status: event.deal?.status,
			});
			const existing = await ctx.db
				.query("velocityWebhookEvents")
				.withIndex("by_provider_event", (query) =>
					query
						.eq("provider", VELOCITY_PROVIDER)
						.eq("providerEventId", providerEventId)
				)
				.first();

			if (existing) {
				duplicateEvents += 1;
				acceptedEvents.push({
					dealHref: existing.dealHref,
					eventType: existing.eventType,
					isDuplicate: true,
					loanCode: existing.loanCode ?? loanCode,
					statusCode: existing.statusCode,
					webhookEventId: existing._id,
				});
				continue;
			}

			const dealHref = extractDealHref(event);
			const status = loanCode ? "pending" : "failed";
			const error = loanCode ? undefined : "missing_loan_code";
			const webhookEventId = await ctx.db.insert("velocityWebhookEvents", {
				attempts: 0,
				connectorCredentialContext: {
					...args.connectorCredentialContext,
					email: args.payload.agent?.email,
					firmCode: args.payload.agent?.firmCode,
					tenantId: args.payload.agent?.tenantId,
					username: args.payload.agent?.username,
				},
				dealHref,
				eventType: event.eventType ?? undefined,
				loanCode,
				error,
				provider: VELOCITY_PROVIDER,
				providerEventId,
				rawBody: args.rawBody,
				receivedAt: now,
				signatureVerified: true,
				status,
				statusCode: event.deal?.status ?? undefined,
				webhookAgent: args.payload.agent ?? undefined,
			});
			await appendWebhookIngressAuditEntries(ctx, {
				connectorCredentialContext: {
					...args.connectorCredentialContext,
					email: args.payload.agent?.email,
					firmCode: args.payload.agent?.firmCode,
					tenantId: args.payload.agent?.tenantId,
					username: args.payload.agent?.username,
				},
				error,
				loanCode,
				payload: args.payload,
				providerEventId,
				status,
				webhookEventId,
			});

			acceptedEvents.push({
				dealHref,
				eventType: event.eventType ?? undefined,
				isDuplicate: false,
				loanCode,
				statusCode: event.deal?.status ?? undefined,
				webhookEventId,
			});
		}

		return { acceptedEvents, duplicateEvents };
	})
	.internal();

export const velocityWebhook = httpAction(async (ctx, request) => {
	const authResult = authenticateVelocityWebhook(request);
	if (!authResult.ok) {
		return jsonResponse({ ok: false, error: "unauthorized" }, 401);
	}

	const rawBody = await request.text();
	const payload = normalizeVelocityWebhookPayload(safeJsonParse(rawBody));
	if (!payload) {
		return jsonResponse({ ok: false, error: "invalid_payload" }, 400);
	}

	const persisted = await ctx.runMutation(
		persistVelocityWebhookEventsReference,
		{
			connectorCredentialContext: authResult.credentialContext,
			payload,
			rawBody,
		}
	);

	for (const event of persisted.acceptedEvents) {
		if (event.isDuplicate || !event.loanCode) {
			continue;
		}
		await ctx.runAction(processVelocityFullDealSyncReference, {
			dealHref: event.dealHref,
			loanCode: event.loanCode,
			trigger: "webhook",
			webhookAgent: payload.agent ?? undefined,
			webhookCredentialContext: authResult.credentialContext,
			webhookEventId: event.webhookEventId,
		});
	}

	return jsonResponse({
		ok: true,
		acceptedEvents: persisted.acceptedEvents.filter(
			(event) => !event.isDuplicate
		).length,
		duplicateEvents: persisted.duplicateEvents,
	});
});
