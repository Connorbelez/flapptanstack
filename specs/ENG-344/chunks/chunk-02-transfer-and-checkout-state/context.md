# Chunk Context: chunk-02-transfer-and-checkout-state

## Goal
- Implement active success and active failure state changes: exactly one Stripe-backed lock-fee transfer, checkout session payment outcome updates, and retryable failure without reservation release.

## Relevant plan excerpts
- "Active unexpired success creates/confirms exactly one inbound `locking_fee_collection` transfer for CAD 250 with Stripe refs and domain `lenderId`."
- "Store Stripe Checkout Session ID and PaymentIntent ID on checkout and transfer metadata when available."
- "Payment failure inside TTL transitions to `payment_failed_retryable`, keeps reservation pending, and does not extend TTL."

## Implementation notes
- `createTransferRequestRecord` is idempotent by `idempotencyKey`.
- `providerCode = "stripe"` is already scoped to inbound `locking_fee_collection` transfers with checkout metadata.
- The generic transfer initiation path intentionally rejects Stripe checkout lock-fee transfers; reconciliation should confirm/link the hosted checkout outcome rather than initiate via the provider registry.
- A completed checkout is the downstream handoff signal only; deal creation remains out of scope.

## Existing code touchpoints
- `convex/payments/transfers/mutations.ts`: `createTransferRequestRecord`, transfer creation validation, Stripe provider guardrail.
- `convex/payments/transfers/types.ts`: `PROVIDER_CODES`, `TRANSFER_TYPE_TO_OBLIGATION_TYPE`, checkout lock-fee provider helpers.
- `convex/checkout/mutations.ts`: existing start/attach/compensate mutations and checkout session patch patterns.
- `convex/schema.ts`: `checkoutSessions`, `transferRequests`, `webhookEvents`.
- GitNexus impact required before editing `createTransferRequestRecord`, `PROVIDER_CODES`, or `TRANSFER_TYPE_TO_OBLIGATION_TYPE` if those symbols are changed.

## Validation
- Convex tests for active success creating one transfer and linking checkout.
- Convex tests for duplicate success reusing the same transfer and checkout outcome.
- Convex tests for failure inside TTL setting `payment_failed_retryable` and preserving reservation state.
