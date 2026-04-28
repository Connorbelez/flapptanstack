# Payment Operations Receivable Drift Eligibility Design

## Context

Admin-seeded mock mortgages create future payment obligations through the normal origination payment bootstrap path. Future obligations are valid schedule records with `status: "upcoming"`, but they do not yet represent accrued borrower receivables.

The cash ledger model creates `BORROWER_RECEIVABLE` when an obligation is accrued, not when a future schedule row is created. Existing documentation and reconciliation code already reflect this: obligations that are still `upcoming` are excluded from orphaned-accrual checks because they have not yet been accrued.

The payment operations dashboard currently computes `hasJournalDrift` for every obligation by comparing:

- projected outstanding balance: `obligation.amount - obligation.amountSettled`
- journal outstanding balance: the current `BORROWER_RECEIVABLE` ledger balance, defaulting to `0` when no account exists

For upcoming obligations, this creates a false positive: projected outstanding is positive, journal outstanding is `0`, and the table displays `journal drift` even though the ledger is behaving as designed.

## Goals

- Remove false `journal drift` exceptions for future `upcoming` obligations.
- Standardize the rule for when an obligation is expected to have an accrued receivable.
- Keep payment operations, reconciliation checks, and future validation surfaces aligned.
- Preserve the current ledger lifecycle: receivables are created on accrual, not on schedule creation.
- Add focused tests that cover the lifecycle boundary.

## Non-Goals

- Do not change admin settings seeding behavior.
- Do not eagerly accrue future obligations.
- Do not change obligation generation, collection plan generation, or cash ledger posting semantics.
- Do not add a broader reconciliation suite unless a separate premature-accrual check is later requested.
- Do not rename existing obligation statuses.

## Recommended Approach

Create a small shared backend helper in the payment obligation domain, for example:

`convex/payments/obligations/accrualEligibility.ts`

The helper should expose the canonical accrual-required status set and one or two intention-revealing predicates:

```ts
export const OBLIGATION_STATUSES_REQUIRING_ACCRUAL = new Set([
	"due",
	"overdue",
	"partially_settled",
	"settled",
	"waived",
] as const);

export function obligationRequiresReceivableAccrual(status: ObligationStatus) {
	return OBLIGATION_STATUSES_REQUIRING_ACCRUAL.has(status);
}

export function obligationIsReceivableDriftEligible(
	obligation: Pick<Doc<"obligations">, "status">
) {
	return obligationRequiresReceivableAccrual(obligation.status);
}
```

The current `obligations.status` schema field is a string because it is governed by the transition engine, so the helper should define an explicit local union for the statuses it understands instead of weakening callers with `any`. Unknown statuses should be treated as not requiring accrual until they are deliberately added to the helper and tests. The module should use domain language around receivable accrual rather than UI language around badges.

## Data Flow

The payment operations dashboard should continue to load obligations and ledger account balances as it does today.

For each obligation row:

1. Compute `projectedOutstandingBalance`.
2. Compute `journalOutstandingBalance` from `BORROWER_RECEIVABLE`, defaulting to `0` when no account exists.
3. Ask the shared helper whether the obligation is drift-eligible.
4. Set `hasJournalDrift` only when the obligation is drift-eligible and the projected balance differs from the journal balance.

This preserves useful dashboard data while making exception severity lifecycle-aware.

## Behavior

- `upcoming` obligations remain visible with `status: "upcoming"`.
- `upcoming` obligations do not show `journal drift` solely because no `BORROWER_RECEIVABLE` account exists.
- `due`, `overdue`, `partially_settled`, `settled`, and `waived` obligations remain receivable-drift eligible.
- Once an obligation is receivable-drift eligible, drift means projected outstanding balance differs from `BORROWER_RECEIVABLE` balance.
- If an `upcoming` obligation has unexpected receivable ledger activity, the normal `journal drift` badge should still not fire by default. That is a different integrity condition: premature accrual or unexpected ledger activity. It can be added later as a separate reconciliation check with its own label and remediation semantics.

## Integration Points

### Payment Operations Dashboard Query

Update `convex/payments/adminDashboard/queries.ts`.

Current behavior:

```ts
hasJournalDrift: projectedOutstandingBalance !== journalOutstandingBalance
```

Desired behavior:

```ts
hasJournalDrift:
	obligationIsReceivableDriftEligible(obligation) &&
	projectedOutstandingBalance !== journalOutstandingBalance
```

No frontend status-badge logic needs to change. The UI already renders the badge from `row.hasJournalDrift`.

### Reconciliation Suite

Update `convex/payments/cashLedger/reconciliationSuite.ts` to use the shared accrual-required status set or helper instead of maintaining a local status list for orphaned obligations.

This keeps the dashboard drift eligibility rule and orphaned-accrual rule tied to the same domain source of truth.

### Tests

Update `convex/payments/adminDashboard/__tests__/queries.test.ts` and add or adjust helper-level tests.

Required cases:

- Future/upcoming obligation with no `BORROWER_RECEIVABLE` account returns `hasJournalDrift === false`.
- Due obligation with matching `BORROWER_RECEIVABLE` balance returns `hasJournalDrift === false`.
- Due obligation with mismatched `BORROWER_RECEIVABLE` balance returns `hasJournalDrift === true`.
- Orphaned-obligation reconciliation continues to exclude `upcoming` obligations.
- The shared helper has a table-style test covering every currently supported accrual-relevant status and `upcoming`.

## Documentation

Add a short code comment near the helper explaining the lifecycle rule:

`BORROWER_RECEIVABLE` is expected after accrual. Future `upcoming` obligations are scheduled but not accrued, so missing receivable balance is not drift.

No product-facing UI copy change is required.

## Risks And Mitigations

- Risk: Hiding a genuine issue on an `upcoming` obligation that already has ledger activity.
  Mitigation: Treat premature receivable activity as a separate future reconciliation check instead of overloading the existing drift badge.

- Risk: Future statuses are added without updating eligibility.
  Mitigation: Unknown statuses are not drift-eligible by default, and table tests for known statuses keep the expected lifecycle boundary visible.

- Risk: Dashboard and reconciliation semantics drift again.
  Mitigation: Make reconciliation import the shared helper or status set instead of maintaining a private copy.

## Success Criteria

- Seeded mock mortgages no longer show `journal drift` for normal future `upcoming` obligations.
- Due or overdue obligations with actual receivable drift still show `journal drift`.
- Reconciliation orphaned-accrual logic and payment-operations drift eligibility use the same source of truth.
- Unit tests cover the status boundary and dashboard behavior.
- `bun check`, `bun typecheck`, and `bunx convex codegen` pass after implementation.
