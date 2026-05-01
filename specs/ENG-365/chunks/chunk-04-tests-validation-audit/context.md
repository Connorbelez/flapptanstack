# Chunk Context: chunk-04-tests-validation-audit

## Goal
- Finish test coverage, run repo quality gates, run the required spec audit, and close artifact state.

## Relevant plan excerpts
- "Tests cover projection, permissions, cron idempotency, and checkout display."
- Required commands: `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests, and `bun run test:e2e` if checkout/admin route flows are added.

## Implementation notes
- E2E is required only if this slice adds route-level workflows beyond existing component/backend coverage.
- Storybook is required only if reusable story-covered UI components are introduced or meaningfully changed.
- The final audit must be persisted to `audit.md`.

## Existing code touchpoints
- `convex/legalRepresentation/__tests__`
- `src/test/listings`
- `specs/ENG-365/audit.md`

## Validation
- `python3 scripts/validate_execution_artifacts.py ENG-365 --repo-root "/Users/connor/Dev/tanstackFairLend/fairlendapp" --stage final --require-audit --require-all-tasks-closed --require-all-checklist-closed`
- GitNexus detect changes before final report.
