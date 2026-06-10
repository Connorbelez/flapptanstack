# Offline Manual Payment Operations

This document records the implemented v1 contract for the admin offline payment operations workspace described by `docs/superpowers/specs/2026-06-10-offline-manual-payment-operations-prd.md`.

## Route

The admin route is `/admin/offline-payment-operations`.

Read access is gated through the admin route authorization table with `payment:view`. Operational mutations and actions use the payment function builders and require `payment:manage`.

The frontend surface is built from reusable primitives:

- `src/components/admin/shell/AdminKanbanBoard.tsx` is the shared Kanban primitive. The existing admin entity Kanban uses the `crm` variant; offline operations use the denser `operations` variant.
- `src/components/ui/event-manager.tsx` now supports read-only, no-create, and no-filter modes so the offline agenda can reuse the existing calendar/list primitive without exposing event editing.

## Backend API

The public offline operations backend lives in `convex/payments/offlineOperations.ts`.

Read model:

- `getOfflinePaymentOperationsSnapshot`

Actions:

- `startCollection`
- `confirmCollection`
- `confirmGroupedInstallment`

Mutations:

- `assignCollector`
- `addCollectionNote`
- `releaseCollectionAttempt`

The snapshot is the source of truth for Kanban cards, grouped installments, calendar events, counters, and recent confirmed rows. Frontend bucket placement is a projection only; it is not a persisted lifecycle state.

## Buckets

Only offline/manual collection plan entries are included. Provider-managed automatic collection entries are excluded.

Single-obligation plan entries appear on the Kanban. Multi-obligation manual entries appear in the grouped installments table.

Date buckets use weekday-only business-day math:

- `Upcoming`: scheduled in the next 1 to 3 business days.
- `Due`: scheduled today or 1 to 3 business days ago.
- `Overdue`: scheduled 4 to 9 business days ago.
- `Delinquent`: scheduled 10 or more business days ago.

Active manual-review attempts override date buckets:

- `In Progress`: active attempt under 24 hours old.
- `Staff Overdue`: active attempt at least 24 hours old.

`Confirmed` contains recent confirmed single-obligation offline collections. Grouped/workout confirmations remain in the grouped workflow and do not populate the Kanban confirmed lane.

## Settlement Rules

Single-obligation confirmations require the entered amount to exactly equal the remaining collectible amount. Partial, underpaid, and overpaid single-card confirmations are rejected server-side.

Grouped confirmations settle one grouped installment at a time. Allocation order is deterministic:

1. Oldest obligation due date.
2. Lowest payment number.
3. Obligation id.

The grouped path allows the last covered obligation to be partially settled when the installment amount is smaller than the covered outstanding balance.

All confirmations require evidence. Evidence is written to the first-class `offlinePaymentEvidence` table and copied into manual settlement details so the existing transfer contract, cash ledger metadata, and audit lookups stay aligned.

Cash and cheque confirmations use the existing manual-review transfer confirmation path and cash ledger posting path. Instrument details are captured in manual settlement details, including optional reference, cheque, deposit, received date, and staff notes.

## Release And Activity

Assignments and notes are stored in `offlinePaymentActivities`; assignment metadata is also patched onto the plan entry for queue ownership.

Release is intentionally narrow. It validates an active or stale manual-review attempt, cancels the pending attempt and linked transfer through governed transitions, cancels the old executed plan entry, and creates a fresh replacement entry with lineage back to the released entry. It does not mutate an executed entry back to planned.

## Schema Additions

The implementation adds:

- Assignment fields on `collectionPlanEntries`.
- `offlinePaymentEvidence` for immutable confirmation evidence.
- `offlinePaymentActivities` for start, assignment, note, confirmation, and release audit activity.

The collection attempt and transfer machines include pending-state cancellation events used by the validated offline release path.

## Tests

Primary coverage:

- `convex/payments/__tests__/offlineOperations.test.ts`
- `src/test/admin/offline-payment-operations-page.test.tsx`

The backend suite covers offline-only projection, bucket grouping, early start auditing, exact single-obligation confirmation, evidence persistence, grouped deterministic allocation, assignment, note, stale release, replacement lineage, and cancellation transitions.

The frontend suite covers rendering the board/grouped/agenda entry points and confirming a selected single-obligation payment with evidence and instrument metadata.
