# Chunk Context: chunk-03-webhooks-transition

## Goal
- Add verified Documenso webhook ingestion, idempotent processing, recipient updates, exceptions, and exactly-once transition emission.

## Relevant plan excerpts
- "Provider events must verify the Documenso webhook secret before persistence/processing as truth, dedupe by provider event id, and preserve raw event evidence."
- "Emit `ALL_PARTIES_SIGNED` only through the transition engine and only after verified active required recipients complete."

## Implementation notes
- Mirror payment webhook patterns but keep Documenso-specific event storage if fields differ.
- Verification should be isolated in `convex/payments/webhooks/verification.ts` or a provider-specific helper without changing payment contracts.
- GitNexus impact for `executeTransition` is CRITICAL; do not modify it. Use `internal.engine.transitionMutation.transitionMutation`.

## Existing code touchpoints
- `convex/http.ts`: register `/webhooks/documenso`.
- `convex/payments/webhooks/verification.ts`: HMAC/timing-safe patterns.
- `convex/payments/webhooks/transferCore.ts`: persistence/status pattern.
- `convex/engine/transitionMutation.ts`: internal transition wrapper.

## Validation
- Webhook tests for invalid secret, duplicate event, out-of-order completion, rejection/void, provider mismatch, and exactly-once transition.
