import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { assertDealAccess } from "../authz/resourceAccess";
import {
	type DealEnvelopeAttemptStatus,
	type DealEnvelopeRecipientSnapshot,
	dealEnvelopeAttemptStatusValidator,
	dealEnvelopeProviderValidator,
	dealEnvelopeRecipientDocumensoRoleValidator,
	dealEnvelopeRecipientReadStatusValidator,
	dealEnvelopeRecipientSendStatusValidator,
	dealEnvelopeRecipientSigningStatusValidator,
} from "../documents/contracts";
import { convex, dealMutation, dealQuery } from "../fluent";
import {
	buildDealParticipantProjection,
	type DealParticipantProjection,
} from "./participantProjection";

type EnvelopeMutationCtx = Pick<MutationCtx, "db">;
type EnvelopeQueryCtx = Pick<QueryCtx, "db">;

type RecipientRow = Doc<"dealEnvelopeRecipients">;

const DEFAULT_REQUIRED_PLATFORM_ROLES = ["purchasing_lender", "primary_lawyer"];

export interface RecipientCompletionSummary {
	completedRequiredCount: number;
	isComplete: boolean;
	requiredCount: number;
}

export function summarizeRequiredRecipientCompletion(
	recipients: readonly Pick<RecipientRow, "required" | "signingStatus">[]
): RecipientCompletionSummary {
	const required = recipients.filter((recipient) => recipient.required);
	const completedRequiredCount = required.filter(
		(recipient) => recipient.signingStatus === "completed"
	).length;
	return {
		completedRequiredCount,
		isComplete:
			required.length > 0 && completedRequiredCount === required.length,
		requiredCount: required.length,
	};
}

export function isSigningOrderAvailable(
	recipients: readonly Pick<
		RecipientRow,
		"required" | "signingOrder" | "signingStatus"
	>[],
	recipient: Pick<RecipientRow, "signingOrder">
) {
	return recipients
		.filter(
			(candidate) =>
				candidate.required && candidate.signingOrder < recipient.signingOrder
		)
		.every((candidate) => candidate.signingStatus === "completed");
}

export function canExposeEmbeddedSigningToken(args: {
	recipient: Pick<RecipientRow, "authId" | "email" | "tokenExpiresAt">;
	viewerAuthId: string;
	viewerEmail?: string;
	now: number;
}) {
	if (
		args.recipient.tokenExpiresAt !== undefined &&
		args.recipient.tokenExpiresAt <= args.now
	) {
		return false;
	}
	if (args.recipient.authId && args.recipient.authId === args.viewerAuthId) {
		return true;
	}
	return Boolean(
		args.viewerEmail &&
			args.recipient.email.toLowerCase() === args.viewerEmail.toLowerCase()
	);
}

export function classifyTerminalAttemptStatus(
	status: DealEnvelopeAttemptStatus
) {
	if (status === "configuration_error") {
		return "pre_send_configuration_failure";
	}
	if (status === "send_failed") {
		return "send_failure";
	}
	if (status === "declined") {
		return "recipient_rejection";
	}
	if (status === "voided" || status === "expired") {
		return "envelope_cancelled_or_voided";
	}
	return null;
}

function requireRow<T>(row: T | null, message: string): T {
	if (!row) {
		throw new ConvexError(message);
	}
	return row;
}

function normalizeEmail(value: string | null | undefined) {
	return value?.trim().toLowerCase() ?? "";
}

function canonicalPlatformRole(platformRole: string) {
	switch (platformRole) {
		case "lender":
		case "lender_primary":
			return "purchasing_lender";
		case "borrower":
		case "borrower_primary":
			return "primary_borrower";
		case "borrower_co_1":
			return "co_borrower_1";
		case "borrower_co_2":
			return "co_borrower_2";
		case "lawyer_primary":
		case "borrower_lawyer":
		case "lender_lawyer":
		case "seller_lawyer":
			return "primary_lawyer";
		default:
			return platformRole;
	}
}

function recipientForPlatformRole(
	participants: DealParticipantProjection,
	platformRole: string
): {
	authId?: string;
	email: string;
	name: string;
} | null {
	const canonicalRole = canonicalPlatformRole(platformRole);
	if (canonicalRole === "purchasing_lender") {
		return {
			authId: participants.purchasing_lender.authId,
			email: normalizeEmail(participants.purchasing_lender.email),
			name: participants.purchasing_lender.displayName,
		};
	}
	if (canonicalRole === "selling_lender") {
		return {
			authId: participants.selling_lender.authId,
			email: normalizeEmail(participants.selling_lender.email),
			name: participants.selling_lender.displayName,
		};
	}
	if (canonicalRole === "primary_borrower") {
		return {
			authId: participants.primary_borrower.authId ?? undefined,
			email: normalizeEmail(participants.primary_borrower.email),
			name: participants.primary_borrower.displayName ?? "Primary borrower",
		};
	}
	if (
		canonicalRole === "primary_lawyer" &&
		participants.primary_lawyer.authId
	) {
		return {
			authId: participants.primary_lawyer.authId,
			email: normalizeEmail(participants.primary_lawyer.email),
			name: participants.primary_lawyer.displayName ?? "Assigned lawyer",
		};
	}
	return null;
}

function uniqueRequiredPlatformRoles(
	blueprint: Doc<"mortgageDocumentBlueprints"> | null
) {
	const roles = blueprint?.templateSnapshotMeta?.requiredPlatformRoles ?? [];
	const fallback = roles.length > 0 ? roles : DEFAULT_REQUIRED_PLATFORM_ROLES;
	return [...new Set(fallback)].sort();
}

function documensoRoleForPlatformRole(platformRole: string) {
	return canonicalPlatformRole(platformRole) === "primary_lawyer"
		? "APPROVER"
		: "SIGNER";
}

function buildRecipientRoster(args: {
	blueprint: Doc<"mortgageDocumentBlueprints"> | null;
	participants: DealParticipantProjection;
	tokenInputs: readonly RecipientTokenInput[];
}): {
	errors: string[];
	recipients: DealEnvelopeRecipientSnapshot[];
} {
	const errors: string[] = [];
	const recipients: DealEnvelopeRecipientSnapshot[] = [];
	const tokenByPlatformRole = new Map(
		args.tokenInputs.map((token) => [token.platformRole, token])
	);

	for (const platformRole of uniqueRequiredPlatformRoles(args.blueprint)) {
		const recipient = recipientForPlatformRole(args.participants, platformRole);
		if (!(recipient?.email && recipient.name)) {
			errors.push(`Missing signatory mapping for ${platformRole}`);
			continue;
		}
		const tokenInput = tokenByPlatformRole.get(platformRole);
		recipients.push({
			authId: recipient.authId,
			email: recipient.email,
			name: recipient.name,
			platformRole,
			documensoRole: documensoRoleForPlatformRole(platformRole),
			signingOrder:
				canonicalPlatformRole(platformRole) === "primary_lawyer" ? 2 : 1,
			required: true,
			providerRecipientId: tokenInput?.providerRecipientId,
			tokenAvailableAt: tokenInput?.embeddedSigningToken
				? Date.now()
				: undefined,
			tokenExpiresAt: tokenInput?.tokenExpiresAt,
			sendStatus: "pending",
			readStatus: tokenInput?.embeddedSigningToken
				? "available"
				: "not_available",
			signingStatus: "not_started",
			rejectionReason: undefined,
			completedAt: undefined,
		});
	}

	return { errors, recipients };
}

async function nextAttemptNumber(
	ctx: EnvelopeQueryCtx,
	instanceId: Id<"dealDocumentInstances">
) {
	const attempts = await ctx.db
		.query("dealEnvelopeAttempts")
		.withIndex("by_instance", (query) =>
			query.eq("dealDocumentInstanceId", instanceId)
		)
		.collect();
	return (
		attempts.reduce((max, attempt) => Math.max(max, attempt.attemptNumber), 0) +
		1
	);
}

async function getActiveAttemptForInstance(
	ctx: EnvelopeQueryCtx,
	instanceId: Id<"dealDocumentInstances">
) {
	return ctx.db
		.query("dealEnvelopeAttempts")
		.withIndex("by_instance_active", (query) =>
			query.eq("dealDocumentInstanceId", instanceId).eq("active", true)
		)
		.first();
}

async function createSigningException(
	ctx: EnvelopeMutationCtx,
	args: {
		dealId: Id<"deals">;
		packageId?: Id<"dealDocumentPackages">;
		dealDocumentInstanceId?: Id<"dealDocumentInstances">;
		attemptId?: Id<"dealEnvelopeAttempts">;
		recipientId?: Id<"dealEnvelopeRecipients">;
		kind: Doc<"dealSigningExceptions">["kind"];
		severity?: Doc<"dealSigningExceptions">["severity"];
		message: string;
		details?: Record<string, string>;
		now: number;
	}
) {
	return ctx.db.insert("dealSigningExceptions", {
		dealId: args.dealId,
		packageId: args.packageId,
		dealDocumentInstanceId: args.dealDocumentInstanceId,
		attemptId: args.attemptId,
		recipientId: args.recipientId,
		providerEventId: undefined,
		kind: args.kind,
		status: "open",
		severity: args.severity ?? "blocking",
		message: args.message,
		details: args.details,
		createdAt: args.now,
		updatedAt: args.now,
		resolvedAt: undefined,
		resolvedBy: undefined,
	});
}

async function createAttemptRows(
	ctx: EnvelopeMutationCtx,
	args: {
		deal: Doc<"deals">;
		instance: Doc<"dealDocumentInstances">;
		packageRow: Doc<"dealDocumentPackages">;
		blueprint: Doc<"mortgageDocumentBlueprints"> | null;
		status: DealEnvelopeAttemptStatus;
		providerDocumentId?: string;
		providerEnvelopeId?: string;
		terminalReason?: string;
		tokenInputs: readonly RecipientTokenInput[];
		supersedesAttemptId?: Id<"dealEnvelopeAttempts">;
		now: number;
	}
) {
	const participants = await buildDealParticipantProjection(ctx, args.deal);
	const roster = buildRecipientRoster({
		blueprint: args.blueprint,
		participants,
		tokenInputs: args.tokenInputs,
	});
	const status = roster.errors.length > 0 ? "configuration_error" : args.status;
	const attemptNumber = await nextAttemptNumber(ctx, args.instance._id);

	if (args.supersedesAttemptId) {
		await ctx.db.patch(args.supersedesAttemptId, {
			active: false,
			status: "reissue_required",
			supersededByAttemptId: undefined,
			terminalReason: "Superseded by reissue",
			terminalAt: args.now,
			updatedAt: args.now,
		});
	}

	const attemptId = await ctx.db.insert("dealEnvelopeAttempts", {
		dealId: args.deal._id,
		packageId: args.packageRow._id,
		dealDocumentInstanceId: args.instance._id,
		generatedDocumentId: args.instance.generatedDocumentId,
		provider: "documenso",
		providerDocumentId: args.providerDocumentId,
		providerEnvelopeId: args.providerEnvelopeId,
		attemptNumber,
		status,
		recipientRoster: roster.recipients,
		active: status !== "configuration_error",
		idempotencyKey: [
			"documenso",
			args.instance._id,
			attemptNumber,
			args.providerDocumentId ?? "pending",
		].join(":"),
		supersedesAttemptId: args.supersedesAttemptId,
		supersededByAttemptId: undefined,
		terminalReason:
			status === "configuration_error"
				? roster.errors.join("; ")
				: args.terminalReason,
		terminalAt: status === "configuration_error" ? args.now : undefined,
		completionTransitionRequestedAt: undefined,
		completionTransitionEmittedAt: undefined,
		completionJournalEntryId: undefined,
		createdAt: args.now,
		updatedAt: args.now,
	});

	if (args.supersedesAttemptId) {
		await ctx.db.patch(args.supersedesAttemptId, {
			supersededByAttemptId: attemptId,
			updatedAt: args.now,
		});
	}

	for (const recipient of roster.recipients) {
		const tokenInput = args.tokenInputs.find(
			(token) => token.platformRole === recipient.platformRole
		);
		await ctx.db.insert("dealEnvelopeRecipients", {
			attemptId,
			dealId: args.deal._id,
			packageId: args.packageRow._id,
			dealDocumentInstanceId: args.instance._id,
			authId: recipient.authId,
			email: recipient.email,
			name: recipient.name,
			platformRole: recipient.platformRole,
			documensoRole: recipient.documensoRole,
			signingOrder: recipient.signingOrder,
			required: recipient.required,
			providerRecipientId: recipient.providerRecipientId,
			embeddedSigningToken: tokenInput?.embeddedSigningToken,
			tokenAvailableAt: recipient.tokenAvailableAt,
			tokenExpiresAt: recipient.tokenExpiresAt,
			sendStatus: status === "sent" ? "sent" : recipient.sendStatus,
			readStatus: recipient.readStatus,
			signingStatus: recipient.signingStatus,
			rejectionReason: undefined,
			sentAt: status === "sent" ? args.now : undefined,
			openedAt: undefined,
			completedAt: undefined,
			createdAt: args.now,
			updatedAt: args.now,
		});
	}

	if (status === "configuration_error") {
		await createSigningException(ctx, {
			dealId: args.deal._id,
			packageId: args.packageRow._id,
			dealDocumentInstanceId: args.instance._id,
			attemptId,
			kind: "pre_send_configuration_failure",
			message: roster.errors.join("; "),
			details: { source: "attempt_creation" },
			now: args.now,
		});
	}

	let instanceStatus: Doc<"dealDocumentInstances">["status"] =
		"signature_draft";
	if (status === "sent") {
		instanceStatus = "signature_sent";
	} else if (status === "configuration_error") {
		instanceStatus = "generation_failed";
	}

	await ctx.db.patch(args.instance._id, {
		status: instanceStatus,
		lastError:
			status === "configuration_error" ? roster.errors.join("; ") : undefined,
		updatedAt: args.now,
	});

	return { attemptId, status };
}

async function requireAttemptCreationContext(
	ctx: EnvelopeQueryCtx,
	args: {
		dealId: Id<"deals">;
		dealDocumentInstanceId: Id<"dealDocumentInstances">;
	}
) {
	const deal = requireRow(await ctx.db.get(args.dealId), "Deal not found");
	const instance = requireRow(
		await ctx.db.get(args.dealDocumentInstanceId),
		"Deal document instance not found"
	);
	if (instance.dealId !== args.dealId) {
		throw new ConvexError("Document instance does not belong to deal");
	}
	if (instance.sourceBlueprintSnapshot.class !== "private_templated_signable") {
		throw new ConvexError("Document instance is not signable");
	}
	const packageRow = requireRow(
		await ctx.db.get(instance.packageId),
		"Deal document package not found"
	);
	const blueprint = instance.sourceBlueprintId
		? await ctx.db.get(instance.sourceBlueprintId)
		: null;
	return { deal, instance, packageRow, blueprint };
}

interface RecipientTokenInput {
	embeddedSigningToken?: string;
	platformRole: string;
	providerRecipientId?: string;
	tokenExpiresAt?: number;
}

const recipientTokenInputValidator = v.object({
	embeddedSigningToken: v.optional(v.string()),
	platformRole: v.string(),
	providerRecipientId: v.optional(v.string()),
	tokenExpiresAt: v.optional(v.number()),
});

const resolvedRecipientInputValidator = v.object({
	authId: v.optional(v.string()),
	email: v.string(),
	name: v.string(),
	platformRole: v.string(),
	documensoRole: dealEnvelopeRecipientDocumensoRoleValidator,
	signingOrder: v.number(),
	required: v.boolean(),
	providerRecipientId: v.optional(v.string()),
	embeddedSigningToken: v.optional(v.string()),
	tokenExpiresAt: v.optional(v.number()),
});

const createAttemptInput = {
	dealId: v.id("deals"),
	dealDocumentInstanceId: v.id("dealDocumentInstances"),
	provider: dealEnvelopeProviderValidator,
	providerDocumentId: v.optional(v.string()),
	providerEnvelopeId: v.optional(v.string()),
	status: v.optional(dealEnvelopeAttemptStatusValidator),
	recipientTokens: v.optional(v.array(recipientTokenInputValidator)),
};

const publicCreateAttemptInput = {
	dealId: v.id("deals"),
	dealDocumentInstanceId: v.id("dealDocumentInstances"),
	provider: dealEnvelopeProviderValidator,
};

export const createEnvelopeAttempt = dealMutation
	.input(publicCreateAttemptInput)
	.handler(async (ctx, args) => {
		await assertDealAccess(ctx, args.dealId);
		const context = await requireAttemptCreationContext(ctx, args);
		const existing = await getActiveAttemptForInstance(
			ctx,
			args.dealDocumentInstanceId
		);
		if (existing) {
			throw new ConvexError("Active envelope attempt already exists");
		}
		return createAttemptRows(ctx, {
			...context,
			status: "draft",
			tokenInputs: [],
			now: Date.now(),
		});
	})
	.public();

export const createEnvelopeAttemptInternal = convex
	.mutation()
	.input(createAttemptInput)
	.handler(async (ctx, args) => {
		const context = await requireAttemptCreationContext(ctx, args);
		const existing = await getActiveAttemptForInstance(
			ctx,
			args.dealDocumentInstanceId
		);
		if (existing) {
			return { attemptId: existing._id, status: existing.status };
		}
		return createAttemptRows(ctx, {
			...context,
			status: args.status ?? "draft",
			providerDocumentId: args.providerDocumentId,
			providerEnvelopeId: args.providerEnvelopeId,
			tokenInputs: args.recipientTokens ?? [],
			now: Date.now(),
		});
	})
	.internal();

export const createResolvedEnvelopeAttemptInternal = convex
	.mutation()
	.input({
		dealId: v.id("deals"),
		dealDocumentInstanceId: v.id("dealDocumentInstances"),
		provider: dealEnvelopeProviderValidator,
		providerDocumentId: v.optional(v.string()),
		providerEnvelopeId: v.optional(v.string()),
		recipients: v.array(resolvedRecipientInputValidator),
		status: v.optional(dealEnvelopeAttemptStatusValidator),
	})
	.handler(async (ctx, args) => {
		const context = await requireAttemptCreationContext(ctx, args);
		const existing = await getActiveAttemptForInstance(
			ctx,
			args.dealDocumentInstanceId
		);
		if (existing) {
			return { attemptId: existing._id, status: existing.status };
		}

		const now = Date.now();
		const attemptNumber = await nextAttemptNumber(ctx, context.instance._id);
		const status = args.status ?? "draft";
		const roster: DealEnvelopeRecipientSnapshot[] = args.recipients.map(
			(recipient) => ({
				authId: recipient.authId,
				email: recipient.email,
				name: recipient.name,
				platformRole: recipient.platformRole,
				documensoRole: recipient.documensoRole,
				signingOrder: recipient.signingOrder,
				required: recipient.required,
				providerRecipientId: recipient.providerRecipientId,
				tokenAvailableAt: recipient.embeddedSigningToken ? now : undefined,
				tokenExpiresAt: recipient.tokenExpiresAt,
				sendStatus: "pending",
				readStatus: recipient.embeddedSigningToken
					? "available"
					: "not_available",
				signingStatus: "not_started",
				rejectionReason: undefined,
				completedAt: undefined,
			})
		);

		const attemptId = await ctx.db.insert("dealEnvelopeAttempts", {
			dealId: context.deal._id,
			packageId: context.packageRow._id,
			dealDocumentInstanceId: context.instance._id,
			generatedDocumentId: context.instance.generatedDocumentId,
			provider: args.provider,
			providerDocumentId: args.providerDocumentId,
			providerEnvelopeId: args.providerEnvelopeId,
			attemptNumber,
			status,
			recipientRoster: roster,
			active: status !== "configuration_error",
			idempotencyKey: [
				args.provider,
				context.instance._id,
				attemptNumber,
				args.providerDocumentId ?? args.providerEnvelopeId ?? "pending",
			].join(":"),
			supersedesAttemptId: undefined,
			supersededByAttemptId: undefined,
			terminalReason: undefined,
			terminalAt: undefined,
			completionTransitionRequestedAt: undefined,
			completionTransitionEmittedAt: undefined,
			completionJournalEntryId: undefined,
			createdAt: now,
			updatedAt: now,
		});

		for (const recipient of roster) {
			const tokenInput = args.recipients.find(
				(input) => input.platformRole === recipient.platformRole
			);
			await ctx.db.insert("dealEnvelopeRecipients", {
				attemptId,
				dealId: context.deal._id,
				packageId: context.packageRow._id,
				dealDocumentInstanceId: context.instance._id,
				authId: recipient.authId,
				email: recipient.email,
				name: recipient.name,
				platformRole: recipient.platformRole,
				documensoRole: recipient.documensoRole,
				signingOrder: recipient.signingOrder,
				required: recipient.required,
				providerRecipientId: recipient.providerRecipientId,
				embeddedSigningToken: tokenInput?.embeddedSigningToken,
				tokenAvailableAt: recipient.tokenAvailableAt,
				tokenExpiresAt: recipient.tokenExpiresAt,
				sendStatus: status === "sent" ? "sent" : recipient.sendStatus,
				readStatus: recipient.readStatus,
				signingStatus: recipient.signingStatus,
				rejectionReason: undefined,
				sentAt: status === "sent" ? now : undefined,
				openedAt: undefined,
				completedAt: undefined,
				createdAt: now,
				updatedAt: now,
			});
		}

		return { attemptId, status };
	})
	.internal();

export const reissueEnvelopeAttempt = dealMutation
	.input({
		attemptId: v.id("dealEnvelopeAttempts"),
		provider: dealEnvelopeProviderValidator,
	})
	.handler(async (ctx, args) => {
		const existing = requireRow(
			await ctx.db.get(args.attemptId),
			"Envelope attempt not found"
		);
		await assertDealAccess(ctx, existing.dealId);
		const activeAttempt = await getActiveAttemptForInstance(
			ctx,
			existing.dealDocumentInstanceId
		);
		if (activeAttempt?._id !== existing._id) {
			throw new ConvexError("Only the active envelope attempt can be reissued");
		}
		const context = await requireAttemptCreationContext(ctx, {
			dealId: existing.dealId,
			dealDocumentInstanceId: existing.dealDocumentInstanceId,
		});
		return createAttemptRows(ctx, {
			...context,
			status: "draft",
			tokenInputs: [],
			supersedesAttemptId: existing._id,
			now: Date.now(),
		});
	})
	.public();

export const recordEnvelopeReminder = dealMutation
	.input({
		attemptId: v.id("dealEnvelopeAttempts"),
		note: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		const attempt = requireRow(
			await ctx.db.get(args.attemptId),
			"Envelope attempt not found"
		);
		await assertDealAccess(ctx, attempt.dealId);
		const now = Date.now();
		return ctx.db.insert("dealEnvelopeProviderEvents", {
			provider: "documenso",
			providerEventId: `manual-reminder:${attempt._id}:${now}`,
			providerDocumentId: attempt.providerDocumentId,
			providerEnvelopeId: attempt.providerEnvelopeId,
			providerRecipientId: undefined,
			rawBody: JSON.stringify({
				kind: "manual_reminder",
				note: args.note,
				attemptId: attempt._id,
			}),
			rawEventType: "manual_reminder",
			normalizedEventType: "reminder_sent",
			status: "processed",
			signatureVerified: true,
			dealId: attempt.dealId,
			attemptId: attempt._id,
			recipientId: undefined,
			error: undefined,
			attempts: 1,
			receivedAt: now,
			processedAt: now,
		});
	})
	.public();

export const patchAttemptStatusInternal = convex
	.mutation()
	.input({
		attemptId: v.id("dealEnvelopeAttempts"),
		status: dealEnvelopeAttemptStatusValidator,
		terminalReason: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		const attempt = requireRow(
			await ctx.db.get(args.attemptId),
			"Envelope attempt not found"
		);
		const now = Date.now();
		await ctx.db.patch(args.attemptId, {
			status: args.status,
			terminalReason: args.terminalReason,
			terminalAt:
				args.status === "completed" ||
				args.status === "declined" ||
				args.status === "voided" ||
				args.status === "expired" ||
				args.status === "send_failed"
					? now
					: attempt.terminalAt,
			updatedAt: now,
		});
		const exceptionKind = classifyTerminalAttemptStatus(args.status);
		if (exceptionKind) {
			await createSigningException(ctx, {
				dealId: attempt.dealId,
				packageId: attempt.packageId,
				dealDocumentInstanceId: attempt.dealDocumentInstanceId,
				attemptId: attempt._id,
				kind: exceptionKind,
				message: args.terminalReason ?? `Envelope status: ${args.status}`,
				now,
			});
		}
	})
	.internal();

export const patchRecipientProgressInternal = convex
	.mutation()
	.input({
		recipientId: v.id("dealEnvelopeRecipients"),
		providerRecipientId: v.optional(v.string()),
		sendStatus: v.optional(dealEnvelopeRecipientSendStatusValidator),
		readStatus: v.optional(dealEnvelopeRecipientReadStatusValidator),
		signingStatus: v.optional(dealEnvelopeRecipientSigningStatusValidator),
		rejectionReason: v.optional(v.string()),
		embeddedSigningToken: v.optional(v.string()),
		tokenExpiresAt: v.optional(v.number()),
	})
	.handler(async (ctx, args) => {
		const recipient = requireRow(
			await ctx.db.get(args.recipientId),
			"Envelope recipient not found"
		);
		const now = Date.now();
		await ctx.db.patch(args.recipientId, {
			providerRecipientId:
				args.providerRecipientId ?? recipient.providerRecipientId,
			sendStatus: args.sendStatus ?? recipient.sendStatus,
			readStatus: args.readStatus ?? recipient.readStatus,
			signingStatus: args.signingStatus ?? recipient.signingStatus,
			rejectionReason: args.rejectionReason ?? recipient.rejectionReason,
			embeddedSigningToken:
				args.embeddedSigningToken ?? recipient.embeddedSigningToken,
			tokenAvailableAt:
				args.embeddedSigningToken !== undefined
					? now
					: recipient.tokenAvailableAt,
			tokenExpiresAt: args.tokenExpiresAt ?? recipient.tokenExpiresAt,
			sentAt:
				args.sendStatus === "sent" && recipient.sentAt === undefined
					? now
					: recipient.sentAt,
			openedAt:
				args.readStatus === "opened" && recipient.openedAt === undefined
					? now
					: recipient.openedAt,
			completedAt:
				args.signingStatus === "completed" &&
				recipient.completedAt === undefined
					? now
					: recipient.completedAt,
			updatedAt: now,
		});
	})
	.internal();

export const markCompletionTransitionEmittedInternal = convex
	.mutation()
	.input({
		attemptId: v.id("dealEnvelopeAttempts"),
		journalEntryId: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		const attempt = requireRow(
			await ctx.db.get(args.attemptId),
			"Envelope attempt not found"
		);
		if (attempt.completionTransitionEmittedAt !== undefined) {
			return false;
		}
		await ctx.db.patch(args.attemptId, {
			completionTransitionEmittedAt: Date.now(),
			completionJournalEntryId: args.journalEntryId,
			updatedAt: Date.now(),
		});
		return true;
	})
	.internal();

export const listEnvelopeProjection = dealQuery
	.input({ dealId: v.id("deals") })
	.handler(async (ctx, args) => {
		await assertDealAccess(ctx, args.dealId);
		const [attempts, recipients, exceptions] = await Promise.all([
			ctx.db
				.query("dealEnvelopeAttempts")
				.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
				.collect(),
			ctx.db
				.query("dealEnvelopeRecipients")
				.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
				.collect(),
			ctx.db
				.query("dealSigningExceptions")
				.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
				.collect(),
		]);
		const now = Date.now();
		return attempts
			.sort((left, right) => left.createdAt - right.createdAt)
			.map((attempt) => {
				const attemptRecipients = recipients
					.filter((recipient) => recipient.attemptId === attempt._id)
					.sort((left, right) => {
						if (left.signingOrder !== right.signingOrder) {
							return left.signingOrder - right.signingOrder;
						}
						return left.createdAt - right.createdAt;
					});
				const completion =
					summarizeRequiredRecipientCompletion(attemptRecipients);
				return {
					...attempt,
					completion,
					exceptions: exceptions.filter(
						(exception) => exception.attemptId === attempt._id
					),
					recipients: attemptRecipients.map((recipient) => {
						const exposeToken = canExposeEmbeddedSigningToken({
							recipient,
							viewerAuthId: ctx.viewer.authId,
							viewerEmail: ctx.viewer.email,
							now,
						});
						return {
							...recipient,
							embeddedSigningToken: exposeToken
								? recipient.embeddedSigningToken
								: undefined,
							tokenAvailable:
								exposeToken && recipient.embeddedSigningToken !== undefined,
						};
					}),
				};
			});
	})
	.public();
