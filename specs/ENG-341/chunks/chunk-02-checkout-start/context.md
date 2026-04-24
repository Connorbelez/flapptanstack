# Chunk Context: chunk-02-checkout-start

## Goal
- Implement authenticated checkout start, temporary reservation creation/reuse, hosted Stripe Checkout creation, and expiry/failure cleanup.

## Relevant plan excerpts
- "Checkout start must require authenticated WorkOS identity and active listing access, then re-read listing, mortgage, availability, buyer/seller, selected lawyer, price, and fraction data server-side before creating any reservation or Stripe session."
- "Checkout start must reject invalid fraction units, unavailable fractions, missing listing/mortgage linkage, invalid or unavailable selected lawyer, and unauthenticated users before contacting Stripe."
- "Checkout start must create or reuse a temporary ledger reservation using existing reservation primitives and a stable session-scoped idempotency key before redirecting to Stripe Checkout."

## Implementation notes
- Use fluent-convex exported functions with `.public()`/`.internal()` for Convex mutations/actions.
- Checkout start should live behind lender/listing permission semantics and must still re-check resource access server-side.
- Current marketplace detail query is `convex/listings/marketplace.ts -> getMarketplaceListingDetail`; it returns read-only listing data and availability but no checkout readiness.
- Current ledger reservation primitive is `internal.ledger.mutations.reserveShares`; it creates a pending reservation and is idempotent by ledger journal idempotency key.
- Reservation creation needs seller and buyer ledger position accounts. Seller should come from the listing/mortgage/position context; buyer should come from authenticated lender identity.
- If Stripe Checkout creation fails after reservation creation, void or expire the reservation in the same orchestrated failure path.

## Existing code touchpoints
- `convex/listings/marketplace.ts`: listing detail data and server-side availability source.
- `convex/listings/marketplaceShared.ts`: availability helpers.
- `convex/ledger/mutations.ts`: `reserveShares`, `voidReservation`.
- `convex/ledger/queries.ts`: reservation/account lookup helpers.
- `convex/fluent.ts`: `lenderMutation`, `listingQuery`, `authedAction`, and builder patterns.
- GitNexus impact: `getMarketplaceListingDetail` LOW; `reserveShares` exact symbol context found but impact command is name-ambiguous, so treat edits as medium operational risk.

## Validation
- Targeted Convex tests for checkout start, rejection-before-Stripe, idempotent replay, reservation creation, reservation cleanup on provider failure, and expiry/void behavior.
