# Status: chunk-03-callbacks-abuse-controls

- Result: complete
- Last updated: 2026-04-23 20:27:30 EDT

## Completed tasks
- T-070: Verification rate-limit helpers for IDV start, recompute, and callback processing.
- T-080: Signed callback verification, IDV webhook route, and `convex/http.ts` registration.
- T-090: Broker-onboarding callback persistence and normalized processing helpers.

## Validation
- `bunx vitest run src/test/convex/onboarding/idv-callback.test.ts src/test/convex/onboarding/verification-rate-limit.test.ts`: covered in the scoped 7-file run that passed on 2026-04-23 20:25 EDT.

## Notes
- Callback handling now uses a broker-onboarding-specific event table and signed mock-provider verification. Production runtime consumes the existing Convex rate-limiter component; tests use the deterministic in-memory fallback to avoid component/workpool instability in `convex-test`.
