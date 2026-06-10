# Offline Manual Payment Operations PRD

## Problem Statement

Backoffice staff need a dedicated workspace for offline and manual mortgage payment collections. The current payment operations surface exposes the underlying rails, but it does not productize the staff workflow for cash and cheque collection. Staff need to know which offline obligations are coming due, which ones require action today, which active collection attempts have gone stale, and which payments were confirmed recently.

The sharp operational risk is that an admin can currently confirm a manual collection through a generic journal-like wrapper instead of a first-class cash or cheque collection action. That hides the actual instrument staff collected, makes evidence handling feel bolted on, and risks bypassing the governed transition path that creates audit trail entries and posts to the cash ledger.

The new screen must make offline collection work clear without inventing new lifecycle states. The visual buckets should be projections for staff organization, while every operational move must advance the real collection attempt, transfer, obligation, and ledger state machines through the existing governed transition pattern.

## Solution

Create a separate admin route for offline payment operations. The screen will show only offline/manual collection candidates and will combine three operational views backed by the same backend read model:

- A Kanban board for single-obligation plan entries.
- A grouped expandable table for manual plan entries that cover multiple obligations, including workout plan installments.
- A multi-timeframe calendar and agenda for upcoming and past offline obligations, with the same operational actions available from event details.

The Kanban columns are:

- Upcoming
- Due
- In Progress
- Staff Overdue
- Overdue
- Delinquent
- Confirmed

Upcoming, Due, Overdue, and Delinquent are derived from the plan entry scheduled date using the existing weekday-only business-day helper for v1. In Progress and Staff Overdue are derived from active manual-review collection attempts and transfer age. Confirmed shows recently confirmed single-obligation offline collections, paginated to the most recent 10 by default and scoped to active filters.

Staff can begin collection, assign or reassign collectors, upload evidence, confirm cash or cheque collection, add notes, and release stale attempts. All actions must call backend mutations/actions that drive the underlying governed transitions and payment rails. Nothing important can be frontend-only.

## User Stories

1. As a payment operations staff member, I want a dedicated offline payment operations screen, so that manual cash and cheque collection work is not mixed into the broader payment operations dashboard.
2. As a payment operations staff member, I want to see only offline/manual collection candidates, so that automatic provider-managed obligations do not pollute my daily collection workflow.
3. As a payment operations staff member, I want a Kanban board of single-obligation collections, so that each card maps cleanly to one obligation I can collect and confirm.
4. As a payment operations staff member, I want Upcoming collections to show obligations scheduled in the next three business days, so that I can prepare for near-term manual collection work.
5. As a payment operations staff member, I want Due collections to show obligations scheduled today or during the previous three business days, so that I can prioritize what should be collected now.
6. As a payment operations staff member, I want Overdue collections to show obligations four to nine business days past the scheduled date, so that I can escalate late collection work before delinquency.
7. As a payment operations staff member, I want Delinquent collections to show obligations at least 10 business days past the scheduled date, so that seriously late manual collections are impossible to miss.
8. As a payment operations staff member, I want In Progress to show active manual-review collection attempts under 24 hours old, so that I can track work someone has already started.
9. As a payment operations manager, I want Staff Overdue to show active manual-review attempts that are at least 24 hours old, so that stale internal work is visible and actionable.
10. As a payment operations staff member, I want Staff Overdue to be an override bucket instead of a duplicate alert, so that a stale attempt appears in only one place.
11. As a payment operations staff member, I want to drag a due, overdue, or delinquent card into In Progress, so that I can explicitly mark that manual collection has started.
12. As a payment operations staff member, I want to start collection early for an Upcoming card within the next three business days when I provide an early-start reason, so that legitimate early collection work is captured without changing the scheduled date.
13. As a compliance reviewer, I want early-start reasons to be audited, so that staff can explain why collection began before the scheduled day.
14. As a payment operations staff member, I want dragging a card to Confirmed to open a confirmation modal, so that no payment is silently confirmed by drag-and-drop alone.
15. As a payment operations staff member, I want to confirm an In Progress card with evidence and collected amount, so that a real manual-review transfer is settled through the payment rails.
16. As a payment operations staff member, I want to confirm a Staff Overdue card with evidence and collected amount, so that stale internal work can still be resolved through the normal confirmation path.
17. As a payment operations staff member, I want to confirm a Due, Overdue, or Delinquent card directly with evidence and collected amount, so that I can record cash or cheque received without first doing a separate visual move.
18. As a ledger operator, I want direct confirmation from a date bucket to create and confirm the manual-review transfer through the backend, so that the audit trail and cash ledger entries are the same as the explicit In Progress path.
19. As a payment operations staff member, I want the confirmation modal to require evidence for every offline payment, including cash, so that every manual collection has reviewable support.
20. As a payment operations staff member, I want to choose cash or cheque explicitly during confirmation, so that the collected instrument is captured as business data instead of hidden in a generic journal wrapper.
21. As a payment operations staff member, I want optional instrument details such as cheque number, reference number, received date, and notes, so that I can capture useful context without blocking legitimate collections that lack every detail.
22. As a payment operations staff member, I want the entered amount for a single-obligation card to be an exact confirmation of the remaining collectible amount, so that partial payments are not accidentally introduced in the Kanban workflow.
23. As a backend engineer, I want the backend to reject partial confirmation for single-obligation Kanban cards, so that UI mistakes or API misuse cannot settle the wrong amount.
24. As a payment operations manager, I want Confirmed to show the most recent 10 confirmations by default, so that the board stays focused on active work while still providing quick recent history.
25. As a payment operations manager, I want Confirmed pagination to respect the active filters, so that I can page through recent confirmations for a specific borrower, mortgage, collector, date range, or instrument type.
26. As a payment operations staff member, I want grouped manual plan entries to appear in a separate expandable table, so that multi-obligation or workout installments are supported without breaking the one-card-one-obligation Kanban model.
27. As a payment operations staff member, I want each grouped table row to expand into installment details, so that I can see each installment's covered obligations, statuses, due dates, scheduled dates, and amounts.
28. As a payment operations staff member, I want status chips on grouped installments, so that I can quickly filter for upcoming, due, overdue, delinquent, in-progress, staff-overdue, and confirmed installment work.
29. As a payment operations staff member, I want each workout installment to be tracked independently, so that a three-installment plan can show exactly which installments have cleared and which remain open.
30. As a payment operations staff member, I want to confirm one grouped installment at a time, so that evidence, collected amount, allocation, and ledger posting match the installment that cleared.
31. As a ledger operator, I want grouped installment payments allocated deterministically across covered obligations, so that settlement behavior is repeatable and auditable.
32. As a ledger operator, I want grouped installment allocation to pay oldest due obligations first, then payment number, then obligation identifier, so that multi-obligation settlement order is predictable.
33. As a payment operations staff member, I want the grouped installment path to allow the last covered obligation to be partially settled when the planned installment amount is smaller than covered outstanding, so that workout installment plans can be represented correctly.
34. As a payment operations staff member, I want grouped confirmations to stay in the grouped section instead of the Kanban Confirmed column, so that single-obligation and workout workflows remain cleanly separated.
35. As a payment operations staff member, I want to assign or reassign a collector to an offline plan entry, so that ownership of manual collection work is visible.
36. As a payment operations manager, I want assignment fields to be optional, so that unassigned queues remain valid during initial triage.
37. As a compliance reviewer, I want assignment changes to record actor, timestamp, and reason, so that staff ownership changes are auditable.
38. As a payment operations staff member, I want to add notes to an active or stale manual collection attempt, so that phone calls, cash desk activity, and cheque follow-up can be recorded.
39. As a payment operations staff member, I want to release a stale manual collection attempt, so that a blocked or abandoned attempt does not sit in Staff Overdue forever.
40. As a backend engineer, I want releasing a stale attempt to cancel/release the old executed plan entry and create a fresh replacement plan entry, so that executed history is preserved instead of mutating the old entry back to planned.
41. As a compliance reviewer, I want release actions to use governed transitions where possible and include reason, actor, old plan entry, and new plan entry lineage, so that the lifecycle is reconstructable.
42. As a payment operations staff member, I want a calendar view of upcoming and past offline obligations, so that I can plan collection work by day, week, month, and agenda.
43. As a payment operations staff member, I want actions available from calendar event details, so that I can start, confirm, assign, release, or note work without returning to the Kanban board.
44. As a frontend engineer, I want Kanban, table, and calendar actions to reuse the same modals and backend mutations, so that behavior does not diverge across views.
45. As a payment operations staff member, I want filters for mortgage, borrower, collector, instrument type, date range, amount range, status bucket, evidence type, and search terms, so that I can narrow the queue to the exact work I need.
46. As a payment operations staff member, I want a Staff Overdue-only filter, so that stale internal work can be cleaned up quickly.
47. As a payment operations staff member, I want search to find borrower name, borrower email, mortgage or property label, plan entry identifier, obligation identifier, cheque number, and reference number, so that I can resolve real-world staff questions quickly.
48. As an admin, I want the offline operations route to require payment view permission, so that only authorized staff can see manual payment work.
49. As an admin, I want start, confirm, release, assign, reassign, and note actions to require payment manage permission, so that sensitive collection operations are restricted.
50. As a compliance reviewer, I want evidence records to be first-class and also copied into manual settlement details, so that the current transfer contract is preserved while evidence remains independently queryable.
51. As a compliance reviewer, I want confirmed evidence to be immutable in v1, so that staff cannot quietly delete or replace support after a payment has posted.
52. As a ledger operator, I want cash and cheque confirmations to post through the existing cash ledger path, so that the ledger records the same debits, credits, and metadata regardless of which UI view initiated confirmation.
53. As a backend engineer, I want all collection, transfer, obligation, and plan-entry status changes to go through governed transitions, so that audit logging and ledger side effects are triggered consistently.
54. As a product manager, I want the screen to use the existing Kanban primitive and extend the existing event manager primitive, so that we reuse existing UI infrastructure instead of creating parallel components.

## Implementation Decisions

- Build a separate admin route for offline payment operations instead of folding this into the existing payment operations route.
- The route reads from a new offline payment operations backend read model. Kanban cards, grouped installment rows, calendar events, agenda items, filters, counters, and recent confirmations are all projections from that same read model.
- The read model includes only offline/manual candidates. Provider-managed automatic obligations and plan entries are filtered out.
- Single-obligation plan entries appear on the Kanban. A Kanban card represents exactly one plan entry with exactly one obligation.
- Manual/offline plan entries with multiple obligations are excluded from the Kanban and displayed in a separate grouped expandable table.
- Grouped table parent rows represent the workout or manual plan grouping. Expanded child rows represent individual installments or plan entries and show covered obligations, statuses, due dates, scheduled dates, amount, collector, evidence state, and collection state.
- Confirmed Kanban pagination is cursor-based, scoped to active filters, and defaults to the 10 most recent single-obligation offline confirmations globally.
- Upcoming, Due, Overdue, and Delinquent are derived display buckets, not new persisted states.
- Upcoming means scheduled in the next one to three business days.
- Due means scheduled today or one to three business days ago.
- Overdue means scheduled four to nine business days ago.
- Delinquent means scheduled at least 10 business days ago.
- Business-day math uses the existing weekday-only helper for v1 and is wrapped behind a dedicated offline payment business clock so holiday calendars can be introduced later without rewriting the screen.
- In Progress is derived from an active manual-review collection attempt and linked transfer that are under 24 hours old.
- Staff Overdue is derived from an active manual-review collection attempt and linked transfer that are at least 24 hours old.
- Staff Overdue overrides In Progress and date buckets. An item appears in only one operational bucket.
- Staff Overdue is not auto-confirmed, auto-failed, or silently remediated. Staff must explicitly confirm, release, or add a note.
- The backend exposes a start collection operation for manual-review collection attempts. It creates the collection attempt and transfer through the payment rails, marks the plan entry executing through the governed transition path, and records actor and reason metadata.
- Starting collection from Upcoming is allowed only for items scheduled within the next three business days and requires an early-start reason. The original scheduled date is preserved.
- Moving from date buckets to Confirmed creates a manual-review transfer and immediately confirms it in one backend operation, using the same rails as the explicit In Progress path.
- Moving from In Progress or Staff Overdue to Confirmed confirms the existing active manual-review transfer.
- Every confirmation requires evidence upload.
- Evidence is stored in a first-class evidence model, and stable evidence identifiers are copied into the manual settlement evidence attachment identifiers for compatibility with the existing transfer contract.
- The confirmation action exposes explicit instrument choices, including cash and cheque, instead of a generic journal wrapper.
- Optional instrument metadata is supported for cheque/reference/deposit details, received date, and staff notes.
- Single-obligation Kanban confirmations reject partial payments. The entered amount must equal the remaining collectible amount and acts as an explicit confirmation step.
- Grouped installment confirmations settle one installment at a time. Allocation across covered obligations is deterministic: oldest due date first, then payment number, then obligation identifier.
- Grouped installment allocation may partially settle the last obligation only when the planned installment amount is intentionally smaller than the aggregate outstanding balance covered by that installment.
- Grouped/workout confirmations do not populate the Kanban Confirmed column.
- Collector assignment is supported in v1 with optional assignment fields for assigned collector actor, assigned timestamp, assigning actor, and assignment reason.
- Assignment, reassignment, and clearing are restricted to offline/manual plan entries and require payment manage permission.
- Route read access requires payment view permission. Operational mutations require payment manage permission.
- Pending manual-review transfers can be cancelled/released through a narrow governed-transition extension that is only available through the offline release action after validating the provider and current state.
- Pending manual-review collection attempts can be cancelled through the matching governed-transition path.
- Releasing an active or stale manual-review attempt marks the old executed plan entry cancelled/released with reason and lineage, then creates a fresh replacement plan entry. It does not mutate the old executed plan entry back to planned.
- Notes are stored as auditable staff activity associated with the plan entry and active attempt where applicable.
- Cash and cheque confirmations post through the existing transfer confirmation and cash ledger path. The ledger records the collection as trust cash received against borrower receivable, with instrument details and evidence metadata available for audit.
- The Kanban UI must adapt the existing Kanban primitive rather than reimplementing drag-and-drop from scratch.
- The calendar and agenda must extend the existing event manager primitive rather than rolling a separate calendar component.
- Calendar event detail actions reuse the same action modals and backend operations as the Kanban and grouped table.
- Frontend state updates are optimistic only where they can be safely reconciled with backend state. The backend remains the source of truth for bucket placement, transition success, ledger posting, evidence linkage, and assignment state.

## Testing Decisions

- Good tests should verify external behavior at the highest useful seam: what staff can see, which backend action is called, which state transitions occur, which records are created or patched, and which ledger postings exist. Tests should not assert incidental component state, internal helper call order, or styling implementation details.
- Backend read model tests should seed offline and non-offline plan entries and verify that only offline/manual candidates appear.
- Backend read model tests should cover all bucket boundaries: next three business days, today, previous three business days, four to nine business days past due, 10 or more business days past due, active under 24 hours, and active at or over 24 hours.
- Backend read model tests should verify that In Progress and Staff Overdue override date-derived buckets.
- Backend read model tests should verify that confirmed pagination returns the most recent 10 by default and scopes pagination to active filters.
- Backend action tests should verify starting manual-review collection from Due, Overdue, Delinquent, and allowed Upcoming items.
- Backend action tests should verify that starting collection from Upcoming requires an early-start reason and preserves the original scheduled date.
- Backend action tests should verify that direct confirmation from a date bucket creates and confirms the manual-review transfer through the same manual collection path as the In Progress confirmation flow.
- Backend action tests should verify that confirming from In Progress and Staff Overdue settles the existing active manual-review transfer.
- Backend action tests should verify evidence is required for all offline confirmations.
- Backend action tests should verify evidence records are first-class and copied into manual settlement evidence attachment identifiers.
- Backend action tests should verify cash and cheque instrument types and optional instrument metadata are persisted into the settlement and available for ledger/audit review.
- Backend action tests should verify single-obligation confirmation rejects partial, overpaid, and underpaid amounts.
- Backend action tests should verify grouped installment confirmation allocation order and the allowed final-obligation partial settlement behavior for workout installment plans.
- Backend governed-transition tests should verify that pending manual-review transfer cancellation is allowed only through the validated release path and does not open cancellation for unrelated providers.
- Backend governed-transition tests should verify that pending manual-review collection attempts can be cancelled when released.
- Backend release tests should verify that releasing a stale attempt cancels/releases the old executed plan entry, creates a fresh replacement plan entry, and records old-to-new lineage.
- Backend assignment tests should verify assign, reassign, and clear behavior, including permission checks and audit metadata.
- Cash ledger integration tests should verify that confirmed cash and cheque collections post exactly once through the existing ledger path and settle borrower receivable correctly.
- Permission tests should verify read access with payment view permission and mutation access with payment manage permission.
- Frontend component tests should verify that the route renders the Kanban columns, grouped table, filters, calendar, agenda, and action entry points from mocked read model data.
- Frontend interaction tests should verify drag-to-In-Progress, drag-to-Confirmed, event-detail actions, evidence modal reuse, and grouped installment confirmation behavior by asserting mutation calls and visible state changes.
- Frontend tests should verify that single-obligation and grouped/workout confirmations remain visually separate.
- Prior test patterns should come from the existing payment collection plan tests, transfer reconciliation tests, cash ledger receipt integration tests, admin payment operation UI tests, and schedule replacement workflow tests.
- End-to-end coverage should focus on one happy path for a cash single-obligation collection, one cheque Staff Overdue confirmation, and one grouped workout installment confirmation.
- Repository validation after implementation must include the standard check, typecheck, and Convex code generation commands.

## Out of Scope

- Automatic failure, confirmation, or release of stale manual-review attempts.
- Holiday-aware business-day calendars beyond the existing weekday-only helper.
- Partial payments for single-obligation Kanban cards.
- Post-confirmation evidence deletion or replacement.
- Bulk assignment or bulk confirmation.
- Provider-managed automatic collection operations.
- A full rewrite of the existing payment operations dashboard.
- A new Kanban implementation.
- A new calendar implementation.
- Mutating old executed plan entries back to planned status.
- Changing settled historical obligation records.

## Further Notes

- UI labels should use `Overdue` and `Delinquent`.
- The screen is specifically for offline/manual operations, but it must remain compatible with the existing universal payment rails.
- The implementation should keep domain language aligned with collection plan entries, obligations, collection attempts, transfer requests, manual settlement details, and the cash ledger.
- The implementation should favor narrow governed-transition extensions over bypasses or frontend-only projections.
- This PRD intentionally keeps the Kanban and grouped workout workflows separate because they have different amount and allocation rules.
