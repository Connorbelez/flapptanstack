# Chunk Context: chunk-02-harness-and-tests

## Goal
- Expose a thin internal callable and prove the claim-convergence contract works without production claim UI.

## Relevant plan excerpts
- "Add a thin internal or test harness that can exercise the helper before a real broker-claim UI exists."
- "Add targeted tests for safe-match reuse, ambiguous-match failure, duplicate prevention, portal reuse, and fallback routing outcomes."

## Implementation notes
- Internal callable should be `.internal()` and should not become a raw public pseudo-endpoint.
- Tests should create data directly with `convex-test` helpers and call the internal harness.
- No e2e or Storybook work is expected because this issue does not introduce a user-visible route or component.

## Existing code touchpoints
- `src/test/convex/onboarding/brokerApplicationTestHelpers.ts` contains reusable portal and identity fixtures.
- `src/test/convex/onboarding/brokerApplication.handoff.test.ts` demonstrates activation and home-portal assertions.

## Validation
- `bun run test -- src/test/convex/brokers/claimConvergence.test.ts`
