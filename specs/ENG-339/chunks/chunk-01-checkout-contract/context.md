# Chunk Context: chunk-01-checkout-contract

## Goal
- Deliver the typed checkout contract modules for lifecycle statuses, terminal helpers, selected-lawyer snapshots, transition legality, and Stripe metadata.

## Relevant plan excerpts
- Statuses: `preparing_provider_session`, `hosted_checkout_open`, `payment_failed_retryable`, `completed`, `expired`, `abandoned`, `provider_start_failed`, `refunded_late_success`.
- Terminal statuses are `completed`, `expired`, `abandoned`, `provider_start_failed`, and `refunded_late_success`.
- Transition legality: preparing -> hosted/open or provider_start_failed; hosted/open -> payment_failed_retryable, completed, expired, abandoned, refunded_late_success; retryable -> hosted/open, expired, abandoned; terminal states cannot leave terminal.
- Stripe metadata must include `checkoutSessionId`, `reservationId`, `listingId`, `mortgageId`, `portalId`, `lenderId`, `lenderAuthId`, selected lawyer type/id, requested fractions, lock fee amount, and idempotency key.

## Implementation notes
- Keep these modules pure TypeScript or Convex validator-only where practical; no runtime Convex endpoint exports are expected.
- Lock fee constants should be defined server-side and reused by schema/metadata where possible.
- Stripe metadata values should serialize to strings because Stripe metadata is string-keyed and string-valued.
- Parser should validate required fields and numeric strings without returning untyped objects.

## Existing code touchpoints
- New files: `convex/checkout/status.ts`, `convex/checkout/validators.ts`, `convex/checkout/metadata.ts`.
- Existing patterns: `convex/engine/machines/deal.machine.ts`, `convex/engine/machines/transfer.machine.ts`, `convex/payments/transfers/types.ts`, `convex/payments/transfers/validators.ts`.
- GitNexus impact checks required before editing existing symbols; new checkout files have no existing dependents.

## Validation
- `bun test convex/checkout/__tests__/status.test.ts convex/checkout/__tests__/validators.test.ts convex/checkout/__tests__/metadata.test.ts`: not-run
- `bun typecheck`: not-run
