import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { upsertUserByAuthId } from "../users/byAuthId";

export const getById = internalQuery({
	args: { requestId: v.id("micInvestorAccessRequests") },
	handler: async (ctx, args) => await ctx.db.get(args.requestId),
});

export const markProvisioned = internalMutation({
	args: {
		requestId: v.id("micInvestorAccessRequests"),
		workosMembershipId: v.optional(v.string()),
		workosUserId: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.requestId, {
			provisioningError: undefined,
			provisioningState: "provisioned",
			updatedAt: Date.now(),
			workosMembershipId: args.workosMembershipId,
			workosUserId: args.workosUserId,
		});
	},
});

export const markProvisioningFailed = internalMutation({
	args: {
		errorMessage: v.string(),
		requestId: v.id("micInvestorAccessRequests"),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.requestId, {
			provisioningError: args.errorMessage,
			provisioningState: "failed",
			updatedAt: Date.now(),
		});
	},
});

export const upsertProvisionedUser = internalMutation({
	args: {
		authId: v.string(),
		email: v.string(),
		firstName: v.optional(v.string()),
		lastName: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const result = await upsertUserByAuthId(ctx, {
			authId: args.authId,
			email: args.email,
			firstName: args.firstName,
			lastName: args.lastName,
		});
		return {
			userId: result.canonicalUser._id,
		};
	},
});

export const upsertProvisionedMembership = internalMutation({
	args: {
		organizationWorkosId: v.string(),
		organizationName: v.optional(v.string()),
		roleSlug: v.string(),
		userWorkosId: v.string(),
		workosId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const stableWorkosId =
			args.workosId ??
			`synthetic:${args.organizationWorkosId}:${args.userWorkosId}:${args.roleSlug}`;

		const existing = await ctx.db
			.query("organizationMemberships")
			.withIndex("workosId", (query) => query.eq("workosId", stableWorkosId))
			.unique();

		const fields = {
			organizationName: args.organizationName,
			organizationWorkosId: args.organizationWorkosId,
			roleSlug: args.roleSlug,
			roleSlugs: [args.roleSlug],
			status: "active",
			userWorkosId: args.userWorkosId,
			workosId: stableWorkosId,
		};

		if (existing) {
			await ctx.db.patch(existing._id, fields);
			return existing._id;
		}

		return await ctx.db.insert("organizationMemberships", fields);
	},
});
