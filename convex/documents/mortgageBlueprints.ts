import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { assertOrgScopedRecordAccess } from "../authz/orgScope";
import { adminMutation, adminQuery, requirePermission } from "../fluent";
import { syncListingPublicDocumentsProjection } from "../listings/projection";
import {
	ALLOWED_MORTGAGE_SIGNATORY_PLATFORM_ROLES,
	type MortgageDocumentBlueprintClass,
	type MortgageDocumentMappingOverrides,
	type MortgageDocumentValidationSummary,
	mortgageDocumentBlueprintClassValidator,
	mortgageDocumentMappingOverridesValidator,
	SUPPORTED_MORTGAGE_DOCUMENT_VARIABLE_KEYS,
} from "./contracts";
import { loadPinnedTemplateSnapshot } from "./templateValidation";

type BlueprintRow = Doc<"mortgageDocumentBlueprints">;
type TemplateSnapshot = Doc<"documentTemplateVersions">["snapshot"];

async function buildBlueprintListItem(
	ctx: Pick<QueryCtx | MutationCtx, "db" | "storage">,
	blueprint: BlueprintRow
) {
	const [asset, template] = await Promise.all([
		blueprint.assetId ? ctx.db.get(blueprint.assetId) : Promise.resolve(null),
		blueprint.templateId
			? ctx.db.get(blueprint.templateId)
			: Promise.resolve(null),
	]);
	const downloadUrl = asset ? await ctx.storage.getUrl(asset.fileRef) : null;

	return {
		...blueprint,
		blueprintId: blueprint._id,
		asset: asset
			? {
					assetId: asset._id,
					fileRef: asset.fileRef,
					name: asset.name,
					originalFilename: asset.originalFilename,
					url: downloadUrl,
				}
			: null,
		template: template
			? {
					name: template.name,
					templateId: template._id,
				}
			: null,
	};
}

export async function listMortgageBlueprintRows(
	ctx: Pick<QueryCtx | MutationCtx, "db">,
	args: {
		includeArchived?: boolean;
		mortgageId: Id<"mortgages">;
	}
) {
	const rows = args.includeArchived
		? await ctx.db
				.query("mortgageDocumentBlueprints")
				.withIndex("by_mortgage_created_at", (query) =>
					query.eq("mortgageId", args.mortgageId)
				)
				.collect()
		: await ctx.db
				.query("mortgageDocumentBlueprints")
				.withIndex("by_mortgage_status_class", (query) =>
					query.eq("mortgageId", args.mortgageId).eq("status", "active")
				)
				.collect();

	return rows.sort((left, right) => {
		if (left.displayOrder !== right.displayOrder) {
			return left.displayOrder - right.displayOrder;
		}
		return left.createdAt - right.createdAt;
	});
}

export async function listActivePublicStaticBlueprintAssets(
	ctx: Pick<QueryCtx | MutationCtx, "db">,
	mortgageId: Id<"mortgages">
) {
	const blueprints = await ctx.db
		.query("mortgageDocumentBlueprints")
		.withIndex("by_mortgage_status_class", (query) =>
			query
				.eq("mortgageId", mortgageId)
				.eq("status", "active")
				.eq("class", "public_static")
		)
		.collect();

	const assets = await Promise.all(
		blueprints
			.filter(
				(
					blueprint
				): blueprint is BlueprintRow & { assetId: Id<"documentAssets"> } =>
					Boolean(blueprint.assetId)
			)
			.sort((left, right) => left.displayOrder - right.displayOrder)
			.map(async (blueprint) => {
				const asset = await ctx.db.get(blueprint.assetId);
				if (!asset) {
					return null;
				}

				return { asset, blueprint };
			})
	);

	return assets.filter(
		(entry): entry is NonNullable<(typeof assets)[number]> => entry !== null
	);
}

async function requireViewerUserId(
	ctx: Pick<MutationCtx, "db"> & {
		viewer: { authId: string };
	}
) {
	const user = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", ctx.viewer.authId))
		.unique();
	if (!user) {
		throw new ConvexError("User not found in database");
	}

	return user._id;
}

async function requireAccessibleMortgage(
	ctx: Pick<QueryCtx | MutationCtx, "db"> & {
		viewer: { isFairLendAdmin: boolean; orgId?: string };
	},
	mortgageId: Id<"mortgages">
) {
	const mortgage = await ctx.db.get(mortgageId);
	assertOrgScopedRecordAccess({
		entityName: "Mortgage",
		notFoundMessage: "Mortgage not found or access denied",
		record: mortgage,
		viewer: ctx.viewer,
	});

	return mortgage;
}

async function syncListingProjectionForPublicBlueprints(
	ctx: MutationCtx,
	args: {
		mortgageId: Id<"mortgages">;
		now: number;
	}
) {
	const listing = await ctx.db
		.query("listings")
		.withIndex("by_mortgage", (query) =>
			query.eq("mortgageId", args.mortgageId)
		)
		.unique();
	if (listing?.dataSource === "mortgage_pipeline") {
		await syncListingPublicDocumentsProjection(ctx, {
			listingId: listing._id,
			mortgageId: args.mortgageId,
			now: args.now,
		});
	}
}

function normalizeMappingOverridesForMatchKey(
	mappingOverrides?: MortgageDocumentMappingOverrides
) {
	const variables = [...(mappingOverrides?.variables ?? [])]
		.sort((left, right) =>
			left.templateVariableKey.localeCompare(right.templateVariableKey)
		)
		.map((row) => ({
			dealVariableKey: row.dealVariableKey,
			templateVariableKey: row.templateVariableKey,
		}));
	const signatories = [...(mappingOverrides?.signatories ?? [])]
		.sort((left, right) =>
			left.templatePlatformRole.localeCompare(right.templatePlatformRole)
		)
		.map((row) => ({
			dealParticipantRole: row.dealParticipantRole,
			templatePlatformRole: row.templatePlatformRole,
		}));

	if (variables.length === 0 && signatories.length === 0) {
		return null;
	}

	return { signatories, variables };
}

export function buildBlueprintMatchKey(args: {
	assetId?: Id<"documentAssets">;
	class: BlueprintRow["class"];
	displayName: string;
	mappingOverrides?: MortgageDocumentMappingOverrides;
	packageKey?: string;
	packageLabel?: string;
	templateId?: Id<"documentTemplates">;
	templateVersion?: number;
}) {
	return JSON.stringify({
		assetId: args.assetId ?? null,
		class: args.class,
		displayName: args.displayName,
		mappingOverrides: normalizeMappingOverridesForMatchKey(
			args.mappingOverrides
		),
		packageKey: args.packageKey ?? null,
		packageLabel: args.packageLabel ?? null,
		templateId: args.templateId ?? null,
		templateVersion: args.templateVersion ?? null,
	});
}

async function listActiveBlueprintsForMortgage(
	ctx: Pick<QueryCtx | MutationCtx, "db">,
	mortgageId: Id<"mortgages">
) {
	return ctx.db
		.query("mortgageDocumentBlueprints")
		.withIndex("by_mortgage_status_class", (query) =>
			query.eq("mortgageId", mortgageId).eq("status", "active")
		)
		.collect();
}

async function archiveBlueprintRecord(
	ctx: MutationCtx,
	args: {
		blueprint: BlueprintRow;
		now: number;
		viewerUserId: Id<"users">;
	}
) {
	if (args.blueprint.status === "archived") {
		return;
	}

	await ctx.db.patch(args.blueprint._id, {
		archivedAt: args.now,
		archivedByUserId: args.viewerUserId,
		status: "archived",
	});
}

function assertUniqueRows(values: readonly string[], message: string) {
	const seen = new Set<string>();
	for (const value of values) {
		if (seen.has(value)) {
			throw new ConvexError(message);
		}
		seen.add(value);
	}
}

export function validateMortgageDocumentMappingOverrides(args: {
	allowedPlatformRoles: readonly string[];
	allowedVariableKeys: readonly string[];
	mappingOverrides?: MortgageDocumentMappingOverrides;
	requiredPlatformRoles: readonly string[];
	requiredVariableKeys: readonly string[];
}) {
	if (!args.mappingOverrides) {
		return;
	}

	assertUniqueRows(
		args.mappingOverrides.variables.map((row) => row.templateVariableKey),
		"Duplicate variable mapping override"
	);
	assertUniqueRows(
		args.mappingOverrides.signatories.map((row) => row.templatePlatformRole),
		"Duplicate signatory mapping override"
	);

	for (const row of args.mappingOverrides.variables) {
		if (!args.requiredVariableKeys.includes(row.templateVariableKey)) {
			throw new ConvexError("Unknown template variable override");
		}
		if (!args.allowedVariableKeys.includes(row.dealVariableKey)) {
			throw new ConvexError("Unsupported variable mapping target");
		}
	}

	for (const row of args.mappingOverrides.signatories) {
		if (!args.requiredPlatformRoles.includes(row.templatePlatformRole)) {
			throw new ConvexError("Unknown template signatory override");
		}
		if (!args.allowedPlatformRoles.includes(row.dealParticipantRole)) {
			throw new ConvexError("Unsupported signatory mapping target");
		}
	}
}

export function buildEffectiveMortgageDocumentMappings(args: {
	mappingOverrides?: MortgageDocumentMappingOverrides;
	requiredPlatformRoles: readonly string[];
	requiredVariableKeys: readonly string[];
}) {
	const variableOverrides = new Map(
		(args.mappingOverrides?.variables ?? []).map((row) => [
			row.templateVariableKey,
			row.dealVariableKey,
		])
	);
	const signatoryOverrides = new Map(
		(args.mappingOverrides?.signatories ?? []).map((row) => [
			row.templatePlatformRole,
			row.dealParticipantRole,
		])
	);

	return {
		signatories: args.requiredPlatformRoles.map((templatePlatformRole) => ({
			dealParticipantRole:
				signatoryOverrides.get(templatePlatformRole) ?? templatePlatformRole,
			templatePlatformRole,
		})),
		variables: args.requiredVariableKeys.map((templateVariableKey) => ({
			dealVariableKey:
				variableOverrides.get(templateVariableKey) ?? templateVariableKey,
			templateVariableKey,
		})),
	};
}

function discoverMortgageDocumentTemplateRequirements(args: {
	documentClass: MortgageDocumentBlueprintClass;
	snapshot: TemplateSnapshot;
}) {
	const requiredVariableKeys = [
		...new Set(
			args.snapshot.fields
				.filter(
					(field): field is typeof field & { variableKey: string } =>
						field.type === "interpolable" &&
						typeof field.variableKey === "string"
				)
				.map((field) => field.variableKey)
		),
	];
	const requiredPlatformRoles = [
		...new Set(
			args.snapshot.signatories.map((signatory) => signatory.platformRole)
		),
	];
	const containsSignableFields = args.snapshot.fields.some(
		(field) => field.type === "signable"
	);

	if (
		args.documentClass === "private_templated_non_signable" &&
		containsSignableFields
	) {
		throw new ConvexError(
			"Non-signable private templated drafts cannot contain signable fields."
		);
	}

	if (args.documentClass === "private_templated_signable") {
		if (!containsSignableFields) {
			throw new ConvexError(
				"Signable private templated drafts must contain at least one signable field."
			);
		}
		if (requiredPlatformRoles.length === 0) {
			throw new ConvexError(
				"Signable private templated drafts must contain at least one platform role."
			);
		}
	}

	return {
		containsSignableFields,
		requiredPlatformRoles,
		requiredVariableKeys,
	};
}

export function buildOverrideAwareMortgageDocumentValidationSummary(args: {
	documentClass: MortgageDocumentBlueprintClass;
	mappingOverrides?: MortgageDocumentMappingOverrides;
	snapshot: TemplateSnapshot;
}): MortgageDocumentValidationSummary {
	const requirements = discoverMortgageDocumentTemplateRequirements(args);
	validateMortgageDocumentMappingOverrides({
		allowedPlatformRoles: ALLOWED_MORTGAGE_SIGNATORY_PLATFORM_ROLES,
		allowedVariableKeys: SUPPORTED_MORTGAGE_DOCUMENT_VARIABLE_KEYS,
		mappingOverrides: args.mappingOverrides,
		requiredPlatformRoles: requirements.requiredPlatformRoles,
		requiredVariableKeys: requirements.requiredVariableKeys,
	});
	const effectiveMappings = buildEffectiveMortgageDocumentMappings({
		mappingOverrides: args.mappingOverrides,
		requiredPlatformRoles: requirements.requiredPlatformRoles,
		requiredVariableKeys: requirements.requiredVariableKeys,
	});
	const supportedVariableKeys: readonly string[] =
		SUPPORTED_MORTGAGE_DOCUMENT_VARIABLE_KEYS;
	const supportedPlatformRoles: readonly string[] =
		ALLOWED_MORTGAGE_SIGNATORY_PLATFORM_ROLES;
	const unsupportedVariableKeys = effectiveMappings.variables
		.filter(
			(mapping) => !supportedVariableKeys.includes(mapping.dealVariableKey)
		)
		.map((mapping) => mapping.templateVariableKey);
	const unsupportedPlatformRoles = effectiveMappings.signatories
		.filter(
			(mapping) => !supportedPlatformRoles.includes(mapping.dealParticipantRole)
		)
		.map((mapping) => mapping.templatePlatformRole);

	if (unsupportedVariableKeys.length > 0) {
		throw new ConvexError(
			`Template uses unsupported mortgage variables: ${unsupportedVariableKeys.join(", ")}`
		);
	}

	if (unsupportedPlatformRoles.length > 0) {
		throw new ConvexError(
			`Template uses unsupported signatory roles: ${unsupportedPlatformRoles.join(", ")}`
		);
	}

	return {
		containsSignableFields: requirements.containsSignableFields,
		requiredPlatformRoles: requirements.requiredPlatformRoles,
		requiredVariableKeys: requirements.requiredVariableKeys,
		unsupportedPlatformRoles,
		unsupportedVariableKeys,
	};
}

export function buildPreviewMortgageDocumentMappingSummary(args: {
	documentClass: MortgageDocumentBlueprintClass;
	mappingOverrides?: MortgageDocumentMappingOverrides;
	snapshot: TemplateSnapshot;
}) {
	const requirements = discoverMortgageDocumentTemplateRequirements(args);
	validateMortgageDocumentMappingOverrides({
		allowedPlatformRoles: ALLOWED_MORTGAGE_SIGNATORY_PLATFORM_ROLES,
		allowedVariableKeys: SUPPORTED_MORTGAGE_DOCUMENT_VARIABLE_KEYS,
		mappingOverrides: args.mappingOverrides,
		requiredPlatformRoles: requirements.requiredPlatformRoles,
		requiredVariableKeys: requirements.requiredVariableKeys,
	});
	const effectiveMappings = buildEffectiveMortgageDocumentMappings({
		mappingOverrides: args.mappingOverrides,
		requiredPlatformRoles: requirements.requiredPlatformRoles,
		requiredVariableKeys: requirements.requiredVariableKeys,
	});
	const supportedVariableKeys: readonly string[] =
		SUPPORTED_MORTGAGE_DOCUMENT_VARIABLE_KEYS;
	const supportedPlatformRoles: readonly string[] =
		ALLOWED_MORTGAGE_SIGNATORY_PLATFORM_ROLES;

	return {
		effectiveMappings,
		validationSummary: {
			containsSignableFields: requirements.containsSignableFields,
			requiredPlatformRoles: requirements.requiredPlatformRoles,
			requiredVariableKeys: requirements.requiredVariableKeys,
			unsupportedPlatformRoles: effectiveMappings.signatories
				.filter(
					(mapping) =>
						!supportedPlatformRoles.includes(mapping.dealParticipantRole)
				)
				.map((mapping) => mapping.templatePlatformRole),
			unsupportedVariableKeys: effectiveMappings.variables
				.filter(
					(mapping) => !supportedVariableKeys.includes(mapping.dealVariableKey)
				)
				.map((mapping) => mapping.templateVariableKey),
		},
	};
}

export function buildMortgageTemplateClassCompatibility(
	snapshot: TemplateSnapshot
) {
	const containsSignableFields = snapshot.fields.some(
		(field) => field.type === "signable"
	);
	const requiredPlatformRoles = [
		...new Set(snapshot.signatories.map((signatory) => signatory.platformRole)),
	];

	return {
		private_templated_non_signable: containsSignableFields
			? {
					compatible: false,
					reason:
						"Signable templates cannot be attached as read-only documents.",
				}
			: { compatible: true },
		private_templated_signable: getSignableTemplateCompatibility({
			containsSignableFields,
			requiredPlatformRoles,
		}),
	};
}

function getSignableTemplateCompatibility(args: {
	containsSignableFields: boolean;
	requiredPlatformRoles: readonly string[];
}) {
	if (!args.containsSignableFields) {
		return {
			compatible: false,
			reason: "Signable templates must contain at least one signable field.",
		};
	}
	if (args.requiredPlatformRoles.length === 0) {
		return {
			compatible: false,
			reason: "Signable templates must contain at least one platform role.",
		};
	}
	return { compatible: true };
}

export function resolveReplacementMappingOverrides(args: {
	existingMappingOverrides?: MortgageDocumentMappingOverrides;
	mappingOverrides?: MortgageDocumentMappingOverrides;
}) {
	return args.mappingOverrides ?? args.existingMappingOverrides;
}

async function insertBlueprint(
	ctx: MutationCtx,
	args: {
		assetId?: Id<"documentAssets">;
		category?: string;
		class: BlueprintRow["class"];
		createdByUserId: Id<"users">;
		description?: string;
		displayName: string;
		displayOrder: number;
		mappingOverrides?: MortgageDocumentMappingOverrides;
		mortgageId: Id<"mortgages">;
		packageKey?: string;
		packageLabel?: string;
		templateId?: Id<"documentTemplates">;
		templateSnapshotMeta?: BlueprintRow["templateSnapshotMeta"];
		templateVersion?: number;
	}
) {
	return ctx.db.insert("mortgageDocumentBlueprints", {
		archivedAt: undefined,
		archivedByUserId: undefined,
		assetId: args.assetId,
		category: args.category,
		class: args.class,
		createdAt: Date.now(),
		createdByUserId: args.createdByUserId,
		description: args.description,
		displayName: args.displayName,
		displayOrder: args.displayOrder,
		mappingOverrides: args.mappingOverrides,
		mortgageId: args.mortgageId,
		packageKey: args.packageKey,
		packageLabel: args.packageLabel,
		sourceDraftId: undefined,
		sourceKind: args.assetId ? "asset" : "template_version",
		status: "active",
		templateId: args.templateId,
		templateSnapshotMeta: args.templateSnapshotMeta,
		templateVersion: args.templateVersion,
	});
}

export async function materializeMortgageBlueprintsFromCaseDrafts(
	ctx: MutationCtx,
	args: {
		caseId: Id<"adminOriginationCases">;
		mortgageId: Id<"mortgages">;
		now: number;
		viewerUserId: Id<"users">;
	}
) {
	const draftRows = await ctx.db
		.query("originationCaseDocumentDrafts")
		.withIndex("by_case_status_display_order", (query) =>
			query.eq("caseId", args.caseId).eq("status", "active")
		)
		.collect();

	const existingBlueprints = await listMortgageBlueprintRows(ctx, {
		includeArchived: true,
		mortgageId: args.mortgageId,
	});
	const existingBySourceDraftId = new Map(
		existingBlueprints
			.filter(
				(
					blueprint
				): blueprint is BlueprintRow & {
					sourceDraftId: Id<"originationCaseDocumentDrafts">;
				} => Boolean(blueprint.sourceDraftId)
			)
			.map((blueprint) => [String(blueprint.sourceDraftId), blueprint])
	);

	for (const draft of draftRows.sort(
		(left, right) => left.displayOrder - right.displayOrder
	)) {
		if (existingBySourceDraftId.has(String(draft._id))) {
			continue;
		}

		const template = draft.templateId
			? await ctx.db.get(draft.templateId)
			: null;
		const group = draft.selectedFromGroupId
			? await ctx.db.get(draft.selectedFromGroupId)
			: null;

		await ctx.db.insert("mortgageDocumentBlueprints", {
			archivedAt: undefined,
			archivedByUserId: undefined,
			assetId: draft.assetId,
			category: draft.category,
			class: draft.class,
			createdAt: args.now,
			createdByUserId: args.viewerUserId,
			description: draft.description,
			displayName: draft.displayName,
			displayOrder: draft.displayOrder,
			mortgageId: args.mortgageId,
			packageKey: draft.packageKey,
			packageLabel: draft.packageLabel,
			sourceDraftId: draft._id,
			sourceKind: draft.sourceKind,
			status: "active",
			templateId: draft.templateId,
			templateSnapshotMeta:
				draft.sourceKind === "template_version" && template
					? {
							containsSignableFields:
								draft.validationSummary?.containsSignableFields ?? false,
							requiredPlatformRoles:
								draft.validationSummary?.requiredPlatformRoles ?? [],
							requiredVariableKeys:
								draft.validationSummary?.requiredVariableKeys ?? [],
							sourceGroupId: group?._id,
							sourceGroupName: group?.name,
							templateName: template.name,
						}
					: undefined,
			templateVersion: draft.templateVersion,
		});
	}

	const finalBlueprints = await listMortgageBlueprintRows(ctx, {
		includeArchived: false,
		mortgageId: args.mortgageId,
	});

	return {
		dealBlueprintCount: finalBlueprints.filter(
			(blueprint) => blueprint.class !== "public_static"
		).length,
		publicBlueprintCount: finalBlueprints.filter(
			(blueprint) => blueprint.class === "public_static"
		).length,
	};
}

const blueprintQuery = adminQuery.use(requirePermission("mortgage:originate"));
const blueprintMutation = adminMutation.use(
	requirePermission("mortgage:originate")
);

export const listForMortgage = blueprintQuery
	.input({
		includeArchived: v.optional(v.boolean()),
		mortgageId: v.id("mortgages"),
	})
	.handler(async (ctx, args) => {
		const mortgage = await ctx.db.get(args.mortgageId);
		if (!mortgage) {
			return [];
		}
		assertOrgScopedRecordAccess({
			entityName: "Mortgage",
			notFoundMessage: "Mortgage not found or access denied",
			record: mortgage,
			viewer: ctx.viewer,
		});

		const rows = await listMortgageBlueprintRows(ctx, args);
		return Promise.all(
			rows.map((blueprint) => buildBlueprintListItem(ctx, blueprint))
		);
	})
	.public();

export const listAttachableTemplates = blueprintQuery
	.input({})
	.handler(async (ctx) => {
		const templates = await ctx.db
			.query("documentTemplates")
			.order("desc")
			.collect();
		const attachableTemplates = await Promise.all(
			templates.map(async (template) => {
				if (typeof template.currentPublishedVersion !== "number") {
					return null;
				}
				const currentPublishedVersion = template.currentPublishedVersion;

				const templateVersion = await ctx.db
					.query("documentTemplateVersions")
					.withIndex("by_template", (query) =>
						query
							.eq("templateId", template._id)
							.eq("version", currentPublishedVersion)
					)
					.first();
				if (!templateVersion) {
					return null;
				}

				return {
					compatibility: buildMortgageTemplateClassCompatibility(
						templateVersion.snapshot
					),
					currentPublishedVersion,
					description: template.description ?? null,
					name: template.name,
					templateId: template._id,
				};
			})
		);

		return attachableTemplates.filter((template) => template !== null);
	})
	.public();

export const previewTemplateMappings = blueprintQuery
	.input({
		class: mortgageDocumentBlueprintClassValidator,
		mappingOverrides: v.optional(mortgageDocumentMappingOverridesValidator),
		templateId: v.id("documentTemplates"),
		templateVersion: v.optional(v.number()),
	})
	.handler(async (ctx, args) => {
		const templateSnapshot = await loadPinnedTemplateSnapshot(ctx, {
			templateId: args.templateId,
			templateVersion: args.templateVersion,
		});
		const previewSummary = buildPreviewMortgageDocumentMappingSummary({
			documentClass: args.class,
			mappingOverrides: args.mappingOverrides,
			snapshot: templateSnapshot.snapshot,
		});
		return {
			effectiveMappings: previewSummary.effectiveMappings,
			templateName: templateSnapshot.template.name,
			templateVersion: templateSnapshot.templateVersion,
			validationSummary: previewSummary.validationSummary,
		};
	})
	.public();

export const archiveBlueprint = blueprintMutation
	.input({
		blueprintId: v.id("mortgageDocumentBlueprints"),
	})
	.handler(async (ctx, args) => {
		const blueprint = await ctx.db.get(args.blueprintId);
		if (!blueprint) {
			throw new ConvexError("Blueprint not found");
		}

		const mortgage = await ctx.db.get(blueprint.mortgageId);
		if (!mortgage) {
			throw new ConvexError("Mortgage not found");
		}
		assertOrgScopedRecordAccess({
			entityName: "Mortgage",
			notFoundMessage: "Mortgage not found or access denied",
			record: mortgage,
			viewer: ctx.viewer,
		});

		const viewerUser = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", ctx.viewer.authId))
			.unique();
		if (!viewerUser) {
			throw new ConvexError("User not found in database");
		}

		const now = Date.now();
		await ctx.db.patch(args.blueprintId, {
			archivedAt: now,
			archivedByUserId: viewerUser._id,
			status: "archived",
		});
		if (blueprint.class === "public_static") {
			const listing = await ctx.db
				.query("listings")
				.withIndex("by_mortgage", (query) =>
					query.eq("mortgageId", blueprint.mortgageId)
				)
				.unique();
			if (listing?.dataSource === "mortgage_pipeline") {
				await syncListingPublicDocumentsProjection(ctx, {
					listingId: listing._id,
					mortgageId: blueprint.mortgageId,
					now,
				});
			}
		}

		return { archived: true, blueprintId: blueprint._id };
	})
	.public();

export const createStaticBlueprint = blueprintMutation
	.input({
		assetId: v.id("documentAssets"),
		category: v.optional(v.string()),
		class: mortgageDocumentBlueprintClassValidator,
		description: v.optional(v.string()),
		displayName: v.string(),
		mortgageId: v.id("mortgages"),
		packageKey: v.optional(v.string()),
		packageLabel: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		if (!(args.class === "public_static" || args.class === "private_static")) {
			throw new ConvexError("Only static blueprint classes accept assets.");
		}

		await requireAccessibleMortgage(ctx, args.mortgageId);
		const [viewerUserId, asset, activeBlueprints] = await Promise.all([
			requireViewerUserId(ctx),
			ctx.db.get(args.assetId),
			listActiveBlueprintsForMortgage(ctx, args.mortgageId),
		]);
		if (!asset) {
			throw new ConvexError("Document asset not found");
		}

		const matchKey = buildBlueprintMatchKey({
			assetId: asset._id,
			class: args.class,
			displayName: args.displayName,
			packageKey: args.packageKey,
			packageLabel: args.packageLabel,
		});
		const existing = activeBlueprints.find(
			(blueprint) =>
				buildBlueprintMatchKey({
					assetId: blueprint.assetId,
					class: blueprint.class,
					displayName: blueprint.displayName,
					mappingOverrides: blueprint.mappingOverrides,
					packageKey: blueprint.packageKey,
					packageLabel: blueprint.packageLabel,
					templateId: blueprint.templateId,
					templateVersion: blueprint.templateVersion,
				}) === matchKey
		);
		if (existing) {
			return buildBlueprintListItem(ctx, existing);
		}

		const displayOrder =
			activeBlueprints.reduce(
				(maxDisplayOrder, blueprint) =>
					Math.max(maxDisplayOrder, blueprint.displayOrder),
				-1
			) + 1;
		const blueprintId = await insertBlueprint(ctx, {
			assetId: asset._id,
			category: args.category,
			class: args.class,
			createdByUserId: viewerUserId,
			description: args.description,
			displayName: args.displayName,
			displayOrder,
			mortgageId: args.mortgageId,
			packageKey: args.packageKey,
			packageLabel: args.packageLabel,
		});
		if (args.class === "public_static") {
			await syncListingProjectionForPublicBlueprints(ctx, {
				mortgageId: args.mortgageId,
				now: Date.now(),
			});
		}

		const created = await ctx.db.get(blueprintId);
		if (!created) {
			throw new ConvexError("Blueprint disappeared after creation");
		}

		return buildBlueprintListItem(ctx, created);
	})
	.public();

export const attachTemplateVersion = blueprintMutation
	.input({
		category: v.optional(v.string()),
		class: mortgageDocumentBlueprintClassValidator,
		description: v.optional(v.string()),
		displayName: v.optional(v.string()),
		mappingOverrides: v.optional(mortgageDocumentMappingOverridesValidator),
		mortgageId: v.id("mortgages"),
		packageKey: v.optional(v.string()),
		packageLabel: v.optional(v.string()),
		templateId: v.id("documentTemplates"),
		templateVersion: v.optional(v.number()),
	})
	.handler(async (ctx, args) => {
		if (
			!(
				args.class === "private_templated_non_signable" ||
				args.class === "private_templated_signable"
			)
		) {
			throw new ConvexError(
				"Only templated blueprint classes accept template versions."
			);
		}

		await requireAccessibleMortgage(ctx, args.mortgageId);
		const [viewerUserId, activeBlueprints, templateSnapshot] =
			await Promise.all([
				requireViewerUserId(ctx),
				listActiveBlueprintsForMortgage(ctx, args.mortgageId),
				loadPinnedTemplateSnapshot(ctx, {
					templateId: args.templateId,
					templateVersion: args.templateVersion,
				}),
			]);
		const validationSummary =
			buildOverrideAwareMortgageDocumentValidationSummary({
				documentClass: args.class,
				mappingOverrides: args.mappingOverrides,
				snapshot: templateSnapshot.snapshot,
			});
		const displayName =
			args.displayName?.trim() || templateSnapshot.template.name;
		const matchKey = buildBlueprintMatchKey({
			class: args.class,
			displayName,
			mappingOverrides: args.mappingOverrides,
			packageKey: args.packageKey,
			packageLabel: args.packageLabel,
			templateId: templateSnapshot.template._id,
			templateVersion: templateSnapshot.templateVersion,
		});
		const existing = activeBlueprints.find(
			(blueprint) =>
				buildBlueprintMatchKey({
					assetId: blueprint.assetId,
					class: blueprint.class,
					displayName: blueprint.displayName,
					mappingOverrides: blueprint.mappingOverrides,
					packageKey: blueprint.packageKey,
					packageLabel: blueprint.packageLabel,
					templateId: blueprint.templateId,
					templateVersion: blueprint.templateVersion,
				}) === matchKey
		);
		if (existing) {
			return buildBlueprintListItem(ctx, existing);
		}

		const displayOrder =
			activeBlueprints.reduce(
				(maxDisplayOrder, blueprint) =>
					Math.max(maxDisplayOrder, blueprint.displayOrder),
				-1
			) + 1;
		const blueprintId = await insertBlueprint(ctx, {
			category: args.category,
			class: args.class,
			createdByUserId: viewerUserId,
			description: args.description,
			displayName,
			displayOrder,
			mappingOverrides: args.mappingOverrides,
			mortgageId: args.mortgageId,
			packageKey: args.packageKey,
			packageLabel: args.packageLabel,
			templateId: templateSnapshot.template._id,
			templateSnapshotMeta: {
				containsSignableFields: validationSummary.containsSignableFields,
				requiredPlatformRoles: validationSummary.requiredPlatformRoles,
				requiredVariableKeys: validationSummary.requiredVariableKeys,
				templateName: templateSnapshot.template.name,
			},
			templateVersion: templateSnapshot.templateVersion,
		});
		const created = await ctx.db.get(blueprintId);
		if (!created) {
			throw new ConvexError("Blueprint disappeared after creation");
		}

		return buildBlueprintListItem(ctx, created);
	})
	.public();

export const replaceStaticBlueprint = blueprintMutation
	.input({
		assetId: v.id("documentAssets"),
		blueprintId: v.id("mortgageDocumentBlueprints"),
		category: v.optional(v.string()),
		description: v.optional(v.string()),
		displayName: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		const blueprint = await ctx.db.get(args.blueprintId);
		if (!blueprint) {
			throw new ConvexError("Blueprint not found");
		}
		if (blueprint.sourceKind !== "asset") {
			throw new ConvexError(
				"Only static blueprints can be replaced with assets."
			);
		}

		await requireAccessibleMortgage(ctx, blueprint.mortgageId);
		const [viewerUserId, asset, activeBlueprints] = await Promise.all([
			requireViewerUserId(ctx),
			ctx.db.get(args.assetId),
			listActiveBlueprintsForMortgage(ctx, blueprint.mortgageId),
		]);
		if (!asset) {
			throw new ConvexError("Document asset not found");
		}

		const replacementDisplayName =
			args.displayName?.trim() || blueprint.displayName;
		const matchKey = buildBlueprintMatchKey({
			assetId: asset._id,
			class: blueprint.class,
			displayName: replacementDisplayName,
			packageKey: blueprint.packageKey,
			packageLabel: blueprint.packageLabel,
		});
		const existing = activeBlueprints.find(
			(active) =>
				active._id !== blueprint._id &&
				buildBlueprintMatchKey({
					assetId: active.assetId,
					class: active.class,
					displayName: active.displayName,
					mappingOverrides: active.mappingOverrides,
					packageKey: active.packageKey,
					packageLabel: active.packageLabel,
					templateId: active.templateId,
					templateVersion: active.templateVersion,
				}) === matchKey
		);
		const now = Date.now();
		await archiveBlueprintRecord(ctx, {
			blueprint,
			now,
			viewerUserId,
		});
		if (existing) {
			if (blueprint.class === "public_static") {
				await syncListingProjectionForPublicBlueprints(ctx, {
					mortgageId: blueprint.mortgageId,
					now,
				});
			}
			return buildBlueprintListItem(ctx, existing);
		}

		const createdId = await insertBlueprint(ctx, {
			assetId: asset._id,
			category: args.category ?? blueprint.category,
			class: blueprint.class,
			createdByUserId: viewerUserId,
			description: args.description ?? blueprint.description,
			displayName: replacementDisplayName,
			displayOrder: blueprint.displayOrder,
			mortgageId: blueprint.mortgageId,
			packageKey: blueprint.packageKey,
			packageLabel: blueprint.packageLabel,
		});
		if (blueprint.class === "public_static") {
			await syncListingProjectionForPublicBlueprints(ctx, {
				mortgageId: blueprint.mortgageId,
				now,
			});
		}

		const created = await ctx.db.get(createdId);
		if (!created) {
			throw new ConvexError("Replacement blueprint disappeared after creation");
		}

		return buildBlueprintListItem(ctx, created);
	})
	.public();

export const replaceTemplateBlueprint = blueprintMutation
	.input({
		blueprintId: v.id("mortgageDocumentBlueprints"),
		category: v.optional(v.string()),
		description: v.optional(v.string()),
		displayName: v.optional(v.string()),
		mappingOverrides: v.optional(mortgageDocumentMappingOverridesValidator),
		templateId: v.id("documentTemplates"),
		templateVersion: v.optional(v.number()),
	})
	.handler(async (ctx, args) => {
		const blueprint = await ctx.db.get(args.blueprintId);
		if (!blueprint) {
			throw new ConvexError("Blueprint not found");
		}
		if (blueprint.sourceKind !== "template_version") {
			throw new ConvexError(
				"Only templated blueprints can be replaced with template versions."
			);
		}

		await requireAccessibleMortgage(ctx, blueprint.mortgageId);
		const [viewerUserId, activeBlueprints, templateSnapshot] =
			await Promise.all([
				requireViewerUserId(ctx),
				listActiveBlueprintsForMortgage(ctx, blueprint.mortgageId),
				loadPinnedTemplateSnapshot(ctx, {
					templateId: args.templateId,
					templateVersion: args.templateVersion,
				}),
			]);
		const replacementMappingOverrides = resolveReplacementMappingOverrides({
			existingMappingOverrides: blueprint.mappingOverrides,
			mappingOverrides: args.mappingOverrides,
		});
		const validationSummary =
			buildOverrideAwareMortgageDocumentValidationSummary({
				documentClass: blueprint.class,
				mappingOverrides: replacementMappingOverrides,
				snapshot: templateSnapshot.snapshot,
			});
		const replacementDisplayName =
			args.displayName?.trim() || templateSnapshot.template.name;
		const matchKey = buildBlueprintMatchKey({
			class: blueprint.class,
			displayName: replacementDisplayName,
			mappingOverrides: replacementMappingOverrides,
			packageKey: blueprint.packageKey,
			packageLabel: blueprint.packageLabel,
			templateId: templateSnapshot.template._id,
			templateVersion: templateSnapshot.templateVersion,
		});
		const existing = activeBlueprints.find(
			(active) =>
				active._id !== blueprint._id &&
				buildBlueprintMatchKey({
					assetId: active.assetId,
					class: active.class,
					displayName: active.displayName,
					mappingOverrides: active.mappingOverrides,
					packageKey: active.packageKey,
					packageLabel: active.packageLabel,
					templateId: active.templateId,
					templateVersion: active.templateVersion,
				}) === matchKey
		);
		const now = Date.now();
		await archiveBlueprintRecord(ctx, {
			blueprint,
			now,
			viewerUserId,
		});
		if (existing) {
			return buildBlueprintListItem(ctx, existing);
		}

		const createdId = await insertBlueprint(ctx, {
			category: args.category ?? blueprint.category,
			class: blueprint.class,
			createdByUserId: viewerUserId,
			description: args.description ?? blueprint.description,
			displayName: replacementDisplayName,
			displayOrder: blueprint.displayOrder,
			mappingOverrides: replacementMappingOverrides,
			mortgageId: blueprint.mortgageId,
			packageKey: blueprint.packageKey,
			packageLabel: blueprint.packageLabel,
			templateId: templateSnapshot.template._id,
			templateSnapshotMeta: {
				containsSignableFields: validationSummary.containsSignableFields,
				requiredPlatformRoles: validationSummary.requiredPlatformRoles,
				requiredVariableKeys: validationSummary.requiredVariableKeys,
				templateName: templateSnapshot.template.name,
			},
			templateVersion: templateSnapshot.templateVersion,
		});
		const created = await ctx.db.get(createdId);
		if (!created) {
			throw new ConvexError("Replacement blueprint disappeared after creation");
		}

		return buildBlueprintListItem(ctx, created);
	})
	.public();
