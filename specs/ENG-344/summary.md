# Summary: ENG-344 - Checkout: reconcile Stripe success, failure, and late success

- Source issue: https://linear.app/fairlend/issue/ENG-344/checkout-reconcile-stripe-success-failure-and-late-success
- Primary plan: https://www.notion.so/34cfc1b4402481fd9c44c9a6df377da3
- Supporting docs:
- https://www.notion.so/329fc1b4402481c6b47af10d0aa6fb4e
- https://www.notion.so/329fc1b440248106b45ef400bfe497db
- https://www.notion.so/30ffc1b440248079819bf55c7bcfbe93
- https://www.notion.so/34cfc1b4402481269961c605566b7961
- https://www.notion.so/34cfc1b4402481318ececa6857a2bf39
- docs/cash-ledger-developer-guide.md
- docs/convex/convex-dev-stripe.md
- docs/architecture/state-machines.md

## Scope
- Extend the verified Stripe webhook boundary to classify hosted Checkout success and failure events while preserving existing reversal handling.
- Add idempotent reconciliation for active successes, retryable payment failures, duplicate provider events, and late successes after FairLend expiry.
- Create or confirm exactly one inbound `locking_fee_collection` transfer for a valid active CAD 250 success, using domain `lenderId`, provider code `stripe`, Stripe Checkout Session ID, and Stripe PaymentIntent ID.
- Patch `checkoutSessions` with payment outcome state and transfer/provider references for downstream deal creation without creating a deal in this issue.
- Add a late-success refund helper that records refund intent/completion/failure in operation-visible state and keeps refund failures retryable.
- Add backend tests for classifier behavior, metadata conflict handling, idempotent success/failure, duplicate replay, and late-success refund behavior.

## Constraints
- Persist verified raw provider events before ACKing Stripe; duplicate `providerEventId` replays must be stable and idempotent.
- Trust internal `checkoutSessions` and `ledger_reservations`; Stripe metadata is only a locator/consistency check and cannot override internal state.
- Use the existing `checkoutSessions` contract from ENG-339 and the two-phase hosted start contract from ENG-340.
- Do not create deals, expire sessions on a scheduler, modify listing UI, or implement browser-level Stripe flows.
- Do not use WorkOS auth IDs as transfer counterparties; transfer counterparty must be the domain lender entity ID.
- Do not recognize platform revenue for a lock fee that is refunded because of late success after expiry.
- Governed status changes must use the checkout transition contract; terminal states cannot reopen except `expired -> refunded_late_success`.
- Existing Stripe reversal webhook tests and behavior must remain covered.

## Open questions
- none
