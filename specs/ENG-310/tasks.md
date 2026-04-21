# Tasks: ENG-310 - Lender portfolio: materialize historical snapshots and CSV export contracts

## Status Rules
- Keep task IDs stable.
- Add new tasks before editing newly discovered scope.
- Do not silently drop tasks; mark them complete or note the blocker.

## Phase 1: Planning
- [x] T-001: Finalize the ENG-310 implementation task list, chunk plan, and execution artifacts

## Phase 2: Snapshot Seams
- [x] T-010: Harden `portfolioSnapshots` identity and stored fields in `convex/schema.ts` so monthly and year-end snapshots can coexist deterministically for the same lender and date
- [x] T-020: Add explicit history and export validators or TypeScript contracts in `convex/portfolio/contracts.ts` for snapshot-backed chart series, CSV export metadata, and completeness labeling
- [x] T-030: Add shared date, completeness, and CSV helper logic in `convex/portfolio/snapshots.ts` and `convex/portfolio/export.ts` so materialization and public reads do not drift

## Phase 3: Materialization And Reads
- [x] T-100: Implement idempotent snapshot materialization and internal upsert behavior in `convex/portfolio/snapshots.ts`
- [x] T-110: Wire monthly and year-end snapshot cron entrypoints in `convex/crons.ts`
- [x] T-120: Publish lender historical chart reads with explicit snapshot-versus-live completeness metadata in `convex/portfolio/queries.ts` and supporting helpers
- [x] T-130: Publish the server-generated lender CSV export contract guarded by the right portfolio permission and update portfolio source-of-truth descriptions to point at the real seams

## Phase 4: Tests
- [x] T-200: Add `convex/portfolio/__tests__/snapshots.test.ts` coverage for reruns, month-end and year-end cutoffs, zero-position lenders, exited-position historical periods, and the `months: 1` regression path
- [x] T-210: Add `convex/portfolio/__tests__/export.test.ts` coverage for export availability, completeness labeling, stable CSV output, and live fallback behavior
- [x] T-220: Rerun or update `convex/portfolio/__tests__/queries.test.ts` if ENG-310 changes shared portfolio query contracts or source-of-truth messaging

## Phase 5: Validation
- [x] T-900: Run `bunx convex codegen`, `bun check`, and `bun typecheck`
- [x] T-910: Run focused tests: `bun run test -- convex/portfolio/__tests__/snapshots.test.ts convex/portfolio/__tests__/export.test.ts convex/portfolio/__tests__/queries.test.ts`

## Phase 9: Audit
- [x] T-980: Run `$linear-pr-spec-audit` against the current branch diff for ENG-310
- [x] T-990: Resolve audit findings or record blockers in `specs/ENG-310/audit.md`
