import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "../_generated/api";
import type { DataModel, Doc, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { adminMutation, adminQuery } from "../fluent";
import { findCashAccount } from "./cashLedger/accounts";

const migrations = new Migrations<DataModel>(components.migrations);
const FROZEN_MALFORMED_MORTGAGE_COHORT_ORG_IDS = new Set([
	"org_seed_north_harbor_mortgage_group",
	"org_01KKKKGXEBW1MA5NFEZVHZS7WG",
]);
const CLEANUP_BATCH_SIZE = 100;

const migrationRefs = internal as unknown as {
	payments: {
		migrations: {
			deleteMalformedMortgageCohorts: never;
		};
	};
};

type ReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

interface CleanupGraph {
	auditJournalEntries: Doc<"auditJournal">[];
	cashLedgerAccounts: Doc<"cash_ledger_accounts">[];
	cashLedgerJournalEntries: Doc<"cash_ledger_journal_entries">[];
	collectionAttempts: Doc<"collectionAttempts">[];
	collectionPlanEntries: Doc<"collectionPlanEntries">[];
	deals: Doc<"deals">[];
	dispersalCalculationRuns: Doc<"dispersalCalculationRuns">[];
	dispersalEntries: Doc<"dispersalEntries">[];
	dispersalHealingAttempts: Doc<"dispersalHealingAttempts">[];
	externalCollectionSchedules: Doc<"externalCollectionSchedules">[];
	ledgerAccounts: Doc<"ledger_accounts">[];
	ledgerJournalEntries: Doc<"ledger_journal_entries">[];
	listings: Doc<"listings">[];
	mortgage: Doc<"mortgages">;
	mortgageBorrowers: Doc<"mortgageBorrowers">[];
	obligations: Doc<"obligations">[];
	servicingFeeEntries: Doc<"servicingFeeEntries">[];
	settledObligationsMissingReceivableAndDispersal: Doc<"obligations">[];
	transferHealingAttempts: Doc<"transferHealingAttempts">[];
	transferRequests: Doc<"transferRequests">[];
	webhookEvents: Doc<"webhookEvents">[];
}

interface CleanupPreviewCandidate {
	counts: {
		auditJournalEntries: number;
		cashLedgerAccounts: number;
		cashLedgerJournalEntries: number;
		collectionAttempts: number;
		collectionPlanEntries: number;
		deals: number;
		dispersalCalculationRuns: number;
		dispersalEntries: number;
		dispersalHealingAttempts: number;
		externalCollectionSchedules: number;
		ledgerAccounts: number;
		ledgerJournalEntries: number;
		listings: number;
		mortgageBorrowers: number;
		obligations: number;
		servicingFeeEntries: number;
		settledObligationsMissingReceivableAndDispersal: number;
		transferHealingAttempts: number;
		transferRequests: number;
		webhookEvents: number;
	};
	legacyFields: {
		borrowerId: unknown;
		brokerId: unknown;
		name: unknown;
	};
	mortgageId: Id<"mortgages">;
	orgId: string;
	settledObligationIdsMissingReceivableAndDispersal: Id<"obligations">[];
}

function uniqueRows<Name extends TableNames>(rows: Doc<Name>[]) {
	const byId = new Map<string, Doc<Name>>();
	for (const row of rows) {
		byId.set(`${row._id}`, row);
	}
	return [...byId.values()];
}

async function deleteByIds<Name extends TableNames>(
	ctx: MutationCtx,
	ids: Id<Name>[]
) {
	for (const id of ids) {
		await ctx.db.delete(id);
	}
}

function getLegacyMortgageFields(mortgage: Doc<"mortgages">) {
	const rawMortgage = mortgage as Record<string, unknown>;
	return {
		name: rawMortgage.name,
		borrowerId: rawMortgage.borrowerId,
		brokerId: rawMortgage.brokerId,
	};
}

function hasMalformedLegacyMortgageShape(mortgage: Doc<"mortgages">) {
	const legacyFields = getLegacyMortgageFields(mortgage);
	return (
		legacyFields.name == null &&
		legacyFields.borrowerId == null &&
		legacyFields.brokerId == null
	);
}

async function loadMortgageCleanupGraph(
	ctx: ReaderCtx,
	mortgage: Doc<"mortgages">
): Promise<CleanupGraph> {
	const [
		obligations,
		collectionPlanEntries,
		collectionAttempts,
		externalCollectionSchedules,
		transferRequests,
		dispersalEntries,
		servicingFeeEntries,
		dispersalCalculationRuns,
		cashLedgerAccountsByMortgage,
		cashLedgerJournalEntriesByMortgage,
		auditJournalEntriesByMortgage,
		ledgerAccounts,
		ledgerJournalEntries,
		mortgageBorrowers,
		listings,
		deals,
	] = await Promise.all([
		ctx.db
			.query("obligations")
			.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgage._id))
			.collect(),
		ctx.db
			.query("collectionPlanEntries")
			.withIndex("by_mortgage_status_scheduled", (query) =>
				query.eq("mortgageId", mortgage._id)
			)
			.collect(),
		ctx.db
			.query("collectionAttempts")
			.withIndex("by_mortgage_status", (query) =>
				query.eq("mortgageId", mortgage._id)
			)
			.collect(),
		ctx.db
			.query("externalCollectionSchedules")
			.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgage._id))
			.collect(),
		ctx.db
			.query("transferRequests")
			.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgage._id))
			.collect(),
		ctx.db
			.query("dispersalEntries")
			.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgage._id))
			.collect(),
		ctx.db
			.query("servicingFeeEntries")
			.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgage._id))
			.collect(),
		ctx.db
			.query("dispersalCalculationRuns")
			.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgage._id))
			.collect(),
		ctx.db
			.query("cash_ledger_accounts")
			.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgage._id))
			.collect(),
		ctx.db
			.query("cash_ledger_journal_entries")
			.withIndex("by_mortgage_and_sequence", (query) =>
				query.eq("mortgageId", mortgage._id)
			)
			.collect(),
		ctx.db
			.query("auditJournal")
			.withIndex("by_mortgage", (query) =>
				query.eq("mortgageId", `${mortgage._id}`)
			)
			.collect(),
		ctx.db
			.query("ledger_accounts")
			.withIndex("by_mortgage", (query) =>
				query.eq("mortgageId", `${mortgage._id}`)
			)
			.collect(),
		ctx.db
			.query("ledger_journal_entries")
			.withIndex("by_mortgage_and_time", (query) =>
				query.eq("mortgageId", `${mortgage._id}`)
			)
			.collect(),
		ctx.db
			.query("mortgageBorrowers")
			.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgage._id))
			.collect(),
		ctx.db
			.query("listings")
			.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgage._id))
			.collect(),
		ctx.db
			.query("deals")
			.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgage._id))
			.collect(),
	]);

	const obligationLinkedRows = await Promise.all(
		obligations.map(async (obligation) => {
			const [
				cashLedgerAccounts,
				cashLedgerJournalEntries,
				auditJournalEntries,
			] = await Promise.all([
				ctx.db
					.query("cash_ledger_accounts")
					.withIndex("by_obligation", (query) =>
						query.eq("obligationId", obligation._id)
					)
					.collect(),
				ctx.db
					.query("cash_ledger_journal_entries")
					.withIndex("by_obligation_and_sequence", (query) =>
						query.eq("obligationId", obligation._id)
					)
					.collect(),
				ctx.db
					.query("auditJournal")
					.withIndex("by_obligation", (query) =>
						query.eq("obligationId", `${obligation._id}`)
					)
					.collect(),
			]);

			const dispersalHealingAttempt = await ctx.db
				.query("dispersalHealingAttempts")
				.withIndex("by_obligation", (query) =>
					query.eq("obligationId", obligation._id)
				)
				.first();

			return {
				auditJournalEntries,
				cashLedgerAccounts,
				cashLedgerJournalEntries,
				dispersalHealingAttempt,
			};
		})
	);

	const transferLinkedRows = await Promise.all(
		transferRequests.map(async (transferRequest) => {
			const [cashLedgerJournalEntries, auditJournalEntries, webhookEvents] =
				await Promise.all([
					ctx.db
						.query("cash_ledger_journal_entries")
						.withIndex("by_transfer_request", (query) =>
							query.eq("transferRequestId", transferRequest._id)
						)
						.collect(),
					ctx.db
						.query("auditJournal")
						.withIndex("by_transfer_request", (query) =>
							query.eq("transferRequestId", `${transferRequest._id}`)
						)
						.collect(),
					ctx.db
						.query("webhookEvents")
						.withIndex("by_transfer_request", (query) =>
							query.eq("transferRequestId", transferRequest._id)
						)
						.collect(),
				]);

			const transferHealingAttempt = await ctx.db
				.query("transferHealingAttempts")
				.withIndex("by_transfer_request", (query) =>
					query.eq("transferRequestId", transferRequest._id)
				)
				.first();

			return {
				auditJournalEntries,
				cashLedgerJournalEntries,
				transferHealingAttempt,
				webhookEvents,
			};
		})
	);

	const settledObligationsMissingReceivableAndDispersal: Doc<"obligations">[] =
		[];
	for (const obligation of obligations) {
		if (obligation.status !== "settled") {
			continue;
		}

		const [receivableAccount, dispersalEntry] = await Promise.all([
			findCashAccount(ctx.db, {
				family: "BORROWER_RECEIVABLE",
				mortgageId: mortgage._id,
				obligationId: obligation._id,
			}),
			ctx.db
				.query("dispersalEntries")
				.withIndex("by_obligation", (query) =>
					query.eq("obligationId", obligation._id)
				)
				.first(),
		]);

		if (!(receivableAccount || dispersalEntry)) {
			settledObligationsMissingReceivableAndDispersal.push(obligation);
		}
	}

	return {
		mortgage,
		obligations,
		collectionPlanEntries,
		collectionAttempts,
		externalCollectionSchedules,
		transferRequests,
		dispersalEntries,
		servicingFeeEntries,
		dispersalCalculationRuns,
		cashLedgerAccounts: uniqueRows<"cash_ledger_accounts">([
			...cashLedgerAccountsByMortgage,
			...obligationLinkedRows.flatMap((row) => row.cashLedgerAccounts),
		]),
		cashLedgerJournalEntries: uniqueRows<"cash_ledger_journal_entries">([
			...cashLedgerJournalEntriesByMortgage,
			...obligationLinkedRows.flatMap((row) => row.cashLedgerJournalEntries),
			...transferLinkedRows.flatMap((row) => row.cashLedgerJournalEntries),
		]),
		auditJournalEntries: uniqueRows<"auditJournal">([
			...auditJournalEntriesByMortgage,
			...obligationLinkedRows.flatMap((row) => row.auditJournalEntries),
			...transferLinkedRows.flatMap((row) => row.auditJournalEntries),
		]),
		ledgerAccounts,
		ledgerJournalEntries,
		mortgageBorrowers,
		listings,
		deals,
		dispersalHealingAttempts: uniqueRows<"dispersalHealingAttempts">(
			obligationLinkedRows
				.map((row) => row.dispersalHealingAttempt)
				.filter((row): row is Doc<"dispersalHealingAttempts"> => row !== null)
		),
		transferHealingAttempts: uniqueRows<"transferHealingAttempts">(
			transferLinkedRows
				.map((row) => row.transferHealingAttempt)
				.filter((row): row is Doc<"transferHealingAttempts"> => row !== null)
		),
		webhookEvents: uniqueRows<"webhookEvents">(
			transferLinkedRows.flatMap((row) => row.webhookEvents)
		),
		settledObligationsMissingReceivableAndDispersal,
	};
}

function isMalformedMortgageCleanupCandidate(graph: CleanupGraph) {
	return (
		graph.mortgage.orgId !== undefined &&
		FROZEN_MALFORMED_MORTGAGE_COHORT_ORG_IDS.has(graph.mortgage.orgId) &&
		hasMalformedLegacyMortgageShape(graph.mortgage) &&
		graph.collectionPlanEntries.length === 0 &&
		graph.collectionAttempts.length === 0 &&
		graph.mortgageBorrowers.length === 0 &&
		graph.settledObligationsMissingReceivableAndDispersal.length > 0 &&
		graph.listings.length === 0 &&
		graph.deals.length === 0 &&
		graph.ledgerJournalEntries.length === 0
	);
}

function toCleanupPreviewCandidate(
	graph: CleanupGraph
): CleanupPreviewCandidate | null {
	if (!(isMalformedMortgageCleanupCandidate(graph) && graph.mortgage.orgId)) {
		return null;
	}

	return {
		mortgageId: graph.mortgage._id,
		orgId: graph.mortgage.orgId,
		legacyFields: {
			name: getLegacyMortgageFields(graph.mortgage).name ?? null,
			borrowerId: getLegacyMortgageFields(graph.mortgage).borrowerId ?? null,
			brokerId: getLegacyMortgageFields(graph.mortgage).brokerId ?? null,
		},
		settledObligationIdsMissingReceivableAndDispersal:
			graph.settledObligationsMissingReceivableAndDispersal.map(
				(obligation) => obligation._id
			),
		counts: {
			obligations: graph.obligations.length,
			collectionPlanEntries: graph.collectionPlanEntries.length,
			collectionAttempts: graph.collectionAttempts.length,
			transferRequests: graph.transferRequests.length,
			cashLedgerAccounts: graph.cashLedgerAccounts.length,
			cashLedgerJournalEntries: graph.cashLedgerJournalEntries.length,
			auditJournalEntries: graph.auditJournalEntries.length,
			servicingFeeEntries: graph.servicingFeeEntries.length,
			dispersalCalculationRuns: graph.dispersalCalculationRuns.length,
			dispersalEntries: graph.dispersalEntries.length,
			ledgerAccounts: graph.ledgerAccounts.length,
			ledgerJournalEntries: graph.ledgerJournalEntries.length,
			mortgageBorrowers: graph.mortgageBorrowers.length,
			externalCollectionSchedules: graph.externalCollectionSchedules.length,
			listings: graph.listings.length,
			deals: graph.deals.length,
			dispersalHealingAttempts: graph.dispersalHealingAttempts.length,
			transferHealingAttempts: graph.transferHealingAttempts.length,
			webhookEvents: graph.webhookEvents.length,
			settledObligationsMissingReceivableAndDispersal:
				graph.settledObligationsMissingReceivableAndDispersal.length,
		},
	};
}

async function listFrozenCohortMortgages(ctx: ReaderCtx) {
	const cohorts = await Promise.all(
		[...FROZEN_MALFORMED_MORTGAGE_COHORT_ORG_IDS].map((orgId) =>
			ctx.db
				.query("mortgages")
				.withIndex("by_org", (query) => query.eq("orgId", orgId))
				.collect()
		)
	);

	return cohorts
		.flat()
		.sort((left, right) => `${left._id}`.localeCompare(`${right._id}`));
}

export const previewMalformedMortgageCleanup = adminQuery
	.input({})
	.handler(async (ctx) => {
		const mortgages = await listFrozenCohortMortgages(ctx);
		const candidates = (
			await Promise.all(
				mortgages.map(async (mortgage) =>
					toCleanupPreviewCandidate(
						await loadMortgageCleanupGraph(ctx, mortgage)
					)
				)
			)
		).filter(
			(candidate): candidate is CleanupPreviewCandidate => candidate !== null
		);

		return {
			candidateCount: candidates.length,
			candidates,
			frozenCohortMortgageCount: mortgages.length,
		};
	})
	.public();

export const deleteMalformedMortgageCohorts = migrations.define({
	table: "mortgages",
	migrateOne: async (ctx, mortgage) => {
		if (
			!(
				mortgage.orgId &&
				FROZEN_MALFORMED_MORTGAGE_COHORT_ORG_IDS.has(mortgage.orgId) &&
				hasMalformedLegacyMortgageShape(mortgage)
			)
		) {
			return;
		}

		const graph = await loadMortgageCleanupGraph(ctx, mortgage);
		if (!isMalformedMortgageCleanupCandidate(graph)) {
			return;
		}

		await deleteByIds(
			ctx,
			graph.dispersalHealingAttempts.map((row) => row._id)
		);
		await deleteByIds(
			ctx,
			graph.transferHealingAttempts.map((row) => row._id)
		);
		await deleteByIds(
			ctx,
			graph.webhookEvents.map((row) => row._id)
		);
		await deleteByIds(
			ctx,
			graph.cashLedgerJournalEntries.map((row) => row._id)
		);
		await deleteByIds(
			ctx,
			graph.auditJournalEntries.map((row) => row._id)
		);
		await deleteByIds(
			ctx,
			graph.dispersalCalculationRuns.map((row) => row._id)
		);
		await deleteByIds(
			ctx,
			graph.dispersalEntries.map((row) => row._id)
		);
		await deleteByIds(
			ctx,
			graph.servicingFeeEntries.map((row) => row._id)
		);
		await deleteByIds(
			ctx,
			graph.transferRequests.map((row) => row._id)
		);
		await deleteByIds(
			ctx,
			graph.collectionAttempts.map((row) => row._id)
		);
		await deleteByIds(
			ctx,
			graph.collectionPlanEntries.map((row) => row._id)
		);
		await deleteByIds(
			ctx,
			graph.externalCollectionSchedules.map((row) => row._id)
		);
		await deleteByIds(
			ctx,
			graph.cashLedgerAccounts.map((row) => row._id)
		);
		await deleteByIds(
			ctx,
			graph.ledgerAccounts.map((row) => row._id)
		);
		await deleteByIds(
			ctx,
			graph.mortgageBorrowers.map((row) => row._id)
		);
		await deleteByIds(
			ctx,
			graph.obligations.map((row) => row._id)
		);
		await ctx.db.delete(graph.mortgage._id);
	},
});

export const runMalformedMortgageCleanup = adminMutation
	.input({})
	.handler(async (ctx) =>
		migrations.runOne(
			ctx,
			migrationRefs.payments.migrations.deleteMalformedMortgageCohorts,
			{
				batchSize: CLEANUP_BATCH_SIZE,
			}
		)
	)
	.public();
