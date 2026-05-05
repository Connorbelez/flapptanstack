import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { executeTransition } from "../engine/transition";
import type { CommandSource, TransitionResult } from "../engine/types";
import { evaluateDealLegalGate, type LegalGateResult } from "./gates";

type LegalRepresentationProgressEvent =
	| "LAWYER_VERIFIED"
	| "REPRESENTATION_CONFIRMED";

export type LegalRepresentationProgressTransition = TransitionResult & {
	readonly eventType: LegalRepresentationProgressEvent;
};

export interface LegalRepresentationProgressResult {
	readonly dealStatus: string;
	readonly success: true;
	readonly transitions: readonly LegalRepresentationProgressTransition[];
}

function throwLegalGateBlocked(gate: LegalGateResult): never {
	throw new ConvexError({
		code: "LEGAL_REPRESENTATION_GATE_BLOCKED",
		message: gate.message,
		reasonCodes: [...gate.reasonCodes],
	});
}

function isRepresentationProgressTerminal(status: string) {
	return [
		"documentReview.pending",
		"documentReview.signed",
		"fundsTransfer.pending",
		"confirmed",
	].includes(status);
}

async function executeDealTransition(
	ctx: MutationCtx,
	args: {
		readonly dealId: Id<"deals">;
		readonly eventType: LegalRepresentationProgressEvent;
		readonly payload?: Record<string, unknown>;
		readonly source: CommandSource;
	}
): Promise<LegalRepresentationProgressTransition> {
	const result = await executeTransition(ctx, {
		entityId: args.dealId,
		entityType: "deal",
		eventType: args.eventType,
		payload: args.payload,
		source: args.source,
	});
	if (!result.success) {
		throw new ConvexError(
			result.reason ??
				`Legal representation transition rejected: ${args.eventType}`
		);
	}
	return { ...result, eventType: args.eventType };
}

export async function progressDealLegalRepresentationState(
	ctx: MutationCtx,
	args: {
		readonly dealId: Id<"deals">;
		readonly source: CommandSource;
		readonly sourceActorId?: string;
	}
): Promise<LegalRepresentationProgressResult> {
	const transitions: LegalRepresentationProgressTransition[] = [];
	let deal = await ctx.db.get(args.dealId);
	if (!deal) {
		throw new ConvexError("Deal not found");
	}

	if (deal.status === "lawyerOnboarding.pending") {
		const verifiedGate = await evaluateDealLegalGate(ctx, {
			access:
				args.sourceActorId === undefined
					? undefined
					: { sourceActorId: args.sourceActorId },
			checkpoint: "LAWYER_VERIFIED",
			deal,
		});
		if (verifiedGate.decision !== "allow") {
			throwLegalGateBlocked(verifiedGate);
		}
		transitions.push(
			await executeDealTransition(ctx, {
				dealId: args.dealId,
				eventType: "LAWYER_VERIFIED",
				payload:
					verifiedGate.verificationId === undefined
						? undefined
						: { verificationId: String(verifiedGate.verificationId) },
				source: args.source,
			})
		);
		deal = await ctx.db.get(args.dealId);
		if (!deal) {
			throw new ConvexError(
				"Deal disappeared after lawyer verification transition"
			);
		}
	}

	if (deal.status === "lawyerOnboarding.verified") {
		const representationGate = await evaluateDealLegalGate(ctx, {
			access: {
				requireActiveAccess: true,
				...(args.sourceActorId === undefined
					? {}
					: { sourceActorId: args.sourceActorId }),
			},
			checkpoint: "REPRESENTATION_CONFIRMED",
			deal,
		});
		if (representationGate.decision !== "allow") {
			throwLegalGateBlocked(representationGate);
		}
		transitions.push(
			await executeDealTransition(ctx, {
				dealId: args.dealId,
				eventType: "REPRESENTATION_CONFIRMED",
				source: args.source,
			})
		);
		deal = await ctx.db.get(args.dealId);
		if (!deal) {
			throw new ConvexError(
				"Deal disappeared after representation confirmation transition"
			);
		}
	}

	if (!isRepresentationProgressTerminal(deal.status)) {
		throw new ConvexError(
			`Invalid deal state for legal representation progress: ${deal.status}`
		);
	}

	return {
		dealStatus: deal.status,
		success: true,
		transitions,
	};
}
