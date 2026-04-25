# Chunk Context: chunk-01-checkout-runtime

## Goal
- Deliver the local checkout state transitions for expiry and explicit abandonment, including idempotent reservation release.

## Relevant plan excerpts
- "FairLend `expiresAt` is inventory truth; Stripe expiration is cleanup only."
- "Never extend TTL because of payment retry."
- "Expiry voids linked `ledger_reservations` with checkout-scoped idempotency key."
- "User abandon transitions to `abandoned`, expires provider when possible, voids reservation, and journals actor."

## Implementation notes
- Prefer additive modules under `convex/checkout/`.
- Reuse `CHECKOUT_ACTIVE_STATUSES`, `assertCheckoutTransitionAllowed`, and `isTerminalCheckoutStatus`.
- Use `voidReservationHandler` so pending balances are released by the canonical ledger path.
- Use deterministic idempotency keys such as `marketplace-checkout-expired:{checkoutSessionId}` and `marketplace-checkout-abandoned:{checkoutSessionId}`.
- Preserve original `expiresAt`; retries inside TTL must not mutate it.

## Existing code touchpoints
- `convex/checkout/types.ts`: `CHECKOUT_SESSION_TTL_MS`, checkout idempotency helpers.
- `convex/checkout/status.ts`: active/terminal statuses and transition legality.
- `convex/checkout/mutations.ts`: current start/attach/provider-start-failed mutation patterns and checkout source helper.
- `convex/ledger/mutations.ts`: `voidReservationHandler` idempotent reservation release.
- GitNexus: `voidReservation` export had no graph dependents; handler use remains medium financial risk. `buildMarketplaceAvailabilitySummary` is LOW risk and will be used in tests.

## Validation
- Targeted checkout tests for expire/abandon runtime behavior.
- `bun check` and `bun typecheck` after chunk if edits are substantial.
