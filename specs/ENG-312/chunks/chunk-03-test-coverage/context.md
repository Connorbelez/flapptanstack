# Chunk Context: chunk-03-test-coverage

## Goal
- Add the focused fixtures, tests, stories, and validation coverage that prove the renewal consumer slice works inside both hosts and respects the runtime contract.

## Relevant plan excerpts
- "Add focused component/integration tests for shared renewal content within the rail host and position-sheet host."
- "Cover partial-exit validation, expired-state presentation, and stale-state refresh behavior."
- "Keep focused tests here instead of extending the baseline route test beyond host-level coverage."
- "Partial-exit and expired-state behavior are explicit and test-covered."

## Implementation notes
- Prefer a dedicated `src/test/lender/portfolio-renewals.test.tsx` file for shared renewal behavior, then extend the existing rail and route tests only where the integration seam changes.
- Update fixtures so tests can cover pending, renewed, exiting, expired, and sold-out/non-actionable states without mutating the runtime directly in frontend tests.
- Storybook is appropriate here because the work introduces reusable renewal-specific UI states that are shared across hosts.
- E2E may end up unnecessary if route-level and component integration coverage fully exercises the command-center host behavior; record the final justification if no browser test is added.

## Existing code touchpoints
- `src/components/lender/portfolio/fixtures.ts` already provides portfolio command-center and detail fixtures used across UI tests and stories.
- `src/test/lender/portfolio-rail.test.tsx` and `src/test/routes/lender-portfolio-route.test.tsx` are the existing host-level portfolio suites.
- `src/components/lender/portfolio/*.stories.tsx` shows Storybook is already used for lender portfolio surfaces.

## Validation
- `bun run test -- src/test/lender/portfolio-renewals.test.tsx`: not-run
- `bun run test -- src/test/lender/portfolio-rail.test.tsx`: not-run
- `bun run test -- src/test/routes/lender-portfolio-route.test.tsx`: not-run
- `bunx convex codegen`: not-run
- `bun check`: not-run
- `bun typecheck`: not-run
