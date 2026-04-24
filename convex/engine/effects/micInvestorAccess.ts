import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { internalAction } from "../../_generated/server";
import { effectPayloadValidator } from "../validators";
import { getWorkosProvisioning } from "./workosProvisioning";

function isWorkosConflictError(error: unknown): error is { status: number } {
	return (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		typeof error.status === "number" &&
		error.status === 409
	);
}

async function findProvisionedUserByEmail(email: string) {
	const provisioning = getWorkosProvisioning();
	const users = await provisioning.listUsers({ email });
	return (
		users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ??
		null
	);
}

async function getOrCreateMicUser(email: string) {
	const provisioning = getWorkosProvisioning();
	const existingUser = await findProvisionedUserByEmail(email);
	if (existingUser) {
		return existingUser;
	}

	try {
		return await provisioning.createUser({ email });
	} catch (error) {
		if (!isWorkosConflictError(error)) {
			throw error;
		}
		const conflictedUser = await findProvisionedUserByEmail(email);
		if (conflictedUser) {
			return conflictedUser;
		}
		throw error;
	}
}

async function ensureMicMembership(args: {
	organizationId: string;
	roleSlug: string;
	userId: string;
}) {
	const provisioning = getWorkosProvisioning();
	try {
		const membership = await provisioning.createOrganizationMembership({
			organizationId: args.organizationId,
			roleSlug: args.roleSlug,
			userId: args.userId,
		});
		return membership as { id?: string };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (
			message.includes("already exists") ||
			message.includes("already a member")
		) {
			return {};
		}
		throw error;
	}
}

export const provisionMicAccess = internalAction({
	args: effectPayloadValidator,
	handler: async (ctx, args) => {
		const request = await ctx.runQuery(
			internal.micInvestorAccess.internal.getById,
			{
				requestId: args.entityId as Id<"micInvestorAccessRequests">,
			}
		);
		if (!request) {
			throw new Error(`MIC access request not found: ${args.entityId}`);
		}

		const portal = await ctx.runQuery(
			internal.portals.queries.getPortalByIdInternal,
			{
				portalId: request.portalId,
			}
		);
		if (!portal || portal.portalType !== "mic") {
			throw new Error("MIC portal not found");
		}

		try {
			const workosUser = await getOrCreateMicUser(request.normalizedEmail);
			const membership = await ensureMicMembership({
				organizationId: portal.orgId,
				roleSlug: "micinvestor",
				userId: workosUser.id,
			});

			await ctx.runMutation(
				internal.micInvestorAccess.internal.upsertProvisionedUser,
				{
					authId: workosUser.id,
					email: workosUser.email,
				}
			);
			await ctx.runMutation(
				internal.micInvestorAccess.internal.upsertProvisionedMembership,
				{
					organizationName: undefined,
					organizationWorkosId: portal.orgId,
					roleSlug: "micinvestor",
					userWorkosId: workosUser.id,
					workosId: membership.id,
				}
			);
			await ctx.runMutation(internal.auth.syncUserHomePortalAssignment, {
				authId: workosUser.id,
			});
			await ctx.runMutation(
				internal.micInvestorAccess.internal.markProvisioned,
				{
					requestId: request._id,
					workosMembershipId: membership.id,
					workosUserId: workosUser.id,
				}
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await ctx.runMutation(
				internal.micInvestorAccess.internal.markProvisioningFailed,
				{
					errorMessage: message,
					requestId: request._id,
				}
			);
			throw error;
		}
	},
});
