# Summary: ENG-349 - Checkout: create deal from paid checkout and hand off documents

- Source issue: https://linear.app/fairlend/issue/ENG-349/checkout-create-deal-from-paid-checkout-and-hand-off-documents
- Primary plan: https://www.notion.so/34cfc1b440248144bebbcccb02c6e233
- Supporting docs:
  - https://www.notion.so/329fc1b440248106b45ef400bfe497db
  - https://www.notion.so/325fc1b44024813d9609f729908bcd56
  - docs/architecture/state-machines.md
  - docs/architecture/rbac-and-permissions.md

## Scope
- Create an idempotent paid-checkout-to-deal handoff under `convex/checkout/dealHandoff.ts`.
- Reuse ENG-339/340/344 checkout session, Stripe metadata, reservation, and lock-fee transfer contract.
- Create exactly one deal for a completed checkout session and link checkout, reservation, lock-fee transfer, Stripe Checkout Session, Stripe PaymentIntent, lender, and selected lawyer.
- Grant deal-scoped access for lender and selected lawyer participants required by current deal/document flows.
- Generate or repair the mortgage-linked deal package at deal creation time.
- Prevent marketplace-created deals from triggering a second ledger reservation through existing deal effects.
- Add focused Convex tests for eligibility, idempotency, participant access, package failure/retry visibility, and reservation guard behavior.

## Constraints
- Deal creation is only valid for internally verified `checkoutSessions.status === "completed"` records with reservation, lock-fee transfer, lender, and selected lawyer data.
- Expired, abandoned, provider-start-failed, payment-failed, refunded-late-success, or otherwise non-completed checkout sessions must be rejected without deal creation.
- Checkout-selected lawyer and lender are authoritative for deal fields and package variables; do not fall back to stale mortgage defaults for `lawyer_primary` or `lender_primary`.
- Status changes must remain governed. The handoff may create the initial deal row at `initiated`, then use the Transition Engine for `DEAL_LOCKED`.
- Package failures must remain visible and retryable. A retry must reuse the deal and package header rather than creating duplicates.
- Existing reservation effects must skip/no-op when the deal already has `reservationId`.

## GitNexus Impact Summary
- Indexed the repo before edits because the worktree was not indexed.
- `grantDealAccess`: LOW upstream risk, direct callers in `convex/deals/mutations.ts` and `convex/engine/effects/dealAccess.ts`.
- `buildParticipantSnapshot`: LOW upstream risk, direct caller inside `convex/documents/dealPackages.ts`, imported by `convex/deals/queries.ts` and `convex/crm/detailContextQueries.ts`.
- `reserveShares` in `convex/engine/effects/dealClosing.ts`: context resolved with no GitNexus incoming/outgoing processes, but domain risk remains high because reservation duplication is financially sensitive.
- `createDocumentPackageForDeal` and `reconcileSuccess` are not resolved as symbols by GitNexus, so file-level implementation will be validated with tests and final change detection.

## Open questions
- none
