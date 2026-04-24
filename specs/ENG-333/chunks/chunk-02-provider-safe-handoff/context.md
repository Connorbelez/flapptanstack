# Chunk Context: chunk-02-provider-safe-handoff

## Goal
- Deliver the provider-safe orchestration path: create or reuse Rotessa artifacts before live mortgage creation, then finalize the mortgage plus provider-managed collection links in one database transaction.

## Relevant plan excerpts
- "`activateMortgageAggregate` currently inserts an active mortgage immediately ... reusing it unchanged would violate the no-live-mortgage-on-provider-failure invariant."
- "`beginRecurringScheduleActivation` requires a mortgage ID and plan-entry IDs, while the Velocity invariant forbids exposing a live mortgage before provider success."
- "Because external provider calls cannot be rolled back transactionally with Convex database writes, activation attempts need durable idempotency keys and explicit compensation/remediation records."

## Implementation notes
- Provider failure must call a failure mutation that marks the attempt failed, opens `activation_exception`, patches workspace to `activation_failed_remediation`, and leaves no `mortgages` row for the Velocity workflow key.
- Provider success should pass provider refs into a finalization mutation that calls `activateMortgageAggregate` and links `externalCollectionSchedules` to the created plan entries in the same Convex mutation.
- Retry should reuse attempt refs if `rotessaCustomerRef` or `rotessaScheduleRef` already exist.
- `bootstrapOriginationPayments` can remain the source of obligations/plan entries after provider success; do not expose live mortgage before provider success.

## Existing code touchpoints
- `convex/mortgages/activateMortgageAggregate.ts`: canonical mortgage/listing/ledger/audit assembly.
- `convex/payments/origination/bootstrap.ts`: deterministic obligation and collection plan bootstrap.
- `convex/payments/recurringSchedules/activation.ts`: existing provider-managed schedule record and commit primitives.
- `convex/payments/recurringSchedules/providers/rotessaRecurring.ts`: Rotessa recurring schedule provider.
- `convex/payments/rotessa/client.ts`: Rotessa customer/schedule API client used by admin origination.
- GitNexus: `bootstrapOriginationPayments` LOW upstream impact; `beginRecurringScheduleActivation` LOW upstream impact.

## Validation
- Targeted activation tests prove provider failure creates no mortgage.
- Targeted activation tests prove successful activation creates mortgage, obligations, listing, provider schedule link, workspace activation link, and attempt success metadata.
- Targeted activation tests prove retry reuses stored provider refs.
