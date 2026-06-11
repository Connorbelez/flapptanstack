import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { getSignatureProvider } from "../documents/signature/provider";
import { authedAction, convex } from "../fluent";
import { canStartSigningForDealStatus } from "./portalContracts";

function normalizeEmail(value: string | undefined) {
	const normalized = value?.trim().toLowerCase();
	return normalized && normalized.length > 0 ? normalized : undefined;
}

function recipientBelongsToViewer(
	recipient: Pick<Doc<"dealEnvelopeRecipients">, "authId" | "email">,
	viewer: { authId: string; email?: string }
) {
	if (recipient.authId && recipient.authId === viewer.authId) {
		return true;
	}
	const viewerEmail = normalizeEmail(viewer.email);
	return Boolean(
		viewerEmail && normalizeEmail(recipient.email) === viewerEmail
	);
}

export const resolveParticipantSigningSessionContextInternal = convex
	.query()
	.input({
		attemptId: v.id("dealEnvelopeAttempts"),
		dealId: v.id("deals"),
		viewerAuthId: v.string(),
		viewerEmail: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		const [deal, attempt] = await Promise.all([
			ctx.db.get(args.dealId),
			ctx.db.get(args.attemptId),
		]);
		if (!deal) {
			throw new ConvexError("Deal not found");
		}
		if (!attempt || attempt.dealId !== args.dealId || !attempt.active) {
			throw new ConvexError("Active signing attempt not found");
		}
		const hasActiveEnvelope =
			attempt.status === "sent" || attempt.status === "partially_signed";
		if (
			!canStartSigningForDealStatus(deal.status, {
				hasActiveEnvelope,
			})
		) {
			throw new ConvexError("Embedded signing is not available for this deal");
		}
		if (!attempt.providerEnvelopeId) {
			throw new ConvexError("Signing attempt is missing provider envelope id");
		}

		const recipients = await ctx.db
			.query("dealEnvelopeRecipients")
			.withIndex("by_attempt", (query) => query.eq("attemptId", attempt._id))
			.collect();
		const recipient = recipients.find((candidate) =>
			recipientBelongsToViewer(candidate, {
				authId: args.viewerAuthId,
				email: args.viewerEmail,
			})
		);
		if (!recipient?.providerRecipientId) {
			throw new ConvexError(
				"Forbidden: no embedded signing recipient is available for this user"
			);
		}
		if (
			recipients.some(
				(candidate) =>
					candidate.signingOrder < recipient.signingOrder &&
					candidate.required &&
					candidate.signingStatus !== "completed"
			)
		) {
			throw new ConvexError(
				"Embedded signing is not available: previous signers must complete first"
			);
		}
		if (
			recipient.signingStatus === "completed" ||
			recipient.signingStatus === "rejected" ||
			recipient.signingStatus === "voided" ||
			recipient.signingStatus === "expired"
		) {
			throw new ConvexError(
				"Embedded signing is not available for the current recipient state"
			);
		}

		return {
			provider: attempt.provider,
			providerEnvelopeId: attempt.providerEnvelopeId,
			providerRecipientId: recipient.providerRecipientId,
		};
	})
	.internal();

export const createParticipantSigningSession = authedAction
	.input({
		attemptId: v.id("dealEnvelopeAttempts"),
		dealId: v.id("deals"),
	})
	.handler(async (ctx, args): Promise<{ expiresAt: number; url: string }> => {
		const sessionContext = await ctx.runQuery(
			internal.deals.signingSessions
				.resolveParticipantSigningSessionContextInternal,
			{
				attemptId: args.attemptId,
				dealId: args.dealId,
				viewerAuthId: ctx.viewer.authId,
				viewerEmail: ctx.viewer.email,
			}
		);
		const provider = getSignatureProvider(sessionContext.provider, {
			fetchFn: fetch,
			getStorageBlob: async () => null,
		});
		return provider.createEmbeddedSigningSession({
			providerEnvelopeId: sessionContext.providerEnvelopeId,
			providerRecipientId: sessionContext.providerRecipientId,
		});
	})
	.public();
