import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import {
	createTestConvex,
	ensureSeededIdentity,
} from "../../../src/test/auth/helpers";
import { FAIRLEND_ADMIN } from "../../../src/test/auth/identities";
import type { Id } from "../../_generated/dataModel";

const createFeeTemplateRef = makeFunctionReference<
	"mutation",
	{
		name: string;
		description?: string;
		code: "servicing" | "late_fee" | "nsf" | "admin_fee" | "custom_fee";
		behavior:
			| "borrower_one_time_charge"
			| "borrower_recurring_charge"
			| "payment_waterfall_deduction";
		displayCode: string;
		surface: "waterfall_deduction" | "borrower_charge";
		revenueDestination:
			| "platform_revenue"
			| "investor_distribution"
			| "outside_dispersal";
		calculationType: "annual_rate_principal" | "fixed_amount_cents";
		parameters: {
			annualRate?: number;
			fixedAmountCents?: number;
			dueDays?: number;
			graceDays?: number;
		};
		paymentRail?:
			| "manual"
			| "manual_review"
			| "mock_pad"
			| "mock_eft"
			| "pad_vopay"
			| "pad_rotessa"
			| "eft_vopay"
			| "e_transfer"
			| "wire"
			| "plaid_transfer"
			| "stripe";
		recurrence?: "one_time" | "monthly" | "quarterly" | "annual";
		status: "active" | "inactive";
	},
	Id<"feeTemplates">
>("fees/config:createFeeTemplate");

const createFeeSetTemplateRef = makeFunctionReference<
	"mutation",
	{
		name: string;
		description?: string;
		isPlatformDefault: boolean;
		status: "active" | "inactive";
		items: Array<{ feeTemplateId: Id<"feeTemplates">; sortOrder: number }>;
	},
	Id<"feeSetTemplates">
>("fees/config:createFeeSetTemplate");

const updateFeeTemplateRef = makeFunctionReference<
	"mutation",
	{
		id: Id<"feeTemplates">;
		name: string;
		description?: string;
		code: "servicing" | "late_fee" | "nsf" | "admin_fee" | "custom_fee";
		behavior:
			| "borrower_one_time_charge"
			| "borrower_recurring_charge"
			| "payment_waterfall_deduction";
		displayCode: string;
		surface: "waterfall_deduction" | "borrower_charge";
		revenueDestination:
			| "platform_revenue"
			| "investor_distribution"
			| "outside_dispersal";
		calculationType: "annual_rate_principal" | "fixed_amount_cents";
		parameters: {
			annualRate?: number;
			fixedAmountCents?: number;
			dueDays?: number;
			graceDays?: number;
		};
		paymentRail?:
			| "manual"
			| "manual_review"
			| "mock_pad"
			| "mock_eft"
			| "pad_vopay"
			| "pad_rotessa"
			| "eft_vopay"
			| "e_transfer"
			| "wire"
			| "plaid_transfer"
			| "stripe";
		recurrence?: "one_time" | "monthly" | "quarterly" | "annual";
		status: "active" | "inactive";
	},
	Id<"feeTemplates">
>("fees/config:updateFeeTemplate");

const attachFeeTemplateToMortgageRef = makeFunctionReference<
	"mutation",
	{
		mortgageId: Id<"mortgages">;
		feeTemplateId: Id<"feeTemplates">;
		effectiveFrom?: string;
		effectiveTo?: string;
	},
	Id<"mortgageFees">
>("fees/config:attachFeeTemplateToMortgage");

const optOutMortgageFeeSetRef = makeFunctionReference<
	"mutation",
	{
		mortgageId: Id<"mortgages">;
		feeSetTemplateId: Id<"feeSetTemplates">;
		reason: string;
	},
	{ mortgageId: Id<"mortgages">; optedOutAt: number }
>("fees/config:optOutMortgageFeeSet");

const bulkApplyFeeSetToMortgagesRef = makeFunctionReference<
	"mutation",
	{
		feeSetTemplateId: Id<"feeSetTemplates">;
		mortgageIds?: Id<"mortgages">[];
		effectiveFrom: string;
		previewToken: string;
	},
	{ createdIds: Id<"mortgageFees">[]; appliedMortgageIds: Id<"mortgages">[] }
>("fees/config:bulkApplyFeeSetToMortgages");

const previewBulkApplyFeeSetRef = makeFunctionReference<
	"query",
	{
		feeSetTemplateId: Id<"feeSetTemplates">;
		mortgageIds?: Id<"mortgages">[];
		effectiveFrom: string;
	},
	{
		previewToken: string;
		feeSetTemplateId: Id<"feeSetTemplates">;
		effectiveFrom: string;
		applicable: Array<{ mortgageId: Id<"mortgages">; feeCount: number }>;
		conflicts: Array<{
			mortgageId: Id<"mortgages">;
			reason:
				| "existing_active_fee"
				| "mortgage_opted_out"
				| "mortgage_not_found";
		}>;
	}
>("fees/queries:previewBulkApplyFeeSet");

const listMortgageFeesRef = makeFunctionReference<
	"query",
	{ mortgageId: Id<"mortgages"> },
	Array<{
		_id: Id<"mortgageFees">;
		code: "servicing" | "late_fee" | "nsf" | "admin_fee" | "custom_fee";
		feeSetTemplateId?: Id<"feeSetTemplates">;
		defaultApplication:
			| "platform_default"
			| "mortgage_override"
			| "mortgage_specific";
		status: "active" | "inactive";
		waterfallPriority?: number;
	}>
>("fees/queries:listMortgageFees");

async function seedMortgageDoc(
	t: ReturnType<typeof createTestConvex>,
	index: number
) {
	return t.run(async (ctx) => {
		const now = Date.now() + index;
		const brokerUserId = await ctx.db.insert("users", {
			authId: `bulk-fee-test-broker-${now}`,
			email: `bulk-broker-${now}@test.com`,
			firstName: "Bulk",
			lastName: "Broker",
		});
		const brokerId = await ctx.db.insert("brokers", {
			userId: brokerUserId,
			status: "active",
			createdAt: now,
		});
		const propertyId = await ctx.db.insert("properties", {
			streetAddress: `${100 + index} Bulk Fee Test Way`,
			city: "Toronto",
			province: "ON",
			postalCode: "M5V1A1",
			propertyType: "residential",
			createdAt: now,
		});

		return await ctx.db.insert("mortgages", {
			status: "active",
			propertyId,
			principal: 10_000_000,
			interestRate: 0.08,
			rateType: "fixed",
			termMonths: 12,
			amortizationMonths: 12,
			paymentAmount: 100_000,
			paymentFrequency: "monthly",
			loanType: "conventional",
			lienPosition: 1,
			annualServicingRate: 0.01,
			interestAdjustmentDate: "2026-01-01",
			termStartDate: "2026-01-01",
			maturityDate: "2026-12-01",
			firstPaymentDate: "2026-02-01",
			brokerOfRecordId: brokerId,
			createdAt: now,
		});
	});
}

async function seedPlatformDefaultFeeSet(
	asAdmin: ReturnType<ReturnType<typeof createTestConvex>["withIdentity"]>
) {
	const servicingTemplateId = await asAdmin.mutation(createFeeTemplateRef, {
		name: "Bulk Servicing",
		code: "servicing",
		behavior: "payment_waterfall_deduction",
		displayCode: "servicing",
		surface: "waterfall_deduction",
		revenueDestination: "platform_revenue",
		calculationType: "annual_rate_principal",
		parameters: { annualRate: 0.0125 },
		status: "active",
	});

	return await asAdmin.mutation(createFeeSetTemplateRef, {
		name: "Bulk Platform Default",
		isPlatformDefault: true,
		status: "active",
		items: [{ feeTemplateId: servicingTemplateId, sortOrder: 10 }],
	});
}

async function seedPlatformDefaultFeeSetWithTemplate(
	asAdmin: ReturnType<ReturnType<typeof createTestConvex>["withIdentity"]>
) {
	const servicingTemplateId = await asAdmin.mutation(createFeeTemplateRef, {
		name: "Bulk Servicing",
		code: "servicing",
		behavior: "payment_waterfall_deduction",
		displayCode: "servicing",
		surface: "waterfall_deduction",
		revenueDestination: "platform_revenue",
		calculationType: "annual_rate_principal",
		parameters: { annualRate: 0.0125 },
		status: "active",
	});

	const feeSetTemplateId = await asAdmin.mutation(createFeeSetTemplateRef, {
		name: "Bulk Platform Default",
		isPlatformDefault: true,
		status: "active",
		items: [{ feeTemplateId: servicingTemplateId, sortOrder: 10 }],
	});

	return { feeSetTemplateId, servicingTemplateId };
}

describe("bulk fee set application", () => {
	it("previews active mortgages that would receive a platform fee set", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const [firstMortgageId, secondMortgageId] = await Promise.all([
			seedMortgageDoc(t, 1),
			seedMortgageDoc(t, 2),
		]);
		const feeSetTemplateId = await seedPlatformDefaultFeeSet(asAdmin);
		const conflictTemplateId = await asAdmin.mutation(createFeeTemplateRef, {
			name: "Existing Servicing",
			code: "servicing",
			behavior: "payment_waterfall_deduction",
			displayCode: "servicing",
			surface: "waterfall_deduction",
			revenueDestination: "platform_revenue",
			calculationType: "annual_rate_principal",
			parameters: { annualRate: 0.02 },
			status: "active",
		});

		await asAdmin.mutation(attachFeeTemplateToMortgageRef, {
			mortgageId: secondMortgageId,
			feeTemplateId: conflictTemplateId,
			effectiveFrom: "2026-01-01",
		});

		const preview = await asAdmin.query(previewBulkApplyFeeSetRef, {
			feeSetTemplateId,
			effectiveFrom: "2026-01-01",
		});

		expect(preview.applicable).toEqual([
			{ mortgageId: firstMortgageId, feeCount: 1 },
		]);
		expect(preview.conflicts).toEqual([
			{ mortgageId: secondMortgageId, reason: "existing_active_fee" },
		]);
	});

	it("bulk applies a fee set only to preview-approved mortgages", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const [firstMortgageId, secondMortgageId] = await Promise.all([
			seedMortgageDoc(t, 1),
			seedMortgageDoc(t, 2),
		]);
		const feeSetTemplateId = await seedPlatformDefaultFeeSet(asAdmin);
		const conflictTemplateId = await asAdmin.mutation(createFeeTemplateRef, {
			name: "Existing Servicing",
			code: "servicing",
			behavior: "payment_waterfall_deduction",
			displayCode: "servicing",
			surface: "waterfall_deduction",
			revenueDestination: "platform_revenue",
			calculationType: "annual_rate_principal",
			parameters: { annualRate: 0.02 },
			status: "active",
		});
		await asAdmin.mutation(attachFeeTemplateToMortgageRef, {
			mortgageId: secondMortgageId,
			feeTemplateId: conflictTemplateId,
			effectiveFrom: "2026-01-01",
		});
		const preview = await asAdmin.query(previewBulkApplyFeeSetRef, {
			feeSetTemplateId,
			effectiveFrom: "2026-01-01",
		});

		const result = await asAdmin.mutation(bulkApplyFeeSetToMortgagesRef, {
			feeSetTemplateId,
			effectiveFrom: "2026-01-01",
			previewToken: preview.previewToken,
		});

		expect(result.appliedMortgageIds).toEqual([firstMortgageId]);
		expect(result.createdIds).toHaveLength(1);
		const firstMortgageFees = await asAdmin.query(listMortgageFeesRef, {
			mortgageId: firstMortgageId,
		});
		expect(firstMortgageFees).toEqual([
			expect.objectContaining({
				feeSetTemplateId,
				defaultApplication: "mortgage_override",
				status: "active",
			}),
		]);
		const secondMortgageFees = await asAdmin.query(listMortgageFeesRef, {
			mortgageId: secondMortgageId,
		});
		expect(secondMortgageFees).toHaveLength(1);
		expect(secondMortgageFees[0].feeSetTemplateId).toBeUndefined();
	});

	it("preserves configured waterfall priority when bulk applying a fee set", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const mortgageId = await seedMortgageDoc(t, 1);
		const adminFeeTemplateId = await asAdmin.mutation(createFeeTemplateRef, {
			name: "Bulk Admin Fee",
			code: "admin_fee",
			behavior: "payment_waterfall_deduction",
			displayCode: "admin_fee",
			surface: "waterfall_deduction",
			revenueDestination: "platform_revenue",
			calculationType: "annual_rate_principal",
			parameters: { annualRate: 0.012 },
			status: "active",
		});
		const servicingTemplateId = await asAdmin.mutation(createFeeTemplateRef, {
			name: "Bulk Servicing",
			code: "servicing",
			behavior: "payment_waterfall_deduction",
			displayCode: "servicing",
			surface: "waterfall_deduction",
			revenueDestination: "platform_revenue",
			calculationType: "annual_rate_principal",
			parameters: { annualRate: 0.01 },
			status: "active",
		});
		const feeSetTemplateId = await asAdmin.mutation(createFeeSetTemplateRef, {
			name: "Bulk Priority Fee Set",
			isPlatformDefault: false,
			status: "active",
			items: [
				{ feeTemplateId: adminFeeTemplateId, sortOrder: 5 },
				{ feeTemplateId: servicingTemplateId, sortOrder: 20 },
			],
		});
		const preview = await asAdmin.query(previewBulkApplyFeeSetRef, {
			feeSetTemplateId,
			mortgageIds: [mortgageId],
			effectiveFrom: "2026-01-01",
		});

		await asAdmin.mutation(bulkApplyFeeSetToMortgagesRef, {
			feeSetTemplateId,
			mortgageIds: [mortgageId],
			effectiveFrom: "2026-01-01",
			previewToken: preview.previewToken,
		});

		const mortgageFees = await asAdmin.query(listMortgageFeesRef, {
			mortgageId,
		});
		const waterfallPriorities = mortgageFees
			.map((fee) => ({
				code: fee.code,
				waterfallPriority: fee.waterfallPriority,
			}))
			.sort((left, right) => left.code.localeCompare(right.code));

		expect(waterfallPriorities).toEqual([
			{ code: "admin_fee", waterfallPriority: 5 },
			{ code: "servicing", waterfallPriority: 20 },
		]);
	});

	it("records mortgage opt-out and excludes it from future default application", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const mortgageId = await seedMortgageDoc(t, 1);
		const feeSetTemplateId = await seedPlatformDefaultFeeSet(asAdmin);
		const preview = await asAdmin.query(previewBulkApplyFeeSetRef, {
			feeSetTemplateId,
			mortgageIds: [mortgageId],
			effectiveFrom: "2026-01-01",
		});
		await asAdmin.mutation(bulkApplyFeeSetToMortgagesRef, {
			feeSetTemplateId,
			mortgageIds: [mortgageId],
			effectiveFrom: "2026-01-01",
			previewToken: preview.previewToken,
		});

		await asAdmin.mutation(optOutMortgageFeeSetRef, {
			mortgageId,
			feeSetTemplateId,
			reason: "Borrower negotiated custom servicing terms",
		});

		const nextPreview = await asAdmin.query(previewBulkApplyFeeSetRef, {
			feeSetTemplateId,
			mortgageIds: [mortgageId],
			effectiveFrom: "2026-01-01",
		});

		expect(nextPreview.applicable).toEqual([]);
		expect(nextPreview.conflicts).toEqual([
			{ mortgageId, reason: "mortgage_opted_out" },
		]);
	});

	it("changes preview token when applicable and conflict identities change with the same conflict count", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const [firstMortgageId, secondMortgageId] = await Promise.all([
			seedMortgageDoc(t, 1),
			seedMortgageDoc(t, 2),
		]);
		const feeSetTemplateId = await seedPlatformDefaultFeeSet(asAdmin);
		const conflictTemplateId = await asAdmin.mutation(createFeeTemplateRef, {
			name: "Existing Servicing",
			code: "servicing",
			behavior: "payment_waterfall_deduction",
			displayCode: "servicing",
			surface: "waterfall_deduction",
			revenueDestination: "platform_revenue",
			calculationType: "annual_rate_principal",
			parameters: { annualRate: 0.02 },
			status: "active",
		});
		const firstConflictFeeId = await asAdmin.mutation(
			attachFeeTemplateToMortgageRef,
			{
				mortgageId: secondMortgageId,
				feeTemplateId: conflictTemplateId,
				effectiveFrom: "2026-01-01",
			}
		);
		const firstPreview = await asAdmin.query(previewBulkApplyFeeSetRef, {
			feeSetTemplateId,
			mortgageIds: [firstMortgageId, secondMortgageId],
			effectiveFrom: "2026-01-01",
		});

		await t.run(async (ctx) => {
			await ctx.db.patch(firstConflictFeeId, {
				status: "inactive",
				deactivatedAt: Date.now(),
			});
		});
		await asAdmin.mutation(attachFeeTemplateToMortgageRef, {
			mortgageId: firstMortgageId,
			feeTemplateId: conflictTemplateId,
			effectiveFrom: "2026-01-01",
		});
		const secondPreview = await asAdmin.query(previewBulkApplyFeeSetRef, {
			feeSetTemplateId,
			mortgageIds: [firstMortgageId, secondMortgageId],
			effectiveFrom: "2026-01-01",
		});

		expect(firstPreview.conflicts).toEqual([
			{ mortgageId: secondMortgageId, reason: "existing_active_fee" },
		]);
		expect(secondPreview.conflicts).toEqual([
			{ mortgageId: firstMortgageId, reason: "existing_active_fee" },
		]);
		expect(secondPreview.conflicts).toHaveLength(firstPreview.conflicts.length);
		expect(secondPreview.previewToken).not.toBe(firstPreview.previewToken);
	});

	it("changes preview token when fee set template state changes", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const mortgageId = await seedMortgageDoc(t, 1);
		const { feeSetTemplateId, servicingTemplateId } =
			await seedPlatformDefaultFeeSetWithTemplate(asAdmin);
		const firstPreview = await asAdmin.query(previewBulkApplyFeeSetRef, {
			feeSetTemplateId,
			mortgageIds: [mortgageId],
			effectiveFrom: "2026-01-01",
		});

		await asAdmin.mutation(updateFeeTemplateRef, {
			id: servicingTemplateId,
			name: "Bulk Servicing Updated",
			code: "servicing",
			behavior: "payment_waterfall_deduction",
			displayCode: "servicing_updated",
			surface: "waterfall_deduction",
			revenueDestination: "platform_revenue",
			calculationType: "annual_rate_principal",
			parameters: { annualRate: 0.0125 },
			status: "active",
		});
		const secondPreview = await asAdmin.query(previewBulkApplyFeeSetRef, {
			feeSetTemplateId,
			mortgageIds: [mortgageId],
			effectiveFrom: "2026-01-01",
		});

		expect(secondPreview.previewToken).not.toBe(firstPreview.previewToken);
	});

	it("records opt-out before active fee rows exist", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const mortgageId = await seedMortgageDoc(t, 1);
		const feeSetTemplateId = await seedPlatformDefaultFeeSet(asAdmin);

		await asAdmin.mutation(optOutMortgageFeeSetRef, {
			mortgageId,
			feeSetTemplateId,
			reason: "Borrower opted out before setup",
		});
		const preview = await asAdmin.query(previewBulkApplyFeeSetRef, {
			feeSetTemplateId,
			mortgageIds: [mortgageId],
			effectiveFrom: "2026-01-01",
		});

		expect(preview.applicable).toEqual([]);
		expect(preview.conflicts).toEqual([
			{ mortgageId, reason: "mortgage_opted_out" },
		]);
	});

	it("deduplicates explicit mortgage ids before preview and apply", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const mortgageId = await seedMortgageDoc(t, 1);
		const feeSetTemplateId = await seedPlatformDefaultFeeSet(asAdmin);
		const preview = await asAdmin.query(previewBulkApplyFeeSetRef, {
			feeSetTemplateId,
			mortgageIds: [mortgageId, mortgageId],
			effectiveFrom: "2026-01-01",
		});

		const result = await asAdmin.mutation(bulkApplyFeeSetToMortgagesRef, {
			feeSetTemplateId,
			mortgageIds: [mortgageId, mortgageId],
			effectiveFrom: "2026-01-01",
			previewToken: preview.previewToken,
		});

		expect(preview.applicable).toEqual([{ mortgageId, feeCount: 1 }]);
		expect(result.appliedMortgageIds).toEqual([mortgageId]);
		expect(result.createdIds).toHaveLength(1);
	});

	it("rejects fee sets containing duplicate fee surface and code items", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const mortgageId = await seedMortgageDoc(t, 1);
		const firstTemplateId = await asAdmin.mutation(createFeeTemplateRef, {
			name: "Bulk Servicing One",
			code: "servicing",
			behavior: "payment_waterfall_deduction",
			displayCode: "servicing_one",
			surface: "waterfall_deduction",
			revenueDestination: "platform_revenue",
			calculationType: "annual_rate_principal",
			parameters: { annualRate: 0.01 },
			status: "active",
		});
		const secondTemplateId = await asAdmin.mutation(createFeeTemplateRef, {
			name: "Bulk Servicing Two",
			code: "servicing",
			behavior: "payment_waterfall_deduction",
			displayCode: "servicing_two",
			surface: "waterfall_deduction",
			revenueDestination: "platform_revenue",
			calculationType: "annual_rate_principal",
			parameters: { annualRate: 0.02 },
			status: "active",
		});
		const feeSetTemplateId = await asAdmin.mutation(createFeeSetTemplateRef, {
			name: "Duplicate Servicing Set",
			isPlatformDefault: false,
			status: "active",
			items: [
				{ feeTemplateId: firstTemplateId, sortOrder: 10 },
				{ feeTemplateId: secondTemplateId, sortOrder: 20 },
			],
		});

		await expect(
			asAdmin.query(previewBulkApplyFeeSetRef, {
				feeSetTemplateId,
				mortgageIds: [mortgageId],
				effectiveFrom: "2026-01-01",
			})
		).rejects.toThrow("Fee set contains duplicate fee surface/code");
	});

	it("rejects inactive fee sets and inactive fee templates", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const mortgageId = await seedMortgageDoc(t, 1);
		const inactiveSetTemplateId = await asAdmin.mutation(createFeeTemplateRef, {
			name: "Inactive Set Servicing",
			code: "servicing",
			behavior: "payment_waterfall_deduction",
			displayCode: "servicing",
			surface: "waterfall_deduction",
			revenueDestination: "platform_revenue",
			calculationType: "annual_rate_principal",
			parameters: { annualRate: 0.01 },
			status: "active",
		});
		const inactiveFeeSetId = await asAdmin.mutation(createFeeSetTemplateRef, {
			name: "Inactive Fee Set",
			isPlatformDefault: false,
			status: "inactive",
			items: [{ feeTemplateId: inactiveSetTemplateId, sortOrder: 10 }],
		});
		const inactiveTemplateId = await asAdmin.mutation(createFeeTemplateRef, {
			name: "Inactive Servicing",
			code: "servicing",
			behavior: "payment_waterfall_deduction",
			displayCode: "servicing",
			surface: "waterfall_deduction",
			revenueDestination: "platform_revenue",
			calculationType: "annual_rate_principal",
			parameters: { annualRate: 0.01 },
			status: "inactive",
		});
		const inactiveTemplateFeeSetId = await asAdmin.mutation(
			createFeeSetTemplateRef,
			{
				name: "Inactive Template Fee Set",
				isPlatformDefault: false,
				status: "active",
				items: [{ feeTemplateId: inactiveTemplateId, sortOrder: 10 }],
			}
		);

		await expect(
			asAdmin.query(previewBulkApplyFeeSetRef, {
				feeSetTemplateId: inactiveFeeSetId,
				mortgageIds: [mortgageId],
				effectiveFrom: "2026-01-01",
			})
		).rejects.toThrow("Fee set template is inactive");
		await expect(
			asAdmin.query(previewBulkApplyFeeSetRef, {
				feeSetTemplateId: inactiveTemplateFeeSetId,
				mortgageIds: [mortgageId],
				effectiveFrom: "2026-01-01",
			})
		).rejects.toThrow("Fee template is inactive");
	});

	it("treats explicit inactive mortgages as not found", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const mortgageId = await seedMortgageDoc(t, 1);
		const feeSetTemplateId = await seedPlatformDefaultFeeSet(asAdmin);
		await t.run(async (ctx) => {
			await ctx.db.patch(mortgageId, { status: "inactive" });
		});

		const preview = await asAdmin.query(previewBulkApplyFeeSetRef, {
			feeSetTemplateId,
			mortgageIds: [mortgageId],
			effectiveFrom: "2026-01-01",
		});

		expect(preview.applicable).toEqual([]);
		expect(preview.conflicts).toEqual([
			{ mortgageId, reason: "mortgage_not_found" },
		]);
	});
});
