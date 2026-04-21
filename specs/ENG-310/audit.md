# Spec Compliance Review

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff in `/Users/connor/.codex/worktrees/a335/fairlendapp`
- Last run: 2026-04-21T20:16:46Z

## Findings
- none

- Verdict: ready

## Coverage Summary
- SATISFIED: 11
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | data model | `portfolioSnapshots` must become a real seam with deterministic identity by lender, date, and snapshot type | `convex/schema.ts`, `convex/portfolio/snapshots.ts` | Added `by_lender_snapshot` lookups and explicit materialization reads/writes |
| SATISFIED | lifecycle | Generate monthly and year-end snapshots | `convex/portfolio/snapshots.ts`, `convex/crons.ts` | Daily cron materializes completed month-end and year-end periods |
| SATISFIED | lifecycle | Snapshot reruns must be idempotent | `convex/portfolio/snapshots.ts`, `convex/portfolio/__tests__/snapshots.test.ts` | Existing snapshot is returned instead of inserting a duplicate |
| SATISFIED | date boundaries | Snapshot boundaries must use UTC-safe `YYYY-MM-DD` business dates | `convex/portfolio/snapshots.ts`, `convex/portfolio/__tests__/snapshots.test.ts` | Materialization validates business dates and computes completed periods from UTC-safe helpers |
| SATISFIED | backend contract | Publish chart-ready historical outputs without route-local recomputation | `convex/portfolio/history.ts`, `convex/portfolio/queries.ts` | Public history query returns shaped points with no UI-side snapshot assembly |
| SATISFIED | backend contract | Publish the exact server-generated CSV export contract for tax workflows | `convex/portfolio/contracts.ts`, `convex/portfolio/export.ts`, `convex/portfolio/queries.ts` | Contract includes `isAvailable`, `unavailableReason?`, `filename?`, `csv?`, `generatedAt`, `periodLabel`, and `dataCompleteness` |
| SATISFIED | completeness | Current-period and missing-snapshot fallback must be explicit | `convex/portfolio/history.ts`, `convex/portfolio/export.ts`, `convex/portfolio/__tests__/snapshots.test.ts`, `convex/portfolio/__tests__/export.test.ts` | History and export both label `live_fallback` vs `snapshot_complete` |
| SATISFIED | negative contract | Keep CSV generation on the server and out of React | `convex/portfolio/export.ts`, `convex/portfolio/helpers.ts` | CSV rows are serialized in Convex and source-of-truth text points UI to the server seam |
| SATISFIED | negative contract | Do not imply PDF, T5, or official tax-document generation | Linear issue, `convex/portfolio/contracts.ts`, `convex/portfolio/helpers.ts` | Naming and copy stay CSV/tax-export specific with no PDF or T5 language |
| SATISFIED | tests | Add focused tests for reruns, year-end boundaries, fallback, and stable export output | `convex/portfolio/__tests__/snapshots.test.ts`, `convex/portfolio/__tests__/export.test.ts`, `convex/portfolio/__tests__/queries.test.ts` | Includes zero-position, exited-position, current-period fallback, and single-month regression coverage |
| SATISFIED | validation | Repo validation commands must pass | `bunx convex codegen` passed, `bun check` passed, `bun typecheck` passed | Focused portfolio tests also passed after the final gate rerun |

## Open Questions
- The local GitNexus CLI in this worktree does not expose `detect_changes`, so final scope review used `git diff` and untracked-file inspection as the fallback evidence. The resulting change set stayed limited to the intended portfolio modules, tests, generated API bindings, and `specs/ENG-310` artifacts.
