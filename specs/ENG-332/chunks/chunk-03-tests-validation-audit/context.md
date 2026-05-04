# Chunk Context: chunk-03-tests-validation-audit

## Goal
- Lock the backend behavior with focused Convex tests, run quality gates, run the required spec audit, and close artifacts.

## Relevant plan excerpts
- "Unit tests for readiness blockers covering funded/not-funded, PAD missing, bank data missing, unsupported frequency, missing `loanType`, missing `lienPosition`, reviewed-hash drift, and live-mortgage conflict."
- "Backend/Convex tests for board/detail DTOs, enrichment/remediation updates, PAD document linking, final-review hash storage/invalidation, and exception resolution."
- "Audit/provenance assertions for FairLend-owned edits, document linking, readiness recomputation, and review confirmation."

## Implementation notes
- Existing `src/test/convex/velocity/sync.test.ts` has helpers for creating Velocity deals/workspaces.
- Add or reuse helpers without changing production surfaces solely for tests.
- E2E and Storybook are not applicable because this issue is backend-only.

## Validation
- `bunx convex codegen`
- `bun check`
- `bun typecheck`
- targeted Velocity tests
- `$linear-pr-spec-audit`
- final artifact validation
