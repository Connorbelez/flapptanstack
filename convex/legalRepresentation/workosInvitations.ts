import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { FAIRLEND_LAWYERS_ORG_ID } from "../constants";
import {
	getWorkosProvisioning,
	type WorkosProvisioning,
} from "../engine/effects/workosProvisioning";
import { authedAction, convex } from "../fluent";
import type { InvitationAcceptResult } from "./invitations";
import { normalizeLawyerEmail } from "./normalization";

const LAWYER_ROLE_SLUG = "lawyer";
const DELIVERY_ERROR_MAX_LENGTH = 400;

type DeliveryStatus = NonNullable<Doc<"lawyerInvitations">["deliveryStatus"]>;

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function sanitizeDeliveryError(error: unknown) {
	return errorMessage(error).slice(0, DELIVERY_ERROR_MAX_LENGTH);
}

function requireSendInvitation(provisioning: WorkosProvisioning) {
	if (!provisioning.sendInvitation) {
		throw new ConvexError("WorkOS invitation delivery is not configured");
	}
	return provisioning.sendInvitation.bind(provisioning);
}

function requireResendInvitation(provisioning: WorkosProvisioning) {
	if (!provisioning.resendInvitation) {
		throw new ConvexError("WorkOS invitation resend is not configured");
	}
	return provisioning.resendInvitation.bind(provisioning);
}

function requireRevokeInvitation(provisioning: WorkosProvisioning) {
	if (!provisioning.revokeInvitation) {
		throw new ConvexError("WorkOS invitation revoke is not configured");
	}
	return provisioning.revokeInvitation.bind(provisioning);
}

function requireFindInvitationByToken(provisioning: WorkosProvisioning) {
	if (!provisioning.findInvitationByToken) {
		throw new ConvexError("WorkOS invitation lookup is not configured");
	}
	return provisioning.findInvitationByToken.bind(provisioning);
}

export const updateInvitationDeliveryInternal = convex
	.mutation()
	.input({
		deliveredAt: v.optional(v.number()),
		deliveryError: v.optional(v.string()),
		deliveryStatus: v.union(
			v.literal("pending"),
			v.literal("sent"),
			v.literal("failed")
		),
		invitationId: v.id("lawyerInvitations"),
		lastDeliveryAttemptAt: v.number(),
		workosInvitationId: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		const patch: Partial<Doc<"lawyerInvitations">> = {
			deliveredAt: args.deliveredAt,
			deliveryError: args.deliveryError,
			deliveryProvider: "workos",
			deliveryStatus: args.deliveryStatus as DeliveryStatus,
			lastDeliveryAttemptAt: args.lastDeliveryAttemptAt,
			updatedAt: args.lastDeliveryAttemptAt,
			workosInvitationId: args.workosInvitationId,
		};
		await ctx.db.patch(args.invitationId, patch);
		return { status: args.deliveryStatus };
	})
	.internal();

export const getInvitationForDeliveryInternal = convex
	.query()
	.input({ invitationId: v.id("lawyerInvitations") })
	.handler(async (ctx, args) => await ctx.db.get(args.invitationId))
	.internal();

export const recordInvitationRevocationAttemptInternal = convex
	.mutation()
	.input({
		deliveryError: v.optional(v.string()),
		invitationId: v.id("lawyerInvitations"),
		now: v.number(),
	})
	.handler(async (ctx, args) => {
		await ctx.db.patch(args.invitationId, {
			deliveryError: args.deliveryError,
			lastDeliveryAttemptAt: args.now,
			updatedAt: args.now,
		});
	})
	.internal();

async function recordDeliveryFailure(
	ctx: Pick<ActionCtx, "runMutation">,
	args: {
		readonly error: unknown;
		readonly invitationId: Id<"lawyerInvitations">;
		readonly now: number;
		readonly workosInvitationId?: string;
	}
) {
	await ctx.runMutation(
		internal.legalRepresentation.workosInvitations
			.updateInvitationDeliveryInternal,
		{
			deliveryError: sanitizeDeliveryError(args.error),
			deliveryStatus: "failed",
			invitationId: args.invitationId,
			lastDeliveryAttemptAt: args.now,
			workosInvitationId: args.workosInvitationId,
		}
	);
	console.error("[legalRepresentation.workosInvitations] delivery failed", {
		error: sanitizeDeliveryError(args.error),
		invitationId: args.invitationId,
		workosInvitationId: args.workosInvitationId,
	});
}

export const deliverGuestInvitation = convex
	.action()
	.input({ invitationId: v.id("lawyerInvitations") })
	.handler(
		async (
			ctx,
			args
		): Promise<
			| { readonly status: "failed" | "skipped" }
			| { readonly status: "sent"; readonly workosInvitationId: string }
		> => {
			const now = Date.now();
			const invitation: Doc<"lawyerInvitations"> | null = await ctx.runQuery(
				internal.legalRepresentation.workosInvitations
					.getInvitationForDeliveryInternal,
				{ invitationId: args.invitationId }
			);
			if (!invitation || invitation.status !== "pending") {
				return { status: "skipped" as const };
			}
			try {
				const sendInvitation = requireSendInvitation(getWorkosProvisioning());
				const workosInvitation = await sendInvitation({
					email: invitation.targetEmail,
					organizationId: FAIRLEND_LAWYERS_ORG_ID,
					roleSlug: LAWYER_ROLE_SLUG,
				});
				await ctx.runMutation(
					internal.legalRepresentation.workosInvitations
						.updateInvitationDeliveryInternal,
					{
						deliveredAt: now,
						deliveryStatus: "sent",
						invitationId: invitation._id,
						lastDeliveryAttemptAt: now,
						workosInvitationId: workosInvitation.id,
					}
				);
				return {
					status: "sent" as const,
					workosInvitationId: workosInvitation.id,
				};
			} catch (error) {
				await recordDeliveryFailure(ctx, {
					error,
					invitationId: invitation._id,
					now,
				});
				return { status: "failed" as const };
			}
		}
	)
	.internal();

export const resendGuestInvitationDelivery = convex
	.action()
	.input({ invitationId: v.id("lawyerInvitations") })
	.handler(
		async (
			ctx,
			args
		): Promise<
			| { readonly status: "failed" | "skipped" }
			| { readonly status: "sent"; readonly workosInvitationId: string }
		> => {
			const now = Date.now();
			const invitation: Doc<"lawyerInvitations"> | null = await ctx.runQuery(
				internal.legalRepresentation.workosInvitations
					.getInvitationForDeliveryInternal,
				{ invitationId: args.invitationId }
			);
			if (!invitation || invitation.status !== "pending") {
				return { status: "skipped" as const };
			}
			if (!invitation.workosInvitationId) {
				return await ctx.runAction(
					internal.legalRepresentation.workosInvitations.deliverGuestInvitation,
					{ invitationId: args.invitationId }
				);
			}
			try {
				const resendInvitation = requireResendInvitation(
					getWorkosProvisioning()
				);
				await resendInvitation(invitation.workosInvitationId);
				await ctx.runMutation(
					internal.legalRepresentation.workosInvitations
						.updateInvitationDeliveryInternal,
					{
						deliveredAt: now,
						deliveryStatus: "sent",
						invitationId: invitation._id,
						lastDeliveryAttemptAt: now,
						workosInvitationId: invitation.workosInvitationId,
					}
				);
				return {
					status: "sent" as const,
					workosInvitationId: invitation.workosInvitationId,
				};
			} catch (error) {
				await recordDeliveryFailure(ctx, {
					error,
					invitationId: invitation._id,
					now,
					workosInvitationId: invitation.workosInvitationId,
				});
				return { status: "failed" as const };
			}
		}
	)
	.internal();

export const revokeWorkosInvitationDelivery = convex
	.action()
	.input({
		invitationId: v.id("lawyerInvitations"),
		workosInvitationId: v.string(),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		try {
			const revokeInvitation = requireRevokeInvitation(getWorkosProvisioning());
			await revokeInvitation(args.workosInvitationId);
			await ctx.runMutation(
				internal.legalRepresentation.workosInvitations
					.recordInvitationRevocationAttemptInternal,
				{ invitationId: args.invitationId, now }
			);
			return { status: "revoked" as const };
		} catch (error) {
			await ctx.runMutation(
				internal.legalRepresentation.workosInvitations
					.recordInvitationRevocationAttemptInternal,
				{
					deliveryError: sanitizeDeliveryError(error),
					invitationId: args.invitationId,
					now,
				}
			);
			console.error("[legalRepresentation.workosInvitations] revoke failed", {
				error: sanitizeDeliveryError(error),
				invitationId: args.invitationId,
				workosInvitationId: args.workosInvitationId,
			});
			return { status: "failed" as const };
		}
	})
	.internal();

export const resolveWorkosInvitationToken = convex
	.action()
	.input({ invitationToken: v.string() })
	.handler(
		async (
			ctx,
			args
		): Promise<
			| { readonly status: "not_found" }
			| {
					readonly dealId: Id<"deals">;
					readonly emailMatches: boolean;
					readonly nextRoute?: string;
					readonly onboardingSessionId?: Id<"lawyerOnboardingSessions">;
					readonly status: Doc<"lawyerInvitations">["status"];
					readonly targetEmail: string;
			  }
		> => {
			const findInvitationByToken = requireFindInvitationByToken(
				getWorkosProvisioning()
			);
			const workosInvitation = await findInvitationByToken(
				args.invitationToken
			);
			const localInvitation: Doc<"lawyerInvitations"> | null =
				await ctx.runQuery(
					internal.legalRepresentation.invitations
						.getPendingInvitationByWorkosInvitationIdInternal,
					{ workosInvitationId: workosInvitation.id }
				);
			if (!localInvitation) {
				return { status: "not_found" as const };
			}
			const emailMatches =
				normalizeLawyerEmail(workosInvitation.email) ===
				localInvitation.normalizedTargetEmail;
			const onboarding = await ctx.runMutation(
				internal.legalRepresentation.onboarding
					.startOrResumeForInvitationInternal,
				{ invitationId: localInvitation._id }
			);
			return {
				dealId: localInvitation.dealId,
				emailMatches,
				nextRoute: onboarding.session.nextRoute,
				onboardingSessionId: onboarding.session._id,
				status: localInvitation.status,
				targetEmail: localInvitation.targetEmail,
			};
		}
	)
	.public();

export const completeWorkosGuestInvitation = authedAction
	.input({
		invitationToken: v.string(),
		now: v.optional(v.number()),
	})
	.handler(async (ctx, args): Promise<InvitationAcceptResult> => {
		const findInvitationByToken = requireFindInvitationByToken(
			getWorkosProvisioning()
		);
		const workosInvitation = await findInvitationByToken(args.invitationToken);
		return await ctx.runMutation(
			internal.legalRepresentation.invitations
				.acceptWorkosInvitationForOnboardingInternal,
			{
				invitationEmail: workosInvitation.email,
				now: args.now,
				viewer: {
					authId: ctx.viewer.authId,
					email: ctx.viewer.email,
					permissions: [...ctx.viewer.permissions],
					role: ctx.viewer.role,
					roles: [...ctx.viewer.roles],
					verifiedEmail: ctx.viewer.verifiedEmail,
				},
				workosInvitationId: workosInvitation.id,
			}
		);
	})
	.public();
