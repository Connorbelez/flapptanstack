import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import {
	createTestConvex,
	ensureSeededIdentity,
} from "../../../src/test/auth/helpers";
import { FAIRLEND_ADMIN } from "../../../src/test/auth/identities";
import type { Doc, Id } from "../../_generated/dataModel";
import {
	attachDefaultFeeSetToMortgage,
	DEFAULT_FEE_SET_NAME,
	ensureDefaultFeeTemplatesAndSet,
	resolveServicingFeeConfig,
	resolveWaterfallFeeConfigs,
} from "../resolver";

const OVERLAPPING_FEE_PATTERN = /Overlapping active mortgage fee/i;

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

const updateFeeSetTemplateRef = makeFunctionReference<
	"mutation",
	{
		id: Id<"feeSetTemplates">;
		name: string;
		description?: string;
		isPlatformDefault: boolean;
		status: "active" | "inactive";
		items?: Array<{ feeTemplateId: Id<"feeTemplates">; sortOrder: number }>;
	},
	Id<"feeSetTemplates">
>("fees/config:updateFeeSetTemplate");

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

const attachFeeSetTemplateToMortgageRef = makeFunctionReference<
	"mutation",
	{
		mortgageId: Id<"mortgages">;
		feeSetTemplateId: Id<"feeSetTemplates">;
		effectiveFrom?: string;
		effectiveTo?: string;
	},
	Id<"mortgageFees">[]
>("fees/config:attachFeeSetTemplateToMortgage");

const optOutMortgageFeeSetRef = makeFunctionReference<
	"mutation",
	{
		mortgageId: Id<"mortgages">;
		feeSetTemplateId: Id<"feeSetTemplates">;
		reason: string;
	},
	{ mortgageId: Id<"mortgages">; optedOutAt: number }
>("fees/config:optOutMortgageFeeSet");

const listMortgageFeesRef = makeFunctionReference<
	"query",
	{ mortgageId: Id<"mortgages"> },
	Array<{
		_id: Id<"mortgageFees">;
		code: "servicing" | "late_fee" | "nsf" | "admin_fee" | "custom_fee";
		behavior:
			| "borrower_one_time_charge"
			| "borrower_recurring_charge"
			| "payment_waterfall_deduction";
		displayCode: string;
		surface: "waterfall_deduction" | "borrower_charge";
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
		defaultApplication:
			| "platform_default"
			| "mortgage_override"
			| "mortgage_specific";
	}>
>("fees/queries:listMortgageFees");

const listFeeTemplatesRef = makeFunctionReference<
	"query",
	{ status?: "active" | "inactive" },
	Array<{
		_id: Id<"feeTemplates">;
		behavior:
			| "borrower_one_time_charge"
			| "borrower_recurring_charge"
			| "payment_waterfall_deduction";
		displayCode: string;
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
	}>
>("fees/queries:listFeeTemplates");

const listFeeSetTemplatesRef = makeFunctionReference<
	"query",
	{ status?: "active" | "inactive" },
	Array<{
		_id: Id<"feeSetTemplates">;
		name: string;
		isPlatformDefault?: boolean;
		status: "active" | "inactive";
	}>
>("fees/queries:listFeeSetTemplates");

const runFeeSetTemplatePlatformDefaultBackfillRef = makeFunctionReference<
	"mutation",
	Record<string, never>,
	null
>("fees/migrations:runFeeSetTemplatePlatformDefaultBackfill");

const getFeeSetTemplatePlatformDefaultBackfillStatusRef = makeFunctionReference<
	"query",
	Record<string, never>,
	{
		feeSetTemplateCount: number;
		missingPlatformDefaultFlagCount: number;
		missingPlatformDefaultFlagIds: Id<"feeSetTemplates">[];
	}
>("fees/migrations:getFeeSetTemplatePlatformDefaultBackfillStatus");

async function seedMortgageDoc(t: ReturnType<typeof createTestConvex>) {
	return t.run(async (ctx) => {
		const now = Date.now();
		const brokerUserId = await ctx.db.insert("users", {
			authId: `fee-test-broker-${now}`,
			email: `broker-${now}@test.com`,
			firstName: "Fee",
			lastName: "Broker",
		});
		const brokerId = await ctx.db.insert("brokers", {
			userId: brokerUserId,
			status: "active",
			createdAt: now,
		});
		const propertyId = await ctx.db.insert("properties", {
			streetAddress: `100 Fee Test Way ${now}`,
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

describe("mortgage fee configuration", () => {
	it("creates borrower one-time fee templates with payment rails", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);

		const id = await asAdmin.mutation(createFeeTemplateRef, {
			name: "Document preparation fee",
			description: "One-time borrower payable document fee",
			code: "admin_fee",
			displayCode: "document_preparation",
			behavior: "borrower_one_time_charge",
			surface: "borrower_charge",
			revenueDestination: "platform_revenue",
			calculationType: "fixed_amount_cents",
			parameters: { fixedAmountCents: 15_000, dueDays: 7, graceDays: 10 },
			paymentRail: "manual",
			recurrence: "one_time",
			status: "active",
		});

		const rows = await asAdmin.query(listFeeTemplatesRef, {});
		expect(rows.find((row) => row._id === id)).toMatchObject({
			behavior: "borrower_one_time_charge",
			displayCode: "document_preparation",
			paymentRail: "manual",
			recurrence: "one_time",
		});
	});

	it("normalizes legacy fee templates without behavior metadata for admin reads", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const legacyId = await t.run(async (ctx) => {
			const now = Date.now();
			const legacyTemplate = {
				name: "Standard NSF Fee",
				description:
					"Config-ready NSF fee definition; auto-generation is deferred in v1",
				code: "nsf" as const,
				surface: "borrower_charge" as const,
				revenueDestination: "platform_revenue" as const,
				calculationType: "fixed_amount_cents" as const,
				parameters: { fixedAmountCents: 5000, dueDays: 30, graceDays: 45 },
				status: "active" as const,
				createdAt: now,
				updatedAt: now,
			};
			return await ctx.db.insert(
				"feeTemplates",
				legacyTemplate as unknown as Doc<"feeTemplates">
			);
		});

		const rows = await asAdmin.query(listFeeTemplatesRef, {});

		expect(rows.find((row) => row._id === legacyId)).toMatchObject({
			behavior: "borrower_one_time_charge",
			displayCode: "nsf",
			paymentRail: "manual",
			recurrence: "one_time",
		});
	});

	it("repairs legacy default fee template rows when ensuring defaults", async () => {
		const t = createTestConvex();
		const legacyId = await t.run(async (ctx) => {
			const now = Date.now();
			const legacyTemplate = {
				name: "Standard NSF Fee",
				description:
					"Config-ready NSF fee definition; auto-generation is deferred in v1",
				code: "nsf" as const,
				surface: "borrower_charge" as const,
				revenueDestination: "platform_revenue" as const,
				calculationType: "fixed_amount_cents" as const,
				parameters: { fixedAmountCents: 5000, dueDays: 30, graceDays: 45 },
				status: "active" as const,
				createdAt: now,
				updatedAt: now,
			};
			return await ctx.db.insert(
				"feeTemplates",
				legacyTemplate as unknown as Doc<"feeTemplates">
			);
		});

		await t.run(async (ctx) => {
			await ensureDefaultFeeTemplatesAndSet(ctx.db);
		});

		const row = await t.run(async (ctx) => await ctx.db.get(legacyId));
		expect(row).toMatchObject({
			behavior: "borrower_one_time_charge",
			displayCode: "nsf",
			paymentRail: "manual",
			recurrence: "one_time",
		});
	});

	it("rejects borrower payable fee templates without payment rails", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);

		await expect(
			asAdmin.mutation(createFeeTemplateRef, {
				name: "Document preparation fee",
				code: "admin_fee",
				displayCode: "document_preparation",
				behavior: "borrower_one_time_charge",
				surface: "borrower_charge",
				revenueDestination: "platform_revenue",
				calculationType: "fixed_amount_cents",
				parameters: { fixedAmountCents: 15_000, dueDays: 7, graceDays: 10 },
				recurrence: "one_time",
				status: "active",
			})
		).rejects.toThrow("borrower payable fees require paymentRail");
	});

	it("keeps active platform default fee sets as a singleton", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);

		const firstId = await asAdmin.mutation(createFeeSetTemplateRef, {
			name: "First Platform Default",
			isPlatformDefault: true,
			status: "active",
			items: [],
		});
		const secondId = await asAdmin.mutation(createFeeSetTemplateRef, {
			name: "Second Platform Default",
			isPlatformDefault: true,
			status: "active",
			items: [],
		});

		let rows = await asAdmin.query(listFeeSetTemplatesRef, {});
		expect(rows.find((row) => row._id === firstId)).toMatchObject({
			isPlatformDefault: false,
		});
		expect(rows.find((row) => row._id === secondId)).toMatchObject({
			isPlatformDefault: true,
		});

		await asAdmin.mutation(updateFeeSetTemplateRef, {
			id: firstId,
			name: "First Platform Default",
			isPlatformDefault: true,
			status: "active",
		});

		rows = await asAdmin.query(listFeeSetTemplatesRef, {});
		expect(rows.find((row) => row._id === firstId)).toMatchObject({
			isPlatformDefault: true,
		});
		expect(rows.find((row) => row._id === secondId)).toMatchObject({
			isPlatformDefault: false,
		});
	});

	it("repairs an existing named standard fee set into the platform default", async () => {
		const t = createTestConvex();
		const existingId = await t.run(async (ctx) => {
			const now = Date.now();
			return await ctx.db.insert("feeSetTemplates", {
				name: DEFAULT_FEE_SET_NAME,
				description: "Existing standard fee set",
				isPlatformDefault: false,
				status: "active",
				createdAt: now,
				updatedAt: now,
			});
		});

		const defaults = await t.run(async (ctx) => {
			return await ensureDefaultFeeTemplatesAndSet(ctx.db);
		});

		expect(defaults.feeSetId).toBe(existingId);
		const rows = await t.run(async (ctx) => {
			return await ctx.db.query("feeSetTemplates").collect();
		});
		expect(rows.find((row) => row._id === existingId)).toMatchObject({
			isPlatformDefault: true,
			name: DEFAULT_FEE_SET_NAME,
			status: "active",
		});
	});

	it("repairs a legacy named standard fee set missing the platform default flag", async () => {
		const t = createTestConvex();
		const existingId = await t.run(async (ctx) => {
			const now = Date.now();
			return await ctx.db.insert("feeSetTemplates", {
				name: DEFAULT_FEE_SET_NAME,
				description: "Legacy standard fee set without default flag",
				status: "active",
				createdAt: now,
				updatedAt: now,
			});
		});

		const defaults = await t.run(async (ctx) => {
			return await ensureDefaultFeeTemplatesAndSet(ctx.db);
		});

		expect(defaults.feeSetId).toBe(existingId);
		const rows = await t.run(async (ctx) => {
			return await ctx.db.query("feeSetTemplates").collect();
		});
		expect(rows.find((row) => row._id === existingId)).toMatchObject({
			isPlatformDefault: true,
			name: DEFAULT_FEE_SET_NAME,
			status: "active",
		});
	});

	it("backfills legacy fee set default flags for schema rollout", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const [standardId, customId] = await t.run(async (ctx) => {
			const now = Date.now();
			const standardFeeSetId = await ctx.db.insert("feeSetTemplates", {
				name: DEFAULT_FEE_SET_NAME,
				description: "Legacy standard fee set without default flag",
				status: "active",
				createdAt: now,
				updatedAt: now,
			});
			const customFeeSetId = await ctx.db.insert("feeSetTemplates", {
				name: "Custom Fees",
				description: "Legacy custom fee set without default flag",
				status: "active",
				createdAt: now,
				updatedAt: now,
			});
			return [standardFeeSetId, customFeeSetId] as const;
		});

		expect(
			await asAdmin.query(getFeeSetTemplatePlatformDefaultBackfillStatusRef, {})
		).toMatchObject({
			feeSetTemplateCount: 2,
			missingPlatformDefaultFlagCount: 2,
			missingPlatformDefaultFlagIds: expect.arrayContaining([
				standardId,
				customId,
			]),
		});

		await asAdmin.mutation(runFeeSetTemplatePlatformDefaultBackfillRef, {});

		expect(
			await asAdmin.query(getFeeSetTemplatePlatformDefaultBackfillStatusRef, {})
		).toMatchObject({
			feeSetTemplateCount: 2,
			missingPlatformDefaultFlagCount: 0,
		});
		const rows = await t.run(async (ctx) => {
			return await ctx.db.query("feeSetTemplates").collect();
		});
		expect(rows.find((row) => row._id === standardId)).toMatchObject({
			isPlatformDefault: true,
		});
		expect(rows.find((row) => row._id === customId)).toMatchObject({
			isPlatformDefault: false,
		});
	});

	it("repairs duplicate active platform defaults when no standard set exists", async () => {
		const t = createTestConvex();
		const [firstId, secondId] = await t.run(async (ctx) => {
			const now = Date.now();
			const firstDefaultId = await ctx.db.insert("feeSetTemplates", {
				name: "Legacy Platform Default",
				description: "First non-standard platform default",
				isPlatformDefault: true,
				status: "active",
				createdAt: now,
				updatedAt: now,
			});
			const secondDefaultId = await ctx.db.insert("feeSetTemplates", {
				name: "Imported Platform Default",
				description: "Second non-standard platform default",
				isPlatformDefault: true,
				status: "active",
				createdAt: now,
				updatedAt: now,
			});
			return [firstDefaultId, secondDefaultId] as const;
		});

		const defaults = await t.run(async (ctx) => {
			return await ensureDefaultFeeTemplatesAndSet(ctx.db);
		});

		expect([firstId, secondId]).toContain(defaults.feeSetId);
		const activeDefaults = await t.run(async (ctx) => {
			return await ctx.db
				.query("feeSetTemplates")
				.withIndex("by_platform_default_status", (q) =>
					q.eq("isPlatformDefault", true).eq("status", "active")
				)
				.collect();
		});
		expect(activeDefaults).toHaveLength(1);
		expect(activeDefaults[0]._id).toBe(defaults.feeSetId);
	});

	it("snapshots automatically attached platform defaults as platform defaults", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const mortgageId = await seedMortgageDoc(t);

		await t.run(async (ctx) => {
			await attachDefaultFeeSetToMortgage(ctx.db, mortgageId);
		});

		const mortgageFees = await asAdmin.query(listMortgageFeesRef, {
			mortgageId,
		});
		expect(mortgageFees.length).toBeGreaterThan(0);
		expect(
			mortgageFees.every((fee) => fee.defaultApplication === "platform_default")
		).toBe(true);
	});

	it("materializes legacy annual servicing fallback as a mortgage fee snapshot", async () => {
		const t = createTestConvex();
		const mortgageId = await seedMortgageDoc(t);

		const resolved = await t.run(async (ctx) => {
			const mortgage = await ctx.db.get(mortgageId);
			if (!mortgage) {
				throw new Error("Mortgage not found");
			}
			return await resolveServicingFeeConfig(ctx.db, mortgage, "2026-03-01");
		});

		if (!resolved) {
			throw new Error("Expected servicing fee config to be materialized");
		}
		expect(resolved).toMatchObject({
			annualRate: 0.01,
			behavior: "payment_waterfall_deduction",
			code: "servicing",
			displayCode: "servicing",
		});
		expect(resolved.mortgageFeeId).toBeDefined();

		const mortgageFee = await t.run(async (ctx) =>
			resolved.mortgageFeeId ? ctx.db.get(resolved.mortgageFeeId) : null
		);
		expect(mortgageFee).toMatchObject({
			mortgageId,
			code: "servicing",
			behavior: "payment_waterfall_deduction",
			defaultApplication: "platform_default",
			parameters: { annualRate: 0.01 },
			status: "active",
		});
	});

	it("does not recreate platform defaults after a mortgage opts out of the default fee set", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const mortgageId = await seedMortgageDoc(t);

		const defaults = await t.run(async (ctx) => {
			await attachDefaultFeeSetToMortgage(ctx.db, mortgageId);
			return await ensureDefaultFeeTemplatesAndSet(ctx.db);
		});

		await asAdmin.mutation(optOutMortgageFeeSetRef, {
			mortgageId,
			feeSetTemplateId: defaults.feeSetId,
			reason: "Use manually negotiated fee rows",
		});
		await t.run(async (ctx) => {
			await attachDefaultFeeSetToMortgage(ctx.db, mortgageId);
		});

		const mortgageFees = await asAdmin.query(listMortgageFeesRef, {
			mortgageId,
		});
		const activeDefaultRows = mortgageFees.filter(
			(fee) =>
				fee.feeSetTemplateId === defaults.feeSetId && fee.status === "active"
		);
		expect(activeDefaultRows).toHaveLength(0);
	});

	it("does not materialize legacy servicing fallback after default fee set opt-out", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const mortgageId = await seedMortgageDoc(t);

		const defaults = await t.run(async (ctx) => {
			await attachDefaultFeeSetToMortgage(ctx.db, mortgageId);
			return await ensureDefaultFeeTemplatesAndSet(ctx.db);
		});
		await asAdmin.mutation(optOutMortgageFeeSetRef, {
			mortgageId,
			feeSetTemplateId: defaults.feeSetId,
			reason: "Use manually negotiated fee rows",
		});

		const resolved = await t.run(async (ctx) => {
			const mortgage = await ctx.db.get(mortgageId);
			if (!mortgage) {
				throw new Error("Mortgage not found");
			}
			return await resolveWaterfallFeeConfigs(ctx.db, mortgage, "2026-03-01");
		});
		const mortgageFees = await asAdmin.query(listMortgageFeesRef, {
			mortgageId,
		});
		const activeDefaultRows = mortgageFees.filter(
			(fee) =>
				fee.feeSetTemplateId === defaults.feeSetId && fee.status === "active"
		);

		expect(resolved).toEqual([]);
		expect(activeDefaultRows).toHaveLength(0);
	});

	it("attaches a fee set to a mortgage as immutable snapshots", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const mortgageId = await seedMortgageDoc(t);

		const servicingTemplateId = await asAdmin.mutation(createFeeTemplateRef, {
			name: "Servicing",
			code: "servicing",
			behavior: "payment_waterfall_deduction",
			displayCode: "servicing",
			surface: "waterfall_deduction",
			revenueDestination: "platform_revenue",
			calculationType: "annual_rate_principal",
			parameters: { annualRate: 0.0125 },
			status: "active",
		});
		const lateFeeTemplateId = await asAdmin.mutation(createFeeTemplateRef, {
			name: "Late Fee",
			code: "late_fee",
			behavior: "borrower_one_time_charge",
			displayCode: "late_fee",
			surface: "borrower_charge",
			revenueDestination: "platform_revenue",
			calculationType: "fixed_amount_cents",
			parameters: { fixedAmountCents: 6500, dueDays: 30, graceDays: 45 },
			paymentRail: "manual",
			recurrence: "one_time",
			status: "active",
		});
		const feeSetTemplateId = await asAdmin.mutation(createFeeSetTemplateRef, {
			name: "Custom Fee Set",
			isPlatformDefault: false,
			status: "active",
			items: [
				{ feeTemplateId: servicingTemplateId, sortOrder: 10 },
				{ feeTemplateId: lateFeeTemplateId, sortOrder: 20 },
			],
		});

		const attachedIds = await asAdmin.mutation(
			attachFeeSetTemplateToMortgageRef,
			{
				mortgageId,
				feeSetTemplateId,
				effectiveFrom: "2026-01-01",
			}
		);
		expect(attachedIds).toHaveLength(2);

		const mortgageFees = await asAdmin.query(listMortgageFeesRef, {
			mortgageId,
		});
		expect(mortgageFees).toHaveLength(2);
		expect(
			mortgageFees.find((fee) => fee.code === "servicing")?.parameters
				.annualRate
		).toBe(0.0125);
		expect(
			mortgageFees.find((fee) => fee.code === "late_fee")?.parameters
				.fixedAmountCents
		).toBe(6500);
		expect(mortgageFees.find((fee) => fee.code === "late_fee")).toMatchObject({
			behavior: "borrower_one_time_charge",
			displayCode: "late_fee",
			paymentRail: "manual",
			recurrence: "one_time",
			defaultApplication: "mortgage_specific",
		});

		await asAdmin.mutation(updateFeeTemplateRef, {
			id: lateFeeTemplateId,
			name: "Late Fee Updated",
			code: "late_fee",
			behavior: "borrower_recurring_charge",
			displayCode: "updated_late_fee",
			surface: "borrower_charge",
			revenueDestination: "platform_revenue",
			calculationType: "fixed_amount_cents",
			parameters: { fixedAmountCents: 9000, dueDays: 30, graceDays: 45 },
			paymentRail: "wire",
			recurrence: "monthly",
			status: "active",
		});

		const updatedMortgageFees = await asAdmin.query(listMortgageFeesRef, {
			mortgageId,
		});
		expect(
			updatedMortgageFees.find((fee) => fee.code === "late_fee")?.parameters
				.fixedAmountCents
		).toBe(6500);
		expect(
			updatedMortgageFees.find((fee) => fee.code === "late_fee")
		).toMatchObject({
			behavior: "borrower_one_time_charge",
			displayCode: "late_fee",
			paymentRail: "manual",
			recurrence: "one_time",
			defaultApplication: "mortgage_specific",
		});
	});

	it("rejects duplicate fee surface/code items through public fee set attachment", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const mortgageId = await seedMortgageDoc(t);

		const firstTemplateId = await asAdmin.mutation(createFeeTemplateRef, {
			name: "First Servicing",
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
			name: "Second Servicing",
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
			asAdmin.mutation(attachFeeSetTemplateToMortgageRef, {
				mortgageId,
				feeSetTemplateId,
				effectiveFrom: "2026-01-01",
			})
		).rejects.toThrow("Fee set contains duplicate fee surface/code");
	});

	it("rejects missing fee template references through public fee set attachment", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const mortgageId = await seedMortgageDoc(t);

		const feeTemplateId = await asAdmin.mutation(createFeeTemplateRef, {
			name: "Deleted Servicing",
			code: "servicing",
			behavior: "payment_waterfall_deduction",
			displayCode: "servicing_deleted",
			surface: "waterfall_deduction",
			revenueDestination: "platform_revenue",
			calculationType: "annual_rate_principal",
			parameters: { annualRate: 0.01 },
			status: "active",
		});
		const feeSetTemplateId = await asAdmin.mutation(createFeeSetTemplateRef, {
			name: "Missing Template Set",
			isPlatformDefault: false,
			status: "active",
			items: [{ feeTemplateId, sortOrder: 10 }],
		});
		await t.run(async (ctx) => {
			await ctx.db.delete(feeTemplateId);
		});

		await expect(
			asAdmin.mutation(attachFeeSetTemplateToMortgageRef, {
				mortgageId,
				feeSetTemplateId,
				effectiveFrom: "2026-01-01",
			})
		).rejects.toThrow("Fee template not found for fee set item");
	});

	it("rejects overlapping active mortgage fees for the same code and surface", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const mortgageId = await seedMortgageDoc(t);

		const servicingTemplateId = await asAdmin.mutation(createFeeTemplateRef, {
			name: "Servicing",
			code: "servicing",
			behavior: "payment_waterfall_deduction",
			displayCode: "servicing",
			surface: "waterfall_deduction",
			revenueDestination: "platform_revenue",
			calculationType: "annual_rate_principal",
			parameters: { annualRate: 0.01 },
			status: "active",
		});

		await asAdmin.mutation(attachFeeTemplateToMortgageRef, {
			mortgageId,
			feeTemplateId: servicingTemplateId,
			effectiveFrom: "2026-01-01",
		});

		await expect(
			asAdmin.mutation(attachFeeTemplateToMortgageRef, {
				mortgageId,
				feeTemplateId: servicingTemplateId,
				effectiveFrom: "2026-01-15",
			})
		).rejects.toThrow(OVERLAPPING_FEE_PATTERN);
	});
});
