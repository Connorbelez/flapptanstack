# Chunk Context: chunk-03-webhook-success

## Goal
- Extend verified Stripe webhook handling so in-window checkout success creates the deal exactly once and late/duplicate/unknown events are safe.

## Relevant plan excerpts
- "Verified Stripe success must persist the webhook event, resolve the FairLend session by Stripe checkout session id, enforce idempotency and session expiry, and create a deal only when the session is valid."
- "Late Stripe success after `expiresAt` must initiate refund or mark the session for refund/refunded and must not create a deal."
- "Deal creation must persist buyer, seller, selected fraction units, selected lawyer auth id/type, reservation linkage, locking fee amount, and Stripe payment identifiers using the ENG-338 contract."
- "Deal creation must emit `DEAL_LOCKED` through the Transition Engine and must not patch `deals.status` directly."

## Implementation notes
- Existing `convex/payments/webhooks/stripe.ts` verifies signatures and currently ignores non-reversal events before persistence. Checkout success must persist verified raw events before scheduling processing.
- Use `webhookEvents.by_provider_event` idempotency and checkout-session idempotency together; duplicate provider events should not duplicate sessions, deals, reservations, packages, access rows, or fee transfers.
- Deal insertion may create an `initiated` deal row, but status advancement to locked must call `executeTransition` or an internal system transition wrapper.
- Buyer/seller/lawyer access grants should use `grantDealAccess` to preserve idempotent active-row behavior.
- Late success should record refund-needed/refunded state. If real Stripe refund API is not wired in this slice, the session state must make the operational action queryable.

## Existing code touchpoints
- `convex/payments/webhooks/stripe.ts`: HTTP action, signature verification, event parsing, reversal persistence branch.
- `convex/payments/webhooks/transferCore.ts`: raw webhook persistence helpers.
- `convex/deals/mutations.ts`: `grantDealAccess`, public admin `transitionDeal`; likely needs an internal system transition helper.
- `convex/engine/transition.ts`: `executeTransition` is the governed status mutation path.
- `convex/documents/dealPackages.ts`: package creation will consume persisted deal participant/lawyer context after `DEAL_LOCKED`.
- GitNexus impact: `stripeWebhook` LOW; `transitionDeal` exact context found but impact command is name-ambiguous, so treat transition helper edits as medium operational risk.

## Validation
- `convex/payments/webhooks/__tests__/stripeWebhook.test.ts` for checkout success, unknown session, duplicate event, late success, and existing reversal regression.
- New checkout/deal tests for exactly-one deal creation and `DEAL_LOCKED` transition.
