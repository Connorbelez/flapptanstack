import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
	type ActionCtx,
	httpAction,
	internalMutation,
	type MutationCtx,
} from "../_generated/server";
import {
	type DealEnvelopeProviderEventType,
	dealEnvelopeProviderEventTypeValidator,
} from "../documents/contracts";
import { summarizeRequiredRecipientCompletion } from "./envelopes";

type JsonRecord = Record<string, unknown>;

interface ParsedDocumensoEvent {
	normalizedEventType: DealEnvelopeProviderEventType;
	providerDocumentId?: string;
	providerEnvelopeId?: string;
	providerEventId: string;
	providerRecipientId?: string;
	rawEventType: string;
}

const terminalAttemptStatuses = new Set<Doc<"dealEnvelopeAttempts">["status"]>([
	"completed",
	"declined",
	"voided",
	"expired",
	"configuration_error",
	"send_failed",
	"reissue_required",
]);

function isTerminalAttemptStatus(
	status: Doc<"dealEnvelopeAttempts">["status"]
) {
	return terminalAttemptStatuses.has(status);
}

function isTerminalProviderEvent(eventType: DealEnvelopeProviderEventType) {
	return (
		eventType === "document_declined" ||
		eventType === "document_voided" ||
		eventType === "document_expired"
	);
}

function jsonResponse(body: JsonRecord, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function asRecord(value: unknown): JsonRecord | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as JsonRecord)
		: null;
}

function stringValue(record: JsonRecord, keys: readonly string[]) {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim().length > 0) {
			return value.trim();
		}
		if (typeof value === "number") {
			return String(value);
		}
	}
	return undefined;
}

function nestedStringValue(
	record: JsonRecord,
	key: string,
	keys: readonly string[]
) {
	const nested = asRecord(record[key]);
	return nested ? stringValue(nested, keys) : undefined;
}

function compactRecords(...values: Array<JsonRecord | null | undefined>) {
	return values.filter((value): value is JsonRecord => Boolean(value));
}

function stringValueFromRecords(
	records: readonly JsonRecord[],
	keys: readonly string[]
) {
	for (const record of records) {
		const value = stringValue(record, keys);
		if (value) {
			return value;
		}
	}
	return undefined;
}

function nestedStringValueFromRecords(
	records: readonly JsonRecord[],
	key: string,
	keys: readonly string[]
) {
	for (const record of records) {
		const value = nestedStringValue(record, key, keys);
		if (value) {
			return value;
		}
	}
	return undefined;
}

function arrayValue(record: JsonRecord, keys: readonly string[]) {
	for (const key of keys) {
		const value = record[key];
		if (Array.isArray(value)) {
			return value;
		}
	}
	return [];
}

function recipientMatchesEventType(
	recipient: JsonRecord,
	eventType: DealEnvelopeProviderEventType
) {
	const status =
		stringValue(recipient, [
			"signingStatus",
			"signing_status",
			"status",
			"readStatus",
			"read_status",
		])?.toLowerCase() ?? "";
	if (
		eventType === "recipient_completed" ||
		eventType === "recipient_signed" ||
		eventType === "document_completed"
	) {
		return (
			status.includes("signed") ||
			status.includes("completed") ||
			status.includes("complete")
		);
	}
	if (eventType === "recipient_opened") {
		return status.includes("opened") || status.includes("viewed");
	}
	if (eventType === "document_declined") {
		return status.includes("rejected") || status.includes("declined");
	}
	return false;
}

function recipientIdFromPayload(
	payload: JsonRecord | null,
	eventType: DealEnvelopeProviderEventType
) {
	if (!payload) {
		return undefined;
	}
	const directRecipient =
		nestedStringValue(payload, "recipient", ["id", "recipientId"]) ??
		nestedStringValue(payload, "Recipient", ["id", "recipientId"]);
	if (directRecipient) {
		return directRecipient;
	}
	const recipients = arrayValue(payload, ["recipients", "Recipient"]);
	const matchingRecipient = recipients
		.map(asRecord)
		.find((recipient) =>
			recipient ? recipientMatchesEventType(recipient, eventType) : false
		);
	return matchingRecipient
		? stringValue(matchingRecipient, ["id", "recipientId"])
		: undefined;
}

export function normalizeDocumensoEventType(
	rawType: string
): DealEnvelopeProviderEventType {
	const normalized = rawType.toLowerCase().replaceAll(".", "_");
	if (normalized.includes("sent")) {
		return "document_sent";
	}
	if (normalized.includes("opened") || normalized.includes("viewed")) {
		return "recipient_opened";
	}
	if (normalized.includes("recipient") && normalized.includes("complete")) {
		return "recipient_completed";
	}
	if (normalized.includes("signed")) {
		return "recipient_signed";
	}
	if (normalized.includes("complete")) {
		return "document_completed";
	}
	if (normalized.includes("declined") || normalized.includes("rejected")) {
		return "document_declined";
	}
	if (normalized.includes("void") || normalized.includes("cancel")) {
		return "document_voided";
	}
	if (normalized.includes("expired")) {
		return "document_expired";
	}
	if (normalized.includes("reminder")) {
		return "reminder_sent";
	}
	if (normalized.includes("created")) {
		return "document_created";
	}
	return "unknown";
}

export function parseDocumensoWebhookEvent(
	body: string
):
	| { ok: true; event: ParsedDocumensoEvent }
	| { ok: false; response: Response } {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		return {
			ok: false,
			response: jsonResponse({ error: "invalid_json" }, 400),
		};
	}

	const record = asRecord(parsed);
	if (!record) {
		return {
			ok: false,
			response: jsonResponse({ error: "invalid_event_shape" }, 400),
		};
	}

	const rawEventType =
		stringValue(record, ["event", "eventType", "type"]) ?? "unknown";
	const normalizedEventType = normalizeDocumensoEventType(rawEventType);
	const payload = asRecord(record.payload);
	const data = asRecord(record.data);
	const payloadData = payload ? asRecord(payload.data) : null;
	const eventRecords = compactRecords(record, payload, data, payloadData);
	const payloadRecords = compactRecords(payload, payloadData);
	const providerDocumentId =
		stringValueFromRecords(eventRecords, [
			"documentId",
			"document_id",
			"providerDocumentId",
		]) ??
		stringValueFromRecords(payloadRecords, ["id"]) ??
		nestedStringValueFromRecords(eventRecords, "document", [
			"id",
			"documentId",
		]);
	const providerEnvelopeId =
		stringValueFromRecords(eventRecords, [
			"envelopeId",
			"envelope_id",
			"providerEnvelopeId",
		]) ??
		nestedStringValueFromRecords(eventRecords, "envelope", [
			"id",
			"envelopeId",
		]);
	const providerRecipientId =
		stringValueFromRecords(eventRecords, [
			"recipientId",
			"recipient_id",
			"providerRecipientId",
		]) ??
		nestedStringValueFromRecords(eventRecords, "recipient", [
			"id",
			"recipientId",
		]) ??
		recipientIdFromPayload(payload, normalizedEventType);
	const providerEventId =
		stringValueFromRecords(eventRecords, [
			"id",
			"eventId",
			"event_id",
			"providerEventId",
		]) ??
		[
			providerDocumentId ?? providerEnvelopeId ?? "unresolved",
			providerRecipientId ?? "document",
			rawEventType,
		].join(":");

	return {
		ok: true,
		event: {
			providerEventId,
			providerDocumentId,
			providerEnvelopeId,
			providerRecipientId,
			rawEventType,
			normalizedEventType,
		},
	};
}

async function verifyDocumensoWebhookRequest(
	ctx: ActionCtx,
	args: { providedSecret: string | null }
) {
	if (!args.providedSecret) {
		return jsonResponse({ error: "missing_secret_header" }, 401);
	}
	const verification = await ctx.runAction(
		internal.payments.webhooks.verification.verifyDocumensoSecretAction,
		{ providedSecret: args.providedSecret }
	);
	if (verification.ok) {
		return null;
	}
	return jsonResponse({ error: verification.error }, 401);
}

export const persistDocumensoProviderEvent = internalMutation({
	args: {
		providerEventId: v.string(),
		providerDocumentId: v.optional(v.string()),
		providerEnvelopeId: v.optional(v.string()),
		providerRecipientId: v.optional(v.string()),
		rawBody: v.string(),
		rawEventType: v.string(),
		normalizedEventType: dealEnvelopeProviderEventTypeValidator,
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("dealEnvelopeProviderEvents")
			.withIndex("by_provider_event", (query) =>
				query
					.eq("provider", "documenso")
					.eq("providerEventId", args.providerEventId)
			)
			.first();

		if (existing) {
			return { duplicate: true, webhookEventId: existing._id };
		}

		const webhookEventId = await ctx.db.insert("dealEnvelopeProviderEvents", {
			provider: "documenso",
			providerEventId: args.providerEventId,
			providerDocumentId: args.providerDocumentId,
			providerEnvelopeId: args.providerEnvelopeId,
			providerRecipientId: args.providerRecipientId,
			rawBody: args.rawBody,
			rawEventType: args.rawEventType,
			normalizedEventType: args.normalizedEventType,
			status: "pending",
			signatureVerified: true,
			dealId: undefined,
			attemptId: undefined,
			recipientId: undefined,
			error: undefined,
			attempts: 0,
			receivedAt: Date.now(),
			processedAt: undefined,
		});
		return { duplicate: false, webhookEventId };
	},
});

async function findAttemptForEvent(
	ctx: Pick<MutationCtx, "db">,
	event: Doc<"dealEnvelopeProviderEvents">
) {
	if (event.providerDocumentId) {
		const byDocument = await ctx.db
			.query("dealEnvelopeAttempts")
			.withIndex("by_provider_document", (query) =>
				query
					.eq("provider", "documenso")
					.eq("providerDocumentId", event.providerDocumentId)
			)
			.first();
		if (byDocument) {
			return byDocument;
		}
	}
	if (event.providerEnvelopeId) {
		return ctx.db
			.query("dealEnvelopeAttempts")
			.withIndex("by_provider_envelope", (query) =>
				query
					.eq("provider", "documenso")
					.eq("providerEnvelopeId", event.providerEnvelopeId)
			)
			.first();
	}
	return null;
}

async function findRecipientForEvent(
	ctx: Pick<MutationCtx, "db">,
	event: Doc<"dealEnvelopeProviderEvents">,
	attemptId: Id<"dealEnvelopeAttempts">
) {
	if (!event.providerRecipientId) {
		return null;
	}
	return ctx.db
		.query("dealEnvelopeRecipients")
		.withIndex("by_attempt_provider_recipient", (query) =>
			query
				.eq("attemptId", attemptId)
				.eq("providerRecipientId", event.providerRecipientId)
		)
		.first();
}

async function insertWebhookException(
	ctx: Pick<MutationCtx, "db">,
	args: {
		event: Doc<"dealEnvelopeProviderEvents">;
		attempt: Doc<"dealEnvelopeAttempts">;
		recipientId?: Id<"dealEnvelopeRecipients">;
		kind: Doc<"dealSigningExceptions">["kind"];
		message: string;
	}
) {
	const now = Date.now();
	await ctx.db.insert("dealSigningExceptions", {
		dealId: args.attempt.dealId,
		packageId: args.attempt.packageId,
		dealDocumentInstanceId: args.attempt.dealDocumentInstanceId,
		attemptId: args.attempt._id,
		recipientId: args.recipientId,
		providerEventId: args.event._id,
		kind: args.kind,
		status: "open",
		severity: "blocking",
		message: args.message,
		details: {
			providerEventId: args.event.providerEventId,
			normalizedEventType: args.event.normalizedEventType,
		},
		createdAt: now,
		updatedAt: now,
		resolvedAt: undefined,
		resolvedBy: undefined,
	});
}

async function markEventFailed(
	ctx: Pick<MutationCtx, "db">,
	event: Doc<"dealEnvelopeProviderEvents">,
	error: string,
	now: number
) {
	await ctx.db.patch(event._id, {
		status: "failed",
		error,
		attempts: event.attempts + 1,
		processedAt: now,
	});
}

async function listAttemptRecipients(
	ctx: Pick<MutationCtx, "db">,
	attemptId: Id<"dealEnvelopeAttempts">
) {
	return ctx.db
		.query("dealEnvelopeRecipients")
		.withIndex("by_attempt", (query) => query.eq("attemptId", attemptId))
		.collect();
}

async function applyDocumentSent(
	ctx: Pick<MutationCtx, "db">,
	args: {
		attempt: Doc<"dealEnvelopeAttempts">;
		recipients: Doc<"dealEnvelopeRecipients">[];
		now: number;
	}
) {
	await ctx.db.patch(args.attempt._id, {
		status: "sent",
		updatedAt: args.now,
	});
	for (const row of args.recipients) {
		await ctx.db.patch(row._id, {
			sendStatus: "sent",
			sentAt: row.sentAt ?? args.now,
			updatedAt: args.now,
		});
	}
}

async function applyRecipientOpened(
	ctx: Pick<MutationCtx, "db">,
	recipient: Doc<"dealEnvelopeRecipients">,
	now: number
) {
	await ctx.db.patch(recipient._id, {
		readStatus: "opened",
		signingStatus:
			recipient.signingStatus === "not_started"
				? "in_progress"
				: recipient.signingStatus,
		openedAt: recipient.openedAt ?? now,
		updatedAt: now,
	});
}

async function applyRecipientCompleted(
	ctx: Pick<MutationCtx, "db">,
	recipient: Doc<"dealEnvelopeRecipients">,
	now: number
) {
	await ctx.db.patch(recipient._id, {
		signingStatus: "completed",
		completedAt: recipient.completedAt ?? now,
		updatedAt: now,
	});
}

async function applyDocumentDeclined(
	ctx: Pick<MutationCtx, "db">,
	args: {
		event: Doc<"dealEnvelopeProviderEvents">;
		attempt: Doc<"dealEnvelopeAttempts">;
		recipient: Doc<"dealEnvelopeRecipients"> | null;
		now: number;
	}
) {
	if (args.recipient) {
		await ctx.db.patch(args.recipient._id, {
			signingStatus: "rejected",
			rejectionReason: "Documenso recipient declined",
			updatedAt: args.now,
		});
	}
	await ctx.db.patch(args.attempt._id, {
		status: "declined",
		terminalReason: "Documenso document declined",
		terminalAt: args.now,
		updatedAt: args.now,
	});
	await insertWebhookException(ctx, {
		event: args.event,
		attempt: args.attempt,
		recipientId: args.recipient?._id,
		kind: "recipient_rejection",
		message: "Documenso recipient declined the envelope",
	});
}

async function applyDocumentStopped(
	ctx: Pick<MutationCtx, "db">,
	args: {
		event: Doc<"dealEnvelopeProviderEvents">;
		attempt: Doc<"dealEnvelopeAttempts">;
		now: number;
	}
) {
	const expired = args.event.normalizedEventType === "document_expired";
	await ctx.db.patch(args.attempt._id, {
		status: expired ? "expired" : "voided",
		terminalReason: expired
			? "Documenso document expired"
			: "Documenso document voided",
		terminalAt: args.now,
		updatedAt: args.now,
	});
	await insertWebhookException(ctx, {
		event: args.event,
		attempt: args.attempt,
		kind: "envelope_cancelled_or_voided",
		message: expired
			? "Documenso document expired"
			: "Documenso document was voided",
	});
}

async function reconcileCompletion(
	ctx: Pick<MutationCtx, "db">,
	args: {
		event: Doc<"dealEnvelopeProviderEvents">;
		attempt: Doc<"dealEnvelopeAttempts">;
		now: number;
	}
) {
	const attempt = await ctx.db.get(args.attempt._id);
	if (!attempt || isTerminalAttemptStatus(attempt.status)) {
		return false;
	}
	const refreshedRecipients = await listAttemptRecipients(
		ctx,
		args.attempt._id
	);
	const completion = summarizeRequiredRecipientCompletion(refreshedRecipients);
	const providerSaysComplete =
		args.event.normalizedEventType === "document_completed";

	if (providerSaysComplete && !completion.isComplete) {
		await ctx.db.patch(args.attempt._id, {
			status: "partially_signed",
			updatedAt: args.now,
		});
		await insertWebhookException(ctx, {
			event: args.event,
			attempt: args.attempt,
			kind: "reconciliation_mismatch",
			message:
				"Documenso reported completion before FairLend required recipients completed",
		});
		return false;
	}

	if (completion.isComplete) {
		const shouldClaimCompletion =
			attempt.completionTransitionRequestedAt === undefined &&
			attempt.completionTransitionEmittedAt === undefined;
		await ctx.db.patch(args.attempt._id, {
			status: "completed",
			terminalAt: attempt.terminalAt ?? args.now,
			completionTransitionRequestedAt: shouldClaimCompletion
				? args.now
				: attempt.completionTransitionRequestedAt,
			updatedAt: args.now,
		});
		await ctx.db.patch(args.attempt.dealDocumentInstanceId, {
			status: "signed",
			lastError: undefined,
			updatedAt: args.now,
		});
		return shouldClaimCompletion;
	}

	if (
		refreshedRecipients.some(
			(row) => row.signingStatus === "completed" && row.required
		)
	) {
		await ctx.db.patch(args.attempt._id, {
			status: "partially_signed",
			updatedAt: args.now,
		});
		await ctx.db.patch(args.attempt.dealDocumentInstanceId, {
			status: "signature_partially_signed",
			updatedAt: args.now,
		});
	}

	return false;
}

export const processDocumensoProviderEvent = internalMutation({
	args: {
		webhookEventId: v.id("dealEnvelopeProviderEvents"),
	},
	handler: async (ctx, args) => {
		const event = await ctx.db.get(args.webhookEventId);
		if (!event) {
			throw new Error("Documenso webhook event not found");
		}
		if (event.status === "processed") {
			return { shouldEmitAllPartiesSigned: false };
		}

		const now = Date.now();
		const attempt = await findAttemptForEvent(ctx, event);
		if (!attempt?.active) {
			await markEventFailed(
				ctx,
				event,
				"No active envelope attempt matched provider event",
				now
			);
			return { shouldEmitAllPartiesSigned: false };
		}

		const recipient = await findRecipientForEvent(ctx, event, attempt._id);
		if (isTerminalAttemptStatus(attempt.status)) {
			await ctx.db.patch(event._id, {
				status: "processed",
				dealId: attempt.dealId,
				attemptId: attempt._id,
				recipientId: recipient?._id,
				attempts: event.attempts + 1,
				processedAt: now,
				error: undefined,
			});
			return {
				shouldEmitAllPartiesSigned: false,
				attemptId: attempt._id,
				dealId: attempt.dealId,
			};
		}
		const recipients = await listAttemptRecipients(ctx, attempt._id);

		if (event.normalizedEventType === "document_sent") {
			await applyDocumentSent(ctx, { attempt, recipients, now });
		}

		if (recipient && event.normalizedEventType === "recipient_opened") {
			await applyRecipientOpened(ctx, recipient, now);
		}

		if (
			recipient &&
			(event.normalizedEventType === "recipient_signed" ||
				event.normalizedEventType === "recipient_completed")
		) {
			await applyRecipientCompleted(ctx, recipient, now);
		}

		if (event.normalizedEventType === "document_declined") {
			await applyDocumentDeclined(ctx, { event, attempt, recipient, now });
		}

		if (
			event.normalizedEventType === "document_voided" ||
			event.normalizedEventType === "document_expired"
		) {
			await applyDocumentStopped(ctx, { event, attempt, now });
		}

		if (isTerminalProviderEvent(event.normalizedEventType)) {
			await ctx.db.patch(event._id, {
				status: "processed",
				dealId: attempt.dealId,
				attemptId: attempt._id,
				recipientId: recipient?._id,
				attempts: event.attempts + 1,
				processedAt: now,
				error: undefined,
			});
			return {
				shouldEmitAllPartiesSigned: false,
				attemptId: attempt._id,
				dealId: attempt.dealId,
			};
		}

		const shouldEmitAllPartiesSigned = await reconcileCompletion(ctx, {
			event,
			attempt,
			now,
		});

		await ctx.db.patch(event._id, {
			status: "processed",
			dealId: attempt.dealId,
			attemptId: attempt._id,
			recipientId: recipient?._id,
			attempts: event.attempts + 1,
			processedAt: now,
			error: undefined,
		});

		return {
			shouldEmitAllPartiesSigned,
			attemptId: attempt._id,
			dealId: attempt.dealId,
		};
	},
});

async function emitAllPartiesSignedIfNeeded(
	ctx: ActionCtx,
	args: {
		attemptId?: Id<"dealEnvelopeAttempts">;
		dealId?: Id<"deals">;
		shouldEmitAllPartiesSigned: boolean;
	}
) {
	if (!(args.shouldEmitAllPartiesSigned && args.attemptId && args.dealId)) {
		return;
	}
	const result = await ctx.runMutation(
		internal.engine.transitionMutation.transitionMutation,
		{
			entityType: "deal",
			entityId: args.dealId,
			eventType: "ALL_PARTIES_SIGNED",
			payload: {},
			source: {
				channel: "api_webhook",
				actorType: "system",
			},
		}
	);
	if (result.success) {
		await ctx.runMutation(
			internal.deals.envelopes.markCompletionTransitionEmittedInternal,
			{
				attemptId: args.attemptId,
				journalEntryId: result.journalEntryId,
			}
		);
	}
}

export const documensoWebhook = httpAction(async (ctx, request) => {
	const body = await request.text();
	const providedSecret =
		request.headers.get("X-Documenso-Secret") ??
		request.headers.get("x-documenso-secret");
	const verificationError = await verifyDocumensoWebhookRequest(ctx, {
		providedSecret,
	});
	if (verificationError) {
		return verificationError;
	}

	const parsed = parseDocumensoWebhookEvent(body);
	if (!parsed.ok) {
		return parsed.response;
	}

	const persisted = await ctx.runMutation(
		internal.deals.envelopeWebhooks.persistDocumensoProviderEvent,
		{
			...parsed.event,
			rawBody: body,
		}
	);
	if (persisted.duplicate) {
		return jsonResponse({ accepted: true, duplicate: true });
	}

	const processed = await ctx.runMutation(
		internal.deals.envelopeWebhooks.processDocumensoProviderEvent,
		{ webhookEventId: persisted.webhookEventId }
	);
	await emitAllPartiesSignedIfNeeded(ctx, processed);

	return jsonResponse({ accepted: true });
});
