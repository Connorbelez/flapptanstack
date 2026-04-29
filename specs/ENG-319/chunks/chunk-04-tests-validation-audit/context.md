# Chunk Context: chunk-04-tests-validation-audit

## Goal
- Add the focused backend tests required by the issue, run the repo quality gates, and close the branch with a spec audit plus any necessary follow-up fixes.

## Relevant plan excerpts
- "Add targeted tests for verified-email gating, signature authenticity, threshold boundaries (`0.92` and `0.78`), stale-data routing, fraud hard-fail routing, rate limiting, and reverification invalidation."
- "Run `bunx convex codegen`, `bun check`, and `bun typecheck`."
- "Invoke `$linear-pr-spec-audit` against the same issue and the current review target."

## Implementation notes
- The current coverage already exercises contract/config/email-verification and broker-application basics. ENG-319 needs new focused suites for runtime scoring, callback handling, and rate limiting.
- `convex/test/moduleMaps.ts` will likely need new entries for any new Convex modules so the `convex-test` harness can load them.
- E2E and Storybook are not expected for this backend/domain slice unless scope changes during implementation.

## Existing code touchpoints
- `src/test/convex/onboarding/verification-contracts.test.ts`
- `src/test/convex/onboarding/workos-email-verification.test.ts`
- `src/test/convex/onboarding/brokerApplication.aggregate.test.ts`
- `convex/test/moduleMaps.ts`
- New focused suites expected under `src/test/convex/onboarding/`

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- `bun run test -- src/test/convex/onboarding/verification-runtime.test.ts src/test/convex/onboarding/idv-callback.test.ts src/test/convex/onboarding/name-matching.test.ts src/test/convex/onboarding/verification-rate-limit.test.ts`
