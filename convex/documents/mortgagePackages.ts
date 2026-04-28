import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { adminMutation, documentQuery } from "../fluent";

export const listApplications = documentQuery
	.input({
		includeArchived: v.optional(v.boolean()),
		mortgageId: v.id("mortgages"),
	})
	.handler(async (ctx, args) => {
		const applications = args.includeArchived
			? await ctx.db
					.query("mortgagePackageApplications")
					.withIndex("by_mortgage_status", (q) =>
						q.eq("mortgageId", args.mortgageId)
					)
					.collect()
			: await ctx.db
					.query("mortgagePackageApplications")
					.withIndex("by_mortgage_status", (q) =>
						q.eq("mortgageId", args.mortgageId).eq("status", "active")
					)
					.collect();

		return await Promise.all(
			applications.map(async (application) => {
				const packageVersion = await ctx.db.get(application.packageVersionId);
				const definition = packageVersion
					? await ctx.db.get(packageVersion.packageId)
					: null;
				return {
					...application,
					packageName:
						definition?.name ??
						packageVersion?.snapshot.name ??
						"Deleted package",
					packageVersion: packageVersion?.version ?? null,
				};
			})
		);
	})
	.public();

export const applyPackageVersion = adminMutation
	.input({
		mortgageId: v.id("mortgages"),
		packageVersionId: v.id("documentPackageVersions"),
	})
	.handler(async (ctx, args) => {
		const mortgage = await ctx.db.get(args.mortgageId);
		if (!mortgage) {
			throw new ConvexError("Mortgage not found");
		}
		const packageVersion = await ctx.db.get(args.packageVersionId);
		if (!packageVersion) {
			throw new ConvexError("Document package version not found");
		}

		const now = Date.now();
		const actorUserId = await resolveViewerUserId(ctx);
		const activeApplications = await listActiveApplications(
			ctx,
			args.mortgageId
		);
		for (const application of activeApplications) {
			await ctx.db.patch(application._id, {
				archivedAt: now,
				archivedByUserId: actorUserId,
				status: "archived",
			});
		}

		return await ctx.db.insert("mortgagePackageApplications", {
			createdAt: now,
			createdByUserId: actorUserId,
			mortgageId: args.mortgageId,
			packageVersionId: args.packageVersionId,
			status: "active",
		});
	})
	.public();

export const archiveApplication = adminMutation
	.input({ applicationId: v.id("mortgagePackageApplications") })
	.handler(async (ctx, args) => {
		const application = await ctx.db.get(args.applicationId);
		if (!application) {
			return;
		}
		await ctx.db.patch(args.applicationId, {
			archivedAt: Date.now(),
			archivedByUserId: await resolveViewerUserId(ctx),
			status: "archived",
		});
	})
	.public();

export async function getActiveApplicationForMortgage(
	ctx: Pick<MutationCtx, "db">,
	mortgageId: Id<"mortgages">
) {
	return await ctx.db
		.query("mortgagePackageApplications")
		.withIndex("by_mortgage_status", (q) =>
			q.eq("mortgageId", mortgageId).eq("status", "active")
		)
		.order("desc")
		.first();
}

async function listActiveApplications(
	ctx: Pick<MutationCtx, "db">,
	mortgageId: Id<"mortgages">
) {
	return await ctx.db
		.query("mortgagePackageApplications")
		.withIndex("by_mortgage_status", (q) =>
			q.eq("mortgageId", mortgageId).eq("status", "active")
		)
		.collect();
}

async function resolveViewerUserId(
	ctx: MutationCtx & { viewer: { authId: string } }
) {
	const viewerAuthId = ctx.viewer.authId;
	const user = await ctx.db
		.query("users")
		.withIndex("authId", (q) => q.eq("authId", viewerAuthId))
		.first();
	return user?._id;
}
