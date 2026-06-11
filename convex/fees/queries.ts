import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { adminQuery } from "../fluent";
import { formatFeeValue } from "./behavior";
import {
	listActiveMortgageFeesForSurface,
	previewBulkApplyFeeSetToMortgages,
	resolveBorrowerChargeFeeConfig,
} from "./resolver";
import { normalizeFeeTemplate } from "./templateCompatibility";
import { feeCodeValidator, feeSurfaceValidator } from "./validators";

export const getActiveMortgageFee = internalQuery({
	args: {
		mortgageId: v.id("mortgages"),
		code: feeCodeValidator,
		surface: feeSurfaceValidator,
		asOfDate: v.string(),
	},
	handler: async (ctx, args) => {
		if (args.surface === "waterfall_deduction") {
			const rows = await listActiveMortgageFeesForSurface(
				ctx.db,
				args.mortgageId,
				args.surface,
				args.asOfDate
			);
			return rows.find((row) => row.code === args.code) ?? null;
		}

		if (args.code === "servicing") {
			return null;
		}

		const resolved = await resolveBorrowerChargeFeeConfig(
			ctx.db,
			args.mortgageId,
			args.code,
			args.asOfDate
		);
		if (!resolved) {
			return null;
		}
		return await ctx.db.get(resolved.mortgageFeeId);
	},
});

export const listFeeTemplates = adminQuery
	.input({
		status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
	})
	.handler(async (ctx, args) => {
		const status = args.status;
		if (status !== undefined) {
			const rows = await ctx.db
				.query("feeTemplates")
				.withIndex("by_status", (q) => q.eq("status", status))
				.collect();
			return rows.map(normalizeFeeTemplate);
		}
		const rows = await ctx.db.query("feeTemplates").collect();
		return rows.map(normalizeFeeTemplate);
	})
	.public();

export const listFeeSetTemplates = adminQuery
	.input({
		status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
	})
	.handler(async (ctx, args) => {
		const status = args.status;
		const sets =
			status !== undefined
				? await ctx.db
						.query("feeSetTemplates")
						.withIndex("by_status", (q) => q.eq("status", status))
						.collect()
				: await ctx.db.query("feeSetTemplates").collect();

		return await Promise.all(
			sets.map(async (set) => ({
				...set,
				items: await ctx.db
					.query("feeSetTemplateItems")
					.withIndex("by_fee_set_template", (q) =>
						q.eq("feeSetTemplateId", set._id)
					)
					.collect(),
			}))
		);
	})
	.public();

export const listMortgageFees = adminQuery
	.input({
		mortgageId: v.id("mortgages"),
	})
	.handler(async (ctx, args) => {
		return await ctx.db
			.query("mortgageFees")
			.withIndex("by_mortgage", (q) => q.eq("mortgageId", args.mortgageId))
			.collect();
	})
	.public();

export const previewBulkApplyFeeSet = adminQuery
	.input({
		feeSetTemplateId: v.id("feeSetTemplates"),
		mortgageIds: v.optional(v.array(v.id("mortgages"))),
		effectiveFrom: v.string(),
	})
	.handler(async (ctx, args) => {
		return await previewBulkApplyFeeSetToMortgages(ctx.db, args);
	})
	.public();

function valueLabelForFee(
	fee: Pick<
		{
			calculationType: "annual_rate_principal" | "fixed_amount_cents";
			parameters: {
				annualRate?: number;
				dueDays?: number;
				fixedAmountCents?: number;
				graceDays?: number;
			};
			recurrence?: "one_time" | "monthly" | "quarterly" | "annual";
		},
		"calculationType" | "parameters" | "recurrence"
	>
) {
	return formatFeeValue({
		calculationType: fee.calculationType,
		parameters: fee.parameters,
		recurrence: fee.recurrence,
	});
}

export const getFeeRevenueSummary = adminQuery
	.input({})
	.handler(async (ctx) => {
		const assessments = await ctx.db.query("feeAssessments").collect();
		const byType = new Map<
			string,
			{
				behavior: string;
				displayCode: string;
				incomeCents: number;
				volume: number;
			}
		>();
		let totalIncomeCents = 0;
		let waterfallIncomeCents = 0;
		let borrowerChargeIncomeCents = 0;
		let openAccountsReceivableCents = 0;

		for (const assessment of assessments) {
			const settled = assessment.amountSettledCents;
			const open = assessment.amountCents - assessment.amountSettledCents;
			if (assessment.status !== "reversed" && open > 0) {
				openAccountsReceivableCents += open;
			}
			if (settled <= 0) {
				continue;
			}
			totalIncomeCents += settled;
			if (assessment.behavior === "payment_waterfall_deduction") {
				waterfallIncomeCents += settled;
			} else {
				borrowerChargeIncomeCents += settled;
			}
			const key = `${assessment.displayCode}:${assessment.behavior}`;
			const existing = byType.get(key) ?? {
				behavior: assessment.behavior,
				displayCode: assessment.displayCode,
				incomeCents: 0,
				volume: 0,
			};
			existing.incomeCents += settled;
			existing.volume += 1;
			byType.set(key, existing);
		}

		return {
			totalIncomeCents,
			waterfallIncomeCents,
			borrowerChargeIncomeCents,
			openAccountsReceivableCents,
			byType: [...byType.values()].sort(
				(left, right) => right.incomeCents - left.incomeCents
			),
		};
	})
	.public();

export const getMortgageFeeSummary = adminQuery
	.input({
		mortgageId: v.id("mortgages"),
	})
	.handler(async (ctx, args) => {
		const [fees, optOuts, assessments] = await Promise.all([
			ctx.db
				.query("mortgageFees")
				.withIndex("by_mortgage", (q) => q.eq("mortgageId", args.mortgageId))
				.collect(),
			ctx.db
				.query("mortgageFeeSetOptOuts")
				.withIndex("by_mortgage_fee_set", (q) =>
					q.eq("mortgageId", args.mortgageId)
				)
				.collect(),
			ctx.db
				.query("feeAssessments")
				.withIndex("by_mortgage", (q) => q.eq("mortgageId", args.mortgageId))
				.collect(),
		]);

		const activeFees = fees
			.filter((fee) => fee.status === "active")
			.map((fee) => ({
				...fee,
				traceCount: assessments.filter(
					(assessment) => assessment.mortgageFeeId === fee._id
				).length,
				valueLabel: valueLabelForFee(fee),
			}));
		const inheritedDefaults = activeFees.filter(
			(fee) => fee.defaultApplication === "platform_default"
		);
		const mortgageSpecific = activeFees.filter(
			(fee) => fee.defaultApplication !== "platform_default"
		);

		return {
			activeFees,
			inheritedDefaults,
			mortgageSpecific,
			nextExpectedAction:
				activeFees.length === 0 ? "apply_default_fee_set" : "monitor_trace",
			optOuts,
			traceCounts: {
				open: assessments.filter(
					(row) =>
						row.status === "assessed" ||
						row.status === "invoiced" ||
						row.status === "partially_settled"
				).length,
				settled: assessments.filter((row) => row.status === "settled").length,
				total: assessments.length,
			},
		};
	})
	.public();

export const getAdminFeeManagementSnapshot = adminQuery
	.input({})
	.handler(async (ctx) => {
		const [
			feeTemplates,
			feeSetTemplates,
			feeSetItems,
			mortgageFees,
			optOuts,
			recentAssessments,
		] = await Promise.all([
			ctx.db.query("feeTemplates").collect(),
			ctx.db.query("feeSetTemplates").collect(),
			ctx.db.query("feeSetTemplateItems").collect(),
			ctx.db.query("mortgageFees").collect(),
			ctx.db.query("mortgageFeeSetOptOuts").collect(),
			ctx.db.query("feeAssessments").collect(),
		]);

		const itemCountBySet = new Map<string, number>();
		for (const item of feeSetItems) {
			itemCountBySet.set(
				String(item.feeSetTemplateId),
				(itemCountBySet.get(String(item.feeSetTemplateId)) ?? 0) + 1
			);
		}

		const revenueRows = recentAssessments.filter(
			(row) => row.amountSettledCents > 0
		);
		const revenue = {
			totalIncomeCents: revenueRows.reduce(
				(total, row) => total + row.amountSettledCents,
				0
			),
			openAccountsReceivableCents: recentAssessments.reduce(
				(total, row) =>
					row.status === "reversed"
						? total
						: total + Math.max(0, row.amountCents - row.amountSettledCents),
				0
			),
		};

		const normalizedFeeTemplates = feeTemplates.map(normalizeFeeTemplate);

		return {
			feeSets: feeSetTemplates.map((set) => ({
				...set,
				itemCount: itemCountBySet.get(String(set._id)) ?? 0,
			})),
			feeTemplates: normalizedFeeTemplates.map((template) => ({
				...template,
				valueLabel: valueLabelForFee(template),
			})),
			mortgageFeeCounts: {
				active: mortgageFees.filter((fee) => fee.status === "active").length,
				overrides: mortgageFees.filter(
					(fee) => fee.defaultApplication !== "platform_default"
				).length,
				optOuts: optOuts.length,
				total: mortgageFees.length,
			},
			recentAssessments: recentAssessments
				.sort((left, right) => right.assessedAt - left.assessedAt)
				.slice(0, 25),
			revenue,
		};
	})
	.public();
