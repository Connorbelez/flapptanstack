import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { convex } from "../../fluent";

const INCIDENT = {
	attemptId: "vx7ahzw3p920vedj58j8g2hvth86ywz1" as Id<"collectionAttempts">,
	badExternalScheduleId:
		"hh7wdxv88y4exfbwnbaz22nqas85e933" as Id<"externalCollectionSchedules">,
	correctExternalScheduleId:
		"hh7jm5fhx7npyydzd574bjmdns858atv" as Id<"externalCollectionSchedules">,
	correctProviderOccurrenceKey:
		"pad_rotessa:787678:no-occurrence-ref:no-provider-ref:no-ordinal:2026-06-01",
	listingMortgageId: "r971kve31mjr3pmt6vewb27crn859de1" as Id<"mortgages">,
	otherMortgageId: "r979q4g9t8cb8qay7tc377sv7x85et09" as Id<"mortgages">,
	planEntryId:
		"w1752f437qyw2qn5ws8nwdcsa585952m" as Id<"collectionPlanEntries">,
	transferId: "xx791c4mfvbc94zf1d2n9bam0586y42s" as Id<"transferRequests">,
};

function assertIncidentInvariant(
	condition: boolean,
	message: string
): asserts condition {
	if (!condition) {
		throw new ConvexError(message);
	}
}

export const repairKnownRotessaPlaceholderCollision = convex
	.mutation()
	.input({
		dryRun: v.optional(v.boolean()),
		repairTerminalMirror: v.optional(v.boolean()),
	})
	.handler(async (ctx, args) => {
		const [
			planEntry,
			attempt,
			transfer,
			correctSchedule,
			badSchedule,
			correctScheduleLedgerRows,
			badScheduleLedgerRows,
		] = await Promise.all([
			ctx.db.get(INCIDENT.planEntryId),
			ctx.db.get(INCIDENT.attemptId),
			ctx.db.get(INCIDENT.transferId),
			ctx.db.get(INCIDENT.correctExternalScheduleId),
			ctx.db.get(INCIDENT.badExternalScheduleId),
			ctx.db
				.query("cash_ledger_journal_entries")
				.withIndex("by_transfer_request", (query) =>
					query.eq("transferRequestId", INCIDENT.transferId)
				)
				.collect(),
			ctx.db
				.query("cash_ledger_journal_entries")
				.withIndex("by_transfer_request", (query) =>
					query.eq(
						"transferRequestId",
						"xx7f2ffe4tmkq4bvqd7hked9h188cmms" as Id<"transferRequests">
					)
				)
				.collect(),
		]);

		assertIncidentInvariant(
			planEntry !== null,
			"Incident plan entry not found."
		);
		assertIncidentInvariant(attempt !== null, "Incident attempt not found.");
		assertIncidentInvariant(transfer !== null, "Incident transfer not found.");
		assertIncidentInvariant(
			correctSchedule !== null,
			"Correct external collection schedule not found."
		);
		assertIncidentInvariant(
			badSchedule !== null,
			"Cross-linked external collection schedule not found."
		);

		if (args.repairTerminalMirror) {
			assertIncidentInvariant(
				planEntry.mortgageId === INCIDENT.listingMortgageId &&
					planEntry.externalCollectionScheduleId ===
						INCIDENT.correctExternalScheduleId,
				"Incident plan entry is not linked to the repaired listing mortgage schedule."
			);
			assertIncidentInvariant(
				attempt.planEntryId === INCIDENT.planEntryId &&
					attempt.mortgageId === INCIDENT.listingMortgageId &&
					attempt.transferRequestId === INCIDENT.transferId,
				"Incident attempt no longer matches the repaired plan entry and transfer."
			);
			assertIncidentInvariant(
				transfer.status === "confirmed" &&
					transfer.mortgageId === INCIDENT.listingMortgageId &&
					transfer.planEntryId === INCIDENT.planEntryId &&
					transfer.collectionAttemptId === INCIDENT.attemptId,
				"Incident transfer is not confirmed against the repaired collection graph."
			);
			assertIncidentInvariant(
				correctScheduleLedgerRows.some(
					(row) => row.entryType === "CASH_RECEIVED"
				),
				"Confirmed incident transfer has no CASH_RECEIVED ledger row."
			);

			const reportedAt = transfer.confirmedAt ?? transfer.lastTransitionAt;
			const preview = {
				attempt: {
					id: INCIDENT.attemptId,
					nextProviderLifecycleStatus: "Approved",
					previousProviderLifecycleStatus:
						attempt.providerLifecycleStatus ?? null,
				},
				planEntry: {
					id: INCIDENT.planEntryId,
					nextExternalProviderEventStatus: "Approved",
					previousExternalProviderEventStatus:
						planEntry.externalProviderEventStatus ?? null,
				},
				reportedAt,
			};

			if (args.dryRun) {
				return {
					applied: false,
					preview,
				};
			}

			await ctx.db.patch(INCIDENT.attemptId, {
				providerLastReportedAt: reportedAt,
				providerLastReportedVia: "poller",
				providerLifecycleReason: undefined,
				providerLifecycleStatus: "Approved",
			});
			await ctx.db.patch(INCIDENT.planEntryId, {
				externalLastIngestedVia: "poller",
				externalLastReportedAt: reportedAt,
				externalProviderEventStatus: "Approved",
				externalProviderReason: undefined,
			});

			return {
				applied: true,
				preview,
			};
		}

		assertIncidentInvariant(
			planEntry.mortgageId === INCIDENT.listingMortgageId,
			"Incident plan entry no longer belongs to the expected listing mortgage."
		);
		assertIncidentInvariant(
			planEntry.externalCollectionScheduleId === INCIDENT.badExternalScheduleId,
			"Incident plan entry is not in the expected corrupted schedule state."
		);
		assertIncidentInvariant(
			planEntry.collectionAttemptId === INCIDENT.attemptId,
			"Incident plan entry no longer points at the expected attempt."
		);
		assertIncidentInvariant(
			attempt.planEntryId === INCIDENT.planEntryId &&
				attempt.mortgageId === INCIDENT.listingMortgageId,
			"Incident attempt no longer matches the expected plan entry and mortgage."
		);
		assertIncidentInvariant(
			attempt.transferRequestId === INCIDENT.transferId,
			"Incident attempt no longer points at the expected transfer."
		);
		assertIncidentInvariant(
			transfer.mortgageId === INCIDENT.listingMortgageId &&
				transfer.planEntryId === INCIDENT.planEntryId &&
				transfer.collectionAttemptId === INCIDENT.attemptId,
			"Incident transfer no longer matches the expected mortgage, plan entry, and attempt."
		);
		assertIncidentInvariant(
			transfer.status === "pending",
			"Incident transfer is no longer pending; refusing to rewrite provider metadata."
		);
		assertIncidentInvariant(
			correctSchedule.mortgageId === INCIDENT.listingMortgageId &&
				correctSchedule.externalScheduleRef === "787678",
			"Correct external schedule does not match the listing mortgage/provider ref."
		);
		assertIncidentInvariant(
			badSchedule.mortgageId === INCIDENT.otherMortgageId &&
				badSchedule.externalScheduleRef === "787723",
			"Cross-linked external schedule does not match the expected other mortgage/provider ref."
		);
		assertIncidentInvariant(
			correctScheduleLedgerRows.length === 0 &&
				badScheduleLedgerRows.length === 0,
			"One of the affected pending transfers has ledger postings; refusing metadata-only repair."
		);

		const transferMetadata = {
			...((transfer.metadata ?? {}) as Record<string, unknown>),
		};
		transferMetadata.externalOccurrenceRef = undefined;

		const preview = {
			attempt: {
				id: INCIDENT.attemptId,
				nextProviderOccurrenceKey: INCIDENT.correctProviderOccurrenceKey,
				previousProviderOccurrenceKey: attempt.providerOccurrenceKey ?? null,
			},
			badSchedule: {
				id: INCIDENT.badExternalScheduleId,
				nextStatus: "active",
				previousLastSyncErrorMessage: badSchedule.lastSyncErrorMessage ?? null,
				previousStatus: badSchedule.status,
			},
			correctSchedule: {
				id: INCIDENT.correctExternalScheduleId,
				nextStatus: "active",
				previousLastSyncErrorMessage:
					correctSchedule.lastSyncErrorMessage ?? null,
				previousStatus: correctSchedule.status,
			},
			ledgerRowsTouched: 0,
			planEntry: {
				id: INCIDENT.planEntryId,
				nextExternalCollectionScheduleId: INCIDENT.correctExternalScheduleId,
				nextExternalOccurrenceRef: null,
				previousExternalCollectionScheduleId:
					planEntry.externalCollectionScheduleId ?? null,
				previousExternalOccurrenceRef: planEntry.externalOccurrenceRef ?? null,
			},
			transfer: {
				id: INCIDENT.transferId,
				nextProviderRef: `provider-managed:${INCIDENT.transferId}`,
				previousProviderRef: transfer.providerRef ?? null,
			},
		};

		if (args.dryRun) {
			return {
				applied: false,
				preview,
			};
		}

		await ctx.db.patch(INCIDENT.planEntryId, {
			externalCollectionScheduleId: INCIDENT.correctExternalScheduleId,
			externalOccurrenceOrdinal: undefined,
			externalOccurrenceRef: undefined,
		});
		await ctx.db.patch(INCIDENT.attemptId, {
			providerOccurrenceKey: INCIDENT.correctProviderOccurrenceKey,
		});
		await ctx.db.patch(INCIDENT.transferId, {
			metadata: transferMetadata,
			providerRef: `provider-managed:${INCIDENT.transferId}`,
		});
		await ctx.db.patch(INCIDENT.correctExternalScheduleId, {
			consecutiveSyncFailures: 0,
			lastSyncErrorAt: undefined,
			lastSyncErrorMessage: undefined,
			status: "active",
			syncLeaseExpiresAt: undefined,
			syncLeaseOwner: undefined,
		});
		await ctx.db.patch(INCIDENT.badExternalScheduleId, {
			consecutiveSyncFailures: 0,
			lastSyncErrorAt: undefined,
			lastSyncErrorMessage: undefined,
			status: "active",
			syncLeaseExpiresAt: undefined,
			syncLeaseOwner: undefined,
		});

		return {
			applied: true,
			preview,
		};
	})
	.internal();
