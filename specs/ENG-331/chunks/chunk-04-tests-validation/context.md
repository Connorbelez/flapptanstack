# Chunk Context: chunk-04-tests-validation

## Goal
- Prove the webhook/full-deal sync spine satisfies the Linear requirements, then run required repo gates and the final spec audit.

## Relevant plan excerpts
- Tests must verify webhook idempotency, full-deal fetch before workspace mutation, 1:1 identity guarantee by `linkApplicationId`, identity exception behavior, snapshot creation on upstream core changes, and `Sync now` convergence with webhooks.
- Required validation commands: `bunx convex codegen`, `bun check`, `bun typecheck`, and targeted Convex tests.
- Before finalizing, run `$linear-pr-spec-audit` and persist the verdict in `specs/ENG-331/audit.md`.

## Implementation notes
- Add `src/test/convex/velocity/sync.test.ts`.
- Prefer small seeded Convex tests using `convex-test` patterns already present in `src/test/convex`.
- E2E and Storybook are not applicable because this issue changes backend ingestion/sync only and introduces no UI workflow.
- Keep task/checklist/chunk status synchronized with implementation results.

## Existing code touchpoints
- `src/test/convex/velocity/contracts.test.ts`: existing Velocity contract tests and import style.
- `src/test/convex/runtime.ts` and `src/test/convex/testKit.ts`: local Convex test helpers.
- `src/test/convex/payments/webhooks/convexTestHarness.ts`: reference for webhook test harness patterns if needed.
- GitNexus final check: run detect-changes equivalent through CLI before wrapping up.

## Validation
- Targeted command for Velocity tests.
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- `$linear-pr-spec-audit`
- Final artifact validation with all tasks/checklist/audit requirements.
