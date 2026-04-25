# Chunk Context: chunk-01-classification-and-reconciliation

## Goal
- Deliver the Stripe hosted checkout event classifier, strict payload extraction, and the reconciliation decision skeleton that can safely load internal checkout state and reject metadata conflicts.

## Relevant plan excerpts
- "Extend Stripe webhook to recognize hosted checkout success and failure while preserving existing reversal behavior."
- "Resolve checkout by `stripeCheckoutSessionId` and internal metadata, rejecting conflicts."
- "Trust internal checkout/reservation state, not client return params or provider metadata alone."

## Implementation notes
- Existing `convex/payments/webhooks/stripe.ts` verifies Stripe signatures and only routes `REVERSAL_EVENT_TYPES`.
- Checkout metadata helpers already exist in `convex/checkout/metadata.ts` and enforce lock fee amount `25000` and currency `CAD`.
- Checkout status helpers already exist in `convex/checkout/status.ts`; terminal states cannot reopen except the modeled `expired -> refunded_late_success` path.
- Reconciliation should be factored into `convex/checkout/reconciliation.ts` so webhook and future polling/retry callers can share idempotency logic.

## Existing code touchpoints
- `convex/payments/webhooks/stripe.ts`: `stripeWebhook`, `REVERSAL_EVENT_TYPES`, `StripeWebhookEvent`.
- `convex/payments/webhooks/transferCore.ts`: `persistVerifiedTransferWebhook`, `markTransferWebhookFailed`, processed/failed status helpers.
- `convex/checkout/metadata.ts`: `parseCheckoutStripeMetadata`.
- `convex/checkout/status.ts`: `assertCheckoutTransitionAllowed`, active/terminal helpers.
- GitNexus impact still required before editing `stripeWebhook`, `persistVerifiedTransferWebhook`, and `markTransferWebhookFailed`.

## Validation
- Targeted Stripe webhook tests for event classification and payload parsing.
- Targeted checkout metadata conflict tests.
