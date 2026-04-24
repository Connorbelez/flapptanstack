# Chunk Context: chunk-02-schema-provider

## Goal
- Add the `checkoutSessions` schema table and extend the canonical transfer provider contract with `stripe`.

## Relevant plan excerpts
- `checkoutSessions` must contain required identifiers, selected-lawyer snapshot, Stripe refs, reservation/deal/transfer refs, timestamps, idempotency key, and failure/provider fields.
- Required indexes: `by_listing_status`, `by_lender`, `by_reservation`, `by_stripe_checkout_session`, `by_status_expires_at`, `by_idempotency`.
- Transfer provider contract should accept a Stripe-compatible literal; prefer `stripe`.
- No reservation, Stripe, webhook, deal, expiry, or UI flow may be implemented in this slice.

## Implementation notes
- Import checkout validators/constants into `convex/schema.ts` rather than duplicating status/selected-lawyer validator logic locally.
- Keep `ledger_reservations` as source of truth for locks; schema only links `reservationId`.
- Add `stripe` to both type-level `PROVIDER_CODES` and Convex `providerCodeValidator`.
- Run Convex codegen after schema changes.

## Existing code touchpoints
- Modify `convex/schema.ts`.
- Modify `convex/payments/transfers/types.ts`.
- Modify `convex/payments/transfers/validators.ts`.
- Generated files under `convex/_generated/*` will change after codegen.
- GitNexus impact required for `PROVIDER_CODES`, `providerCodeValidator`, and `schema` before edits.

## Validation
- `bunx convex codegen`: not-run
- `bun test convex/payments/transfers`: not-run
- Representative checkout schema/index test: not-run
