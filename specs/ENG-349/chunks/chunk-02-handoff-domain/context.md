# Chunk Context: chunk-02-handoff-domain

## Goal
- Implement the idempotent paid checkout to deal handoff and access creation.

## Relevant plan excerpts
- "Consume only an internally verified paid checkout that is active/valid and not expired/abandoned/refunded."
- "Persist domain lender on `deals.lenderId`; keep `lenderAuthId` only where auth principal context is required."
- "Copy selected lawyer snapshot onto the deal and deal-scoped participant/access records."

## Implementation notes
- Add typed fields on `deals` for checkout/payment links if absent: `checkoutSessionId`, `lockFeeTransferRequestId`, `stripeCheckoutSessionId`, `stripePaymentIntentId`.
- Use checkout idempotency via `checkoutSessions.dealId` plus a `deals.by_checkout_session` index.
- Use `grantDealAccess` rather than duplicating access upsert logic.
- Create the initial deal with `status: "initiated"` and then use the Transition Engine for the governed `DEAL_LOCKED` transition if the handoff needs to move into the active lifecycle.

## Existing code touchpoints
- `convex/checkout/reconciliation.ts`
- `convex/checkout/dealHandoff.ts` (new)
- `convex/schema.ts`
- `convex/deals/mutations.ts`

## Validation
- Targeted checkout handoff tests should pass after implementation.
