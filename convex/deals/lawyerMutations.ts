import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { readDealDocumentPackageSurface } from "../documents/dealPackages";
import { executeTransition } from "../engine/transition";
import type { CommandSource, TransitionResult } from "../engine/types";
import { lawyerMutation, type Viewer } from "../fluent";

type LawyerMutationCtx = MutationCtx & { viewer: Viewer };
type PackageSurface = Awaited<
	ReturnType<typeof readDealDocumentPackageSurface>
>;

function isLawyerAccessRole(role: Doc<"dealAccess">["role"]) {
	return role === "platform_lawyer" || role === "guest_lawyer";
}

function lawyerSource(viewer: Viewer): CommandSource {
	return {
		actorId: viewer.authId,
		channel: "lawyer_portal",
	};
}

async function requireActiveLawyerDeal(
	ctx: LawyerMutationCtx,
	dealId: Id<"deals">
) {
	const deal = await ctx.db.get(dealId);
	if (!deal) {
		throw new ConvexError(`Deal not found: ${String(dealId)}`);
	}

	const activeAccess = await ctx.db
		.query("dealAccess")
		.withIndex("by_user_and_deal", (query) =>
			query.eq("userId", ctx.viewer.authId).eq("dealId", dealId)
		)
		.filter((query) => query.eq(query.field("status"), "active"))
		.first();
	if (activeAccess && isLawyerAccessRole(activeAccess.role)) {
		return deal;
	}

	const assignedPlatformLawyer =
		deal.lawyerId === ctx.viewer.authId &&
		deal.lawyerType === "platform_lawyer" &&
		deal.status !== "confirmed";
	if (assignedPlatformLawyer) {
		return deal;
	}

	throw new ConvexError(
		`Forbidden: no active lawyer access for ${String(dealId)}`
	);
}

function requireDealStatus(deal: Doc<"deals">, expectedStatus: string) {
	if (deal.status !== expectedStatus) {
		throw new ConvexError(
			`Invalid deal state: expected ${expectedStatus}, found ${deal.status}`
		);
	}
}

function packageApprovalBlockers(
	packageSurface: PackageSurface,
	openExceptions: readonly Doc<"dealSigningExceptions">[]
) {
	const blockers: string[] = [];
	const signableInstances = packageSurface.instances.filter(
		(instance) => instance.class === "private_templated_signable"
	);

	if (packageSurface.package?.status !== "ready") {
		blockers.push("Generated package is not ready.");
	}
	if (signableInstances.length === 0) {
		blockers.push("No signable package documents are available.");
	}
	if (
		signableInstances.some(
			(instance) => instance.status === "signature_pending_recipient_resolution"
		)
	) {
		blockers.push("Signatory mappings are incomplete.");
	}
	if (
		openExceptions.some(
			(exception) => exception.kind === "pre_send_configuration_failure"
		)
	) {
		blockers.push("Open pre-send configuration exceptions must be resolved.");
	}

	return blockers;
}

async function openPreSendExceptions(
	ctx: LawyerMutationCtx,
	dealId: Id<"deals">
) {
	const openExceptions = await ctx.db
		.query("dealSigningExceptions")
		.withIndex("by_deal", (query) =>
			query.eq("dealId", dealId).eq("status", "open")
		)
		.collect();
	return openExceptions.filter(
		(exception) => exception.kind === "pre_send_configuration_failure"
	);
}

async function transitionDealFromLawyerPortal(
	ctx: LawyerMutationCtx,
	dealId: Id<"deals">,
	eventType: "REPRESENTATION_CONFIRMED" | "LAWYER_APPROVED_DOCUMENTS"
): Promise<TransitionResult> {
	const result = await executeTransition(ctx, {
		entityId: dealId,
		entityType: "deal",
		eventType,
		source: lawyerSource(ctx.viewer),
	});
	if (!result.success) {
		throw new ConvexError(result.reason ?? `Transition rejected: ${eventType}`);
	}
	return result;
}

export const confirmRepresentation = lawyerMutation
	.input({ dealId: v.id("deals") })
	.handler(async (ctx, args) => {
		const deal = await requireActiveLawyerDeal(ctx, args.dealId);
		requireDealStatus(deal, "lawyerOnboarding.verified");
		return transitionDealFromLawyerPortal(
			ctx,
			args.dealId,
			"REPRESENTATION_CONFIRMED"
		);
	})
	.public();

export const approveDocuments = lawyerMutation
	.input({ dealId: v.id("deals") })
	.handler(async (ctx, args) => {
		const deal = await requireActiveLawyerDeal(ctx, args.dealId);
		requireDealStatus(deal, "documentReview.pending");

		const [packageSurface, openExceptions] = await Promise.all([
			readDealDocumentPackageSurface(ctx, args.dealId),
			openPreSendExceptions(ctx, args.dealId),
		]);
		const blockers = packageApprovalBlockers(packageSurface, openExceptions);
		if (blockers.length > 0) {
			throw new ConvexError({
				blockers,
				code: "LAWYER_PACKAGE_APPROVAL_BLOCKED",
				message: "Document package is not ready for lawyer approval.",
			});
		}

		return transitionDealFromLawyerPortal(
			ctx,
			args.dealId,
			"LAWYER_APPROVED_DOCUMENTS"
		);
	})
	.public();
