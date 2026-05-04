# Chunk Context: chunk-03-workflow-regression

## Goal
- Add backend regression coverage that executes named mock scenarios through real ingress, readiness, final review, activation failure/retry/success, query contracts, and post-live drift.

## Relevant plan excerpts
- Tests must verify webhook idempotency, full-deal fetch before workspace mutation, 1:1 `linkApplicationId`, identity exceptions, snapshot creation on upstream core changes, `Sync now`, readiness gates, final-review invalidation, unsupported payment frequencies, no override activation path, no live mortgage on provider failures, idempotent retries, successful activation, listing publication only after live activation, and post-live drift exceptions.

## Implementation notes
- Existing test files already cover many base contracts: `src/test/convex/velocity/sync.test.ts`, `workspaces.test.ts`, `activation.test.ts`, and `contracts.test.ts`.
- This chunk should add scenario-driven tests rather than replacing the lower-level tests.
- Keep browser/Playwright coverage out of this slice per ENG-337 scope.
- Storybook coverage is inapplicable because no UI components are introduced.

## Existing code touchpoints
- New expected tests: `src/test/convex/velocity/mock.test.ts`, `src/test/convex/velocity/workflow.test.ts`, `src/test/convex/velocity/query-contract.test.ts`.
- Existing tests may be updated to reuse scenario helpers if it reduces duplicate fixture code.
- GitNexus impact checks are tracked in `specs/ENG-337/status.md`.

## Validation
- Targeted command: `bun run test src/test/convex/velocity/mock.test.ts src/test/convex/velocity/workflow.test.ts src/test/convex/velocity/query-contract.test.ts`.
