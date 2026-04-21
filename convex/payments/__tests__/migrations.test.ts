import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import {
	createTestConvex,
	ensureSeededIdentity,
} from "../../../src/test/auth/helpers";
import { FAIRLEND_ADMIN } from "../../../src/test/auth/identities";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

const previewMalformedMortgageCleanupRef = makeFunctionReference<
	"query",
	Record<string, never>,
	Promise<{
		candidateCount: number;
		candidates: Array<{
			counts: {
				collectionAttempts: number;
				collectionPlanEntries: number;
				listings: number;
				settledObligationsMissingReceivableAndDispersal: number;
				transferRequests: number;
			};
			legacyFields: {
				borrowerId: unknown;
				brokerId: unknown;
				name: unknown;
			};
			mortgageId: Id<"mortgages">;
			orgId: string;
			settledObligationIdsMissingReceivableAndDispersal: Id<"obligations">[];
		}>;
		frozenCohortMortgageCount: number;
	}>
>("payments/migrations:previewMalformedMortgageCleanup");

const runMalformedMortgageCleanupRef = makeFunctionReference<
	"mutation",
	Record<string, never>,
	Promise<unknown>
>("payments/migrations:runMalformedMortgageCleanup");

type Harness = ReturnType<typeof createHarness>;

function createHarness() {
	const t = createTestConvex();
	return t;
}

async function seedMortgageFixture(
	t: Harness,
	args: {
		addListing?: boolean;
		includeCleanupGraphRows?: boolean;
		orgId: string;
		suffix: string;
	}
) {
	return t.run(async (ctx) => {
		const now = Date.now();
		const brokerUserId = await ctx.db.insert("users", {
			authId: `auth-broker-${args.suffix}`,
			email: `broker-${args.suffix}@fairlend.test`,
			firstName: "Broker",
			lastName: args.suffix,
		});
		const borrowerUserId = await ctx.db.insert("users", {
			authId: `auth-borrower-${args.suffix}`,
			email: `borrower-${args.suffix}@fairlend.test`,
			firstName: "Borrower",
			lastName: args.suffix,
		});
		const brokerId = await ctx.db.insert("brokers", {
			userId: brokerUserId,
			status: "active",
			orgId: args.orgId,
			createdAt: now,
		});
		const borrowerId = await ctx.db.insert("borrowers", {
			userId: borrowerUserId,
			status: "active",
			orgId: args.orgId,
			createdAt: now,
		});
		const propertyId = await ctx.db.insert("properties", {
			streetAddress: `${args.suffix} Test Street`,
			city: "Toronto",
			province: "ON",
			postalCode: "M5V1E2",
			propertyType: "residential",
			createdAt: now,
		});

		const mortgageRecord = {
			orgId: args.orgId,
			status: "active",
			propertyId,
			principal: 50_000_000,
			interestRate: 0.08,
			rateType: "fixed" as const,
			termMonths: 12,
			amortizationMonths: 300,
			paymentAmount: 500_000,
			paymentFrequency: "monthly" as const,
			loanType: "conventional" as const,
			lienPosition: 1,
			interestAdjustmentDate: "2026-01-01",
			termStartDate: "2026-01-01",
			maturityDate: "2027-01-01",
			firstPaymentDate: "2026-02-01",
			brokerOfRecordId: brokerId,
			createdAt: now,
		};
		const mortgageId = await ctx.db.insert("mortgages", mortgageRecord);
		const obligationId = await ctx.db.insert("obligations", {
			orgId: args.orgId,
			status: "settled",
			mortgageId,
			borrowerId,
			paymentNumber: 1,
			type: "regular_interest",
			amount: 500_000,
			amountSettled: 500_000,
			dueDate: now - 86_400_000,
			gracePeriodEnd: now - 43_200_000,
			settledAt: now - 60_000,
			createdAt: now - 86_400_000,
		});

		const createdIds: {
			auditJournalId?: Id<"auditJournal">;
			cashLedgerAccountIds: Id<"cash_ledger_accounts">[];
			cashLedgerJournalEntryId?: Id<"cash_ledger_journal_entries">;
			dispersalCalculationRunId?: Id<"dispersalCalculationRuns">;
			dispersalHealingAttemptId?: Id<"dispersalHealingAttempts">;
			ledgerAccountId?: Id<"ledger_accounts">;
			listingId?: Id<"listings">;
			transferHealingAttemptId?: Id<"transferHealingAttempts">;
			transferRequestId?: Id<"transferRequests">;
			webhookEventId?: Id<"webhookEvents">;
		} = {
			cashLedgerAccountIds: [],
		};

		if (args.includeCleanupGraphRows) {
			const suspenseAccountId = await ctx.db.insert("cash_ledger_accounts", {
				family: "SUSPENSE",
				mortgageId,
				obligationId,
				cumulativeDebits: 0n,
				cumulativeCredits: 0n,
				createdAt: now,
			});
			const trustCashAccountId = await ctx.db.insert("cash_ledger_accounts", {
				family: "TRUST_CASH",
				mortgageId,
				cumulativeDebits: 0n,
				cumulativeCredits: 0n,
				createdAt: now,
			});
			const transferRequestId = await ctx.db.insert("transferRequests", {
				orgId: args.orgId,
				status: "failed",
				direction: "inbound",
				transferType: "borrower_interest_collection",
				amount: 500_000,
				currency: "CAD",
				counterpartyType: "borrower",
				counterpartyId: `${borrowerId}`,
				providerCode: "pad_rotessa",
				idempotencyKey: `migration-test-transfer:${args.suffix}`,
				source: {
					actorId: "migration-test",
					actorType: "system",
					channel: "scheduler",
				},
				createdAt: now,
				lastTransitionAt: now,
				mortgageId,
				obligationId,
				borrowerId,
				failureReason: "malformed graph",
			});
			const cashLedgerJournalEntryId = await ctx.db.insert(
				"cash_ledger_journal_entries",
				{
					sequenceNumber: 1n,
					entryType: "CORRECTION",
					mortgageId,
					obligationId,
					transferRequestId,
					effectiveDate: "2026-01-01",
					timestamp: now,
					debitAccountId: suspenseAccountId,
					creditAccountId: trustCashAccountId,
					amount: 5_000_00n,
					idempotencyKey: `migration-test-cash-entry:${args.suffix}`,
					source: {
						actorId: "migration-test",
						actorType: "system",
						channel: "scheduler",
					},
				}
			);
			const auditJournalId = await ctx.db.insert("auditJournal", {
				organizationId: args.orgId,
				entityType: "obligation",
				entityId: `${obligationId}`,
				effectiveDate: "2026-01-01",
				eventCategory: "migration_test",
				eventId: `migration-test-event:${args.suffix}`,
				eventType: "MIGRATION_TEST",
				originSystem: "test",
				previousState: "settled",
				newState: "settled",
				outcome: "transitioned",
				sequenceNumber: 1n,
				actorId: "migration-test",
				channel: "scheduler",
				timestamp: now,
				mortgageId: `${mortgageId}`,
				obligationId: `${obligationId}`,
				transferRequestId: `${transferRequestId}`,
			});
			const dispersalCalculationRunId = await ctx.db.insert(
				"dispersalCalculationRuns",
				{
					orgId: args.orgId,
					mortgageId,
					obligationId,
					idempotencyKey: `migration-test-calculation:${args.suffix}`,
					settledAmount: 500_000,
					settledDate: "2026-01-01",
					paymentMethod: "manual",
					payoutEligibleAfter: "2026-01-02",
					calculationVersion: "test",
					inputs: {},
					outputs: {},
					source: {
						actorType: "system",
						channel: "scheduler",
					},
					createdAt: now,
				}
			);
			const transferHealingAttemptId = await ctx.db.insert(
				"transferHealingAttempts",
				{
					transferRequestId,
					attemptCount: 1,
					lastAttemptAt: now,
					status: "retrying",
					createdAt: now,
				}
			);
			const dispersalHealingAttemptId = await ctx.db.insert(
				"dispersalHealingAttempts",
				{
					obligationId,
					attemptCount: 1,
					lastAttemptAt: now,
					status: "retrying",
					createdAt: now,
				}
			);
			const servicingFeeEntryId = await ctx.db.insert("servicingFeeEntries", {
				mortgageId,
				obligationId,
				calculationRunId: dispersalCalculationRunId,
				amount: 5000,
				annualRate: 0.01,
				principalBalance: 50_000_000,
				date: "2026-01-01",
				createdAt: now,
			});
			const ledgerAccountId = await ctx.db.insert("ledger_accounts", {
				type: "TREASURY",
				mortgageId: `${mortgageId}`,
				cumulativeDebits: 0n,
				cumulativeCredits: 0n,
				createdAt: now,
			});
			const webhookEventId = await ctx.db.insert("webhookEvents", {
				provider: "pad_rotessa",
				providerEventId: `migration-test-webhook:${args.suffix}`,
				rawBody: "{}",
				status: "failed",
				receivedAt: now,
				attempts: 1,
				transferRequestId,
			});

			createdIds.auditJournalId = auditJournalId;
			createdIds.cashLedgerAccountIds = [suspenseAccountId, trustCashAccountId];
			createdIds.cashLedgerJournalEntryId = cashLedgerJournalEntryId;
			createdIds.dispersalCalculationRunId = dispersalCalculationRunId;
			createdIds.dispersalHealingAttemptId = dispersalHealingAttemptId;
			createdIds.ledgerAccountId = ledgerAccountId;
			createdIds.transferHealingAttemptId = transferHealingAttemptId;
			createdIds.transferRequestId = transferRequestId;
			createdIds.webhookEventId = webhookEventId;

			void servicingFeeEntryId;
		}

		if (args.addListing) {
			createdIds.listingId = await ctx.db.insert("listings", {
				mortgageId,
				propertyId,
				dataSource: "mortgage_pipeline",
				status: "published",
				principal: 50_000_000,
				interestRate: 0.08,
				ltvRatio: 0.65,
				termMonths: 12,
				maturityDate: "2027-01-01",
				monthlyPayment: 500_000,
				rateType: "fixed",
				paymentFrequency: "monthly",
				loanType: "conventional",
				lienPosition: 1,
				propertyType: "residential",
				marketplacePropertyType: "Detached Home",
				city: "Toronto",
				province: "ON",
				heroImages: [],
				featured: false,
				publicDocumentIds: [],
				viewCount: 0,
				publishedAt: now,
				createdAt: now,
				updatedAt: now,
			});
		}

		return {
			auditJournalId: createdIds.auditJournalId,
			borrowerId,
			cashLedgerAccountIds: createdIds.cashLedgerAccountIds,
			cashLedgerJournalEntryId: createdIds.cashLedgerJournalEntryId,
			dispersalCalculationRunId: createdIds.dispersalCalculationRunId,
			dispersalHealingAttemptId: createdIds.dispersalHealingAttemptId,
			ledgerAccountId: createdIds.ledgerAccountId,
			listingId: createdIds.listingId,
			mortgageId,
			obligationId,
			propertyId,
			transferHealingAttemptId: createdIds.transferHealingAttemptId,
			transferRequestId: createdIds.transferRequestId,
			webhookEventId: createdIds.webhookEventId,
		};
	});
}

describe("payments malformed mortgage cleanup migration", () => {
	it("previews and deletes only malformed frozen-cohort mortgage graphs", async () => {
		const t = createHarness();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);

		const malformed = await seedMortgageFixture(t, {
			orgId: "org_seed_north_harbor_mortgage_group",
			suffix: "malformed",
			includeCleanupGraphRows: true,
		});
		const blockedByListing = await seedMortgageFixture(t, {
			orgId: "org_01KKKKGXEBW1MA5NFEZVHZS7WG",
			suffix: "blocked-listing",
			addListing: true,
		});
		const outsideFrozenCohort = await seedMortgageFixture(t, {
			orgId: "org_outside_cleanup_scope",
			suffix: "outside-scope",
			includeCleanupGraphRows: true,
		});

		const preview = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(previewMalformedMortgageCleanupRef, {});

		expect(preview.frozenCohortMortgageCount).toBe(2);
		expect(preview.candidateCount).toBe(1);
		expect(preview.candidates.map((candidate) => candidate.mortgageId)).toEqual(
			[malformed.mortgageId]
		);
		expect(
			preview.candidates[0]?.settledObligationIdsMissingReceivableAndDispersal
		).toEqual([malformed.obligationId]);
		expect(preview.candidates[0]?.counts.collectionPlanEntries).toBe(0);
		expect(preview.candidates[0]?.counts.collectionAttempts).toBe(0);
		expect(preview.candidates[0]?.counts.transferRequests).toBe(1);
		expect(
			preview.candidates[0]?.counts
				.settledObligationsMissingReceivableAndDispersal
		).toBe(1);
		expect(preview.candidates[0]?.legacyFields).toEqual({
			name: null,
			borrowerId: null,
			brokerId: null,
		});

		await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(runMalformedMortgageCleanupRef, {});

		const previewAfter = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(previewMalformedMortgageCleanupRef, {});
		expect(previewAfter.candidateCount).toBe(0);

		await t.run(async (ctx) => {
			expect(await ctx.db.get(malformed.mortgageId)).toBeNull();
			expect(await ctx.db.get(malformed.obligationId)).toBeNull();
			expect(
				malformed.transferRequestId
					? await ctx.db.get(malformed.transferRequestId)
					: null
			).toBeNull();
			expect(
				malformed.dispersalCalculationRunId
					? await ctx.db.get(malformed.dispersalCalculationRunId)
					: null
			).toBeNull();
			expect(
				malformed.cashLedgerJournalEntryId
					? await ctx.db.get(malformed.cashLedgerJournalEntryId)
					: null
			).toBeNull();
			for (const cashLedgerAccountId of malformed.cashLedgerAccountIds) {
				expect(await ctx.db.get(cashLedgerAccountId)).toBeNull();
			}
			expect(
				malformed.auditJournalId
					? await ctx.db.get(malformed.auditJournalId)
					: null
			).toBeNull();
			expect(
				malformed.webhookEventId
					? await ctx.db.get(malformed.webhookEventId)
					: null
			).toBeNull();
			expect(
				malformed.transferHealingAttemptId
					? await ctx.db.get(malformed.transferHealingAttemptId)
					: null
			).toBeNull();
			expect(
				malformed.dispersalHealingAttemptId
					? await ctx.db.get(malformed.dispersalHealingAttemptId)
					: null
			).toBeNull();
			expect(
				malformed.ledgerAccountId
					? await ctx.db.get(malformed.ledgerAccountId)
					: null
			).toBeNull();

			expect(await ctx.db.get(blockedByListing.mortgageId)).not.toBeNull();
			expect(
				blockedByListing.listingId
					? await ctx.db.get(blockedByListing.listingId)
					: null
			).not.toBeNull();
			expect(await ctx.db.get(outsideFrozenCohort.mortgageId)).not.toBeNull();
			expect(await ctx.db.get(outsideFrozenCohort.obligationId)).not.toBeNull();
		});

		const remainingHealingCandidates = await t.query(
			internal.dispersal.selfHealing.findSettledWithoutDispersals,
			{}
		);
		expect(
			remainingHealingCandidates.some(
				(candidate) => candidate.obligationId === malformed.obligationId
			)
		).toBe(false);
	});
});
