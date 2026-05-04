# Summary: ENG-340 - Checkout: implement two-phase hosted Stripe start

- Source issue: https://linear.app/fairlend/issue/ENG-340/checkout-implement-two-phase-hosted-stripe-start
- Primary plan: https://www.notion.so/34cfc1b4402481318ececa6857a2bf39
- Supporting docs:
  - https://www.notion.so/315fc1b44024811fbee6ecc7b00a378f
  - docs/architecture/rbac-and-permissions.md
  - docs/cash-ledger-developer-guide.md
  - docs/convex/convex-dev-stripe.md

## Scope
- Implement the checkout-start runtime spine for marketplace listing locks.
- Add `startMarketplaceCheckout` action/server entrypoint returning a typed hosted Stripe Checkout URL result.
- Add internal prepare, provider-attach, and provider-start-failed compensation mutations.
- Validate auth, portal/lender visibility, production listing status, requested fractions, selected lawyer, canonical seller inventory, and buyer account before creating locks.
- Create `ledger_reservations` and `checkoutSessions` in one Convex transaction, then call Stripe from the action boundary and attach provider identifiers before returning success.
- Add provider abstraction/test double and targeted Convex/unit tests for success, rejections, idempotency, provider failures, and race/no-oversell behavior.

## Constraints
- Do not call Stripe from a Convex mutation.
- Do not create deals, webhooks, expiry jobs, refunds, or listing-detail UI in this issue.
- Keep `ledger_reservations` as the inventory lock source of truth; do not add listing availability counters.
- Use WorkOS/AuthKit-derived identity and existing FairLend RBAC/portal checks before reading tenant-sensitive listing data.
- Seller account resolution must use canonical ledger account ownership, not the marketplace MIC regex heuristic.
- A successful response may only occur after reservation, checkout session, and provider session are linked.
- Provider-start and provider-attach failures must compensate locally by moving the checkout to `provider_start_failed`, voiding the reservation, recording `failureReason`, and journaling the rejection.
- Convex exports must use fluent builders with explicit `.public()` / `.internal()` visibility where applicable.
- GitNexus impact: `reserveShares`, `voidReservation`, `getMarketplaceListingDetail`, `resolveViewerLenderConstraintForPortal`, and `buildCheckoutStripeMetadata` were LOW; `buildMarketplaceAvailabilitySummary` had 3 direct dependents and 16 total impacted nodes, still LOW. Runtime risk is high due to payment and inventory lock semantics.

## Open questions
- None blocking. ENG-339 remains In Progress in Linear, but its local contract is present in this worktree.
