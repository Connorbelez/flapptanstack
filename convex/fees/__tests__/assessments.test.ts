import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import {
	createTestConvex,
	ensureSeededIdentity,
} from "../../../src/test/auth/helpers";
import { FAIRLEND_ADMIN } from "../../../src/test/auth/identities";
import type { Id } from "../../_generated/dataModel";

const createFeeAssessmentRef = makeFunctionReference<
	"mutation",
	{
		mortgageId: Id<"mortgages">;
		mortgageFeeId: Id<"mortgageFees">;
		amountCents: number;
		source: "payment_waterfall";
		effectiveDate: string;
		sourceObligationId?: Id<"obligations">;
		metadata?: Record<string, unknown>;
	},
	Id<"feeAssessments">
>("fees/assessments:createFeeAssessment");

const linkFeeAssessmentLedgerEntryRef = makeFunctionReference<
	"mutation",
	{
		feeAssessmentId: Id<"feeAssessments">;
		status: "assessed" | "invoiced" | "partially_settled" | "settled";
		amountSettledCents?: number;
		obligationId?: Id<"obligations">;
		dispersalEntryId?: Id<"dispersalEntries">;
		servicingFeeEntryId?: Id<"servicingFeeEntries">;
		cashLedgerJournalEntryId?: Id<"cash_ledger_journal_entries">;
	},
	Id<"feeAssessments">
>("fees/assessments:linkFeeAssessmentLedgerEntry");

const getFeeRevenueSummaryRef = makeFunctionReference<
	"query",
	Record<string, never>,
	{
		totalIncomeCents: number;
		waterfallIncomeCents: number;
		borrowerChargeIncomeCents: number;
		openAccountsReceivableCents: number;
		byType: Array<{
			behavior: string;
			displayCode: string;
			incomeCents: number;
			volume: number;
		}>;
	}
>("fees/queries:getFeeRevenueSummary");

const getAdminFeeManagementSnapshotRef = makeFunctionReference<
	"query",
	Record<string, never>,
	{
		revenue: {
			totalIncomeCents: number;
			openAccountsReceivableCents: number;
		};
	}
>("fees/queries:getAdminFeeManagementSnapshot");

async function seedMortgageFee(
	t: ReturnType<typeof createTestConvex>,
	options: {
		effectiveFrom?: string;
		effectiveTo?: string;
		status?: "active" | "inactive";
	} = {}
) {
	return await t.run(async (ctx) => {
		const now = Date.now();
		const unique = `${now}_${Math.random().toString(36).slice(2)}`;
		const orgId = `org_fee_assessments_${unique}`;
		const brokerUserId = await ctx.db.insert("users", {
			authId: `fee-assessment-broker-${unique}`,
			email: `fee-assessment-broker-${unique}@test.com`,
			firstName: "Fee",
			lastName: "Assessment",
		});
		const brokerId = await ctx.db.insert("brokers", {
			userId: brokerUserId,
			status: "active",
			createdAt: now,
		});
		const propertyId = await ctx.db.insert("properties", {
			streetAddress: `100 Assessment Way ${unique}`,
			city: "Toronto",
			province: "ON",
			postalCode: "M5V1A1",
			propertyType: "residential",
			createdAt: now,
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			orgId,
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
		const feeTemplateId = await ctx.db.insert("feeTemplates", {
			name: "Assessment Servicing",
			code: "servicing",
			behavior: "payment_waterfall_deduction",
			displayCode: "servicing",
			surface: "waterfall_deduction",
			revenueDestination: "platform_revenue",
			calculationType: "annual_rate_principal",
			parameters: { annualRate: 0.0125 },
			status: "active",
			createdAt: now,
			updatedAt: now,
		});
		const feeSetTemplateId = await ctx.db.insert("feeSetTemplates", {
			name: "Assessment Fee Set",
			isPlatformDefault: false,
			status: "active",
			createdAt: now,
			updatedAt: now,
		});
		const mortgageFeeId = await ctx.db.insert("mortgageFees", {
			mortgageId,
			feeTemplateId,
			feeSetTemplateId,
			code: "servicing",
			behavior: "payment_waterfall_deduction",
			displayCode: "servicing",
			surface: "waterfall_deduction",
			revenueDestination: "platform_revenue",
			calculationType: "annual_rate_principal",
			parameters: { annualRate: 0.0125 },
			defaultApplication: "platform_default",
			effectiveFrom: options.effectiveFrom ?? "2026-01-01",
			effectiveTo: options.effectiveTo,
			status: options.status ?? "active",
			createdAt: now,
		});

		return {
			mortgageId,
			mortgageFeeId,
			feeTemplateId,
			feeSetTemplateId,
			orgId,
		};
	});
}

async function seedCashLedgerJournalEntry(
	t: ReturnType<typeof createTestConvex>,
	mortgageId: Id<"mortgages">,
	options: {
		amountCents?: number;
		entryType?: "SERVICING_FEE_RECOGNIZED" | "CASH_RECEIVED";
		obligationId?: Id<"obligations">;
	} = {}
) {
	return await t.run(async (ctx) => {
		const now = Date.now();
		const unique = `${now}_${Math.random().toString(36).slice(2)}`;
		const debitAccountId = await ctx.db.insert("cash_ledger_accounts", {
			family: "CONTROL",
			mortgageId,
			subaccount: "ALLOCATION",
			cumulativeDebits: BigInt(0),
			cumulativeCredits: BigInt(0),
			createdAt: now,
		});
		const creditAccountId = await ctx.db.insert("cash_ledger_accounts", {
			family: "SERVICING_REVENUE",
			mortgageId,
			cumulativeDebits: BigInt(0),
			cumulativeCredits: BigInt(0),
			createdAt: now,
		});
		return await ctx.db.insert("cash_ledger_journal_entries", {
			sequenceNumber: BigInt(1),
			entryType: options.entryType ?? "SERVICING_FEE_RECOGNIZED",
			mortgageId,
			obligationId: options.obligationId,
			effectiveDate: "2026-02-01",
			timestamp: now,
			debitAccountId,
			creditAccountId,
			amount: BigInt(options.amountCents ?? 1250),
			idempotencyKey: `cash-ledger:test-fee-assessment:${unique}`,
			source: { channel: "scheduler" },
		});
	});
}

async function seedObligation(
	t: ReturnType<typeof createTestConvex>,
	mortgageId: Id<"mortgages">
) {
	return await t.run(async (ctx) => {
		const now = Date.now();
		const unique = `${now}_${Math.random().toString(36).slice(2)}`;
		const borrowerUserId = await ctx.db.insert("users", {
			authId: `fee-assessment-borrower-${unique}`,
			email: `fee-assessment-borrower-${unique}@test.com`,
			firstName: "Fee",
			lastName: "Borrower",
		});
		const borrowerId = await ctx.db.insert("borrowers", {
			status: "active",
			userId: borrowerUserId,
			createdAt: now,
		});
		return await ctx.db.insert("obligations", {
			status: "upcoming",
			lastTransitionAt: now,
			mortgageId,
			borrowerId,
			paymentNumber: 1,
			type: "regular_interest",
			amount: 100_000,
			amountSettled: 0,
			dueDate: now,
			gracePeriodEnd: now + 86_400_000,
			createdAt: now,
		});
	});
}

async function seedServicingFeeEntry(
	t: ReturnType<typeof createTestConvex>,
	args: {
		mortgageId: Id<"mortgages">;
		obligationId: Id<"obligations">;
		mortgageFeeId: Id<"mortgageFees">;
	}
) {
	return await t.run(async (ctx) => {
		const now = Date.now();
		return await ctx.db.insert("servicingFeeEntries", {
			mortgageId: args.mortgageId,
			obligationId: args.obligationId,
			amount: 1250,
			feeDue: 1250,
			feeCashApplied: 1250,
			feeReceivable: 0,
			policyVersion: 1,
			mortgageFeeId: args.mortgageFeeId,
			feeCode: "servicing",
			annualRate: 0.0125,
			principalBalance: 10_000_000,
			date: "2026-02-01",
			createdAt: now,
		});
	});
}

async function createAssessment(
	t: ReturnType<typeof createTestConvex>,
	args: {
		mortgageId: Id<"mortgages">;
		mortgageFeeId: Id<"mortgageFees">;
		amountCents?: number;
		sourceObligationId?: Id<"obligations">;
	}
) {
	return await t.mutation(createFeeAssessmentRef, {
		mortgageId: args.mortgageId,
		mortgageFeeId: args.mortgageFeeId,
		amountCents: args.amountCents ?? 1250,
		source: "payment_waterfall",
		effectiveDate: "2026-02-01",
		sourceObligationId: args.sourceObligationId,
	});
}

describe("fee assessments", () => {
	it("creates an assessed fee trace root", async () => {
		const t = createTestConvex();
		const {
			mortgageId,
			mortgageFeeId,
			feeTemplateId,
			feeSetTemplateId,
			orgId,
		} = await seedMortgageFee(t);

		const assessmentId = await t.mutation(createFeeAssessmentRef, {
			mortgageId,
			mortgageFeeId,
			amountCents: 1250,
			source: "payment_waterfall",
			effectiveDate: "2026-02-01",
			metadata: { postingGroupId: "allocation:test" },
		});

		const assessment = await t.run(async (ctx) => {
			return await ctx.db.get(assessmentId);
		});

		expect(assessment).toMatchObject({
			orgId,
			mortgageId,
			mortgageFeeId,
			feeTemplateId,
			feeSetTemplateId,
			behavior: "payment_waterfall_deduction",
			code: "servicing",
			displayCode: "servicing",
			amountCents: 1250,
			amountSettledCents: 0,
			source: "payment_waterfall",
			status: "assessed",
			effectiveDate: "2026-02-01",
			metadata: { postingGroupId: "allocation:test" },
		});

		const auditEntries = await t.run(async (ctx) => {
			return await ctx.db.query("auditJournal").collect();
		});
		expect(auditEntries).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					entityId: String(assessmentId),
					entityType: "feeAssessment",
					eventType: "ASSESS",
					newState: "assessed",
					outcome: "transitioned",
				}),
			])
		);
	});

	it("rejects assessments against inactive mortgage fees", async () => {
		const t = createTestConvex();
		const { mortgageId, mortgageFeeId } = await seedMortgageFee(t, {
			status: "inactive",
		});

		await expect(
			t.mutation(createFeeAssessmentRef, {
				mortgageId,
				mortgageFeeId,
				amountCents: 1250,
				source: "payment_waterfall",
				effectiveDate: "2026-02-01",
			})
		).rejects.toThrow("Mortgage fee is not active");
	});

	it("rejects assessments outside the mortgage fee effective window", async () => {
		const t = createTestConvex();
		const { mortgageId, mortgageFeeId } = await seedMortgageFee(t, {
			effectiveFrom: "2026-03-01",
			effectiveTo: "2026-03-31",
		});

		await expect(
			t.mutation(createFeeAssessmentRef, {
				mortgageId,
				mortgageFeeId,
				amountCents: 1250,
				source: "payment_waterfall",
				effectiveDate: "2026-02-01",
			})
		).rejects.toThrow("not effective on 2026-02-01");

		await expect(
			t.mutation(createFeeAssessmentRef, {
				mortgageId,
				mortgageFeeId,
				amountCents: 1250,
				source: "payment_waterfall",
				effectiveDate: "2026-04-01",
			})
		).rejects.toThrow("not effective on 2026-04-01");
	});

	it("rejects invalid assessment amounts", async () => {
		const t = createTestConvex();
		const { mortgageId, mortgageFeeId } = await seedMortgageFee(t);

		await expect(
			t.mutation(createFeeAssessmentRef, {
				mortgageId,
				mortgageFeeId,
				amountCents: 0,
				source: "payment_waterfall",
				effectiveDate: "2026-02-01",
			})
		).rejects.toThrow("amountCents must be a positive safe integer");
		await expect(
			t.mutation(createFeeAssessmentRef, {
				mortgageId,
				mortgageFeeId,
				amountCents: -1,
				source: "payment_waterfall",
				effectiveDate: "2026-02-01",
			})
		).rejects.toThrow("amountCents must be a positive safe integer");
		await expect(
			t.mutation(createFeeAssessmentRef, {
				mortgageId,
				mortgageFeeId,
				amountCents: 12.5,
				source: "payment_waterfall",
				effectiveDate: "2026-02-01",
			})
		).rejects.toThrow("amountCents must be a positive safe integer");
	});

	it("rejects source obligations from another mortgage", async () => {
		const t = createTestConvex();
		const { mortgageId, mortgageFeeId } = await seedMortgageFee(t);
		const { mortgageId: otherMortgageId } = await seedMortgageFee(t);
		const otherObligationId = await seedObligation(t, otherMortgageId);

		await expect(
			t.mutation(createFeeAssessmentRef, {
				mortgageId,
				mortgageFeeId,
				amountCents: 1250,
				source: "payment_waterfall",
				effectiveDate: "2026-02-01",
				sourceObligationId: otherObligationId,
			})
		).rejects.toThrow("does not belong to mortgage");
	});

	it("links an assessment to a ledger journal entry when settled", async () => {
		const t = createTestConvex();
		const { mortgageId, mortgageFeeId } = await seedMortgageFee(t);
		const assessmentId = await createAssessment(t, {
			mortgageId,
			mortgageFeeId,
		});
		const cashLedgerJournalEntryId = await seedCashLedgerJournalEntry(
			t,
			mortgageId
		);

		const linkedId = await t.mutation(linkFeeAssessmentLedgerEntryRef, {
			feeAssessmentId: assessmentId,
			status: "settled",
			amountSettledCents: 1250,
			cashLedgerJournalEntryId,
		});

		const assessment = await t.run(async (ctx) => {
			return await ctx.db.get(assessmentId);
		});

		expect(linkedId).toBe(assessmentId);
		expect(assessment).toMatchObject({
			cashLedgerJournalEntryId,
			amountSettledCents: 1250,
			status: "settled",
		});

		const auditEntries = await t.run(async (ctx) => {
			return await ctx.db.query("auditJournal").collect();
		});
		expect(auditEntries).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					entityId: String(assessmentId),
					entityType: "feeAssessment",
					eventType: "SETTLE",
					newState: "settled",
					outcome: "transitioned",
				}),
			])
		);
	});

	it("rejects invalid settlement amounts", async () => {
		const t = createTestConvex();
		const { mortgageId, mortgageFeeId } = await seedMortgageFee(t);
		const assessmentId = await createAssessment(t, {
			mortgageId,
			mortgageFeeId,
		});
		const cashLedgerJournalEntryId = await seedCashLedgerJournalEntry(
			t,
			mortgageId
		);

		await expect(
			t.mutation(linkFeeAssessmentLedgerEntryRef, {
				feeAssessmentId: assessmentId,
				status: "settled",
				amountSettledCents: -1,
				cashLedgerJournalEntryId,
			})
		).rejects.toThrow("amountSettledCents must be a non-negative safe integer");
		await expect(
			t.mutation(linkFeeAssessmentLedgerEntryRef, {
				feeAssessmentId: assessmentId,
				status: "settled",
				amountSettledCents: 1251,
				cashLedgerJournalEntryId,
			})
		).rejects.toThrow("amountSettledCents cannot exceed amountCents");
		await expect(
			t.mutation(linkFeeAssessmentLedgerEntryRef, {
				feeAssessmentId: assessmentId,
				status: "settled",
				amountSettledCents: 12.5,
				cashLedgerJournalEntryId,
			})
		).rejects.toThrow("amountSettledCents must be a non-negative safe integer");
	});

	it("rejects settling without a ledger journal entry", async () => {
		const t = createTestConvex();
		const { mortgageId, mortgageFeeId } = await seedMortgageFee(t);
		const assessmentId = await createAssessment(t, {
			mortgageId,
			mortgageFeeId,
		});

		await expect(
			t.mutation(linkFeeAssessmentLedgerEntryRef, {
				feeAssessmentId: assessmentId,
				status: "settled",
				amountSettledCents: 1250,
			})
		).rejects.toThrow(
			"Settled fee assessments must link to a cash ledger journal entry"
		);
	});

	it("rejects cross-mortgage ledger journal entry links", async () => {
		const t = createTestConvex();
		const { mortgageId, mortgageFeeId } = await seedMortgageFee(t);
		const { mortgageId: otherMortgageId } = await seedMortgageFee(t);
		const assessmentId = await createAssessment(t, {
			mortgageId,
			mortgageFeeId,
		});
		const cashLedgerJournalEntryId = await seedCashLedgerJournalEntry(
			t,
			otherMortgageId
		);

		await expect(
			t.mutation(linkFeeAssessmentLedgerEntryRef, {
				feeAssessmentId: assessmentId,
				status: "settled",
				amountSettledCents: 1250,
				cashLedgerJournalEntryId,
			})
		).rejects.toThrow("does not belong to mortgage");
	});

	it("rejects ledger amount mismatches", async () => {
		const t = createTestConvex();
		const { mortgageId, mortgageFeeId } = await seedMortgageFee(t);
		const assessmentId = await createAssessment(t, {
			mortgageId,
			mortgageFeeId,
		});
		const cashLedgerJournalEntryId = await seedCashLedgerJournalEntry(
			t,
			mortgageId,
			{ amountCents: 1000 }
		);

		await expect(
			t.mutation(linkFeeAssessmentLedgerEntryRef, {
				feeAssessmentId: assessmentId,
				status: "settled",
				amountSettledCents: 1250,
				cashLedgerJournalEntryId,
			})
		).rejects.toThrow(
			"Cash ledger journal entry amount must match amountSettledCents"
		);
	});

	it("rejects status regressions after settlement", async () => {
		const t = createTestConvex();
		const { mortgageId, mortgageFeeId } = await seedMortgageFee(t);
		const assessmentId = await createAssessment(t, {
			mortgageId,
			mortgageFeeId,
		});
		const cashLedgerJournalEntryId = await seedCashLedgerJournalEntry(
			t,
			mortgageId
		);

		await t.mutation(linkFeeAssessmentLedgerEntryRef, {
			feeAssessmentId: assessmentId,
			status: "settled",
			amountSettledCents: 1250,
			cashLedgerJournalEntryId,
		});

		await expect(
			t.mutation(linkFeeAssessmentLedgerEntryRef, {
				feeAssessmentId: assessmentId,
				status: "assessed",
				amountSettledCents: 1250,
				cashLedgerJournalEntryId,
			})
		).rejects.toThrow("Invalid fee assessment status transition");
	});

	it("rejects settlement ledger entries that do not match an existing obligation link", async () => {
		const t = createTestConvex();
		const { mortgageId, mortgageFeeId } = await seedMortgageFee(t);
		const obligationId = await seedObligation(t, mortgageId);
		const otherObligationId = await seedObligation(t, mortgageId);
		const assessmentId = await createAssessment(t, {
			mortgageId,
			mortgageFeeId,
		});
		await t.mutation(linkFeeAssessmentLedgerEntryRef, {
			feeAssessmentId: assessmentId,
			status: "invoiced",
			obligationId,
		});
		const cashLedgerJournalEntryId = await seedCashLedgerJournalEntry(
			t,
			mortgageId,
			{ obligationId: otherObligationId }
		);

		await expect(
			t.mutation(linkFeeAssessmentLedgerEntryRef, {
				feeAssessmentId: assessmentId,
				status: "settled",
				amountSettledCents: 1250,
				cashLedgerJournalEntryId,
			})
		).rejects.toThrow("does not match the linked obligation");
	});

	it("rejects servicing fee entries that cross the linked obligation in the same call", async () => {
		const t = createTestConvex();
		const { mortgageId, mortgageFeeId } = await seedMortgageFee(t);
		const obligationId = await seedObligation(t, mortgageId);
		const otherObligationId = await seedObligation(t, mortgageId);
		const servicingFeeEntryId = await seedServicingFeeEntry(t, {
			mortgageId,
			mortgageFeeId,
			obligationId: otherObligationId,
		});
		const assessmentId = await createAssessment(t, {
			mortgageId,
			mortgageFeeId,
		});

		await expect(
			t.mutation(linkFeeAssessmentLedgerEntryRef, {
				feeAssessmentId: assessmentId,
				status: "invoiced",
				obligationId,
				servicingFeeEntryId,
			})
		).rejects.toThrow("does not match the linked obligation");
	});

	it("allows idempotent relinks but rejects replacing existing trace links", async () => {
		const t = createTestConvex();
		const { mortgageId, mortgageFeeId } = await seedMortgageFee(t);
		const assessmentId = await createAssessment(t, {
			mortgageId,
			mortgageFeeId,
		});
		const cashLedgerJournalEntryId = await seedCashLedgerJournalEntry(
			t,
			mortgageId
		);
		const replacementJournalEntryId = await seedCashLedgerJournalEntry(
			t,
			mortgageId
		);

		await t.mutation(linkFeeAssessmentLedgerEntryRef, {
			feeAssessmentId: assessmentId,
			status: "settled",
			amountSettledCents: 1250,
			cashLedgerJournalEntryId,
		});
		await t.mutation(linkFeeAssessmentLedgerEntryRef, {
			feeAssessmentId: assessmentId,
			status: "settled",
			amountSettledCents: 1250,
			cashLedgerJournalEntryId,
		});

		await expect(
			t.mutation(linkFeeAssessmentLedgerEntryRef, {
				feeAssessmentId: assessmentId,
				status: "settled",
				amountSettledCents: 1250,
				cashLedgerJournalEntryId: replacementJournalEntryId,
			})
		).rejects.toThrow("cashLedgerJournalEntryId is immutable once linked");
	});

	it("excludes reversed assessments from fee income summaries", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);
		const asAdmin = t.withIdentity(FAIRLEND_ADMIN);
		const { mortgageId, mortgageFeeId, orgId } = await seedMortgageFee(t);
		await t.run(async (ctx) => {
			const now = Date.now();
			await ctx.db.insert("feeAssessments", {
				orgId,
				mortgageId,
				mortgageFeeId,
				behavior: "payment_waterfall_deduction",
				code: "servicing",
				displayCode: "servicing",
				amountCents: 1250,
				amountSettledCents: 1250,
				source: "payment_waterfall",
				status: "settled",
				assessedAt: now,
				effectiveDate: "2026-02-01",
				createdAt: now,
				updatedAt: now,
			});
			await ctx.db.insert("feeAssessments", {
				orgId,
				mortgageId,
				mortgageFeeId,
				behavior: "payment_waterfall_deduction",
				code: "servicing",
				displayCode: "servicing",
				amountCents: 750,
				amountSettledCents: 750,
				source: "payment_waterfall",
				status: "reversed",
				assessedAt: now + 1,
				effectiveDate: "2026-02-01",
				createdAt: now,
				updatedAt: now,
			});
		});

		const summary = await asAdmin.query(getFeeRevenueSummaryRef, {});
		const snapshot = await asAdmin.query(getAdminFeeManagementSnapshotRef, {});

		expect(summary.totalIncomeCents).toBe(1250);
		expect(summary.waterfallIncomeCents).toBe(1250);
		expect(summary.byType).toEqual([
			expect.objectContaining({
				displayCode: "servicing",
				incomeCents: 1250,
				volume: 1,
			}),
		]);
		expect(snapshot.revenue.totalIncomeCents).toBe(1250);
	});
});
