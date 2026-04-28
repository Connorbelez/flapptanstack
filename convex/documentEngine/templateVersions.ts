import { v } from "convex/values";
import { documentQuery } from "../fluent";

export const listByTemplate = documentQuery
	.input({ templateId: v.id("documentTemplates") })
	.handler(async (ctx, args) => {
		return await ctx.db
			.query("documentTemplateVersions")
			.withIndex("by_template", (q) => q.eq("templateId", args.templateId))
			.order("desc")
			.collect();
	})
	.public();

export const listAll = documentQuery
	.input({})
	.handler(async (ctx) => {
		const versions = await ctx.db
			.query("documentTemplateVersions")
			.order("desc")
			.collect();
		return await Promise.all(
			versions.map(async (version) => {
				const template = await ctx.db.get(version.templateId);
				return {
					...version,
					templateName: template?.name ?? "Deleted template",
				};
			})
		);
	})
	.public();

export const get = documentQuery
	.input({
		templateId: v.id("documentTemplates"),
		version: v.number(),
	})
	.handler(async (ctx, args) => {
		return await ctx.db
			.query("documentTemplateVersions")
			.withIndex("by_template", (q) =>
				q.eq("templateId", args.templateId).eq("version", args.version)
			)
			.first();
	})
	.public();

export const getLatest = documentQuery
	.input({ templateId: v.id("documentTemplates") })
	.handler(async (ctx, args) => {
		return await ctx.db
			.query("documentTemplateVersions")
			.withIndex("by_template", (q) => q.eq("templateId", args.templateId))
			.order("desc")
			.first();
	})
	.public();
