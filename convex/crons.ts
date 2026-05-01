import { cronJobs, makeFunctionReference } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
const providerManagedSchedulePollingRef = makeFunctionReference<
	"action",
	{ asOf?: number; limit?: number },
	Promise<unknown>
>("payments/recurringSchedules/poller:pollProviderManagedSchedules");

const rotessaReadModelSyncRef = makeFunctionReference<
	"action",
	{ trigger: "cron" | "manual" },
	Promise<unknown>
>("admin/origination/collections:runRotessaReadModelSync");
const fsraImportRefreshRef = makeFunctionReference<
	"action",
	{ trigger: "cron" | "manual" },
	Promise<unknown>
>("onboarding/verification/fsraImport:runFsraImportRefresh");
const createRenewalIntentsInWindowRef = makeFunctionReference<
	"action",
	{ asOf?: number; limit?: number },
	Promise<unknown>
>("renewals/internal:createRenewalIntentsInWindow");
const expireLenderRenewalIntentsPastDeadlineRef = makeFunctionReference<
	"action",
	{ asOf?: number; limit?: number },
	Promise<unknown>
>("renewals/internal:expireLenderRenewalIntentsPastDeadline");
const sweepExpiredCheckoutSessionsRef = makeFunctionReference<
	"action",
	{ limit?: number; now?: number },
	Promise<unknown>
>("checkout/actions:sweepExpiredCheckoutSessions");
const ensureSlaReviewsForPendingDealsRef = makeFunctionReference<
	"mutation",
	{ limit?: number; now?: number },
	Promise<unknown>
>("legalRepresentation/sla:ensureSlaReviewsForPendingDeals");
const checkSlaBreachesRef = makeFunctionReference<
	"mutation",
	{ limit?: number; now?: number },
	Promise<unknown>
>("legalRepresentation/sla:checkSlaBreaches");
const runPeriodicRestrictionRechecksRef = makeFunctionReference<
	"mutation",
	{ limit?: number; now?: number },
	Promise<unknown>
>("legalRepresentation/sla:runPeriodicRestrictionRechecks");

// Audit trail crons (outbox processor + retention) are managed by the
// auditTrail component — see convex/components/auditTrail/crons.ts

// Daily reconciliation: verify entity status matches journal entries.
// Discrepancies are logged as P0 errors.
// Runs at 07:00 UTC (one hour after obligation transitions) to avoid
// reading mid-transition data — see Tech Design §7.1.
crons.daily(
	"daily reconciliation check",
	{ hourUTC: 7, minuteUTC: 0 },
	internal.engine.reconciliationAction.dailyReconciliation
);

// Daily obligation lifecycle: BECAME_DUE + GRACE_PERIOD_EXPIRED transitions.
// Runs at 6:00 UTC (1am ET) to advance obligations through their lifecycle.
crons.daily(
	"daily obligation transitions",
	{ hourUTC: 6, minuteUTC: 0 },
	internal.payments.obligations.crons.processObligationTransitions
);

// Portfolio snapshot materialization: captures the just-completed UTC business
// date for lender portfolio history and year-end export seams. The handler is
// replay-safe and skips periods that have already been materialized.
crons.daily(
	"lender portfolio snapshot materialization",
	{ hourUTC: 5, minuteUTC: 45 },
	internal.portfolio.snapshots.materializeCompletedPortfolioSnapshots,
	{}
);

// Collection plan execution spine: discover due planned entries and execute
// them through the canonical page-02 contract. Runs in bounded batches and
// relies on plan-entry consumption plus business-layer idempotency for replay
// safety across cron reruns.
crons.interval(
	"collection plan execution spine",
	{ minutes: 15 },
	internal.payments.collectionPlan.runner.processDuePlanEntries,
	{}
);

// Marketplace checkout expiry: FairLend owns the five-minute inventory TTL.
// Stripe session expiration is a provider cleanup attempt; reservation release
// happens through the checkout runtime and ownership ledger.
crons.interval(
	"marketplace checkout expiry sweep",
	{ minutes: 1 },
	sweepExpiredCheckoutSessionsRef,
	{ limit: 50 }
);

crons.interval(
	"platform lawyer SLA review detector",
	{ minutes: 15 },
	ensureSlaReviewsForPendingDealsRef,
	{ limit: 50 }
);

crons.interval(
	"platform lawyer SLA breach detector",
	{ minutes: 15 },
	checkSlaBreachesRef,
	{ limit: 50 }
);

crons.daily(
	"platform lawyer restriction recheck",
	{ hourUTC: 6, minuteUTC: 30 },
	runPeriodicRestrictionRechecksRef,
	{ limit: 25 }
);

// Provider-managed schedule polling spine: keeps externally managed recurring
// schedules in sync, materializes missed webhooks, and never initiates draws
// itself. This runs alongside the app-owned execution spine and only polls
// schedules that have already been delegated to a provider-managed rail.
crons.interval(
	"provider-managed schedule polling spine",
	{ minutes: 15 },
	providerManagedSchedulePollingRef,
	{}
);

// Rotessa reconciliation sync: imports sandbox customers and recurring schedules
// into canonical read-model tables so origination and admin reconciliation screens
// stay aligned with provider state. Runs four times per day.
crons.interval(
	"rotessa read-model sync",
	{ minutes: 360 },
	rotessaReadModelSyncRef,
	{ trigger: "cron" }
);

// Daily FSRA imported-data refresh: loads staged normalized FSRA source rows and
// keeps the local regulator lookup surface current without live critical-path I/O.
// Runs at 05:30 UTC so fresh data is available before the other morning jobs.
crons.daily(
	"daily fsra imported-data refresh",
	{ hourUTC: 5, minuteUTC: 30 },
	fsraImportRefreshRef,
	{ trigger: "cron" }
);

// Lender renewal-intent window sync: materializes pending renewal intents for
// active mortgages inside the 180-day window. Runs every six hours so the
// lender portal does not depend on a once-per-day rollover to surface intent
// records after a position becomes eligible.
crons.interval(
	"lender renewal intent creation",
	{ minutes: 360 },
	createRenewalIntentsInWindowRef,
	{}
);

// Lender renewal-intent expiry: transitions unsigned pending intents to
// expired after the 60-day deadline passes. Runs every six hours on the same
// cadence as creation so stale actionable intents are retired promptly.
crons.interval(
	"lender renewal intent expiry",
	{ minutes: 360 },
	expireLenderRenewalIntentsPastDeadlineRef,
	{}
);

// Dispersal self-healing: detect settled obligations missing dispersal entries.
// Runs every 15 minutes to catch scheduler.runAfter(0) failures quickly.
// See Tech Design §6.4 and Integration Foot Gun I1.
crons.interval(
	"dispersal self-healing",
	{ minutes: 15 },
	internal.dispersal.selfHealing.dispersalSelfHealingCron
);

// Transfer reconciliation: detect confirmed transfers without journal entries.
// Runs every 15 minutes — highest-risk gap because publishTransferConfirmed
// runs async via scheduler.runAfter(0) and can fail silently.
// See ENG-165 and Tech Design §10.
crons.interval(
	"transfer reconciliation",
	{ minutes: 15 },
	internal.payments.cashLedger.transferReconciliationCron
		.transferReconciliationCron
);

// Deal-lock checkout expiry: void abandoned listing-lock reservations shortly
// after their five-minute checkout window closes. The mutation is bounded and
// idempotent so regular polling is safe across cron reruns.
crons.interval(
	"deal lock checkout expiry",
	{ minutes: 5 },
	internal.dealLocks.mutations.expireStaleCheckoutSessions,
	{}
);

// Cash ledger reconciliation: verify ledger invariants (unapplied cash,
// negative payables, obligation drift, conservation, etc.).
// Runs at 07:15 UTC — 15 minutes after entity reconciliation — to avoid
// overlapping with the 07:00 entity status check.
crons.daily(
	"cash ledger reconciliation",
	{ hourUTC: 7, minuteUTC: 15 },
	internal.payments.cashLedger.reconciliationCron.cashLedgerReconciliation
);

// Lender payout scheduling: evaluates lender frequency thresholds
// and batches payout execution for eligible dispersal entries.
// Runs at 08:00 UTC (after reconciliation completes at 07:15).
// See Tech Design OQ-8 and ENG-182.
crons.daily(
	"lender payout batch",
	{ hourUTC: 8, minuteUTC: 0 },
	internal.payments.payout.batchPayout.processPayoutBatch
);

// Disbursement due alert: surface pending entries past hold period.
// Admin-only trigger in Phase 1 — does NOT auto-execute disbursements.
// Runs at 09:00 UTC (after payout batch at 08:00).
crons.daily(
	"check disbursements due",
	{ hourUTC: 9, minuteUTC: 0 },
	internal.dispersal.disbursementBridge.checkDisbursementsDue
);

export default crons;
