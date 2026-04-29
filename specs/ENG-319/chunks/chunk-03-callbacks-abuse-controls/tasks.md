# Chunk: chunk-03-callbacks-abuse-controls

- [x] T-070: Add `convex/onboarding/verification/abuse.ts` with reusable rate-limit configuration/helpers for IDV start, verification recompute, and callback processing.
- [x] T-080: Add `convex/onboarding/verification/callbackVerification.ts` and `convex/onboarding/verification/idvWebhook.ts`, then register the broker-onboarding callback route in `convex/http.ts`.
- [x] T-090: Add broker-onboarding callback persistence and normalized processing helpers for signature verification results, idempotency, and provider callback ingestion.
