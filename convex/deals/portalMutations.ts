import { ConvexError, v } from "convex/values";
import { resolveDealAccessDecision } from "../../src/lib/deals/access-policy/resolve";
import type { DealPersona } from "../../src/lib/deals/access-policy/types";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { readDealDocumentPackageSurface } from "../documents/dealPackages";
import { executeTransition } from "../engine/transition";
import type { CommandSource, TransitionResult } from "../engine/types";
import { authedMutation, type Viewer } from "../fluent";

type PortalMutationCtx = MutationCtx & { viewer: Viewer };

function requireDealStatus(deal: Doc<"deals">, expectedStatus: string) {
	if (deal.status !== expectedStatus) {
		throw new ConvexError(
			`Invalid deal state: expected ${expectedStatus}, found ${deal.status}`
		);
	}
}

function dealPortalSource(viewer: Viewer, persona: DealPersona): CommandSource {
	if (viewer.isFairLendAdmin || persona === "fairlend_admin") {
		return {
			actorId: viewer.authId,
			actorType: "admin",
			channel: "admin_dashboard",
		};
	}
	if (persona === "primary_lawyer") {
		return {
			actorId: viewer.authId,
			actorType: "member",
			channel: "lawyer_portal",
		};
	}
	if (persona === "broker_of_record" || persona === "assigned_broker") {
		return {
			actorId: viewer.authId,
			actorType: "broker",
			channel: "broker_portal",
		};
	}
	return {
		actorId: viewer.authId,
		actorType: "member",
		channel: "borrower_portal",
	};
}

async function requireActiveDealParticipant(
	ctx: PortalMutationCtx,
	dealId: Id<"deals">
): Promise<DealPersona> {
	const decision = await resolveDealAccessDecision(ctx, {
		dealId,
		intent: "deal.portal.view",
		viewer: ctx.viewer,
	});
	if (!decision?.allowed || decision.readiness !== "active") {
		throw new ConvexError(
			`Forbidden: no active deal access for ${String(dealId)}`
		);
	}
	return decision.persona;
}

async function transitionDealFromPortal(
	ctx: PortalMutationCtx,
	dealId: Id<"deals">,
	eventType: "LAWYER_APPROVED_DOCUMENTS" | "ALL_PARTIES_SIGNED",
	persona: DealPersona
): Promise<TransitionResult> {
	const result = await executeTransition(ctx, {
		entityId: dealId,
		entityType: "deal",
		eventType,
		source: dealPortalSource(ctx.viewer, persona),
	});
	if (!result.success) {
		throw new ConvexError(result.reason ?? `Transition rejected: ${eventType}`);
	}
	return result;
}

export const skipEmptyDocumentSigning = authedMutation
	.input({ dealId: v.id("deals") })
	.handler(async (ctx, args) => {
		const deal = await ctx.db.get(args.dealId);
		if (!deal) {
			throw new ConvexError(`Deal not found: ${String(args.dealId)}`);
		}
		requireDealStatus(deal, "documentReview.pending");
		const persona = await requireActiveDealParticipant(ctx, args.dealId);
		const packageSurface = await readDealDocumentPackageSurface(
			ctx,
			args.dealId
		);
		if (packageSurface.instances.length > 0) {
			throw new ConvexError({
				code: "EMPTY_DOCUMENT_SIGNING_SKIP_BLOCKED",
				message:
					"Document signing can only be skipped when no document instances exist.",
			});
		}

		const approved = await transitionDealFromPortal(
			ctx,
			args.dealId,
			"LAWYER_APPROVED_DOCUMENTS",
			persona
		);
		const signed = await transitionDealFromPortal(
			ctx,
			args.dealId,
			"ALL_PARTIES_SIGNED",
			persona
		);
		return { transitions: [approved, signed] };
	})
	.public();
