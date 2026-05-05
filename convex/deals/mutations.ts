import { ConvexError, v } from "convex/values";
import type {
	DealPersona,
	LawyerSourceKind,
} from "../../src/lib/deals/access-policy/types";
import type { Id } from "../_generated/dataModel";
import type { DatabaseWriter } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { buildSource, transitionCommandArgs } from "../engine/commands";
import { executeTransition } from "../engine/transition";
import type { CommandSource } from "../engine/types";
import { adminMutation } from "../fluent";
import {
	evaluateDealLegalGate,
	type LegalGateResult,
} from "../legalRepresentation/gates";
import {
	type FundsReceiptSource,
	normalizeEvidenceNote,
	parseFundsReceiptSource,
	recordFundsReceiptRow,
} from "./closeEvidence";

export type DealAccessRole =
	| "platform_lawyer"
	| "guest_lawyer"
	| "broker_of_record"
	| "assigned_broker"
	| "lender"
	| "borrower";

async function resolveCanonicalDealAccessPersona(
	db: DatabaseWriter,
	args: {
		dealId: Id<"deals">;
		role: DealAccessRole;
		userId: string;
	}
): Promise<{
	lawyerSource?: LawyerSourceKind;
	persona: DealPersona;
}> {
	if (args.role === "platform_lawyer" || args.role === "guest_lawyer") {
		return { lawyerSource: args.role, persona: "primary_lawyer" };
	}
	if (args.role === "broker_of_record" || args.role === "assigned_broker") {
		return { persona: args.role };
	}
	if (args.role === "borrower") {
		const deal = await db.get(args.dealId);
		if (!deal) {
			throw new ConvexError(
				"Cannot grant borrower deal access for missing deal"
			);
		}
		const user = await db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", args.userId))
			.first();
		const borrower = user
			? await db
					.query("borrowers")
					.withIndex("by_user", (query) => query.eq("userId", user._id))
					.first()
			: null;
		const mortgageBorrower = borrower
			? await db
					.query("mortgageBorrowers")
					.withIndex("by_borrower", (query) =>
						query.eq("borrowerId", borrower._id)
					)
					.filter((query) =>
						query.eq(query.field("mortgageId"), deal.mortgageId)
					)
					.first()
			: null;
		if (!mortgageBorrower) {
			throw new ConvexError(
				"Cannot grant borrower deal access without mortgage borrower record"
			);
		}
		return { persona: "primary_borrower" };
	}

	const deal = await db.get(args.dealId);
	if (deal?.sellerId === args.userId) {
		return { persona: "selling_lender" };
	}
	if (deal?.buyerId === args.userId) {
		return { persona: "purchasing_lender" };
	}
	return { persona: "participating_lender" };
}

/**
 * Shared idempotent grant logic for dealAccess records.
 * If an active record already exists for (userId, dealId) with the same role,
 * returns it unchanged. If the role differs (e.g. guest_lawyer ->
 * platform_lawyer), the existing record is patched to the new role and returned.
 */
export async function grantDealAccess(
	db: DatabaseWriter,
	args: {
		userId: string;
		dealId: Id<"deals">;
		role: DealAccessRole;
		grantedBy: string;
	}
): Promise<Id<"dealAccess">> {
	const canonicalAccess = await resolveCanonicalDealAccessPersona(db, args);
	const existing = await db
		.query("dealAccess")
		.withIndex("by_user_and_deal", (q) =>
			q.eq("userId", args.userId).eq("dealId", args.dealId)
		)
		.filter((q) => q.eq(q.field("status"), "active"))
		.first();

	if (existing) {
		if (
			existing.role !== args.role ||
			existing.persona !== canonicalAccess.persona ||
			existing.lawyerSource !== canonicalAccess.lawyerSource
		) {
			await db.patch(existing._id, {
				role: args.role,
				persona: canonicalAccess.persona,
				lawyerSource: canonicalAccess.lawyerSource,
				grantedBy: args.grantedBy,
				grantedAt: Date.now(),
			});
		}
		return existing._id;
	}

	return await db.insert("dealAccess", {
		userId: args.userId,
		dealId: args.dealId,
		role: args.role,
		persona: canonicalAccess.persona,
		lawyerSource: canonicalAccess.lawyerSource,
		grantedAt: Date.now(),
		grantedBy: args.grantedBy,
		status: "active",
	});
}

/**
 * Grants deal access to a user with a specific role.
 * Delegates to the shared `grantDealAccess` helper for idempotent upsert logic.
 */
export const grantAccess = internalMutation({
	args: {
		userId: v.string(),
		dealId: v.id("deals"),
		role: v.union(
			v.literal("platform_lawyer"),
			v.literal("guest_lawyer"),
			v.literal("broker_of_record"),
			v.literal("assigned_broker"),
			v.literal("lender"),
			v.literal("borrower")
		),
		grantedBy: v.string(),
	},
	handler: async (ctx, args) => {
		return grantDealAccess(ctx.db, args);
	},
});

/**
 * Soft-revokes a single dealAccess record.
 * Idempotent: no-op if already revoked or not found.
 * Never hard-deletes — preserves grantedAt and revokedAt for audit.
 */
export const revokeAccess = internalMutation({
	args: {
		accessId: v.id("dealAccess"),
	},
	handler: async (ctx, args) => {
		const record = await ctx.db.get(args.accessId);
		if (!record || record.status === "revoked") {
			return;
		}

		await ctx.db.patch(args.accessId, {
			status: "revoked",
			revokedAt: Date.now(),
		});
	},
});

// ── Deal Transition Mutations ──────────────────────────────────────────

function extractFundsReceiptSource(
	payload: Record<string, unknown> | undefined
): FundsReceiptSource | null {
	return parseFundsReceiptSource(payload?.fundsReceiptSource);
}

function assertFundsEvidenceAccepted(
	status: "recorded" | "replayed" | "blocked"
) {
	if (status === "blocked") {
		throw new ConvexError(
			"FUNDS_RECEIVED funds evidence is incompatible with existing evidence"
		);
	}
}

function isLegalRepresentationGateEvent(
	eventType: string
): eventType is "LAWYER_VERIFIED" | "REPRESENTATION_CONFIRMED" {
	return (
		eventType === "LAWYER_VERIFIED" || eventType === "REPRESENTATION_CONFIRMED"
	);
}

function throwLegalGateBlocked(gate: LegalGateResult): never {
	throw new ConvexError({
		code: "LEGAL_REPRESENTATION_GATE_BLOCKED",
		message: gate.message,
		reasonCodes: [...gate.reasonCodes],
	});
}

/**
 * Admin-gated transition for deals.
 * Requires FairLend admin role (enforced by adminMutation).
 *
 * Deal event types:
 * - DEAL_LOCKED: payload: { closingDate: number }
 * - LAWYER_VERIFIED: payload: { verificationId: string }
 * - REPRESENTATION_CONFIRMED: no payload
 * - LAWYER_APPROVED_DOCUMENTS: no payload
 * - ALL_PARTIES_SIGNED: no payload
 * - FUNDS_RECEIVED: payload: { method: "vopay" | "wire_receipt" | "manual" }
 * - DEAL_CANCELLED: payload: { reason: string }
 */
export const transitionDeal = adminMutation
	.input({ ...transitionCommandArgs, entityId: v.id("deals") })
	.handler(async (ctx, args) => {
		const source =
			(args.source as CommandSource | undefined) ??
			buildSource(ctx.viewer, "admin_dashboard");
		let payload = args.payload as Record<string, unknown> | undefined;

		if (isLegalRepresentationGateEvent(args.eventType)) {
			const deal = await ctx.db.get(args.entityId);
			if (!deal) {
				throw new ConvexError("Deal not found");
			}
			const gate = await evaluateDealLegalGate(ctx, {
				access: {
					requireActiveAccess: args.eventType === "REPRESENTATION_CONFIRMED",
				},
				checkpoint: args.eventType,
				deal,
			});
			if (gate.decision !== "allow") {
				throwLegalGateBlocked(gate);
			}
			if (args.eventType === "LAWYER_VERIFIED" && gate.verificationId) {
				payload = {
					...payload,
					verificationId: String(gate.verificationId),
				};
			}
		}

		if (args.eventType === "FUNDS_RECEIVED") {
			const fundsReceiptSource = extractFundsReceiptSource(payload);
			if (!fundsReceiptSource) {
				throw new ConvexError(
					"FUNDS_RECEIVED requires fundsReceiptSource evidence"
				);
			}
			const deal = await ctx.db.get(args.entityId);
			if (!deal) {
				throw new ConvexError("Deal not found");
			}
			if (deal.status !== "fundsTransfer.pending") {
				throw new ConvexError(
					`Deal must be in fundsTransfer.pending to confirm funds, currently: ${deal.status}`
				);
			}
			const evidenceResult = await recordFundsReceiptRow(ctx, {
				dealId: args.entityId,
				source: fundsReceiptSource,
				recordedBy: ctx.viewer.authId,
			});
			assertFundsEvidenceAccepted(evidenceResult.status);
		}

		return executeTransition(ctx, {
			entityType: "deal",
			entityId: args.entityId,
			eventType: args.eventType,
			payload,
			source,
		});
	})
	.public();

export const confirmManualFundsReceipt = adminMutation
	.input({
		dealId: v.id("deals"),
		evidenceNote: v.string(),
		receivedAt: v.number(),
		attachmentIds: v.optional(v.array(v.id("documentAssets"))),
	})
	.handler(async (ctx, args) => {
		const deal = await ctx.db.get(args.dealId);
		if (!deal) {
			throw new ConvexError("Deal not found");
		}
		if (deal.status !== "fundsTransfer.pending") {
			throw new ConvexError(
				`Deal must be in fundsTransfer.pending to confirm funds, currently: ${deal.status}`
			);
		}

		const evidenceNote = normalizeEvidenceNote(args.evidenceNote);
		if (!evidenceNote) {
			throw new ConvexError(
				"Manual funds confirmation requires an evidence note"
			);
		}
		if (args.receivedAt <= 0) {
			throw new ConvexError(
				`Manual funds confirmation requires a positive receivedAt timestamp, got ${args.receivedAt}`
			);
		}

		for (const attachmentId of args.attachmentIds ?? []) {
			const attachment = await ctx.db.get(attachmentId);
			if (!attachment) {
				throw new ConvexError(
					`Manual evidence attachment not found: ${attachmentId}`
				);
			}
		}

		const fundsReceiptSource: FundsReceiptSource = {
			kind: "manual_admin",
			confirmedBy: ctx.viewer.authId,
			evidenceNote,
			receivedAt: args.receivedAt,
			attachmentIds: args.attachmentIds,
		};
		const evidenceResult = await recordFundsReceiptRow(ctx, {
			dealId: args.dealId,
			source: fundsReceiptSource,
			recordedBy: ctx.viewer.authId,
		});
		assertFundsEvidenceAccepted(evidenceResult.status);

		const source = buildSource(ctx.viewer, "admin_dashboard");
		return executeTransition(ctx, {
			entityType: "deal",
			entityId: args.dealId,
			eventType: "FUNDS_RECEIVED",
			payload: {
				method: "manual",
				fundsReceiptSource,
			},
			source,
		});
	})
	.public();
