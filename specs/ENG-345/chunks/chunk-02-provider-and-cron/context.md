# Chunk Context: chunk-02-provider-and-cron

## Goal
- Add provider cleanup and scheduled sweeping around the core checkout expiry runtime.

## Relevant plan excerpts
- "Expiry attempts to expire Stripe Checkout Session when provider id exists."
- "Provider-expiry failure must not leave reservation pending; record failure for operations."
- "Implement bounded sweep action/cron."

## Implementation notes
- `convex/checkout/stripe.ts` already exposes `CheckoutProvider.expireHostedCheckoutSession`.
- Provider errors should be recorded on checkout operational fields or metadata without preventing reservation void.
- Sweep should query `checkoutSessions.by_status_expires_at` for each active status and process bounded batches.
- Static cron registration in `convex/crons.ts` is acceptable for a fixed global maintenance job.

## Existing code touchpoints
- `convex/checkout/actions.ts`: provider action patterns and environment provider factory.
- `convex/checkout/stripe.ts`: expiration method and Stripe API configuration.
- `convex/crons.ts`: existing interval cron style.
- GitNexus: `convex/crons.ts` `crons` is LOW risk with no graph dependents.

## Validation
- Provider cleanup tests with fake provider success/failure.
- Sweep tests that active expired statuses are selected and terminal statuses are skipped.
