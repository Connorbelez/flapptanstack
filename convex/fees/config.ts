import type { GenericDatabaseWriter } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { adminMutation } from "../fluent";
import { createObligationImpl } from "../obligations/mutations";
import { createEntryImpl } from "../payments/collectionPlan/initialScheduling";
import { calculateFeeAmountCents } from "./behavior";
import {
	assertNoOverlappingMortgageFee,
	assertValidFeeDefinition,
	attachFeeTemplateToMortgageSnapshot,
	loadFeeSetTemplateItemsForApplication,
	normalizeEffectiveFrom,
	previewBulkApplyFeeSetToMortgages,
} from "./resolver";
import {
	feeBehaviorValidator,
	feeCalculationParametersValidator,
	feeCalculationTypeValidator,
	feeCodeValidator,
	feePaymentRailValidator,
	feeRecurrenceValidator,
	feeRevenueDestinationValidator,
	feeStatusValidator,
	feeSurfaceValidator,
} from "./validators";

const feeTemplateInputValidator = {
	name: v.string(),
	description: v.optional(v.string()),
	code: feeCodeValidator,
	behavior: feeBehaviorValidator,
	displayCode: v.string(),
	surface: feeSurfaceValidator,
	revenueDestination: feeRevenueDestinationValidator,
	calculationType: feeCalculationTypeValidator,
	parameters: feeCalculationParametersValidator,
	paymentRail: v.optional(feePaymentRailValidator),
	recurrence: v.optional(feeRecurrenceValidator),
	status: feeStatusValidator,
};

function assertDateRange(effectiveFrom: string, effectiveTo?: string) {
	if (effectiveTo !== undefined && effectiveTo < effectiveFrom) {
		throw new ConvexError("effectiveTo must be on or after effectiveFrom");
	}
}

async function getPrimaryBorrowerIdForMortgage(
	ctx: Pick<MutationCtx, "db">,
	mortgageId: Id<"mortgages">
) {
	const links = await ctx.db
		.query("mortgageBorrowers")
		.withIndex("by_mortgage", (q) => q.eq("mortgageId", mortgageId))
		.collect();
	const primaryLink =
		links.find((link) => link.role === "primary") ?? links[0] ?? null;
	if (!primaryLink) {
		throw new ConvexError(
			`Mortgage ${mortgageId} has no borrower link for fee application`
		);
	}
	return primaryLink.borrowerId;
}

function assertBorrowerChargeMortgageFee(
	fee: Doc<"mortgageFees">
): asserts fee is Doc<"mortgageFees"> & {
	behavior: "borrower_one_time_charge" | "borrower_recurring_charge";
} {
	if (
		fee.behavior !== "borrower_one_time_charge" &&
		fee.behavior !== "borrower_recurring_charge"
	) {
		throw new ConvexError(
			"applyBorrowerFeeToMortgage requires a borrower-charge mortgage fee"
		);
	}
	if (!fee.paymentRail || fee.paymentRail === "stripe") {
		throw new ConvexError(
			"applyBorrowerFeeToMortgage requires a non-checkout paymentRail"
		);
	}
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

export const createFeeTemplate = adminMutation
	.input(feeTemplateInputValidator)
	.handler(async (ctx, args) => {
		assertValidFeeDefinition(args);
		const now = Date.now();
		return await ctx.db.insert("feeTemplates", {
			...args,
			createdAt: now,
			updatedAt: now,
		});
	})
	.public();

export const updateFeeTemplate = adminMutation
	.input({
		id: v.id("feeTemplates"),
		...feeTemplateInputValidator,
	})
	.handler(async (ctx, args) => {
		const existing = await ctx.db.get(args.id);
		if (!existing) {
			throw new ConvexError(`Fee template not found: ${args.id}`);
		}
		assertValidFeeDefinition(args);
		await ctx.db.patch(args.id, {
			name: args.name,
			description: args.description,
			code: args.code,
			behavior: args.behavior,
			displayCode: args.displayCode,
			surface: args.surface,
			revenueDestination: args.revenueDestination,
			calculationType: args.calculationType,
			parameters: args.parameters,
			paymentRail: args.paymentRail,
			recurrence: args.recurrence,
			status: args.status,
			updatedAt: Date.now(),
		});
		return args.id;
	})
	.public();

export const createFeeSetTemplate = adminMutation
	.input({
		name: v.string(),
		description: v.optional(v.string()),
		isPlatformDefault: v.boolean(),
		status: feeStatusValidator,
		items: v.array(
			v.object({
				feeTemplateId: v.id("feeTemplates"),
				sortOrder: v.number(),
			})
		),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		const feeSetTemplateId = await ctx.db.insert("feeSetTemplates", {
			name: args.name,
			description: args.description,
			isPlatformDefault: args.isPlatformDefault,
			status: args.status,
			createdAt: now,
			updatedAt: now,
		});
		if (args.isPlatformDefault && args.status === "active") {
			await clearOtherActivePlatformDefaults(ctx.db, feeSetTemplateId, now);
		}
		for (const item of args.items) {
			await ctx.db.insert("feeSetTemplateItems", {
				feeSetTemplateId,
				feeTemplateId: item.feeTemplateId,
				sortOrder: item.sortOrder,
				createdAt: now,
			});
		}
		return feeSetTemplateId;
	})
	.public();

export const updateFeeSetTemplate = adminMutation
	.input({
		id: v.id("feeSetTemplates"),
		name: v.string(),
		description: v.optional(v.string()),
		isPlatformDefault: v.boolean(),
		status: feeStatusValidator,
		items: v.optional(
			v.array(
				v.object({
					feeTemplateId: v.id("feeTemplates"),
					sortOrder: v.number(),
				})
			)
		),
	})
	.handler(async (ctx, args) => {
		const existing = await ctx.db.get(args.id);
		if (!existing) {
			throw new ConvexError(`Fee set template not found: ${args.id}`);
		}
		await ctx.db.patch(args.id, {
			name: args.name,
			description: args.description,
			isPlatformDefault: args.isPlatformDefault,
			status: args.status,
			updatedAt: Date.now(),
		});
		if (args.isPlatformDefault && args.status === "active") {
			await clearOtherActivePlatformDefaults(ctx.db, args.id, Date.now());
		}
		if (args.items) {
			const existingItems = await ctx.db
				.query("feeSetTemplateItems")
				.withIndex("by_fee_set_template", (q) =>
					q.eq("feeSetTemplateId", args.id)
				)
				.collect();
			for (const item of existingItems) {
				await ctx.db.delete(item._id);
			}
			for (const item of args.items) {
				await ctx.db.insert("feeSetTemplateItems", {
					feeSetTemplateId: args.id,
					feeTemplateId: item.feeTemplateId,
					sortOrder: item.sortOrder,
					createdAt: Date.now(),
				});
			}
		}
		return args.id;
	})
	.public();

export const attachFeeTemplateToMortgage = adminMutation
	.input({
		mortgageId: v.id("mortgages"),
		feeTemplateId: v.id("feeTemplates"),
		effectiveFrom: v.optional(v.string()),
		effectiveTo: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		const feeTemplate = await ctx.db.get(args.feeTemplateId);
		if (!feeTemplate) {
			throw new ConvexError(`Fee template not found: ${args.feeTemplateId}`);
		}
		const effectiveFrom = normalizeEffectiveFrom(args.effectiveFrom);
		assertDateRange(effectiveFrom, args.effectiveTo);
		return await attachFeeTemplateToMortgageSnapshot(ctx.db, {
			mortgageId: args.mortgageId,
			feeTemplate,
			effectiveFrom,
			effectiveTo: args.effectiveTo,
		});
	})
	.public();

export const attachFeeSetTemplateToMortgage = adminMutation
	.input({
		mortgageId: v.id("mortgages"),
		feeSetTemplateId: v.id("feeSetTemplates"),
		effectiveFrom: v.optional(v.string()),
		effectiveTo: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		const items = await loadFeeSetTemplateItemsForApplication(
			ctx.db,
			args.feeSetTemplateId
		);
		const effectiveFrom = normalizeEffectiveFrom(args.effectiveFrom);
		assertDateRange(effectiveFrom, args.effectiveTo);

		const createdIds: Id<"mortgageFees">[] = [];
		for (const { item, template } of items) {
			const id = await attachFeeTemplateToMortgageSnapshot(ctx.db, {
				mortgageId: args.mortgageId,
				feeTemplate: template,
				effectiveFrom,
				effectiveTo: args.effectiveTo,
				feeSetTemplateId: args.feeSetTemplateId,
				feeSetTemplateItemId: item._id,
				waterfallPriority: item.sortOrder,
			});
			createdIds.push(id);
		}
		return createdIds;
	})
	.public();

export const optOutMortgageFeeSet = adminMutation
	.input({
		mortgageId: v.id("mortgages"),
		feeSetTemplateId: v.id("feeSetTemplates"),
		reason: v.string(),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		const existingOptOut = await ctx.db
			.query("mortgageFeeSetOptOuts")
			.withIndex("by_mortgage_fee_set", (q) =>
				q
					.eq("mortgageId", args.mortgageId)
					.eq("feeSetTemplateId", args.feeSetTemplateId)
			)
			.first();
		if (existingOptOut) {
			await ctx.db.patch(existingOptOut._id, {
				reason: args.reason,
				optedOutAt: now,
				optedOutBy: ctx.viewer.authId,
				updatedAt: now,
			});
		} else {
			await ctx.db.insert("mortgageFeeSetOptOuts", {
				mortgageId: args.mortgageId,
				feeSetTemplateId: args.feeSetTemplateId,
				reason: args.reason,
				optedOutAt: now,
				optedOutBy: ctx.viewer.authId,
				createdAt: now,
				updatedAt: now,
			});
		}

		const rows = await ctx.db
			.query("mortgageFees")
			.withIndex("by_mortgage", (q) => q.eq("mortgageId", args.mortgageId))
			.collect();
		for (const row of rows.filter(
			(row) =>
				row.feeSetTemplateId === args.feeSetTemplateId &&
				row.status === "active"
		)) {
			await ctx.db.patch(row._id, {
				status: "inactive",
				deactivatedAt: now,
				optedOutAt: now,
				optedOutBy: ctx.viewer.authId,
				overrideReason: args.reason,
			});
		}
		return { mortgageId: args.mortgageId, optedOutAt: now };
	})
	.public();

export const applyBorrowerFeeToMortgage = adminMutation
	.input({
		mortgageId: v.id("mortgages"),
		mortgageFeeId: v.id("mortgageFees"),
		effectiveDate: v.string(),
		dueDate: v.number(),
		gracePeriodEnd: v.number(),
	})
	.handler(async (ctx, args) => {
		const mortgageFee = await ctx.db.get(args.mortgageFeeId);
		if (!mortgageFee) {
			throw new ConvexError(`Mortgage fee not found: ${args.mortgageFeeId}`);
		}
		if (mortgageFee.mortgageId !== args.mortgageId) {
			throw new ConvexError(
				`Mortgage fee ${args.mortgageFeeId} does not belong to mortgage ${args.mortgageId}`
			);
		}
		assertBorrowerChargeMortgageFee(mortgageFee);
		const paymentRail = mortgageFee.paymentRail;
		if (!paymentRail || paymentRail === "stripe") {
			throw new ConvexError(
				"applyBorrowerFeeToMortgage requires a non-checkout paymentRail"
			);
		}

		const mortgage = await ctx.db.get(args.mortgageId);
		if (!mortgage) {
			throw new ConvexError(`Mortgage not found: ${args.mortgageId}`);
		}

		const amountCents = calculateFeeAmountCents({
			calculationType: mortgageFee.calculationType,
			parameters: mortgageFee.parameters,
			paymentFrequency: mortgage.paymentFrequency,
			principalCents: mortgage.principal,
		});
		const borrowerId = await getPrimaryBorrowerIdForMortgage(
			ctx,
			args.mortgageId
		);
		const now = Date.now();
		const feeAssessmentId = await ctx.db.insert("feeAssessments", {
			orgId: mortgage.orgId,
			mortgageId: args.mortgageId,
			mortgageFeeId: args.mortgageFeeId,
			feeTemplateId: mortgageFee.feeTemplateId,
			feeSetTemplateId: mortgageFee.feeSetTemplateId,
			behavior: mortgageFee.behavior,
			code: mortgageFee.code,
			displayCode: mortgageFee.displayCode,
			amountCents,
			amountSettledCents: 0,
			source: "admin_manual",
			status: "assessed",
			assessedAt: now,
			effectiveDate: args.effectiveDate,
			metadata: {
				appliedBy: ctx.viewer.authId,
				paymentRail,
			},
			createdAt: now,
			updatedAt: now,
		});

		const obligationId = await createObligationImpl(ctx, {
			mortgageId: args.mortgageId,
			borrowerId,
			paymentNumber: 0,
			type: "late_fee",
			amount: amountCents,
			amountSettled: 0,
			dueDate: args.dueDate,
			gracePeriodEnd: args.gracePeriodEnd,
			feeCode: mortgageFee.code,
			mortgageFeeId: args.mortgageFeeId,
			status: "upcoming",
		});

		await ctx.db.patch(feeAssessmentId, {
			status: "invoiced",
			obligationId,
			updatedAt: Date.now(),
		});

		const collectionPlanEntryId = await createEntryImpl(ctx, {
			amount: amountCents,
			executionIdempotencyKey: `borrower-fee:${feeAssessmentId}`,
			method: paymentRail,
			obligationIds: [obligationId],
			scheduledDate: args.dueDate,
			source: "admin",
			status: "planned",
		});

		return {
			amountCents,
			collectionPlanEntryId,
			feeAssessmentId,
			obligationId,
		};
	})
	.public();

export const bulkApplyFeeSetToMortgages = adminMutation
	.input({
		feeSetTemplateId: v.id("feeSetTemplates"),
		mortgageIds: v.optional(v.array(v.id("mortgages"))),
		effectiveFrom: v.string(),
		previewToken: v.string(),
	})
	.handler(async (ctx, args) => {
		const preview = await previewBulkApplyFeeSetToMortgages(ctx.db, {
			feeSetTemplateId: args.feeSetTemplateId,
			mortgageIds: args.mortgageIds,
			effectiveFrom: args.effectiveFrom,
		});
		if (preview.previewToken !== args.previewToken) {
			throw new ConvexError("Bulk apply preview token is stale");
		}

		const items = await loadFeeSetTemplateItemsForApplication(
			ctx.db,
			args.feeSetTemplateId
		);
		const createdIds: Id<"mortgageFees">[] = [];
		for (const applicable of preview.applicable) {
			for (const { item, template } of items) {
				const createdId = await attachFeeTemplateToMortgageSnapshot(ctx.db, {
					mortgageId: applicable.mortgageId,
					feeTemplate: template,
					effectiveFrom: args.effectiveFrom,
					feeSetTemplateId: args.feeSetTemplateId,
					feeSetTemplateItemId: item._id,
					defaultApplication: "mortgage_override",
					waterfallPriority: item.sortOrder,
				});
				createdIds.push(createdId);
			}
		}

		return {
			createdIds,
			appliedMortgageIds: preview.applicable.map((row) => row.mortgageId),
		};
	})
	.public();

export const updateMortgageFeeEffectiveWindow = adminMutation
	.input({
		id: v.id("mortgageFees"),
		effectiveFrom: v.string(),
		effectiveTo: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		const fee = await ctx.db.get(args.id);
		if (!fee) {
			throw new ConvexError(`Mortgage fee not found: ${args.id}`);
		}
		assertDateRange(args.effectiveFrom, args.effectiveTo);
		await assertNoOverlappingMortgageFee(
			ctx.db,
			{
				mortgageId: fee.mortgageId,
				code: fee.code,
				surface: fee.surface,
				effectiveFrom: args.effectiveFrom,
				effectiveTo: args.effectiveTo,
			},
			args.id
		);
		await ctx.db.patch(args.id, {
			effectiveFrom: args.effectiveFrom,
			effectiveTo: args.effectiveTo,
		});
		return args.id;
	})
	.public();

export const deactivateMortgageFee = adminMutation
	.input({
		id: v.id("mortgageFees"),
	})
	.handler(async (ctx, args) => {
		const fee = await ctx.db.get(args.id);
		if (!fee) {
			throw new ConvexError(`Mortgage fee not found: ${args.id}`);
		}
		await ctx.db.patch(args.id, {
			status: "inactive",
			deactivatedAt: Date.now(),
		});
		return args.id;
	})
	.public();
