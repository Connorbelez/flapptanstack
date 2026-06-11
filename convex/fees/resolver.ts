import type {
	GenericDatabaseReader,
	GenericDatabaseWriter,
} from "convex/server";
import { ConvexError } from "convex/values";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import { assertBehaviorMatchesDefinition, type FeeBehavior } from "./behavior";
import {
	type CompatibleFeeTemplate,
	normalizeFeeTemplate,
	repairFeeTemplateIfNeeded,
} from "./templateCompatibility";

export const DEFAULT_FEE_SET_NAME = "Standard Mortgage Fees";
export const MIN_EFFECTIVE_FROM = "0000-01-01";
export const FEE_POLICY_VERSION = 1;
export const DEFAULT_DIRECT_WATERFALL_PRIORITY = 10_000;

export type FeeCode = Doc<"feeTemplates">["code"];
export type FeeSurface = Doc<"feeTemplates">["surface"];
type MortgageFeeBehavior = NonNullable<Doc<"mortgageFees">["behavior"]>;
type MortgageFeeDefaultApplication = NonNullable<
	Doc<"mortgageFees">["defaultApplication"]
>;

export type NormalizedFeeTemplate = CompatibleFeeTemplate;

export type NormalizedMortgageFee = Doc<"mortgageFees"> & {
	behavior: MortgageFeeBehavior;
	defaultApplication: MortgageFeeDefaultApplication;
	displayCode: string;
};

export type BulkApplyConflictReason =
	| "existing_active_fee"
	| "mortgage_opted_out"
	| "mortgage_not_found";

export interface BulkApplyPreview {
	applicable: Array<{ mortgageId: Id<"mortgages">; feeCount: number }>;
	conflicts: Array<{
		mortgageId: Id<"mortgages">;
		reason: BulkApplyConflictReason;
	}>;
	effectiveFrom: string;
	feeSetTemplateId: Id<"feeSetTemplates">;
	previewToken: string;
}

export interface BulkApplyFeeSetItem {
	item: Doc<"feeSetTemplateItems">;
	template: CompatibleFeeTemplate;
}

export interface FeeParameters {
	annualRate?: number;
	dueDays?: number;
	fixedAmountCents?: number;
	graceDays?: number;
}

export interface FeeDefinitionInput {
	behavior: FeeBehavior;
	calculationType: Doc<"feeTemplates">["calculationType"];
	code: FeeCode;
	displayCode: string;
	parameters: FeeParameters;
	paymentRail?: Doc<"feeTemplates">["paymentRail"];
	recurrence?: Doc<"feeTemplates">["recurrence"];
	revenueDestination: Doc<"feeTemplates">["revenueDestination"];
	surface: FeeSurface;
}

export interface ResolvedServicingFeeConfig {
	annualRate: number;
	behavior: "payment_waterfall_deduction";
	code: "servicing";
	displayCode: string;
	mortgageFeeId?: Id<"mortgageFees">;
	policyVersion: number;
	revenueDestination: Doc<"mortgageFees">["revenueDestination"];
}

export interface ResolvedWaterfallFeeConfig {
	annualRate: number;
	behavior: "payment_waterfall_deduction";
	code: FeeCode;
	displayCode: string;
	mortgageFeeId: Id<"mortgageFees">;
	policyVersion: number;
	revenueDestination: Doc<"mortgageFees">["revenueDestination"];
	waterfallPriority: number;
}

export interface ResolvedBorrowerChargeFeeConfig {
	code: Exclude<FeeCode, "servicing">;
	dueDays: number;
	fixedAmountCents: number;
	graceDays: number;
	mortgageFeeId: Id<"mortgageFees">;
	policyVersion: number;
	revenueDestination: Doc<"mortgageFees">["revenueDestination"];
}

export function normalizeEffectiveFrom(value?: string) {
	return value ?? MIN_EFFECTIVE_FROM;
}

function dateInRange(date: string, from: string, to?: string) {
	if (date < from) {
		return false;
	}
	if (to !== undefined && date > to) {
		return false;
	}
	return true;
}

function rangesOverlap(
	left: { effectiveFrom: string; effectiveTo?: string },
	right: { effectiveFrom: string; effectiveTo?: string }
) {
	const leftEnd = left.effectiveTo ?? "9999-12-31";
	const rightEnd = right.effectiveTo ?? "9999-12-31";
	return left.effectiveFrom <= rightEnd && right.effectiveFrom <= leftEnd;
}

function buildBulkApplyPreviewToken(args: {
	feeSetTemplateId: Id<"feeSetTemplates">;
	effectiveFrom: string;
	targetMortgageIds: Id<"mortgages">[];
	applicableMortgageIds: Id<"mortgages">[];
	conflicts: BulkApplyPreview["conflicts"];
	items: BulkApplyFeeSetItem[];
}) {
	return JSON.stringify({
		feeSetTemplateId: args.feeSetTemplateId,
		effectiveFrom: args.effectiveFrom,
		targetMortgageIds: [...args.targetMortgageIds].sort(),
		applicableMortgageIds: [...args.applicableMortgageIds].sort(),
		conflicts: [...args.conflicts].sort((left, right) => {
			const mortgageComparison = left.mortgageId.localeCompare(
				right.mortgageId
			);
			if (mortgageComparison !== 0) {
				return mortgageComparison;
			}
			return left.reason.localeCompare(right.reason);
		}),
		feeSetItems: args.items
			.map(({ item, template }) => ({
				feeSetTemplateItemId: item._id,
				feeTemplateId: template._id,
				templateUpdatedAt: template.updatedAt,
				templateStatus: template.status,
				code: template.code,
				surface: template.surface,
				displayCode: template.displayCode,
			}))
			.sort((left, right) =>
				left.feeSetTemplateItemId.localeCompare(right.feeSetTemplateItemId)
			),
	});
}

function dedupeMortgageIds(ids: Id<"mortgages">[]) {
	const seen = new Set<Id<"mortgages">>();
	const deduped: Id<"mortgages">[] = [];
	for (const id of ids) {
		if (seen.has(id)) {
			continue;
		}
		seen.add(id);
		deduped.push(id);
	}
	return deduped;
}

function compareMortgageFees(
	left: Pick<Doc<"mortgageFees">, "effectiveFrom" | "createdAt" | "_id">,
	right: Pick<Doc<"mortgageFees">, "effectiveFrom" | "createdAt" | "_id">
) {
	if (left.effectiveFrom !== right.effectiveFrom) {
		return left.effectiveFrom.localeCompare(right.effectiveFrom);
	}
	if (left.createdAt !== right.createdAt) {
		return left.createdAt - right.createdAt;
	}
	return left._id.localeCompare(right._id);
}

function defaultMortgageFeeBehavior(
	fee: Pick<Doc<"mortgageFees">, "surface">
): MortgageFeeBehavior {
	return fee.surface === "waterfall_deduction"
		? "payment_waterfall_deduction"
		: "borrower_one_time_charge";
}

function defaultMortgageFeeApplication(
	fee: Pick<Doc<"mortgageFees">, "feeSetTemplateId" | "feeSetTemplateItemId">
): MortgageFeeDefaultApplication {
	return fee.feeSetTemplateId !== undefined ||
		fee.feeSetTemplateItemId !== undefined
		? "platform_default"
		: "mortgage_specific";
}

export function normalizeMortgageFeeForRead(
	fee: Doc<"mortgageFees">
): NormalizedMortgageFee {
	const behavior = fee.behavior ?? defaultMortgageFeeBehavior(fee);
	return {
		...fee,
		behavior,
		defaultApplication:
			fee.defaultApplication ?? defaultMortgageFeeApplication(fee),
		displayCode: fee.displayCode ?? fee.code,
		paymentRail:
			behavior === "payment_waterfall_deduction"
				? fee.paymentRail
				: (fee.paymentRail ?? "manual"),
		recurrence:
			behavior === "payment_waterfall_deduction"
				? fee.recurrence
				: (fee.recurrence ?? "one_time"),
	};
}

export function buildFeeTemplateBehaviorFieldBackfillPatch(
	template: Doc<"feeTemplates">,
	now = Date.now()
) {
	const normalized = normalizeFeeTemplate(template);
	const patch: Partial<
		Pick<
			Doc<"feeTemplates">,
			"behavior" | "displayCode" | "paymentRail" | "recurrence" | "updatedAt"
		>
	> = {};

	if (template.behavior === undefined) {
		patch.behavior = normalized.behavior;
	}
	if (template.displayCode === undefined) {
		patch.displayCode = normalized.displayCode;
	}
	if (
		template.paymentRail === undefined &&
		normalized.paymentRail !== undefined
	) {
		patch.paymentRail = normalized.paymentRail;
	}
	if (
		template.recurrence === undefined &&
		normalized.recurrence !== undefined
	) {
		patch.recurrence = normalized.recurrence;
	}

	if (Object.keys(patch).length > 0) {
		patch.updatedAt = now;
	}
	return patch;
}

export async function buildMortgageFeeBehaviorFieldBackfillPatch(
	db: GenericDatabaseReader<DataModel>,
	fee: Doc<"mortgageFees">
) {
	const behavior = fee.behavior ?? defaultMortgageFeeBehavior(fee);
	const patch: Partial<
		Pick<
			Doc<"mortgageFees">,
			| "behavior"
			| "defaultApplication"
			| "displayCode"
			| "paymentRail"
			| "recurrence"
			| "waterfallPriority"
		>
	> = {};

	if (fee.behavior === undefined) {
		patch.behavior = behavior;
	}
	if (fee.displayCode === undefined) {
		patch.displayCode = fee.code;
	}
	if (fee.defaultApplication === undefined) {
		patch.defaultApplication = defaultMortgageFeeApplication(fee);
	}
	if (behavior !== "payment_waterfall_deduction") {
		if (fee.paymentRail === undefined) {
			patch.paymentRail = "manual";
		}
		if (fee.recurrence === undefined) {
			patch.recurrence = "one_time";
		}
	}
	if (
		behavior === "payment_waterfall_deduction" &&
		fee.waterfallPriority === undefined
	) {
		const feeSetItem =
			fee.feeSetTemplateItemId !== undefined
				? await db.get(fee.feeSetTemplateItemId)
				: null;
		patch.waterfallPriority =
			feeSetItem?.sortOrder ?? DEFAULT_DIRECT_WATERFALL_PRIORITY;
	}

	return patch;
}

export function needsFeeTemplateBehaviorFieldBackfill(
	template: Doc<"feeTemplates">
) {
	return (
		Object.keys(buildFeeTemplateBehaviorFieldBackfillPatch(template)).length > 0
	);
}

export async function needsMortgageFeeBehaviorFieldBackfill(
	db: GenericDatabaseReader<DataModel>,
	fee: Doc<"mortgageFees">
) {
	return (
		Object.keys(await buildMortgageFeeBehaviorFieldBackfillPatch(db, fee))
			.length > 0
	);
}

export async function repairFeeTemplateForUse(
	db: GenericDatabaseWriter<DataModel>,
	template: Doc<"feeTemplates">
): Promise<CompatibleFeeTemplate> {
	return repairFeeTemplateIfNeeded(db, template);
}

export function assertValidFeeDefinition(input: FeeDefinitionInput) {
	assertBehaviorMatchesDefinition({
		behavior: input.behavior,
		calculationType: input.calculationType,
		parameters: input.parameters,
		paymentRail: input.paymentRail,
		recurrence: input.recurrence,
		surface: input.surface,
	});

	if (input.revenueDestination !== "platform_revenue") {
		throw new ConvexError(
			`Unsupported revenueDestination "${input.revenueDestination}"; only platform_revenue is supported`
		);
	}

	if (input.calculationType === "annual_rate_principal") {
		const annualRate = input.parameters.annualRate;
		if (
			typeof annualRate !== "number" ||
			!Number.isFinite(annualRate) ||
			annualRate < 0
		) {
			throw new ConvexError(
				"annual_rate_principal fees require a non-negative annualRate"
			);
		}
		return;
	}

	const fixedAmountCents = input.parameters.fixedAmountCents;
	if (
		fixedAmountCents === undefined ||
		!Number.isSafeInteger(fixedAmountCents) ||
		fixedAmountCents < 0
	) {
		throw new ConvexError(
			"fixed_amount_cents fees require a non-negative integer fixedAmountCents"
		);
	}
}

export async function listActiveMortgageFeesForSurface(
	db: GenericDatabaseReader<DataModel>,
	mortgageId: Id<"mortgages">,
	surface: FeeSurface,
	asOfDate: string
): Promise<NormalizedMortgageFee[]> {
	const rows = await db
		.query("mortgageFees")
		.withIndex("by_mortgage_surface_status", (q) =>
			q
				.eq("mortgageId", mortgageId)
				.eq("surface", surface)
				.eq("status", "active")
		)
		.collect();

	return rows
		.filter((row) => dateInRange(asOfDate, row.effectiveFrom, row.effectiveTo))
		.sort(compareMortgageFees)
		.map(normalizeMortgageFeeForRead);
}

async function materializeLegacyServicingMortgageFee(
	db: GenericDatabaseWriter<DataModel>,
	mortgage: Pick<Doc<"mortgages">, "_id" | "annualServicingRate">,
	asOfDate: string
): Promise<NormalizedMortgageFee | null> {
	const defaults = await ensureDefaultFeeTemplatesAndSet(db);
	if (await hasMortgageFeeSetOptOut(db, mortgage._id, defaults.feeSetId)) {
		return null;
	}
	const servicingTemplate = await db.get(defaults.servicingTemplateId);
	if (!servicingTemplate) {
		throw new ConvexError(
			`Default servicing fee template not found: ${defaults.servicingTemplateId}`
		);
	}
	const normalizedServicingTemplate = await repairFeeTemplateForUse(
		db,
		servicingTemplate
	);

	const existingRows = await listActiveMortgageFeesForSurface(
		db,
		mortgage._id,
		"waterfall_deduction",
		asOfDate
	);
	const existingServicingRows = existingRows.filter(
		(row) => row.code === "servicing"
	);
	if (existingServicingRows.length > 0) {
		return existingServicingRows[0];
	}

	const defaultFeeSetItems = await db
		.query("feeSetTemplateItems")
		.withIndex("by_fee_set_template", (q) =>
			q.eq("feeSetTemplateId", defaults.feeSetId)
		)
		.collect();
	const servicingSetItem = defaultFeeSetItems.find(
		(item) => item.feeTemplateId === normalizedServicingTemplate._id
	);
	const mortgageFeeId = await attachFeeTemplateToMortgageSnapshot(db, {
		mortgageId: mortgage._id,
		feeTemplate: normalizedServicingTemplate,
		defaultApplication: "platform_default",
		feeSetTemplateId: defaults.feeSetId,
		feeSetTemplateItemId: servicingSetItem?._id,
		parameterOverrides: {
			annualRate: mortgage.annualServicingRate ?? 0.01,
		},
		waterfallPriority:
			servicingSetItem?.sortOrder ?? DEFAULT_DIRECT_WATERFALL_PRIORITY,
	});
	const mortgageFee = await db.get(mortgageFeeId);
	if (!mortgageFee) {
		throw new ConvexError(
			`Failed to load materialized servicing mortgage fee ${mortgageFeeId}`
		);
	}
	return normalizeMortgageFeeForRead(mortgageFee);
}

function resolveAnnualRatePrincipalWaterfallFee(
	row: NormalizedMortgageFee,
	waterfallPriority: number
): ResolvedWaterfallFeeConfig {
	if (row.behavior !== "payment_waterfall_deduction") {
		throw new ConvexError(
			`Waterfall fee config ${row._id} must use payment_waterfall_deduction behavior`
		);
	}
	if (row.calculationType !== "annual_rate_principal") {
		throw new ConvexError(
			`Waterfall fee config ${row._id} must use annual_rate_principal`
		);
	}
	const annualRate = row.parameters.annualRate;
	if (annualRate === undefined) {
		throw new ConvexError(
			`Waterfall fee config ${row._id} is missing annualRate`
		);
	}
	return {
		annualRate,
		behavior: "payment_waterfall_deduction",
		code: row.code,
		displayCode: row.displayCode,
		mortgageFeeId: row._id,
		policyVersion: FEE_POLICY_VERSION,
		revenueDestination: row.revenueDestination,
		waterfallPriority,
	};
}

async function resolveMortgageFeeWaterfallPriority(
	db: GenericDatabaseReader<DataModel>,
	row: NormalizedMortgageFee
) {
	if (row.waterfallPriority !== undefined) {
		return row.waterfallPriority;
	}
	if (row.feeSetTemplateItemId !== undefined) {
		const item = await db.get(row.feeSetTemplateItemId);
		if (item) {
			return item.sortOrder;
		}
	}
	return DEFAULT_DIRECT_WATERFALL_PRIORITY;
}

export async function resolveServicingFeeConfig(
	db: GenericDatabaseWriter<DataModel>,
	mortgage: Pick<Doc<"mortgages">, "_id" | "annualServicingRate">,
	asOfDate: string
): Promise<ResolvedServicingFeeConfig | null> {
	const activeRows = await listActiveMortgageFeesForSurface(
		db,
		mortgage._id,
		"waterfall_deduction",
		asOfDate
	);
	const servicingRows = activeRows.filter((row) => row.code === "servicing");

	if (servicingRows.length > 1) {
		throw new ConvexError(
			`Multiple active servicing fee configs found for mortgage ${mortgage._id} on ${asOfDate}`
		);
	}

	if (servicingRows.length === 1) {
		const row = servicingRows[0];
		if (row.calculationType !== "annual_rate_principal") {
			throw new ConvexError(
				`Servicing fee config ${row._id} must use annual_rate_principal`
			);
		}
		const annualRate = row.parameters.annualRate;
		if (annualRate === undefined) {
			throw new ConvexError(
				`Servicing fee config ${row._id} is missing annualRate`
			);
		}
		return {
			annualRate,
			behavior: "payment_waterfall_deduction",
			code: "servicing",
			displayCode: row.displayCode,
			mortgageFeeId: row._id,
			policyVersion: FEE_POLICY_VERSION,
			revenueDestination: row.revenueDestination,
		};
	}

	const legacyRow = await materializeLegacyServicingMortgageFee(
		db,
		mortgage,
		asOfDate
	);
	if (!legacyRow) {
		return null;
	}
	if (legacyRow.calculationType !== "annual_rate_principal") {
		throw new ConvexError(
			`Servicing fee config ${legacyRow._id} must use annual_rate_principal`
		);
	}
	const legacyAnnualRate = legacyRow.parameters.annualRate;
	if (legacyAnnualRate === undefined) {
		throw new ConvexError(
			`Servicing fee config ${legacyRow._id} is missing annualRate`
		);
	}
	return {
		annualRate: legacyAnnualRate,
		behavior: "payment_waterfall_deduction",
		code: "servicing",
		displayCode: legacyRow.displayCode,
		mortgageFeeId: legacyRow._id,
		policyVersion: FEE_POLICY_VERSION,
		revenueDestination: legacyRow.revenueDestination,
	};
}

export async function resolveWaterfallFeeConfigs(
	db: GenericDatabaseWriter<DataModel>,
	mortgage: Pick<Doc<"mortgages">, "_id" | "annualServicingRate">,
	asOfDate: string
): Promise<ResolvedWaterfallFeeConfig[]> {
	await resolveServicingFeeConfig(db, mortgage, asOfDate);

	const activeRows = await listActiveMortgageFeesForSurface(
		db,
		mortgage._id,
		"waterfall_deduction",
		asOfDate
	);
	const resolved = await Promise.all(
		activeRows.map(async (row, index) => ({
			config: resolveAnnualRatePrincipalWaterfallFee(
				row,
				await resolveMortgageFeeWaterfallPriority(db, row)
			),
			rowIndex: index,
		}))
	);
	return resolved
		.sort((left, right) => {
			if (left.config.waterfallPriority !== right.config.waterfallPriority) {
				return left.config.waterfallPriority - right.config.waterfallPriority;
			}
			return left.rowIndex - right.rowIndex;
		})
		.map(({ config }) => config);
}

export async function resolveBorrowerChargeFeeConfig(
	db: GenericDatabaseReader<DataModel>,
	mortgageId: Id<"mortgages">,
	code: Exclude<FeeCode, "servicing">,
	asOfDate: string
): Promise<ResolvedBorrowerChargeFeeConfig | null> {
	const activeRows = await listActiveMortgageFeesForSurface(
		db,
		mortgageId,
		"borrower_charge",
		asOfDate
	);
	const matchingRows = activeRows.filter((row) => row.code === code);

	if (matchingRows.length > 1) {
		throw new ConvexError(
			`Multiple active ${code} fee configs found for mortgage ${mortgageId} on ${asOfDate}`
		);
	}

	if (matchingRows.length === 0) {
		return null;
	}

	const row = matchingRows[0];
	if (row.calculationType !== "fixed_amount_cents") {
		throw new ConvexError(
			`${code} fee config ${row._id} must use fixed_amount_cents`
		);
	}
	if (row.parameters.fixedAmountCents === undefined) {
		throw new ConvexError(
			`${code} fee config ${row._id} is missing fixedAmountCents`
		);
	}

	return {
		code,
		dueDays: row.parameters.dueDays ?? 30,
		fixedAmountCents: row.parameters.fixedAmountCents,
		graceDays: row.parameters.graceDays ?? 45,
		mortgageFeeId: row._id,
		policyVersion: FEE_POLICY_VERSION,
		revenueDestination: row.revenueDestination,
	};
}

export async function assertNoOverlappingMortgageFee(
	db: GenericDatabaseReader<DataModel>,
	args: {
		mortgageId: Id<"mortgages">;
		code: FeeCode;
		surface: FeeSurface;
		effectiveFrom: string;
		effectiveTo?: string;
	},
	excludeId?: Id<"mortgageFees">
) {
	const existingRows = await db
		.query("mortgageFees")
		.withIndex("by_mortgage_code_surface_status", (q) =>
			q
				.eq("mortgageId", args.mortgageId)
				.eq("code", args.code)
				.eq("surface", args.surface)
				.eq("status", "active")
		)
		.collect();

	for (const row of existingRows) {
		if (excludeId !== undefined && row._id === excludeId) {
			continue;
		}
		if (
			rangesOverlap(
				{ effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo },
				{ effectiveFrom: args.effectiveFrom, effectiveTo: args.effectiveTo }
			)
		) {
			throw new ConvexError(
				`Overlapping active mortgage fee exists for mortgage ${args.mortgageId}, code ${args.code}, surface ${args.surface}`
			);
		}
	}
}

export async function loadFeeSetTemplateItemsForApplication(
	db: GenericDatabaseReader<DataModel>,
	feeSetTemplateId: Id<"feeSetTemplates">
): Promise<BulkApplyFeeSetItem[]> {
	const feeSet = await db.get(feeSetTemplateId);
	if (!feeSet) {
		throw new ConvexError(`Fee set template not found: ${feeSetTemplateId}`);
	}
	if (feeSet.status !== "active") {
		throw new ConvexError(`Fee set template is inactive: ${feeSetTemplateId}`);
	}

	const items = await db
		.query("feeSetTemplateItems")
		.withIndex("by_fee_set_template", (q) =>
			q.eq("feeSetTemplateId", feeSetTemplateId)
		)
		.collect();
	const sortedItems = items.sort((left, right) => {
		if (left.sortOrder !== right.sortOrder) {
			return left.sortOrder - right.sortOrder;
		}
		return left._id.localeCompare(right._id);
	});

	const resolvedItems: BulkApplyFeeSetItem[] = [];
	const seenSurfaceCodes = new Set<string>();
	for (const item of sortedItems) {
		const template = await db.get(item.feeTemplateId);
		if (!template) {
			throw new ConvexError(
				`Fee template not found for fee set item ${item._id}: ${item.feeTemplateId}`
			);
		}
		if (template.status !== "active") {
			throw new ConvexError(`Fee template is inactive: ${template._id}`);
		}
		const normalizedTemplate = normalizeFeeTemplate(template);
		const surfaceCode = `${normalizedTemplate.surface}:${normalizedTemplate.code}`;
		if (seenSurfaceCodes.has(surfaceCode)) {
			throw new ConvexError(
				`Fee set contains duplicate fee surface/code: ${normalizedTemplate.surface}/${normalizedTemplate.code}`
			);
		}
		seenSurfaceCodes.add(surfaceCode);
		resolvedItems.push({ item, template: normalizedTemplate });
	}
	return resolvedItems;
}

export async function hasMortgageFeeSetOptOut(
	db: GenericDatabaseReader<DataModel>,
	mortgageId: Id<"mortgages">,
	feeSetTemplateId: Id<"feeSetTemplates">
) {
	const optOut = await db
		.query("mortgageFeeSetOptOuts")
		.withIndex("by_mortgage_fee_set", (q) =>
			q.eq("mortgageId", mortgageId).eq("feeSetTemplateId", feeSetTemplateId)
		)
		.first();
	return optOut !== null;
}

export async function previewBulkApplyFeeSetToMortgages(
	db: GenericDatabaseReader<DataModel>,
	args: {
		feeSetTemplateId: Id<"feeSetTemplates">;
		mortgageIds?: Id<"mortgages">[];
		effectiveFrom: string;
	}
): Promise<BulkApplyPreview> {
	const resolvedItems = await loadFeeSetTemplateItemsForApplication(
		db,
		args.feeSetTemplateId
	);
	const targetMortgageIds =
		args.mortgageIds !== undefined
			? dedupeMortgageIds(args.mortgageIds)
			: (
					await db
						.query("mortgages")
						.withIndex("by_status", (q) => q.eq("status", "active"))
						.collect()
				)
					.map((mortgage) => mortgage._id)
					.sort();

	const applicable: BulkApplyPreview["applicable"] = [];
	const conflicts: BulkApplyPreview["conflicts"] = [];

	for (const mortgageId of targetMortgageIds) {
		const mortgage = await db.get(mortgageId);
		if (!mortgage || mortgage.status !== "active") {
			conflicts.push({ mortgageId, reason: "mortgage_not_found" });
			continue;
		}

		if (await hasMortgageFeeSetOptOut(db, mortgageId, args.feeSetTemplateId)) {
			conflicts.push({ mortgageId, reason: "mortgage_opted_out" });
			continue;
		}

		const existingRows = await db
			.query("mortgageFees")
			.withIndex("by_mortgage", (q) => q.eq("mortgageId", mortgageId))
			.collect();

		const hasOverlappingActiveFee = resolvedItems.some(({ template }) =>
			existingRows.some(
				(row) =>
					row.status === "active" &&
					row.code === template.code &&
					row.surface === template.surface &&
					rangesOverlap(
						{
							effectiveFrom: row.effectiveFrom,
							effectiveTo: row.effectiveTo,
						},
						{ effectiveFrom: args.effectiveFrom }
					)
			)
		);
		if (hasOverlappingActiveFee) {
			conflicts.push({ mortgageId, reason: "existing_active_fee" });
			continue;
		}

		applicable.push({ mortgageId, feeCount: resolvedItems.length });
	}

	return {
		previewToken: buildBulkApplyPreviewToken({
			feeSetTemplateId: args.feeSetTemplateId,
			effectiveFrom: args.effectiveFrom,
			targetMortgageIds,
			applicableMortgageIds: applicable.map((row) => row.mortgageId),
			conflicts,
			items: resolvedItems,
		}),
		feeSetTemplateId: args.feeSetTemplateId,
		effectiveFrom: args.effectiveFrom,
		applicable,
		conflicts,
	};
}

async function getFeeTemplateByCode(
	db: GenericDatabaseReader<DataModel>,
	code: FeeCode
) {
	const rows = await db
		.query("feeTemplates")
		.withIndex("by_code_and_surface", (q) => q.eq("code", code))
		.collect();
	return rows[0] ?? null;
}

async function clearOtherActivePlatformDefaults(
	db: GenericDatabaseWriter<DataModel>,
	keepId: Id<"feeSetTemplates">,
	now: number
) {
	const activeDefaults = await db
		.query("feeSetTemplates")
		.withIndex("by_platform_default_status", (q) =>
			q.eq("isPlatformDefault", true).eq("status", "active")
		)
		.collect();

	for (const row of activeDefaults) {
		if (row._id === keepId) {
			continue;
		}
		await db.patch(row._id, {
			isPlatformDefault: false,
			updatedAt: now,
		});
	}
}

async function getDefaultFeeSet(
	db: GenericDatabaseWriter<DataModel>,
	now: number
) {
	const activeDefaults = await db
		.query("feeSetTemplates")
		.withIndex("by_platform_default_status", (q) =>
			q.eq("isPlatformDefault", true).eq("status", "active")
		)
		.collect();
	const activeSets = await db
		.query("feeSetTemplates")
		.withIndex("by_status", (q) => q.eq("status", "active"))
		.collect();
	const namedStandardSet =
		activeSets.find((row) => row.name === DEFAULT_FEE_SET_NAME) ?? null;

	if (namedStandardSet) {
		if (!namedStandardSet.isPlatformDefault) {
			await db.patch(namedStandardSet._id, {
				isPlatformDefault: true,
				updatedAt: now,
			});
		}
		await clearOtherActivePlatformDefaults(db, namedStandardSet._id, now);
		return await db.get(namedStandardSet._id);
	}

	const selectedDefault = activeDefaults[0] ?? null;
	if (selectedDefault) {
		await clearOtherActivePlatformDefaults(db, selectedDefault._id, now);
	}
	return selectedDefault;
}

export async function ensureDefaultFeeTemplatesAndSet(
	db: GenericDatabaseWriter<DataModel>
) {
	const now = Date.now();

	let servicingTemplate = await getFeeTemplateByCode(db, "servicing");
	if (servicingTemplate) {
		servicingTemplate = await repairFeeTemplateIfNeeded(db, servicingTemplate);
	} else {
		const id = await db.insert("feeTemplates", {
			name: "Standard Servicing Fee",
			description:
				"Standard servicing fee deducted from regular interest settlements",
			code: "servicing",
			behavior: "payment_waterfall_deduction",
			displayCode: "servicing",
			surface: "waterfall_deduction",
			revenueDestination: "platform_revenue",
			calculationType: "annual_rate_principal",
			parameters: { annualRate: 0.01 },
			status: "active",
			createdAt: now,
			updatedAt: now,
		});
		const createdTemplate = await db.get(id);
		if (!createdTemplate) {
			throw new ConvexError(`Failed to load inserted fee template ${id}`);
		}
		servicingTemplate = await repairFeeTemplateIfNeeded(db, createdTemplate);
	}

	let lateFeeTemplate = await getFeeTemplateByCode(db, "late_fee");
	if (lateFeeTemplate) {
		lateFeeTemplate = await repairFeeTemplateIfNeeded(db, lateFeeTemplate);
	} else {
		const id = await db.insert("feeTemplates", {
			name: "Standard Late Fee",
			description: "Borrower late fee assessed after grace expiry",
			code: "late_fee",
			behavior: "borrower_one_time_charge",
			displayCode: "late_fee",
			surface: "borrower_charge",
			revenueDestination: "platform_revenue",
			calculationType: "fixed_amount_cents",
			parameters: { fixedAmountCents: 5000, dueDays: 30, graceDays: 45 },
			paymentRail: "manual",
			recurrence: "one_time",
			status: "active",
			createdAt: now,
			updatedAt: now,
		});
		const createdTemplate = await db.get(id);
		if (!createdTemplate) {
			throw new ConvexError(`Failed to load inserted fee template ${id}`);
		}
		lateFeeTemplate = await repairFeeTemplateIfNeeded(db, createdTemplate);
	}

	let nsfTemplate = await getFeeTemplateByCode(db, "nsf");
	if (nsfTemplate) {
		nsfTemplate = await repairFeeTemplateIfNeeded(db, nsfTemplate);
	} else {
		const id = await db.insert("feeTemplates", {
			name: "Standard NSF Fee",
			description:
				"Config-ready NSF fee definition; auto-generation is deferred in v1",
			code: "nsf",
			behavior: "borrower_one_time_charge",
			displayCode: "nsf",
			surface: "borrower_charge",
			revenueDestination: "platform_revenue",
			calculationType: "fixed_amount_cents",
			parameters: { fixedAmountCents: 5000, dueDays: 30, graceDays: 45 },
			paymentRail: "manual",
			recurrence: "one_time",
			status: "active",
			createdAt: now,
			updatedAt: now,
		});
		const createdTemplate = await db.get(id);
		if (!createdTemplate) {
			throw new ConvexError(`Failed to load inserted fee template ${id}`);
		}
		nsfTemplate = await repairFeeTemplateIfNeeded(db, createdTemplate);
	}

	let feeSet = await getDefaultFeeSet(db, now);
	if (!feeSet) {
		const id = await db.insert("feeSetTemplates", {
			name: DEFAULT_FEE_SET_NAME,
			description:
				"Default servicing and late-fee configuration for active mortgages",
			isPlatformDefault: true,
			status: "active",
			createdAt: now,
			updatedAt: now,
		});
		const createdFeeSet = await db.get(id);
		if (!createdFeeSet) {
			throw new ConvexError(`Failed to load inserted fee set ${id}`);
		}
		feeSet = createdFeeSet;
	}

	if (!(servicingTemplate && lateFeeTemplate && feeSet && nsfTemplate)) {
		throw new ConvexError("Failed to create default fee templates or set");
	}

	const guaranteedServicingTemplate = servicingTemplate;
	const guaranteedLateFeeTemplate = lateFeeTemplate;
	const guaranteedNsfTemplate = nsfTemplate;
	const guaranteedFeeSet = feeSet;

	const existingItems = await db
		.query("feeSetTemplateItems")
		.withIndex("by_fee_set_template", (q) =>
			q.eq("feeSetTemplateId", guaranteedFeeSet._id)
		)
		.collect();

	const existingTemplateIds = new Set(
		existingItems.map((item) => item.feeTemplateId)
	);
	if (!existingTemplateIds.has(guaranteedServicingTemplate._id)) {
		await db.insert("feeSetTemplateItems", {
			feeSetTemplateId: guaranteedFeeSet._id,
			feeTemplateId: guaranteedServicingTemplate._id,
			sortOrder: 10,
			createdAt: now,
		});
	}
	if (!existingTemplateIds.has(guaranteedLateFeeTemplate._id)) {
		await db.insert("feeSetTemplateItems", {
			feeSetTemplateId: guaranteedFeeSet._id,
			feeTemplateId: guaranteedLateFeeTemplate._id,
			sortOrder: 20,
			createdAt: now,
		});
	}

	return {
		feeSetId: guaranteedFeeSet._id,
		lateFeeTemplateId: guaranteedLateFeeTemplate._id,
		nsfTemplateId: guaranteedNsfTemplate._id,
		servicingTemplateId: guaranteedServicingTemplate._id,
	};
}

export async function attachFeeTemplateToMortgageSnapshot(
	db: GenericDatabaseWriter<DataModel>,
	args: {
		mortgageId: Id<"mortgages">;
		feeTemplate: CompatibleFeeTemplate;
		effectiveFrom?: string;
		effectiveTo?: string;
		feeSetTemplateId?: Id<"feeSetTemplates">;
		feeSetTemplateItemId?: Id<"feeSetTemplateItems">;
		defaultApplication?: Doc<"mortgageFees">["defaultApplication"];
		parameterOverrides?: FeeParameters;
		waterfallPriority?: number;
	}
) {
	const feeTemplate = normalizeFeeTemplate(args.feeTemplate);
	const effectiveFrom = normalizeEffectiveFrom(args.effectiveFrom);
	const parameters: FeeParameters = {
		...feeTemplate.parameters,
		...args.parameterOverrides,
	};

	assertValidFeeDefinition({
		behavior: feeTemplate.behavior,
		calculationType: feeTemplate.calculationType,
		code: feeTemplate.code,
		displayCode: feeTemplate.displayCode,
		parameters,
		paymentRail: feeTemplate.paymentRail,
		recurrence: feeTemplate.recurrence,
		revenueDestination: feeTemplate.revenueDestination,
		surface: feeTemplate.surface,
	});

	await assertNoOverlappingMortgageFee(db, {
		mortgageId: args.mortgageId,
		code: feeTemplate.code,
		surface: feeTemplate.surface,
		effectiveFrom,
		effectiveTo: args.effectiveTo,
	});

	return db.insert("mortgageFees", {
		mortgageId: args.mortgageId,
		code: feeTemplate.code,
		behavior: feeTemplate.behavior,
		displayCode: feeTemplate.displayCode,
		surface: feeTemplate.surface,
		revenueDestination: feeTemplate.revenueDestination,
		calculationType: feeTemplate.calculationType,
		parameters,
		paymentRail: feeTemplate.paymentRail,
		recurrence: feeTemplate.recurrence,
		defaultApplication: args.defaultApplication ?? "mortgage_specific",
		effectiveFrom,
		effectiveTo: args.effectiveTo,
		status: "active",
		feeTemplateId: feeTemplate._id,
		feeSetTemplateId: args.feeSetTemplateId,
		feeSetTemplateItemId: args.feeSetTemplateItemId,
		waterfallPriority:
			feeTemplate.behavior === "payment_waterfall_deduction"
				? (args.waterfallPriority ?? DEFAULT_DIRECT_WATERFALL_PRIORITY)
				: undefined,
		createdAt: Date.now(),
	});
}

export async function attachDefaultFeeSetToMortgage(
	db: GenericDatabaseWriter<DataModel>,
	mortgageId: Id<"mortgages">,
	annualServicingRate?: number
) {
	const defaults = await ensureDefaultFeeTemplatesAndSet(db);
	if (await hasMortgageFeeSetOptOut(db, mortgageId, defaults.feeSetId)) {
		return;
	}
	const items = await db
		.query("feeSetTemplateItems")
		.withIndex("by_fee_set_template", (q) =>
			q.eq("feeSetTemplateId", defaults.feeSetId)
		)
		.collect();

	for (const item of items.sort(
		(left, right) => left.sortOrder - right.sortOrder
	)) {
		const template = await db.get(item.feeTemplateId);
		if (!template) {
			continue;
		}
		const normalizedTemplate = await repairFeeTemplateForUse(db, template);
		const existingRows = await db
			.query("mortgageFees")
			.withIndex("by_mortgage_code_surface_status", (q) =>
				q
					.eq("mortgageId", mortgageId)
					.eq("code", normalizedTemplate.code)
					.eq("surface", normalizedTemplate.surface)
					.eq("status", "active")
			)
			.collect();
		if (existingRows.length > 0) {
			continue;
		}

		await attachFeeTemplateToMortgageSnapshot(db, {
			mortgageId,
			feeTemplate: normalizedTemplate,
			defaultApplication: "platform_default",
			feeSetTemplateId: defaults.feeSetId,
			feeSetTemplateItemId: item._id,
			waterfallPriority: item.sortOrder,
			parameterOverrides:
				normalizedTemplate.code === "servicing" &&
				annualServicingRate !== undefined
					? { annualRate: annualServicingRate }
					: undefined,
		});
	}
}
