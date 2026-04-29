# Status: chunk-02-aggregate-entrypoints

- Result: complete
- Last updated: 2026-04-23 20:27:30 EDT

## Completed tasks
- T-040: Aggregate-owned recommendation application and reverification invalidation helpers.
- T-050: Submit/request-changes recompute integration and aggregate-owned outcome mapping.
- T-060: IDV start and explicit recompute entry points behind verified-email gating and provider contracts.

## Validation
- `bunx vitest run src/test/convex/onboarding/brokerApplication.aggregate.test.ts src/test/convex/onboarding/brokerApplication.handoff.test.ts src/test/convex/onboarding/idv-callback.test.ts src/test/convex/onboarding/name-matching.test.ts src/test/convex/onboarding/verification-contracts.test.ts src/test/convex/onboarding/verification-rate-limit.test.ts src/test/convex/onboarding/verification-runtime.test.ts`: passed on 2026-04-23 20:25 EDT.

## Notes
- Recommendation persistence, apply-recommendation transitions, submit-time recompute scheduling, and reviewer-requested reverification invalidation are implemented additively on the existing aggregate seams.
