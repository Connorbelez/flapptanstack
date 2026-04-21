# Chunk: chunk-03-tests-validation-and-audit

- [x] T-200: Add `convex/portfolio/__tests__/snapshots.test.ts` coverage for reruns, cutoff boundaries, zero-position lenders, exited-position history, and the single-month regression path
- [x] T-210: Add `convex/portfolio/__tests__/export.test.ts` coverage for availability, completeness labeling, stable CSV rows, and live fallback behavior
- [x] T-220: Rerun or update `convex/portfolio/__tests__/queries.test.ts` if ENG-310 changes shared portfolio query contracts
- [x] T-900: Run `bunx convex codegen`, `bun check`, and `bun typecheck`
- [x] T-910: Run focused portfolio tests
- [x] T-980: Run `$linear-pr-spec-audit` against the current branch diff
- [x] T-990: Resolve audit findings or record blockers in `specs/ENG-310/audit.md`
