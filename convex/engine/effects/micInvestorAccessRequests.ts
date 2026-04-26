import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { type ActionCtx, internalAction } from "../../_generated/server";
import { auditLog } from "../../auditLog";
import { effectPayloadValidator } from "../validators";
import { getWorkosProvisioning } from "./workosProvisioning";

const MIC_INVESTOR_ROLE_SLUG = "micinvestor";

interface WorkosUser {
	email: string;
	id: string;
}
type HomePortalAssignmentStatus =
	| "already_assigned"
	| "assigned"
	| "missing_user"
	| "not_compatible";

function normalizeProvisioningError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

function isAlreadyMemberError(error: unknown) {
	const message = normalizeProvisioningError(error).toLowerCase();
	return (
		message.includes("already exists") || message.includes("already a member")
	);
}

async function resolveWorkosUser(email: string): Promise<{
	created: boolean;
	user: WorkosUser;
}> {
	const normalizedEmail = email.trim().toLowerCase();
	const workosProvisioning = getWorkosProvisioning();
	const users = await workosProvisioning.listUsers({ email: normalizedEmail });
	const existingUser = users.find(
		(user) => user.email.trim().toLowerCase() === normalizedEmail
	);
	if (existingUser) {
		return { created: false, user: existingUser };
	}

	const user = await workosProvisioning.createUser({ email: normalizedEmail });
	return { created: true, user };
}

async function createMicMembership(args: {
	organizationId: string;
	userId: string;
}): Promise<{ alreadyMember: boolean; membershipWorkosId?: string }> {
	const workosProvisioning = getWorkosProvisioning();
	try {
		const membership = await workosProvisioning.createOrganizationMembership({
			organizationId: args.organizationId,
			roleSlug: MIC_INVESTOR_ROLE_SLUG,
			userId: args.userId,
		});
		return {
			alreadyMember: false,
			membershipWorkosId: membership.id,
		};
	} catch (error) {
		if (isAlreadyMemberError(error)) {
			return { alreadyMember: true };
		}
		throw error;
	}
}

async function assignSyncedUserHomePortal(
	ctx: ActionCtx,
	args: {
		portalId: Id<"portals">;
		workosUserId: string;
	}
): Promise<HomePortalAssignmentStatus> {
	const syncedUser = await ctx.runQuery(
		internal.micInvestorAccessRequests.internal.getSyncedUserByWorkosId,
		{ workosUserId: args.workosUserId }
	);
	if (!syncedUser) {
		return "missing_user";
	}

	return await ctx.runMutation(
		internal.micInvestorAccessRequests.internal.assignMicHomePortalIfCompatible,
		{
			portalId: args.portalId,
			userId: syncedUser._id,
		}
	);
}

export const provisionMicInvestorAccess = internalAction({
	args: effectPayloadValidator,
	handler: async (ctx, args) => {
		const requestId = args.entityId as Id<"micInvestorAccessRequests">;
		const request = await ctx.runQuery(
			internal.micInvestorAccessRequests.internal.getRequestById,
			{ id: requestId }
		);
		if (!request) {
			throw new Error(
				`[provisionMicInvestorAccess] Request not found: ${args.entityId}`
			);
		}

		if (request.status !== "approved") {
			throw new Error(
				`[provisionMicInvestorAccess] Request ${args.entityId} is ${request.status}; expected approved`
			);
		}

		const processing = await ctx.runMutation(
			internal.micInvestorAccessRequests.internal.beginProvisioningProcessing,
			{
				journalEntryId: args.journalEntryId,
				requestId,
			}
		);
		if (processing.status === "processed") {
			return;
		}

		const portalConfig = await ctx.runQuery(
			internal.portals.micConfig.getMicPortalConfig,
			{ portalId: request.portalId }
		);

		if (portalConfig.availability !== "active") {
			const error = `MIC portal unavailable for provisioning: ${portalConfig.availability}`;
			await ctx.runMutation(
				internal.micInvestorAccessRequests.internal.failProvisioningProcessing,
				{
					error,
					journalEntryId: args.journalEntryId,
					requestId,
				}
			);
			await auditLog.log(ctx, {
				action: "micInvestorAccessRequest.provisioning_failed",
				actorId: "system",
				metadata: {
					error,
					journalEntryId: args.journalEntryId,
				},
				resourceId: requestId,
				resourceType: "micInvestorAccessRequests",
				severity: "error",
			});
			return;
		}

		let userWorkosId: string | undefined;
		try {
			const userResolution = await resolveWorkosUser(request.normalizedEmail);
			userWorkosId = userResolution.user.id;
			const membership = await createMicMembership({
				organizationId: portalConfig.orgId,
				userId: userWorkosId,
			});
			const homePortalAssignment = await assignSyncedUserHomePortal(ctx, {
				portalId: portalConfig.portalId,
				workosUserId: userWorkosId,
			});

			await ctx.runMutation(
				internal.micInvestorAccessRequests.internal
					.completeProvisioningProcessing,
				{
					journalEntryId: args.journalEntryId,
					membershipWorkosId: membership.membershipWorkosId,
					requestId,
					userWorkosId,
				}
			);
			await auditLog.log(ctx, {
				action: "micInvestorAccessRequest.provisioning_completed",
				actorId: "system",
				metadata: {
					alreadyMember: membership.alreadyMember,
					homePortalAssignment,
					journalEntryId: args.journalEntryId,
					membershipWorkosId: membership.membershipWorkosId,
					orgId: portalConfig.orgId,
					roleSlug: MIC_INVESTOR_ROLE_SLUG,
					userCreated: userResolution.created,
					userWorkosId,
				},
				resourceId: requestId,
				resourceType: "micInvestorAccessRequests",
				severity: "info",
			});
		} catch (error) {
			const message = normalizeProvisioningError(error);
			await ctx.runMutation(
				internal.micInvestorAccessRequests.internal.failProvisioningProcessing,
				{
					error: message,
					journalEntryId: args.journalEntryId,
					requestId,
					userWorkosId,
				}
			);
			await auditLog.log(ctx, {
				action: "micInvestorAccessRequest.provisioning_failed",
				actorId: "system",
				metadata: {
					error: message,
					journalEntryId: args.journalEntryId,
					orgId: portalConfig.orgId,
					roleSlug: MIC_INVESTOR_ROLE_SLUG,
					userWorkosId,
				},
				resourceId: requestId,
				resourceType: "micInvestorAccessRequests",
				severity: "error",
			});
		}
	},
});
