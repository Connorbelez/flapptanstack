# Chunk Context: chunk-03-callbacks-abuse-controls

## Goal
- Add signed callback verification, broker-onboarding callback-event persistence, normalized callback processing, and rate limiting for all verification entry points.

## Relevant plan excerpts
- "Add a broker-onboarding-specific callback-event table for signed IDV/provider callbacks with provider idempotency, raw body, signature verification status, attempts, processing status, linked application id, and error metadata."
- "Add a dedicated signed callback ingestion path that mirrors the existing payments pattern: `httpAction` route, `internalAction` signature verification in the Node runtime, raw-body persistence, then normalized processing."
- "Add abuse controls with the existing Convex `RateLimiter` for IDV start, verification recompute triggers, and signed callback processing."

## Implementation notes
- `convex/payments/webhooks/verification.ts` and `convex/payments/webhooks/transferCore.ts` are the reference pattern for HMAC verification, raw-body persistence, idempotent event rows, and processed/failed tracking.
- `convex/http.ts` currently registers only auth and payment webhooks. ENG-319 needs a broker-onboarding callback route.
- The repo has no production `RateLimiter` usage outside `convex/demo/rateLimiter.ts`, so ENG-319 should add the first real reusable verification limiter instead of embedding ad hoc guards.
- The broker onboarding callback path must fail closed for unsigned or malformed callbacks while still recording enough event metadata for admin/debug review.

## Existing code touchpoints
- `convex/http.ts`
- `convex/payments/webhooks/verification.ts`
- `convex/payments/webhooks/transferCore.ts`
- `convex/demo/rateLimiter.ts`
- `convex/onboarding/verification/actions.ts`
- `convex/schema.ts`
- `convex/test/moduleMaps.ts`

## Validation
- `bun run test -- src/test/convex/onboarding/idv-callback.test.ts src/test/convex/onboarding/verification-rate-limit.test.ts`
