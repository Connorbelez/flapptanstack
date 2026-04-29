# Tasks: ENG-318 - Broker onboarding: build regulator lookup abstraction and FSRA import pipeline

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize the implementation task list, chunk plan, and execution artifacts for ready-to-edit validation.

## Phase 2: Contracts And Schema
- [x] T-010: Extend the shared regulator lookup contracts for normalized individual-license and brokerage lookup results without introducing parallel local types.
- [x] T-020: Add `fsraLicenses` and `fsraImportRuns` tables with typed fields and indexes in `convex/schema.ts`.

## Phase 3: Import And Provider Slice
- [x] T-030: Create `convex/onboarding/verification/fsraImport.ts` with normalization helpers, freshness ownership, stable-identifier upserts, and run start/finish helpers.
- [x] T-040: Implement the imported-data FSRA provider against local storage for exact individual-license and brokerage lookups.
- [x] T-050: Upgrade the deterministic mock provider and fixtures to match imported-data semantics, including stale and brokerage-mismatch coverage.
- [x] T-060: Wire the verification registry/config so the imported-data provider can be resolved through the existing strategy seam without route-local branching.

## Phase 4: Refresh Surfaces
- [x] T-070: Add a shared internal refresh orchestration seam that both cron and manual refresh call.
- [x] T-080: Expose an admin manual refresh action behind `onboarding:manage` and register the daily FSRA refresh cron.

## Phase 5: Tests And Validation
- [x] T-090: Add focused Convex tests for import upserts, exact lookups, brokerage association behavior, freshness mapping, provider parity, and manual refresh behavior.
- [x] T-900: Run `bunx convex codegen`, `bun check`, `bun typecheck`, and the targeted onboarding verification test scope.

## Phase 9: Audit
- [x] T-910: Run `$linear-pr-spec-audit` against the current branch diff for `ENG-318`.
- [x] T-920: Resolve audit findings or record blockers, then rerun the necessary validation.
