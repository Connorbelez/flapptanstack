# Chunk Context: chunk-01-contract-and-provider

## Goal
- Establish typed checkout-start contracts and a mockable Stripe Checkout provider boundary.

## Relevant plan excerpts
- Return contract: `{ ok: true; checkoutSessionId; stripeCheckoutUrl; expiresAt }` or `{ ok: false; code; message }`.
- Hosted Stripe Checkout must collect CAD 250.00 lock fee and include required metadata from the server.
- Idempotency key is derived from the internal checkout session id.

## Implementation notes
- Existing ENG-339 modules include `convex/checkout/validators.ts`, `status.ts`, and `metadata.ts`.
- Provider code should stay isolated from mutations so Stripe is only called from actions/server orchestration.
- Provider abstraction must be injectible/testable without real Stripe network calls.

## Existing code touchpoints
- `convex/checkout/metadata.ts`: `buildCheckoutStripeMetadata` impact LOW, 0 dependents.
- `convex/payments/webhooks/stripe.ts`: existing Stripe webhook/env boundary pattern.
- New expected files: `convex/checkout/types.ts`, `convex/checkout/stripe.ts`.

## Validation
- Targeted unit tests for provider request building, result validation, and metadata completeness.
