import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { adminMutation, documentQuery } from "../fluent";
import { documentPackageDraftItemValidator } from "./validators";

type ResolvedPackageItem =
	| {
			groupId: Id<"documentTemplateGroups">;
			groupVersion: number;
			groupVersionId: Id<"documentGroupVersions">;
			kind: "group";
			label?: string;
			name: string;
			order: number;
			requiredPlatformRoles: string[];
			requiredVariableKeys: string[];
			signatories: Doc<"documentGroupVersions">["snapshot"]["signatories"];
			templateRefs: Doc<"documentGroupVersions">["snapshot"]["templateRefs"];
	  }
	| {
			containsSignableFields: boolean;
			kind: "standalone_template";
			label?: string;
			order: number;
			requiredPlatformRoles: string[];
			requiredVariableKeys: string[];
			templateId: Id<"documentTemplates">;
			templateName: string;
			templateVersion: number;
	  }
	| {
			assetId: Id<"documentAssets">;
			assetName: string;
			kind: "static_asset";
			label?: string;
			order: number;
	  };

export const create = adminMutation
	.input({
		description: v.optional(v.string()),
		name: v.string(),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		return await ctx.db.insert("documentPackageDefinitions", {
			createdAt: now,
			description: args.description,
			draft: { items: [] },
			hasDraftChanges: false,
			name: args.name,
			updatedAt: now,
		});
	})
	.public();

export const get = documentQuery
	.input({ packageId: v.id("documentPackageDefinitions") })
	.handler(async (ctx, args) => {
		return await ctx.db.get(args.packageId);
	})
	.public();

export const list = documentQuery
	.input({})
	.handler(async (ctx) => {
		return await ctx.db
			.query("documentPackageDefinitions")
			.withIndex("by_updated_at")
			.order("desc")
			.collect();
	})
	.public();

export const updateDraft = adminMutation
	.input({
		items: v.array(documentPackageDraftItemValidator),
		packageId: v.id("documentPackageDefinitions"),
	})
	.handler(async (ctx, args) => {
		const definition = await ctx.db.get(args.packageId);
		if (!definition) {
			throw new ConvexError("Document package not found");
		}

		await Promise.all(
			args.items.map((item) => validateDraftItemReference(ctx, item))
		);

		await ctx.db.patch(args.packageId, {
			draft: { items: args.items },
			hasDraftChanges: true,
			updatedAt: Date.now(),
		});
	})
	.public();

export const publish = adminMutation
	.input({
		packageId: v.id("documentPackageDefinitions"),
		publishedBy: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		const definition = await ctx.db.get(args.packageId);
		if (!definition) {
			throw new ConvexError("Document package not found");
		}
		if (definition.draft.items.length === 0) {
			throw new ConvexError("Cannot publish an empty document package");
		}

		const resolvedItems = (
			await Promise.all(
				definition.draft.items.map((item) => resolvePackageItem(ctx, item))
			)
		).sort((left, right) => left.order - right.order);
		const requiredVariableKeys = new Set<string>();
		const requiredPlatformRoles = new Set<string>();

		for (const item of resolvedItems) {
			if (item.kind === "static_asset") {
				continue;
			}
			for (const key of item.requiredVariableKeys) {
				requiredVariableKeys.add(key);
			}
			for (const role of item.requiredPlatformRoles) {
				requiredPlatformRoles.add(role);
			}
		}

		const envelopeBoundaries = resolvedItems.flatMap((item, itemIndex) => {
			const boundary = envelopeBoundaryForItem(item, itemIndex);
			return boundary ? [boundary] : [];
		});

		const latestVersion = await ctx.db
			.query("documentPackageVersions")
			.withIndex("by_package", (q) => q.eq("packageId", args.packageId))
			.order("desc")
			.first();
		const version = (latestVersion?.version ?? 0) + 1;
		const publishedAt = Date.now();
		const versionId = await ctx.db.insert("documentPackageVersions", {
			packageId: args.packageId,
			publishedAt,
			publishedBy: args.publishedBy,
			snapshot: {
				description: definition.description,
				envelopeBoundaries,
				items: resolvedItems,
				name: definition.name,
				requiredPlatformRoles: [...requiredPlatformRoles].sort(),
				requiredVariableKeys: [...requiredVariableKeys].sort(),
			},
			version,
		});

		await ctx.db.patch(args.packageId, {
			currentPublishedVersion: version,
			hasDraftChanges: false,
			updatedAt: publishedAt,
		});

		const publishedVersion = await ctx.db.get(versionId);
		if (!publishedVersion) {
			throw new ConvexError("Published package version could not be loaded");
		}
		return publishedVersion;
	})
	.public();

export const listVersions = documentQuery
	.input({ packageId: v.id("documentPackageDefinitions") })
	.handler(async (ctx, args) => {
		return await ctx.db
			.query("documentPackageVersions")
			.withIndex("by_package", (q) => q.eq("packageId", args.packageId))
			.order("desc")
			.collect();
	})
	.public();

export const listAllVersions = documentQuery
	.input({})
	.handler(async (ctx) => {
		const versions = await ctx.db
			.query("documentPackageVersions")
			.order("desc")
			.collect();
		return await Promise.all(
			versions.map(async (version) => {
				const definition = await ctx.db.get(version.packageId);
				return {
					...version,
					packageName: definition?.name ?? version.snapshot.name,
				};
			})
		);
	})
	.public();

export const getVersion = documentQuery
	.input({
		packageId: v.id("documentPackageDefinitions"),
		version: v.number(),
	})
	.handler(async (ctx, args) => {
		return await ctx.db
			.query("documentPackageVersions")
			.withIndex("by_package", (q) =>
				q.eq("packageId", args.packageId).eq("version", args.version)
			)
			.first();
	})
	.public();

async function validateDraftItemReference(
	ctx: MutationCtx,
	item: Doc<"documentPackageDefinitions">["draft"]["items"][number]
) {
	await resolvePackageItem(ctx, item);
}

async function resolvePackageItem(
	ctx: MutationCtx,
	item: Doc<"documentPackageDefinitions">["draft"]["items"][number]
): Promise<ResolvedPackageItem> {
	if (item.kind === "group") {
		const groupVersion = await ctx.db.get(item.groupVersionId);
		if (!groupVersion) {
			throw new ConvexError("Group version not found");
		}
		return {
			groupId: groupVersion.groupId,
			groupVersion: groupVersion.version,
			groupVersionId: item.groupVersionId,
			kind: "group",
			label: item.label,
			name: groupVersion.snapshot.name,
			order: item.order,
			requiredPlatformRoles: groupVersion.snapshot.requiredPlatformRoles,
			requiredVariableKeys: groupVersion.snapshot.requiredVariableKeys,
			signatories: groupVersion.snapshot.signatories,
			templateRefs: groupVersion.snapshot.templateRefs,
		};
	}

	if (item.kind === "standalone_template") {
		const template = await ctx.db.get(item.templateId);
		if (!template) {
			throw new ConvexError("Standalone template not found");
		}
		const templateVersion =
			item.pinnedVersion === undefined
				? await ctx.db
						.query("documentTemplateVersions")
						.withIndex("by_template", (q) =>
							q.eq("templateId", item.templateId)
						)
						.order("desc")
						.first()
				: await getPinnedTemplateVersion(
						ctx,
						item.templateId,
						item.pinnedVersion
					);
		if (!templateVersion) {
			throw new ConvexError(
				"Standalone template must have a published version"
			);
		}
		const requiredVariableKeys = new Set<string>();
		const requiredPlatformRoles = new Set<string>();
		let containsSignableFields = false;
		for (const field of templateVersion.snapshot.fields) {
			if (field.type === "interpolable" && field.variableKey) {
				requiredVariableKeys.add(field.variableKey);
			}
			if (field.type === "signable") {
				containsSignableFields = true;
				if (field.signatoryPlatformRole) {
					requiredPlatformRoles.add(field.signatoryPlatformRole);
				}
			}
		}
		for (const signatory of templateVersion.snapshot.signatories) {
			requiredPlatformRoles.add(signatory.platformRole);
		}
		return {
			containsSignableFields,
			kind: "standalone_template",
			label: item.label,
			order: item.order,
			requiredPlatformRoles: [...requiredPlatformRoles].sort(),
			requiredVariableKeys: [...requiredVariableKeys].sort(),
			templateId: item.templateId,
			templateName: template.name,
			templateVersion: templateVersion.version,
		};
	}

	const asset = await ctx.db.get(item.assetId);
	if (!asset) {
		throw new ConvexError("Static package asset not found");
	}
	return {
		assetId: item.assetId,
		assetName: asset.name,
		kind: "static_asset",
		label: item.label,
		order: item.order,
	};
}

function envelopeBoundaryForItem(item: ResolvedPackageItem, itemIndex: number) {
	if (item.kind === "group") {
		return { itemIndex, kind: "group" as const };
	}
	if (item.kind === "standalone_template" && item.containsSignableFields) {
		return { itemIndex, kind: "standalone_signable" as const };
	}
	return null;
}

function getPinnedTemplateVersion(
	ctx: MutationCtx,
	templateId: Id<"documentTemplates">,
	version: number
) {
	return ctx.db
		.query("documentTemplateVersions")
		.withIndex("by_template", (q) =>
			q.eq("templateId", templateId).eq("version", version)
		)
		.first();
}
