# Chunk Context: chunk-04-webhook-integration-and-tests

## Goal
- Wire the Stripe webhook boundary to reconciliation after raw event persistence and add regression/backend tests for the end-to-end webhook reconciliation paths.

## Relevant plan excerpts
- "Persist raw provider event before ACK; duplicate `providerEventId` must replay idempotently."
- "Existing Stripe reversal behavior remains covered."
- "Unknown or conflicting checkout metadata is persisted for operations and rejected safely."

## Implementation notes
- `persistVerifiedTransferWebhook` already inserts or reuses `webhookEvents` by `(provider, providerEventId)`.
- Reconciliation should update webhook event status to `processed` or `failed` with clear operation-visible errors.
- Missing/invalid Stripe signature remains a 401 path and must not persist a trusted processed event.
- Unsupported or non-checkout events should continue to return stable ignored/deferred responses as appropriate.

## Existing code touchpoints
- `convex/payments/webhooks/stripe.ts`: HTTP action and helper exports used by tests.
- `convex/payments/webhooks/__tests__/stripeWebhook.test.ts`: existing Stripe webhook tests.
- New or updated `convex/checkout/__tests__/reconciliation.test.ts`.
- Existing `convex/payments/transfers/__tests__` if transfer idempotency assertions need coverage.

## Validation
- Targeted Stripe webhook test file.
- Targeted checkout reconciliation test file.
- Existing reversal webhook tests where practical.
