# Status: chunk-04-tests-validation-audit

- Result: complete
- Last updated: 2026-04-23 20:36:24 EDT

## Completed tasks
- T-100: Name matching and threshold-boundary tests.
- T-110: Runtime outcome, stale/fraud routing, and reverification invalidation tests.
- T-120: Callback authenticity/idempotency and verification rate-limit tests.
- T-900: Required scoped validation commands.
- T-910: Final `$linear-pr-spec-audit`.
- T-920: Audit findings fixed and validation rerun.

## Validation
- `bunx convex codegen`: passed on 2026-04-23 20:36 EDT.
- `bun check`: passed on 2026-04-23 20:36 EDT; existing repo-wide cognitive-complexity warnings remain outside ENG-319.
- `bun typecheck`: passed on 2026-04-23 20:36 EDT.
- `bunx vitest run src/test/convex/onboarding/brokerApplication.aggregate.test.ts src/test/convex/onboarding/brokerApplication.handoff.test.ts src/test/convex/onboarding/idv-callback.test.ts src/test/convex/onboarding/name-matching.test.ts src/test/convex/onboarding/verification-contracts.test.ts src/test/convex/onboarding/verification-rate-limit.test.ts src/test/convex/onboarding/verification-runtime.test.ts`: passed on 2026-04-23 20:36 EDT with 7 files and 34 tests.
- `bun run test -- --reporter=dot --silent`: failed on 2026-04-23 20:25 EDT with 21 unrelated non-onboarding failures; no ENG-319 scheduled-work unhandled errors remained after the handoff harness fix.

## Notes
- Final `$linear-pr-spec-audit` verdict is `ready`. The audit-driven stale-regulator mapping and callback retry hardening fixes are included in the passing scoped validation run.
