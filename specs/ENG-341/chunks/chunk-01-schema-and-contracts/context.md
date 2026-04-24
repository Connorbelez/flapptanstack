# Chunk Context: chunk-01-schema-and-contracts

## Goal
- Add the durable schema and typed contract for FairLend listing-lock checkout sessions, plus additive deal payment metadata needed by later chunks.

## Relevant plan excerpts
- "Add a durable `DealLockCheckoutSession` store with listing, mortgage, buyer, seller, selected lawyer, fraction units, lock fee amount, reservation id, Stripe checkout session id, status, expiry, optional deal id, and timestamps."
- "Hosted Stripe Checkout must collect exactly CAD 250 and include metadata sufficient to resolve the FairLend checkout session without trusting client state."
- "FairLend sessions must expire after five minutes; expired, abandoned, or failed sessions must void the temporary reservation and must not leave an active deal."

## Implementation notes
- Prefer `convex/dealLocks` as the module namespace because this is a deal-closing trigger, even though the UI entry point is a listing.
- Statuses required by the issue: `created`, `paid`, `expired`, `refunded`, `failed`. Add explicit `deal_created` or timestamps if needed for auditability without changing the public issue contract.
- Add indexes for idempotency and operational queries: Stripe checkout session id, listing/buyer/status, status/expiresAt, deal id, reservation id, and provider event references if used.
- Deal metadata should be additive and nullable/optional: lock fee collection provider/status plus Stripe checkout/payment identifiers. Do not alter existing buyer/seller/fraction/lawyer semantics.
- Run `bunx convex codegen` after schema/module changes.

## Existing code touchpoints
- `convex/schema.ts`: existing `deals`, `dealAccess`, `ledger_reservations`, and `webhookEvents` tables.
- `convex/deals/participantProjection.ts`: ENG-338 projection already exists; do not duplicate participant/fraction projection logic.
- `convex/payments/webhooks/types.ts`: normalized transfer event validators are transfer-specific; checkout events may need session-local fields instead of overloading transfer event types.
- GitNexus: worktree indexed successfully on 2026-04-24. Schema is a shared hot spot; no symbol-specific impact applies to a new table.

## Validation
- `bunx convex codegen`: required after schema edits.
- Targeted TypeScript compile failures should be fixed before moving to checkout-start implementation.
